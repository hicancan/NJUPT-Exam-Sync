import type { SitegraphArtifact } from '@njupt-search/contracts';
import { SearchContractError } from './sitegraphContract';

export type ShardFilterMap = Record<string, {
    bitset_base64: string;
    bit_count: number;
    hash_count: number;
    token_count: number;
    sha256: string;
    hash_algorithm: string;
}>;

export type ShardFilterPartsManifest = {
    version: 'sitegraph-shard-filter-parts-v1';
    source_id: string;
    entry_count: number;
    parts: SitegraphArtifact[];
};

const recordPayload = (payload: unknown, path: string, label: string): Record<string, unknown> => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new SearchContractError(`Validation failed for ${path}: ${label} must be an object`);
    }
    return payload as Record<string, unknown>;
};

export const parseShardFilterPartsManifest = (payload: unknown, path: string): ShardFilterPartsManifest | null => {
    const record = recordPayload(payload, path, 'shard_filter');
    if (record.version !== 'sitegraph-shard-filter-parts-v1') return null;
    if (!Array.isArray(record.parts) || typeof record.entry_count !== 'number') {
        throw new SearchContractError(`Validation failed for ${path}: invalid shard_filter parts manifest`);
    }
    return record as ShardFilterPartsManifest;
};

export const parseShardFilterPartEntries = (payload: unknown, path: string): ShardFilterMap => {
    const record = recordPayload(payload, path, 'shard_filter part');
    const entries = record.entries;
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
        throw new SearchContractError(`Validation failed for ${path}: shard_filter part entries must be an object`);
    }
    return entries as ShardFilterMap;
};
