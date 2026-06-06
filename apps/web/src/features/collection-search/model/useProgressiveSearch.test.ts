import { describe, expect, it } from 'vitest';
import type { RankedSitegraphDocument } from '@/shared/lib/contracts';
import { mergeProgressiveSearchState } from './useProgressiveSearch';

const result = (id: string): RankedSitegraphDocument => ({
    id,
} as unknown as RankedSitegraphDocument);

const state = (key: string, results: RankedSitegraphDocument[]) => ({
    key,
    results,
    stats: null,
    coverage: null,
    phase: null,
    error: null,
    settled: true,
});

describe('mergeProgressiveSearchState', () => {
    it('does not carry old results into a new query key', () => {
        const merged = mergeProgressiveSearchState(
            state('old-query', [result('old')]),
            'new-query',
            'plan_started',
            {}
        );

        expect(merged.key).toBe('new-query');
        expect(merged.results).toEqual([]);
        expect(merged.stats).toBeNull();
        expect(merged.coverage).toBeNull();
        expect(merged.settled).toBe(false);
    });

    it('preserves previous results only for the same query key', () => {
        const previousResults = [result('same')];
        const merged = mergeProgressiveSearchState(
            state('same-query', previousResults),
            'same-query',
            'verification_started',
            {}
        );

        expect(merged.results).toBe(previousResults);
    });
});
