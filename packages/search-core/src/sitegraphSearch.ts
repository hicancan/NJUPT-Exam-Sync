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
    BODY_MAX_SHARD_LOADS,
    BODY_SEARCH_FIELDS,
    DEFAULT_CANDIDATE_LIMIT,
    DEFAULT_MAX_SHARD_LOADS,
    FIRST_TRUSTED_HYDRATION_RESERVE_BYTES,
    FIRST_TRUSTED_MAX_UNCACHED_BYTES,
    FULL_SCAN_FIELDS,
    HIGH_DF_FIRST_TRUSTED_LOCAL_INDEX_BYTES,
    HIGH_DF_MIN_FIRST_TRUSTED_LOCAL_INDEXES,
    HIGH_DF_MIN_TOP_RESULTS_LOCAL_INDEXES,
    HIGH_DF_TOP_RESULTS_LOCAL_INDEX_BYTES,
    HYDRATE_MAX_SHARD_LOADS,
    LIGHT_SEARCH_FIELDS,
    MIN_FIRST_TRUSTED_LOCAL_INDEXES,
    MIN_TOP_RESULTS_LOCAL_INDEXES,
    QUICK_MAX_SHARD_LOADS,
    TOP_RESULTS_HYDRATION_RESERVE_BYTES,
    TOP_RESULTS_MAX_UNCACHED_BYTES,
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
import { activeFilters, bodyIndexArtifact, firstScreenBytes, lightIndexRuntimeBytes, selectLocalRefsWithinBudget, uniqueLocalRefs } from './sitegraphQueryPlanning';
import { buildQueryPlan } from './sitegraphQueryPlanning';
import { isDynamicHighDocumentFrequencyNormalizedQuery } from './sitegraphQueryClass';
import { tryEmitGlobalHotCompletionProof, tryEmitGlobalHotTopProof, tryEmitScopedHotQueryProof } from './sitegraphHotSearchPhases';
import { loadLocalBodyIndex, loadLocalLightIndex, loadPlanningScope } from './sitegraphLocalIndexRuntime';
import { applyImpactIndexRuntime, applyLocalMetaFallback, syncPackedImpactSessionScores } from './sitegraphImpactRuntime';
import { coverageFor, hydrateCandidatePhase, mergeRankedResults, rankedSnapshot, statsFor } from './sitegraphResultRuntime';
import { runCompletionProof } from './sitegraphCompletionProofRuntime';

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
    let candidateCount = 0;
    let usedBodyIndex = false;
    let localIndexBytes = 0;
    let hydratedShardBytes = 0;
    const filterBytes = 0;
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

    const planningScope = await loadPlanningScope(session, plan, filters, now, signal, cacheStats);
    plan.selected_local_indexes = planningScope.selectedLocalIndexes;
    plan.estimated_cost_bytes = planningScope.selectedLocalIndexes.reduce((sum, item) => sum + item.expected_uncached_bytes, plan.estimated_cost_bytes);
    const highDfDynamicQuery = !scoped && isDynamicHighDocumentFrequencyNormalizedQuery(plan.normalized_query);
    const firstTrustedLocalBudgetBase = Math.max(
        0,
        FIRST_TRUSTED_MAX_UNCACHED_BYTES
        - firstScreenBytes(session)
        - planningScope.sourceManifestBytes
        - FIRST_TRUSTED_HYDRATION_RESERVE_BYTES
    );
    const firstTrustedLocalBudget = highDfDynamicQuery ? Math.min(firstTrustedLocalBudgetBase, HIGH_DF_FIRST_TRUSTED_LOCAL_INDEX_BYTES) : firstTrustedLocalBudgetBase;
    const firstTrustedRefs = selectLocalRefsWithinBudget(
        planningScope.localRefs,
        firstTrustedLocalBudget,
        lightIndexRuntimeBytes,
        highDfDynamicQuery ? HIGH_DF_MIN_FIRST_TRUSTED_LOCAL_INDEXES : MIN_FIRST_TRUSTED_LOCAL_INDEXES
    );
    const topResultsLocalBudgetBase = Math.max(
        0,
        TOP_RESULTS_MAX_UNCACHED_BYTES
        - firstScreenBytes(session)
        - planningScope.sourceManifestBytes
        - TOP_RESULTS_HYDRATION_RESERVE_BYTES
    );
    const topResultsLocalBudget = highDfDynamicQuery ? Math.min(topResultsLocalBudgetBase, HIGH_DF_TOP_RESULTS_LOCAL_INDEX_BYTES) : topResultsLocalBudgetBase;
    const topResultsRefs = uniqueLocalRefs([
        ...firstTrustedRefs,
        ...selectLocalRefsWithinBudget(
            planningScope.localRefs,
            topResultsLocalBudget,
            ref => lightIndexRuntimeBytes(ref) + bodyIndexArtifact(ref).bytes,
            highDfDynamicQuery ? HIGH_DF_MIN_TOP_RESULTS_LOCAL_INDEXES : MIN_TOP_RESULTS_LOCAL_INDEXES
        ),
    ]);
    plan.phase_local_index_ids = {
        first_trusted_results: firstTrustedRefs.map(ref => ref.index_id),
        top_results_hydrated: topResultsRefs.map(ref => ref.index_id),
        proof_complete: planningScope.localRefs.map(ref => ref.index_id),
    };
    localIndexBytes += planningScope.sourceManifestBytes;
    const localIndexStartedCoverage = coverageFor(
        session,
        'local_index_started',
        [],
        0,
        0,
        0,
        totalScopeShards,
        totalScopeDocuments,
        localIndexBytes,
        hydratedShardBytes,
        filterBytes,
        false,
        false,
        scoped,
        null,
        cacheStats
    );
    emitResults('local_index_started', localIndexStartedCoverage, false);

    const packedImpactSessionPromise = packedImpactRetriever?.createSession?.(candidateLimit);
    const localLightIndexes = await Promise.all(firstTrustedRefs.map(ref => loadLocalLightIndex(
        ref,
        terms,
        signal,
        cacheStats,
        artifactCache,
        packedImpactRetriever
    )));
    const packedImpactSession = await packedImpactSessionPromise;
    let packedImpactSessionDirty = false;
    firstTrustedRefs.forEach(ref => {
        loadedLocalIndexIds.add(ref.index_id);
        localIndexBytes += lightIndexRuntimeBytes(ref);
    });
    for (const localIndex of localLightIndexes) {
        for (const document of localIndex.documents) {
            docsByIndex.set(document.doc_index, document);
        }
        packedImpactSessionDirty = await applyImpactIndexRuntime(
            scores,
            localIndex,
            terms,
            candidateLimit,
            telemetry,
            packedImpactRetriever,
            packedImpactSession
        ) || packedImpactSessionDirty;
    }
    if (packedImpactSessionDirty) {
        await syncPackedImpactSessionScores(scores, packedImpactSession, telemetry);
        packedImpactSessionDirty = false;
    }
    for (const docIndex of applyLocalMetaFallback(docsByIndex, scores, normalizedQuery, filters, now)) {
        telemetry.localMetaFallbackDocIndices.add(docIndex);
    }

    const quick = await hydrateCandidatePhase(
        docsByIndex,
        planningScope.shardPathById,
        scores,
        trimmed,
        terms,
        signal,
        loadedShardPaths,
        fullDocsByIndex,
        planningScope.shardBytesByPath,
        cacheStats,
        Math.min(candidateLimit, 48),
        Math.min(maxShardLoads, QUICK_MAX_SHARD_LOADS),
        matchPhrases,
        filters,
        now,
        artifactCache
    );
    candidateCount = quick.candidateCount;
    for (const path of loadedShardPaths) {
        hydratedShardBytes += planningScope.shardBytesByPath.get(path) || 0;
    }
    mergeRankedResults(resultMap, quick.ranked);
    const firstTrustedCoverage = coverageFor(
        session,
        'first_trusted_results',
        LIGHT_SEARCH_FIELDS,
        0,
        loadedShardPaths.size,
        fullDocsByIndex.size,
        totalScopeShards,
        totalScopeDocuments,
        localIndexBytes,
        hydratedShardBytes,
        filterBytes,
        false,
        false,
        scoped,
        null,
        cacheStats
    );
    emitResults('first_trusted_results', firstTrustedCoverage, true);

    const bodyStartedCoverage = coverageFor(
        session,
        'body_index_started',
        LIGHT_SEARCH_FIELDS,
        0,
        loadedShardPaths.size,
        fullDocsByIndex.size,
        totalScopeShards,
        totalScopeDocuments,
        localIndexBytes,
        hydratedShardBytes,
        filterBytes,
        false,
        false,
        scoped,
        null,
        cacheStats
    );
    emitResults('body_index_started', bodyStartedCoverage, false);
    throwIfAborted(signal);
    const additionalTopLightRefs = topResultsRefs.filter(ref => !loadedLocalIndexIds.has(ref.index_id));
    const additionalTopLightIndexes = await Promise.all(additionalTopLightRefs.map(ref => loadLocalLightIndex(
        ref,
        terms,
        signal,
        cacheStats,
        artifactCache,
        packedImpactRetriever
    )));
    additionalTopLightRefs.forEach(ref => {
        loadedLocalIndexIds.add(ref.index_id);
        localIndexBytes += lightIndexRuntimeBytes(ref);
    });
    for (const localIndex of additionalTopLightIndexes) {
        for (const document of localIndex.documents) {
            docsByIndex.set(document.doc_index, document);
        }
        packedImpactSessionDirty = await applyImpactIndexRuntime(
            scores,
            localIndex,
            terms,
            candidateLimit,
            telemetry,
            packedImpactRetriever,
            packedImpactSession
        ) || packedImpactSessionDirty;
    }
    if (packedImpactSessionDirty) {
        await syncPackedImpactSessionScores(scores, packedImpactSession, telemetry);
        packedImpactSessionDirty = false;
    }
    const bodyIndexes = await Promise.all(topResultsRefs.map(ref => loadLocalBodyIndex(
        ref,
        terms,
        signal,
        cacheStats,
        artifactCache,
        packedImpactRetriever
    )));
    topResultsRefs.forEach(ref => {
        localIndexBytes += bodyIndexArtifact(ref).bytes;
    });
    usedBodyIndex = true;
    for (const bodyIndex of bodyIndexes) {
        packedImpactSessionDirty = await applyImpactIndexRuntime(
            scores,
            bodyIndex,
            terms,
            candidateLimit,
            telemetry,
            packedImpactRetriever,
            packedImpactSession
        ) || packedImpactSessionDirty;
    }
    if (packedImpactSessionDirty) {
        await syncPackedImpactSessionScores(scores, packedImpactSession, telemetry);
        packedImpactSessionDirty = false;
    }
    for (const docIndex of applyLocalMetaFallback(docsByIndex, scores, normalizedQuery, filters, now)) {
        telemetry.localMetaFallbackDocIndices.add(docIndex);
    }
    const beforeBodyShardPaths = new Set(loadedShardPaths);
    const body = await hydrateCandidatePhase(
        docsByIndex,
        planningScope.shardPathById,
        scores,
        trimmed,
        terms,
        signal,
        loadedShardPaths,
        fullDocsByIndex,
        planningScope.shardBytesByPath,
        cacheStats,
        Math.min(candidateLimit, 96),
        Math.min(maxShardLoads, BODY_MAX_SHARD_LOADS),
        matchPhrases,
        filters,
        now,
        artifactCache
    );
    candidateCount = body.candidateCount;
    for (const path of loadedShardPaths) {
        if (beforeBodyShardPaths.has(path)) continue;
        hydratedShardBytes += planningScope.shardBytesByPath.get(path) || 0;
    }
    mergeRankedResults(resultMap, body.ranked);

    const beforeHydrateShardPaths = new Set(loadedShardPaths);
    const hydrate = await hydrateCandidatePhase(
        docsByIndex,
        planningScope.shardPathById,
        scores,
        trimmed,
        terms,
        signal,
        loadedShardPaths,
        fullDocsByIndex,
        planningScope.shardBytesByPath,
        cacheStats,
        candidateLimit,
        Math.min(maxShardLoads, HYDRATE_MAX_SHARD_LOADS),
        matchPhrases,
        filters,
        now,
        artifactCache
    );
    candidateCount = hydrate.candidateCount;
    for (const path of loadedShardPaths) {
        if (beforeHydrateShardPaths.has(path)) continue;
        hydratedShardBytes += planningScope.shardBytesByPath.get(path) || 0;
    }
    mergeRankedResults(resultMap, hydrate.ranked);
    const hydratedCoverage = coverageFor(
        session,
        'top_results_hydrated',
        BODY_SEARCH_FIELDS,
        0,
        loadedShardPaths.size,
        fullDocsByIndex.size,
        totalScopeShards,
        totalScopeDocuments,
        localIndexBytes,
        hydratedShardBytes,
        filterBytes,
        usedBodyIndex,
        false,
        scoped,
        null,
        cacheStats
    );
    emitResults('top_results_hydrated', hydratedCoverage, true);

    if (!scoped && await tryEmitGlobalHotCompletionProof(hotPhaseContext, signal, {
        localIndexBytes,
        hydratedShardBytes,
        filterBytes,
        usedBodyIndex,
        emitResults,
    })) return;

    await runCompletionProof({
        session,
        signal,
        trimmed,
        terms,
        matchPhrases,
        filters,
        now,
        plan,
        scoped,
        loadedShardPaths,
        fullDocsByIndex,
        scores,
        resultMap,
        cacheStats,
        telemetry,
        planningSourceManifests: planningScope.sourceManifests,
        artifactCache,
        localIndexBytes,
        hydratedShardBytes,
        filterBytes,
        usedBodyIndex,
        emitResults,
    });
};
