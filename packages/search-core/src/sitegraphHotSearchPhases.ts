import type {
    RankedSitegraphDocument,
    SitegraphArtifactCacheStats,
    SitegraphProofLedgerEntry,
    SitegraphQueryPlan,
    SitegraphRoutedSession,
    SitegraphSearchCoverage,
    SitegraphSearchEvent,
    SitegraphSearchFilters,
    SitegraphSearchPhase,
    SitegraphSortMode
} from '@njupt-search/contracts/search-index';
import { sitegraphDocumentMatchesFilters } from './sitegraphFilters';
import { rankSitegraphDocument } from './ranking/rankDocument';
import { SearchContractError } from './sitegraphContract';
import { BODY_SEARCH_FIELDS, FULL_SCAN_FIELDS, type SearchTelemetry, type RoutedSessionWithArtifactCache } from './sitegraphSearchTypes';
import { coverageFor, documentMatchesFullScan, hotQueryRankBaseScore, mergeRankedResults, rankedSnapshot, statsFor } from './sitegraphResultRuntime';
import { buildHotQueryScopedLedger, hotQueryProofDirectoryArtifact, loadMatchingHotQueryProof, loadMatchingHotQueryTopProof } from './sitegraphHotProofRuntime';
import { loadVerificationShardsForScope } from './sitegraphArtifactLoaders';
import { proofLedgerSummary } from './sitegraphProofLedgerRuntime';

interface HotSearchPhaseContext {
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

type RuntimePhaseEmitter = (
    type: SitegraphSearchPhase,
    coverage: SitegraphSearchCoverage,
    includeResults: boolean,
    provenResultCount?: number
) => void;

interface GlobalHotCompletionProofState {
    localIndexBytes: number;
    hydratedShardBytes: number;
    filterBytes: number;
    usedBodyIndex: boolean;
    emitResults: RuntimePhaseEmitter;
}

const emptyLocalIds = new Set<string>();
const emptyShardPaths = new Set<string>();

const emitHotResults = (
    context: HotSearchPhaseContext,
    type: SitegraphSearchPhase,
    coverage: SitegraphSearchCoverage,
    resultMap: Map<string, RankedSitegraphDocument>,
    candidateCount: number,
    provenResultCount?: number
): void => {
    const stats = statsFor(
        type,
        coverage,
        context.plan,
        emptyLocalIds,
        emptyShardPaths,
        candidateCount,
        resultMap,
        context.telemetry,
        provenResultCount
    );
    context.emit({
        type,
        query: context.trimmed,
        coverage,
        stats,
        results: rankedSnapshot(resultMap, stats, context.limit, context.sortMode),
    });
};

const setHotPlan = (plan: SitegraphQueryPlan, estimatedCostBytes: number): void => {
    plan.selected_local_indexes = [];
    plan.phase_local_index_ids = {
        first_trusted_results: [],
        top_results_hydrated: [],
        proof_complete: [],
    };
    plan.estimated_cost_bytes = estimatedCostBytes;
};

export const tryEmitScopedHotQueryProof = async (context: HotSearchPhaseContext, signal: AbortSignal): Promise<boolean> => {
    const hotCompleteProof = await loadMatchingHotQueryProof(
        context.session as RoutedSessionWithArtifactCache,
        context.normalizedQuery,
        signal,
        context.cacheStats
    );
    if (!hotCompleteProof) return false;

    const { certificate, bytes } = hotCompleteProof;
    const certificateMatches = certificate.documents;
    if (certificateMatches.length !== certificate.match_count) {
        throw new SearchContractError(`Hot query proof certificate ${certificate.normalized_query} match count does not match proof documents`);
    }
    const scopedMatches = certificateMatches.filter(document => sitegraphDocumentMatchesFilters(document, context.filters, context.now));
    const scopedTopProof = await loadMatchingHotQueryTopProof(
        context.session as RoutedSessionWithArtifactCache,
        context.normalizedQuery,
        signal,
        context.cacheStats
    );
    const scopedTopMatches = scopedTopProof
        ? scopedTopProof.certificate.documents.filter(document => (
            documentMatchesFullScan(document, scopedTopProof.certificate.match_phrases)
            && sitegraphDocumentMatchesFilters(document, context.filters, context.now)
        ))
        : [];
    const scopedTopCertificateCanDisplay = scopedMatches.length === 0 || scopedTopMatches.length > 0;
    if (!scopedTopCertificateCanDisplay) return false;

    const resultMap = new Map<string, RankedSitegraphDocument>();
    const scopedRanked = scopedTopMatches.map(document => rankSitegraphDocument(
        document,
        context.trimmed,
        context.terms,
        hotQueryRankBaseScore(document)
    ));
    mergeRankedResults(resultMap, scopedRanked);

    const verificationScope = await loadVerificationShardsForScope(
        context.session as RoutedSessionWithArtifactCache,
        context.plan.verification_source_ids,
        signal,
        context.cacheStats
    );
    const scopedProof = buildHotQueryScopedLedger(verificationScope.shards, certificateMatches, certificate.matched_shards, context.filters, context.now);
    const proofLedgerEntries: SitegraphProofLedgerEntry[] = scopedProof.entries;
    const scopedLedger = proofLedgerSummary(proofLedgerEntries, {
        totalShards: proofLedgerEntries.length,
        scannedShards: 0,
        provedNoMatchShards: 0,
        exhaustiveComplete: true,
    });
    const filterBytes = bytes + verificationScope.verificationBytes;
    const totalScopeShards = scopedLedger.total_shards;
    const totalScopeDocuments = scopedProof.inScopeDocumentCount;
    setHotPlan(context.plan, filterBytes);

    const firstCoverage = coverageFor(
        context.session,
        'first_trusted_results',
        BODY_SEARCH_FIELDS,
        0,
        scopedLedger.scanned_shards,
        scopedMatches.length,
        totalScopeShards,
        totalScopeDocuments,
        0,
        0,
        filterBytes,
        false,
        false,
        true,
        null,
        context.cacheStats
    );
    emitHotResults(context, 'first_trusted_results', firstCoverage, resultMap, scopedMatches.length);

    const topCoverage = coverageFor(
        context.session,
        'top_results_hydrated',
        BODY_SEARCH_FIELDS,
        0,
        scopedLedger.scanned_shards,
        scopedMatches.length,
        totalScopeShards,
        totalScopeDocuments,
        0,
        0,
        filterBytes,
        false,
        false,
        true,
        null,
        context.cacheStats
    );
    emitHotResults(context, 'top_results_hydrated', topCoverage, resultMap, scopedMatches.length);

    const completeCoverage = coverageFor(
        context.session,
        'scoped_exhaustive_complete',
        FULL_SCAN_FIELDS,
        scopedLedger.proved_no_match_shards,
        scopedLedger.scanned_shards,
        scopedMatches.length,
        totalScopeShards,
        totalScopeDocuments,
        0,
        0,
        filterBytes,
        false,
        true,
        true,
        proofLedgerEntries,
        context.cacheStats
    );
    emitHotResults(context, 'scoped_exhaustive_complete', completeCoverage, resultMap, scopedMatches.length, scopedMatches.length);
    return true;
};

export const tryEmitGlobalHotTopProof = async (context: HotSearchPhaseContext, signal: AbortSignal): Promise<boolean> => {
    const hotTopProof = await loadMatchingHotQueryTopProof(
        context.session as RoutedSessionWithArtifactCache,
        context.normalizedQuery,
        signal,
        context.cacheStats
    );
    if (!hotTopProof) return false;

    const topCertificate = hotTopProof.certificate;
    const topMatches = topCertificate.documents.filter(document => documentMatchesFullScan(document, topCertificate.match_phrases));
    if (topMatches.length !== topCertificate.documents.length || topMatches.length !== topCertificate.top_k_count) {
        throw new SearchContractError(`Hot query top-k proof certificate ${topCertificate.normalized_query} failed full-scan self-check`);
    }
    const resultMap = new Map<string, RankedSitegraphDocument>();
    const topRanked = topMatches.map(document => rankSitegraphDocument(
        document,
        context.trimmed,
        context.terms,
        hotQueryRankBaseScore(document)
    ));
    mergeRankedResults(resultMap, topRanked);
    let filterBytes = hotTopProof.bytes;
    setHotPlan(context.plan, hotTopProof.bytes);

    const firstCoverage = coverageFor(
        context.session,
        'first_trusted_results',
        BODY_SEARCH_FIELDS,
        0,
        topCertificate.matched_shard_count,
        topMatches.length,
        topCertificate.total_shards,
        topCertificate.total_documents,
        0,
        0,
        filterBytes,
        false,
        false,
        false,
        null,
        context.cacheStats
    );
    emitHotResults(context, 'first_trusted_results', firstCoverage, resultMap, topMatches.length);

    const topCoverage = coverageFor(
        context.session,
        'top_results_hydrated',
        BODY_SEARCH_FIELDS,
        0,
        topCertificate.matched_shard_count,
        topMatches.length,
        topCertificate.total_shards,
        topCertificate.total_documents,
        0,
        0,
        filterBytes,
        false,
        false,
        false,
        null,
        context.cacheStats
    );
    emitHotResults(context, 'top_results_hydrated', topCoverage, resultMap, topMatches.length);

    const hotCompleteProof = await loadMatchingHotQueryProof(
        context.session as RoutedSessionWithArtifactCache,
        context.normalizedQuery,
        signal,
        context.cacheStats
    );
    if (!hotCompleteProof) {
        throw new SearchContractError(`Hot query top-k proof ${topCertificate.normalized_query} is missing its complete certificate`);
    }
    const { certificate } = hotCompleteProof;
    const certificateMatches = certificate.documents;
    if (certificateMatches.length !== certificate.match_count) {
        throw new SearchContractError(`Hot query proof certificate ${certificate.normalized_query} match count does not match proof documents`);
    }
    const directoryBytes = hotQueryProofDirectoryArtifact(context.session)?.bytes ?? 0;
    filterBytes += Math.max(0, hotCompleteProof.bytes - directoryBytes);
    const matchedShardCount = certificate.matched_shard_count;
    const provedNoMatchShards = Math.max(0, certificate.total_shards - matchedShardCount);
    const completeCoverage = coverageFor(
        context.session,
        'global_exhaustive_complete',
        FULL_SCAN_FIELDS,
        provedNoMatchShards,
        matchedShardCount,
        certificate.match_count,
        certificate.total_shards,
        certificate.total_documents,
        0,
        0,
        filterBytes,
        false,
        true,
        false,
        null,
        context.cacheStats
    );
    emitHotResults(context, 'global_exhaustive_complete', completeCoverage, resultMap, certificate.match_count, certificate.match_count);
    return true;
};

export const tryEmitGlobalHotCompletionProof = async (
    context: HotSearchPhaseContext,
    signal: AbortSignal,
    state: GlobalHotCompletionProofState
): Promise<boolean> => {
    const hotProof = await loadMatchingHotQueryProof(
        context.session as RoutedSessionWithArtifactCache,
        context.normalizedQuery,
        signal,
        context.cacheStats
    );
    if (!hotProof) return false;

    const { certificate, bytes } = hotProof;
    const certificateMatches = certificate.documents;
    if (certificateMatches.length !== certificate.match_count) {
        throw new SearchContractError(`Hot query proof certificate ${certificate.normalized_query} match count does not match proof documents`);
    }
    const filterBytes = state.filterBytes + bytes;
    const matchedShardCount = certificate.matched_shard_count;
    const provedNoMatchShards = Math.max(0, certificate.total_shards - matchedShardCount);
    const completeCoverage = coverageFor(
        context.session,
        'global_exhaustive_complete',
        FULL_SCAN_FIELDS,
        provedNoMatchShards,
        matchedShardCount,
        certificate.match_count,
        certificate.total_shards,
        certificate.total_documents,
        state.localIndexBytes,
        state.hydratedShardBytes,
        filterBytes,
        state.usedBodyIndex,
        true,
        false,
        null,
        context.cacheStats
    );
    state.emitResults('global_exhaustive_complete', completeCoverage, true, certificate.match_count);
    return true;
};
