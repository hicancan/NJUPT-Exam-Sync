import type {
    RankedSitegraphDocument,
    SitegraphFullDocument,
    SitegraphDocMeta,
    SitegraphRoutedSession,
    SitegraphSearchCoverage,
    SitegraphSearchEvent,
    SitegraphSearchFilters,
    SitegraphSearchPhase,
    SitegraphSortMode
} from '@njupt-search/contracts';
import { expandSitegraphQueryPhrases, normalizeSearchText as normalize, tokenizeSitegraphQuery } from './tokenizer';
import {
    DEFAULT_CANDIDATE_LIMIT,
    DEFAULT_MAX_SHARD_LOADS,
    FULL_SCAN_FIELDS,
    type RoutedSessionWithArtifactCache,
    type SearchTelemetry
} from './sitegraphSearchTypes';
export { clearSitegraphRuntimeCaches } from './sitegraphRuntimeCaches';
export type {
    PackedImpactRetrievalInput,
    PackedImpactRetrievalMetrics,
    PackedImpactRetrievalResult,
    PackedImpactRetrievalSession,
    PackedImpactRetriever
} from './sitegraphSearchTypes';
import { createCacheStats, throwIfAborted } from './sitegraphRuntimeFetch';
import { activeFilters, buildQueryPlan } from './sitegraphQueryPlanning';
import { tryEmitGlobalHotTopProof, tryEmitScopedHotQueryProof } from './sitegraphHotSearchPhases';
import { coverageFor, rankedSnapshot, statsFor } from './sitegraphResultRuntime';
import { runDynamicRetrieval } from './sitegraphDynamicRetrievalRuntime';

export interface ProgressiveSearchOptions {
    limit?: number;
    candidateLimit?: number;
    maxShardLoads?: number;
    sortMode?: SitegraphSortMode;
    filters?: SitegraphSearchFilters;
    now?: number;
}

export const searchSitegraphProgressively = async (
    session: SitegraphRoutedSession,
    query: string,
    signal: AbortSignal,
    emit: (event: SitegraphSearchEvent) => void,
    options: ProgressiveSearchOptions = {}
): Promise<void> => {
    const trimmed = query.trim();
    const limit = options.limit ?? 60;
    const candidateLimit = options.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT;
    const maxShardLoads = options.maxShardLoads ?? DEFAULT_MAX_SHARD_LOADS;
    const sortMode = options.sortMode ?? 'relevance';
    const filters = options.filters ?? {};
    const now = options.now ?? Date.now();
    const terms = tokenizeSitegraphQuery(trimmed, session.queryAliases);
    const artifactCache = (session as RoutedSessionWithArtifactCache).artifactCache;
    const packedImpactRetriever = (session as RoutedSessionWithArtifactCache).packedImpactRetriever;
    const normalizedQuery = normalize(trimmed);
    const matchPhrases = expandSitegraphQueryPhrases(trimmed, session.queryAliases);
    const plan = buildQueryPlan(session, trimmed, terms, filters);
    const scores = new Map<number, number>();
    const resultMap = new Map<string, RankedSitegraphDocument>();
    const loadedShardPaths = new Set<string>();
    const loadedLocalIndexIds = new Set<string>();
    const docsByIndex = new Map<number, SitegraphDocMeta>();
    const fullDocsByIndex = new Map<number, SitegraphFullDocument>();
    const cacheStats = createCacheStats(artifactCache?.scope ?? 'memory_content_hash');
    const telemetry: SearchTelemetry = {
        localMetaFallbackDocIndices: new Set<number>(),
        fullScanMatchDocIndices: new Set<number>(),
        retrieval: {
            dynamicPruning: false,
            engine: 'typescript_impact_index',
            impactBlocksVisited: 0,
            impactBlocksPruned: 0,
            postingsVisited: 0,
            postingsPruned: 0,
            competitiveThreshold: 0,
            wasmCalls: 0,
            typescriptCalls: 0,
            scoreEntriesReturned: 0,
        },
    };
    const candidateCount = 0;
    const totalScopeShards = session.manifest.progressive_search.total_shards;
    const totalScopeDocuments = session.manifest.progressive_search.total_documents;
    const scoped = activeFilters(filters);

    const emitResults = (
        type: SitegraphSearchPhase,
        coverage: SitegraphSearchCoverage,
        includeResults: boolean,
        provenResultCount?: number
    ) => {
        const stats = statsFor(type, coverage, plan, loadedLocalIndexIds, loadedShardPaths, candidateCount, resultMap, telemetry, provenResultCount);
        emit({
            type,
            query: trimmed,
            coverage,
            stats,
            ...(includeResults ? { results: rankedSnapshot(resultMap, stats, limit, sortMode) } : {}),
        });
    };

    const startedCoverage = coverageFor(
        session,
        'plan_started',
        [],
        0,
        0,
        0,
        totalScopeShards,
        totalScopeDocuments,
        0,
        0,
        0,
        false,
        false,
        scoped,
        null,
        cacheStats
    );
    emitResults('plan_started', startedCoverage, false);
    throwIfAborted(signal);

    if (trimmed.length < 2) {
        const completePhase = scoped ? 'scoped_exhaustive_complete' : 'global_exhaustive_complete';
        const completeCoverage = coverageFor(session, completePhase, FULL_SCAN_FIELDS, 0, 0, 0, totalScopeShards, totalScopeDocuments, 0, 0, 0, false, true, scoped, null, cacheStats);
        emitResults(completePhase, completeCoverage, true);
        return;
    }

    const hotPhaseContext = {
        session,
        trimmed,
        normalizedQuery,
        terms,
        filters,
        now,
        limit,
        sortMode,
        plan,
        cacheStats,
        telemetry,
        emit,
    };
    if (scoped && await tryEmitScopedHotQueryProof(hotPhaseContext, signal)) return;
    if (!scoped && await tryEmitGlobalHotTopProof(hotPhaseContext, signal)) return;

    await runDynamicRetrieval({
        session,
        signal,
        trimmed,
        normalizedQuery,
        terms,
        matchPhrases,
        filters,
        now,
        limit,
        sortMode,
        candidateLimit,
        maxShardLoads,
        plan,
        scoped,
        totalScopeShards,
        totalScopeDocuments,
        cacheStats,
        telemetry,
        artifactCache,
        packedImpactRetriever,
        scores,
        resultMap,
        loadedShardPaths,
        loadedLocalIndexIds,
        docsByIndex,
        fullDocsByIndex,
        emit,
        hotPhaseContext,
    });
};
