import type {
    RankedSitegraphDocument,
    SitegraphArtifactCacheStats,
    SitegraphQueryClass,
    SitegraphServingPath,
    SitegraphQueryStats,
    SitegraphSearchCoverage,
    SitegraphSearchFilters,
} from '@/shared/lib/contracts';
import {
    isDegenerateSitegraphQuery,
    isHighDocumentFrequencyNormalizedQuery,
    normalizeSearchText,
} from '@njupt-search/search-core';

type SearchTelemetryEvent = {
    type?: string;
    results?: RankedSitegraphDocument[];
    stats?: SitegraphQueryStats;
};

type FastStartMatch = {
    entry: {
        normalized_query: string;
        query: string;
    };
    matchedQuery: string;
    matchKind: string;
};

const isAllFilter = (value: unknown): boolean => value === undefined || value === null || value === '' || value === 'all';

const emptyProofLedger = () => ({
    total_shards: 0,
    pending_shards: 0,
    scanned_shards: 0,
    proved_no_match_shards: 0,
    excluded_by_filter_shards: 0,
    excluded_by_declared_scope_shards: 0,
    failed_shards: 0,
    complete: true,
});

export const isFilteredSearch = (filters: SitegraphSearchFilters): boolean => {
    return !isAllFilter(filters.sourceId) || !isAllFilter(filters.facet) || !isAllFilter(filters.dateRange);
};

export const isDegenerateQuery = (queryText: string): boolean => {
    return isDegenerateSitegraphQuery(queryText);
};

export const classifyFastStartQuery = (queryText: string, match: FastStartMatch): SitegraphQueryClass => {
    const normalizedInput = normalizeSearchText(queryText);
    const normalizedCanonical = normalizeSearchText(match.entry.normalized_query || match.entry.query || match.matchedQuery);
    if (isHighDocumentFrequencyNormalizedQuery(normalizedInput)) return 'cold_high_df';
    return normalizedInput === normalizedCanonical && match.matchKind === 'exact' ? 'hot' : 'hot_alias';
};

export const servingPathForQueryClass = (queryClass: SitegraphQueryClass): SitegraphServingPath => {
    if (queryClass === 'degenerate') return 'noop';
    if (queryClass === 'hot' || queryClass === 'hot_alias') return 'hot_certificate';
    if (queryClass === 'cold_high_df') return 'high_df_certificate';
    return 'dynamic_retrieval';
};

export const inferHotProofEvent = (event: SearchTelemetryEvent): boolean => {
    const stats = event.stats;
    return Boolean(
        event.results?.length
        && stats
        && stats.loadedLocalIndexCount === 0
        && stats.loadedShardCount === 0
        && stats.localIndexBytes === 0
        && stats.hydratedShardBytes === 0
        && stats.resultCount > 0
        && stats.plan.phase_local_index_ids
        && stats.plan.phase_local_index_ids.first_trusted_results.length === 0
        && stats.plan.phase_local_index_ids.top_results_hydrated.length === 0
    );
};

export const inferCertificateServingPath = (
    queryClass: SitegraphQueryClass,
    event: SearchTelemetryEvent
): SitegraphServingPath => {
    if (queryClass === 'degenerate') return 'noop';
    if (inferHotProofEvent(event)) {
        return queryClass === 'cold_high_df' ? 'high_df_certificate' : 'hot_certificate';
    }
    return 'dynamic_retrieval';
};

export const classifyDynamicQuery = (
    queryText: string,
    filters: SitegraphSearchFilters,
    event: SearchTelemetryEvent
): SitegraphQueryClass => {
    if (!isAllFilter(filters.dateRange)) return 'time_filtered';
    if (isFilteredSearch(filters)) return 'filtered';
    if (inferHotProofEvent(event)) return 'hot';
    const normalized = normalizeSearchText(queryText);
    if (isHighDocumentFrequencyNormalizedQuery(normalized)) return 'cold_high_df';
    if (
        event.stats?.exhaustiveComplete
        && event.stats.resultCount === 0
        && (
            event.type === 'scoped_exhaustive_complete'
            || event.type === 'global_exhaustive_complete'
        )
    ) {
        return 'miss';
    }
    return 'cold_rare';
};

export const makeDegenerateCoverage = (
    cacheScope: SitegraphArtifactCacheStats['scope']
): SitegraphSearchCoverage => {
    const cache: SitegraphArtifactCacheStats = {
        scope: cacheScope,
        artifact_hits: 0,
        artifact_misses: 0,
        cached_bytes: 0,
        uncached_bytes: 0,
        cacheable_bytes: 0,
        memory_hits: 0,
        persistent_hits: 0,
        network_misses: 0,
    };
    return {
        phase: 'global_exhaustive_complete',
        coverage_state: 'global_exhaustive_complete',
        scope: 'global',
        searched_fields: [],
        proved_no_match_shards: 0,
        scanned_shards: 0,
        excluded_by_filter_shards: 0,
        excluded_by_declared_scope_shards: 0,
        pending_shards: 0,
        failed_shards: 0,
        total_shards: 0,
        searched_documents: 0,
        total_documents: 0,
        loaded_bytes: 0,
        uncached_loaded_bytes: 0,
        cached_artifact_bytes: 0,
        first_screen_bytes: 0,
        local_index_bytes: 0,
        hydrated_shard_bytes: 0,
        used_body_index: false,
        exhaustive_complete: true,
        proof_ledger: emptyProofLedger(),
        cache,
    };
};

export const makeDegenerateStats = (
    queryText: string,
    coverage: SitegraphSearchCoverage
): SitegraphQueryStats => ({
    phase: 'global_exhaustive_complete',
    coverage,
    plan: {
        normalized_query: normalizeSearchText(queryText),
        aliases: [],
        intent: 'degenerate_query_noop',
        authority_sources: [],
        expected_result_types: [],
        source_ids: [],
        local_index_ids: [],
        verification_source_ids: [],
        declared_completion_scope: 'global',
        estimated_cost_bytes: 0,
        estimated_utility_per_kb: 0,
        route_decisions: [],
        selected_local_indexes: [],
        phase_local_index_ids: {
            first_trusted_results: [],
            top_results_hydrated: [],
            proof_complete: [],
        },
    },
    usedBodyIndex: false,
    loadedLocalIndexCount: 0,
    loadedLocalIndexIds: [],
    loadedShardCount: 0,
    loadedShardPaths: [],
    candidateCount: 0,
    exhaustiveComplete: true,
    resultCount: 0,
    localIndexBytes: 0,
    hydratedShardBytes: 0,
    uncachedLoadedBytes: 0,
    cachedArtifactBytes: 0,
    cache: coverage.cache,
    fast_start_used: false,
    query_class: 'degenerate',
    serving_path: 'noop',
    fallbacks: {
        localMetaFallbackDocuments: 0,
        snippetFallbackResults: 0,
        verifiedFullScanMatches: 0,
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
        scoreEntriesReturned: 0,
    },
});
