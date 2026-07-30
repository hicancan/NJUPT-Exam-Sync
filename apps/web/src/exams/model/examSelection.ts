import { getExamCalendarIdentity } from '@njupt-search/academics-exam/calendar';
import type { Exam } from '@njupt-search/academics-exam/records';

const STORAGE_PREFIX = 'njupt-search:exam-selection:';

export type ExamExportStatus = 0 | 1 | 2;

export interface ExportedExamState {
    key: string;
    fingerprint: string;
}

export interface ExamExportState {
    className: string;
    snapshotId: string;
    sourceUpdatedAt: string;
    all: ExportedExamState[];
    selected: ExportedExamState[];
}

const storageKey = (examPeriodId: string, className: string): string => (
    `${STORAGE_PREFIX}${examPeriodId}:${className.toUpperCase()}`
);

const hasExportableTime = (exam: Exam): boolean => (
    Boolean(exam.start_timestamp && exam.end_timestamp)
);

export const getExamExportKey = (exam: Exam): string => getExamCalendarIdentity(exam);

export const buildExamSelectionScope = (
    className: string | null,
    examPeriodId: string | null,
    snapshotId: string | null
): string | null => {
    if (!className || !examPeriodId || !snapshotId) return null;
    return `${examPeriodId}\u001f${className.toUpperCase()}\u001f${snapshotId}`;
};

export const buildDefaultSelectedExamIds = (
    exams: Exam[],
    exported: ExamExportState | null
): Set<string> => {
    if (!exported) {
        return new Set(exams.filter(hasExportableTime).map(exam => exam.id));
    }
    const selectedKeys = new Set(exported.selected.map(item => item.key));
    const knownKeys = new Set(exported.all.map(item => item.key));
    return new Set(
        exams
            .filter(hasExportableTime)
            .filter(exam => {
                const key = getExamExportKey(exam);
                return selectedKeys.has(key) || !knownKeys.has(key);
            })
            .map(exam => exam.id)
    );
};

export const getExamExportStatus = (
    exam: Exam,
    exported: ExamExportState | null
): ExamExportStatus => {
    if (!exported) return 0;
    const key = getExamExportKey(exam);
    const selected = exported.selected.find(item => item.key === key);
    if (!selected) {
        return exported.all.some(item => item.key === key) ? 0 : 1;
    }
    return selected.fingerprint === exam.content_fingerprint ? 0 : 2;
};

const isExamStateList = (value: unknown): value is ExportedExamState[] => (
    Array.isArray(value)
    && value.every(item => (
        item !== null
        && typeof item === 'object'
        && typeof (item as ExportedExamState).key === 'string'
        && typeof (item as ExportedExamState).fingerprint === 'string'
    ))
);

const isExamExportState = (value: unknown): value is ExamExportState => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const state = value as Partial<ExamExportState>;
    return typeof state.className === 'string'
        && typeof state.snapshotId === 'string'
        && typeof state.sourceUpdatedAt === 'string'
        && isExamStateList(state.all)
        && isExamStateList(state.selected);
};

export const readExamExportState = (
    examPeriodId: string,
    className: string
): ExamExportState | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(storageKey(examPeriodId, className));
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isExamExportState(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

export const writeExamExportState = (
    className: string,
    allExams: Exam[],
    exportedExams: Exam[],
    examPeriodId: string,
    snapshotId: string,
    sourceUpdatedAt: string
): void => {
    if (typeof window === 'undefined') return;
    const toState = (exam: Exam): ExportedExamState => ({
        key: getExamExportKey(exam),
        fingerprint: exam.content_fingerprint
    });
    const payload: ExamExportState = {
        className: className.toUpperCase(),
        snapshotId,
        sourceUpdatedAt,
        all: allExams.filter(hasExportableTime).map(toState),
        selected: exportedExams.filter(hasExportableTime).map(toState)
    };
    try {
        window.localStorage.setItem(storageKey(examPeriodId, className), JSON.stringify(payload));
    } catch {
        return;
    }
};
