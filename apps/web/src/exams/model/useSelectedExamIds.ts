import { useCallback, useMemo, useState } from 'react';
import { Exam } from '@njupt-search/academics-exam/records';
import {
    buildDefaultSelectedExamIds,
    buildExamSelectionScope,
    getExamExportStatus,
    readExamExportState,
    writeExamExportState,
} from './examSelection';

interface SelectionState {
    scope: string | null;
    selectedIds: Set<string>;
}

export const useSelectedExamIds = (
    className: string | null,
    exams: Exam[],
    snapshotId: string | null,
    examPeriodId: string | null,
    sourceUpdatedAt: string | null
) => {
    const [selection, setSelection] = useState<SelectionState>({
        scope: null,
        selectedIds: new Set()
    });
    const [, refreshExportState] = useState(0);
    const examIds = useMemo(() => exams.map(exam => exam.id), [exams]);
    const scope = useMemo(() => buildExamSelectionScope(className, examPeriodId, snapshotId), [className, snapshotId, examPeriodId]);
    const exportState = className && examPeriodId ? readExamExportState(examPeriodId, className) : null;
    const defaultSelectedIds = useMemo(
        () => buildDefaultSelectedExamIds(exams, exportState),
        [exams, exportState]
    );

    const selectedIds = selection.scope === scope
        ? selection.selectedIds
        : defaultSelectedIds;

    const toggleExamSelection = useCallback((id: string) => {
        if (!scope) return;

        setSelection(prev => {
            const base = prev.scope === scope ? prev.selectedIds : defaultSelectedIds;
            const next = new Set(base);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { scope, selectedIds: next };
        });
    }, [defaultSelectedIds, scope]);

    const selectAllExamIds = useCallback(() => {
        if (!scope) return;
        setSelection({ scope, selectedIds: new Set(examIds) });
    }, [examIds, scope]);

    const clearExamSelection = useCallback(() => {
        if (!scope) return;
        setSelection({ scope, selectedIds: new Set() });
    }, [scope]);

    const markExamsExported = useCallback((exportedExams: Exam[]) => {
        if (!className || !snapshotId || !examPeriodId || !sourceUpdatedAt) return;
        writeExamExportState(className, exams, exportedExams, examPeriodId, snapshotId, sourceUpdatedAt);
        refreshExportState(value => value + 1);
    }, [sourceUpdatedAt, className, snapshotId, examPeriodId, exams]);

    const getExamStatus = useCallback((exam: Exam) => {
        return getExamExportStatus(exam, exportState);
    }, [exportState]);

    return {
        selectedIds,
        toggleExamSelection,
        selectAllExamIds,
        clearExamSelection,
        markExamsExported,
        getExamStatus,
    };
};
