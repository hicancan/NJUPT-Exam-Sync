import { getExamCalendarIdentity } from '@njupt-search/exam-core/calendar';
import type { Exam } from '@/shared/lib/contracts';

const STORAGE_PREFIX = 'njupt-search:exam-exported:v1:';

const getStorageKey = (className: string): string => {
    return `${STORAGE_PREFIX}${encodeURIComponent(className)}`;
};

const hasExportableTime = (exam: Exam): boolean => {
    return Boolean(exam.start_timestamp && exam.end_timestamp);
};

export const getExamExportKey = (exam: Exam): string => {
    return getExamCalendarIdentity(exam);
};

export const buildExamSelectionScope = (className: string | null, exams: Exam[]): string | null => {
    if (!className) return null;
    return `${className}\u001f${exams.map(getExamExportKey).join('\u001f')}`;
};

export const buildDefaultSelectedExamIds = (
    exams: Exam[],
    exportedKeys: Set<string> | null
): Set<string> => {
    if (exportedKeys === null) {
        return new Set(exams.map(exam => exam.id));
    }

    return new Set(
        exams
            .filter(exam => hasExportableTime(exam) && !exportedKeys.has(getExamExportKey(exam)))
            .map(exam => exam.id)
    );
};

export const readExportedExamKeys = (className: string): Set<string> | null => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(getStorageKey(className));
        if (!raw) return null;

        const parsed = JSON.parse(raw) as { keys?: unknown } | unknown[];
        const keys = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.keys)
                ? parsed.keys
                : [];

        return new Set(keys.filter((key): key is string => typeof key === 'string' && key.length > 0));
    } catch {
        return null;
    }
};

export const writeExportedExamKeys = (className: string, keys: Set<string>): void => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(getStorageKey(className), JSON.stringify({
            version: 1,
            updatedAt: new Date().toISOString(),
            keys: Array.from(keys).sort(),
        }));
    } catch {
        // localStorage may be unavailable in private or restricted browser contexts.
    }
};

export const mergeExportedExamKeys = (
    className: string,
    exams: Exam[],
    existingKeys: Set<string> | null
): Set<string> => {
    const next = new Set(existingKeys ?? []);
    exams
        .filter(hasExportableTime)
        .forEach(exam => next.add(getExamExportKey(exam)));
    writeExportedExamKeys(className, next);
    return next;
};
