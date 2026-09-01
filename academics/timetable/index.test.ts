import { describe, expect, it } from 'vitest';
import { parseTeachingManifest, TeachingContractError } from './index';

const hash = (value: string): string => value.repeat(64).slice(0, 64);
const artifact = (path: string) => ({ path, bytes: 1, sha256: hash('a') });

describe('TeachingScheduleSnapshot decoder', () => {
    it('requires the authoritative SpaceSnapshot identity', () => {
        const current = {
            format: 'njupt-teaching-schedule',
            snapshot_id: hash('b'),
            source_id: hash('c'),
            space_snapshot_id: hash('d'),
            observed_at: '2026-08-31T09:00:00+08:00',
            academic_year: '2026-2027',
            term_number: 1,
            week_count: 20,
            class_count: 873,
            meeting_count: 3574,
            term: artifact('term.json'),
            periods: artifact('periods.json'),
            class_index: artifact('class-index.json'),
            class_chunks: [artifact('classes-000.json')],
            meeting_chunks: [artifact('meetings-000.json')],
        };

        expect(parseTeachingManifest(current).space_snapshot_id).toBe(hash('d'));
        const obsolete: Record<string, unknown> = { ...current };
        delete obsolete.space_snapshot_id;
        expect(() => parseTeachingManifest(obsolete)).toThrow(TeachingContractError);
    });
});
