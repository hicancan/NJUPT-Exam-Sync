import { describe, expect, it } from 'vitest';
import type { Exam } from '@/shared/lib/contracts';
import {
    buildDefaultSelectedExamIds,
    getExamExportStatus,
    getExamExportKey,
    type ExamExportHistory,
} from './examSelection';

const baseExam: Exam = {
    id: '2025-2026学年第二学期考试安排表.xlsx-497',
    stable_key: 'b240402\u001fdg1011x0s\u001f数字电路与逻辑设计b\u001f张晶',
    content_fingerprint: 'a'.repeat(64),
    duplicate_count: 1,
    source_refs: [{
        id: '2025-2026学年第二学期考试安排表.xlsx-497',
        source_file: '2025-2026学年第二学期考试安排表.xlsx',
        row_index: 497,
    }],
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
    stable_key: 'b240402\u001frw1003t0c\u001f国家安全教育和军事理论\u001f李四',
    content_fingerprint: 'b'.repeat(64),
    course_name: '国家安全教育和军事理论',
    course_code: 'RW1003T0C',
    location: '教3－308',
    start_timestamp: '2026-06-10T10:10:00+08:00',
    end_timestamp: '2026-06-10T12:00:00+08:00'
};

const history: ExamExportHistory = {
    version: 2,
    className: 'B240402',
    dataVersion: 'v1',
    autoUpdatedAt: '2026-06-10T00:00:00+08:00',
    exportedAt: '2026-06-10T00:10:00+08:00',
    selected: [{
        key: getExamExportKey(baseExam),
        fingerprint: baseExam.content_fingerprint,
    }],
};

describe('exam export selection defaults', () => {
    it('selects every exam before the class has export history', () => {
        expect(buildDefaultSelectedExamIds([baseExam, newExam], null)).toEqual(
            new Set([baseExam.id, newExam.id])
        );
    });

    it('restores previously exported selections and selects newly published exams', () => {
        expect(buildDefaultSelectedExamIds(
            [baseExam, newExam],
            history
        )).toEqual(new Set([baseExam.id, newExam.id]));
    });

    it('marks a previously selected exam when its content fingerprint changes', () => {
        expect(getExamExportStatus(baseExam, history)).toBe('normal');
        expect(getExamExportStatus({ ...baseExam, content_fingerprint: 'c'.repeat(64) }, history)).toBe('needs-update');
        expect(getExamExportStatus(newExam, history)).toBe('new');
    });

    it('uses a semantic export key instead of the source row id', () => {
        expect(getExamExportKey({
            ...baseExam,
            id: '2025-2026学年第二学期考试安排表.xlsx-1723'
        })).toBe(getExamExportKey(baseExam));
    });
});
