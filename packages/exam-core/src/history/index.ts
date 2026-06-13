import {
    type ExamHistoryChange,
    ExamClassHistorySchema,
    ExamHistoryManifestSchema,
    type ExamClassHistory,
    type ExamHistoryFieldChange,
    type ExamHistoryManifest,
} from '@njupt-search/contracts/exam';
import { z } from 'zod';

export const parseExamHistoryManifest = (payload: unknown, source = 'exam history manifest'): ExamHistoryManifest => {
    try {
        return ExamHistoryManifestSchema.parse(payload) as ExamHistoryManifest;
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`${source} does not match exam history manifest contract: ${error.message}`);
        }
        throw error;
    }
};

export const parseExamClassHistory = (payload: unknown, source = 'exam class history'): ExamClassHistory => {
    try {
        return ExamClassHistorySchema.parse(payload) as ExamClassHistory;
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`${source} does not match exam class history contract: ${error.message}`);
        }
        throw error;
    }
};

export const formatExamHistoryValue = (field: ExamHistoryFieldChange, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '空';
    if (field.field === 'duration_minutes' && typeof value === 'number') return `${value} 分钟`;
    if ((field.field === 'start_timestamp' || field.field === 'end_timestamp') && typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString('zh-CN');
    }
    return String(value);
};

const formatClockTime = (value: unknown): string => {
    if (typeof value !== 'string') return String(value ?? '未知');
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleTimeString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const formatDateTime = (value: unknown): string => {
    if (typeof value !== 'string') return String(value ?? '未知');
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const numberValue = (value: unknown): number | null => (
    typeof value === 'number' && Number.isFinite(value) ? value : null
);

export const summarizeExamHistoryChange = (change: ExamHistoryChange): string[] => {
    if (change.type !== 'changed' || !change.fields?.length) return [];

    const byField = new Map(change.fields.map(field => [field.field, field]));
    const consumed = new Set<string>();
    const summaries: string[] = [];

    const duration = byField.get('duration_minutes');
    if (duration) {
        const before = numberValue(duration.before);
        const after = numberValue(duration.after);
        if (before !== null && after !== null) {
            const delta = after - before;
            if (delta !== 0) {
                const direction = delta > 0 ? '延长' : '缩短';
                let summary = `考试时长${direction} ${Math.abs(delta)} 分钟`;
                const end = byField.get('end_timestamp');
                if (end) {
                    const beforeEnd = typeof end.before === 'string' ? new Date(end.before).getTime() : Number.NaN;
                    const afterEnd = typeof end.after === 'string' ? new Date(end.after).getTime() : Number.NaN;
                    const endDirection = Number.isFinite(beforeEnd) && Number.isFinite(afterEnd) && afterEnd < beforeEnd
                        ? '提前'
                        : '推后';
                    summary += `，结束时间${endDirection}至 ${formatClockTime(end.after)}`;
                    consumed.add('end_timestamp');
                }
                summaries.push(summary);
                consumed.add('duration_minutes');
                consumed.add('raw_time');
            }
        }
    }

    const start = byField.get('start_timestamp');
    if (start && !consumed.has('start_timestamp')) {
        summaries.push(`开始时间调整为 ${formatDateTime(start.after)}`);
        consumed.add('start_timestamp');
        consumed.add('raw_time');
    }

    const end = byField.get('end_timestamp');
    if (end && !consumed.has('end_timestamp')) {
        summaries.push(`结束时间调整为 ${formatDateTime(end.after)}`);
        consumed.add('end_timestamp');
        consumed.add('raw_time');
    }

    const fieldSummary: Record<string, (field: ExamHistoryFieldChange) => string> = {
        location: field => `考试地点调整为 ${formatExamHistoryValue(field, field.after)}`,
        campus: field => `校区调整为 ${formatExamHistoryValue(field, field.after)}`,
        count: field => `考试人数调整为 ${formatExamHistoryValue(field, field.after)}`,
        notes: field => `备注调整为 ${formatExamHistoryValue(field, field.after)}`,
        raw_time: field => `考试时间调整为 ${formatExamHistoryValue(field, field.after)}`,
    };

    for (const field of change.fields) {
        if (consumed.has(field.field)) continue;
        const formatter = fieldSummary[field.field];
        summaries.push(formatter
            ? formatter(field)
            : `${field.label}：${formatExamHistoryValue(field, field.before)} → ${formatExamHistoryValue(field, field.after)}`);
        consumed.add(field.field);
    }

    return summaries;
};
