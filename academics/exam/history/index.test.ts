import { describe, expect, it } from 'vitest';
import {
    formatExamHistoryValue,
    parseExamClassHistory,
    parseExamHistoryManifest,
    summarizeExamHistoryChange,
} from './index';

describe('exam history parsing', () => {
    it('parses history manifest and class history payloads', () => {
        const manifest = parseExamHistoryManifest({
            version: 'exam-history-manifest-v2',
            generated_at: '2026-06-10T10:06:41+08:00',
            exam_period_id: '2025-2026-2',
            academic_year: '2025-2026',
            term_number: 2,
            term_label: '第二学期',
            latest_data_version: 'current',
            latest_auto_updated_at: '2026-06-10T10:06:41+08:00',
            snapshots: [{
                data_version: 'current',
                auto_updated_at: '2026-06-10T10:06:41+08:00',
                exam_period_id: '2025-2026-2',
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
                artifact: {
                    path: 'history/classes/b240402.json',
                    bytes: 10,
                    sha256: 'a'.repeat(64),
                },
                exam_period_id: '2025-2026-2',
                first_seen_data_version: 'first',
                first_seen_at: '2026-06-04T18:00:21+08:00',
                latest_status: 'changed',
                latest_affected_data_version: 'current',
                latest_affected_at: '2026-06-10T10:06:41+08:00',
                current_record_count: 1,
                timeline_count: 2,
                affected_count: 2,
            }],
        });

        expect(manifest.classes[0]?.class_key).toBe('b240402');

        const history = parseExamClassHistory({
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
            timeline: [{
                data_version: 'current',
                auto_updated_at: '2026-06-10T10:06:41+08:00',
                exam_period_id: '2025-2026-2',
                previous_data_version: 'first',
                previous_auto_updated_at: '2026-06-09T10:54:23+08:00',
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

        expect(history.timeline[0]?.changes[0]?.course_name).toBe('大学英语IV');
    });

    it('formats history values for display', () => {
        expect(formatExamHistoryValue({ field: 'duration_minutes', label: '时长' }, 120)).toBe('120 分钟');
        expect(formatExamHistoryValue({ field: 'location', label: '地点' }, '')).toBe('空');
    });

    it('summarizes coupled duration and end-time changes without raw-time duplication', () => {
        expect(summarizeExamHistoryChange({
            type: 'changed',
            identity_key: 'b240402',
            course_name: '大学英语IV',
            fields: [
                { field: 'duration_minutes', label: '时长', before: 110, after: 120 },
                { field: 'end_timestamp', label: '结束时间', before: '2026-06-08T09:50:00+08:00', after: '2026-06-08T10:00:00+08:00' },
                { field: 'raw_time', label: '原始时间', before: '2026年06月08日(08:00-09:50)', after: '2026年06月08日(08:00-10:00)' },
            ],
        })).toEqual(['考试时长延长 10 分钟，结束时间推后至 10:00']);
    });
});
