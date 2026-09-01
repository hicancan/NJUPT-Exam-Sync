import {
    assertTeachingOccupancyIdentity,
    parseTeachingOccupancyManifest,
    parseTeachingRoomDay,
} from '@njupt-search/academics-timetable';
import type {
    ArtifactRef,
    TeachingRoomBooking,
    TeachingRoomDay,
    TeachingRoomOccupancyManifest,
} from '@njupt-search/academics-timetable';
import type { RoomBooking } from '@njupt-search/academics-room';
import { fetchArtifactJson, fetchJson } from '@/shared/lib/fetch';
import { forwardAbort, waitForAbort } from '@/shared/lib/abort';
import type { ExamRoomOccupancyClient } from './ExamRoomOccupancyClient';
import type { SpaceClient, SpaceFamilyView, SpaceIndex } from '@/space/model/SpaceClient';

export interface ClassroomQuery {
    date?: string | null;
    week?: number | null;
    weekday?: number | null;
    period: number;
    campus?: string | null;
    building?: string | null;
    floor?: string | null;
    query?: string | null;
}

export interface ClassroomIndex {
    manifest: TeachingRoomOccupancyManifest;
    space: SpaceIndex;
}

export interface ClassroomAvailability {
    manifest: TeachingRoomOccupancyManifest;
    space: SpaceIndex;
    date: string;
    week: number;
    weekday: number;
    spatialFamilies: SpaceFamilyView[];
    candidates: SpaceFamilyView[];
    freeRooms: SpaceFamilyView[];
    occupied: Map<string, { teaching: TeachingRoomBooking[]; exams: RoomBooking[] }>;
}

const artifactUrl = (baseUrl: string, occupancyId: string, artifact: ArtifactRef): string => (
    `${baseUrl}/${occupancyId}/${artifact.path}?sha256=${artifact.sha256}`
);

const isoDate = (startDate: string, offsetDays: number): string => {
    const date = new Date(`${startDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
};

export const resolveClassroomMoment = (
    weeks: Array<{ week: number; start_date: string; end_date: string }>,
    query: Pick<ClassroomQuery, 'date' | 'week' | 'weekday'>,
): { date: string; week: number; weekday: number } => {
    const explicitDate = query.date?.trim() ?? '';
    if (explicitDate && !/^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) throw new Error('日期格式不正确');
    const week = explicitDate
        ? weeks.find(item => explicitDate >= item.start_date && explicitDate <= item.end_date)
        : weeks.find(item => item.week === query.week);
    if (!week) throw new Error(explicitDate ? `当前学期不包含 ${explicitDate}` : `没有第 ${query.week} 周的数据`);
    const date = explicitDate || isoDate(week.start_date, (query.weekday ?? 1) - 1);
    const offsetDays = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${week.start_date}T00:00:00Z`)) / 86_400_000);
    const weekday = explicitDate ? offsetDays + 1 : query.weekday ?? 1;
    if (weekday < 1 || weekday > 7) throw new Error(`${date} 不在第 ${week.week} 周内`);
    return { date, week: week.week, weekday };
};

export class ClassroomAvailabilityClient {
    readonly #baseUrl: string;
    readonly #examRooms: ExamRoomOccupancyClient;
    readonly #space: SpaceClient;
    #index: ClassroomIndex | null = null;
    #indexPromise: Promise<ClassroomIndex> | null = null;
    #initializeController: AbortController | null = null;
    #activeQueryController: AbortController | null = null;
    #dayCache = new Map<string, TeachingRoomDay>();
    #disposed = false;

    constructor(baseUrl: string, examRooms: ExamRoomOccupancyClient, space: SpaceClient) {
        this.#baseUrl = baseUrl.replace(/\/+$/, '');
        this.#examRooms = examRooms;
        this.#space = space;
    }

    get spaceClient(): SpaceClient {
        return this.#space;
    }

    initialize(signal?: AbortSignal): Promise<ClassroomIndex> {
        this.#assertUsable();
        if (this.#index) return waitForAbort(Promise.resolve(this.#index), signal);
        if (!this.#indexPromise) {
            const controller = new AbortController();
            this.#initializeController = controller;
            this.#indexPromise = Promise.all([
                this.#loadManifest(controller.signal),
                this.#space.initialize(controller.signal),
            ]).then(([manifest, space]) => {
                if (manifest.space_snapshot_id !== space.manifest.snapshot_id) throw new Error('课程占用与空间数据身份不一致');
                this.#index = { manifest, space };
                return this.#index;
            }).catch(error => {
                this.#indexPromise = null;
                throw error;
            }).finally(() => {
                if (this.#initializeController === controller) this.#initializeController = null;
            });
        }
        return waitForAbort(this.#indexPromise, signal);
    }

    async query(query: ClassroomQuery, signal?: AbortSignal): Promise<ClassroomAvailability> {
        this.#assertUsable();
        this.#activeQueryController?.abort();
        const controller = new AbortController();
        this.#activeQueryController = controller;
        const detach = forwardAbort(signal, controller);
        try {
            const [index, examManifest] = await Promise.all([
                this.initialize(controller.signal),
                this.#examRooms.initialize(controller.signal),
            ]);
            const { manifest, space } = index;
            if (manifest.exam_snapshot_id !== examManifest.exam_snapshot_id) throw new Error('课程占用与考试占用没有使用同一考试版本');
            if (manifest.space_snapshot_id !== examManifest.space_snapshot_id) throw new Error('课程与考试占用没有使用同一空间版本');
            const moment = resolveClassroomMoment(manifest.weeks, query);
            const { date, weekday } = moment;
            const dayEntry = manifest.days.find(item => item.week === moment.week && item.weekday === weekday);
            const day = dayEntry ? await this.#loadDay(manifest, dayEntry.artifact, controller.signal) : null;
            const spatialFamilies = await this.#space.listFamilies(query, controller.signal);
            const candidates = spatialFamilies.filter(item => item.family.availability_eligible === 'eligible');
            const candidateKeys = new Set(candidates.map(item => item.family.space_family_id));
            const occupied = new Map<string, { teaching: TeachingRoomBooking[]; exams: RoomBooking[] }>();
            for (const booking of day?.periods[String(query.period)] ?? []) {
                if (!candidateKeys.has(booking.space_family_id)) continue;
                const current = occupied.get(booking.space_family_id) ?? { teaching: [], exams: [] };
                current.teaching.push(booking);
                occupied.set(booking.space_family_id, current);
            }
            const examDate = examManifest.dates.find(item => item.date === date);
            if (examDate) {
                const floorIds = new Set(candidates.map(item => item.floor.floor_id));
                const floorEntries = examDate.floors.filter(item => floorIds.has(item.floor_id));
                const floors = await Promise.all(floorEntries.map(item => this.#examRooms.loadFloor(item.artifact, examManifest, controller.signal)));
                const period = manifest.periods.find(item => item.period === query.period);
                if (!period) throw new Error(`没有第 ${query.period} 节的数据`);
                const start = `${date}T${period.start_time}:00+08:00`;
                const end = `${date}T${period.end_time}:00+08:00`;
                for (const floor of floors) {
                    for (const booking of floor.bookings) {
                        if (!candidateKeys.has(booking.space_family_id) || booking.start_timestamp >= end || booking.end_timestamp <= start) continue;
                        const current = occupied.get(booking.space_family_id) ?? { teaching: [], exams: [] };
                        current.exams.push(booking);
                        occupied.set(booking.space_family_id, current);
                    }
                }
            }
            return {
                manifest,
                space,
                date,
                week: moment.week,
                weekday,
                spatialFamilies,
                candidates,
                freeRooms: candidates.filter(item => !occupied.has(item.family.space_family_id)),
                occupied,
            };
        } finally {
            detach();
            if (this.#activeQueryController === controller) this.#activeQueryController = null;
        }
    }

    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#initializeController?.abort();
        this.#activeQueryController?.abort();
        this.#index = null;
        this.#indexPromise = null;
        this.#dayCache.clear();
    }

    async #loadManifest(signal?: AbortSignal): Promise<TeachingRoomOccupancyManifest> {
        const url = `${this.#baseUrl}/manifest.json`;
        const manifest = parseTeachingOccupancyManifest(await fetchJson(url, { signal, cache: 'no-cache' }), url);
        await assertTeachingOccupancyIdentity(manifest);
        return manifest;
    }

    async #loadDay(manifest: TeachingRoomOccupancyManifest, artifact: ArtifactRef, signal?: AbortSignal): Promise<TeachingRoomDay> {
        const key = `${manifest.occupancy_id}:${artifact.path}`;
        const cached = this.#dayCache.get(key);
        if (cached) return cached;
        const day = parseTeachingRoomDay(await fetchArtifactJson(artifactUrl(this.#baseUrl, manifest.occupancy_id, artifact), artifact, { signal, cache: 'force-cache' }), artifact.path);
        if (day.teaching_snapshot_id !== manifest.teaching_snapshot_id) throw new Error('空教室分片与当前课表身份不一致');
        this.#dayCache.set(key, day);
        return day;
    }

    #assertUsable(): void {
        if (this.#disposed) throw new Error('ClassroomAvailabilityClient has been disposed');
    }
}
