import { describe, expect, it } from 'vitest';
import {
    required,
    shardFilterBase64For,
    makeDocument,
    impactTerms,
    makeRoutedFixture,
    withMockFetch,
    createPersistentFixtureCache,
    clearSitegraphRuntimeCaches,
    recallSitegraphDocuments,
    searchSitegraphProgressively
} from './sitegraphTestFixtures';
import type {
    SitegraphSearchEvent
} from './sitegraphTestFixtures';

describe('sitegraph proof and cache behavior', () => {
    it('reports warm immutable artifact cache hits and cache-aware local index cost', async () => {
        const fixture = makeRoutedFixture('cache-warm', [makeDocument()], {
            queryTerms: ['转专业申请'],
            lightTerms: impactTerms({ 转专业: { t: [0] } }),
            bodyTerms: impactTerms({ 申请: { c: [0] } })
        });

        await withMockFetch(fixture, async () => {
            const first = await recallSitegraphDocuments(fixture.session, '转专业申请', new AbortController().signal, 5);
            expect(first.stats.cache.artifact_misses).toBeGreaterThan(0);
            expect(first.stats.cache.uncached_bytes).toBeGreaterThan(0);
            expect(first.stats.coverage.uncached_loaded_bytes).toBe(first.stats.cache.uncached_bytes);
            expect(first.stats.plan.selected_local_indexes?.[0]?.expected_uncached_bytes).toBeGreaterThan(0);

            const second = await recallSitegraphDocuments(fixture.session, '转专业申请', new AbortController().signal, 5);
            expect(second.stats.cache.artifact_hits).toBeGreaterThan(0);
            expect(second.stats.cache.artifact_misses).toBe(0);
            expect(second.stats.cache.uncached_bytes).toBe(0);
            expect(second.stats.cache.cached_bytes).toBeGreaterThan(0);
            expect(second.stats.coverage.uncached_loaded_bytes).toBe(0);
            expect(second.stats.plan.selected_local_indexes?.[0]?.cache_state).toBe('warm');
            expect(second.stats.plan.selected_local_indexes?.[0]?.expected_uncached_bytes).toBe(0);
        });
    });

    it('treats changed content-hash artifact paths as cache misses', async () => {
        const firstFixture = makeRoutedFixture('cache-invalidate-a', [makeDocument()], {
            queryTerms: ['转专业申请'],
            lightTerms: impactTerms({ 转专业: { t: [0] } }),
            bodyTerms: impactTerms({ 申请: { c: [0] } })
        });
        const changedFixture = makeRoutedFixture('cache-invalidate-b', [makeDocument()], {
            queryTerms: ['转专业申请'],
            lightTerms: impactTerms({ 转专业: { t: [0] } }),
            bodyTerms: impactTerms({ 申请: { c: [0] } })
        });

        await withMockFetch(firstFixture, async () => {
            const first = await recallSitegraphDocuments(firstFixture.session, '转专业申请', new AbortController().signal, 5);
            expect(first.stats.cache.artifact_misses).toBeGreaterThan(0);
        });
        await withMockFetch(changedFixture, async () => {
            const changed = await recallSitegraphDocuments(changedFixture.session, '转专业申请', new AbortController().signal, 5);
            expect(changed.stats.cache.artifact_misses).toBeGreaterThan(0);
            expect(changed.stats.cache.uncached_bytes).toBeGreaterThan(0);
            expect(changed.stats.plan.selected_local_indexes?.[0]?.cache_state).toBe('cold');
            expect(changed.stats.plan.selected_local_indexes?.[0]?.expected_uncached_bytes).toBeGreaterThan(0);
        });
    });

    it('uses shard filter proof to skip no-match shards', async () => {
        const fixture = makeRoutedFixture('filter-skip', [makeDocument()], {
            queryTerms: ['不存在的查询'],
            lightTerms: {},
            bodyTerms: {},
            filterBase64: 'AA=='
        });

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(fixture.session, '不存在的查询', new AbortController().signal, event => events.push(event), { limit: 5 });
            const complete = events.at(-1);
            expect(complete?.type).toBe('global_exhaustive_complete');
            expect(complete?.coverage.proved_no_match_shards).toBe(1);
            expect(complete?.coverage.scanned_shards).toBe(0);
            expect(complete?.results).toEqual([]);
        });
    });

    it('carries hydrated full shards into verification coverage without resetting progress', async () => {
        const fixture = makeRoutedFixture('proof-progress-carry-forward', [makeDocument()], {
            queryTerms: ['转专业申请'],
            lightTerms: impactTerms({ 转专业: { t: [0] }, 申请: { t: [0] } }),
            bodyTerms: impactTerms({ 转专业: { c: [0] }, 申请: { c: [0] } }),
        });
        const shardPath = required(fixture.sourceManifest.full_shards[0], 'expected full shard').path;
        const requestedPaths: string[] = [];

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(fixture.session, '转专业申请', new AbortController().signal, event => events.push(event), { limit: 5 });
            const firstTrusted = events.find(event => event.type === 'first_trusted_results');
            const verification = events.find(event => event.type === 'verification_started');
            const complete = events.at(-1);
            expect(firstTrusted?.coverage.scanned_shards).toBe(1);
            expect(verification?.coverage.scanned_shards).toBe(1);
            expect(verification?.coverage.pending_shards).toBe(0);
            expect(verification?.coverage.failed_shards).toBe(0);
            expect(complete?.type).toBe('global_exhaustive_complete');
            expect(complete?.coverage.exhaustive_complete).toBe(true);
            expect(requestedPaths.filter(path => path.endsWith(shardPath))).toHaveLength(1);
        }, { requestedPaths });
    });

    it('reuses browser persistent content-hash artifacts after runtime memory caches are cleared', async () => {
        const fixture = makeRoutedFixture('persistent-cache-warm', [makeDocument()], {
            queryTerms: ['转专业申请'],
            lightTerms: impactTerms({ 转专业: { t: [0] } }),
            bodyTerms: impactTerms({ 申请: { c: [0] } })
        });
        const artifactCache = createPersistentFixtureCache();
        const session = { ...fixture.session, artifactCache };

        clearSitegraphRuntimeCaches();
        await withMockFetch({ ...fixture, session }, async () => {
            const cold = await recallSitegraphDocuments(session, '转专业申请', new AbortController().signal, 5);
            expect(cold.stats.cache.scope).toBe('browser_persistent_content_hash');
            expect(cold.stats.cache.artifact_misses).toBeGreaterThan(0);
            expect(cold.stats.cache.network_misses).toBeGreaterThan(0);
            expect(cold.stats.cache.persistent_hits).toBe(0);

            clearSitegraphRuntimeCaches();
            const warm = await recallSitegraphDocuments(session, '转专业申请', new AbortController().signal, 5);
            expect(warm.stats.cache.scope).toBe('browser_persistent_content_hash');
            expect(warm.stats.cache.artifact_misses).toBe(0);
            expect(warm.stats.cache.network_misses).toBe(0);
            expect(warm.stats.cache.uncached_bytes).toBe(0);
            expect(warm.stats.cache.persistent_hits).toBeGreaterThan(0);
            expect(warm.stats.plan.selected_local_indexes?.[0]?.cache_state).toBe('warm');
            expect(warm.results[0]?.id).toBe(cold.results[0]?.id);
        });
        clearSitegraphRuntimeCaches();
    });

    it('refuses exhaustive completion when cancellation leaves proof ledger shards pending', async () => {
        const fixture = makeRoutedFixture('proof-cancelled', [makeDocument()], {
            queryTerms: ['不存在的查询'],
            lightTerms: {},
            bodyTerms: {},
            filterBase64: '/w=='
        });

        await withMockFetch(fixture, async () => {
            const controller = new AbortController();
            const events: SitegraphSearchEvent[] = [];
            await expect(searchSitegraphProgressively(
                fixture.session,
                '不存在的查询',
                controller.signal,
                event => {
                    events.push(event);
                    if (event.type === 'verification_started') {
                        controller.abort();
                    }
                },
                { limit: 5 }
            )).rejects.toMatchObject({ name: 'AbortError' });
            const verification = events.find(event => event.type === 'verification_started');
            expect(verification?.coverage.pending_shards).toBe(1);
            expect(verification?.coverage.failed_shards).toBe(0);
            expect(verification?.coverage.exhaustive_complete).toBe(false);
            expect(events.some(event => event.type === 'global_exhaustive_complete')).toBe(false);
        });
    });

    it('uses absent phrase tokens to prove a full-scan phrase cannot match', async () => {
        const fixture = makeRoutedFixture('filter-phrase-skip', [makeDocument()], {
            queryTerms: ['材料提交'],
            lightTerms: {},
            bodyTerms: {},
            filterBase64: shardFilterBase64For(['材料']),
            filterBitCount: 2048
        });

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(fixture.session, '材料提交', new AbortController().signal, event => events.push(event), { limit: 5 });
            const complete = events.at(-1);
            expect(complete?.type).toBe('global_exhaustive_complete');
            expect(complete?.coverage.proved_no_match_shards).toBe(1);
            expect(complete?.coverage.scanned_shards).toBe(0);
            expect(complete?.coverage.hydrated_shard_bytes).toBe(0);
            expect(complete?.results).toEqual([]);
        });
    });

    it('supports plus operator phrases in shard proof filters without false negatives', async () => {
        const document = makeDocument({
            title: '中国国际 “互联网 + ”大学生创新创业大赛',
            content: '学校组织互联网 + 大赛。',
        });
        const fixture = makeRoutedFixture('filter-plus-phrase-match', [document], {
            queryTerms: ['互联网+'],
            lightTerms: {},
            bodyTerms: {},
            filterBase64: shardFilterBase64For(['互联网+', '联网+', '互联网', '互联', '联网', '网+']),
            filterBitCount: 2048
        });

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(fixture.session, '互联网+', new AbortController().signal, event => events.push(event), { limit: 5 });
            const complete = events.at(-1);
            expect(complete?.type).toBe('global_exhaustive_complete');
            expect(complete?.coverage.proved_no_match_shards).toBe(0);
            expect(complete?.coverage.scanned_shards).toBe(1);
            expect(complete?.results?.[0]?.title).toContain('互联网');
        });
    });

    it('uses missing plus proof tokens to skip shards that only contain the base phrase', async () => {
        const fixture = makeRoutedFixture('filter-plus-phrase-skip', [makeDocument({ title: '互联网大学生创新创业大赛' })], {
            queryTerms: ['互联网+'],
            lightTerms: {},
            bodyTerms: {},
            filterBase64: shardFilterBase64For(['互联网', '联网', '互联']),
            filterBitCount: 2048
        });

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(fixture.session, '互联网+', new AbortController().signal, event => events.push(event), { limit: 5 });
            const complete = events.at(-1);
            expect(complete?.type).toBe('global_exhaustive_complete');
            expect(complete?.coverage.proved_no_match_shards).toBe(1);
            expect(complete?.coverage.scanned_shards).toBe(0);
            expect(complete?.coverage.hydrated_shard_bytes).toBe(0);
            expect(complete?.results).toEqual([]);
        });
    });

    it('marks failed proof ledger shards and refuses exhaustive completion when verification loading fails', async () => {
        const fixture = makeRoutedFixture('proof-failure', [makeDocument()], {
            queryTerms: ['不存在的查询'],
            lightTerms: {},
            bodyTerms: {},
            filterBase64: '/w=='
        });
        const shardPath = required(fixture.sourceManifest.full_shards[0], 'expected full shard').path;

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await expect(searchSitegraphProgressively(
                fixture.session,
                '不存在的查询',
                new AbortController().signal,
                event => events.push(event),
                { limit: 5 }
            )).rejects.toThrow(/HTTP 503/);
            const error = events.at(-1);
            expect(error?.type).toBe('error');
            expect(error?.coverage.failed_shards).toBe(1);
            expect(error?.coverage.pending_shards).toBe(0);
            expect(error?.coverage.exhaustive_complete).toBe(false);
            expect(events.some(event => event.type === 'global_exhaustive_complete')).toBe(false);
        }, { failPaths: [shardPath] });
    });
});
