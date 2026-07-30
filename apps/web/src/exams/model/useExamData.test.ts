import { afterEach, describe, expect, it, vi } from 'vitest';
import { examSnapshotIdentityText } from '@njupt-search/academics-exam/snapshot';
import type { ExamSnapshotManifest } from '@njupt-search/academics-exam/snapshot';
import { ExamSnapshotClient } from './useExamData';

const encode = (value: unknown) => JSON.stringify(value);
const sha256 = async (value: string): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};
const ref = async (path: string, content: string) => ({
    path,
    bytes: new TextEncoder().encode(content).byteLength,
    sha256: await sha256(content),
});

afterEach(() => vi.restoreAllMocks());

describe('ExamSnapshotClient', () => {
    it('initializes manifest and class index once, then fetches only the selected class chunk', async () => {
        const exam = {
            id: 'exam-1',
            stable_key: 'stable-1',
            content_fingerprint: 'a'.repeat(64),
            exam_period_id: '2025-2026-2',
            campus: '仙林',
            class_name: 'B240402',
            course_name: '算法分析与设计',
            course_code: 'JS113400S',
            teacher: '张三',
            location: '教2-313',
            raw_time: '2026年07月01日(08:00-09:50)',
            count: 31,
            start_timestamp: '2026-07-01T08:00:00+08:00',
            end_timestamp: '2026-07-01T09:50:00+08:00',
            duration_minutes: 110,
            date: '2026-07-01',
            notes: '',
        };
        const recordsId = 'b'.repeat(64);
        const chunkId = 'c'.repeat(64);
        const chunkText = encode({
            format: 'njupt-exam-class-chunk',
            records_id: recordsId,
            chunk_id: chunkId,
            classes: {
                'class-key': { class_name: 'B240402', exams: [exam] }
            }
        });
        const indexText = encode({
            format: 'njupt-exam-class-index',
            records_id: recordsId,
            total_records: 1,
            class_count: 1,
            classes: [{
                class_name: 'B240402',
                class_key: 'class-key',
                record_count: 1,
                chunk_path: 'classes-000.json',
                chunk_id: chunkId,
            }]
        });
        const recordsText = encode([exam]);
        const manifestWithoutIdentity: ExamSnapshotManifest = {
            format: 'njupt-exam-snapshot',
            snapshot_id: '0'.repeat(64),
            source_id: 'd'.repeat(64),
            records_id: recordsId,
            source_updated_at: '2026-06-10T08:14:13+00:00',
            source_url: 'https://example.test/notice',
            source_title: '2025-2026学年第二学期考试安排表',
            exam_period: {
                id: '2025-2026-2',
                academic_year: '2025-2026',
                term_number: 2,
                term_label: '第二学期',
            },
            total_records: 1,
            records: await ref('exams.json', recordsText),
            class_index: await ref('class-index.json', indexText),
            class_chunks: [await ref('classes-000.json', chunkText)],
        };
        const manifest = {
            ...manifestWithoutIdentity,
            snapshot_id: await sha256(examSnapshotIdentityText(manifestWithoutIdentity))
        };
        const manifestText = encode(manifest);
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('manifest.json')) return new Response(manifestText);
            if (url.includes('class-index.json')) return new Response(indexText);
            if (url.includes('classes-000.json')) return new Response(chunkText);
            return new Response('missing', { status: 404 });
        });
        vi.stubGlobal('fetch', fetchMock);

        const client = new ExamSnapshotClient('https://artifact.test/exam');
        const detail = await client.search('B240402', null);
        const empty = await client.search('B', null);

        expect(detail.classMode.exams).toEqual([exam]);
        expect(empty.classMode.mode).toBe('EMPTY');
        expect(fetchMock.mock.calls.filter(call => String(call[0]).includes('manifest.json'))).toHaveLength(1);
        expect(fetchMock.mock.calls.filter(call => String(call[0]).includes('class-index.json'))).toHaveLength(1);
        expect(fetchMock.mock.calls.filter(call => String(call[0]).includes('classes-000.json'))).toHaveLength(1);
    });
});
