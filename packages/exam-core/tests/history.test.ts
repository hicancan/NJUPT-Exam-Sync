import { describe, expect, it } from 'vitest';
import {
    formatExamHistoryValue,
    parseExamClassHistory,
    parseExamHistoryManifest,
} from '../src/history';

describe('exam history parsing', () => {
    it('parses history manifest and class history payloads', () => {
        const manifest = parseExamHistoryManifest({
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
        });

        expect(manifest.classes[0]?.class_key).toBe('b240402');

        const history = parseExamClassHistory({
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
                previous_data_version: 'first',
                previous_auto_updated_at: '2026-06-04T18:00:21+08:00',
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
                    identity_key: 'b240402\u001fwy1004t0s\u001f大学英语iv\u001f唐睿',
                    course_name: '大学英语IV',
                    course_code: 'WY1004T0S',
                    teacher: '唐睿',
                    fields: [{ field: 'duration_minutes', label: '时长', before: 110, after: 120 }],
                }],
            }],
        });

        expect(history.checkpoints[0]?.changes[0]?.course_name).toBe('大学英语IV');
    });

    it('formats history values for display', () => {
        expect(formatExamHistoryValue({ field: 'duration_minutes', label: '时长' }, 120)).toBe('120 分钟');
        expect(formatExamHistoryValue({ field: 'location', label: '地点' }, '')).toBe('空');
    });
});
