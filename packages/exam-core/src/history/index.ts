import {
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
