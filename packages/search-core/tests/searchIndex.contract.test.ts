import { describe, expect, it } from 'vitest';
import {
    artifact,
    packedImpactIndexFixture,
    packedImpactIndexFixtureV2,
    makeDocument,
    makeRoutedFixture,
    buildSitegraphMatchSnippet,
    decodePackedLocalBodyIndex,
    decodePackedLocalBodyIndexTerms,
    parseSitegraphLocalLightIndex,
    parseSitegraphManifest,
    parseSitegraphSourceManifest,
    detectQueryIntent,
    expandSitegraphQueryPhrases,
    isDegenerateSitegraphQuery,
    isDynamicHighDocumentFrequencyNormalizedQuery,
    isHighDocumentFrequencyNormalizedQuery,
    normalizeSearchText,
    tokenizeSitegraphQuery,
    HOT_QUERY_CERTIFICATE_MODEL,
    HOT_QUERY_COMPLETE_PROOF_MODEL,
    HOT_QUERY_DIRECTORY_VERSION,
    HOT_QUERY_RANK_EVIDENCE_MODEL,
    HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
    resolveHotQueryProofEntry
} from './sitegraphTestFixtures';
import type {
    SitegraphLocalBodyIndex,
    HotQueryProofDirectory
} from './sitegraphTestFixtures';

describe('sitegraph contract and query planning', () => {
    it('routes generic exam queries to current-term exam intent', () => {
        const intent = detectQueryIntent('考试');
        expect(intent.intent).toBe('exam_schedule');
        expect(intent.authoritySources).toEqual(['jwc']);
        expect(intent.freshnessMode).toBe('current_term');
    });

    it('resolves hot query command forms without unsafe substring matching', () => {
        const scoreEntry = {
            ...artifact('hot-query-entry-score.json', 'hot_query_complete_certificate'),
            query: '成绩',
            normalized_query: '成绩',
            match_phrases: ['成绩查询', '成绩复核', '成绩单', '成绩'],
            phrase_key: '成绩复核\u0000成绩查询\u0000成绩单\u0000成绩',
            total_shards: 1,
            total_documents: 2,
            matched_shard_count: 1,
            matched_shard_bytes: 128,
            match_count: 2
        };
        const calendarEntry = {
            ...artifact('hot-query-entry-calendar.json', 'hot_query_complete_certificate'),
            query: '校历',
            normalized_query: '校历',
            match_phrases: ['教学周历', '教学日历', '校历'],
            phrase_key: '教学周历\u0000教学日历\u0000校历',
            total_shards: 1,
            total_documents: 2,
            matched_shard_count: 1,
            matched_shard_bytes: 128,
            match_count: 2
        };
        const directory = {
            version: HOT_QUERY_DIRECTORY_VERSION,
            certificate_model: HOT_QUERY_CERTIFICATE_MODEL,
            complete_proof_model: HOT_QUERY_COMPLETE_PROOF_MODEL,
            top_document_payload_model: HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            rank_evidence_model: HOT_QUERY_RANK_EVIDENCE_MODEL,
            scope: 'global_unfiltered_queries',
            queries: {
                成绩: scoreEntry,
                校历: calendarEntry
            },
            total_shards: 1,
            total_documents: 2
        } as HotQueryProofDirectory;

        expect(resolveHotQueryProofEntry(directory, '查成绩')?.entry).toBe(scoreEntry);
        expect(resolveHotQueryProofEntry(directory, '成绩查询')?.entry).toBe(scoreEntry);
        expect(resolveHotQueryProofEntry(directory, '搜校历')?.entry).toBe(calendarEntry);
        expect(resolveHotQueryProofEntry(directory, '成绩造假')).toBeNull();
    });

    it('decodes packed local body impact indexes', () => {
        const payload: SitegraphLocalBodyIndex = {
            version: 'sitegraph-local-body-impact-v2',
            tokenizer: 'nfkc-lower-cjk-ngram-code',
            field_codes: { summary: 'm', content: 'c' },
            field_impacts: { m: 16, c: 10 },
            block_size: 32,
            scoring_model: 'impact-ordered-block-max-bm25f-lite-v2',
            scope: {
                index_id: 'jwc__exam__2026',
                source_id: 'jwc',
                facet: 'exam',
                year: '2026',
                shard_ids: ['s1', 's2'],
            },
            terms: {
                校历: { m: [3, 9, 14], c: [4] },
                考试: { c: [1, 2, 99] },
            },
        };

        expect(decodePackedLocalBodyIndex(packedImpactIndexFixture(payload), 'fixture.bin')).toEqual(payload);
        expect(decodePackedLocalBodyIndex(packedImpactIndexFixtureV2(payload), 'fixture-v2.bin')).toEqual(payload);
        expect(decodePackedLocalBodyIndexTerms(packedImpactIndexFixtureV2(payload), ['考试'], 'fixture-v2.bin')).toEqual({
            ...payload,
            terms: {
                考试: { c: [1, 2, 99] },
            },
        });
    });

    it('tokenizes Chinese, ASCII, and aliases for recall', () => {
        const tokens = tokenizeSitegraphQuery('转专业 B250403.xlsx', {
            转专业: { aliases: ['专业变更'] }
        });

        expect(tokens).toEqual(expect.arrayContaining(['转专业', '专业变更', 'b250403.xlsx']));
        expect(tokens[0]?.length).toBeGreaterThanOrEqual(tokens[tokens.length - 1]?.length ?? 0);
    });

    it('keeps high-document-frequency query classes explicit', () => {
        expect(isDegenerateSitegraphQuery('的')).toBe(true);
        expect(isDegenerateSitegraphQuery('通知')).toBe(false);
        expect(isHighDocumentFrequencyNormalizedQuery(normalizeSearchText('考试'))).toBe(true);
        expect(isHighDocumentFrequencyNormalizedQuery(normalizeSearchText('申请'))).toBe(true);
        expect(isDynamicHighDocumentFrequencyNormalizedQuery(normalizeSearchText('通知'))).toBe(true);
        expect(isDynamicHighDocumentFrequencyNormalizedQuery(normalizeSearchText('学生'))).toBe(true);
        expect(isDynamicHighDocumentFrequencyNormalizedQuery(normalizeSearchText('南京邮电大学'))).toBe(true);
        expect(isDynamicHighDocumentFrequencyNormalizedQuery(normalizeSearchText('考试'))).toBe(false);
        expect(isDynamicHighDocumentFrequencyNormalizedQuery(normalizeSearchText('申请'))).toBe(false);
    });

    it('does not trigger broad reverse aliases from short generic terms inside longer queries', () => {
        const aliases = {
            学生相关文件及表格: { aliases: ['学生表格', '常用下载', '表格下载', '学生相关文件'] },
            xlsx: { aliases: ['xls', 'Excel'] },
            附件1: { aliases: ['附件 1', '附件一'] },
            成绩: { aliases: ['成绩查询', '成绩单', '成绩复核'] }
        };

        const studentFormPhrases = expandSitegraphQueryPhrases('学生相关文件及表格', aliases);
        expect(studentFormPhrases).toEqual(expect.arrayContaining([
            '学生相关文件及表格',
            '学生相关文件',
            '学生表格',
            '表格下载',
            '常用下载'
        ]));
        expect(studentFormPhrases).not.toEqual(expect.arrayContaining(['excel', 'xlsx', 'xls']));
        expect(expandSitegraphQueryPhrases('表格', aliases)).toEqual(['表格']);
        expect(new Set(expandSitegraphQueryPhrases('附件1', aliases))).toEqual(new Set(['附件1', '附件一']));
        expect(expandSitegraphQueryPhrases('附件1', aliases)).not.toContain('附件');
        expect(expandSitegraphQueryPhrases('附件', aliases)).toEqual(['附件']);
        expect(new Set(expandSitegraphQueryPhrases('成绩', aliases))).toEqual(new Set(['成绩', '成绩查询', '成绩单', '成绩复核']));
        expect(expandSitegraphQueryPhrases('成绩', aliases)).not.toContain('绩点');
        expect(expandSitegraphQueryPhrases('绩点', aliases)).toEqual(['绩点']);
    });

    it('keeps the primary body hit visible near the start of mobile-safe snippets', () => {
        const terms = tokenizeSitegraphQuery('四六级', {
            四六级: { aliases: ['四级', '六级'] }
        });
        const snippet = buildSitegraphMatchSnippet({
            ...makeDocument(),
            title: '关于英国伦敦大学学院2026年暑期访学项目报名的通知',
            summary: '暑期访学项目报名通知。',
            content: '自习等多种方式进行。项目时间：8月3日-8月21日 项目收获：官方证书、学习报告 申请要求：托福 76、雅思6、四级425、六级400；无以上语言成绩者可内测，测试通过替代语言成绩获得申请资格。',
            attachments: []
        }, '四六级', terms);

        expect(snippet?.text).toContain('六级400');
        expect(snippet?.matched_terms).toEqual(expect.arrayContaining(['四级', '六级']));
        expect(snippet?.fallback).toBeFalsy();
        const firstHighlight = snippet?.highlights[0];
        expect(firstHighlight?.term).toBe('四级');
        expect(firstHighlight?.start).toBeLessThanOrEqual(32);
        const visibleLead = snippet?.text.slice(0, firstHighlight?.end ?? 0);
        expect(visibleLead).toContain('四级');
    });

    it('marks snippets that could not place a query hit as fallback snippets', () => {
        const snippet = buildSitegraphMatchSnippet({
            ...makeDocument(),
            content: '这是一段可显示的正文，但它不包含当前查询词。'
        }, '不存在的词', ['不存在的词']);

        expect(snippet?.fallback).toBe(true);
        expect(snippet?.highlights).toEqual([]);
        expect(snippet?.matched_terms).toEqual([]);
    });

    it('rejects legacy startup artifacts and full fields in local metadata', () => {
        const fixture = makeRoutedFixture('legacy-reject', [makeDocument()], { queryTerms: ['转专业'] });
        expect(() => parseSitegraphManifest({
            ...fixture.session.manifest,
            artifacts: {
                ...fixture.session.manifest.artifacts,
                doc_meta_light: artifact('legacy/doc_meta_light.json', 'doc_meta_light', 'initial')
            }
        })).toThrow(/legacy global artifact/);

        expect(() => parseSitegraphLocalLightIndex({
            ...fixture.localLightIndex,
            documents: [{ ...fixture.localLightIndex.documents[0], content: 'must stay in full shards' }]
        }, 'fixture-local-light')).toThrow(/local index metadata must not contain content/);

        expect(() => parseSitegraphSourceManifest({
            ...fixture.sourceManifest,
            local_indexes: [{
                ...fixture.sourceManifest.local_indexes[0],
                light_index: artifact('legacy/local-light.json', 'local_impact_light_index', 'query_planned'),
                body_index: artifact('legacy/local-body.json', 'local_impact_body_index', 'query_deepening')
            }]
        }, 'fixture-source-manifest')).toThrow(/legacy light_index artifacts are no longer accepted/);
    });

});
