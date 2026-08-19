import {
    assertClassIndexMatchesManifest,
    assertExamSnapshotIdentity,
    parseExamClassChunk,
    parseExamClassIndex,
    parseExamSnapshotManifest,
    selectClassFromChunk,
} from '@njupt-search/academics-exam/snapshot';
import { getClassNameSearchResult } from '@njupt-search/academics-exam/query';
import { fetchArtifactJson, fetchJson } from '@/shared/lib/fetch';
import { forwardAbort, waitForAbort } from '@/shared/lib/abort';
import type { ClassLookupResult } from '@njupt-search/academics-exam/query';
import type { Exam } from '@njupt-search/academics-exam/records';
import type {
    ArtifactRef,
    ExamClassIndex,
    ExamClassIndexEntry,
    ExamSnapshotManifest,
} from '@njupt-search/academics-exam/snapshot';

export interface ExamSearchResult {
    classMode: ClassLookupResult;
    sourceUrl: string | null;
    sourceTitle: string | null;
    sourceUpdatedAt: string | null;
    snapshotId: string;
    examPeriodId: string;
}

export interface LoadedExamIndex {
    manifest: ExamSnapshotManifest;
    classIndex: ExamClassIndex;
}

const artifactUrl = (baseUrl: string, snapshotId: string, artifact: ArtifactRef): string => {
    const path = `${baseUrl}/${snapshotId}/${artifact.path}`;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}sha256=${artifact.sha256}`;
};

export class ExamSnapshotClient {
    readonly #baseUrl: string;
    #loaded: LoadedExamIndex | null = null;
    #indexPromise: Promise<LoadedExamIndex> | null = null;
    #initializeController: AbortController | null = null;
    #activeSearchController: AbortController | null = null;
    #classCache = new Map<string, Exam[]>();
    #disposed = false;

    constructor(baseUrl: string) {
        this.#baseUrl = baseUrl.replace(/\/+$/, '');
    }

    get snapshotId(): string | null {
        return this.#loaded?.manifest.snapshot_id ?? null;
    }

    initialize(signal?: AbortSignal): Promise<LoadedExamIndex> {
        this.#assertUsable();
        if (this.#loaded) return waitForAbort(Promise.resolve(this.#loaded), signal);
        if (!this.#indexPromise) {
            const controller = new AbortController();
            this.#initializeController = controller;
            this.#indexPromise = this.#loadIndex(controller.signal)
                .then(loaded => {
                    this.#loaded = loaded;
                    return loaded;
                })
                .catch(error => {
                    this.#indexPromise = null;
                    throw error;
                })
                .finally(() => {
                    if (this.#initializeController === controller) this.#initializeController = null;
                });
        }
        return waitForAbort(this.#indexPromise, signal);
    }

    async refresh(signal?: AbortSignal): Promise<LoadedExamIndex> {
        this.#assertUsable();
        this.#initializeController?.abort();
        this.#initializeController = null;
        this.#indexPromise = null;
        const loaded = await this.#loadIndex(signal);
        if (this.#loaded?.manifest.snapshot_id !== loaded.manifest.snapshot_id) {
            this.#activeSearchController?.abort();
            this.#classCache.clear();
        }
        this.#loaded = loaded;
        this.#indexPromise = Promise.resolve(loaded);
        return loaded;
    }

    async search(
        inputValue: string,
        manualSelection: string | null,
        signal?: AbortSignal,
    ): Promise<ExamSearchResult> {
        this.#assertUsable();
        this.#activeSearchController?.abort();
        const controller = new AbortController();
        this.#activeSearchController = controller;
        const detach = forwardAbort(signal, controller);
        try {
            const loaded = await this.initialize(controller.signal);
            const classNames = loaded.classIndex.classes.map(item => item.class_name);
            const indexResult = getClassNameSearchResult(classNames, inputValue, manualSelection);
            let classMode = indexResult;
            if (indexResult.mode === 'DETAIL') {
                const className = indexResult.classes[0];
                const entry = loaded.classIndex.classes.find(item => item.class_name === className);
                if (!entry) throw new Error(`ExamSnapshot class is not indexed: ${className}`);
                classMode = {
                    mode: 'DETAIL',
                    classes: [entry.class_name],
                    exams: await this.#loadClass(loaded.manifest, entry, controller.signal),
                };
            }
            return {
                classMode,
                sourceUrl: loaded.manifest.source_url ?? null,
                sourceTitle: loaded.manifest.source_title ?? null,
                sourceUpdatedAt: loaded.manifest.source_updated_at,
                snapshotId: loaded.manifest.snapshot_id,
                examPeriodId: loaded.manifest.exam_period.id,
            };
        } finally {
            detach();
            if (this.#activeSearchController === controller) this.#activeSearchController = null;
        }
    }

    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#initializeController?.abort();
        this.#activeSearchController?.abort();
        this.#initializeController = null;
        this.#activeSearchController = null;
        this.#indexPromise = null;
        this.#loaded = null;
        this.#classCache.clear();
    }

    async #loadIndex(signal?: AbortSignal): Promise<LoadedExamIndex> {
        const manifestUrl = `${this.#baseUrl}/manifest.json`;
        const manifest = parseExamSnapshotManifest(
            await fetchJson(manifestUrl, { signal, cache: 'no-cache' }),
            manifestUrl,
        );
        await assertExamSnapshotIdentity(manifest);
        const indexUrl = artifactUrl(this.#baseUrl, manifest.snapshot_id, manifest.class_index);
        const classIndex = parseExamClassIndex(
            await fetchArtifactJson(indexUrl, manifest.class_index, {
                signal,
                cache: 'force-cache',
            }),
            indexUrl,
        );
        assertClassIndexMatchesManifest(manifest, classIndex);
        return { manifest, classIndex };
    }

    async #loadClass(
        manifest: ExamSnapshotManifest,
        entry: ExamClassIndexEntry,
        signal?: AbortSignal,
    ): Promise<Exam[]> {
        const cacheKey = `${manifest.snapshot_id}:${entry.chunk_id}:${entry.class_key}`;
        const cached = this.#classCache.get(cacheKey);
        if (cached) return cached;
        const artifact = manifest.class_chunks.find(item => item.path === entry.chunk_path);
        if (!artifact) throw new Error(`ExamSnapshot class chunk is missing: ${entry.chunk_path}`);
        const url = artifactUrl(this.#baseUrl, manifest.snapshot_id, artifact);
        const chunk = parseExamClassChunk(
            await fetchArtifactJson(url, artifact, { signal, cache: 'force-cache' }),
            url,
        );
        const exams = [...selectClassFromChunk(manifest, entry, chunk)]
            .sort((left, right) => left.start_timestamp.localeCompare(right.start_timestamp));
        this.#classCache.set(cacheKey, exams);
        return exams;
    }

    #assertUsable(): void {
        if (this.#disposed) throw new Error('ExamSnapshotClient has been disposed');
    }
}
