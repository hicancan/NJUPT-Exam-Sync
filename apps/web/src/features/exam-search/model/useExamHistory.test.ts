import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    examClassHistoryUrlWithVersion,
    examHistoryManifestUrlWithNonce,
    loadExamClassHistory,
    loadExamHistoryManifest,
} from './useExamHistory';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe('useExamHistory loaders', () => {
    it('loads and parses the exam history manifest without browser cache reuse', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(1234567890);
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                version: 'exam-history-manifest-v1',
                generated_at: '2026-06-10T10:06:41+08:00',
                latest_data_version: 'current',
                latest_auto_updated_at: '2026-06-10T10:06:41+08:00',
                snapshots: [{
                    data_version: 'current',
                    auto_updated_at: '2026-06-10T10:06:41+08:00',
                    record_count: 1,
                    class_count: 1,
                }],
                totals: {
                    snapshot_count: 1,
                    class_count: 1,
                    current_class_count: 1,
                    current_record_count: 1,
                },
                classes: [{
                    class_name: 'B240402',
                    class_key: 'b240402',
                    path: 'generated/exam/history/classes/b240402.json',
                    first_seen_data_version: 'first',
                    first_seen_at: '2026-06-04T18:00:21+08:00',
                    latest_status: 'changed',
                    latest_change_data_version: 'current',
                    latest_change_at: '2026-06-10T10:06:41+08:00',
                    current_record_count: 1,
                    checkpoint_count: 2,
                }],
            }),
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const manifest = await loadExamHistoryManifest();

        expect(fetchMock).toHaveBeenCalledWith(
            'generated/exam/history/manifest.json?fresh=kf12oi',
            { cache: 'no-store', signal: undefined }
        );
        expect(manifest.classes[0]?.class_name).toBe('B240402');
    });

    it('loads a class history file with the latest data version', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                version: 'exam-class-history-v1',
                class_name: 'B240402',
                class_key: 'b240402',
                generated_at: '2026-06-10T10:06:41+08:00',
                latest_data_version: 'current',
                latest_auto_updated_at: '2026-06-10T10:06:41+08:00',
                first_seen: {
                    data_version: 'first',
                    auto_updated_at: '2026-06-04T18:00:21+08:00',
                },
                latest_substantive_change: {
                    data_version: 'current',
                    auto_updated_at: '2026-06-10T10:06:41+08:00',
                    status: 'changed',
                    totals: {
                        added: 0,
                        removed: 0,
                        changed: 1,
                        unchanged: 0,
                        previous_records: 1,
                        current_records: 1,
                    },
                },
                checkpoints: [{
                    data_version: 'current',
                    auto_updated_at: '2026-06-10T10:06:41+08:00',
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
                }],
            }),
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const history = await loadExamClassHistory({
            class_name: 'B240402',
            class_key: 'b240402',
            path: 'generated/exam/history/classes/b240402.json',
            first_seen_data_version: 'first',
            first_seen_at: '2026-06-04T18:00:21+08:00',
            latest_status: 'changed',
            latest_change_data_version: 'current',
            latest_change_at: '2026-06-10T10:06:41+08:00',
            current_record_count: 1,
            checkpoint_count: 2,
        }, 'current');

        expect(fetchMock).toHaveBeenCalledWith(
            'generated/exam/history/classes/b240402.json?v=current',
            { cache: 'force-cache', signal: undefined }
        );
        expect(history.checkpoints[0]?.changes[0]?.fields?.[0]?.before).toBe(110);
    });

    it('builds deterministic history URLs', () => {
        expect(examHistoryManifestUrlWithNonce('generated/exam/history/manifest.json?x=1', 'now')).toBe(
            'generated/exam/history/manifest.json?x=1&fresh=now'
        );
        expect(examClassHistoryUrlWithVersion('generated/exam/history/classes/b240402.json?x=1', 'v/2')).toBe(
            'generated/exam/history/classes/b240402.json?x=1&v=v%2F2'
        );
    });
});
