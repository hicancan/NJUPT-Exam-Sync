import type {
    SitegraphAttachmentEvidenceLevel,
    SitegraphFacet,
    SitegraphFullDocument
} from './schema-parts';
import type {
    SitegraphGlobalQueryDirectory,
    SitegraphSearchManifest,
    SitegraphSourceRegistry
} from './schemas';

export interface SitegraphRoutedSession {
    manifest: SitegraphSearchManifest;
    sourceRegistry: SitegraphSourceRegistry;
    globalQueryDirectory: SitegraphGlobalQueryDirectory;
    queryAliases: Record<string, unknown>;
}

export type SitegraphSearchPhase =
    | 'plan_started'
    | 'local_index_started'
    | 'first_trusted_results'
    | 'body_index_started'
    | 'top_results_hydrated'
    | 'verification_started'
    | 'partial_verified'
    | 'scoped_exhaustive_complete'
    | 'global_exhaustive_complete'
    | 'cancelled'
    | 'error';

export type SitegraphProofLedgerState =
    | 'pending'
    | 'scanned'
    | 'proved_no_match'
    | 'excluded_by_filter'
    | 'excluded_by_declared_scope'
    | 'failed';

export interface SitegraphProofLedgerEntry {
    shard_id: string;
    source_id: string;
    state: SitegraphProofLedgerState;
    document_count: number;
    byte_size: number;
    path: string;
    reason: string;
    covered_fields: string[];
}

export interface SitegraphProofLedgerSummary {
    total_shards: number;
    pending_shards: number;
    scanned_shards: number;
    proved_no_match_shards: number;
    excluded_by_filter_shards: number;
    excluded_by_declared_scope_shards: number;
    failed_shards: number;
    complete: boolean;
}

export interface SitegraphArtifactCacheStats {
    scope: 'memory_content_hash' | 'browser_persistent_content_hash';
    artifact_hits: number;
    artifact_misses: number;
    cached_bytes: number;
    uncached_bytes: number;
    cacheable_bytes: number;
    memory_hits: number;
    persistent_hits: number;
    network_misses: number;
}

export interface SitegraphSearchCoverage {
    phase: SitegraphSearchPhase;
    coverage_state: SitegraphSearchPhase;
    scope: 'global' | 'scoped';
    searched_fields: string[];
    proved_no_match_shards: number;
    scanned_shards: number;
    excluded_by_filter_shards: number;
    excluded_by_declared_scope_shards: number;
    pending_shards: number;
    failed_shards: number;
    total_shards: number;
    searched_documents: number;
    total_documents: number;
    loaded_bytes: number;
    uncached_loaded_bytes: number;
    cached_artifact_bytes: number;
    first_screen_bytes: number;
    local_index_bytes: number;
    hydrated_shard_bytes: number;
    used_body_index: boolean;
    exhaustive_complete: boolean;
    proof_ledger: SitegraphProofLedgerSummary;
    cache: SitegraphArtifactCacheStats;
}

export interface SitegraphFallbackStats {
    localMetaFallbackDocuments: number;
    snippetFallbackResults: number;
    verifiedFullScanMatches: number;
}

export interface SitegraphQueryPlan {
    normalized_query: string;
    aliases: string[];
    intent: string;
    authority_sources: string[];
    expected_result_types: string[];
    source_ids: string[];
    local_index_ids: string[];
    verification_source_ids: string[];
    declared_completion_scope: 'global' | 'scoped';
    estimated_cost_bytes: number;
    estimated_utility_per_kb: number;
    route_decisions: Array<{
        term: string;
        local_index_count: number;
        expected_cost_bytes: number;
        expected_utility_per_kb: number;
        likely_sources: string[];
        likely_facets: string[];
    }>;
    selected_local_indexes?: Array<{
        index_id: string;
        expected_bytes: number;
        expected_uncached_bytes: number;
        cache_state: 'cold' | 'partial' | 'warm';
        utility_score: number;
        source_id: string;
        facet: string;
        year: string;
    }>;
    phase_local_index_ids?: {
        first_trusted_results: string[];
        top_results_hydrated: string[];
        proof_complete: string[];
    };
}

export type SitegraphQueryClass =
    | 'degenerate'
    | 'hot'
    | 'hot_alias'
    | 'cold_rare'
    | 'cold_high_df'
    | 'miss'
    | 'filtered'
    | 'time_filtered';

export type SitegraphServingPath =
    | 'hot_certificate'
    | 'high_df_certificate'
    | 'dynamic_retrieval'
    | 'noop';

export interface SitegraphProofPressureStats {
    totalShards: number;
    scannedShards: number;
    provedNoMatchShards: number;
    pendingShards: number;
    failedShards: number;
    localIndexBytes: number;
    hydratedShardBytes: number;
    certificateBytes: number;
    loadedBytes: number;
    uncachedLoadedBytes: number;
}

export interface SitegraphPruningLedgerSummary {
    model: 'block_upper_bound_threshold_v1';
    dynamicPruning: boolean;
    impactBlocksVisited: number;
    impactBlocksPruned: number;
    postingsVisited: number;
    postingsPruned: number;
    competitiveThreshold: number;
}

export interface SitegraphQueryStats {
    phase: SitegraphSearchPhase;
    coverage: SitegraphSearchCoverage;
    plan: SitegraphQueryPlan;
    usedBodyIndex: boolean;
    loadedLocalIndexCount: number;
    loadedLocalIndexIds: string[];
    loadedShardCount: number;
    loadedShardPaths: string[];
    candidateCount: number;
    exhaustiveComplete: boolean;
    resultCount: number;
    localIndexBytes: number;
    hydratedShardBytes: number;
    uncachedLoadedBytes: number;
    cachedArtifactBytes: number;
    cache: SitegraphArtifactCacheStats;
    fast_start_used?: boolean;
    first_result_source?: 'hot_query_initial' | 'hot_query_topk' | 'dynamic_retrieval';
    query_class?: SitegraphQueryClass;
    serving_path?: SitegraphServingPath;
    resource_trace_id?: string;
    proof_pressure?: SitegraphProofPressureStats;
    fallbacks: SitegraphFallbackStats;
    retrieval: {
        dynamicPruning: boolean;
        engine?: 'typescript_impact_index' | 'rust_wasm_packed_impact' | 'mixed';
        impactBlocksVisited: number;
        impactBlocksPruned: number;
        postingsVisited: number;
        postingsPruned: number;
        competitiveThreshold: number;
        wasmCalls?: number;
        typescriptCalls?: number;
        scoreEntriesReturned?: number;
        pruning_ledger_summary?: SitegraphPruningLedgerSummary;
    };
}

export type SitegraphSortMode = 'relevance' | 'date_desc';

export type SitegraphDateFilter = 'all' | 'past_year' | 'past_3_years' | 'past_5_years' | 'undated';

export interface SitegraphSearchFilters {
    sourceId?: string;
    facet?: SitegraphFacet | 'all';
    dateRange?: SitegraphDateFilter;
}

export interface SitegraphFilterOption {
    id: string;
    label: string;
    count: number;
}

export interface SitegraphFilterOptions {
    sources: SitegraphFilterOption[];
    facets: Array<SitegraphFilterOption & { id: SitegraphFacet }>;
}

export interface SitegraphMatchHighlight {
    start: number;
    end: number;
    term: string;
}

export interface SitegraphMatchSnippet {
    text: string;
    field: 'title' | 'summary' | 'content' | 'attachments' | 'nav_path' | 'url';
    evidence_level: SitegraphAttachmentEvidenceLevel | 'source_metadata';
    matched_terms: string[];
    highlights: SitegraphMatchHighlight[];
    primary_term?: string;
    fallback?: boolean;
}

export interface RankedSitegraphDocument extends SitegraphFullDocument {
    score: number;
    score_reason: string;
    match_snippet?: SitegraphMatchSnippet;
    query_stats?: SitegraphQueryStats;
}

export interface SitegraphSearchEvent {
    type: SitegraphSearchPhase;
    query: string;
    coverage: SitegraphSearchCoverage;
    results?: RankedSitegraphDocument[];
    stats?: SitegraphQueryStats;
    message?: string;
}

export interface SearchWorkerHandle {
    worker: Worker;
}
