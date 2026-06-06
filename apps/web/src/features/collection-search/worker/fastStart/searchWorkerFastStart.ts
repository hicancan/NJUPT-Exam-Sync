import type {
    RankedSitegraphDocument,
    SitegraphArtifactCacheStats,
    SitegraphQueryClass,
    SitegraphQueryPlan,
    SitegraphQueryStats,
    SitegraphSearchCoverage,
    SitegraphSearchFilters,
    SitegraphSearchManifest,
    SitegraphServingPath,
    SitegraphSortMode,
} from '@/shared/lib/contracts';
import {
    fetchJsonArtifact,
    normalizeSearchText,
    parseHotQueryFastStartIndex,
    parseHotQueryInitialCertificate,
    rankSitegraphDocument,
    resolveHotQueryFastStartEntry,
    sitegraphDocumentMatchesFilters,
    tokenizeSitegraphQuery,
} from '@njupt-search/search-core';
import type {
    ArtifactContentCache,
    ArtifactFetchResult,
    HotQueryInitialCertificate,
} from '@njupt-search/search-core';
import {
    classifyFastStartQuery,
    isDegenerateQuery,
    isFilteredSearch,
    servingPathForQueryClass,
} from '../telemetry/searchWorkerTelemetry';

type LoadManifest = (controller: AbortController) => Promise<SitegraphSearchManifest>;

export type FirstTrustedFastStartEvent = {
    type: 'first_trusted_results';
    requestId: number;
    query: string;
    coverage: SitegraphSearchCoverage;
    results: RankedSitegraphDocument[];
    stats: SitegraphQueryStats;
};

export type FastStartBuildResult =
    | { emitted: false }
    | {
        emitted: true;
        queryClass: SitegraphQueryClass;
        coverage: SitegraphSearchCoverage;
        event: FirstTrustedFastStartEvent;
    };

interface FastStartRequest {
    requestId: number;
    queryText: string;
    limit: number;
    sortMode: SitegraphSortMode;
    filters: SitegraphSearchFilters;
    controller: AbortController;
    loadManifest: LoadManifest;
    artifactCache: ArtifactContentCache;
    publicPath: (path: string) => string;
}

const cacheStatsFrom = (
    results: Array<ArtifactFetchResult<unknown>>,
    artifactCache: ArtifactContentCache
): SitegraphArtifactCacheStats => {
    const cached = results.filter(item => item.cacheHit);
    const uncached = results.filter(item => !item.cacheHit);
    return {
        scope: artifactCache.scope,
        artifact_hits: cached.length,
        artifact_misses: uncached.length,
        cached_bytes: cached.reduce((sum, item) => sum + item.byteLength, 0),
        uncached_bytes: uncached.reduce((sum, item) => sum + item.byteLength, 0),
        cacheable_bytes: results.reduce((sum, item) => sum + item.byteLength, 0),
        memory_hits: 0,
        persistent_hits: cached.length,
        network_misses: uncached.length,
    };
};

const emptyProofLedger = (totalShards: number, scannedShards: number) => ({
    total_shards: totalShards,
    pending_shards: Math.max(0, totalShards - scannedShards),
    scanned_shards: scannedShards,
    proved_no_match_shards: 0,
    excluded_by_filter_shards: 0,
    excluded_by_declared_scope_shards: 0,
    failed_shards: 0,
    complete: false,
});

const hotQueryRankBaseScore = (
    document: RankedSitegraphDocument | HotQueryInitialCertificate['documents'][number]
): number => {
    const value = (document as { rank_base_score?: unknown }).rank_base_score;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Hot query initial document ${document.id} is missing rank_base_score`);
    }
    return value;
};

const canUseFastStart = (
    queryText: string,
    sortMode: SitegraphSortMode
): boolean => {
    return !isDegenerateQuery(queryText)
        && sortMode === 'relevance';
};

const hasDateFilter = (filters: SitegraphSearchFilters): boolean => {
    return Boolean(filters.dateRange && filters.dateRange !== 'all');
};

const classifyFastStartStatsQuery = (
    queryText: string,
    match: ReturnType<typeof resolveHotQueryFastStartEntry>,
    filters: SitegraphSearchFilters
): SitegraphQueryClass => {
    if (hasDateFilter(filters)) return 'time_filtered';
    if (isFilteredSearch(filters)) return 'filtered';
    if (!match) return 'cold_rare_dynamic_holdout';
    return classifyFastStartQuery(queryText, match);
};

const servingPathForFastStart = (
    underlyingQueryClass: SitegraphQueryClass,
    queryClass: SitegraphQueryClass
): SitegraphServingPath => {
    if (queryClass === 'filtered' || queryClass === 'time_filtered') {
        return underlyingQueryClass === 'cold_high_df' ? 'high_df_certificate' : 'hot_certificate';
    }
    return servingPathForQueryClass(queryClass);
};

const makeFastStartPlan = (
    queryText: string,
    certificate: HotQueryInitialCertificate,
    estimatedBytes: number,
    scoped: boolean
): SitegraphQueryPlan => ({
    normalized_query: normalizeSearchText(queryText),
    aliases: certificate.match_phrases,
    intent: 'hot_query_fast_start',
    authority_sources: [],
    expected_result_types: [],
    source_ids: [],
    local_index_ids: [],
    verification_source_ids: [],
    declared_completion_scope: scoped ? 'scoped' : 'global',
    estimated_cost_bytes: estimatedBytes,
    estimated_utility_per_kb: estimatedBytes > 0 ? certificate.top_k_count / (estimatedBytes / 1024) : 0,
    route_decisions: [],
    selected_local_indexes: [],
    phase_local_index_ids: {
        first_trusted_results: [],
        top_results_hydrated: [],
        proof_complete: [],
    },
});

const makeFastStartCoverage = (
    loadedBytes: number,
    cache: SitegraphArtifactCacheStats,
    certificate: HotQueryInitialCertificate,
    resultCount: number,
    scoped: boolean
): SitegraphSearchCoverage => ({
    phase: 'first_trusted_results',
    coverage_state: 'first_trusted_results',
    scope: scoped ? 'scoped' : 'global',
    searched_fields: ['title', 'section', 'nav_path', 'summary', 'content', 'attachments', 'url'],
    proved_no_match_shards: 0,
    scanned_shards: certificate.matched_shard_count,
    excluded_by_filter_shards: 0,
    excluded_by_declared_scope_shards: 0,
    pending_shards: Math.max(0, certificate.total_shards - certificate.matched_shard_count),
    failed_shards: 0,
    total_shards: certificate.total_shards,
    searched_documents: resultCount,
    total_documents: certificate.total_documents,
    loaded_bytes: loadedBytes,
    uncached_loaded_bytes: cache.uncached_bytes,
    cached_artifact_bytes: cache.cached_bytes,
    first_screen_bytes: loadedBytes,
    local_index_bytes: 0,
    hydrated_shard_bytes: 0,
    used_body_index: false,
    exhaustive_complete: false,
    proof_ledger: emptyProofLedger(certificate.total_shards, certificate.matched_shard_count),
    cache,
});

const makeFastStartStats = (
    coverage: SitegraphSearchCoverage,
    plan: SitegraphQueryPlan,
    results: RankedSitegraphDocument[],
    traceId: string,
    queryClass: SitegraphQueryClass,
    servingPath: SitegraphServingPath
): SitegraphQueryStats => ({
    phase: 'first_trusted_results',
    coverage,
    plan,
    usedBodyIndex: false,
    loadedLocalIndexCount: 0,
    loadedLocalIndexIds: [],
    loadedShardCount: 0,
    loadedShardPaths: [],
    candidateCount: results.length,
    exhaustiveComplete: false,
    resultCount: results.length,
    localIndexBytes: 0,
    hydratedShardBytes: 0,
    uncachedLoadedBytes: coverage.uncached_loaded_bytes,
    cachedArtifactBytes: coverage.cached_artifact_bytes,
    cache: coverage.cache,
    fast_start_used: true,
    first_result_source: 'hot_query_initial',
    query_class: queryClass,
    serving_path: servingPath,
    resource_trace_id: traceId,
    fallbacks: {
        localMetaFallbackDocuments: 0,
        snippetFallbackResults: results.filter(result => result.match_snippet?.fallback === true).length,
        verifiedFullScanMatches: results.length,
    },
    retrieval: {
        dynamicPruning: false,
        engine: 'rust_wasm_packed_impact',
        impactBlocksVisited: 0,
        impactBlocksPruned: 0,
        postingsVisited: 0,
        postingsPruned: 0,
        competitiveThreshold: 0,
        wasmCalls: 0,
        typescriptCalls: 0,
        scoreEntriesReturned: results.length,
    },
});

export const tryBuildFastStartEvent = async ({
    requestId,
    queryText,
    limit,
    sortMode,
    filters,
    controller,
    loadManifest,
    artifactCache,
    publicPath,
}: FastStartRequest): Promise<FastStartBuildResult> => {
    if (!canUseFastStart(queryText, sortMode)) return { emitted: false };
    const loadedManifest = await loadManifest(controller);
    const fastStartArtifact = loadedManifest.artifacts.hot_query_fast_start;
    const fastStartPayload = await fetchJsonArtifact(publicPath(fastStartArtifact.path), controller.signal, 'index', artifactCache);
    const fastStart = parseHotQueryFastStartIndex(fastStartPayload.value, fastStartArtifact.path);
    const match = resolveHotQueryFastStartEntry(fastStart, queryText);
    if (!match) return { emitted: false };

    const initialArtifact = match.entry.initial_certificate;
    const initialPayload = await fetchJsonArtifact(publicPath(initialArtifact.path), controller.signal, 'index', artifactCache);
    const certificate = parseHotQueryInitialCertificate(initialPayload.value, initialArtifact.path);
    const terms = certificate.rank_terms?.length ? certificate.rank_terms : tokenizeSitegraphQuery(queryText);
    const scoped = isFilteredSearch(filters);
    const now = Date.now();
    const rankedResults = certificate.documents
        .filter(document => !scoped || sitegraphDocumentMatchesFilters(document, filters, now))
        .map(document => rankSitegraphDocument(document, queryText, terms, hotQueryRankBaseScore(document)))
        .slice(0, limit);
    if (scoped && rankedResults.length === 0) return { emitted: false };
    const cache = cacheStatsFrom([fastStartPayload, initialPayload], artifactCache);
    const loadedBytes = fastStartPayload.byteLength + initialPayload.byteLength;
    const traceId = `${fastStartArtifact.sha256.slice(0, 8)}:${initialArtifact.sha256.slice(0, 8)}:${match.matchedQuery}`;
    const coverage = makeFastStartCoverage(loadedBytes, cache, certificate, rankedResults.length, scoped);
    const plan = makeFastStartPlan(queryText, certificate, loadedBytes, scoped);
    const underlyingQueryClass = classifyFastStartQuery(queryText, match);
    const queryClass = classifyFastStartStatsQuery(queryText, match, filters);
    const servingPath = servingPathForFastStart(underlyingQueryClass, queryClass);
    const stats = makeFastStartStats(coverage, plan, rankedResults, traceId, queryClass, servingPath);
    return {
        emitted: true,
        queryClass,
        coverage,
        event: {
            type: 'first_trusted_results',
            requestId,
            query: queryText.trim(),
            coverage,
            results: rankedResults.map(result => ({ ...result, query_stats: stats })),
            stats,
        },
    };
};
