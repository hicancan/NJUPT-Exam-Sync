import { describe, expect, it } from 'vitest';
import type { Exam } from '@njupt-search/academics-exam/records';
import {
    buildDefaultSelectedExamIds,
    getExamExportStatus,
    getExamExportKey,
    type ExamExportState,
} from './examSelection';

const baseExam: Exam = {
    id: '2025-2026学年第二学期考试安排表.xlsx-497',
    stable_key: 'b240402\u001fdg1011x0s\u001f数字电路与逻辑设计b\u001f张晶',
    content_fingerprint: 'a'.repeat(64),
    exam_period_id: '2025-2026-2',
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
    duration_minutes: 110,
    date: '2026-07-01'
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

const exportedState: ExamExportState = {
    className: 'B240402',
    snapshotId: 'a'.repeat(64),
    sourceUpdatedAt: '2026-06-10T00:00:00+08:00',
    all: [
        { key: getExamExportKey(baseExam), fingerprint: baseExam.content_fingerprint },
        { key: getExamExportKey(newExam), fingerprint: newExam.content_fingerprint },
    ],
    selected: [
        { key: getExamExportKey(baseExam), fingerprint: baseExam.content_fingerprint }
    ],
};

describe('exam export selection defaults', () => {
    it('selects every exam before the class has saved export state', () => {
        expect(buildDefaultSelectedExamIds([baseExam, newExam], null)).toEqual(
            new Set([baseExam.id, newExam.id])
        );
    });

    it('keeps previously unselected exams unselected', () => {
        expect(buildDefaultSelectedExamIds(
            [baseExam, newExam],
            exportedState
        )).toEqual(new Set([baseExam.id]));
    });

    it('selects truly new exams that were absent from the last export baseline', () => {
        const trulyNewExam = {
            ...newExam,
            id: '2025-2026学年第二学期考试安排表.xlsx-3000',
            stable_key: 'b240402\u001fjs140101s\u001f离散数学\u001f刘茜萍',
            content_fingerprint: 'd'.repeat(64),
            course_name: '离散数学',
            course_code: 'JS140101S',
        };

        expect(buildDefaultSelectedExamIds(
            [baseExam, newExam, trulyNewExam],
            exportedState
        )).toEqual(new Set([baseExam.id, trulyNewExam.id]));
    });

    it('marks a previously selected exam when its content fingerprint changes', () => {
        const trulyNewExam = {
            ...newExam,
            stable_key: 'b240402\u001fjs140101s\u001f离散数学\u001f刘茜萍',
            content_fingerprint: 'd'.repeat(64),
        };

        expect(getExamExportStatus(baseExam, exportedState)).toBe(0);
        expect(getExamExportStatus({ ...baseExam, content_fingerprint: 'c'.repeat(64) }, exportedState)).toBe(2);
        expect(getExamExportStatus(newExam, exportedState)).toBe(0);
        expect(getExamExportStatus(trulyNewExam, exportedState)).toBe(1);
    });

    it('uses a semantic export key instead of the source row id', () => {
        expect(getExamExportKey({
            ...baseExam,
            id: '2025-2026学年第二学期考试安排表.xlsx-1723'
        })).toBe(getExamExportKey(baseExam));
    });
});
