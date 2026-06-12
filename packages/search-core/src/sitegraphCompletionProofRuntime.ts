import type {
    RankedSitegraphDocument,
    SitegraphArtifactCacheStats,
    SitegraphFullDocument,
    SitegraphQueryPlan,
    SitegraphRoutedSession,
    SitegraphSearchCoverage,
    SitegraphSearchFilters,
    SitegraphSearchPhase,
    SitegraphSourceManifest
} from '@njupt-search/contracts/search-index';
import type { ArtifactContentCache } from './fetchJson';
import { sitegraphDocumentMatchesFilters } from './sitegraphFilters';
import { rankSitegraphDocument } from './ranking/rankDocument';
import {
    loadProofCatalog,
    loadShard,
    loadShardFilter,
    loadSourceManifest,
    verificationShardFromFullShard,
    verificationShardFromProofCatalog
} from './sitegraphArtifactLoaders';
import type { ShardFilterMap } from './sitegraphShardFilter';
import { sourceEntriesById } from './sitegraphQueryPlanning';
import {
    FULL_SCAN_FIELDS,
    SHARD_BATCH_SIZE,
    type SearchTelemetry,
    type VerificationShard
} from './sitegraphSearchTypes';
import {
    coverageFor,
    documentMatchesFullScan,
    loadedShardDocuments,
    mergeRankedResults
} from './sitegraphResultRuntime';
import {
    buildProofLedger,
    proofLedgerSummary,
    setLedgerState,
    shardFilterProvesNoMatch
} from './sitegraphProofLedgerRuntime';
import { isAbortError, throwIfAborted, yieldToWorker } from './sitegraphRuntimeFetch';

type CompletionProofEmitter = (
    type: SitegraphSearchPhase,
    coverage: SitegraphSearchCoverage,
    includeResults: boolean,
    provenResultCount?: number
) => void;

export interface CompletionProofInput {
    session: SitegraphRoutedSession;
    signal: AbortSignal;
    trimmed: string;
    terms: string[];
    matchPhrases: string[];
    filters: SitegraphSearchFilters;
    now: number;
    plan: SitegraphQueryPlan;
    scoped: boolean;
    loadedShardPaths: Set<string>;
    fullDocsByIndex: Map<number, SitegraphFullDocument>;
    scores: Map<number, number>;
    resultMap: Map<string, RankedSitegraphDocument>;
    cacheStats: SitegraphArtifactCacheStats;
    telemetry: SearchTelemetry;
    planningSourceManifests: SitegraphSourceManifest[];
    artifactCache?: ArtifactContentCache;
    localIndexBytes: number;
    hydratedShardBytes: number;
    filterBytes: number;
    usedBodyIndex: boolean;
    emitResults: CompletionProofEmitter;
}

export const runCompletionProof = async ({
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
    planningSourceManifests,
    artifactCache,
    localIndexBytes: initialLocalIndexBytes,
    hydratedShardBytes: initialHydratedShardBytes,
    filterBytes: initialFilterBytes,
    usedBodyIndex,
    emitResults,
}: CompletionProofInput): Promise<void> => {
    let localIndexBytes = initialLocalIndexBytes;
    let hydratedShardBytes = initialHydratedShardBytes;
    let filterBytes = initialFilterBytes;
    const verificationEntries = sourceEntriesById(session);
    const verificationManifests: SitegraphSourceManifest[] = [];
    const allVerificationShards: VerificationShard[] = [];
    for (const sourceId of plan.verification_source_ids) {
        const entry = verificationEntries.get(sourceId);
        if (!entry) continue;
        const sourceManifest = await loadSourceManifest(entry, signal, cacheStats, artifactCache);
        verificationManifests.push(sourceManifest);
        if (!planningSourceManifests.some(item => item.source_id === sourceManifest.source_id)) {
            localIndexBytes += entry.artifact_manifest.bytes;
        }
        const proofCatalog = await loadProofCatalog(sourceManifest, signal, cacheStats, artifactCache);
        filterBytes += sourceManifest.artifacts.proof_catalog?.bytes || 0;
        allVerificationShards.push(...proofCatalog.shards.map(verificationShardFromProofCatalog));
    }
    if (allVerificationShards.length === 0) {
        allVerificationShards.push(...verificationManifests.flatMap(sourceManifest => sourceManifest.full_shards.map(verificationShardFromFullShard)));
    }
    const proofLedgerEntries = buildProofLedger(allVerificationShards, filters, now);
    const inScopeShards = allVerificationShards
        .filter(shard => proofLedgerEntries.find(entry => entry.shard_id === shard.shard_id)?.state === 'pending');
    const totalScopeShards = proofLedgerEntries.length;
    const totalScopeDocuments = inScopeShards.reduce((sum, shard) => sum + shard.count, 0);
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
        proofLedgerEntries.find(entry => entry.shard_id === shard.shard_id)?.state === 'pending'
    ));
    for (let shardIndex = 0; shardIndex < pendingVerificationShards.length; shardIndex += SHARD_BATCH_SIZE) {
        throwIfAborted(signal);
        const shardBatch = pendingVerificationShards.slice(shardIndex, shardIndex + SHARD_BATCH_SIZE);
        const scanBatch = shardBatch.filter(shard => {
            const canSkip = shardFilterProvesNoMatch(shard.shard_id, shardFiltersBySource.get(String(shard.source_id || '')) || {}, matchPhrases);
            if (canSkip) {
                provedNoMatchShards += 1;
                setLedgerState(proofLedgerEntries, shard.shard_id, 'proved_no_match', 'no-false-negative shard filter proved every full-scan phrase absent');
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
                setLedgerState(proofLedgerEntries, shard.shard_id, 'failed', result.reason instanceof Error ? result.reason.message : 'failed to load full shard for completion proof');
                return;
            }
            const documents = result.value;
            const firstLoad = !loadedShardPaths.has(shard.path);
            loadedShardPaths.add(shard.path);
            if (firstLoad) hydratedShardBytes += shardBytesByPath.get(shard.path) || 0;
            scannedShards += 1;
            setLedgerState(proofLedgerEntries, shard.shard_id, 'scanned', 'full shard scanned for completion proof');
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
