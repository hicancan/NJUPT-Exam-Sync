import type {
    SitegraphArtifactCacheStats,
    SitegraphFullDocument,
    SitegraphFullShard,
    SitegraphLocalIndexRef,
    SitegraphProofCatalog,
    SitegraphProofCatalogShard,
    SitegraphSourceManifest,
    SourceRegistryEntry
} from '@njupt-search/contracts/search-index';
import type { ArtifactContentCache } from './fetchJson';
import { parseSitegraphFullDocuments, parseSitegraphLocalIndexRefs, parseSitegraphProofCatalog, parseSitegraphSourceManifest, SearchContractError } from './sitegraphContract';
import { parseShardFilterPartEntries, parseShardFilterPartsManifest, type ShardFilterMap } from './sitegraphShardFilter';
import type { RoutedSessionWithArtifactCache, VerificationShard } from './sitegraphSearchTypes';
import { proofCatalogCache, shardCache, shardFilterCache, sourceManifestCache } from './sitegraphRuntimeCaches';
import { fetchJsonArtifactPayload, recordArtifactCache } from './sitegraphRuntimeFetch';
import { sourceEntriesById } from './sitegraphQueryPlanning';

const asRecord = (value: unknown, source: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new SearchContractError(`${source} must be an object`);
    }
    return value as Record<string, unknown>;
};

const expandChunkedLocalIndexes = async (
    payload: unknown,
    source: string,
    signal: AbortSignal,
    cacheStats?: SitegraphArtifactCacheStats,
    artifactCache?: ArtifactContentCache
): Promise<unknown> => {
    const record = asRecord(payload, source);
    if (Array.isArray(record.local_indexes) && record.local_indexes.length > 0) return payload;
    const artifacts = asRecord(record.artifacts, `${source}.artifacts`);
    const localIndexArtifact = artifacts.local_indexes;
    if (!localIndexArtifact || typeof localIndexArtifact !== 'object' || Array.isArray(localIndexArtifact)) return payload;
    const artifact = localIndexArtifact as { path?: string; bytes?: number };
    if (!artifact.path) {
        throw new SearchContractError(`${source}.artifacts.local_indexes.path is missing`);
    }
    const manifest = asRecord(
        await fetchJsonArtifactPayload(
            artifact.path,
            signal,
            'index',
            cacheStats,
            Number(artifact.bytes || 0),
            artifactCache
        ),
        `${source}.artifacts.local_indexes`
    );
    if (manifest.version !== 'sitegraph-local-index-parts-v1') {
        throw new SearchContractError(`${source}.artifacts.local_indexes has invalid version`);
    }
    if (manifest.source_id !== record.source_id) {
        throw new SearchContractError(`${source}.artifacts.local_indexes source_id mismatch`);
    }
    const parts = manifest.parts;
    if (!Array.isArray(parts)) {
        throw new SearchContractError(`${source}.artifacts.local_indexes.parts must be an array`);
    }
    const refs: SitegraphLocalIndexRef[] = [];
    for (const part of parts) {
        const partRecord = asRecord(part, `${source}.artifacts.local_indexes.part`);
        const partPath = String(partRecord.path || '');
        if (!partPath) throw new SearchContractError(`${source}.artifacts.local_indexes part path is missing`);
        const partPayload = asRecord(
            await fetchJsonArtifactPayload(
                partPath,
                signal,
                'index',
                cacheStats,
                Number(partRecord.bytes || 0),
                artifactCache
            ),
            `${source}.artifacts.local_indexes part ${partPath}`
        );
        if (partPayload.version !== 'sitegraph-local-index-part-v1') {
            throw new SearchContractError(`${source}.artifacts.local_indexes part has invalid version: ${partPath}`);
        }
        if (partPayload.source_id !== record.source_id) {
            throw new SearchContractError(`${source}.artifacts.local_indexes part source_id mismatch: ${partPath}`);
        }
        if (!Array.isArray(partPayload.records)) {
            throw new SearchContractError(`${source}.artifacts.local_indexes part records must be an array: ${partPath}`);
        }
        refs.push(...parseSitegraphLocalIndexRefs(partPayload.records, `${source}.artifacts.local_indexes part ${partPath}`));
    }
    if (refs.length !== Number(manifest.record_count || -1)) {
        throw new SearchContractError(`${source}.artifacts.local_indexes record_count mismatch`);
    }
    return {
        ...record,
        local_indexes: refs,
    };
};

export const loadSourceManifest = async (
    entry: SourceRegistryEntry,
    signal: AbortSignal,
    cacheStats?: SitegraphArtifactCacheStats,
    artifactCache?: ArtifactContentCache
): Promise<SitegraphSourceManifest> => {
    const path = entry.artifact_manifest.path;
    const existing = sourceManifestCache.get(path);
    if (existing) {
        recordArtifactCache(cacheStats, true, entry.artifact_manifest.bytes, 'memory');
        return existing;
    }
    const payload = await fetchJsonArtifactPayload(
        path,
        signal,
        'index',
        cacheStats,
        entry.artifact_manifest.bytes,
        artifactCache
    );
    const expandedPayload = await expandChunkedLocalIndexes(payload, path, signal, cacheStats, artifactCache);
    const parsed = parseSitegraphSourceManifest(expandedPayload, path);
    sourceManifestCache.set(path, parsed);
    return parsed;
};

export const loadProofCatalog = async (
    sourceManifest: SitegraphSourceManifest,
    signal: AbortSignal,
    cacheStats?: SitegraphArtifactCacheStats,
    artifactCache?: ArtifactContentCache
): Promise<SitegraphProofCatalog> => {
    const artifact = sourceManifest.artifacts.proof_catalog;
    if (!artifact) {
        throw new SearchContractError(`Source manifest ${sourceManifest.source_id} is missing proof_catalog`);
    }
    const path = artifact.path;
    const existing = proofCatalogCache.get(path);
    if (existing) {
        recordArtifactCache(cacheStats, true, artifact.bytes, 'memory');
        return existing;
    }
    const payload = await fetchJsonArtifactPayload(path, signal, 'index', cacheStats, artifact.bytes, artifactCache);
    const expandedPayload = await expandChunkedProofCatalog(payload, path, sourceManifest.source_id, signal, cacheStats, artifactCache);
    const parsed = parseSitegraphProofCatalog(expandedPayload, path);
    if (parsed.source_id !== sourceManifest.source_id) {
        throw new SearchContractError(`Validation failed for ${path}: proof catalog source_id does not match ${sourceManifest.source_id}`);
    }
    proofCatalogCache.set(path, parsed);
    return parsed;
};

const expandChunkedProofCatalog = async (
    payload: unknown,
    source: string,
    sourceId: string,
    signal: AbortSignal,
    cacheStats?: SitegraphArtifactCacheStats,
    artifactCache?: ArtifactContentCache
): Promise<unknown> => {
    const record = asRecord(payload, source);
    if (record.version !== 'sitegraph-proof-ledger-catalog-parts-v1') return payload;
    if (record.source_id !== sourceId) {
        throw new SearchContractError(`${source} source_id mismatch`);
    }
    const parts = record.parts;
    if (!Array.isArray(parts)) {
        throw new SearchContractError(`${source}.parts must be an array`);
    }
    const shards: unknown[] = [];
    for (const part of parts) {
        const partRecord = asRecord(part, `${source}.part`);
        const partPath = String(partRecord.path || '');
        if (!partPath) throw new SearchContractError(`${source} proof_catalog part path is missing`);
        const partPayload = asRecord(
            await fetchJsonArtifactPayload(
                partPath,
                signal,
                'index',
                cacheStats,
                Number(partRecord.bytes || 0),
                artifactCache
            ),
            `${source} proof_catalog part ${partPath}`
        );
        if (partPayload.version !== 'sitegraph-proof-ledger-catalog-part-v1') {
            throw new SearchContractError(`${source} proof_catalog part has invalid version: ${partPath}`);
        }
        if (partPayload.source_id !== sourceId) {
            throw new SearchContractError(`${source} proof_catalog part source_id mismatch: ${partPath}`);
        }
        if (!Array.isArray(partPayload.shards)) {
            throw new SearchContractError(`${source} proof_catalog part shards must be an array: ${partPath}`);
        }
        shards.push(...partPayload.shards);
    }
    if (shards.length !== Number(record.shard_count || -1)) {
        throw new SearchContractError(`${source} proof_catalog shard_count mismatch`);
    }
    return {
        version: record.catalog_version,
        source_id: record.source_id,
        state_model: record.state_model,
        complete_requires_no_states: record.complete_requires_no_states,
        covered_fields: record.covered_fields,
        shards,
    };
};


export const loadVerificationShardsForScope = async (
    session: RoutedSessionWithArtifactCache,
    sourceIds: string[],
    signal: AbortSignal,
    cacheStats: SitegraphArtifactCacheStats
): Promise<{ shards: VerificationShard[]; verificationBytes: number }> => {
    const entries = sourceEntriesById(session);
    const shards: VerificationShard[] = [];
    let verificationBytes = 0;
    for (const sourceId of sourceIds) {
        const entry = entries.get(sourceId);
        if (!entry) continue;
        const sourceManifest = await loadSourceManifest(entry, signal, cacheStats, session.artifactCache);
        verificationBytes += entry.artifact_manifest.bytes;
        if (sourceManifest.full_shards.length > 0) {
            shards.push(...sourceManifest.full_shards.map(verificationShardFromFullShard));
            continue;
        }
        const proofCatalog = await loadProofCatalog(sourceManifest, signal, cacheStats, session.artifactCache);
        verificationBytes += sourceManifest.artifacts.proof_catalog?.bytes || 0;
        shards.push(...proofCatalog.shards.map(verificationShardFromProofCatalog));
    }
    return { shards, verificationBytes };
};

export const verificationShardFromFullShard = (shard: SitegraphFullShard): VerificationShard => ({
    shard_id: shard.shard_id,
    source_id: String(shard.source_id || ''),
    path: shard.path,
    sha256: shard.sha256,
    bytes: shard.bytes,
    count: shard.count,
    facet_range: shard.facet_range,
    record_type_range: shard.record_type_range,
    section_range: shard.section_range,
    year_range: shard.year_range,
    hash_bucket: shard.hash_bucket,
    filter_token_count: Number(shard.filter_token_count || 0),
    filter_sha256: String(shard.filter_sha256 || ''),
});

export const verificationShardFromProofCatalog = (shard: SitegraphProofCatalogShard): VerificationShard => ({
    shard_id: shard.shard_id,
    source_id: shard.source_id,
    path: shard.path,
    sha256: shard.sha256,
    bytes: shard.bytes,
    count: shard.document_count,
    facet_range: shard.scope.facets,
    record_type_range: shard.scope.record_types,
    section_range: shard.scope.sections,
    year_range: shard.scope.years,
    hash_bucket: shard.scope.hash_bucket,
    filter_token_count: shard.filter_contract.filter_token_count,
    filter_sha256: shard.filter_contract.filter_sha256,
});

export const loadShardFilter = async (
    sourceManifest: SitegraphSourceManifest,
    signal: AbortSignal,
    cacheStats?: SitegraphArtifactCacheStats,
    artifactCache?: ArtifactContentCache
): Promise<ShardFilterMap> => {
    const artifact = sourceManifest.artifacts.shard_filter;
    if (!artifact) {
        throw new SearchContractError(`Source manifest ${sourceManifest.source_id} is missing shard_filter`);
    }
    const path = artifact.path;
    const existing = shardFilterCache.get(path);
    if (existing) {
        recordArtifactCache(cacheStats, true, artifact.bytes, 'memory');
        return existing;
    }
    const payload = await fetchJsonArtifactPayload(path, signal, 'index', cacheStats, artifact.bytes, artifactCache);
    const partsManifest = parseShardFilterPartsManifest(payload, path);
    if (partsManifest) {
        const merged: ShardFilterMap = {};
        for (const part of partsManifest.parts) {
            if (!part?.path || typeof part.bytes !== 'number') {
                throw new SearchContractError(`Validation failed for ${path}: invalid shard_filter part reference`);
            }
            const partPayload = await fetchJsonArtifactPayload(part.path, signal, 'index', cacheStats, part.bytes, artifactCache);
            Object.assign(merged, parseShardFilterPartEntries(partPayload, part.path));
        }
        if (Object.keys(merged).length !== partsManifest.entry_count) {
            throw new SearchContractError(`Validation failed for ${path}: shard_filter part count mismatch`);
        }
        shardFilterCache.set(path, merged);
        return merged;
    }
    shardFilterCache.set(path, payload as ShardFilterMap);
    return payload as ShardFilterMap;
};

export const loadShard = (
    path: string,
    signal: AbortSignal,
    cacheStats?: SitegraphArtifactCacheStats,
    bytes = 0,
    artifactCache?: ArtifactContentCache
): Promise<SitegraphFullDocument[]> => {
    const existing = shardCache.get(path);
    if (existing) {
        recordArtifactCache(cacheStats, true, bytes, 'memory');
        return Promise.resolve(existing);
    }
    return fetchJsonArtifactPayload(path, signal, 'shard', cacheStats, bytes, artifactCache)
        .then(payload => {
            const documents = parseSitegraphFullDocuments(payload, path);
            shardCache.set(path, documents);
            return documents;
        });
};
