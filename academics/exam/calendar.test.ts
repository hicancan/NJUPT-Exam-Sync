import { describe, expect, it } from 'vitest';
import type { Exam } from './records';
import { generateICSContent, getExamCalendarIdentity } from './calendar';

const baseExam: Exam = {
    id: 'exam-a',
    stable_key: 'stable-a',
    history_key: 'history-a',
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
    notes: '携带铅笔,橡皮;证件',
    start_timestamp: '2026-07-01T18:30:00+08:00',
    end_timestamp: '2026-07-01T20:20:00+08:00',
    duration_minutes: 110,
    date: '2026-07-01'
};

describe('exam calendar export', () => {
    it('generates Shanghai-time events and escapes text', () => {
        const content = generateICSContent([baseExam], 'B240402', [30]);
        expect(content).toContain('VERSION:2.0');
        expect(content).toContain('DTSTART;TZID=Asia/Shanghai:20260701T183000');
        expect(content).toContain('备注: 携带铅笔\\,橡皮\\;证件');
        expect(content).toContain('TRIGGER:-PT30M');
    });

    it('uses the stable business identity, not row or mutable content identity', () => {
        expect(getExamCalendarIdentity({ ...baseExam, id: 'exam-b', location: '教3－308' }))
            .toBe(getExamCalendarIdentity(baseExam));
        expect(getExamCalendarIdentity({ ...baseExam, exam_period_id: '2026-2027-1' }))
            .not.toBe(getExamCalendarIdentity(baseExam));
    });
});
