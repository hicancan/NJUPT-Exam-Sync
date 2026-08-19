import { useEffect, useState } from 'react';
import type { ClassLookupResult } from '@njupt-search/academics-exam/query';
import type { ExamSnapshotClient } from './ExamSnapshotClient';

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
    client: ExamSnapshotClient,
    enabled: boolean,
    inputValue: string,
    manualSelection: string | null
): UseExamDataResult {
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
                if (!controller.signal.aborted) setState({ ...result, loading: false, error: null, requestKey });
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
