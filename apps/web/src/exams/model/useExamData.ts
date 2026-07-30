import { useEffect, useState } from 'react';
import { APP_CONFIG } from '@/app/config/constants';
import {
    assertClassDataMatchesIndex,
    assertClassIndexMatchesManifest,
    assertExamSnapshotIdentity,
    parseExamClassData,
    parseExamClassIndex,
    parseManifest,
    resolveExamDataVersion
} from '@njupt-search/academics-exam/snapshot';
import { getClassNameSearchResult } from '@njupt-search/academics-exam/query';
import { fetchArtifactJson, fetchJson } from '@/shared/lib/fetch';
import type {
    ExamClassData,
    ExamClassIndex,
    ExamClassIndexEntry,
    Manifest,
    SearchResult
} from '@njupt-search/academics-exam/records';

interface UseExamDataResult {
    classMode: SearchResult;
    loading: boolean;
    error: string | null;
    sourceUrl: string | null;
    sourceTitle: string | null;
    generatedAt: string | null;
    dataVersion: string | null;
    examPeriodId: string | null;
    classIndex: ExamClassIndex | null;
    currentClassEntry: ExamClassIndexEntry | null;
}

type ExamDataState = UseExamDataResult & {
    requestKey: string | null;
};

const toPublicExamDataState = (state: ExamDataState): UseExamDataResult => ({
    classMode: state.classMode,
    loading: state.loading,
    error: state.error,
    sourceUrl: state.sourceUrl,
    sourceTitle: state.sourceTitle,
    generatedAt: state.generatedAt,
    dataVersion: state.dataVersion,
    examPeriodId: state.examPeriodId,
    classIndex: state.classIndex,
    currentClassEntry: state.currentClassEntry,
});

interface LoadedExamIndex {
    manifest: Manifest;
    classIndex: ExamClassIndex;
    dataVersion: string;
}

export const examDataUrlWithVersion = (url: string, dataVersion: string): string => {
    const params = new URLSearchParams({ v: dataVersion });
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.toString()}`;
};

export const examSummaryUrlWithNonce = (url: string, nonce = Date.now().toString(36)): string => {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}fresh=${encodeURIComponent(nonce)}`;
};

export async function loadExamIndex(signal?: AbortSignal): Promise<LoadedExamIndex> {
    const nonce = Date.now().toString(36);
    const summaryUrl = examSummaryUrlWithNonce(
        `${APP_CONFIG.DATA_URLS.EXAM}/manifest.json`,
        nonce,
    );
    const manifestPayload = await fetchJson(summaryUrl, signal, 'exam-summary');
    const manifestData = parseManifest(manifestPayload, summaryUrl);
    await assertExamSnapshotIdentity(manifestData);
    const dataVersion = resolveExamDataVersion(manifestData);
    const classIndexUrl = `${APP_CONFIG.DATA_URLS.EXAM}/${manifestData.artifacts.class_index.path}`;

    const classIndexPayload = await fetchArtifactJson(
        examSummaryUrlWithNonce(classIndexUrl, nonce),
        manifestData.artifacts.class_index,
        signal,
        'exam-class-index'
    );
    const classIndex = parseExamClassIndex(classIndexPayload, classIndexUrl);
    assertClassIndexMatchesManifest(manifestData, classIndex);

    return { manifest: manifestData, classIndex, dataVersion };
}

export async function loadExamClassData(
    entry: ExamClassIndexEntry,
    dataVersion: string,
    signal?: AbortSignal
): Promise<ExamClassData> {
    const payload = await fetchArtifactJson(
        examDataUrlWithVersion(`${APP_CONFIG.DATA_URLS.EXAM}/${entry.data.path}`, entry.data.sha256),
        entry.data,
        signal,
        'exam-class-data-versioned'
    );
    const classData = parseExamClassData(payload, entry.data.path);
    assertClassDataMatchesIndex(entry, classData, dataVersion);
    classData.exams.sort((a, b) => {
        if (a.start_timestamp && b.start_timestamp) return a.start_timestamp.localeCompare(b.start_timestamp);
        return a.start_timestamp ? -1 : 1;
    });
    return classData;
}

const findClassEntry = (classIndex: ExamClassIndex, className: string | null): ExamClassIndexEntry | null => {
    if (!className) return null;
    return classIndex.classes.find(item => item.class_name === className) || null;
};

export async function loadExamClassSearch(
    inputValue: string,
    manualSelection: string | null,
    signal?: AbortSignal
): Promise<UseExamDataResult> {
    const loadedIndex = await loadExamIndex(signal);
    const classNames = loadedIndex.classIndex.classes.map(item => item.class_name);
    const indexOnlyResult = getClassNameSearchResult(classNames, inputValue, manualSelection);
    const currentClassName = indexOnlyResult.mode === 'DETAIL' ? indexOnlyResult.classes[0] || null : null;
    const currentClassEntry = findClassEntry(loadedIndex.classIndex, currentClassName);
    let classMode = indexOnlyResult;

    if (currentClassEntry) {
        const classData = await loadExamClassData(currentClassEntry, loadedIndex.dataVersion, signal);
        classMode = {
            mode: 'DETAIL',
            classes: [classData.class_name],
            exams: classData.exams,
        };
    }

    return {
        classMode,
        loading: false,
        error: null,
        sourceUrl: loadedIndex.manifest.source_url || null,
        sourceTitle: loadedIndex.manifest.source_title || null,
        generatedAt: loadedIndex.manifest.generated_at,
        dataVersion: loadedIndex.dataVersion,
        examPeriodId: loadedIndex.manifest.exam_period_id,
        classIndex: loadedIndex.classIndex,
        currentClassEntry,
    };
}

export function useExamData(enabled: boolean, inputValue: string, manualSelection: string | null): UseExamDataResult {
    const requestKey = `${inputValue}\u001f${manualSelection || ''}`;
    const [state, setState] = useState<ExamDataState>({
        requestKey: null,
        classMode: { mode: 'EMPTY', classes: [], exams: [] },
        loading: enabled,
        error: null,
        sourceUrl: null,
        sourceTitle: null,
        generatedAt: null,
        dataVersion: null,
        examPeriodId: null,
        classIndex: null,
        currentClassEntry: null,
    });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const controller = new AbortController();

        loadExamClassSearch(inputValue, manualSelection, controller.signal)
            .then((loaded) => {
                if (controller.signal.aborted) return;
                setState({ ...loaded, requestKey });
            })
            .catch(err => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error(err);
                setState(previous => ({
                    ...previous,
                    classMode: { mode: 'NOT_FOUND', classes: [], exams: [] },
                    currentClassEntry: null,
                    error: err instanceof Error ? err.message : '无法加载数据：未知错误',
                    loading: false,
                }));
            });

        return () => controller.abort();
    }, [enabled, inputValue, manualSelection, requestKey]);

    if (!enabled) {
        return {
            classMode: { mode: 'EMPTY', classes: [], exams: [] },
            loading: false,
            error: null,
            sourceUrl: null,
            sourceTitle: null,
            generatedAt: null,
            dataVersion: null,
            examPeriodId: null,
            classIndex: null,
            currentClassEntry: null,
        };
    }

    if (state.requestKey !== requestKey) {
        return {
            classMode: { mode: 'EMPTY', classes: [], exams: [] },
            loading: true,
            error: null,
            sourceUrl: null,
            sourceTitle: null,
            generatedAt: null,
            dataVersion: null,
            examPeriodId: null,
            classIndex: null,
            currentClassEntry: null,
        };
    }

    const publicState = toPublicExamDataState(state);
    return {
        ...publicState,
        loading: publicState.loading,
        error: publicState.error,
    };
}
