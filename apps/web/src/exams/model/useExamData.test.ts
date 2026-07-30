import { afterEach, describe, expect, it, vi } from 'vitest';
import { examSnapshotIdentityText } from '@njupt-search/academics-exam/snapshot';
import type { Manifest } from '@njupt-search/academics-exam/records';
import { examDataUrlWithVersion, examSummaryUrlWithNonce, loadExamClassSearch } from './useExamData';

const originalFetch = globalThis.fetch;
const version = 'a'.repeat(64);

const artifactFor = async (path: string, text: string) => {
    const bytes = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return {
        path,
        bytes: bytes.byteLength,
        sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
    };
};

const hashText = async (text: string): Promise<string> => (
    (await artifactFor('identity', text)).sha256
);

const exam = {
    id: 'exam-1',
    stable_key: 'b240402\u001fjs113400s\u001f算法分析与设计\u001f张三',
    content_fingerprint: 'b'.repeat(64),
    exam_period_id: '2025-2026-2',
    duplicate_count: 1,
    source_refs: [{ id: 'schedule.xlsx-2', source_file: 'schedule.xlsx', row_index: 2 }],
    campus: '仙林',
    class_name: 'B240402',
    course_name: '算法分析与设计',
    course_code: 'JS113400S',
    teacher: '张三',
    location: '教室A',
    raw_time: '2026年06月16日(08:00-09:50)',
    count: 31,
    duration_minutes: 110,
    start_timestamp: '2026-06-16T08:00:00+08:00',
    end_timestamp: '2026-06-16T09:50:00+08:00',
    date: '2026-06-16',
};

afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe('loadExamClassSearch', () => {
    it('loads summary and class index before requesting one class file', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_789_012_345_000);
        const calls: Array<{ url: string; cache?: RequestCache }> = [];
        const classDataPayload = {
            version: 'exam-class-data-v1',
            exam_period_id: '2025-2026-2',
            academic_year: '2025-2026',
            term_number: 2,
            term_label: '第二学期',
            data_version: version,
            generated_at: '2026-06-10T18:06:41+08:00',
            source_url: 'https://jwc.njupt.edu.cn/2026/0610/c1594a303974/page.htm',
            source_title: '【教务管理办公室】2025-2026学年第二学期考试安排表2026-06-10',
            class_name: 'B240402',
            class_key: 'b240402',
            record_count: 1,
            exams: [exam],
        };
        const classDataText = JSON.stringify(classDataPayload);
        const classDataRef = await artifactFor('classes/b240402.json', classDataText);
        const historyRef = await artifactFor(
            'history/classes/b240402.json',
            JSON.stringify({ unused: true }),
        );
        const classIndexPayload = {
            version: 'exam-class-index-v2',
            generated_at: '2026-06-10T18:06:41+08:00',
            data_version: version,
            exam_period_id: '2025-2026-2',
            academic_year: '2025-2026',
            term_number: 2,
            term_label: '第二学期',
            source_url: 'https://jwc.njupt.edu.cn/2026/0610/c1594a303974/page.htm',
            source_title: '【教务管理办公室】2025-2026学年第二学期考试安排表2026-06-10',
            total_records: 1,
            class_count: 1,
            classes: [{
                class_name: 'B240402',
                class_key: 'b240402',
                exam_period_id: '2025-2026-2',
                record_count: 1,
                data: classDataRef,
                history: historyRef,
            }],
        };
        const classIndexText = JSON.stringify(classIndexPayload);
        const manifestPayload = {
            format: 'njupt-exam-snapshot-v2',
            snapshot_id: '0'.repeat(64),
            generated_at: '2026-06-10T18:06:41+08:00',
            data_version: version,
            exam_period_id: '2025-2026-2',
            academic_year: '2025-2026',
            term_number: 2,
            term_label: '第二学期',
            files_processed: ['schedule.xlsx'],
            total_records: 1,
            source_url: 'https://jwc.njupt.edu.cn/2026/0610/c1594a303974/page.htm',
            source_title: '【教务管理办公室】2025-2026学年第二学期考试安排表2026-06-10',
            artifacts: {
                records: await artifactFor('exams.json', JSON.stringify([exam])),
                class_index: await artifactFor('class-index.json', classIndexText),
                history_manifest: await artifactFor('history/manifest.json', JSON.stringify({ unused: true })),
            },
        };
        manifestPayload.snapshot_id = await hashText(
            examSnapshotIdentityText(manifestPayload as Manifest),
        );
        globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            calls.push({ url: String(input), cache: init?.cache });
            if (calls.length === 1) {
                return new Response(JSON.stringify(manifestPayload), { status: 200, headers: { 'content-type': 'application/json' } });
            }
            if (calls.length === 2) {
                return new Response(classIndexText, { status: 200, headers: { 'content-type': 'application/json' } });
            }
            return new Response(classDataText, { status: 200, headers: { 'content-type': 'application/json' } });
        }) as typeof fetch;

        const result = await loadExamClassSearch('B240402', null);

        expect(result.examPeriodId).toBe('2025-2026-2');
        expect(result.classMode.mode).toBe('DETAIL');
        expect(result.classMode.exams).toHaveLength(1);
        expect(calls).toEqual([
            {
                url: '/generated/exam/manifest.json?fresh=mtuzrc14',
                cache: 'no-store',
            },
            {
                url: '/generated/exam/class-index.json?fresh=mtuzrc14',
                cache: 'no-store',
            },
            {
                url: `/generated/exam/classes/b240402.json?v=${classDataRef.sha256}`,
                cache: 'force-cache',
            },
        ]);
    });
});

describe('examDataUrlWithVersion', () => {
    it('appends encoded version parameters without dropping existing query strings', () => {
        expect(examDataUrlWithVersion('generated/exam/classes/b240402.json', 'a b')).toBe(
            'generated/exam/classes/b240402.json?v=a+b'
        );
        expect(examDataUrlWithVersion('generated/exam/classes/b240402.json?x=1', 'v/2')).toBe(
            'generated/exam/classes/b240402.json?x=1&v=v%2F2'
        );
    });
});

describe('examSummaryUrlWithNonce', () => {
    it('adds a cache-busting nonce for mutable summary data', () => {
        expect(examSummaryUrlWithNonce('generated/exam/manifest.json', 'now/1')).toBe(
            'generated/exam/manifest.json?fresh=now%2F1'
        );
        expect(examSummaryUrlWithNonce('generated/exam/manifest.json?x=1', 'now')).toBe(
            'generated/exam/manifest.json?x=1&fresh=now'
        );
    });
});
