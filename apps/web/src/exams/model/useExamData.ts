import { useEffect, useState } from 'react';
import { APP_CONFIG } from '@/app/config/constants';
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
import type { ClassLookupResult } from '@njupt-search/academics-exam/query';
import type {
    ArtifactRef,
    ExamClassIndex,
    ExamClassIndexEntry,
    ExamSnapshotManifest,
} from '@njupt-search/academics-exam/snapshot';

interface UseExamDataResult {
    classMode: ClassLookupResult;
    loading: boolean;
    error: string | null;
    sourceUrl: string | null;
    sourceTitle: string | null;
    sourceUpdatedAt: string | null;
    snapshotId: string | null;
    examPeriodId: string | null;
}

type ExamDataState = UseExamDataResult & { requestKey: string | null };

interface LoadedExamIndex {
    manifest: ExamSnapshotManifest;
    classIndex: ExamClassIndex;
}

const artifactUrl = (baseUrl: string, artifact: ArtifactRef): string => {
    const separator = artifact.path.includes('?') ? '&' : '?';
    return `${baseUrl}/${artifact.path}${separator}sha256=${artifact.sha256}`;
};

export class ExamSnapshotClient {
    readonly #baseUrl: string;
    #indexPromise: Promise<LoadedExamIndex> | null = null;

    constructor(baseUrl: string) {
        this.#baseUrl = baseUrl.replace(/\/+$/, '');
    }

    initialize(signal?: AbortSignal): Promise<LoadedExamIndex> {
        if (!this.#indexPromise) {
            this.#indexPromise = this.#loadIndex(signal).catch(error => {
                this.#indexPromise = null;
                throw error;
            });
        }
        return this.#indexPromise;
    }

    async #loadIndex(signal?: AbortSignal): Promise<LoadedExamIndex> {
        const manifestUrl = `${this.#baseUrl}/manifest.json`;
        const manifest = parseExamSnapshotManifest(
            await fetchJson(manifestUrl, { signal, cache: 'no-store' }),
            manifestUrl
        );
        await assertExamSnapshotIdentity(manifest);
        const indexUrl = artifactUrl(this.#baseUrl, manifest.class_index);
        const classIndex = parseExamClassIndex(
            await fetchArtifactJson(indexUrl, manifest.class_index, {
                signal,
                cache: 'force-cache'
            }),
            indexUrl
        );
        assertClassIndexMatchesManifest(manifest, classIndex);
        return { manifest, classIndex };
    }

    async search(
        inputValue: string,
        manualSelection: string | null,
        signal?: AbortSignal
    ): Promise<UseExamDataResult> {
        const loaded = await this.initialize(signal);
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
                exams: await this.#loadClass(loaded.manifest, entry, signal)
            };
        }
        return {
            classMode,
            loading: false,
            error: null,
            sourceUrl: loaded.manifest.source_url ?? null,
            sourceTitle: loaded.manifest.source_title ?? null,
            sourceUpdatedAt: loaded.manifest.source_updated_at,
            snapshotId: loaded.manifest.snapshot_id,
            examPeriodId: loaded.manifest.exam_period.id,
        };
    }

    async #loadClass(
        manifest: ExamSnapshotManifest,
        entry: ExamClassIndexEntry,
        signal?: AbortSignal
    ) {
        const artifact = manifest.class_chunks.find(item => item.path === entry.chunk_path);
        if (!artifact) throw new Error(`ExamSnapshot class chunk is missing: ${entry.chunk_path}`);
        const url = artifactUrl(this.#baseUrl, artifact);
        const chunk = parseExamClassChunk(
            await fetchArtifactJson(url, artifact, { signal, cache: 'force-cache' }),
            url
        );
        return [...selectClassFromChunk(manifest, entry, chunk)]
            .sort((left, right) => left.start_timestamp.localeCompare(right.start_timestamp));
    }
}

const emptyResult = (loading: boolean): UseExamDataResult => ({
    classMode: { mode: 'EMPTY', classes: [], exams: [] },
    loading,
    error: null,
    sourceUrl: null,
    sourceTitle: null,
    sourceUpdatedAt: null,
    snapshotId: null,
    examPeriodId: null,
});

export function useExamData(
    enabled: boolean,
    inputValue: string,
    manualSelection: string | null
): UseExamDataResult {
    const [client] = useState(
        () => new ExamSnapshotClient(APP_CONFIG.DATA_URLS.EXAM)
    );
    const requestKey = `${inputValue}\u001f${manualSelection ?? ''}`;
    const [state, setState] = useState<ExamDataState>({
        ...emptyResult(enabled),
        requestKey: null,
    });

    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        client.search(inputValue, manualSelection, controller.signal)
            .then(result => {
                if (!controller.signal.aborted) setState({ ...result, requestKey });
            })
            .catch(error => {
                if (controller.signal.aborted) return;
                setState({
                    ...emptyResult(false),
                    requestKey,
                    classMode: { mode: 'NOT_FOUND', classes: [], exams: [] },
                    error: error instanceof Error ? error.message : '无法加载考试数据',
                });
            });
        return () => controller.abort();
    }, [client, enabled, inputValue, manualSelection, requestKey]);

    if (!enabled) return emptyResult(false);
    if (state.requestKey !== requestKey) return emptyResult(true);
    return state;
}
