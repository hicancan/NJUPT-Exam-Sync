import type {
    RankedSitegraphDocument,
    SitegraphArtifactCacheStats,
    SitegraphDocMeta,
    SitegraphFullDocument,
    SitegraphProofLedgerEntry,
    SitegraphQueryPlan,
    SitegraphQueryStats,
    SitegraphRoutedSession,
    SitegraphSearchCoverage,
    SitegraphSearchFilters,
    SitegraphSearchPhase,
    SitegraphSortMode
} from '@njupt-search/contracts/search-index';
import type { ArtifactContentCache } from './fetchJson';
import { sitegraphDocumentMatchesFilters } from './sitegraphFilters';
import { rankingDateSortValue, rankSitegraphDocument } from './ranking/rankDocument';
import { SearchContractError } from './sitegraphContract';
import type { HotQueryRankedDocumentPayload } from './sitegraphHotQuery';
import { SHARD_BATCH_SIZE, type SearchTelemetry } from './sitegraphSearchTypes';
import { loadShard } from './sitegraphArtifactLoaders';
import { fullScanBlob } from './sitegraphImpactRuntime';
import { createCacheStats, snapshotCacheStats, throwIfAborted, yieldToWorker } from './sitegraphRuntimeFetch';
import { shardCache } from './sitegraphRuntimeCaches';
import { proofLedgerSummary } from './sitegraphProofLedgerRuntime';
import { firstScreenBytes } from './sitegraphQueryPlanning';
import { sortedScoreEntries } from './sitegraphScoreRuntime';

export const candidateShardPaths = (
    docsByIndex: Map<number, SitegraphDocMeta>,
    scores: Map<number, number>,
    shardPathById: Map<string, string>,
    candidateLimit: number,
    maxShardLoads: number,
    filters: SitegraphSearchFilters,
    now: number
): { indices: number[]; paths: string[] } => {
    const indices: number[] = [];
    const paths: string[] = [];
    const seenPaths = new Set<string>();
    for (const [docIndex] of sortedScoreEntries(scores).slice(0, candidateLimit)) {
        const meta = docsByIndex.get(docIndex);
        if (!meta?.shard?.shard_id) continue;
        if (!sitegraphDocumentMatchesFilters(meta, filters, now)) continue;
        const shardPath = meta.shard.path || shardPathById.get(meta.shard.shard_id);
        if (!shardPath) continue;
        const isNewShard = !seenPaths.has(shardPath);
        if (isNewShard && seenPaths.size >= maxShardLoads) continue;
        indices.push(docIndex);
        if (isNewShard) {
            seenPaths.add(shardPath);
            paths.push(shardPath);
        }
    }
    return { indices, paths };
};

export const loadShardBatch = async (
    paths: string[],
    signal: AbortSignal,
    loadedShardPaths: Set<string>,
    fullDocsByIndex: Map<number, SitegraphFullDocument>,
    shardBytesByPath: Map<string, number>,
    cacheStats: SitegraphArtifactCacheStats,
    artifactCache?: ArtifactContentCache
): Promise<void> => {
    for (let index = 0; index < paths.length; index += SHARD_BATCH_SIZE) {
        throwIfAborted(signal);
        const batch = paths.slice(index, index + SHARD_BATCH_SIZE);
        const shardResults = await Promise.all(batch.map(path => loadShard(
            path,
            signal,
            cacheStats,
            shardBytesByPath.get(path) || 0,
            artifactCache
        )));
        shardResults.forEach((documents, batchIndex) => {
            const path = batch[batchIndex];
            if (path) loadedShardPaths.add(path);
            for (const document of documents) {
                fullDocsByIndex.set(document.doc_index, document);
            }
        });
        await yieldToWorker();
    }
};

export const sortRankedResults = (
    results: RankedSitegraphDocument[],
    sortMode: SitegraphSortMode = 'relevance'
): RankedSitegraphDocument[] => {
    return results.sort((a, b) => {
        const dateDelta = rankingDateSortValue(b) - rankingDateSortValue(a);
        if (sortMode === 'date_desc' && dateDelta !== 0) return dateDelta;
        const scoreDelta = b.score - a.score;
        if (scoreDelta !== 0) return scoreDelta;
        if (dateDelta !== 0) return dateDelta;
        return a.id.localeCompare(b.id);
    });
};

export const mergeRankedResults = (
    resultMap: Map<string, RankedSitegraphDocument>,
    incoming: RankedSitegraphDocument[]
): number => {
    let addedOrImproved = 0;
    for (const result of incoming) {
        const existing = resultMap.get(result.id);
        if (!existing || result.score > existing.score) {
            resultMap.set(result.id, result);
            addedOrImproved += 1;
        }
    }
    return addedOrImproved;
};

export const loadedBytesFor = (
    session: SitegraphRoutedSession,
    localIndexBytes: number,
    hydratedShardBytes: number,
    filterBytes: number
): number => firstScreenBytes(session) + localIndexBytes + hydratedShardBytes + filterBytes;

export const rankedSnapshot = (
    resultMap: Map<string, RankedSitegraphDocument>,
    stats: SitegraphQueryStats,
    limit: number,
    sortMode: SitegraphSortMode
): RankedSitegraphDocument[] => {
    return sortRankedResults(Array.from(resultMap.values()), sortMode)
        .slice(0, limit)
        .map(result => ({ ...result, query_stats: stats }));
};

export const coverageFor = (
    session: SitegraphRoutedSession,
    phase: SitegraphSearchPhase,
    searchedFields: string[],
    provedNoMatchShards: number,
    scannedShards: number,
    searchedDocuments: number,
    totalShards: number,
    totalDocuments: number,
    localIndexBytes: number,
    hydratedShardBytes: number,
    filterBytes: number,
    usedBodyIndex: boolean,
    exhaustiveComplete: boolean,
    scoped: boolean,
    ledgerEntries: SitegraphProofLedgerEntry[] | null = null,
    cacheStats: SitegraphArtifactCacheStats = createCacheStats()
): SitegraphSearchCoverage => {
    const ledger = proofLedgerSummary(ledgerEntries, {
        totalShards,
        scannedShards,
        provedNoMatchShards,
        exhaustiveComplete,
    });
    const cache = snapshotCacheStats(cacheStats);
    return {
        phase,
        coverage_state: phase,
        scope: scoped ? 'scoped' : 'global',
        searched_fields: searchedFields,
        proved_no_match_shards: ledger.proved_no_match_shards,
        scanned_shards: ledger.scanned_shards,
        excluded_by_filter_shards: ledger.excluded_by_filter_shards,
        excluded_by_declared_scope_shards: ledger.excluded_by_declared_scope_shards,
        pending_shards: ledger.pending_shards,
        failed_shards: ledger.failed_shards,
        total_shards: ledger.total_shards,
        searched_documents: searchedDocuments,
        total_documents: totalDocuments,
        loaded_bytes: loadedBytesFor(session, localIndexBytes, hydratedShardBytes, filterBytes),
        uncached_loaded_bytes: cache.uncached_bytes,
        cached_artifact_bytes: cache.cached_bytes,
        first_screen_bytes: firstScreenBytes(session),
        local_index_bytes: localIndexBytes,
        hydrated_shard_bytes: hydratedShardBytes,
        used_body_index: usedBodyIndex,
        exhaustive_complete: exhaustiveComplete && ledger.complete,
        proof_ledger: ledger,
        cache,
    };
};

export const statsFor = (
    phase: SitegraphSearchPhase,
    coverage: SitegraphSearchCoverage,
    plan: SitegraphQueryPlan,
    loadedLocalIndexIds: Set<string>,
    loadedShardPaths: Set<string>,
    candidateCount: number,
    resultMap: Map<string, RankedSitegraphDocument>,
    telemetry: SearchTelemetry,
    provenResultCount?: number
): SitegraphQueryStats => {
    const certificateBytes = Math.max(
        0,
        coverage.loaded_bytes
        - coverage.first_screen_bytes
        - coverage.local_index_bytes
        - coverage.hydrated_shard_bytes
    );
    const pruningLedger = {
        model: 'block_upper_bound_threshold_v1' as const,
        dynamicPruning: telemetry.retrieval.dynamicPruning,
        impactBlocksVisited: telemetry.retrieval.impactBlocksVisited,
        impactBlocksPruned: telemetry.retrieval.impactBlocksPruned,
        postingsVisited: telemetry.retrieval.postingsVisited,
        postingsPruned: telemetry.retrieval.postingsPruned,
        competitiveThreshold: telemetry.retrieval.competitiveThreshold,
    };
    return {
        phase,
        coverage,
        plan,
        usedBodyIndex: coverage.used_body_index,
        loadedLocalIndexCount: loadedLocalIndexIds.size,
        loadedLocalIndexIds: Array.from(loadedLocalIndexIds).sort(),
        loadedShardCount: loadedShardPaths.size,
        loadedShardPaths: Array.from(loadedShardPaths).sort(),
        candidateCount,
        exhaustiveComplete: coverage.exhaustive_complete,
        resultCount: provenResultCount ?? resultMap.size,
        localIndexBytes: coverage.local_index_bytes,
        hydratedShardBytes: coverage.hydrated_shard_bytes,
        uncachedLoadedBytes: coverage.uncached_loaded_bytes,
        cachedArtifactBytes: coverage.cached_artifact_bytes,
        cache: coverage.cache,
        proof_pressure: {
            totalShards: coverage.total_shards,
            scannedShards: coverage.scanned_shards,
            provedNoMatchShards: coverage.proved_no_match_shards,
            pendingShards: coverage.pending_shards,
            failedShards: coverage.failed_shards,
            localIndexBytes: coverage.local_index_bytes,
            hydratedShardBytes: coverage.hydrated_shard_bytes,
            certificateBytes,
            loadedBytes: coverage.loaded_bytes,
            uncachedLoadedBytes: coverage.uncached_loaded_bytes,
        },
        fallbacks: {
            localMetaFallbackDocuments: telemetry.localMetaFallbackDocIndices.size,
            snippetFallbackResults: Array.from(resultMap.values()).filter(result => result.match_snippet?.fallback === true).length,
            verifiedFullScanMatches: telemetry.fullScanMatchDocIndices.size,
        },
        retrieval: {
            ...telemetry.retrieval,
            pruning_ledger_summary: pruningLedger,
        },
    };
};

export const documentMatchesFullScan = (document: SitegraphFullDocument, matchPhrases: string[]): boolean => {
    const blob = fullScanBlob(document);
    return matchPhrases.some(term => blob.includes(term));
};

export const hotQueryRankBaseScore = (document: SitegraphFullDocument): number => {
    const value = (document as HotQueryRankedDocumentPayload).rank_base_score;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new SearchContractError(`Hot query proof document ${document.id} is missing rank_base_score`);
    }
    return value;
};

export const rankHydratedCandidates = (
    indices: number[],
    fullDocsByIndex: Map<number, SitegraphFullDocument>,
    scores: Map<number, number>,
    query: string,
    terms: string[],
    matchPhrases: string[],
    filters: SitegraphSearchFilters,
    now: number
): RankedSitegraphDocument[] => {
    return indices
        .map(docIndex => {
            const document = fullDocsByIndex.get(docIndex);
            return document
                && sitegraphDocumentMatchesFilters(document, filters, now)
                && documentMatchesFullScan(document, matchPhrases)
                ? rankSitegraphDocument(document, query, terms, scores.get(docIndex) || 0)
                : null;
        })
        .filter((item): item is RankedSitegraphDocument => Boolean(item));
};

export const hydrateCandidatePhase = async (
    docsByIndex: Map<number, SitegraphDocMeta>,
    shardPathById: Map<string, string>,
    scores: Map<number, number>,
    query: string,
    terms: string[],
    signal: AbortSignal,
    loadedShardPaths: Set<string>,
    fullDocsByIndex: Map<number, SitegraphFullDocument>,
    shardBytesByPath: Map<string, number>,
    cacheStats: SitegraphArtifactCacheStats,
    candidateLimit: number,
    maxShardLoads: number,
    matchPhrases: string[],
    filters: SitegraphSearchFilters,
    now: number,
    artifactCache?: ArtifactContentCache
): Promise<{ ranked: RankedSitegraphDocument[]; candidateCount: number }> => {
    const candidates = candidateShardPaths(docsByIndex, scores, shardPathById, candidateLimit, maxShardLoads, filters, now);
    const pathsToLoad = candidates.paths.filter(path => !loadedShardPaths.has(path));
    await loadShardBatch(pathsToLoad, signal, loadedShardPaths, fullDocsByIndex, shardBytesByPath, cacheStats, artifactCache);
    return {
        ranked: rankHydratedCandidates(candidates.indices, fullDocsByIndex, scores, query, terms, matchPhrases, filters, now),
        candidateCount: candidates.indices.length,
    };
};

export const loadedShardDocuments = (
    path: string,
    fullDocsByIndex: Map<number, SitegraphFullDocument>
): SitegraphFullDocument[] | null => {
    const cached = shardCache.get(path);
    if (cached) return cached;
    const documents = Array.from(fullDocsByIndex.values()).filter(document => {
        const shard = document.shard && typeof document.shard === 'object'
            ? document.shard as { path?: unknown }
            : null;
        return shard?.path === path;
    });
    return documents.length > 0 ? documents : null;
};
