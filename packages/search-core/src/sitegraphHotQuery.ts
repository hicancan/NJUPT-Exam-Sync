import type { SitegraphArtifact, SitegraphFullDocument } from '@njupt-search/contracts';
import hotQueryNormalization from '../../../config/search/hot-query-normalization.json';
import { normalizeSearchText as normalize } from './tokenizer';

export const HOT_QUERY_DIRECTORY_VERSION = 'sitegraph-hot-query-complete-directory-v2';
export const HOT_QUERY_CERTIFICATE_VERSION = 'sitegraph-hot-query-complete-certificate-v2';
export const HOT_QUERY_TOPK_CERTIFICATE_VERSION = 'sitegraph-hot-query-topk-certificate-v1';
export const HOT_QUERY_CERTIFICATE_MODEL = 'rank-display-match-window-certificate-v2';
export const HOT_QUERY_RANK_EVIDENCE_MODEL = 'query-token-field-impact-full-document-v1';

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
    top_certificate?: SitegraphArtifact & {
        top_k_limit?: number;
        match_count?: number;
    };
}

export interface HotQueryProofDirectory {
    version: typeof HOT_QUERY_DIRECTORY_VERSION;
    certificate_model: typeof HOT_QUERY_CERTIFICATE_MODEL;
    rank_evidence_model?: typeof HOT_QUERY_RANK_EVIDENCE_MODEL;
    scope: 'global_unfiltered_queries';
    queries: Record<string, HotQueryProofDirectoryEntry>;
    query_count?: number;
    total_shards: number;
    total_documents: number;
}

export interface HotQueryProofCertificate {
    version: typeof HOT_QUERY_CERTIFICATE_VERSION;
    document_payload_model: typeof HOT_QUERY_CERTIFICATE_MODEL;
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
    documents: SitegraphFullDocument[];
    match_count: number;
}

export interface HotQueryTopCertificate {
    version: typeof HOT_QUERY_TOPK_CERTIFICATE_VERSION;
    document_payload_model: typeof HOT_QUERY_CERTIFICATE_MODEL;
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

export type HotQueryRankedDocumentPayload = SitegraphFullDocument & {
    rank_base_score?: unknown;
};

export interface HotQueryProofEntryMatch {
    entry: HotQueryProofDirectoryEntry;
    matchedQuery: string;
    matchKind: 'exact' | 'normalized_command';
}

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
