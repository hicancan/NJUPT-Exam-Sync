import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    examClassHistoryUrlWithVersion,
    loadExamClassHistory,
} from './useExamHistory';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe('useExamHistory loaders', () => {
    it('loads one class timeline file with the current data version', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
                version: 'exam-class-history-v3',
                exam_period_id: '2025-2026-2',
                academic_year: '2025-2026',
                term_number: 2,
                term_label: '第二学期',
                class_name: 'B240402',
                class_key: 'b240402',
                generated_at: '2026-06-10T10:06:41+08:00',
                latest_data_version: 'current',
                latest_auto_updated_at: '2026-06-10T10:06:41+08:00',
                first_seen: {
                    data_version: 'first',
                    auto_updated_at: '2026-06-04T18:00:21+08:00',
                },
                timeline: [
                    {
                        data_version: 'current',
                        auto_updated_at: '2026-06-10T10:06:41+08:00',
                        exam_period_id: '2025-2026-2',
                        previous_data_version: 'second',
                        previous_auto_updated_at: '2026-06-09T10:54:23+08:00',
                        status: 'unchanged',
                        totals: {
                            added: 0,
                            removed: 0,
                            changed: 0,
                            unchanged: 1,
                            previous_records: 1,
                            current_records: 1,
                        },
                        changes: [],
                    },
                    {
                        data_version: 'second',
                        auto_updated_at: '2026-06-09T10:54:23+08:00',
                        exam_period_id: '2025-2026-2',
                        previous_data_version: 'first',
                        previous_auto_updated_at: '2026-06-08T17:37:00+08:00',
                        status: 'changed',
                        totals: {
                            added: 0,
                            removed: 0,
                            changed: 1,
                            unchanged: 0,
                            previous_records: 1,
                            current_records: 1,
                        },
                        changes: [{
                            type: 'changed',
                            identity_key: 'b240402',
                            course_name: '大学英语IV',
                            fields: [{ field: 'duration_minutes', label: '时长', before: 110, after: 120 }],
                        }],
                    },
                ],
            }), { status: 200, headers: { 'content-type': 'application/json' } }));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const history = await loadExamClassHistory({
            class_name: 'B240402',
            class_key: 'b240402',
            exam_period_id: '2025-2026-2',
            record_count: 1,
            path: 'generated/exam/classes/b240402.json',
            history_path: 'generated/exam/history/classes/b240402.json',
        }, 'current');

        expect(fetchMock).toHaveBeenCalledWith(
            'generated/exam/history/classes/b240402.json?v=current&schema=exam-public-v5',
            { cache: 'force-cache', signal: undefined }
        );
        expect(history.timeline[0]?.status).toBe('unchanged');
        expect(history.timeline[1]?.changes[0]?.fields?.[0]?.before).toBe(110);
    });

    it('builds deterministic history URLs', () => {
        expect(examClassHistoryUrlWithVersion('generated/exam/history/classes/b240402.json?x=1', 'v/2')).toBe(
            'generated/exam/history/classes/b240402.json?x=1&v=v%2F2&schema=exam-public-v5'
        );
    });
});
