import type {
    SitegraphProofLedgerEntry,
    SitegraphProofLedgerState,
    SitegraphProofLedgerSummary,
    SitegraphSearchFilters
} from '@njupt-search/contracts/search-index';
import type { ShardFilterMap } from './sitegraphShardFilter';
import type { VerificationShard } from './sitegraphSearchTypes';
import { FULL_SCAN_FIELDS } from './sitegraphSearchTypes';
import { normalizeSearchText as normalize } from './tokenizer';
import { shardMatchesFilters } from './sitegraphQueryPlanning';

export const filterTokenHashInt = (text: string, seed: number): number => {
    let value = (2166136261 ^ seed) >>> 0;
    const bytes = new TextEncoder().encode(text);
    for (const byte of bytes) {
        value ^= byte;
        value = Math.imul(value, 16777619) >>> 0;
    }
    return value;
};

const decodedFilterCache = new WeakMap<object, Uint8Array>();

export const decodeBase64Bytes = (value: string): Uint8Array => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};

export const decodedFilterBytes = (filter: ShardFilterMap[string]): Uint8Array => {
    const cached = decodedFilterCache.get(filter);
    if (cached) return cached;
    const decoded = decodeBase64Bytes(filter.bitset_base64);
    decodedFilterCache.set(filter, decoded);
    return decoded;
};

export const bloomMayContain = (filter: ShardFilterMap[string], term: string): boolean => {
    const bytes = decodedFilterBytes(filter);
    for (let seed = 0; seed < filter.hash_count; seed += 1) {
        const bit = filterTokenHashInt(term, seed) % filter.bit_count;
        if (((bytes[Math.floor(bit / 8)] ?? 0) & (1 << (bit % 8))) === 0) {
            return false;
        }
    }
    return true;
};

const PROOF_FILTER_NGRAM_MAX = 5;
const PROOF_FILTER_RUN_RE = /[a-z0-9._+\-\u4e00-\u9fff]{2,}/g;

export const shardFilterPhraseTokens = (phrase: string): string[] => {
    const text = normalize(phrase);
    if (text.length < 2) return [];
    const matches = text.match(PROOF_FILTER_RUN_RE) || [];
    if (matches.length !== 1 || matches[0] !== text) return [];
    const tokens = new Set<string>();
    const maxSize = Math.min(PROOF_FILTER_NGRAM_MAX, text.length);
    for (let size = 2; size <= maxSize; size += 1) {
        for (let index = 0; index <= text.length - size; index += 1) {
            tokens.add(text.slice(index, index + size));
        }
    }
    return Array.from(tokens).sort((a, b) => b.length - a.length);
};

export const shardFilterProvesNoMatch = (
    shardId: string,
    shardFilter: ShardFilterMap,
    matchPhrases: string[]
): boolean => {
    const filter = shardFilter[shardId];
    if (!filter || filter.hash_algorithm !== 'bloom-fnv1a32-utf8') return false;
    const phrases = matchPhrases.map(shardFilterPhraseTokens);
    if (phrases.length === 0 || phrases.some(tokens => tokens.length === 0)) return false;
    return phrases.every(tokens => tokens.some(token => !bloomMayContain(filter, token)));
};

export const proofLedgerSummary = (
    entries: SitegraphProofLedgerEntry[] | null,
    fallback: {
        totalShards: number;
        scannedShards: number;
        provedNoMatchShards: number;
        exhaustiveComplete: boolean;
    }
): SitegraphProofLedgerSummary => {
    if (!entries) {
        return {
            total_shards: fallback.totalShards,
            pending_shards: fallback.exhaustiveComplete ? 0 : Math.max(0, fallback.totalShards - fallback.scannedShards - fallback.provedNoMatchShards),
            scanned_shards: fallback.scannedShards,
            proved_no_match_shards: fallback.provedNoMatchShards,
            excluded_by_filter_shards: 0,
            excluded_by_declared_scope_shards: 0,
            failed_shards: 0,
            complete: fallback.exhaustiveComplete,
        };
    }
    const count = (state: SitegraphProofLedgerState): number => entries.filter(entry => entry.state === state).length;
    const pending = count('pending');
    const failed = count('failed');
    return {
        total_shards: entries.length,
        pending_shards: pending,
        scanned_shards: count('scanned'),
        proved_no_match_shards: count('proved_no_match'),
        excluded_by_filter_shards: count('excluded_by_filter'),
        excluded_by_declared_scope_shards: count('excluded_by_declared_scope'),
        failed_shards: failed,
        complete: pending === 0 && failed === 0,
    };
};

export const buildProofLedger = (
    shards: VerificationShard[],
    filters: SitegraphSearchFilters,
    now: number
): SitegraphProofLedgerEntry[] => shards.map(shard => {
    const matches = shardMatchesFilters(shard, filters, now);
    return {
        shard_id: shard.shard_id,
        source_id: String(shard.source_id || ''),
        state: matches ? 'pending' : 'excluded_by_filter',
        document_count: shard.count,
        byte_size: shard.bytes,
        path: shard.path,
        reason: matches ? 'awaiting shard filter proof or scan' : 'excluded by active source/facet/date filter',
        covered_fields: FULL_SCAN_FIELDS,
    };
});

export const setLedgerState = (
    entries: SitegraphProofLedgerEntry[],
    shardId: string,
    state: SitegraphProofLedgerState,
    reason: string
): void => {
    const entry = entries.find(item => item.shard_id === shardId);
    if (entry) {
        entry.state = state;
        entry.reason = reason;
    }
};
