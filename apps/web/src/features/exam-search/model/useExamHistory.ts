import { useEffect, useReducer } from 'react';
import { APP_CONFIG } from '@/app/config/constants';
import { fetchJson } from '@/shared/lib/fetch';
import {
    parseExamClassHistory,
    parseExamHistoryManifest,
} from '@njupt-search/exam-core/history';
import type {
    ExamClassHistory,
    ExamClassHistoryIndex,
    ExamHistoryManifest,
} from '@/shared/lib/contracts';

interface UseExamHistoryResult {
    manifest: ExamHistoryManifest | null;
    classHistory: ExamClassHistory | null;
    classIndex: ExamClassHistoryIndex | null;
    loading: boolean;
    error: string | null;
}

type ExamHistoryState = UseExamHistoryResult;

type ExamHistoryAction =
    | { type: 'reset' }
    | { type: 'start' }
    | { type: 'manifest'; manifest: ExamHistoryManifest; classIndex: ExamClassHistoryIndex | null }
    | { type: 'classHistory'; classHistory: ExamClassHistory }
    | { type: 'error'; error: string }
    | { type: 'finish' };

const initialState: ExamHistoryState = {
    manifest: null,
    classHistory: null,
    classIndex: null,
    loading: false,
    error: null,
};

function examHistoryReducer(state: ExamHistoryState, action: ExamHistoryAction): ExamHistoryState {
    switch (action.type) {
        case 'reset':
            return initialState;
        case 'start':
            return { ...state, classHistory: null, classIndex: null, loading: true, error: null };
        case 'manifest':
            return { ...state, manifest: action.manifest, classIndex: action.classIndex, classHistory: null };
        case 'classHistory':
            return { ...state, classHistory: action.classHistory };
        case 'error':
            return { ...state, error: action.error };
        case 'finish':
            return { ...state, loading: false };
    }
}

export const examHistoryManifestUrlWithNonce = (url: string, nonce = Date.now().toString(36)): string => {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}fresh=${encodeURIComponent(nonce)}`;
};

export const examClassHistoryUrlWithVersion = (path: string, dataVersion: string): string => {
    const params = new URLSearchParams({
        v: dataVersion,
        schema: APP_CONFIG.EXAM_PUBLIC_SCHEMA_VERSION,
    });
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}${params.toString()}`;
};

export async function loadExamHistoryManifest(signal?: AbortSignal): Promise<ExamHistoryManifest> {
    const payload = await fetchJson(
        examHistoryManifestUrlWithNonce(APP_CONFIG.DATA_URLS.HISTORY_MANIFEST),
        signal,
        'exam-history-manifest'
    );
    return parseExamHistoryManifest(payload, APP_CONFIG.DATA_URLS.HISTORY_MANIFEST);
}

export async function loadExamClassHistory(index: ExamClassHistoryIndex, dataVersion: string, signal?: AbortSignal): Promise<ExamClassHistory> {
    const url = examClassHistoryUrlWithVersion(index.path, dataVersion);
    const payload = await fetchJson(url, signal, 'exam-history-class-versioned');
    return parseExamClassHistory(payload, index.path);
}

export function useExamHistory(enabled: boolean, className: string | null): UseExamHistoryResult {
    const [state, dispatch] = useReducer(examHistoryReducer, initialState);

    useEffect(() => {
        if (!enabled) {
            dispatch({ type: 'reset' });
            return;
        }

        const controller = new AbortController();
        dispatch({ type: 'start' });

        loadExamHistoryManifest(controller.signal)
            .then(async (loadedManifest) => {
                const nextClassIndex = className
                    ? loadedManifest.classes.find(item => item.class_name.toUpperCase() === className.toUpperCase()) || null
                    : null;
                dispatch({ type: 'manifest', manifest: loadedManifest, classIndex: nextClassIndex });
                if (!nextClassIndex) {
                    return;
                }
                const loadedClassHistory = await loadExamClassHistory(nextClassIndex, loadedManifest.latest_data_version, controller.signal);
                dispatch({ type: 'classHistory', classHistory: loadedClassHistory });
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error(err);
                dispatch({ type: 'error', error: err instanceof Error ? err.message : '无法加载考试历史数据：未知错误' });
            })
            .finally(() => {
                if (!controller.signal.aborted) dispatch({ type: 'finish' });
            });

        return () => controller.abort();
    }, [enabled, className]);

    return {
        manifest: enabled ? state.manifest : null,
        classHistory: enabled ? state.classHistory : null,
        classIndex: enabled ? state.classIndex : null,
        loading: enabled && state.loading,
        error: enabled ? state.error : null,
    };
}
