import {
    assertExamHistoryClassChunkIdentity,
    assertExamHistoryIdentity,
    assertExamHistoryMatchesSnapshot,
    assertExamHistoryPayloads,
    parseExamHistoryClassChunk,
    parseExamHistoryClassIndex,
    parseExamHistoryEvents,
    parseExamHistoryManifest,
    selectExamClassHistory,
} from '@njupt-search/academics-exam/history';
import type {
    ExamClassHistory,
    ExamHistoryClassIndex,
    ExamHistoryClassIndexEntry,
    ExamHistoryEvents,
    ExamHistoryManifest,
} from '@njupt-search/academics-exam/history';
import { fetchArtifactJson, fetchJson } from '@/shared/lib/fetch';
import { forwardAbort, waitForAbort } from '@/shared/lib/abort';
import type { ExamSnapshotClient } from './ExamSnapshotClient';

export interface LoadedExamHistoryIndex {
    manifest: ExamHistoryManifest;
    events: ExamHistoryEvents;
    classIndex: ExamHistoryClassIndex;
}

const artifactUrl = (
    baseUrl: string,
    historyId: string,
    artifact: { path: string; sha256: string },
): string => `${baseUrl}/${historyId}/${artifact.path}?sha256=${artifact.sha256}`;

export class ExamHistoryClient {
    readonly #baseUrl: string;
    readonly #examClient: ExamSnapshotClient;
    #loaded: LoadedExamHistoryIndex | null = null;
    #initializePromise: Promise<LoadedExamHistoryIndex> | null = null;
    #initializeController: AbortController | null = null;
    #activeClassController: AbortController | null = null;
    #classCache = new Map<string, ExamClassHistory>();
    #disposed = false;

    constructor(baseUrl: string, examClient: ExamSnapshotClient) {
        this.#baseUrl = baseUrl.replace(/\/+$/, '');
        this.#examClient = examClient;
    }

    get historyId(): string | null {
        return this.#loaded?.manifest.history_id ?? null;
    }

    initialize(signal?: AbortSignal): Promise<LoadedExamHistoryIndex> {
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

    async refresh(signal?: AbortSignal): Promise<LoadedExamHistoryIndex> {
        this.#assertUsable();
        this.#initializeController?.abort();
        this.#initializeController = null;
        this.#initializePromise = null;
        const loaded = await this.#loadIndex(signal, true);
        if (this.#loaded?.manifest.history_id !== loaded.manifest.history_id) {
            this.#activeClassController?.abort();
            this.#classCache.clear();
        }
        this.#loaded = loaded;
        this.#initializePromise = Promise.resolve(loaded);
        return loaded;
    }

    async loadClass(className: string, signal?: AbortSignal): Promise<ExamClassHistory | null> {
        this.#assertUsable();
        this.#activeClassController?.abort();
        const controller = new AbortController();
        this.#activeClassController = controller;
        const detach = forwardAbort(signal, controller);
        try {
            const loaded = await this.initialize(controller.signal);
            const entry = loaded.classIndex.classes.find(item => item.class_name === className);
            if (!entry) return null;
            const cacheKey = `${loaded.manifest.history_id}:${entry.class_key}`;
            const cached = this.#classCache.get(cacheKey);
            if (cached) return cached;
            const result = await this.#loadClassChunk(loaded.manifest, entry, controller.signal);
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
        this.#initializeController = null;
        this.#activeClassController = null;
        this.#initializePromise = null;
        this.#loaded = null;
        this.#classCache.clear();
    }

    async #loadIndex(signal?: AbortSignal, refreshExam = false): Promise<LoadedExamHistoryIndex> {
        const manifestUrl = `${this.#baseUrl}/manifest.json`;
        const [manifestValue, exam] = await Promise.all([
            fetchJson(manifestUrl, { signal, cache: 'no-cache' }),
            refreshExam ? this.#examClient.refresh(signal) : this.#examClient.initialize(signal),
        ]);
        const manifest = parseExamHistoryManifest(manifestValue, manifestUrl);
        await assertExamHistoryIdentity(manifest);
        assertExamHistoryMatchesSnapshot(manifest, exam.manifest);
        const [events, classIndex] = await Promise.all([
            fetchArtifactJson(
                artifactUrl(this.#baseUrl, manifest.history_id, manifest.events),
                manifest.events,
                { signal },
            ).then(value => parseExamHistoryEvents(value, manifest.events.path)),
            fetchArtifactJson(
                artifactUrl(this.#baseUrl, manifest.history_id, manifest.class_index),
                manifest.class_index,
                { signal },
            ).then(value => parseExamHistoryClassIndex(value, manifest.class_index.path)),
        ]);
        assertExamHistoryPayloads(manifest, events, classIndex);
        return { manifest, events, classIndex };
    }

    async #loadClassChunk(
        manifest: ExamHistoryManifest,
        entry: ExamHistoryClassIndexEntry,
        signal?: AbortSignal,
    ): Promise<ExamClassHistory> {
        const artifact = manifest.class_chunks.find(item => item.path === entry.chunk_path);
        if (!artifact) throw new Error(`ExamHistory class chunk is missing: ${entry.class_name}`);
        const chunk = parseExamHistoryClassChunk(
            await fetchArtifactJson(
                artifactUrl(this.#baseUrl, manifest.history_id, artifact),
                artifact,
                { signal },
            ),
            artifact.path,
        );
        await assertExamHistoryClassChunkIdentity(chunk);
        return selectExamClassHistory(manifest, entry, chunk);
    }

    #assertUsable(): void {
        if (this.#disposed) throw new Error('ExamHistoryClient has been disposed');
    }
}
