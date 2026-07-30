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
        const historyPayload = {
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
            };
        const historyText = JSON.stringify(historyPayload);
        const bytes = new TextEncoder().encode(historyText);
        const hash = Array.from(
            new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)),
            byte => byte.toString(16).padStart(2, '0'),
        ).join('');
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            historyText,
            { status: 200, headers: { 'content-type': 'application/json' } },
        ));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const history = await loadExamClassHistory({
            class_name: 'B240402',
            class_key: 'b240402',
            exam_period_id: '2025-2026-2',
            record_count: 1,
            data: {
                path: 'classes/b240402.json',
                bytes: 10,
                sha256: 'a'.repeat(64),
            },
            history: {
                path: 'history/classes/b240402.json',
                bytes: bytes.byteLength,
                sha256: hash,
            },
        }, 'current');

        expect(fetchMock).toHaveBeenCalledWith(
            `/generated/exam/history/classes/b240402.json?v=${hash}`,
            { cache: 'force-cache', signal: undefined }
        );
        expect(history.timeline[0]?.status).toBe('unchanged');
        expect(history.timeline[1]?.changes[0]?.fields?.[0]?.before).toBe(110);
    });

    it('builds deterministic history URLs', () => {
        expect(examClassHistoryUrlWithVersion('generated/exam/history/classes/b240402.json?x=1', 'v/2')).toBe(
            'generated/exam/history/classes/b240402.json?x=1&v=v%2F2'
        );
    });
});
