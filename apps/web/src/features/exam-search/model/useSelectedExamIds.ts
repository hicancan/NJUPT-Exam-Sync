import { useCallback, useMemo, useState } from 'react';
import { Exam } from '@/shared/lib/contracts';
import {
    buildDefaultSelectedExamIds,
    buildExamSelectionScope,
    getExamExportStatus,
    readExamExportHistory,
    writeExamExportHistory,
} from './examSelection';

interface SelectionState {
    scope: string | null;
    selectedIds: Set<string>;
}

export const useSelectedExamIds = (
    className: string | null,
    exams: Exam[],
    dataVersion: string | null,
    autoUpdatedAt: string | null
) => {
    const [selection, setSelection] = useState<SelectionState>({
        scope: null,
        selectedIds: new Set()
    });
    const [, refreshExportHistory] = useState(0);
    const examIds = useMemo(() => exams.map(exam => exam.id), [exams]);
    const scope = useMemo(() => buildExamSelectionScope(className, exams, dataVersion), [className, dataVersion, exams]);
    const exportHistory = className ? readExamExportHistory(className) : null;
    const defaultSelectedIds = useMemo(
        () => buildDefaultSelectedExamIds(exams, exportHistory),
        [exams, exportHistory]
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
        if (!className || !dataVersion || !autoUpdatedAt) return;
        writeExamExportHistory(className, exportedExams, { dataVersion, autoUpdatedAt });
        refreshExportHistory(version => version + 1);
    }, [autoUpdatedAt, className, dataVersion]);

    const getExamStatus = useCallback((exam: Exam) => {
        return getExamExportStatus(exam, exportHistory);
    }, [exportHistory]);

    return {
        selectedIds,
        toggleExamSelection,
        selectAllExamIds,
        clearExamSelection,
        markExamsExported,
        getExamStatus,
    };
};
