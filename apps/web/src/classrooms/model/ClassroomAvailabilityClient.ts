import {
    assertTeachingOccupancyIdentity,
    parseTeachingOccupancyManifest,
    parseTeachingRoomDay,
} from '@njupt-search/academics-timetable';
import type {
    ArtifactRef,
    TeachingRoom,
    TeachingRoomBooking,
    TeachingRoomDay,
    TeachingRoomOccupancyManifest,
} from '@njupt-search/academics-timetable';
import type { RoomBooking } from '@njupt-search/academics-room';
import { fetchArtifactJson, fetchJson } from '@/shared/lib/fetch';
import { forwardAbort, waitForAbort } from '@/shared/lib/abort';
import type { RoomOccupancyClient } from '@/rooms/model/RoomOccupancyClient';

export interface ClassroomQuery {
    week: number;
    weekday: number;
    period: number;
    campus?: string | null;
    building?: string | null;
    floor?: string | null;
}

export interface ClassroomAvailability {
    manifest: TeachingRoomOccupancyManifest;
    date: string;
    candidates: TeachingRoom[];
    freeRooms: TeachingRoom[];
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

export class ClassroomAvailabilityClient {
    readonly #baseUrl: string;
    readonly #examRooms: RoomOccupancyClient;
    #manifest: TeachingRoomOccupancyManifest | null = null;
    #manifestPromise: Promise<TeachingRoomOccupancyManifest> | null = null;
    #initializeController: AbortController | null = null;
    #activeQueryController: AbortController | null = null;
    #dayCache = new Map<string, TeachingRoomDay>();
    #disposed = false;

    constructor(baseUrl: string, examRooms: RoomOccupancyClient) {
        this.#baseUrl = baseUrl.replace(/\/+$/, '');
        this.#examRooms = examRooms;
    }

    initialize(signal?: AbortSignal): Promise<TeachingRoomOccupancyManifest> {
        this.#assertUsable();
        if (this.#manifest) return waitForAbort(Promise.resolve(this.#manifest), signal);
        if (!this.#manifestPromise) {
            const controller = new AbortController();
            this.#initializeController = controller;
            this.#manifestPromise = this.#loadManifest(controller.signal).then(manifest => {
                this.#manifest = manifest;
                return manifest;
            }).catch(error => {
                this.#manifestPromise = null;
                throw error;
            }).finally(() => {
                if (this.#initializeController === controller) this.#initializeController = null;
            });
        }
        return waitForAbort(this.#manifestPromise, signal);
    }

    async query(query: ClassroomQuery, signal?: AbortSignal): Promise<ClassroomAvailability> {
        this.#assertUsable();
        this.#activeQueryController?.abort();
        const controller = new AbortController();
        this.#activeQueryController = controller;
        const detach = forwardAbort(signal, controller);
        try {
            const [manifest, examManifest] = await Promise.all([
                this.initialize(controller.signal),
                this.#examRooms.initialize(controller.signal),
            ]);
            if (manifest.exam_snapshot_id !== examManifest.exam_snapshot_id) throw new Error('课程与考试教室数据没有使用同一考试版本');
            const week = manifest.weeks.find(item => item.week === query.week);
            if (!week) throw new Error(`没有第 ${query.week} 周的数据`);
            const date = isoDate(week.start_date, query.weekday - 1);
            const dayEntry = manifest.days.find(item => item.week === query.week && item.weekday === query.weekday);
            const day = dayEntry ? await this.#loadDay(manifest, dayEntry.artifact, controller.signal) : null;
            const candidates = manifest.rooms.filter(room => (
                (!query.campus || room.campus === query.campus)
                && (!query.building || room.building === query.building)
                && (!query.floor || room.floor === query.floor)
            ));
            const candidateKeys = new Set(candidates.map(room => room.room_key));
            const occupied = new Map<string, { teaching: TeachingRoomBooking[]; exams: RoomBooking[] }>();
            for (const booking of day?.periods[String(query.period)] ?? []) {
                if (!candidateKeys.has(booking.room_key)) continue;
                occupied.set(booking.room_key, { teaching: [...(occupied.get(booking.room_key)?.teaching ?? []), booking], exams: occupied.get(booking.room_key)?.exams ?? [] });
            }
            const examDate = examManifest.dates.find(item => item.date === date);
            if (examDate) {
                const floorKeys = new Set(candidates.map(room => room.floor_key));
                const floorEntries = examDate.floors.filter(item => floorKeys.has(item.floor_key));
                const floors = await Promise.all(floorEntries.map(item => this.#examRooms.loadFloor(item.artifact, examManifest, controller.signal)));
                const period = manifest.periods.find(item => item.period === query.period);
                if (!period) throw new Error(`没有第 ${query.period} 节的数据`);
                const start = `${date}T${period.start_time}:00+08:00`;
                const end = `${date}T${period.end_time}:00+08:00`;
                for (const floor of floors) {
                    for (const booking of floor.bookings) {
                        if (!candidateKeys.has(booking.room_key) || booking.start_timestamp >= end || booking.end_timestamp <= start) continue;
                        const current = occupied.get(booking.room_key) ?? { teaching: [], exams: [] };
                        current.exams.push(booking);
                        occupied.set(booking.room_key, current);
                    }
                }
            }
            return { manifest, date, candidates, freeRooms: candidates.filter(room => !occupied.has(room.room_key)), occupied };
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
        this.#manifest = null;
        this.#manifestPromise = null;
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
