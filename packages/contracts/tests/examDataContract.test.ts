import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    ExamSchema,
    ExamClassDataSchema,
    ExamClassHistorySchema,
    ExamClassIndexSchema,
    ExamHistoryManifestSchema,
    ManifestSchema
} from '../src/exam';
import { z } from 'zod';

const loadPublicJson = (relativePath: string): unknown => {
    return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf-8'));
};

describe('exam data contract package', () => {
    it('accepts the committed public data file shapes', () => {
        const exams = z.array(ExamSchema).parse(loadPublicJson('../../../apps/web/public/generated/exam/all_exams.json'));
        const manifest = ManifestSchema.parse(loadPublicJson('../../../apps/web/public/generated/exam/data_summary.json'));
        const classIndex = ExamClassIndexSchema.parse(loadPublicJson('../../../apps/web/public/generated/exam/class_index.json'));
        const b240402Data = ExamClassDataSchema.parse(loadPublicJson('../../../apps/web/public/generated/exam/classes/b240402.json'));
        const historyManifest = ExamHistoryManifestSchema.parse(loadPublicJson('../../../apps/web/public/generated/exam/history/manifest.json'));
        const b240402 = ExamClassHistorySchema.parse(loadPublicJson('../../../apps/web/public/generated/exam/history/classes/b240402.json'));

        expect(exams.length).toBeGreaterThan(0);
        expect(manifest.files_processed.length).toBeGreaterThan(0);
        expect(manifest.data_version).toMatch(/^[a-f0-9]{64}$/);
        expect(manifest.exam_period_id).toMatch(/^\d{4}-\d{4}-[1-4]$/);
        expect(classIndex.data_version).toBe(manifest.data_version);
        expect(b240402Data.exams.length).toBe(14);
        expect(historyManifest.latest_data_version).toBe(manifest.data_version);
        expect(historyManifest.exam_period_id).toBe(manifest.exam_period_id);
        expect(b240402.class_name).toBe('B240402');
        expect(b240402.timeline.some(node => node.status === 'unchanged')).toBe(true);
    });

    it('rejects invalid exam field shapes', () => {
        const exam = {
            id: 'invalid-time',
            stable_key: 'b240402\u001fjs113400s\u001f算法分析与设计\u001f张三',
            content_fingerprint: 'a'.repeat(64),
            exam_period_id: '2025-2026-2',
            duplicate_count: 1,
            source_refs: [{ id: 'schedule.xlsx-2', source_file: 'schedule.xlsx', row_index: 2 }],
            campus: '仙林',
            class_name: 'B240402',
            course_name: '算法分析与设计',
            course_code: 'JS113400S',
            teacher: '张三',
            location: '教3-202',
            raw_time: '2026年07月01日(08:00-09:50)',
            count: 31,
            duration_minutes: 0,
            start_timestamp: '2026-07-01T08:00:00+08:00',
            end_timestamp: '2026-07-01T09:50:00+08:00',
            date: '2026-07-01',
        };

        expect(ExamSchema.safeParse(exam).success).toBe(false);
        expect(ExamSchema.safeParse({
            ...exam,
            duration_minutes: 110,
            start_timestamp: 'not-a-date'
        }).success).toBe(false);
    });
});
