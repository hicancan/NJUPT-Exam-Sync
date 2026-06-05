import type { SitegraphArtifact, SitegraphFullDocument } from '@njupt-search/contracts';
import hotQueryNormalization from '../../../config/search/hot-query-normalization.json';
import { SearchContractError, parseSitegraphFullDocuments } from './sitegraphContract';
import { normalizeSearchText as normalize } from './tokenizer';

export const HOT_QUERY_DIRECTORY_VERSION = 'sitegraph-hot-query-complete-directory-v3';
export const HOT_QUERY_FAST_START_VERSION = 'sitegraph-hot-query-fast-start-v1';
export const HOT_QUERY_CERTIFICATE_VERSION = 'sitegraph-hot-query-complete-certificate-v4';
export const HOT_QUERY_TOPK_CERTIFICATE_VERSION = 'sitegraph-hot-query-topk-certificate-v2';
export const HOT_QUERY_INITIAL_CERTIFICATE_VERSION = 'sitegraph-hot-query-initial-certificate-v1';
export const HOT_QUERY_CERTIFICATE_MODEL = 'hot-query-minimal-complete-proof-v3';
export const HOT_QUERY_COMPLETE_PROOF_MODEL = 'match-proof-compact-filter-v2';
export const HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL = 'rank-display-match-window-certificate-v3';
export const HOT_QUERY_RANK_EVIDENCE_MODEL = 'query-token-field-impact-full-document-v1';
export const HOT_QUERY_PROOF_DOCUMENT_ENCODING = 'sitegraph-hot-query-proof-doc-tuples-v1';

export interface HotQueryProofDirectoryEntry extends SitegraphArtifact {
    query: string;
    normalized_query: string;
    alias_of?: string;
    match_phrases: string[];
    phrase_key: string;
    total_shards: number;
    total_documents: number;
    matched_shard_count: number;
    matched_shard_bytes: number;
    match_count: number;
    initial_certificate?: SitegraphArtifact & {
        initial_limit?: number;
        top_k_limit?: number;
        match_count?: number;
    };
    top_certificate?: SitegraphArtifact & {
        top_k_limit?: number;
        match_count?: number;
    };
}

export interface HotQueryProofDirectory {
    version: typeof HOT_QUERY_DIRECTORY_VERSION;
    certificate_model: typeof HOT_QUERY_CERTIFICATE_MODEL;
    complete_proof_model?: typeof HOT_QUERY_COMPLETE_PROOF_MODEL;
    top_document_payload_model?: typeof HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL;
    rank_evidence_model?: typeof HOT_QUERY_RANK_EVIDENCE_MODEL;
    scope: 'global_unfiltered_queries';
    queries: Record<string, HotQueryProofDirectoryEntry>;
    query_count?: number;
    total_shards: number;
    total_documents: number;
}

export interface HotQueryProofDocument {
    doc_index: number;
    id?: string;
    source_id: string;
    facet: string;
    record_type: string;
    shard_id: string;
    hash?: string;
    published_at?: string | null;
    updated_at?: string | null;
    recorded_at?: string | null;
    version_date?: string | null;
    date_kind?: string | null;
    date_confidence?: string | null;
    rank_base_score: number;
    match_evidence: {
        fields: string[];
        phrases: string[];
    };
}

export type HotQueryProofDocumentDictionaries = Record<
    'source_ids' | 'facets' | 'record_types' | 'shards' | 'fields' | 'phrases' | 'dates' | 'date_kinds' | 'date_confidences',
    string[]
>;

export interface HotQueryProofCertificate {
    version: typeof HOT_QUERY_CERTIFICATE_VERSION;
    proof_payload_model: typeof HOT_QUERY_COMPLETE_PROOF_MODEL;
    rank_evidence_model?: typeof HOT_QUERY_RANK_EVIDENCE_MODEL;
    query: string;
    normalized_query: string;
    match_phrases: string[];
    rank_terms?: string[];
    phrase_key: string;
    total_shards: number;
    total_documents: number;
    matched_shards: string[];
    matched_shard_count: number;
    matched_shard_bytes: number;
    proved_no_match_shards: number;
    document_encoding?: typeof HOT_QUERY_PROOF_DOCUMENT_ENCODING;
    document_dictionaries?: HotQueryProofDocumentDictionaries;
    documents: HotQueryProofDocument[];
    match_count: number;
}

export interface HotQueryTopCertificate {
    version: typeof HOT_QUERY_TOPK_CERTIFICATE_VERSION;
    document_payload_model: typeof HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL;
    rank_evidence_model?: typeof HOT_QUERY_RANK_EVIDENCE_MODEL;
    query: string;
    normalized_query: string;
    match_phrases: string[];
    rank_terms?: string[];
    phrase_key: string;
    top_k_limit: number;
    top_k_count: number;
    match_count: number;
    total_shards: number;
    total_documents: number;
    matched_shards: string[];
    matched_shard_count: number;
    documents: SitegraphFullDocument[];
}

export interface HotQueryInitialCertificate {
    version: typeof HOT_QUERY_INITIAL_CERTIFICATE_VERSION;
    document_payload_model: typeof HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL;
    rank_evidence_model?: typeof HOT_QUERY_RANK_EVIDENCE_MODEL;
    query: string;
    normalized_query: string;
    match_phrases: string[];
    rank_terms?: string[];
    phrase_key: string;
    initial_limit: number;
    top_k_limit: number;
    top_k_count: number;
    match_count: number;
    total_shards: number;
    total_documents: number;
    matched_shards: string[];
    matched_shard_count: number;
    documents: SitegraphFullDocument[];
}

export interface HotQueryFastStartEntry {
    query: string;
    normalized_query: string;
    alias_of?: string | null;
    phrase_key: string;
    match_count: number;
    initial_certificate: SitegraphArtifact & {
        initial_limit?: number;
        top_k_limit?: number;
        match_count?: number;
    };
}

export interface HotQueryFastStartIndex {
    version: typeof HOT_QUERY_FAST_START_VERSION;
    scope: 'global_unfiltered_queries';
    normalization: string;
    initial_certificate_version: typeof HOT_QUERY_INITIAL_CERTIFICATE_VERSION;
    top_document_payload_model: typeof HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL;
    rank_evidence_model?: typeof HOT_QUERY_RANK_EVIDENCE_MODEL;
    query_count?: number;
    queries: Record<string, HotQueryFastStartEntry>;
}

export type HotQueryRankedDocumentPayload = SitegraphFullDocument & {
    rank_base_score?: unknown;
};

export interface HotQueryProofEntryMatch {
    entry: HotQueryProofDirectoryEntry;
    matchedQuery: string;
    matchKind: 'exact' | 'normalized_command';
}

export interface HotQueryFastStartEntryMatch {
    entry: HotQueryFastStartEntry;
    matchedQuery: string;
    matchKind: 'exact' | 'normalized_command';
}

const parseProofDictionary = (payload: unknown, source: string): HotQueryProofDocumentDictionaries => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new SearchContractError(`Validation failed for ${source}: proof dictionaries must be an object`);
    }
    const record = payload as Record<string, unknown>;
    const read = (key: keyof HotQueryProofDocumentDictionaries): string[] => {
        const value = record[key];
        if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
            throw new SearchContractError(`Validation failed for ${source}.${key}: proof dictionary must be a string array`);
        }
        return value as string[];
    };
    return {
        source_ids: read('source_ids'),
        facets: read('facets'),
        record_types: read('record_types'),
        shards: read('shards'),
        fields: read('fields'),
        phrases: read('phrases'),
        dates: read('dates'),
        date_kinds: read('date_kinds'),
        date_confidences: read('date_confidences'),
    };
};

const lookupProofString = (dictionary: string[], index: unknown, source: string): string => {
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= dictionary.length) {
        throw new SearchContractError(`Validation failed for ${source}: invalid proof dictionary index`);
    }
    return dictionary[index] ?? '';
};

const lookupOptionalProofString = (dictionary: string[], index: unknown, source: string): string | undefined => {
    if (index === undefined || index === null || index === -1) return undefined;
    return lookupProofString(dictionary, index, source);
};

const lookupProofStringList = (dictionary: string[], indexes: unknown, source: string): string[] => {
    if (!Array.isArray(indexes)) {
        throw new SearchContractError(`Validation failed for ${source}: proof dictionary index list must be an array`);
    }
    return indexes.map((index, itemIndex) => lookupProofString(dictionary, index, `${source}.${itemIndex}`));
};

const parseCompactHotQueryProofDocument = (
    row: unknown[],
    dictionaries: HotQueryProofDocumentDictionaries,
    source: string
): HotQueryProofDocument => {
    if (row.length < 8) {
        throw new SearchContractError(`Validation failed for ${source}: compact proof document row is too short`);
    }
    const [docIndex, sourceIndex, facetIndex, recordTypeIndex, shardIndex, rankBaseScore, fieldIndexes, phraseIndexes] = row;
    if (
        typeof docIndex !== 'number'
        || !Number.isFinite(docIndex)
        || typeof rankBaseScore !== 'number'
        || !Number.isFinite(rankBaseScore)
    ) {
        throw new SearchContractError(`Validation failed for ${source}: invalid compact proof document scalar`);
    }
    const fields = lookupProofStringList(dictionaries.fields, fieldIndexes, `${source}.fields`);
    const phrases = lookupProofStringList(dictionaries.phrases, phraseIndexes, `${source}.phrases`);
    if (phrases.length === 0) {
        throw new SearchContractError(`Validation failed for ${source}: compact proof document must have phrases`);
    }
    const document: HotQueryProofDocument = {
        doc_index: docIndex,
        id: String(docIndex),
        source_id: lookupProofString(dictionaries.source_ids, sourceIndex, `${source}.source_id`),
        facet: lookupProofString(dictionaries.facets, facetIndex, `${source}.facet`),
        record_type: lookupProofString(dictionaries.record_types, recordTypeIndex, `${source}.record_type`),
        shard_id: lookupProofString(dictionaries.shards, shardIndex, `${source}.shard_id`),
        rank_base_score: rankBaseScore,
        match_evidence: {
            fields,
            phrases,
        },
    };
    const publishedAt = lookupOptionalProofString(dictionaries.dates, row[8], `${source}.published_at`);
    const updatedAt = lookupOptionalProofString(dictionaries.dates, row[9], `${source}.updated_at`);
    const recordedAt = lookupOptionalProofString(dictionaries.dates, row[10], `${source}.recorded_at`);
    const versionDate = lookupOptionalProofString(dictionaries.dates, row[11], `${source}.version_date`);
    const dateKind = lookupOptionalProofString(dictionaries.date_kinds, row[12], `${source}.date_kind`);
    const dateConfidence = lookupOptionalProofString(dictionaries.date_confidences, row[13], `${source}.date_confidence`);
    if (publishedAt !== undefined) document.published_at = publishedAt;
    if (updatedAt !== undefined) document.updated_at = updatedAt;
    if (recordedAt !== undefined) document.recorded_at = recordedAt;
    if (versionDate !== undefined) document.version_date = versionDate;
    if (dateKind !== undefined) document.date_kind = dateKind;
    if (dateConfidence !== undefined) document.date_confidence = dateConfidence;
    return document;
};

export const parseHotQueryProofDocuments = (
    payload: unknown,
    source: string,
    dictionariesPayload?: unknown
): HotQueryProofDocument[] => {
    if (!Array.isArray(payload)) {
        throw new SearchContractError(`Validation failed for ${source}: hot query proof documents must be an array`);
    }
    const dictionaries = dictionariesPayload === undefined ? null : parseProofDictionary(dictionariesPayload, `${source}.document_dictionaries`);
    return payload.map((document, index) => {
        if (Array.isArray(document)) {
            if (!dictionaries) {
                throw new SearchContractError(`Validation failed for ${source}: compact proof documents require dictionaries`);
            }
            return parseCompactHotQueryProofDocument(document, dictionaries, `${source}.${index}`);
        }
        const item = document as Partial<HotQueryProofDocument>;
        if (
            typeof item.doc_index !== 'number'
            || !Number.isFinite(item.doc_index)
            || typeof item.source_id !== 'string'
            || typeof item.facet !== 'string'
            || typeof item.record_type !== 'string'
            || typeof item.shard_id !== 'string'
            || typeof item.rank_base_score !== 'number'
            || !Number.isFinite(item.rank_base_score)
            || !item.match_evidence
            || !Array.isArray(item.match_evidence.fields)
            || !Array.isArray(item.match_evidence.phrases)
            || item.match_evidence.phrases.length === 0
        ) {
            throw new SearchContractError(`Validation failed for ${source}: invalid hot query proof document at ${index}`);
        }
        return item as HotQueryProofDocument;
    });
};

const HOT_QUERY_COMMAND_PREFIXES = hotQueryNormalization.command_prefixes;
const HOT_QUERY_COMMAND_SUFFIXES = hotQueryNormalization.command_suffixes;

export const hotQueryPhraseKey = (matchPhrases: string[]): string => matchPhrases
    .slice()
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .join('\u0000');

const hotQueryIntentCandidates = (normalizedQuery: string): string[] => {
    const candidates: string[] = [];
    const seen = new Set<string>();
    const queue = [normalizedQuery];
    while (queue.length > 0 && seen.size < 48) {
        const value = queue.shift();
        if (!value || value.length < 2 || seen.has(value)) continue;
        seen.add(value);
        candidates.push(value);
        for (const prefix of HOT_QUERY_COMMAND_PREFIXES) {
            if (value.startsWith(prefix) && value.length > prefix.length + 1) {
                queue.push(value.slice(prefix.length));
            }
        }
        for (const suffix of HOT_QUERY_COMMAND_SUFFIXES) {
            if (value.endsWith(suffix) && value.length > suffix.length + 1) {
                queue.push(value.slice(0, -suffix.length));
            }
        }
    }
    return candidates;
};

const entryForNormalizedKey = (
    directory: HotQueryProofDirectory,
    normalizedKey: string
): HotQueryProofDirectoryEntry | undefined => {
    const direct = directory.queries[normalizedKey];
    if (direct) return direct;
    return Object.values(directory.queries).find(entry => normalize(entry.query) === normalizedKey);
};

const fastStartEntryForNormalizedKey = (
    fastStart: HotQueryFastStartIndex,
    normalizedKey: string
): HotQueryFastStartEntry | undefined => {
    const direct = fastStart.queries[normalizedKey];
    if (direct) return direct;
    return Object.values(fastStart.queries).find(entry => normalize(entry.query) === normalizedKey);
};

export const resolveHotQueryProofEntry = (
    directory: HotQueryProofDirectory,
    normalizedQuery: string
): HotQueryProofEntryMatch | null => {
    const normalized = normalize(normalizedQuery);
    if (!normalized) return null;
    const candidates = hotQueryIntentCandidates(normalized);
    for (const [index, candidate] of candidates.entries()) {
        const entry = entryForNormalizedKey(directory, candidate);
        if (entry) {
            return {
                entry,
                matchedQuery: candidate,
                matchKind: index === 0 ? 'exact' : 'normalized_command',
            };
        }
    }
    return null;
};

export const resolveHotQueryFastStartEntry = (
    fastStart: HotQueryFastStartIndex,
    normalizedQuery: string
): HotQueryFastStartEntryMatch | null => {
    const normalized = normalize(normalizedQuery);
    if (!normalized) return null;
    const candidates = hotQueryIntentCandidates(normalized);
    for (const [index, candidate] of candidates.entries()) {
        const entry = fastStartEntryForNormalizedKey(fastStart, candidate);
        if (entry) {
            return {
                entry,
                matchedQuery: candidate,
                matchKind: index === 0 ? 'exact' : 'normalized_command',
            };
        }
    }
    return null;
};

const asRecord = (payload: unknown, source: string): Record<string, unknown> => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new SearchContractError(`Validation failed for ${source}: payload must be an object`);
    }
    return payload as Record<string, unknown>;
};

const validateHotQueryArtifact = (payload: unknown, source: string): SitegraphArtifact => {
    const record = asRecord(payload, source);
    if (
        typeof record.path !== 'string'
        || typeof record.sha256 !== 'string'
        || typeof record.bytes !== 'number'
        || !Number.isFinite(record.bytes)
        || typeof record.role !== 'string'
    ) {
        throw new SearchContractError(`Validation failed for ${source}: invalid artifact reference`);
    }
    if (record.role !== 'hot_query_top_initial') {
        throw new SearchContractError(`Validation failed for ${source}: initial certificate role must be hot_query_top_initial`);
    }
    return record as unknown as SitegraphArtifact;
};

export const parseHotQueryFastStartIndex = (payload: unknown, source: string): HotQueryFastStartIndex => {
    const record = asRecord(payload, source);
    if (record.version !== HOT_QUERY_FAST_START_VERSION) {
        throw new SearchContractError(`Validation failed for ${source}: unexpected fast-start version`);
    }
    if (record.scope !== 'global_unfiltered_queries') {
        throw new SearchContractError(`Validation failed for ${source}: fast-start scope must be global_unfiltered_queries`);
    }
    if (record.initial_certificate_version !== HOT_QUERY_INITIAL_CERTIFICATE_VERSION) {
        throw new SearchContractError(`Validation failed for ${source}: unexpected initial certificate version`);
    }
    if (record.top_document_payload_model !== HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL) {
        throw new SearchContractError(`Validation failed for ${source}: unexpected top document payload model`);
    }
    const rawQueries = asRecord(record.queries, `${source}.queries`);
    const queries: Record<string, HotQueryFastStartEntry> = {};
    for (const [key, rawEntry] of Object.entries(rawQueries)) {
        const entry = asRecord(rawEntry, `${source}.queries.${key}`);
        if (
            typeof entry.query !== 'string'
            || typeof entry.normalized_query !== 'string'
            || typeof entry.phrase_key !== 'string'
            || typeof entry.match_count !== 'number'
            || !Number.isFinite(entry.match_count)
        ) {
            throw new SearchContractError(`Validation failed for ${source}.queries.${key}: invalid fast-start entry`);
        }
        const initialCertificate = validateHotQueryArtifact(entry.initial_certificate, `${source}.queries.${key}.initial_certificate`);
        queries[key] = {
            ...entry,
            initial_certificate: initialCertificate,
        } as HotQueryFastStartEntry;
    }
    return {
        ...(record as unknown as HotQueryFastStartIndex),
        queries,
    };
};

export const parseHotQueryInitialCertificate = (payload: unknown, source: string): HotQueryInitialCertificate => {
    const record = asRecord(payload, source);
    if (record.version !== HOT_QUERY_INITIAL_CERTIFICATE_VERSION) {
        throw new SearchContractError(`Validation failed for ${source}: unexpected initial certificate version`);
    }
    if (record.document_payload_model !== HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL) {
        throw new SearchContractError(`Validation failed for ${source}: unexpected initial document payload model`);
    }
    if (
        typeof record.query !== 'string'
        || typeof record.normalized_query !== 'string'
        || typeof record.phrase_key !== 'string'
        || typeof record.initial_limit !== 'number'
        || !Number.isFinite(record.initial_limit)
        || typeof record.top_k_count !== 'number'
        || !Number.isFinite(record.top_k_count)
        || typeof record.match_count !== 'number'
        || !Number.isFinite(record.match_count)
        || typeof record.total_shards !== 'number'
        || !Number.isFinite(record.total_shards)
        || typeof record.total_documents !== 'number'
        || !Number.isFinite(record.total_documents)
        || typeof record.matched_shard_count !== 'number'
        || !Number.isFinite(record.matched_shard_count)
        || !Array.isArray(record.match_phrases)
        || !Array.isArray(record.matched_shards)
    ) {
        throw new SearchContractError(`Validation failed for ${source}: invalid initial certificate`);
    }
    const documents = parseSitegraphFullDocuments(record.documents, `${source}.documents`);
    return {
        ...(record as unknown as HotQueryInitialCertificate),
        documents,
    };
};
