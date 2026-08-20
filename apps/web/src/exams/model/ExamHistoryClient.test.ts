import { afterEach, describe, expect, it, vi } from 'vitest';
import { examHistoryIdentityText } from '@njupt-search/academics-exam/history';
import type { ExamHistoryManifest } from '@njupt-search/academics-exam/history';
import type { ExamSnapshotClient } from './ExamSnapshotClient';
import { ExamHistoryClient } from './ExamHistoryClient';

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
const canonicalJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
};

afterEach(() => vi.restoreAllMocks());

describe('ExamHistoryClient', () => {
    it('initializes once, loads one class chunk on demand, and reuses it', async () => {
        const snapshotId = '1'.repeat(64);
        const sourceUpdatedAt = '2026-06-10T08:14:13+00:00';
        const classHistory = {
            class_name: 'B240402',
            class_key: 'class-key',
            observed_snapshot_count: 1,
            affected_event_count: 0,
            current_record_count: 14,
            latest_affected_at: null,
            events: [{
                snapshot_id: snapshotId,
                previous_snapshot_id: null,
                source_updated_at: sourceUpdatedAt,
                status: 'first_seen',
                previous_record_count: 0,
                current_record_count: 14,
                changes: [],
            }],
        };
        const classes = { 'class-key': classHistory };
        const chunkId = await sha256(canonicalJson(classes));
        const chunkText = encode({
            format: 'njupt-exam-history-class-chunk',
            exam_period_id: '2025-2026-2',
            current_snapshot_id: snapshotId,
            chunk_id: chunkId,
            classes,
        });
        const eventsText = encode({
            format: 'njupt-exam-history-events',
            exam_period_id: '2025-2026-2',
            baseline_snapshot_id: snapshotId,
            current_snapshot_id: snapshotId,
            observed_snapshot_count: 1,
            events: [{
                snapshot_id: snapshotId, previous_snapshot_id: null,
                source_updated_at: sourceUpdatedAt, status: 'baseline',
                total_records: 14, total_classes: 1, affected_class_count: 0,
                added: 0, removed: 0, changed: 0, unchanged: 14,
            }],
        });
        const indexText = encode({
            format: 'njupt-exam-history-class-index',
            exam_period_id: '2025-2026-2',
            current_snapshot_id: snapshotId,
            observed_snapshot_count: 1,
            class_count: 1,
            classes: [{
                class_name: 'B240402', class_key: 'class-key',
                observed_snapshot_count: 1, affected_event_count: 0,
                current_record_count: 14, latest_affected_at: null,
                chunk_path: 'classes-000.json', chunk_id: chunkId,
            }],
        });
        const withoutIdentity: ExamHistoryManifest = {
            format: 'njupt-exam-history',
            history_id: '0'.repeat(64),
            exam_period_id: '2025-2026-2',
            academic_year: '2025-2026',
            term_number: 2,
            term_label: '第二学期',
            baseline_snapshot_id: snapshotId,
            current_snapshot_id: snapshotId,
            current_source_updated_at: sourceUpdatedAt,
            observed_snapshot_count: 1,
            events: await ref('events.json', eventsText),
            class_index: await ref('class-index.json', indexText),
            class_chunks: [await ref('classes-000.json', chunkText)],
        };
        const manifest = {
            ...withoutIdentity,
            history_id: await sha256(examHistoryIdentityText(withoutIdentity)),
        };
        const nextSnapshotId = '2'.repeat(64);
        const nextSourceUpdatedAt = '2026-06-11T08:14:13+00:00';
        const nextClassHistory = {
            ...classHistory,
            observed_snapshot_count: 2,
            affected_event_count: 1,
            current_record_count: 15,
            latest_affected_at: nextSourceUpdatedAt,
            events: [
                ...classHistory.events,
                {
                    snapshot_id: nextSnapshotId,
                    previous_snapshot_id: snapshotId,
                    source_updated_at: nextSourceUpdatedAt,
                    status: 'changed',
                    previous_record_count: 14,
                    current_record_count: 15,
                    changes: [{
                        type: 'added', history_key: 'history-key',
                        course_name: '数据结构', course_code: 'JS1001', teacher: '李四',
                        fields: [{ field: 'location', before: null, after: '教2-314' }],
                    }],
                },
            ],
        };
        const nextClasses = { 'class-key': nextClassHistory };
        const nextChunkId = await sha256(canonicalJson(nextClasses));
        const nextChunkText = encode({
            format: 'njupt-exam-history-class-chunk',
            exam_period_id: '2025-2026-2',
            current_snapshot_id: nextSnapshotId,
            chunk_id: nextChunkId,
            classes: nextClasses,
        });
        const nextEventsText = encode({
            format: 'njupt-exam-history-events',
            exam_period_id: '2025-2026-2',
            baseline_snapshot_id: snapshotId,
            current_snapshot_id: nextSnapshotId,
            observed_snapshot_count: 2,
            events: [
                JSON.parse(eventsText).events[0],
                {
                    snapshot_id: nextSnapshotId, previous_snapshot_id: snapshotId,
                    source_updated_at: nextSourceUpdatedAt, status: 'changed',
                    total_records: 15, total_classes: 1, affected_class_count: 1,
                    added: 1, removed: 0, changed: 0, unchanged: 14,
                },
            ],
        });
        const nextIndexText = encode({
            format: 'njupt-exam-history-class-index',
            exam_period_id: '2025-2026-2',
            current_snapshot_id: nextSnapshotId,
            observed_snapshot_count: 2,
            class_count: 1,
            classes: [{
                class_name: 'B240402', class_key: 'class-key',
                observed_snapshot_count: 2, affected_event_count: 1,
                current_record_count: 15, latest_affected_at: nextSourceUpdatedAt,
                chunk_path: 'classes-000.json', chunk_id: nextChunkId,
            }],
        });
        const nextWithoutIdentity: ExamHistoryManifest = {
            ...withoutIdentity,
            current_snapshot_id: nextSnapshotId,
            current_source_updated_at: nextSourceUpdatedAt,
            observed_snapshot_count: 2,
            events: await ref('events.json', nextEventsText),
            class_index: await ref('class-index.json', nextIndexText),
            class_chunks: [await ref('classes-000.json', nextChunkText)],
        };
        const nextManifest = {
            ...nextWithoutIdentity,
            history_id: await sha256(examHistoryIdentityText(nextWithoutIdentity)),
        };
        const examClient = {
            initialize: vi.fn(async () => ({
                manifest: {
                    snapshot_id: snapshotId,
                    source_updated_at: sourceUpdatedAt,
                    exam_period: { id: '2025-2026-2' },
                },
            })),
            refresh: vi.fn(async () => ({
                manifest: {
                    snapshot_id: nextSnapshotId,
                    source_updated_at: nextSourceUpdatedAt,
                    exam_period: { id: '2025-2026-2' },
                },
            })),
        } as unknown as ExamSnapshotClient;
        let delayClassChunk = false;
        let currentVersion: 1 | 2 = 1;
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.endsWith('/manifest.json')) return new Response(encode(currentVersion === 1 ? manifest : nextManifest));
            if (url.includes('events.json')) return new Response(currentVersion === 1 ? eventsText : nextEventsText);
            if (url.includes('class-index.json')) return new Response(currentVersion === 1 ? indexText : nextIndexText);
            if (url.includes('classes-000.json')) {
                if (delayClassChunk) {
                    return await new Promise<Response>((_resolve, reject) => {
                        if (init?.signal?.aborted) {
                            reject(new DOMException('aborted', 'AbortError'));
                            return;
                        }
                        init?.signal?.addEventListener(
                            'abort',
                            () => reject(new DOMException('aborted', 'AbortError')),
                            { once: true },
                        );
                    });
                }
                return new Response(currentVersion === 1 ? chunkText : nextChunkText);
            }
            return new Response('missing', { status: 404 });
        });
        vi.stubGlobal('fetch', fetchMock);

        const client = new ExamHistoryClient('https://artifact.test/exam/history', examClient);
        await client.initialize();
        await client.initialize();
        const first = await client.loadClass('B240402');
        const second = await client.loadClass('B240402');

        expect(first).toEqual(classHistory);
        expect(second).toEqual(classHistory);
        expect(examClient.initialize).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls.filter(call => String(call[0]).endsWith('/manifest.json'))).toHaveLength(1);
        expect(fetchMock.mock.calls.filter(call => String(call[0]).includes('classes-000.json'))).toHaveLength(1);
        expect(String(fetchMock.mock.calls.find(call => String(call[0]).includes('classes-000.json'))?.[0]))
            .toContain(`/history/${manifest.history_id}/classes-000.json`);

        currentVersion = 2;
        await client.refresh();
        const refreshed = await client.loadClass('B240402');
        expect(refreshed).toEqual(nextClassHistory);
        expect(examClient.refresh).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls.filter(call => String(call[0]).includes('classes-000.json'))).toHaveLength(2);

        currentVersion = 1;
        const cancellationClient = new ExamHistoryClient('https://artifact.test/exam/history', examClient);
        await cancellationClient.initialize();
        delayClassChunk = true;
        const older = cancellationClient.loadClass('B240402');
        await Promise.resolve();
        await Promise.resolve();
        const newer = cancellationClient.loadClass('UNKNOWN');
        await expect(older).rejects.toMatchObject({ name: 'AbortError' });
        await expect(newer).resolves.toBeNull();
        cancellationClient.dispose();
        client.dispose();
    });

    it('fails when history identifies a different ExamSnapshot', async () => {
        const historyManifest = {
            format: 'njupt-exam-history',
            history_id: '0'.repeat(64),
            exam_period_id: '2025-2026-2', academic_year: '2025-2026', term_number: 2,
            term_label: '第二学期', baseline_snapshot_id: '1'.repeat(64),
            current_snapshot_id: '1'.repeat(64), current_source_updated_at: '2026-06-10T08:14:13+00:00',
            observed_snapshot_count: 1,
            events: { path: 'events.json', bytes: 1, sha256: 'a'.repeat(64) },
            class_index: { path: 'class-index.json', bytes: 1, sha256: 'a'.repeat(64) },
            class_chunks: [{ path: 'classes-000.json', bytes: 1, sha256: 'a'.repeat(64) }],
        } satisfies ExamHistoryManifest;
        historyManifest.history_id = await sha256(examHistoryIdentityText(historyManifest));
        vi.stubGlobal('fetch', vi.fn(async () => new Response(encode(historyManifest))));
        const examClient = {
            initialize: async () => ({
                manifest: {
                    snapshot_id: '2'.repeat(64),
                    source_updated_at: historyManifest.current_source_updated_at,
                    exam_period: { id: historyManifest.exam_period_id },
                },
            }),
        } as unknown as ExamSnapshotClient;
        const client = new ExamHistoryClient('https://artifact.test/exam/history', examClient);

        await expect(client.initialize()).rejects.toThrow('does not match the current ExamSnapshot');
        client.dispose();
    });
});
