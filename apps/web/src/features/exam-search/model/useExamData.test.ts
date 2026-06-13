import { afterEach, describe, expect, it, vi } from 'vitest';
import { examDataUrlWithVersion, examSummaryUrlWithNonce, loadExamData } from './useExamData';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe('loadExamData', () => {
    it('loads fresh summary before requesting versioned exam data', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_789_012_345_000);
        const calls: Array<{ url: string; cache?: RequestCache }> = [];
        globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            calls.push({ url: String(input), cache: init?.cache });
            if (calls.length === 1) {
                return new Response(JSON.stringify({
                    generated_at: '2026-06-10T18:06:41+08:00',
                    data_version: 'a'.repeat(64),
                    files_processed: ['schedule.xlsx'],
                    total_records: 1,
                    source_url: 'https://jwc.njupt.edu.cn/2026/0610/c1594a303974/page.htm',
                    source_title: '【教务管理办公室】2025-2026学年第二学期考试安排表2026-06-10',
                }), { status: 200 });
            }
            return new Response(JSON.stringify([{
                id: 'exam-1',
                stable_key: 'b240402\u001fjs113400s\u001f算法分析与设计\u001f张三',
                content_fingerprint: 'b'.repeat(64),
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
            }]), { status: 200 });
        }) as typeof fetch;

        const result = await loadExamData();

        expect(result.totalRecords).toBe(1);
        expect(result.sourceTitle).toContain('2026-06-10');
        expect(calls).toEqual([
            {
                url: 'generated/exam/data_summary.json?fresh=mtuzrc14',
                cache: 'no-store',
            },
            {
                url: `generated/exam/all_exams.json?v=${'a'.repeat(64)}`,
                cache: 'force-cache',
            },
        ]);
    });
});

describe('examDataUrlWithVersion', () => {
    it('appends encoded version parameters without dropping existing query strings', () => {
        expect(examDataUrlWithVersion('generated/exam/all_exams.json', 'a b')).toBe(
            'generated/exam/all_exams.json?v=a%20b'
        );
        expect(examDataUrlWithVersion('generated/exam/all_exams.json?x=1', 'v/2')).toBe(
            'generated/exam/all_exams.json?x=1&v=v%2F2'
        );
    });
});

describe('examSummaryUrlWithNonce', () => {
    it('adds a cache-busting nonce for mutable summary data', () => {
        expect(examSummaryUrlWithNonce('generated/exam/data_summary.json', 'now/1')).toBe(
            'generated/exam/data_summary.json?fresh=now%2F1'
        );
        expect(examSummaryUrlWithNonce('generated/exam/data_summary.json?x=1', 'now')).toBe(
            'generated/exam/data_summary.json?x=1&fresh=now'
        );
    });
});
