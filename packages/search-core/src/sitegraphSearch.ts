import type {
    RankedSitegraphDocument,
    SitegraphFullDocument,
    SitegraphDocMeta,
    SitegraphProofLedgerEntry,
    SitegraphQueryStats,
    SitegraphRoutedSession,
    SitegraphSearchCoverage,
    SitegraphSearchEvent,
    SitegraphSearchFilters,
    SitegraphSearchPhase,
    SitegraphSortMode,
    SitegraphSourceManifest
} from '@njupt-search/contracts';
import { sitegraphDocumentMatchesFilters } from './sitegraphFilters';
import { rankSitegraphDocument } from './ranking/rankDocument';
import { expandSitegraphQueryPhrases, normalizeSearchText as normalize, tokenizeSitegraphQuery } from './tokenizer';
import { SearchContractError } from './sitegraphContract';
import {
    BODY_MAX_SHARD_LOADS,
    BODY_SEARCH_FIELDS,
    DEFAULT_CANDIDATE_LIMIT,
    DEFAULT_MAX_SHARD_LOADS,
    FIRST_TRUSTED_HYDRATION_RESERVE_BYTES,
    FIRST_TRUSTED_MAX_UNCACHED_BYTES,
    FULL_SCAN_FIELDS,
    HYDRATE_MAX_SHARD_LOADS,
    LIGHT_SEARCH_FIELDS,
    MIN_FIRST_TRUSTED_LOCAL_INDEXES,
    MIN_TOP_RESULTS_LOCAL_INDEXES,
    QUICK_MAX_SHARD_LOADS,
    SHARD_BATCH_SIZE,
    TOP_RESULTS_HYDRATION_RESERVE_BYTES,
    TOP_RESULTS_MAX_UNCACHED_BYTES,
    type RoutedSessionWithArtifactCache,
    type SearchTelemetry,
    type VerificationShard
} from './sitegraphSearchTypes';
export { clearSitegraphRuntimeCaches } from './sitegraphRuntimeCaches';
export type {
    PackedImpactRetrievalInput,
    PackedImpactRetrievalMetrics,
    PackedImpactRetrievalResult,
    PackedImpactRetrievalSession,
    PackedImpactRetriever
} from './sitegraphSearchTypes';
import { createCacheStats, isAbortError, throwIfAborted, yieldToWorker } from './sitegraphRuntimeFetch';
import { activeFilters, bodyIndexArtifact, firstScreenBytes, lightIndexRuntimeBytes, selectLocalRefsWithinBudget, sourceEntriesById, uniqueLocalRefs } from './sitegraphQueryPlanning';
import { buildQueryPlan } from './sitegraphQueryPlanning';
import { loadProofCatalog, loadShard, loadShardFilter, loadSourceManifest, verificationShardFromFullShard, verificationShardFromProofCatalog } from './sitegraphArtifactLoaders';
import type { ShardFilterMap } from './sitegraphShardFilter';
import { loadMatchingHotQueryProof } from './sitegraphHotProofRuntime';
import { tryEmitGlobalHotTopProof, tryEmitScopedHotQueryProof } from './sitegraphHotSearchPhases';
import { loadLocalBodyIndex, loadLocalLightIndex, loadPlanningScope } from './sitegraphLocalIndexRuntime';
import { applyImpactIndexRuntime, applyLocalMetaFallback, syncPackedImpactSessionScores } from './sitegraphImpactRuntime';
import { coverageFor, documentMatchesFullScan, hydrateCandidatePhase, loadedShardDocuments, mergeRankedResults, rankedSnapshot, statsFor } from './sitegraphResultRuntime';
import { buildProofLedger, proofLedgerSummary, setLedgerState, shardFilterProvesNoMatch } from './sitegraphProofLedgerRuntime';

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
    let filterBytes = 0;
    let totalScopeShards = session.manifest.progressive_search.total_shards;
    let totalScopeDocuments = session.manifest.progressive_search.total_documents;
    const scoped = activeFilters(filters);
    let proofLedgerEntries: SitegraphProofLedgerEntry[] | null = null;

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
    const firstTrustedLocalBudget = Math.max(
        0,
        FIRST_TRUSTED_MAX_UNCACHED_BYTES
        - firstScreenBytes(session)
        - planningScope.sourceManifestBytes
        - FIRST_TRUSTED_HYDRATION_RESERVE_BYTES
    );
    const firstTrustedRefs = selectLocalRefsWithinBudget(
        planningScope.localRefs,
        firstTrustedLocalBudget,
        lightIndexRuntimeBytes,
        MIN_FIRST_TRUSTED_LOCAL_INDEXES
    );
    const topResultsLocalBudget = Math.max(
        0,
        TOP_RESULTS_MAX_UNCACHED_BYTES
        - firstScreenBytes(session)
        - planningScope.sourceManifestBytes
        - TOP_RESULTS_HYDRATION_RESERVE_BYTES
    );
    const topResultsRefs = uniqueLocalRefs([
        ...firstTrustedRefs,
        ...selectLocalRefsWithinBudget(
            planningScope.localRefs,
            topResultsLocalBudget,
            ref => lightIndexRuntimeBytes(ref) + bodyIndexArtifact(ref).bytes,
            MIN_TOP_RESULTS_LOCAL_INDEXES
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

    if (!scoped) {
        const hotProof = await loadMatchingHotQueryProof(
            session as RoutedSessionWithArtifactCache,
            normalizedQuery,
            signal,
            cacheStats
        );
        if (hotProof) {
            const { certificate, bytes } = hotProof;
            const certificateMatches = certificate.documents;
            if (certificateMatches.length !== certificate.match_count) {
                throw new SearchContractError(`Hot query proof certificate ${certificate.normalized_query} match count does not match proof documents`);
            }
            filterBytes += bytes;
            totalScopeShards = certificate.total_shards;
            totalScopeDocuments = certificate.total_documents;
            const matchedShardCount = certificate.matched_shard_count;
            const provedNoMatchShards = Math.max(0, certificate.total_shards - matchedShardCount);
            const completeCoverage = coverageFor(
                session,
                'global_exhaustive_complete',
                FULL_SCAN_FIELDS,
                provedNoMatchShards,
                matchedShardCount,
                certificate.match_count,
                certificate.total_shards,
                certificate.total_documents,
                localIndexBytes,
                hydratedShardBytes,
                filterBytes,
                usedBodyIndex,
                true,
                false,
                null,
                cacheStats
            );
            emitResults('global_exhaustive_complete', completeCoverage, true, certificate.match_count);
            return;
        }
    }

    const verificationEntries = sourceEntriesById(session);
    const verificationManifests: SitegraphSourceManifest[] = [];
    const allVerificationShards: VerificationShard[] = [];
    for (const sourceId of plan.verification_source_ids) {
        const entry = verificationEntries.get(sourceId);
        if (!entry) continue;
        const sourceManifest = await loadSourceManifest(entry, signal, cacheStats, artifactCache);
        verificationManifests.push(sourceManifest);
        if (!planningScope.sourceManifests.some(item => item.source_id === sourceManifest.source_id)) {
            localIndexBytes += entry.artifact_manifest.bytes;
        }
        const proofCatalog = await loadProofCatalog(sourceManifest, signal, cacheStats, artifactCache);
        filterBytes += sourceManifest.artifacts.proof_catalog?.bytes || 0;
        allVerificationShards.push(...proofCatalog.shards.map(verificationShardFromProofCatalog));
    }
    if (allVerificationShards.length === 0) {
        allVerificationShards.push(...verificationManifests.flatMap(sourceManifest => sourceManifest.full_shards.map(verificationShardFromFullShard)));
    }
    proofLedgerEntries = buildProofLedger(allVerificationShards, filters, now);
    const inScopeShards = allVerificationShards
        .filter(shard => proofLedgerEntries?.find(entry => entry.shard_id === shard.shard_id)?.state === 'pending');
    totalScopeShards = proofLedgerEntries.length;
    totalScopeDocuments = inScopeShards.reduce((sum, shard) => sum + shard.count, 0);
    let provedNoMatchShards = 0;
    let scannedShards = 0;
    let searchedDocuments = 0;
    const initiallyVerifiedMatches: RankedSitegraphDocument[] = [];
    for (const shard of inScopeShards) {
        if (!loadedShardPaths.has(shard.path)) continue;
        const documents = loadedShardDocuments(shard.path, fullDocsByIndex);
        if (!documents) continue;
        scannedShards += 1;
        setLedgerState(proofLedgerEntries, shard.shard_id, 'scanned', 'full shard already hydrated before completion proof');
        for (const document of documents) {
            fullDocsByIndex.set(document.doc_index, document);
            searchedDocuments += 1;
            if (sitegraphDocumentMatchesFilters(document, filters, now) && documentMatchesFullScan(document, matchPhrases)) {
                telemetry.fullScanMatchDocIndices.add(document.doc_index);
                const baseScore = scores.get(document.doc_index) ?? 24;
                initiallyVerifiedMatches.push(rankSitegraphDocument(document, trimmed, terms, baseScore));
            }
        }
    }
    const hasInitialVerifiedResults = mergeRankedResults(resultMap, initiallyVerifiedMatches) > 0;
    const verificationStartedCoverage = coverageFor(
        session,
        'verification_started',
        FULL_SCAN_FIELDS,
        provedNoMatchShards,
        scannedShards,
        searchedDocuments,
        totalScopeShards,
        totalScopeDocuments,
        localIndexBytes,
        hydratedShardBytes,
        filterBytes,
        usedBodyIndex,
        false,
        scoped,
        proofLedgerEntries,
        cacheStats
    );
    emitResults('verification_started', verificationStartedCoverage, hasInitialVerifiedResults);

    const shardFiltersBySource = new Map<string, ShardFilterMap>();
    for (const sourceManifest of verificationManifests) {
        const filter = await loadShardFilter(sourceManifest, signal, cacheStats, artifactCache);
        shardFiltersBySource.set(sourceManifest.source_id, filter);
        filterBytes += sourceManifest.artifacts.shard_filter?.bytes || 0;
    }

    const shardBytesByPath = new Map(inScopeShards.map(shard => [shard.path, shard.bytes]));
    const pendingVerificationShards = inScopeShards.filter(shard => (
        proofLedgerEntries?.find(entry => entry.shard_id === shard.shard_id)?.state === 'pending'
    ));
    for (let shardIndex = 0; shardIndex < pendingVerificationShards.length; shardIndex += SHARD_BATCH_SIZE) {
        throwIfAborted(signal);
        const shardBatch = pendingVerificationShards.slice(shardIndex, shardIndex + SHARD_BATCH_SIZE);
        const scanBatch = shardBatch.filter(shard => {
            const canSkip = shardFilterProvesNoMatch(shard.shard_id, shardFiltersBySource.get(String(shard.source_id || '')) || {}, matchPhrases);
            if (canSkip) {
                provedNoMatchShards += 1;
                if (proofLedgerEntries) setLedgerState(proofLedgerEntries, shard.shard_id, 'proved_no_match', 'no-false-negative shard filter proved every full-scan phrase absent');
            }
            return !canSkip;
        });
        const shardResults = await Promise.allSettled(scanBatch.map(shard => loadShard(
            shard.path,
            signal,
            cacheStats,
            shard.bytes,
            artifactCache
        )));
        const verifyMatches: RankedSitegraphDocument[] = [];
        let firstShardError: unknown = null;
        shardResults.forEach((result, batchIndex) => {
            const shard = scanBatch[batchIndex];
            if (!shard) return;
            if (result.status === 'rejected') {
                if (isAbortError(result.reason)) {
                    firstShardError = result.reason;
                    return;
                }
                firstShardError ??= result.reason;
                if (proofLedgerEntries) setLedgerState(proofLedgerEntries, shard.shard_id, 'failed', result.reason instanceof Error ? result.reason.message : 'failed to load full shard for completion proof');
                return;
            }
            const documents = result.value;
            const firstLoad = !loadedShardPaths.has(shard.path);
            loadedShardPaths.add(shard.path);
            if (firstLoad) hydratedShardBytes += shardBytesByPath.get(shard.path) || 0;
            scannedShards += 1;
            if (proofLedgerEntries) setLedgerState(proofLedgerEntries, shard.shard_id, 'scanned', 'full shard scanned for completion proof');
            for (const document of documents) {
                fullDocsByIndex.set(document.doc_index, document);
                searchedDocuments += 1;
                if (sitegraphDocumentMatchesFilters(document, filters, now) && documentMatchesFullScan(document, matchPhrases)) {
                    telemetry.fullScanMatchDocIndices.add(document.doc_index);
                    const baseScore = scores.get(document.doc_index) ?? 24;
                    verifyMatches.push(rankSitegraphDocument(document, trimmed, terms, baseScore));
                }
            }
        });

        if (firstShardError) {
            if (isAbortError(firstShardError)) throw firstShardError;
            const failedCoverage = coverageFor(
                session,
                'error',
                FULL_SCAN_FIELDS,
                provedNoMatchShards,
                scannedShards,
                searchedDocuments,
                totalScopeShards,
                totalScopeDocuments,
                localIndexBytes,
                hydratedShardBytes,
                filterBytes,
                usedBodyIndex,
                false,
                scoped,
                proofLedgerEntries,
                cacheStats
            );
            emitResults('error', failedCoverage, true);
            throw firstShardError;
        }

        const progressCoverage = coverageFor(
            session,
            'partial_verified',
            FULL_SCAN_FIELDS,
            provedNoMatchShards,
            scannedShards,
            searchedDocuments,
            totalScopeShards,
            totalScopeDocuments,
            localIndexBytes,
            hydratedShardBytes,
            filterBytes,
            usedBodyIndex,
            false,
            scoped,
            proofLedgerEntries,
            cacheStats
        );
        if (mergeRankedResults(resultMap, verifyMatches) > 0) {
            emitResults('partial_verified', progressCoverage, true);
        } else {
            emitResults('partial_verified', progressCoverage, false);
        }
        await yieldToWorker();
    }

    const ledgerComplete = proofLedgerSummary(proofLedgerEntries, {
        totalShards: totalScopeShards,
        scannedShards,
        provedNoMatchShards,
        exhaustiveComplete: true,
    }).complete;
    const completePhase = scoped ? 'scoped_exhaustive_complete' : 'global_exhaustive_complete';
    const completeCoverage = coverageFor(
        session,
        completePhase,
        FULL_SCAN_FIELDS,
        provedNoMatchShards,
        scannedShards,
        searchedDocuments,
        totalScopeShards,
        totalScopeDocuments,
        localIndexBytes,
        hydratedShardBytes,
        filterBytes,
        usedBodyIndex,
        ledgerComplete,
        scoped,
        proofLedgerEntries,
        cacheStats
    );
    emitResults(completePhase, completeCoverage, true);
};

export const recallSitegraphDocuments = async (
    session: SitegraphRoutedSession,
    query: string,
    signal: AbortSignal,
    limit = 30
): Promise<{ results: RankedSitegraphDocument[]; stats: SitegraphQueryStats }> => {
    const resultEvents: SitegraphSearchEvent[] = [];
    await searchSitegraphProgressively(session, query, signal, event => {
        if (event.results) resultEvents.push(event);
    }, { limit });
    const finalEvent = resultEvents[resultEvents.length - 1];
    if (!finalEvent?.stats) {
        throw new SearchContractError('Progressive routed search completed without a result event');
    }
    return {
        results: finalEvent.results || [],
        stats: finalEvent.stats,
    };
};
