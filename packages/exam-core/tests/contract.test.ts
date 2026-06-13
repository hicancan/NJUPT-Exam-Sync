import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    assertManifestMatchesExams,
    assertClassDataMatchesIndex,
    assertClassIndexMatchesManifest,
    DataContractError,
    parseExamClassData,
    parseExamClassIndex,
    parseExamData,
    parseManifest,
    resolveExamDataVersion
} from '../src/contract';
import { parseExamClassHistory, parseExamHistoryManifest } from '../src/history';

const loadPublicJson = (relativePath: string): unknown => {
    return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf-8'));
};

describe('exam-core data contract', () => {
    it('accepts the committed public data files', () => {
        const exams = parseExamData(
            loadPublicJson('../../../apps/web/public/generated/exam/all_exams.json'),
            'apps/web/public/generated/exam/all_exams.json'
        );
        const manifest = parseManifest(
            loadPublicJson('../../../apps/web/public/generated/exam/data_summary.json'),
            'apps/web/public/generated/exam/data_summary.json'
        );
        const classIndex = parseExamClassIndex(
            loadPublicJson('../../../apps/web/public/generated/exam/class_index.json'),
            'apps/web/public/generated/exam/class_index.json'
        );
        const b240402Data = parseExamClassData(
            loadPublicJson('../../../apps/web/public/generated/exam/classes/b240402.json'),
            'apps/web/public/generated/exam/classes/b240402.json'
        );
        const historyManifest = parseExamHistoryManifest(
            loadPublicJson('../../../apps/web/public/generated/exam/history/manifest.json'),
            'apps/web/public/generated/exam/history/manifest.json'
        );
        const b240402 = parseExamClassHistory(
            loadPublicJson('../../../apps/web/public/generated/exam/history/classes/b240402.json'),
            'apps/web/public/generated/exam/history/classes/b240402.json'
        );

        assertManifestMatchesExams(manifest, exams);
        assertClassIndexMatchesManifest(manifest, classIndex);
        const b240402Index = classIndex.classes.find(item => item.class_name === 'B240402');
        expect(b240402Index).toBeTruthy();
        if (!b240402Index) {
            throw new Error('B240402 must exist in exam class_index');
        }
        assertClassDataMatchesIndex(b240402Index, b240402Data, resolveExamDataVersion(manifest));

        expect(exams.length).toBeGreaterThan(0);
        expect(manifest.files_processed.length).toBeGreaterThan(0);
        expect(resolveExamDataVersion(manifest)).toMatch(/^[a-f0-9]{64}$/);
        expect(manifest.exam_period_id).toMatch(/^\d{4}-\d{4}-[1-4]$/);
        expect(new Set(exams.map(exam => exam.id)).size).toBe(exams.length);
        expect(historyManifest.latest_data_version).toBe(resolveExamDataVersion(manifest));
        expect(historyManifest.exam_period_id).toBe(manifest.exam_period_id);
        expect(b240402.timeline[0]?.status).toBe('unchanged');
        expect(b240402.timeline.some(node => node.status === 'changed')).toBe(true);
        expect(JSON.stringify(b240402)).toContain('"before":110');
        expect(JSON.stringify(b240402)).toContain('"after":120');
    });

    it('rejects data summaries without an explicit data version', () => {
        expect(() => parseManifest({
            generated_at: '2026-06-10T00:00:00+08:00',
            exam_period_id: '2025-2026-2',
            academic_year: '2025-2026',
            term_number: 2,
            term_label: '第二学期',
            files_processed: ['schedule.xlsx'],
            total_records: 1,
            source_url: 'https://example.test/exam',
            source_title: '考试安排表',
        })).toThrow(DataContractError);
    });

    it('fails fast when all_exams is not an array', () => {
        expect(() => parseExamData({ data: [] }, 'all_exams.json')).toThrow(DataContractError);
    });

    it('fails fast on duplicate exam ids', () => {
        const exam = {
            id: 'duplicate',
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
            duration_minutes: 110,
            start_timestamp: '2026-07-01T08:00:00+08:00',
            end_timestamp: '2026-07-01T09:50:00+08:00',
            date: '2026-07-01',
        };

        expect(() => parseExamData([exam, exam], 'all_exams.json')).toThrow(/duplicate id/);
    });

    it('rejects non-positive durations and invalid timestamps', () => {
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

        expect(() => parseExamData([exam], 'all_exams.json')).toThrow(/duration_minutes/);
        expect(() => parseExamData([{
            ...exam,
            duration_minutes: 110,
            start_timestamp: 'not-a-date'
        }], 'all_exams.json')).toThrow(/start_timestamp/);
    });
});
