import { describe, expect, it } from 'vitest';
import {
    assertClassIndexMatchesManifest,
    ExamSnapshotContractError,
    parseExamClassChunk,
    parseExamClassIndex,
    parseExamData,
    parseExamSnapshotManifest,
    selectClassFromChunk,
} from './index';

const hash = (character: string) => character.repeat(64);
const artifact = (path: string) => ({ path, bytes: 10, sha256: hash('c') });
const exam = {
    id: 'exam-1',
    stable_key: 'stable-1',
    history_key: 'history-1',
    content_fingerprint: hash('b'),
    exam_period_id: '2025-2026-2',
    campus: '三牌楼',
    class_name: 'B240402',
    course_name: '算法分析与设计',
    course_code: 'JS113400S',
    teacher: '张三',
    location: '无线楼-无1',
    raw_time: '2026年07月01日(08:00-09:50)',
    count: 31,
    duration_minutes: 110,
    start_timestamp: '2026-07-01T08:00:00+08:00',
    end_timestamp: '2026-07-01T09:50:00+08:00',
    date: '2026-07-01',
    notes: '',
};
const manifest = parseExamSnapshotManifest({
    format: 'njupt-exam-snapshot',
    snapshot_id: hash('a'),
    source_id: hash('b'),
    records_id: hash('c'),
    source_updated_at: '2026-06-10T08:14:13+00:00',
    source_url: 'https://example.test/exam',
    source_title: '2025-2026学年第二学期考试安排表',
    exam_period: {
        id: '2025-2026-2',
        academic_year: '2025-2026',
        term_number: 2,
        term_label: '第二学期',
    },
    total_records: 1,
    records: artifact('exams.json'),
    class_index: artifact('class-index.json'),
    class_chunks: [artifact('classes-000.json')],
});

describe('ExamSnapshot decoder', () => {
    it('reads one producer-shaped class chunk', () => {
        const exams = parseExamData([exam]);
        const index = parseExamClassIndex({
            format: 'njupt-exam-class-index',
            records_id: manifest.records_id,
            total_records: 1,
            class_count: 1,
            classes: [{
                class_name: 'B240402',
                class_key: 'class-key',
                record_count: 1,
                chunk_path: 'classes-000.json',
                chunk_id: hash('d'),
            }],
        });
        const chunk = parseExamClassChunk({
            format: 'njupt-exam-class-chunk',
            records_id: manifest.records_id,
            chunk_id: hash('d'),
            classes: {
                'class-key': { class_name: 'B240402', exams },
            },
        });
        assertClassIndexMatchesManifest(manifest, index);
        const entry = index.classes[0];
        if (!entry) throw new Error('fixture class index is empty');
        expect(selectClassFromChunk(manifest, entry, chunk)).toEqual(exams);
    });

    it('rejects corrupt identities and extra record fields', () => {
        expect(() => parseExamSnapshotManifest({ ...manifest, snapshot_id: 'not-a-hash' }))
            .toThrow(ExamSnapshotContractError);
        expect(() => parseExamSnapshotManifest({ ...manifest, unexpected: true }))
            .toThrow(ExamSnapshotContractError);
        expect(() => parseExamData([{ ...exam, unexpected: true }]))
            .toThrow(ExamSnapshotContractError);
    });
});
