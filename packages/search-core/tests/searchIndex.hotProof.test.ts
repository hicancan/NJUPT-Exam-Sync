import { describe, expect, it } from 'vitest';
import {
    artifact,
    required,
    makeDocument,
    hotQueryCompactProofPayloadFrom,
    impactTerms,
    makeRoutedFixture,
    withMockFetch,
    searchSitegraphProgressively,
    HOT_QUERY_CERTIFICATE_MODEL,
    HOT_QUERY_CERTIFICATE_VERSION,
    HOT_QUERY_COMPLETE_PROOF_MODEL,
    HOT_QUERY_DIRECTORY_VERSION,
    HOT_QUERY_RANK_EVIDENCE_MODEL,
    HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
    HOT_QUERY_TOPK_CERTIFICATE_VERSION
} from './sitegraphTestFixtures';
import type {
    SitegraphSearchEvent
} from './sitegraphTestFixtures';

describe('sitegraph hot query proof certificates', () => {
    it('uses hot query complete certificates instead of proof full-shard fallback', async () => {
        const calendarDocument = makeDocument({
            id: 'calendar-hot-proof',
            title: '2025-2026学年校历',
            canonical_title: '2025-2026学年校历',
            summary: '学校发布2025-2026学年校历。',
            content: '2025-2026学年校历安排。',
            attachments: [],
            attachment_count: 0
        });
        const fixture = makeRoutedFixture('hot-query-proof', [calendarDocument], {
            queryTerms: ['校历'],
            lightTerms: {},
            bodyTerms: {}
        });
        const directoryArtifact = artifact('hot-query-proof/hot-query-proof-directory.json', 'hot_query_proof_directory', 'verify', 1);
        const topCertificateArtifact = artifact('hot-query-proof/hot-query-topk-calendar.json', 'hot_query_topk_certificate', 'query_planned', 1);
        const certificateArtifact = artifact('hot-query-proof/hot-query-complete-calendar.json', 'hot_query_complete_certificate', 'verify', 1);
        fixture.session.manifest.artifacts.hot_query_proof_directory = directoryArtifact;

        const shard = required(fixture.sourceManifest.full_shards[0], 'expected full shard');
        const directory = {
            version: HOT_QUERY_DIRECTORY_VERSION,
            certificate_model: HOT_QUERY_CERTIFICATE_MODEL,
            complete_proof_model: HOT_QUERY_COMPLETE_PROOF_MODEL,
            top_document_payload_model: HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            scope: 'global_unfiltered_queries',
            total_shards: 1,
            total_documents: 1,
            queries: {
                校历: {
                    ...certificateArtifact,
                    query: '校历',
                    normalized_query: '校历',
                    match_phrases: ['校历'],
                    phrase_key: '校历',
                    top_certificate: {
                        ...topCertificateArtifact,
                        top_k_limit: 80,
                        match_count: 1
                    },
                    total_shards: 1,
                    total_documents: 1,
                    matched_shard_count: 1,
                    matched_shard_bytes: shard.bytes,
                    match_count: 1
                }
            }
        };
        const certificateDocument = {
            ...required(fixture.documents[0], 'expected certificate document'),
            content: '校历安排。',
            content_normalized_length: 1280,
            rank_base_score: 128,
            attachments: []
        };
        const topCertificate = {
            version: HOT_QUERY_TOPK_CERTIFICATE_VERSION,
            document_payload_model: HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            query: '校历',
            normalized_query: '校历',
            match_phrases: ['校历'],
            rank_terms: ['校历'],
            phrase_key: '校历',
            top_k_limit: 80,
            top_k_count: 1,
            match_count: 1,
            total_shards: 1,
            total_documents: 1,
            matched_shards: [shard.shard_id],
            matched_shard_count: 1,
            documents: [certificateDocument]
        };
        const certificate = {
            version: HOT_QUERY_CERTIFICATE_VERSION,
            proof_payload_model: HOT_QUERY_COMPLETE_PROOF_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            query: '校历',
            normalized_query: '校历',
            match_phrases: ['校历'],
            rank_terms: ['校历'],
            phrase_key: '校历',
            total_shards: 1,
            total_documents: 1,
            matched_shards: [shard.shard_id],
            matched_shard_count: 1,
            matched_shard_bytes: shard.bytes,
            proved_no_match_shards: 0,
            ...hotQueryCompactProofPayloadFrom(certificateDocument, ['校历']),
            match_count: 1
        };
        const requestedPaths: string[] = [];

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(fixture.session, '校历', new AbortController().signal, event => events.push(event), { limit: 5 });
            const complete = events.at(-1);
            expect(events.map(event => event.type)).toEqual([
                'plan_started',
                'first_trusted_results',
                'top_results_hydrated',
                'global_exhaustive_complete'
            ]);
            expect(complete?.type).toBe('global_exhaustive_complete');
            expect(complete?.coverage.scanned_shards).toBe(1);
            expect(complete?.coverage.proved_no_match_shards).toBe(0);
            expect(complete?.coverage.searched_documents).toBe(1);
            expect(complete?.coverage.hydrated_shard_bytes).toBe(0);
            expect(complete?.stats?.loadedLocalIndexCount).toBe(0);
            expect(complete?.stats?.loadedShardCount).toBe(0);
            expect(complete?.results?.[0]?.id).toBe('calendar-hot-proof');
            expect(events.some(event => event.type === 'verification_started')).toBe(false);
            expect(requestedPaths.filter(path => path.endsWith(shard.path))).toHaveLength(0);
            expect(requestedPaths.some(path => path.endsWith(required(fixture.sourceManifest.artifacts.proof_catalog, 'expected proof catalog').path))).toBe(false);
            expect(requestedPaths.some(path => path.endsWith(required(fixture.sourceManifest.artifacts.shard_filter, 'expected shard filter').path))).toBe(false);
            expect(requestedPaths.some(path => path.endsWith(directoryArtifact.path))).toBe(true);
            expect(requestedPaths.some(path => path.endsWith(topCertificateArtifact.path))).toBe(true);
            expect(requestedPaths.some(path => path.endsWith(certificateArtifact.path))).toBe(true);
        }, {
            extraResponses: {
                [directoryArtifact.path]: directory,
                [topCertificateArtifact.path]: topCertificate,
                [certificateArtifact.path]: certificate
            },
            requestedPaths
        });
    });

    it('reuses hot query certificates for equivalent aliases with the same phrase key', async () => {
        const calendarDocument = makeDocument({
            id: 'calendar-hot-proof-alias',
            title: '2025-2026学年教学周历',
            canonical_title: '2025-2026学年教学周历',
            summary: '学校发布2025-2026学年教学周历。',
            content: '2025-2026学年教学周历安排。',
            attachments: [],
            attachment_count: 0
        });
        const fixture = makeRoutedFixture('hot-query-proof-alias', [calendarDocument], {
            queryTerms: ['教学周历'],
            lightTerms: {},
            bodyTerms: {},
            queryAliases: { 校历: { aliases: ['教学周历'] } }
        });
        const directoryArtifact = artifact('hot-query-proof-alias/hot-query-proof-directory.json', 'hot_query_proof_directory', 'verify', 1);
        const topCertificateArtifact = artifact('hot-query-proof-alias/hot-query-topk-calendar.json', 'hot_query_topk_certificate', 'query_planned', 1);
        const certificateArtifact = artifact('hot-query-proof-alias/hot-query-complete-calendar.json', 'hot_query_complete_certificate', 'verify', 1);
        fixture.session.manifest.artifacts.hot_query_proof_directory = directoryArtifact;

        const shard = required(fixture.sourceManifest.full_shards[0], 'expected full shard');
        const phraseKey = '教学周历\u0000校历';
        const directory = {
            version: HOT_QUERY_DIRECTORY_VERSION,
            certificate_model: HOT_QUERY_CERTIFICATE_MODEL,
            complete_proof_model: HOT_QUERY_COMPLETE_PROOF_MODEL,
            top_document_payload_model: HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            scope: 'global_unfiltered_queries',
            total_shards: 1,
            total_documents: 1,
            queries: {
                教学周历: {
                    ...certificateArtifact,
                    query: '教学周历',
                    normalized_query: '校历',
                    alias_of: '校历',
                    match_phrases: ['教学周历', '校历'],
                    phrase_key: phraseKey,
                    top_certificate: {
                        ...topCertificateArtifact,
                        top_k_limit: 80,
                        match_count: 1
                    },
                    total_shards: 1,
                    total_documents: 1,
                    matched_shard_count: 1,
                    matched_shard_bytes: shard.bytes,
                    match_count: 1
                }
            }
        };
        const certificateDocument = {
            ...required(fixture.documents[0], 'expected certificate document'),
            content: '教学周历安排。',
            content_normalized_length: 1280,
            rank_base_score: 128,
            attachments: []
        };
        const topCertificate = {
            version: HOT_QUERY_TOPK_CERTIFICATE_VERSION,
            document_payload_model: HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            query: '校历',
            normalized_query: '校历',
            match_phrases: ['教学周历', '校历'],
            rank_terms: ['教学周历', '校历'],
            phrase_key: phraseKey,
            top_k_limit: 80,
            top_k_count: 1,
            match_count: 1,
            total_shards: 1,
            total_documents: 1,
            matched_shards: [shard.shard_id],
            matched_shard_count: 1,
            documents: [certificateDocument]
        };
        const certificate = {
            version: HOT_QUERY_CERTIFICATE_VERSION,
            proof_payload_model: HOT_QUERY_COMPLETE_PROOF_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            query: '校历',
            normalized_query: '校历',
            match_phrases: ['教学周历', '校历'],
            rank_terms: ['教学周历', '校历'],
            phrase_key: phraseKey,
            total_shards: 1,
            total_documents: 1,
            matched_shards: [shard.shard_id],
            matched_shard_count: 1,
            matched_shard_bytes: shard.bytes,
            proved_no_match_shards: 0,
            ...hotQueryCompactProofPayloadFrom(certificateDocument, ['教学周历', '校历']),
            match_count: 1
        };
        const requestedPaths: string[] = [];

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(fixture.session, '教学周历', new AbortController().signal, event => events.push(event), { limit: 5 });
            const complete = events.at(-1);
            expect(events.map(event => event.type)).toEqual([
                'plan_started',
                'first_trusted_results',
                'top_results_hydrated',
                'global_exhaustive_complete'
            ]);
            expect(complete?.type).toBe('global_exhaustive_complete');
            expect(complete?.coverage.exhaustive_complete).toBe(true);
            expect(complete?.stats?.loadedLocalIndexCount).toBe(0);
            expect(complete?.stats?.loadedShardCount).toBe(0);
            expect(complete?.results?.[0]?.id).toBe('calendar-hot-proof-alias');
            expect(events.some(event => event.type === 'verification_started')).toBe(false);
            expect(requestedPaths.some(path => path.endsWith(directoryArtifact.path))).toBe(true);
            expect(requestedPaths.some(path => path.endsWith(topCertificateArtifact.path))).toBe(true);
            expect(requestedPaths.some(path => path.endsWith(certificateArtifact.path))).toBe(true);
            expect(requestedPaths.filter(path => path.endsWith(shard.path))).toHaveLength(0);
        }, {
            extraResponses: {
                [directoryArtifact.path]: directory,
                [topCertificateArtifact.path]: topCertificate,
                [certificateArtifact.path]: certificate
            },
            requestedPaths
        });
    });

    it('uses hot query certificates for command-normalized common student queries', async () => {
        const scoreDocument = makeDocument({
            id: 'score-hot-proof-command',
            title: '南京邮电大学学生成绩复核申请表',
            canonical_title: '南京邮电大学学生成绩复核申请表',
            summary: '学生成绩复核申请表下载。',
            content: '学生可查询成绩并提交成绩复核申请。',
            attachments: [],
            attachment_count: 0
        });
        const fixture = makeRoutedFixture('hot-query-proof-command', [scoreDocument], {
            queryTerms: ['成绩'],
            lightTerms: {},
            bodyTerms: {},
            queryAliases: { 成绩: { aliases: ['成绩查询', '成绩单', '成绩复核'] } }
        });
        const directoryArtifact = artifact('hot-query-proof-command/hot-query-proof-directory.json', 'hot_query_proof_directory', 'verify', 1);
        const topCertificateArtifact = artifact('hot-query-proof-command/hot-query-topk-score.json', 'hot_query_topk_certificate', 'query_planned', 1);
        const certificateArtifact = artifact('hot-query-proof-command/hot-query-complete-score.json', 'hot_query_complete_certificate', 'verify', 1);
        fixture.session.manifest.artifacts.hot_query_proof_directory = directoryArtifact;

        const shard = required(fixture.sourceManifest.full_shards[0], 'expected full shard');
        const phraseKey = '成绩复核\u0000成绩查询\u0000成绩单\u0000成绩';
        const directory = {
            version: HOT_QUERY_DIRECTORY_VERSION,
            certificate_model: HOT_QUERY_CERTIFICATE_MODEL,
            complete_proof_model: HOT_QUERY_COMPLETE_PROOF_MODEL,
            top_document_payload_model: HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            scope: 'global_unfiltered_queries',
            total_shards: 1,
            total_documents: 1,
            queries: {
                成绩: {
                    ...certificateArtifact,
                    query: '成绩',
                    normalized_query: '成绩',
                    match_phrases: ['成绩查询', '成绩复核', '成绩单', '成绩'],
                    phrase_key: phraseKey,
                    top_certificate: {
                        ...topCertificateArtifact,
                        top_k_limit: 80,
                        match_count: 1
                    },
                    total_shards: 1,
                    total_documents: 1,
                    matched_shard_count: 1,
                    matched_shard_bytes: shard.bytes,
                    match_count: 1
                }
            }
        };
        const certificateDocument = {
            ...required(fixture.documents[0], 'expected certificate document'),
            content: '学生可查询成绩并提交成绩复核申请。',
            content_normalized_length: 1280,
            rank_base_score: 128,
            attachments: []
        };
        const topCertificate = {
            version: HOT_QUERY_TOPK_CERTIFICATE_VERSION,
            document_payload_model: HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            query: '成绩',
            normalized_query: '成绩',
            match_phrases: ['成绩查询', '成绩复核', '成绩单', '成绩'],
            rank_terms: ['成绩查询', '成绩复核', '成绩单', '成绩'],
            phrase_key: phraseKey,
            top_k_limit: 80,
            top_k_count: 1,
            match_count: 1,
            total_shards: 1,
            total_documents: 1,
            matched_shards: [shard.shard_id],
            matched_shard_count: 1,
            documents: [certificateDocument]
        };
        const certificate = {
            version: HOT_QUERY_CERTIFICATE_VERSION,
            proof_payload_model: HOT_QUERY_COMPLETE_PROOF_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            query: '成绩',
            normalized_query: '成绩',
            match_phrases: ['成绩查询', '成绩复核', '成绩单', '成绩'],
            rank_terms: ['成绩查询', '成绩复核', '成绩单', '成绩'],
            phrase_key: phraseKey,
            total_shards: 1,
            total_documents: 1,
            matched_shards: [shard.shard_id],
            matched_shard_count: 1,
            matched_shard_bytes: shard.bytes,
            proved_no_match_shards: 0,
            ...hotQueryCompactProofPayloadFrom(certificateDocument, ['成绩查询', '成绩复核', '成绩单', '成绩']),
            match_count: 1
        };
        const requestedPaths: string[] = [];

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(fixture.session, '查成绩', new AbortController().signal, event => events.push(event), { limit: 5 });
            const complete = events.at(-1);
            expect(events.map(event => event.type)).toEqual([
                'plan_started',
                'first_trusted_results',
                'top_results_hydrated',
                'global_exhaustive_complete'
            ]);
            expect(complete?.type).toBe('global_exhaustive_complete');
            expect(complete?.coverage.exhaustive_complete).toBe(true);
            expect(complete?.stats?.loadedLocalIndexCount).toBe(0);
            expect(complete?.stats?.loadedShardCount).toBe(0);
            expect(complete?.results?.[0]?.id).toBe('score-hot-proof-command');
            expect(requestedPaths.some(path => path.endsWith(directoryArtifact.path))).toBe(true);
            expect(requestedPaths.some(path => path.endsWith(topCertificateArtifact.path))).toBe(true);
            expect(requestedPaths.some(path => path.endsWith(certificateArtifact.path))).toBe(true);
            expect(requestedPaths.filter(path => path.endsWith(shard.path))).toHaveLength(0);
        }, {
            extraResponses: {
                [directoryArtifact.path]: directory,
                [topCertificateArtifact.path]: topCertificate,
                [certificateArtifact.path]: certificate
            },
            requestedPaths
        });
    });

    it('does not reuse hot query certificates for unsafe substring-only queries', async () => {
        const scoreDocument = makeDocument({
            id: 'score-hot-proof-unsafe',
            title: '南京邮电大学学生成绩复核申请表',
            canonical_title: '南京邮电大学学生成绩复核申请表',
            summary: '学生成绩复核申请表下载。',
            content: '学生可查询成绩并提交成绩复核申请。',
            attachments: [],
            attachment_count: 0
        });
        const fixture = makeRoutedFixture('hot-query-proof-unsafe', [scoreDocument], {
            queryTerms: ['成绩'],
            lightTerms: impactTerms({ 成绩: { t: [0] } }),
            bodyTerms: impactTerms({ 成绩: { c: [0] } }),
            queryAliases: { 成绩: { aliases: ['成绩查询', '成绩单', '成绩复核'] } }
        });
        const directoryArtifact = artifact('hot-query-proof-unsafe/hot-query-proof-directory.json', 'hot_query_proof_directory', 'verify', 1);
        const topCertificateArtifact = artifact('hot-query-proof-unsafe/hot-query-topk-score.json', 'hot_query_topk_certificate', 'query_planned', 1);
        const certificateArtifact = artifact('hot-query-proof-unsafe/hot-query-complete-score.json', 'hot_query_complete_certificate', 'verify', 1);
        fixture.session.manifest.artifacts.hot_query_proof_directory = directoryArtifact;

        const shard = required(fixture.sourceManifest.full_shards[0], 'expected full shard');
        const directory = {
            version: HOT_QUERY_DIRECTORY_VERSION,
            certificate_model: HOT_QUERY_CERTIFICATE_MODEL,
            complete_proof_model: HOT_QUERY_COMPLETE_PROOF_MODEL,
            top_document_payload_model: HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            scope: 'global_unfiltered_queries',
            total_shards: 1,
            total_documents: 1,
            queries: {
                成绩: {
                    ...certificateArtifact,
                    query: '成绩',
                    normalized_query: '成绩',
                    match_phrases: ['成绩查询', '成绩复核', '成绩单', '成绩'],
                    phrase_key: '成绩复核\u0000成绩查询\u0000成绩单\u0000成绩',
                    top_certificate: {
                        ...topCertificateArtifact,
                        top_k_limit: 80,
                        match_count: 1
                    },
                    total_shards: 1,
                    total_documents: 1,
                    matched_shard_count: 1,
                    matched_shard_bytes: shard.bytes,
                    match_count: 1
                }
            }
        };
        const requestedPaths: string[] = [];

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(fixture.session, '成绩造假', new AbortController().signal, event => events.push(event), { limit: 5 });
            expect(events.map(event => event.type)).toContain('verification_started');
            expect(events.at(-1)?.type).toBe('global_exhaustive_complete');
            expect(requestedPaths.some(path => path.endsWith(directoryArtifact.path))).toBe(true);
            expect(requestedPaths.some(path => path.endsWith(topCertificateArtifact.path))).toBe(false);
            expect(requestedPaths.some(path => path.endsWith(certificateArtifact.path))).toBe(false);
            expect(requestedPaths.some(path => path.endsWith(shard.path))).toBe(true);
        }, {
            extraResponses: {
                [directoryArtifact.path]: directory
            },
            requestedPaths
        });
    });

    it('uses global hot query complete certificates for scoped source filters', async () => {
        const calendarDocument = makeDocument({
            id: 'calendar-hot-proof-scoped',
            title: '2025-2026学年校历',
            canonical_title: '2025-2026学年校历',
            summary: '学校发布2025-2026学年校历。',
            content: '2025-2026学年校历安排。',
            attachments: [],
            attachment_count: 0
        });
        const fixture = makeRoutedFixture('hot-query-proof-scoped', [calendarDocument], {
            queryTerms: ['校历'],
            lightTerms: {},
            bodyTerms: {}
        });
        const directoryArtifact = artifact('hot-query-proof-scoped/hot-query-proof-directory.json', 'hot_query_proof_directory', 'verify', 1);
        const certificateArtifact = artifact('hot-query-proof-scoped/hot-query-complete-calendar.json', 'hot_query_complete_certificate', 'verify', 1);
        const topCertificateArtifact = artifact('hot-query-proof-scoped/hot-query-topk-calendar.json', 'hot_query_topk_certificate', 'query_planned', 1);
        fixture.session.manifest.artifacts.hot_query_proof_directory = directoryArtifact;

        const shard = required(fixture.sourceManifest.full_shards[0], 'expected full shard');
        const directory = {
            version: HOT_QUERY_DIRECTORY_VERSION,
            certificate_model: HOT_QUERY_CERTIFICATE_MODEL,
            complete_proof_model: HOT_QUERY_COMPLETE_PROOF_MODEL,
            top_document_payload_model: HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            scope: 'global_unfiltered_queries',
            total_shards: 1,
            total_documents: 1,
            queries: {
                校历: {
                    ...certificateArtifact,
                    query: '校历',
                    normalized_query: '校历',
                    match_phrases: ['校历'],
                    phrase_key: '校历',
                    top_certificate: {
                        ...topCertificateArtifact,
                        top_k_limit: 80,
                        match_count: 1
                    },
                    total_shards: 1,
                    total_documents: 1,
                    matched_shard_count: 1,
                    matched_shard_bytes: shard.bytes,
                    match_count: 1
                }
            }
        };
        const certificateDocument = {
            ...required(fixture.documents[0], 'expected certificate document'),
            content: '校历安排。',
            content_normalized_length: 1280,
            rank_base_score: 128,
            attachments: []
        };
        const topCertificate = {
            version: HOT_QUERY_TOPK_CERTIFICATE_VERSION,
            document_payload_model: HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            query: '校历',
            normalized_query: '校历',
            match_phrases: ['校历'],
            rank_terms: ['校历'],
            phrase_key: '校历',
            top_k_limit: 80,
            top_k_count: 1,
            match_count: 1,
            total_shards: 1,
            total_documents: 1,
            matched_shards: [shard.shard_id],
            matched_shard_count: 1,
            documents: [certificateDocument]
        };
        const certificate = {
            version: HOT_QUERY_CERTIFICATE_VERSION,
            proof_payload_model: HOT_QUERY_COMPLETE_PROOF_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            query: '校历',
            normalized_query: '校历',
            match_phrases: ['校历'],
            rank_terms: ['校历'],
            phrase_key: '校历',
            total_shards: 1,
            total_documents: 1,
            matched_shards: [shard.shard_id],
            matched_shard_count: 1,
            matched_shard_bytes: shard.bytes,
            proved_no_match_shards: 0,
            ...hotQueryCompactProofPayloadFrom(certificateDocument, ['校历']),
            match_count: 1
        };
        const requestedPaths: string[] = [];

        await withMockFetch(fixture, async () => {
            const events: SitegraphSearchEvent[] = [];
            await searchSitegraphProgressively(
                fixture.session,
                '校历',
                new AbortController().signal,
                event => events.push(event),
                { limit: 5, filters: { sourceId: 'jwc' } }
            );
            const complete = events.at(-1);
            expect(events.map(event => event.type)).toEqual([
                'plan_started',
                'first_trusted_results',
                'top_results_hydrated',
                'scoped_exhaustive_complete'
            ]);
            expect(complete?.type).toBe('scoped_exhaustive_complete');
            expect(complete?.coverage.scope).toBe('scoped');
            expect(complete?.coverage.exhaustive_complete).toBe(true);
            expect(complete?.coverage.scanned_shards).toBe(1);
            expect(complete?.coverage.proved_no_match_shards).toBe(0);
            expect(complete?.coverage.searched_documents).toBe(1);
            expect(complete?.coverage.hydrated_shard_bytes).toBe(0);
            expect(complete?.stats?.loadedLocalIndexCount).toBe(0);
            expect(complete?.stats?.loadedShardCount).toBe(0);
            expect(complete?.results?.[0]?.id).toBe('calendar-hot-proof-scoped');
            expect(events.some(event => event.type === 'verification_started')).toBe(false);
            expect(requestedPaths.some(path => path.endsWith(required(fixture.sourceManifest.artifacts.shard_filter, 'expected shard filter').path))).toBe(false);
            expect(requestedPaths.some(path => path.endsWith(shard.path))).toBe(false);
            expect(requestedPaths.some(path => path.endsWith(directoryArtifact.path))).toBe(true);
            expect(requestedPaths.some(path => path.endsWith(certificateArtifact.path))).toBe(true);
            expect(requestedPaths.some(path => path.endsWith(topCertificateArtifact.path))).toBe(true);
        }, {
            extraResponses: {
                [directoryArtifact.path]: directory,
                [certificateArtifact.path]: certificate,
                [topCertificateArtifact.path]: topCertificate
            },
            requestedPaths
        });
    });

});
