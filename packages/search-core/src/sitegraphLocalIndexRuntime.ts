import type {
    SitegraphArtifactCacheStats,
    SitegraphImpactIndex,
    SitegraphLocalIndexRef,
    SitegraphLocalLightIndex,
    SitegraphQueryPlan,
    SitegraphSearchFilters,
    SitegraphSourceManifest
} from '@njupt-search/contracts';
import type { ArtifactContentCache } from './fetchJson';
import { decodePackedImpactIndexTerms, decodePackedLocalBodyIndexTerms } from './sitegraphBinaryIndex';
import { parseSitegraphLocalBodyIndex, parseSitegraphLocalLightIndex, SearchContractError } from './sitegraphContract';
import type { LoadedLocalBodyRuntimeIndex, LoadedLocalLightRuntimeIndex, LoadedPlanningScope, PackedImpactRetriever, RoutedSessionWithArtifactCache } from './sitegraphSearchTypes';
import { localBodyIndexCache, localBodyPackedBytesCache, localLightIndexCache, localLightMetaCache, localLightPackedBytesCache } from './sitegraphRuntimeCaches';
import { artifactPersistentCached, fetchArrayBufferArtifactPayload, fetchJsonArtifactPayload, recordArtifactCache } from './sitegraphRuntimeFetch';
import { loadSourceManifest } from './sitegraphArtifactLoaders';
import { bodyIndexArtifact, bodyIndexCachedBytes, lightIndexArtifactKey, lightIndexCachedBytes, lightIndexRuntimeBytes, localShardRefsFor, queryTermCacheKey, scopeMatchesFilters, sourceEntriesById } from './sitegraphQueryPlanning';

export const loadPlanningScope = async (
    session: RoutedSessionWithArtifactCache,
    plan: SitegraphQueryPlan,
    filters: SitegraphSearchFilters,
    now: number,
    signal: AbortSignal,
    cacheStats: SitegraphArtifactCacheStats
): Promise<LoadedPlanningScope> => {
    const entries = sourceEntriesById(session);
    const artifactCache = session.artifactCache;
    const sourceManifests: SitegraphSourceManifest[] = [];
    let sourceManifestBytes = 0;
    for (const sourceId of plan.source_ids) {
        const entry = entries.get(sourceId);
        if (!entry) continue;
        const manifest = await loadSourceManifest(entry, signal, cacheStats, artifactCache);
        sourceManifests.push(manifest);
        sourceManifestBytes += entry.artifact_manifest.bytes;
    }

    const plannedIndexIds = new Set(plan.local_index_ids);
    const plannedIndexOrder = new Map(plan.local_index_ids.map((indexId, index) => [indexId, index]));
    const routeFacetPriors = new Set(plan.route_decisions.flatMap(route => route.likely_facets));
    const routeSourcePriors = new Set(plan.route_decisions.flatMap(route => route.likely_sources));
    const yearScore = (year: string): number => {
        const numeric = Number(year);
        if (!Number.isFinite(numeric)) return 0.2;
        return Math.max(0.2, Math.min(1.2, (numeric - 2015) / 10));
    };
    const persistedLightBytes = new Map<string, number>();
    const persistedBodyBytes = new Map<string, number>();
    const cachedLightBytesForRef = (ref: SitegraphLocalIndexRef): number => {
        return Math.max(lightIndexCachedBytes(ref), persistedLightBytes.get(ref.index_id) ?? 0);
    };
    const cachedBodyBytesForRef = (ref: SitegraphLocalIndexRef): number => {
        return Math.max(bodyIndexCachedBytes(ref), persistedBodyBytes.get(ref.index_id) ?? 0);
    };
    const cacheStateForRef = (ref: SitegraphLocalIndexRef): 'cold' | 'partial' | 'warm' => {
        const lightCached = cachedLightBytesForRef(ref) === lightIndexRuntimeBytes(ref);
        const bodyCached = cachedBodyBytesForRef(ref) === bodyIndexArtifact(ref).bytes;
        if (lightCached && bodyCached) return 'warm';
        if (lightCached || bodyCached) return 'partial';
        return 'cold';
    };
    const expectedUncachedBytesForRef = (ref: SitegraphLocalIndexRef): number => {
        const lightBytes = Math.max(0, lightIndexRuntimeBytes(ref) - cachedLightBytesForRef(ref));
        const bodyArtifact = bodyIndexArtifact(ref);
        const bodyBytes = Math.max(0, bodyArtifact.bytes - cachedBodyBytesForRef(ref));
        return lightBytes + bodyBytes;
    };
    const utilityForRef = (ref: SitegraphLocalIndexRef): number => {
        const routed = plannedIndexIds.has(ref.index_id) ? 4 : 1;
        const sourcePrior = routeSourcePriors.has(ref.scope.source_id) || plan.authority_sources.includes(ref.scope.source_id) ? 2 : 1;
        const facetPrior = routeFacetPriors.has(ref.scope.facet) ? 1.5 : 1;
        const costKb = Math.max(1, expectedUncachedBytesForRef(ref) / 1024);
        return Number((routed * sourcePrior * facetPrior * yearScore(ref.scope.year) * Math.log2(ref.doc_count + 2) / costKb).toFixed(6));
    };
    let localRefs = sourceManifests
        .flatMap(sourceManifest => sourceManifest.local_indexes)
        .filter(ref => scopeMatchesFilters(ref.scope, filters, now));
    await Promise.all(localRefs.map(async ref => {
        if (!ref.light_index_meta || !ref.light_index_packed) {
            throw new SearchContractError(`Local index ${ref.index_id} is missing split light artifacts`);
        }
        const [metaCached, packedCached] = await Promise.all([
            artifactPersistentCached(artifactCache, ref.light_index_meta.path),
            artifactPersistentCached(artifactCache, ref.light_index_packed.path),
        ]);
        persistedLightBytes.set(
            ref.index_id,
            (metaCached ? ref.light_index_meta.bytes : 0) + (packedCached ? ref.light_index_packed.bytes : 0)
        );
        const bodyArtifact = bodyIndexArtifact(ref);
        if (await artifactPersistentCached(artifactCache, bodyArtifact.path)) {
            persistedBodyBytes.set(ref.index_id, bodyArtifact.bytes);
        }
    }));
    if (plannedIndexIds.size > 0) {
        const routedRefs = localRefs.filter(ref => plannedIndexIds.has(ref.index_id));
        if (routedRefs.length > 0) {
            localRefs = routedRefs
                .sort((a, b) => {
                    const utilityDelta = utilityForRef(b) - utilityForRef(a);
                    if (utilityDelta !== 0) return utilityDelta;
                    const orderDelta = (plannedIndexOrder.get(a.index_id) ?? Number.MAX_SAFE_INTEGER)
                        - (plannedIndexOrder.get(b.index_id) ?? Number.MAX_SAFE_INTEGER);
                    if (orderDelta !== 0) return orderDelta;
                    return b.doc_count - a.doc_count || a.index_id.localeCompare(b.index_id);
                })
                .slice(0, 48);
        }
    }
    if (plannedIndexIds.size === 0 || localRefs.every(ref => !plannedIndexIds.has(ref.index_id))) {
        localRefs = localRefs
            .sort((a, b) => {
                const utilityDelta = utilityForRef(b) - utilityForRef(a);
                if (utilityDelta !== 0) return utilityDelta;
                const yearDelta = Number(b.scope.year) - Number(a.scope.year);
                if (Number.isFinite(yearDelta) && yearDelta !== 0) return yearDelta;
                return b.doc_count - a.doc_count || a.index_id.localeCompare(b.index_id);
            })
            .slice(0, 48);
    }

    const shardPathById = new Map<string, string>();
    const shardBytesByPath = new Map<string, number>();
    for (const ref of localRefs) {
        for (const shard of localShardRefsFor(ref)) {
            if (shard.path) {
                shardPathById.set(shard.shard_id, shard.path);
                shardBytesByPath.set(shard.path, shard.bytes);
            }
        }
    }
    for (const sourceManifest of sourceManifests) {
        for (const shard of sourceManifest.full_shards) {
            shardPathById.set(shard.shard_id, shard.path);
            shardBytesByPath.set(shard.path, shard.bytes);
        }
    }

    return {
        sourceManifests,
        localRefs,
        sourceManifestBytes,
        shardPathById,
        shardBytesByPath,
        selectedLocalIndexes: localRefs.map(ref => ({
            index_id: ref.index_id,
            expected_bytes: lightIndexRuntimeBytes(ref) + bodyIndexArtifact(ref).bytes,
            expected_uncached_bytes: expectedUncachedBytesForRef(ref),
            cache_state: cacheStateForRef(ref),
            utility_score: utilityForRef(ref),
            source_id: ref.scope.source_id,
            facet: ref.scope.facet,
            year: ref.scope.year,
        })),
    };
};

export const loadLocalLightIndex = async (
    ref: SitegraphLocalIndexRef,
    terms: string[],
    signal: AbortSignal,
    cacheStats?: SitegraphArtifactCacheStats,
    artifactCache?: ArtifactContentCache,
    packedImpactRetriever?: PackedImpactRetriever
): Promise<LoadedLocalLightRuntimeIndex> => {
    const path = lightIndexArtifactKey(ref);
    if (!ref.light_index_meta || !ref.light_index_packed) {
        throw new SearchContractError(`Local index ${ref.index_id} is missing split light artifacts`);
    }
    const usePackedRetriever = Boolean(packedImpactRetriever);
    const cacheKey = usePackedRetriever
        ? `${path}\u0000rust_wasm_packed_impact`
        : `${path}\u0000${queryTermCacheKey(terms)}`;
    const bytes = lightIndexRuntimeBytes(ref);
    const existing = !usePackedRetriever ? localLightIndexCache.get(cacheKey) : undefined;
    if (existing) {
        recordArtifactCache(cacheStats, true, bytes, 'memory');
        return { documents: existing.documents, index: existing };
    }
    let metadata = localLightMetaCache.get(ref.light_index_meta.path);
    if (metadata) {
        recordArtifactCache(cacheStats, true, ref.light_index_meta.bytes, 'memory');
    } else {
        metadata = await fetchJsonArtifactPayload<Omit<SitegraphLocalLightIndex, 'terms'>>(
            ref.light_index_meta.path,
            signal,
            'index',
            cacheStats,
            ref.light_index_meta.bytes,
            artifactCache
        );
        localLightMetaCache.set(ref.light_index_meta.path, metadata);
    }
    let packedBytes = localLightPackedBytesCache.get(ref.light_index_packed.path);
    if (packedBytes) {
        recordArtifactCache(cacheStats, true, ref.light_index_packed.bytes, 'memory');
    } else {
        packedBytes = await fetchArrayBufferArtifactPayload(
            ref.light_index_packed.path,
            signal,
            cacheStats,
            ref.light_index_packed.bytes,
            artifactCache
        );
        localLightPackedBytesCache.set(ref.light_index_packed.path, packedBytes);
    }
    const payload = usePackedRetriever
        ? { ...metadata, terms: {} }
        : {
            ...metadata,
            terms: decodePackedImpactIndexTerms<SitegraphImpactIndex>(
                packedBytes,
                terms,
                ref.light_index_packed.path
            ).terms,
        };
    const parsed = parseSitegraphLocalLightIndex(payload, path);
    localLightIndexCache.set(cacheKey, parsed);
    return {
        documents: parsed.documents,
        index: usePackedRetriever ? undefined : parsed,
        packedBytes: usePackedRetriever ? packedBytes : undefined,
        packedPath: usePackedRetriever ? ref.light_index_packed.path : undefined,
    };
};

export const loadLocalBodyIndex = async (
    ref: SitegraphLocalIndexRef,
    terms: string[],
    signal: AbortSignal,
    cacheStats?: SitegraphArtifactCacheStats,
    artifactCache?: ArtifactContentCache,
    packedImpactRetriever?: PackedImpactRetriever
): Promise<LoadedLocalBodyRuntimeIndex> => {
    const artifact = bodyIndexArtifact(ref);
    const path = artifact.path;
    const usePackedRetriever = Boolean(packedImpactRetriever);
    const cacheKey = usePackedRetriever
        ? `${path}\u0000rust_wasm_packed_impact`
        : `${path}\u0000${Array.from(new Set(terms)).sort().join('\u0000')}`;
    const existing = !usePackedRetriever ? localBodyIndexCache.get(cacheKey) : undefined;
    if (existing) {
        recordArtifactCache(cacheStats, true, artifact.bytes, 'memory');
        return { index: existing };
    }
    let buffer = localBodyPackedBytesCache.get(path);
    if (buffer) {
        recordArtifactCache(cacheStats, true, artifact.bytes, 'memory');
    } else {
        buffer = await fetchArrayBufferArtifactPayload(path, signal, cacheStats, artifact.bytes, artifactCache);
        localBodyPackedBytesCache.set(path, buffer);
    }
    if (usePackedRetriever) {
        return { packedBytes: buffer, packedPath: path };
    }
    const payload = decodePackedLocalBodyIndexTerms(buffer, terms, path);
    const parsed = parseSitegraphLocalBodyIndex(payload, path);
    localBodyIndexCache.set(cacheKey, parsed);
    return { index: parsed };
};
