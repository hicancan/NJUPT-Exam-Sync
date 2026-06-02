import { useCallback, useMemo, useState } from 'react';
import { Exam } from '@/shared/lib/contracts';
import {
    buildDefaultSelectedExamIds,
    buildExamSelectionScope,
    mergeExportedExamKeys,
    readExportedExamKeys,
} from './examSelection';

interface SelectionState {
    scope: string | null;
    selectedIds: Set<string>;
}

export const useSelectedExamIds = (className: string | null, exams: Exam[]) => {
    const [selection, setSelection] = useState<SelectionState>({
        scope: null,
        selectedIds: new Set()
    });
    const [, refreshExportHistory] = useState(0);
    const examIds = useMemo(() => exams.map(exam => exam.id), [exams]);
    const scope = useMemo(() => buildExamSelectionScope(className, exams), [className, exams]);
    const exportedKeys = className ? readExportedExamKeys(className) : null;
    const defaultSelectedIds = useMemo(
        () => buildDefaultSelectedExamIds(exams, exportedKeys),
        [exams, exportedKeys]
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
        if (!className) return;
        mergeExportedExamKeys(className, exportedExams, exportedKeys);
        refreshExportHistory(version => version + 1);
    }, [className, exportedKeys]);

    return {
        selectedIds,
        toggleExamSelection,
        selectAllExamIds,
        clearExamSelection,
        markExamsExported,
    };
};
