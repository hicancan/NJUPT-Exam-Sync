import { useEffect, useReducer } from 'react';
import { APP_CONFIG } from '@/app/config/constants';
import { fetchArtifactJson } from '@/shared/lib/fetch';
import { parseExamClassHistory } from '@njupt-search/academics-exam/history';
import type {
    ExamClassHistory,
    ExamClassIndexEntry,
} from '@njupt-search/academics-exam/records';

interface UseExamHistoryResult {
    classHistory: ExamClassHistory | null;
    loading: boolean;
    error: string | null;
}

type ExamHistoryState = UseExamHistoryResult;

type ExamHistoryAction =
    | { type: 'reset' }
    | { type: 'start' }
    | { type: 'classHistory'; classHistory: ExamClassHistory }
    | { type: 'error'; error: string }
    | { type: 'finish' };

const initialState: ExamHistoryState = {
    classHistory: null,
    loading: false,
    error: null,
};

function examHistoryReducer(state: ExamHistoryState, action: ExamHistoryAction): ExamHistoryState {
    switch (action.type) {
        case 'reset':
            return initialState;
        case 'start':
            return { ...state, classHistory: null, loading: true, error: null };
        case 'classHistory':
            return { ...state, classHistory: action.classHistory };
        case 'error':
            return { ...state, error: action.error };
        case 'finish':
            return { ...state, loading: false };
    }
}

export const examClassHistoryUrlWithVersion = (path: string, dataVersion: string): string => {
    const params = new URLSearchParams({ v: dataVersion });
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}${params.toString()}`;
};

export async function loadExamClassHistory(
    index: ExamClassIndexEntry,
    dataVersion: string,
    signal?: AbortSignal
): Promise<ExamClassHistory> {
    const url = examClassHistoryUrlWithVersion(
        `${APP_CONFIG.DATA_URLS.EXAM}/${index.history.path}`,
        index.history.sha256,
    );
    const payload = await fetchArtifactJson(
        url,
        index.history,
        signal,
        'exam-history-class-versioned',
    );
    const classHistory = parseExamClassHistory(payload, index.history.path);
    if (
        classHistory.class_key !== index.class_key
        || classHistory.class_name !== index.class_name
        || classHistory.latest_data_version !== dataVersion
    ) {
        throw new Error(`考试历史文件与班级索引不一致：${index.class_name}`);
    }
    return classHistory;
}

export function useExamHistory(
    enabled: boolean,
    currentClassEntry: ExamClassIndexEntry | null,
    dataVersion: string | null
): UseExamHistoryResult {
    const [state, dispatch] = useReducer(examHistoryReducer, initialState);

    useEffect(() => {
        if (!enabled || !currentClassEntry || !dataVersion) {
            dispatch({ type: 'reset' });
            return;
        }

        const controller = new AbortController();
        dispatch({ type: 'start' });

        loadExamClassHistory(currentClassEntry, dataVersion, controller.signal)
            .then((loadedClassHistory) => {
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
    }, [enabled, currentClassEntry, dataVersion]);

    return {
        classHistory: enabled ? state.classHistory : null,
        loading: enabled && state.loading,
        error: enabled ? state.error : null,
    };
}
