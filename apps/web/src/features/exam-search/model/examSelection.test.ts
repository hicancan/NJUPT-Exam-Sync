import { describe, expect, it } from 'vitest';
import type { Exam } from '@/shared/lib/contracts';
import {
    buildDefaultSelectedExamIds,
    getExamExportKey,
} from './examSelection';

const baseExam: Exam = {
    id: '2025-2026学年第二学期考试安排表.xlsx-497',
    campus: '仙林',
    class_name: 'B240402',
    course_name: '数字电路与逻辑设计B',
    course_code: 'DG1011X0S',
    teacher: '张晶',
    location: '教2－410',
    raw_time: '2026年07月01日(18:30-20:20)',
    count: 31,
    notes: '',
    start_timestamp: '2026-07-01T18:30:00+08:00',
    end_timestamp: '2026-07-01T20:20:00+08:00',
    duration_minutes: 110
};

const newExam: Exam = {
    ...baseExam,
    id: '2025-2026学年第二学期考试安排表.xlsx-2182',
    course_name: '国家安全教育和军事理论',
    course_code: 'RW1003T0C',
    location: '教3－308',
    start_timestamp: '2026-06-10T10:10:00+08:00',
    end_timestamp: '2026-06-10T12:00:00+08:00'
};

describe('exam export selection defaults', () => {
    it('selects every exam before the class has export history', () => {
        expect(buildDefaultSelectedExamIds([baseExam, newExam], null)).toEqual(
            new Set([baseExam.id, newExam.id])
        );
    });

    it('selects only exportable exams missing from export history', () => {
        expect(buildDefaultSelectedExamIds(
            [baseExam, newExam],
            new Set([getExamExportKey(baseExam)])
        )).toEqual(new Set([newExam.id]));
    });

    it('uses a semantic export key instead of the source row id', () => {
        expect(getExamExportKey({
            ...baseExam,
            id: '2025-2026学年第二学期考试安排表.xlsx-1723'
        })).toBe(getExamExportKey(baseExam));
    });
});
