import {
    assertTeachingManifestIdentity,
    parseTeachingClassChunk,
    parseTeachingClassIndex,
    parseTeachingManifest,
    parseTeachingMeetingChunk,
    parseTeachingPeriods,
    parseTeachingTerm,
} from '@njupt-search/academics-timetable';
import type {
    ArtifactRef,
    TeachingClass,
    TeachingClassIndex,
    TeachingMeeting,
    TeachingPeriods,
    TeachingSnapshotManifest,
    TeachingTerm,
} from '@njupt-search/academics-timetable';
import { forwardAbort, waitForAbort } from '@/shared/lib/abort';
import { fetchArtifactJson, fetchJson } from '@/shared/lib/fetch';

export interface LoadedTeachingIndex {
    manifest: TeachingSnapshotManifest;
    term: TeachingTerm;
    periods: TeachingPeriods;
    index: TeachingClassIndex;
}

export interface LoadedClassSchedule extends LoadedTeachingIndex {
    classInfo: TeachingClass;
    meetings: TeachingMeeting[];
}

const artifactUrl = (baseUrl: string, snapshotId: string, artifact: ArtifactRef): string => (
    `${baseUrl}/${snapshotId}/${artifact.path}?sha256=${artifact.sha256}`
);

const normalized = (value: string): string => value.trim().toUpperCase();

export class TeachingScheduleClient {
    readonly #baseUrl: string;
    #loaded: LoadedTeachingIndex | null = null;
    #initializePromise: Promise<LoadedTeachingIndex> | null = null;
    #initializeController: AbortController | null = null;
    #activeClassController: AbortController | null = null;
    #classCache = new Map<string, LoadedClassSchedule>();
    #chunkCache = new Map<string, Record<string, TeachingMeeting>>();
    #disposed = false;

    constructor(baseUrl: string) {
        this.#baseUrl = baseUrl.replace(/\/+$/, '');
    }

    initialize(signal?: AbortSignal): Promise<LoadedTeachingIndex> {
        this.#assertUsable();
        if (this.#loaded) return waitForAbort(Promise.resolve(this.#loaded), signal);
        if (!this.#initializePromise) {
            const controller = new AbortController();
            this.#initializeController = controller;
            this.#initializePromise = this.#loadIndex(controller.signal)
                .then(loaded => {
                    this.#loaded = loaded;
                    return loaded;
                })
                .catch(error => {
                    this.#initializePromise = null;
                    throw error;
                })
                .finally(() => {
                    if (this.#initializeController === controller) this.#initializeController = null;
                });
        }
        return waitForAbort(this.#initializePromise, signal);
    }

    async refresh(signal?: AbortSignal): Promise<LoadedTeachingIndex> {
        this.#assertUsable();
        this.#initializeController?.abort();
        const loaded = await this.#loadIndex(signal);
        if (this.#loaded?.manifest.snapshot_id !== loaded.manifest.snapshot_id) {
            this.#activeClassController?.abort();
            this.#classCache.clear();
            this.#chunkCache.clear();
        }
        this.#loaded = loaded;
        this.#initializePromise = Promise.resolve(loaded);
        return loaded;
    }

    async suggest(query: string, signal?: AbortSignal): Promise<string[]> {
        const loaded = await this.initialize(signal);
        const needle = normalized(query);
        if (!needle) return [];
        return loaded.index.classes
            .filter(entry => normalized(entry.class_name).includes(needle) || normalized(entry.class_id).includes(needle))
            .slice(0, 20)
            .map(entry => entry.class_name);
    }

    async loadClass(className: string, signal?: AbortSignal): Promise<LoadedClassSchedule> {
        this.#assertUsable();
        this.#activeClassController?.abort();
        const controller = new AbortController();
        this.#activeClassController = controller;
        const detach = forwardAbort(signal, controller);
        try {
            const loaded = await this.initialize(controller.signal);
            const target = normalized(className);
            const entry = loaded.index.classes.find(item => normalized(item.class_name) === target || normalized(item.class_id) === target);
            if (!entry) throw new Error(`没有找到班级 ${className}`);
            const cacheKey = `${loaded.manifest.snapshot_id}:${entry.class_id}`;
            const cached = this.#classCache.get(cacheKey);
            if (cached) return cached;
            const classArtifact = loaded.manifest.class_chunks.find(item => item.path === entry.chunk_path);
            if (!classArtifact) throw new Error(`班级分片不存在：${entry.chunk_path}`);
            const classChunk = parseTeachingClassChunk(
                await fetchArtifactJson(artifactUrl(this.#baseUrl, loaded.manifest.snapshot_id, classArtifact), classArtifact, { signal: controller.signal, cache: 'force-cache' }),
                entry.chunk_path,
            );
            const classInfo = classChunk[entry.class_id];
            if (!classInfo) throw new Error(`班级分片缺少 ${entry.class_id}`);
            const byPath = new Map<string, string[]>();
            for (const meetingId of classInfo.meeting_ids) {
                const mapping = loaded.index.meeting_chunks.find(item => item.meeting_id === meetingId);
                if (!mapping) throw new Error(`课程记录未被索引：${meetingId}`);
                byPath.set(mapping.chunk_path, [...(byPath.get(mapping.chunk_path) ?? []), meetingId]);
            }
            const meetings: TeachingMeeting[] = [];
            for (const [path, meetingIds] of byPath) {
                const chunkCacheKey = `${loaded.manifest.snapshot_id}:${path}`;
                let chunk = this.#chunkCache.get(chunkCacheKey);
                if (!chunk) {
                    const reference = loaded.manifest.meeting_chunks.find(item => item.path === path);
                    if (!reference) throw new Error(`课程分片不存在：${path}`);
                    chunk = parseTeachingMeetingChunk(
                        await fetchArtifactJson(artifactUrl(this.#baseUrl, loaded.manifest.snapshot_id, reference), reference, { signal: controller.signal, cache: 'force-cache' }),
                        path,
                    );
                    this.#chunkCache.set(chunkCacheKey, chunk);
                }
                for (const meetingId of meetingIds) {
                    const meeting = chunk[meetingId];
                    if (!meeting) throw new Error(`课程分片缺少 ${meetingId}`);
                    meetings.push(meeting);
                }
            }
            const result = { ...loaded, classInfo, meetings };
            this.#classCache.set(cacheKey, result);
            return result;
        } finally {
            detach();
            if (this.#activeClassController === controller) this.#activeClassController = null;
        }
    }

    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#initializeController?.abort();
        this.#activeClassController?.abort();
        this.#loaded = null;
        this.#initializePromise = null;
        this.#classCache.clear();
        this.#chunkCache.clear();
    }

    async #loadIndex(signal?: AbortSignal): Promise<LoadedTeachingIndex> {
        const manifestUrl = `${this.#baseUrl}/manifest.json`;
        const manifest = parseTeachingManifest(await fetchJson(manifestUrl, { signal, cache: 'no-cache' }), manifestUrl);
        await assertTeachingManifestIdentity(manifest);
        const [term, periods, index] = await Promise.all([
            fetchArtifactJson(artifactUrl(this.#baseUrl, manifest.snapshot_id, manifest.term), manifest.term, { signal, cache: 'force-cache' }).then(value => parseTeachingTerm(value)),
            fetchArtifactJson(artifactUrl(this.#baseUrl, manifest.snapshot_id, manifest.periods), manifest.periods, { signal, cache: 'force-cache' }).then(value => parseTeachingPeriods(value)),
            fetchArtifactJson(artifactUrl(this.#baseUrl, manifest.snapshot_id, manifest.class_index), manifest.class_index, { signal, cache: 'force-cache' }).then(value => parseTeachingClassIndex(value)),
        ]);
        if (term.source_id !== manifest.source_id || periods.source_id !== manifest.source_id || index.source_id !== manifest.source_id) {
            throw new Error('班级课表索引与当前数据身份不一致');
        }
        if (term.weeks.length !== manifest.week_count || index.class_count !== manifest.class_count || index.meeting_count !== manifest.meeting_count) {
            throw new Error('班级课表索引数量不一致');
        }
        return { manifest, term, periods, index };
    }

    #assertUsable(): void {
        if (this.#disposed) throw new Error('TeachingScheduleClient has been disposed');
    }
}
