import { useEffect, useState } from 'react';
import type {
    ExamClassHistory,
    ExamHistoryEvents,
    ExamHistoryManifest,
} from '@njupt-search/academics-exam/history';
import type { ExamHistoryClient } from './ExamHistoryClient';

interface ExamHistoryState {
    manifest: ExamHistoryManifest | null;
    events: ExamHistoryEvents | null;
    classHistory: ExamClassHistory | null;
    loading: boolean;
    error: string | null;
    requestKey: string;
}

const initialState: ExamHistoryState = {
    manifest: null,
    events: null,
    classHistory: null,
    loading: false,
    error: null,
    requestKey: '',
};

export function useExamHistory(
    client: ExamHistoryClient,
    className: string | null = null,
): ExamHistoryState {
    const [state, setState] = useState<ExamHistoryState>(initialState);
    const requestKey = className ?? '';

    useEffect(() => {
        const controller = new AbortController();
        const request = async () => {
            const loaded = await client.initialize(controller.signal);
            const classHistory = className
                ? await client.loadClass(className, controller.signal)
                : null;
            setState({
                manifest: loaded.manifest,
                events: loaded.events,
                classHistory,
                loading: false,
                error: null,
                requestKey,
            });
        };
        void request().catch(error => {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            console.error('Exam history load failed:', error);
            setState(previous => ({
                ...previous,
                loading: false,
                error: '更新记录暂时无法显示，考试查询不受影响。',
                requestKey,
            }));
        });
        return () => controller.abort();
    }, [className, client, requestKey]);

    if (state.requestKey !== requestKey) {
        return {
            ...initialState,
            loading: Boolean(className),
            requestKey,
        };
    }
    return state;
}
