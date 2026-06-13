import { getExamCalendarIdentity } from '@njupt-search/exam-core/calendar';
import type { Exam } from '@/shared/lib/contracts';

const STORAGE_PREFIX = 'njupt-search:exam-selection:v2:';

export type ExamExportStatus = 'normal' | 'new' | 'needs-update';

export interface ExportedExamSnapshot {
    key: string;
    fingerprint: string;
}

export interface ExamExportHistory {
    version: 2;
    className: string;
    dataVersion: string;
    autoUpdatedAt: string;
    exportedAt: string;
    selected: ExportedExamSnapshot[];
}

const getStorageKey = (className: string): string => {
    return `${STORAGE_PREFIX}${encodeURIComponent(className.toUpperCase())}`;
};

const hasExportableTime = (exam: Exam): boolean => {
    return Boolean(exam.start_timestamp && exam.end_timestamp);
};

export const getExamExportKey = (exam: Exam): string => {
    return getExamCalendarIdentity(exam);
};

export const getExamContentFingerprint = (exam: Exam): string => {
    return exam.content_fingerprint;
};

export const buildExamSelectionScope = (
    className: string | null,
    exams: Exam[],
    dataVersion: string | null
): string | null => {
    if (!className || !dataVersion) return null;
    return `${className.toUpperCase()}\u001f${dataVersion}\u001f${exams.map(getExamExportKey).join('\u001f')}`;
};

export const buildDefaultSelectedExamIds = (
    exams: Exam[],
    exportHistory: ExamExportHistory | null
): Set<string> => {
    if (exportHistory === null) {
        return new Set(exams.filter(hasExportableTime).map(exam => exam.id));
    }

    const selectedKeys = new Set(exportHistory.selected.map(item => item.key));
    return new Set(
        exams
            .filter(hasExportableTime)
            .filter(exam => {
                const key = getExamExportKey(exam);
                return selectedKeys.has(key) || !exportHistory.selected.some(item => item.key === key);
            })
            .map(exam => exam.id)
    );
};

export const getExamExportStatus = (
    exam: Exam,
    exportHistory: ExamExportHistory | null
): ExamExportStatus => {
    if (!exportHistory) return 'normal';
    const key = getExamExportKey(exam);
    const previous = exportHistory.selected.find(item => item.key === key);
    if (!previous) return 'new';
    return previous.fingerprint === getExamContentFingerprint(exam) ? 'normal' : 'needs-update';
};

const isExportHistory = (value: unknown): value is ExamExportHistory => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<ExamExportHistory>;
    return candidate.version === 2
        && typeof candidate.className === 'string'
        && typeof candidate.dataVersion === 'string'
        && typeof candidate.autoUpdatedAt === 'string'
        && typeof candidate.exportedAt === 'string'
        && Array.isArray(candidate.selected)
        && candidate.selected.every(item => (
            item
            && typeof item === 'object'
            && typeof (item as ExportedExamSnapshot).key === 'string'
            && typeof (item as ExportedExamSnapshot).fingerprint === 'string'
        ));
};

export const readExamExportHistory = (className: string): ExamExportHistory | null => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(getStorageKey(className));
        if (!raw) return null;

        const parsed: unknown = JSON.parse(raw);
        return isExportHistory(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

export const writeExamExportHistory = (
    className: string,
    exportedExams: Exam[],
    options: {
        dataVersion: string;
        autoUpdatedAt: string;
    }
): ExamExportHistory | null => {
    if (typeof window === 'undefined') return null;

    const selected = exportedExams
        .filter(hasExportableTime)
        .map(exam => ({
            key: getExamExportKey(exam),
            fingerprint: getExamContentFingerprint(exam),
        }))
        .sort((a, b) => a.key.localeCompare(b.key));

    const payload: ExamExportHistory = {
        version: 2,
        className: className.toUpperCase(),
        dataVersion: options.dataVersion,
        autoUpdatedAt: options.autoUpdatedAt,
        exportedAt: new Date().toISOString(),
        selected,
    };

    try {
        window.localStorage.setItem(getStorageKey(className), JSON.stringify(payload));
        return payload;
    } catch {
        return null;
    }
};
