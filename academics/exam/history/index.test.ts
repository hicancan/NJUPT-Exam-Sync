import { describe, expect, it } from 'vitest';
import type { ExamSnapshotManifest } from '../snapshot';
import {
    assertExamHistoryClassChunkIdentity,
    assertExamHistoryMatchesSnapshot,
    ExamHistoryContractError,
    examHistoryIdentityText,
    parseExamHistoryClassChunk,
    parseExamHistoryClassIndex,
    parseExamHistoryEvents,
    parseExamHistoryManifest,
    selectExamClassHistory,
} from './index';

const sha256 = async (value: string): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};
const hash = (character: string) => character.repeat(64);
const artifact = (path: string) => ({ path, bytes: 10, sha256: hash('a') });
const canonicalJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
};

describe('ExamHistory decoder', () => {
    it('reads one current-format history chain and selects a class', async () => {
        const classHistory = {
            class_name: 'B240402',
            class_key: 'class-key',
            observed_snapshot_count: 2,
            affected_event_count: 1,
            current_record_count: 14,
            latest_affected_at: '2026-06-11T08:14:13+00:00',
            events: [
                {
                    snapshot_id: hash('1'),
                    previous_snapshot_id: null,
                    source_updated_at: '2026-06-10T08:14:13+00:00',
                    status: 'first_seen',
                    previous_record_count: 0,
                    current_record_count: 14,
                    changes: [],
                },
                {
                    snapshot_id: hash('2'),
                    previous_snapshot_id: hash('1'),
                    source_updated_at: '2026-06-11T08:14:13+00:00',
                    status: 'changed',
                    previous_record_count: 14,
                    current_record_count: 14,
                    changes: [{
                        type: 'changed',
                        history_key: 'history-key',
                        course_name: '算法分析与设计',
                        course_code: 'JS113400S',
                        teacher: '张三',
                        fields: [{ field: 'location', before: '教2-313', after: '教2-314' }],
                    }],
                },
            ],
        };
        const canonicalClasses = canonicalJson({ 'class-key': classHistory });
        const chunkId = await sha256(canonicalClasses);
        const chunk = parseExamHistoryClassChunk({
            format: 'njupt-exam-history-class-chunk',
            exam_period_id: '2025-2026-2',
            current_snapshot_id: hash('2'),
            chunk_id: chunkId,
            classes: { 'class-key': classHistory },
        });
        const index = parseExamHistoryClassIndex({
            format: 'njupt-exam-history-class-index',
            exam_period_id: '2025-2026-2',
            current_snapshot_id: hash('2'),
            observed_snapshot_count: 2,
            class_count: 1,
            classes: [{
                class_name: 'B240402',
                class_key: 'class-key',
                observed_snapshot_count: 2,
                affected_event_count: 1,
                current_record_count: 14,
                latest_affected_at: '2026-06-11T08:14:13+00:00',
                chunk_path: 'classes-000.json',
                chunk_id: chunkId,
            }],
        });
        const events = parseExamHistoryEvents({
            format: 'njupt-exam-history-events',
            exam_period_id: '2025-2026-2',
            baseline_snapshot_id: hash('1'),
            current_snapshot_id: hash('2'),
            observed_snapshot_count: 2,
            events: [
                {
                    snapshot_id: hash('1'), previous_snapshot_id: null,
                    source_updated_at: '2026-06-10T08:14:13+00:00', status: 'baseline',
                    total_records: 14, total_classes: 1, affected_class_count: 0,
                    added: 0, removed: 0, changed: 0, unchanged: 14,
                },
                {
                    snapshot_id: hash('2'), previous_snapshot_id: hash('1'),
                    source_updated_at: '2026-06-11T08:14:13+00:00', status: 'changed',
                    total_records: 14, total_classes: 1, affected_class_count: 1,
                    added: 0, removed: 0, changed: 1, unchanged: 13,
                },
            ],
        });

        await expect(assertExamHistoryClassChunkIdentity(chunk)).resolves.toBeUndefined();
        expect(events.events).toHaveLength(2);
        const entry = index.classes[0];
        if (!entry) throw new Error('history class index is empty');
        expect(selectExamClassHistory({
            format: 'njupt-exam-history', history_id: hash('f'),
            exam_period_id: '2025-2026-2', academic_year: '2025-2026', term_number: 2,
            term_label: '第二学期', baseline_snapshot_id: hash('1'), current_snapshot_id: hash('2'),
            current_source_updated_at: '2026-06-11T08:14:13+00:00', observed_snapshot_count: 2,
            events: artifact('events.json'), class_index: artifact('class-index.json'),
            class_chunks: [artifact('classes-000.json')],
        }, entry, chunk)).toEqual(classHistory);
    });

    it('validates history identity, snapshot binding, and rejects old formats', async () => {
        const withoutIdentity = {
            format: 'njupt-exam-history' as const,
            history_id: hash('0'),
            exam_period_id: '2025-2026-2',
            academic_year: '2025-2026',
            term_number: 2,
            term_label: '第二学期',
            baseline_snapshot_id: hash('1'),
            current_snapshot_id: hash('2'),
            current_source_updated_at: '2026-06-11T08:14:13+00:00',
            observed_snapshot_count: 2,
            events: artifact('events.json'),
            class_index: artifact('class-index.json'),
            class_chunks: [artifact('classes-000.json')],
        };
        const manifest = parseExamHistoryManifest({
            ...withoutIdentity,
            history_id: await sha256(examHistoryIdentityText(withoutIdentity)),
        });
        const snapshot = {
            snapshot_id: hash('2'),
            source_updated_at: manifest.current_source_updated_at,
            exam_period: { id: manifest.exam_period_id },
        } as ExamSnapshotManifest;

        expect(() => assertExamHistoryMatchesSnapshot(manifest, snapshot)).not.toThrow();
        expect(() => assertExamHistoryMatchesSnapshot(manifest, {
            ...snapshot,
            snapshot_id: hash('3'),
        })).toThrow(ExamHistoryContractError);
        expect(() => parseExamHistoryManifest({ version: 'exam-history-manifest-v2' }))
            .toThrow(ExamHistoryContractError);
    });
});
