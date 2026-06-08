import { describe, expect, it } from 'vitest';
import {
    required,
    makeDocument,
    impactTerms,
    makeRoutedFixture,
    withMockFetch,
    formatResolvedSearchDate,
    recallSitegraphDocuments,
    searchSitegraphProgressively
} from './sitegraphTestFixtures';
import type {
    SitegraphSearchEvent
} from './sitegraphTestFixtures';

describe('sitegraph routed retrieval', () => {
    it('ranks attachment matches after loading routed local indexes and candidate shards', async () => {
        const document = makeDocument();
        const fixture = makeRoutedFixture('rank-attachment', [document], {
            queryTerms: ['转专业申请表'],
            lightTerms: impactTerms({ 转专业: { t: [0] }, 申请表: { a: [0] }, 转专业申请表: { a: [0] } }),
            bodyTerms: impactTerms({ 转专业: { c: [0] }, 申请表: { c: [0] } }),
            queryAliases: { 转专业申请表: { aliases: ['专业变更申请表'] } }
        });

        await withMockFetch(fixture, async () => {
            const { results, stats } = await recallSitegraphDocuments(fixture.session, '转专业申请表', new AbortController().signal);
            expect(results[0]?.id).toBe('jwc-detail-1');
            expect(results[0]?.score_reason).toContain('附件名命中');
            expect(results[0]?.match_snippet?.field).toBe('attachments');
            expect(results[0]?.match_snippet?.evidence_level).toBe('filename_only');
            expect(results[0]?.match_snippet?.text).toContain('转专业申请表.doc');
            expect(stats.loadedLocalIndexIds).toEqual([required(fixture.sourceManifest.local_indexes[0], 'expected local index ref').index_id]);
            expect(stats.loadedShardPaths).toEqual([required(fixture.sourceManifest.full_shards[0], 'expected full shard').path]);
            expect(stats.coverage.coverage_state).toBe('global_exhaustive_complete');
            expect(stats.coverage.exhaustive_complete).toBe(true);
        });
    });

    it('reports fallback and verification telemetry in routed query stats', async () => {
        const fixture = makeRoutedFixture('fallback-telemetry', [makeDocument()], {
            queryTerms: ['南京邮电大学本科生转专业管理办法'],
            lightTerms: {},
            bodyTerms: {}
        });

        await withMockFetch(fixture, async () => {
            const { results, stats } = await recallSitegraphDocuments(
                fixture.session,
                '南京邮电大学本科生转专业管理办法',
                new AbortController().signal
            );
            expect(results[0]?.id).toBe('jwc-detail-1');
            expect(stats.fallbacks.localMetaFallbackDocuments).toBe(1);
            expect(stats.fallbacks.verifiedFullScanMatches).toBe(1);
            expect(results[0]?.query_stats?.fallbacks.localMetaFallbackDocuments).toBe(1);
        });
    });

    it('does not load unrelated source manifests before routed first trusted results', async () => {
        const fixture = makeRoutedFixture('route-source-scope', [makeDocument()], {
            queryTerms: ['转专业申请表'],
            lightTerms: impactTerms({ 转专业: { t: [0] }, 申请表: { a: [0] } }),
            bodyTerms: impactTerms({ 转专业: { c: [0] }, 申请表: { c: [0] } })
        });
        const unrelatedManifestArtifact = {
            path: 'route-source-scope/lib-source-manifest.json',
            sha256: '0123456789abcdef0123456789abcdef',
            bytes: 128,
            role: 'source_manifest',
            load: 'query_planned',
            count: 0
        };
        const unrelatedProofCatalogArtifact = {
            path: 'route-source-scope/lib-proof-catalog.json',
            sha256: '0123456789abcdef0123456789abcdef',
            bytes: 128,
            role: 'proof_catalog',
            load: 'proof',
            count: 0
        };
        const unrelatedShardFilterArtifact = {
            path: 'route-source-scope/lib-shard-filter.json',
            sha256: '0123456789abcdef0123456789abcdef',
            bytes: 128,
            role: 'shard_filter',
            load: 'proof',
            count: 0
        };
        const session = {
            ...fixture.session,
            sourceRegistry: {
                ...fixture.session.sourceRegistry,
                sources: [
                    ...fixture.session.sourceRegistry.sources,
                    {
                        ...required(fixture.session.sourceRegistry.sources[0], 'expected source entry'),
                        source_id: 'lib',
                        display_name: '图书馆',
                        owner_unit: '图书馆',
                        domain: 'lib.njupt.edu.cn',
                        authority_domains: [],
                        priority_by_intent: {},
                        artifact_manifest: unrelatedManifestArtifact,
                        doc_count: 0,
                        attachment_count: 0,
                        facet_counts: {},
                        record_counts: {},
                        truth_counts: {},
                    },
                ],
            },
        };
        const unrelatedSourceManifest = {
            ...fixture.sourceManifest,
            source_id: 'lib',
            display_name: '图书馆',
            domain: 'lib.njupt.edu.cn',
            doc_count: 0,
            attachment_count: 0,
            facet_counts: {},
            record_counts: {},
            year_counts: {},
            local_indexes: [],
            full_shards: [],
            artifacts: {
                proof_catalog: unrelatedProofCatalogArtifact,
                shard_filter: unrelatedShardFilterArtifact,
            },
        };
        const requestedPaths: string[] = [];
        let firstTrustedRequestedPaths: string[] = [];

        await withMockFetch({ ...fixture, session }, async () => {
            await searchSitegraphProgressively(session, '转专业申请表', new AbortController().signal, event => {
                if (event.type === 'first_trusted_results') {
                    firstTrustedRequestedPaths = [...requestedPaths];
                }
            });
        }, {
            requestedPaths,
            extraResponses: {
                [unrelatedManifestArtifact.path]: unrelatedSourceManifest,
                [unrelatedProofCatalogArtifact.path]: { ...fixture.proofCatalog, source_id: 'lib', shards: [] },
                [unrelatedShardFilterArtifact.path]: {},
            },
        });

        expect(firstTrustedRequestedPaths.some(path => path.endsWith(unrelatedManifestArtifact.path))).toBe(false);
        expect(requestedPaths.some(path => path.endsWith(unrelatedManifestArtifact.path))).toBe(true);
    });

    it('uses version and recorded dates for display and scoped date sorting', async () => {
        const oldNotice = makeDocument({
            doc_index: 0,
            id: 'old-notice',
            facet: 'notice_article',
            title: '2024年推免工作方案',
            canonical_title: '2024年推免工作方案',
            published_at: '2024-09-07',
            version_date: null,
            date_kind: 'published',
            summary: '推免工作方案',
            content: '2024年推免工作方案。',
            attachments: [],
            attachment_count: 0
        });
        const versionedDownload = makeDocument({
            doc_index: 1,
            id: 'versioned-download',
            facet: 'download',
            title: '南京邮电大学学生一般事务申请表 2026-04-16',
            canonical_title: '南京邮电大学学生一般事务申请表 2026-04-16',
            published_at: null,
            version_date: '2026-04-16',
            date_kind: 'version',
            date_confidence: 'title_or_attachment',
            summary: '附件元数据：南京邮电大学学生一般事务申请表 2026-04-16。来源栏目：推免生。',
            content: '附件元数据命中推免生栏目。',
            collection_method: 'attachment_metadata_only'
        });
        const docs = [oldNotice, versionedDownload];
        const fixture = makeRoutedFixture('date-filter', docs, {
            queryTerms: ['推免'],
            facet: 'download',
            lightTerms: impactTerms({ 推免: { t: [0, 1] } }),
            bodyTerms: impactTerms({ 推免: { c: [0, 1] } })
        });

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(fixture.session, '推免', new AbortController().signal, event => events.push(event), {
                limit: 10,
                sortMode: 'date_desc',
                filters: { sourceId: 'jwc', facet: 'download', dateRange: 'past_year' },
                now: new Date('2026-05-29T00:00:00+08:00').getTime()
            });
            const complete = events.at(-1);
            expect(complete?.type).toBe('scoped_exhaustive_complete');
            expect(complete?.results?.map(result => result.id)).toEqual(['versioned-download']);
            expect(formatResolvedSearchDate(versionedDownload)).toBe('版本日期 2026/04/16');
            expect(formatResolvedSearchDate({
                ...versionedDownload,
                published_at: null,
                version_date: null,
                recorded_at: '2026-05-01'
            })).toBe('收录日期 2026/05/01');
        });
    });

    it('uses alias phrases for candidate recall without counting weak phrase misses as results', async () => {
        const calendarDocument = makeDocument({
            doc_index: 0,
            id: 'calendar',
            facet: 'notice_article',
            title: '2025-2026学年校历',
            canonical_title: '2025-2026学年校历',
            section: '通知公告',
            nav_path: ['通知公告'],
            nav_path_text: '通知公告',
            summary: '2025-2026学年校历',
            content: '学校发布2025-2026学年校历。',
            task_kind: 'academic_calendar',
            attachments: [],
            attachment_count: 0
        });
        const weakAliasDocument = makeDocument({
            doc_index: 1,
            id: 'weak-alias',
            facet: 'notice_article',
            title: '2025-2026学年第二学期学生选课通知',
            canonical_title: '2025-2026学年第二学期学生选课通知',
            section: '通知公告',
            nav_path: ['通知公告'],
            nav_path_text: '通知公告',
            summary: '2025-2026学年第二学期选课安排。',
            content: '学生选课通知，不包含目标完整短语。',
            task_kind: 'course_grade_credit',
            attachments: [],
            attachment_count: 0
        });
        const fixture = makeRoutedFixture('alias-recall', [calendarDocument, weakAliasDocument], {
            queryTerms: ['校历'],
            facet: 'notice_article',
            lightTerms: impactTerms({
                校历: { t: [0] },
                '2025-2026': { t: [0, 1] },
                学年: { t: [0, 1] }
            }),
            bodyTerms: impactTerms({
                校历: { c: [0] },
                '2025-2026': { c: [0, 1] },
                学年: { c: [0, 1] }
            }),
            queryAliases: { 校历: { aliases: ['2025-2026学年校历'] } }
        });

        await withMockFetch(fixture, async () => {
            const { results, stats } = await recallSitegraphDocuments(fixture.session, '校历', new AbortController().signal, 10);
            expect(results.map(result => result.id)).toEqual(['calendar']);
            expect(stats.resultCount).toBe(1);
        });
    });

    it('emits routed progressive phases with exhaustive coverage', async () => {
        const fixture = makeRoutedFixture('progressive-phases', [makeDocument()], {
            queryTerms: ['转专业申请'],
            lightTerms: impactTerms({ 转专业: { t: [0] } }),
            bodyTerms: impactTerms({ 申请: { c: [0] } })
        });

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(fixture.session, '转专业申请', new AbortController().signal, event => events.push(event), { limit: 5 });
            expect(events.map(event => event.type)).toEqual(expect.arrayContaining([
                'plan_started',
                'local_index_started',
                'first_trusted_results',
                'body_index_started',
                'top_results_hydrated',
                'verification_started',
                'global_exhaustive_complete'
            ]));
            const complete = events.at(-1);
            expect(complete?.type).toBe('global_exhaustive_complete');
            expect(complete?.coverage.exhaustive_complete).toBe(true);
            expect(complete?.coverage.scanned_shards).toBe(1);
            expect(complete?.coverage.proved_no_match_shards).toBe(0);
            expect(complete?.coverage.searched_documents).toBe(1);
            expect(complete?.results?.[0]?.id).toBe('jwc-detail-1');
        });
    });

});
