import { getExamCalendarIdentity } from '@njupt-search/exam-core/calendar';
import type { Exam } from '@/shared/lib/contracts';

const STORAGE_PREFIX = 'njupt-search:exam-selection:v3:';

export type ExamExportStatus = 0 | 1 | 2;

export type ExportedExamSnapshot = readonly [key: string, fingerprint: string];

export type ExamExportHistory = readonly [
    version: 3,
    className: string,
    dataVersion: string,
    autoUpdatedAt: string,
    all: ExportedExamSnapshot[],
    selected: ExportedExamSnapshot[],
];

const getStorageKey = (examPeriodId: string, className: string): string => {
    return `${STORAGE_PREFIX}${examPeriodId}:${className.toUpperCase()}`;
};

const hasExportableTime = (exam: Exam): boolean => {
    return Boolean(exam.start_timestamp && exam.end_timestamp);
};

export const getExamExportKey = (exam: Exam): string => {
    return getExamCalendarIdentity(exam);
};

export const buildExamSelectionScope = (
    className: string | null,
    examPeriodId: string | null,
    dataVersion: string | null
): string | null => {
    if (!className || !examPeriodId || !dataVersion) return null;
    return `${examPeriodId}\u001f${className.toUpperCase()}\u001f${dataVersion}`;
};

export const buildDefaultSelectedExamIds = (
    exams: Exam[],
    exportHistory: ExamExportHistory | null
): Set<string> => {
    if (exportHistory === null) {
        return new Set(exams.filter(hasExportableTime).map(exam => exam.id));
    }

    const selectedKeys = new Set(exportHistory[5].map(item => item[0]));
    const previousKeys = new Set(exportHistory[4].map(item => item[0]));
    return new Set(
        exams
            .filter(hasExportableTime)
            .filter(exam => {
                const key = getExamExportKey(exam);
                return selectedKeys.has(key) || !previousKeys.has(key);
            })
            .map(exam => exam.id)
    );
};

export const getExamExportStatus = (
    exam: Exam,
    exportHistory: ExamExportHistory | null
): ExamExportStatus => {
    if (!exportHistory) return 0;
    const key = getExamExportKey(exam);
    const previous = exportHistory[5].find(item => item[0] === key);
    if (!previous) {
        return exportHistory[4].some(item => item[0] === key) ? 0 : 1;
    }
    return previous[1] === exam.content_fingerprint ? 0 : 2;
};

const isExportHistory = (value: unknown): value is ExamExportHistory => {
    return Array.isArray(value)
        && value[0] === 3
        && Array.isArray(value[4])
        && Array.isArray(value[5]);
};

export const readExamExportHistory = (examPeriodId: string, className: string): ExamExportHistory | null => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(getStorageKey(examPeriodId, className));
        if (!raw) return null;

        const parsed: unknown = JSON.parse(raw);
        return isExportHistory(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

export const writeExamExportHistory = (
    className: string,
    allExams: Exam[],
    exportedExams: Exam[],
    examPeriodId: string,
    dataVersion: string,
    autoUpdatedAt: string
): void => {
    if (typeof window === 'undefined') return;

    const all = allExams
        .filter(hasExportableTime)
        .map(exam => [getExamExportKey(exam), exam.content_fingerprint] as const);

    const selected = exportedExams
        .filter(hasExportableTime)
        .map(exam => [getExamExportKey(exam), exam.content_fingerprint] as const);

    const payload: ExamExportHistory = [3, className.toUpperCase(), dataVersion, autoUpdatedAt, all, selected];

    try {
        window.localStorage.setItem(getStorageKey(examPeriodId, className), JSON.stringify(payload));
    } catch {
        return;
    }
};
