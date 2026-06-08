import type {
    RankedSitegraphDocument,
    SitegraphDocMeta,
    SitegraphArtifactCacheStats,
    SitegraphFullDocument,
    SitegraphQueryPlan,
    SitegraphRoutedSession,
    SitegraphSearchCoverage,
    SitegraphSearchEvent,
    SitegraphSearchFilters,
    SitegraphSearchPhase,
    SitegraphSortMode
} from '@njupt-search/contracts';
import type { ArtifactContentCache } from './fetchJson';
import {
    BODY_MAX_SHARD_LOADS,
    BODY_SEARCH_FIELDS,
    FIRST_TRUSTED_HYDRATION_RESERVE_BYTES,
    FIRST_TRUSTED_MAX_UNCACHED_BYTES,
    HIGH_DF_FIRST_TRUSTED_LOCAL_INDEX_BYTES,
    HIGH_DF_MIN_FIRST_TRUSTED_LOCAL_INDEXES,
    HIGH_DF_MIN_TOP_RESULTS_LOCAL_INDEXES,
    HIGH_DF_TOP_RESULTS_LOCAL_INDEX_BYTES,
    HYDRATE_MAX_SHARD_LOADS,
    LIGHT_SEARCH_FIELDS,
    RARE_DYNAMIC_FIRST_TRUSTED_LOCAL_INDEX_BYTES,
    RARE_DYNAMIC_MIN_FIRST_TRUSTED_LOCAL_INDEXES,
    RARE_DYNAMIC_MIN_TOP_RESULTS_LOCAL_INDEXES,
    RARE_DYNAMIC_QUICK_MAX_SHARD_LOADS,
    RARE_DYNAMIC_TOP_RESULTS_LOCAL_INDEX_BYTES,
    QUICK_MAX_SHARD_LOADS,
    TOP_RESULTS_HYDRATION_RESERVE_BYTES,
    TOP_RESULTS_MAX_UNCACHED_BYTES,
    type PackedImpactRetriever,
    type SearchTelemetry
} from './sitegraphSearchTypes';
import { applyImpactIndexRuntime, applyLocalMetaFallback, syncPackedImpactSessionScores } from './sitegraphImpactRuntime';
import { loadLocalBodyIndex, loadLocalLightIndex, loadPlanningScope } from './sitegraphLocalIndexRuntime';
import { bodyIndexArtifact, firstScreenBytes, lightIndexRuntimeBytes, selectLocalRefsWithinBudget, uniqueLocalRefs } from './sitegraphQueryPlanning';
import { isDynamicHighDocumentFrequencyNormalizedQuery } from './sitegraphQueryClass';
import { tryEmitGlobalHotCompletionProof } from './sitegraphHotSearchPhases';
import { coverageFor, hydrateCandidatePhase, mergeRankedResults, rankedSnapshot, statsFor } from './sitegraphResultRuntime';
import { runCompletionProof } from './sitegraphCompletionProofRuntime';
import { throwIfAborted } from './sitegraphRuntimeFetch';

interface HotCompletionContext {
    session: SitegraphRoutedSession;
    trimmed: string;
    normalizedQuery: string;
    terms: string[];
    filters: SitegraphSearchFilters;
    now: number;
    limit: number;
    sortMode: SitegraphSortMode;
    plan: SitegraphQueryPlan;
    cacheStats: SitegraphArtifactCacheStats;
    telemetry: SearchTelemetry;
    emit: (event: SitegraphSearchEvent) => void;
}

export interface DynamicRetrievalInput {
    session: SitegraphRoutedSession;
    signal: AbortSignal;
    trimmed: string;
    normalizedQuery: string;
    terms: string[];
    matchPhrases: string[];
    filters: SitegraphSearchFilters;
    now: number;
    limit: number;
    sortMode: SitegraphSortMode;
    candidateLimit: number;
    maxShardLoads: number;
    plan: SitegraphQueryPlan;
    scoped: boolean;
    totalScopeShards: number;
    totalScopeDocuments: number;
    cacheStats: SitegraphArtifactCacheStats;
    telemetry: SearchTelemetry;
    artifactCache?: ArtifactContentCache;
    packedImpactRetriever?: PackedImpactRetriever;
    scores: Map<number, number>;
    resultMap: Map<string, RankedSitegraphDocument>;
    loadedShardPaths: Set<string>;
    loadedLocalIndexIds: Set<string>;
    docsByIndex: Map<number, SitegraphDocMeta>;
    fullDocsByIndex: Map<number, SitegraphFullDocument>;
    emit: (event: SitegraphSearchEvent) => void;
    hotPhaseContext: HotCompletionContext;
}

const addHydratedBytes = (
    loadedShardPaths: Set<string>,
    shardBytesByPath: Map<string, number>,
    previouslyLoaded?: Set<string>
): number => {
    let bytes = 0;
    for (const path of loadedShardPaths) {
        if (previouslyLoaded?.has(path)) continue;
        bytes += shardBytesByPath.get(path) || 0;
    }
    return bytes;
};

export const runDynamicRetrieval = async ({
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
}: DynamicRetrievalInput): Promise<void> => {
    let candidateCount = 0;
    const emitDynamicResults = (
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

    const planningScope = await loadPlanningScope(session, plan, filters, now, signal, cacheStats);
    plan.selected_local_indexes = planningScope.selectedLocalIndexes;
    plan.estimated_cost_bytes = planningScope.selectedLocalIndexes.reduce((sum, item) => sum + item.expected_uncached_bytes, plan.estimated_cost_bytes);
    const highDfDynamicQuery = !scoped && isDynamicHighDocumentFrequencyNormalizedQuery(plan.normalized_query);
    const dynamicLocalFirstCap = highDfDynamicQuery
        ? HIGH_DF_FIRST_TRUSTED_LOCAL_INDEX_BYTES
        : RARE_DYNAMIC_FIRST_TRUSTED_LOCAL_INDEX_BYTES;
    const dynamicLocalTopCap = highDfDynamicQuery
        ? HIGH_DF_TOP_RESULTS_LOCAL_INDEX_BYTES
        : RARE_DYNAMIC_TOP_RESULTS_LOCAL_INDEX_BYTES;
    const dynamicFirstMinimum = highDfDynamicQuery
        ? HIGH_DF_MIN_FIRST_TRUSTED_LOCAL_INDEXES
        : RARE_DYNAMIC_MIN_FIRST_TRUSTED_LOCAL_INDEXES;
    const dynamicTopMinimum = highDfDynamicQuery
        ? HIGH_DF_MIN_TOP_RESULTS_LOCAL_INDEXES
        : RARE_DYNAMIC_MIN_TOP_RESULTS_LOCAL_INDEXES;
    const quickShardLimit = highDfDynamicQuery ? QUICK_MAX_SHARD_LOADS : RARE_DYNAMIC_QUICK_MAX_SHARD_LOADS;
    const firstTrustedLocalBudget = Math.min(
        Math.max(0, FIRST_TRUSTED_MAX_UNCACHED_BYTES - firstScreenBytes(session) - planningScope.sourceManifestBytes - FIRST_TRUSTED_HYDRATION_RESERVE_BYTES),
        dynamicLocalFirstCap
    );
    const firstTrustedRefs = selectLocalRefsWithinBudget(
        planningScope.localRefs,
        firstTrustedLocalBudget,
        lightIndexRuntimeBytes,
        dynamicFirstMinimum
    );
    const topResultsLocalBudget = Math.min(
        Math.max(0, TOP_RESULTS_MAX_UNCACHED_BYTES - firstScreenBytes(session) - planningScope.sourceManifestBytes - TOP_RESULTS_HYDRATION_RESERVE_BYTES),
        dynamicLocalTopCap
    );
    const topResultsRefs = uniqueLocalRefs([
        ...firstTrustedRefs,
        ...selectLocalRefsWithinBudget(
            planningScope.localRefs,
            topResultsLocalBudget,
            ref => lightIndexRuntimeBytes(ref) + bodyIndexArtifact(ref).bytes,
            dynamicTopMinimum
        ),
    ]);
    plan.phase_local_index_ids = {
        first_trusted_results: firstTrustedRefs.map(ref => ref.index_id),
        top_results_hydrated: topResultsRefs.map(ref => ref.index_id),
        proof_complete: planningScope.localRefs.map(ref => ref.index_id),
    };

    let localIndexBytes = planningScope.sourceManifestBytes;
    let hydratedShardBytes = 0;
    const filterBytes = 0;
    const localIndexStartedCoverage = coverageFor(session, 'local_index_started', [], 0, 0, 0, totalScopeShards, totalScopeDocuments, localIndexBytes, hydratedShardBytes, filterBytes, false, false, scoped, null, cacheStats);
    emitDynamicResults('local_index_started', localIndexStartedCoverage, false);

    const packedImpactSessionPromise = packedImpactRetriever?.createSession?.(candidateLimit);
    const localLightIndexes = await Promise.all(firstTrustedRefs.map(ref => loadLocalLightIndex(ref, terms, signal, cacheStats, artifactCache, packedImpactRetriever)));
    const packedImpactSession = await packedImpactSessionPromise;
    let packedImpactSessionDirty = false;
    firstTrustedRefs.forEach(ref => {
        loadedLocalIndexIds.add(ref.index_id);
        localIndexBytes += lightIndexRuntimeBytes(ref);
    });
    for (const localIndex of localLightIndexes) {
        for (const document of localIndex.documents) docsByIndex.set(document.doc_index, document);
        packedImpactSessionDirty = await applyImpactIndexRuntime(scores, localIndex, terms, candidateLimit, telemetry, packedImpactRetriever, packedImpactSession) || packedImpactSessionDirty;
    }
    if (packedImpactSessionDirty) {
        await syncPackedImpactSessionScores(scores, packedImpactSession, telemetry);
        packedImpactSessionDirty = false;
    }
    for (const docIndex of applyLocalMetaFallback(docsByIndex, scores, normalizedQuery, filters, now)) telemetry.localMetaFallbackDocIndices.add(docIndex);

    const quick = await hydrateCandidatePhase(docsByIndex, planningScope.shardPathById, scores, trimmed, terms, signal, loadedShardPaths, fullDocsByIndex, planningScope.shardBytesByPath, cacheStats, Math.min(candidateLimit, 48), Math.min(maxShardLoads, quickShardLimit), matchPhrases, filters, now, artifactCache);
    candidateCount = quick.candidateCount;
    hydratedShardBytes += addHydratedBytes(loadedShardPaths, planningScope.shardBytesByPath);
    mergeRankedResults(resultMap, quick.ranked);
    const firstTrustedCoverage = coverageFor(session, 'first_trusted_results', LIGHT_SEARCH_FIELDS, 0, loadedShardPaths.size, fullDocsByIndex.size, totalScopeShards, totalScopeDocuments, localIndexBytes, hydratedShardBytes, filterBytes, false, false, scoped, null, cacheStats);
    emitDynamicResults('first_trusted_results', firstTrustedCoverage, true);

    const bodyStartedCoverage = coverageFor(session, 'body_index_started', LIGHT_SEARCH_FIELDS, 0, loadedShardPaths.size, fullDocsByIndex.size, totalScopeShards, totalScopeDocuments, localIndexBytes, hydratedShardBytes, filterBytes, false, false, scoped, null, cacheStats);
    emitDynamicResults('body_index_started', bodyStartedCoverage, false);
    throwIfAborted(signal);

    const additionalTopLightRefs = topResultsRefs.filter(ref => !loadedLocalIndexIds.has(ref.index_id));
    const additionalTopLightIndexes = await Promise.all(additionalTopLightRefs.map(ref => loadLocalLightIndex(ref, terms, signal, cacheStats, artifactCache, packedImpactRetriever)));
    additionalTopLightRefs.forEach(ref => {
        loadedLocalIndexIds.add(ref.index_id);
        localIndexBytes += lightIndexRuntimeBytes(ref);
    });
    for (const localIndex of additionalTopLightIndexes) {
        for (const document of localIndex.documents) docsByIndex.set(document.doc_index, document);
        packedImpactSessionDirty = await applyImpactIndexRuntime(scores, localIndex, terms, candidateLimit, telemetry, packedImpactRetriever, packedImpactSession) || packedImpactSessionDirty;
    }
    if (packedImpactSessionDirty) {
        await syncPackedImpactSessionScores(scores, packedImpactSession, telemetry);
        packedImpactSessionDirty = false;
    }
    const bodyIndexes = await Promise.all(topResultsRefs.map(ref => loadLocalBodyIndex(ref, terms, signal, cacheStats, artifactCache, packedImpactRetriever)));
    topResultsRefs.forEach(ref => { localIndexBytes += bodyIndexArtifact(ref).bytes; });
    const usedBodyIndex = true;
    for (const bodyIndex of bodyIndexes) {
        packedImpactSessionDirty = await applyImpactIndexRuntime(scores, bodyIndex, terms, candidateLimit, telemetry, packedImpactRetriever, packedImpactSession) || packedImpactSessionDirty;
    }
    if (packedImpactSessionDirty) {
        await syncPackedImpactSessionScores(scores, packedImpactSession, telemetry);
        packedImpactSessionDirty = false;
    }
    for (const docIndex of applyLocalMetaFallback(docsByIndex, scores, normalizedQuery, filters, now)) telemetry.localMetaFallbackDocIndices.add(docIndex);

    const beforeBodyShardPaths = new Set(loadedShardPaths);
    const body = await hydrateCandidatePhase(docsByIndex, planningScope.shardPathById, scores, trimmed, terms, signal, loadedShardPaths, fullDocsByIndex, planningScope.shardBytesByPath, cacheStats, Math.min(candidateLimit, 96), Math.min(maxShardLoads, BODY_MAX_SHARD_LOADS), matchPhrases, filters, now, artifactCache);
    candidateCount = body.candidateCount;
    hydratedShardBytes += addHydratedBytes(loadedShardPaths, planningScope.shardBytesByPath, beforeBodyShardPaths);
    mergeRankedResults(resultMap, body.ranked);

    const beforeHydrateShardPaths = new Set(loadedShardPaths);
    const hydrate = await hydrateCandidatePhase(docsByIndex, planningScope.shardPathById, scores, trimmed, terms, signal, loadedShardPaths, fullDocsByIndex, planningScope.shardBytesByPath, cacheStats, candidateLimit, Math.min(maxShardLoads, HYDRATE_MAX_SHARD_LOADS), matchPhrases, filters, now, artifactCache);
    candidateCount = hydrate.candidateCount;
    hydratedShardBytes += addHydratedBytes(loadedShardPaths, planningScope.shardBytesByPath, beforeHydrateShardPaths);
    mergeRankedResults(resultMap, hydrate.ranked);
    const hydratedCoverage = coverageFor(session, 'top_results_hydrated', BODY_SEARCH_FIELDS, 0, loadedShardPaths.size, fullDocsByIndex.size, totalScopeShards, totalScopeDocuments, localIndexBytes, hydratedShardBytes, filterBytes, usedBodyIndex, false, scoped, null, cacheStats);
    emitDynamicResults('top_results_hydrated', hydratedCoverage, true);

    if (!scoped && await tryEmitGlobalHotCompletionProof(hotPhaseContext, signal, { localIndexBytes, hydratedShardBytes, filterBytes, usedBodyIndex, emitResults: emitDynamicResults })) return;

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
        emitResults: emitDynamicResults,
    });
};
