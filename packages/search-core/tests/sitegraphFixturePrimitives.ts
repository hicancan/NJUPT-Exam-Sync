import {
    buildSitegraphMatchSnippet,
    clearSitegraphRuntimeCaches,
    decodePackedLocalBodyIndex,
    decodePackedLocalBodyIndexTerms,
    formatResolvedSearchDate,
    parseSitegraphLocalLightIndex,
    parseSitegraphManifest,
    parseSitegraphSourceManifest,
    recallSitegraphDocuments,
    searchSitegraphProgressively,
    detectQueryIntent,
    expandSitegraphQueryPhrases,
    isDegenerateSitegraphQuery,
    isDynamicHighDocumentFrequencyNormalizedQuery,
    isHighDocumentFrequencyNormalizedQuery,
    normalizeSearchText,
    tokenizeSitegraphQuery
} from '../src';
import type {
    QueryDirectoryRoute,
    SitegraphDocMeta,
    SitegraphFullDocument,
    SitegraphFullShard,
    SitegraphGlobalQueryDirectory,
    SitegraphImpactIndex,
    SitegraphLocalBodyIndex,
    SitegraphLocalIndexRef,
    SitegraphLocalLightIndex,
    SitegraphProofCatalog,
    SitegraphRoutedSession,
    SitegraphSearchEvent,
    SitegraphSearchManifest,
    SitegraphSourceManifest,
    SitegraphSourceRegistry
} from '@njupt-search/contracts';
import type { ArtifactContentCache } from '../src';
import {
    HOT_QUERY_CERTIFICATE_MODEL,
    HOT_QUERY_CERTIFICATE_VERSION,
    HOT_QUERY_COMPLETE_PROOF_MODEL,
    HOT_QUERY_DIRECTORY_VERSION,
    HOT_QUERY_PROOF_DOCUMENT_ENCODING,
    HOT_QUERY_RANK_EVIDENCE_MODEL,
    HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
    HOT_QUERY_TOPK_CERTIFICATE_VERSION,
    resolveHotQueryProofEntry,
    type HotQueryProofDirectory
} from '../src/sitegraphHotQuery';

export const artifact = (path: string, role: string, load = 'on_demand', count?: number) => ({
    path,
    sha256: '0123456789abcdef0123456789abcdef',
    bytes: 128,
    role,
    load,
    ...(count === undefined ? {} : { count })
});

export const required = <T>(value: T | undefined, message: string): T => {
    if (value === undefined) throw new Error(message);
    return value;
};

export const encodeVarint = (value: number): number[] => {
    const bytes: number[] = [];
    let current = value;
    while (current >= 0x80) {
        bytes.push((current & 0x7f) | 0x80);
        current = Math.floor(current / 128);
    }
    bytes.push(current);
    return bytes;
};

export const filterTokenHashInt = (text: string, seed: number): number => {
    let value = (2166136261 ^ seed) >>> 0;
    for (const byte of new TextEncoder().encode(text)) {
        value ^= byte;
        value = Math.imul(value, 16777619) >>> 0;
    }
    return value;
};

export const shardFilterBase64For = (tokens: string[], bitCount = 2048, hashCount = 1): string => {
    const bytes = new Uint8Array(Math.ceil(bitCount / 8));
    for (const token of tokens) {
        for (let seed = 0; seed < hashCount; seed += 1) {
            const bit = filterTokenHashInt(token, seed) % bitCount;
            bytes[Math.floor(bit / 8)] |= 1 << (bit % 8);
        }
    }
    return btoa(String.fromCharCode(...bytes));
};

export const packedImpactIndexFixture = (payload: SitegraphImpactIndex): ArrayBuffer => {
    const encoder = new TextEncoder();
    const metadata = encoder.encode(JSON.stringify(Object.fromEntries(
        Object.entries(payload).filter(([key]) => key !== 'terms')
    )));
    const bytes: number[] = [
        ...encoder.encode('SGIXB001'),
        metadata.length & 0xff,
        (metadata.length >> 8) & 0xff,
        (metadata.length >> 16) & 0xff,
        (metadata.length >> 24) & 0xff,
        ...metadata,
        ...encodeVarint(Object.keys(payload.terms).length),
    ];
    for (const term of Object.keys(payload.terms).sort()) {
        const termBytes = encoder.encode(term);
        bytes.push(...encodeVarint(termBytes.length), ...termBytes);
        const fields = payload.terms[term];
        bytes.push(...encodeVarint(Object.keys(fields).length));
        for (const field of Object.keys(fields).sort()) {
            bytes.push(field.charCodeAt(0), ...encodeVarint(fields[field].length));
            let previous = 0;
            fields[field].forEach((docId, index) => {
                bytes.push(...encodeVarint(index === 0 ? docId : docId - previous));
                previous = docId;
            });
        }
    }
    return new Uint8Array(bytes).buffer;
};

export const packedImpactIndexFixtureV2 = (payload: SitegraphImpactIndex): ArrayBuffer => {
    const encoder = new TextEncoder();
    const metadata = encoder.encode(JSON.stringify(Object.fromEntries(
        Object.entries(payload).filter(([key]) => key !== 'terms')
    )));
    const termPayloads = Object.keys(payload.terms).sort().map(term => {
        const fields = payload.terms[term];
        const payloadBytes: number[] = [...encodeVarint(Object.keys(fields).length)];
        for (const field of Object.keys(fields).sort()) {
            payloadBytes.push(field.charCodeAt(0), ...encodeVarint(fields[field].length));
            let previous = 0;
            fields[field].forEach((docId, index) => {
                payloadBytes.push(...encodeVarint(index === 0 ? docId : docId - previous));
                previous = docId;
            });
        }
        return { term, termBytes: encoder.encode(term), payloadBytes };
    });
    const bytes: number[] = [
        ...encoder.encode('SGIXB002'),
        metadata.length & 0xff,
        (metadata.length >> 8) & 0xff,
        (metadata.length >> 16) & 0xff,
        (metadata.length >> 24) & 0xff,
        ...metadata,
        ...encodeVarint(termPayloads.length),
    ];
    for (const item of termPayloads) {
        bytes.push(...encodeVarint(item.termBytes.length), ...item.termBytes, ...encodeVarint(item.payloadBytes.length));
    }
    for (const item of termPayloads) {
        bytes.push(...item.payloadBytes);
    }
    return new Uint8Array(bytes).buffer;
};

export const fullShard = (prefix: string, count: number, facet = 'policy'): SitegraphFullShard => ({
    shard_id: `jwc__${facet}__detail__2026__rules__b0__${prefix}`,
    path: `${prefix}/full-shard.json`,
    sha256: '0123456789abcdef0123456789abcdef',
    bytes: 256,
    count,
    contains: 'full_documents',
    source_id: 'jwc',
    facet_range: [facet],
    record_type_range: ['detail'],
    section_range: ['jwc_rules_root'],
    year_range: ['2026'],
    hash_bucket: 'b0',
    filter_token_count: 4,
    filter_sha256: '0123456789abcdef'
});

export const makeDocument = (overrides: Partial<SitegraphFullDocument> = {}): SitegraphFullDocument => {
    const shard = overrides.shard ?? { shard_id: 'jwc__policy__detail__2026__rules__b0', path: 'fixture/full-shard.json' };
    return {
        doc_index: 0,
        id: 'jwc-detail-1',
        record_type: 'detail',
        page_type: 'detail_article_page',
        facet: 'policy',
        title: '南京邮电大学本科生转专业管理办法',
        url: 'https://jwc.njupt.edu.cn/1/page.htm',
        source_id: 'jwc',
        source: '本科生院 / 教务处',
        source_domain: 'jwc.njupt.edu.cn',
        section_id: 'jwc_rules_root',
        section: '规章制度',
        nav_path: ['规章制度'],
        nav_path_text: '规章制度',
        canonical_title: '南京邮电大学本科生转专业管理办法',
        published_at: '2026-05-20',
        updated_at: null,
        recorded_at: null,
        version_date: '2026-05-20',
        date_kind: 'published',
        date_confidence: 'source_published',
        academic_year: null,
        term: null,
        task_kind: 'academic_policy',
        authority_profile: 'jwc_academic',
        dedupe_key: 'jwc:detail:fixture',
        publisher: '综合科',
        summary: '转专业政策摘要',
        attachment_count: 1,
        hash: 'hash',
        tags: ['policy'],
        collection_method: 'search_record',
        provenance: { site_id: 'jwc', section_id: 'jwc_rules_root', nav_path: ['规章制度'], outcome: 'search_record' },
        shard,
        content: '学生申请转专业需要符合管理办法。',
        attachments: [{
            attachment_id: 'att-1',
            name: '转专业申请表.doc',
            url: 'https://jwc.njupt.edu.cn/a.doc',
            extension: 'doc',
            parent_url: 'https://jwc.njupt.edu.cn/1/page.htm',
            parent_doc_id: 'jwc-detail-1',
            section_id: 'jwc_rules_root',
            section: '规章制度',
            nav_path: ['规章制度'],
            metadata_only: true,
            evidence_level: 'filename_only',
            available_evidence: ['metadata_only', 'filename_only'],
            unavailable_evidence: ['text_extracted', 'snippet', 'full_content'],
            text_extracted: false,
            snippet_available: false,
            full_content_available: false,
            coverage_note: 'Only authoritative attachment metadata and filename are indexed; binary attachment content is not extracted.',
            position: 1
        }],
        ...overrides
    };
};

export const hotQueryCompactProofPayloadFrom = (
    document: SitegraphFullDocument,
    phrases: string[],
    rankBaseScore = 128
): {
    document_encoding: typeof HOT_QUERY_PROOF_DOCUMENT_ENCODING;
    document_dictionaries: {
        source_ids: string[];
        facets: string[];
        record_types: string[];
        shards: string[];
        fields: string[];
        phrases: string[];
        dates: string[];
        date_kinds: string[];
        date_confidences: string[];
    };
    documents: unknown[][];
} => {
    const dates = [document.published_at, document.version_date].filter((value): value is string => typeof value === 'string');
    const dateIndex = (value: string | null | undefined): number => {
        if (!value) return -1;
        return dates.indexOf(value);
    };
    const dateKinds = document.date_kind ? [document.date_kind] : [];
    const dateConfidences = document.date_confidence ? [document.date_confidence] : [];
    return {
        document_encoding: HOT_QUERY_PROOF_DOCUMENT_ENCODING,
        document_dictionaries: {
            source_ids: [document.source_id],
            facets: [document.facet],
            record_types: [document.record_type],
            shards: [document.shard.shard_id],
            fields: ['title'],
            phrases,
            dates,
            date_kinds: dateKinds,
            date_confidences: dateConfidences,
        },
        documents: [[
            document.doc_index,
            0,
            0,
            0,
            0,
            rankBaseScore,
            [0],
            phrases.map((_, index) => index),
            dateIndex(document.published_at),
            dateIndex(document.updated_at),
            dateIndex(document.recorded_at),
            dateIndex(document.version_date),
            document.date_kind ? 0 : -1,
            document.date_confidence ? 0 : -1,
        ]],
    }
};

export const docMetaFrom = (document: SitegraphFullDocument): SitegraphDocMeta => ({
    doc_index: document.doc_index,
    id: document.id,
    record_type: document.record_type,
    facet: document.facet,
    title: document.title,
    url: document.url,
    source_id: document.source_id,
    source: document.source,
    source_domain: document.source_domain,
    section_id: document.section_id,
    section: document.section,
    nav_path: document.nav_path,
    nav_path_text: document.nav_path_text,
    canonical_title: document.canonical_title,
    published_at: document.published_at,
    updated_at: document.updated_at,
    recorded_at: document.recorded_at,
    version_date: document.version_date,
    date_kind: document.date_kind,
    date_confidence: document.date_confidence,
    task_kind: document.task_kind,
    authority_profile: document.authority_profile,
    dedupe_key: document.dedupe_key,
    attachment_count: document.attachment_count,
    collection_method: document.collection_method,
    shard: document.shard
});

export const route = (
    term: string,
    localIndexIds: string[],
    likelyFacets = ['policy'],
    expectedResultTypes = ['detail']
): QueryDirectoryRoute => ({
    term,
    likely_sources: ['jwc'],
    likely_facets: likelyFacets,
    likely_years: ['2026'],
    likely_task_kinds: ['academic_policy'],
    expected_result_types: expectedResultTypes,
    local_index_ids: localIndexIds,
    sample_shard_ids: [],
    candidate_shard_group_count: 1,
    authority_priors: { jwc: 1 },
    freshness_policy: 'prefer_recent_for_current_notice_intents',
    matched_document_count: 1,
    expected_cost_bytes: 256,
    expected_utility_per_kb: 4,
    planner_features: {
        source_entropy: 1,
        facet_entropy: 1,
        year_entropy: 1,
        local_index_count: localIndexIds.length
    }
});

export const impactTerms = (postings: Record<string, Record<string, number[]>>): SitegraphImpactIndex['terms'] => {
    return postings;
};
export {
    buildSitegraphMatchSnippet,
    clearSitegraphRuntimeCaches,
    decodePackedLocalBodyIndex,
    decodePackedLocalBodyIndexTerms,
    formatResolvedSearchDate,
    parseSitegraphLocalLightIndex,
    parseSitegraphManifest,
    parseSitegraphSourceManifest,
    recallSitegraphDocuments,
    searchSitegraphProgressively,
    detectQueryIntent,
    expandSitegraphQueryPhrases,
    isDegenerateSitegraphQuery,
    isDynamicHighDocumentFrequencyNormalizedQuery,
    isHighDocumentFrequencyNormalizedQuery,
    normalizeSearchText,
    tokenizeSitegraphQuery,
    HOT_QUERY_CERTIFICATE_MODEL,
    HOT_QUERY_CERTIFICATE_VERSION,
    HOT_QUERY_COMPLETE_PROOF_MODEL,
    HOT_QUERY_DIRECTORY_VERSION,
    HOT_QUERY_PROOF_DOCUMENT_ENCODING,
    HOT_QUERY_RANK_EVIDENCE_MODEL,
    HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
    HOT_QUERY_TOPK_CERTIFICATE_VERSION,
    resolveHotQueryProofEntry
};

export type {
    QueryDirectoryRoute,
    SitegraphDocMeta,
    SitegraphFullDocument,
    SitegraphFullShard,
    SitegraphGlobalQueryDirectory,
    SitegraphImpactIndex,
    SitegraphLocalBodyIndex,
    SitegraphLocalIndexRef,
    SitegraphLocalLightIndex,
    SitegraphProofCatalog,
    SitegraphRoutedSession,
    SitegraphSearchEvent,
    SitegraphSearchManifest,
    SitegraphSourceManifest,
    SitegraphSourceRegistry,
    ArtifactContentCache,
    HotQueryProofDirectory
};
