import { describe, expect, it } from 'vitest';
import {
    assertClassDataMatchesIndex,
    assertClassIndexMatchesManifest,
    assertManifestMatchesExams,
    DataContractError,
    parseExamClassData,
    parseExamClassIndex,
    parseExamData,
    parseManifest,
    resolveExamDataVersion,
} from './index';

const DATA_VERSION = 'a'.repeat(64);
const GENERATED_AT = '2026-06-10T10:06:41+08:00';
const artifact = (path: string) => ({ path, bytes: 10, sha256: 'c'.repeat(64) });
const validExam = {
    id: 'exam-1',
    stable_key: 'b240402\u001fjs113400s\u001f算法分析与设计\u001f张三',
    content_fingerprint: 'b'.repeat(64),
    exam_period_id: '2025-2026-2',
    duplicate_count: 1,
    source_refs: [{ id: 'schedule.xlsx-2', source_file: 'schedule.xlsx', row_index: 2 }],
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
};

const validManifest = {
    format: 'njupt-exam-snapshot-v2',
    snapshot_id: DATA_VERSION,
    generated_at: GENERATED_AT,
    data_version: DATA_VERSION,
    exam_period_id: '2025-2026-2',
    academic_year: '2025-2026',
    term_number: 2,
    term_label: '第二学期',
    files_processed: ['schedule.xlsx'],
    total_records: 1,
    source_url: 'https://example.test/exam',
    source_title: '考试安排表',
    artifacts: {
        records: artifact('exams.json'),
        class_index: artifact('class-index.json'),
        history_manifest: artifact('history/manifest.json'),
    },
};

describe('ExamSnapshot decoder', () => {
    it('accepts one coherent producer-shaped artifact set', () => {
        const exams = parseExamData([validExam], 'fixture/exams.json');
        const manifest = parseManifest(validManifest, 'fixture/manifest.json');
        const classIndex = parseExamClassIndex({
            version: 'exam-class-index-v2',
            generated_at: GENERATED_AT,
            data_version: DATA_VERSION,
            exam_period_id: '2025-2026-2',
            academic_year: '2025-2026',
            term_number: 2,
            term_label: '第二学期',
            total_records: 1,
            class_count: 1,
            classes: [{
                class_name: 'B240402',
                class_key: 'b240402',
                exam_period_id: '2025-2026-2',
                record_count: 1,
                data: artifact('classes/b240402.json'),
                history: artifact('history/classes/b240402.json'),
            }],
        }, 'fixture/class-index.json');
        const classData = parseExamClassData({
            version: 'exam-class-data-v1',
            exam_period_id: '2025-2026-2',
            academic_year: '2025-2026',
            term_number: 2,
            term_label: '第二学期',
            data_version: DATA_VERSION,
            generated_at: GENERATED_AT,
            class_name: 'B240402',
            class_key: 'b240402',
            record_count: 1,
            exams,
        }, 'fixture/classes/b240402.json');

        assertManifestMatchesExams(manifest, exams);
        assertClassIndexMatchesManifest(manifest, classIndex);
        const classEntry = classIndex.classes[0];
        if (!classEntry) throw new Error('fixture class index must contain one entry');
        assertClassDataMatchesIndex(classEntry, classData, resolveExamDataVersion(manifest));
        expect(classData.exams).toHaveLength(1);
    });

    it('rejects missing or incompatible snapshot identity', () => {
        expect(() => parseManifest({
            ...validManifest,
            snapshot_id: 'not-a-hash',
        })).toThrow(DataContractError);
    });

    it('fails fast on malformed or duplicate records', () => {
        expect(() => parseExamData({ data: [] }, 'exams.json')).toThrow(DataContractError);
        expect(() => parseExamData([validExam, validExam], 'exams.json')).toThrow(/duplicate id/);
        expect(() => parseExamData([{ ...validExam, duration_minutes: 0 }], 'exams.json'))
            .toThrow(/duration_minutes/);
    });
});
