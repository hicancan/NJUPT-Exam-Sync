import { APP_CONFIG } from '@/app/config/constants';
import {
    RankedSitegraphDocument,
    SitegraphArtifactCacheStats,
    SitegraphQueryPlan,
    SitegraphQueryStats,
    SitegraphRoutedSession,
    SitegraphSearchFilters,
    SitegraphSearchCoverage,
    SitegraphSearchManifest,
    SitegraphSortMode,
} from '@/shared/lib/contracts';
import { fetchJson } from '@/shared/lib/fetch';
import {
    clearSitegraphRuntimeCaches,
    createBrowserContentHashArtifactCache,
    fetchJsonArtifact,
    normalizeSearchText,
    parseHotQueryFastStartIndex,
    parseHotQueryInitialCertificate,
    parseSitegraphGlobalQueryDirectory,
    parseSitegraphManifest,
    parseSitegraphSourceRegistry,
    rankSitegraphDocument,
    resolveHotQueryFastStartEntry,
    searchSitegraphProgressively,
    tokenizeSitegraphQuery,
} from '@njupt-search/search-core';
import type {
    ArtifactFetchResult,
    ArtifactContentCache,
    HotQueryInitialCertificate,
    PackedImpactRetrievalMetrics,
    PackedImpactRetrievalResult,
    PackedImpactRetriever,
} from '@njupt-search/search-core';
import initPackedImpactDecoder, {
    PackedImpactRetrievalSession as WasmPackedImpactRetrievalSession,
    retrieve_packed_impact_topk_scores,
} from '../wasm/packed_impact_decoder.js';
import packedImpactDecoderUrl from '../wasm/packed_impact_decoder_bg.wasm?url';

type InitMessage = { type: 'init'; requestId: number };
type QueryMessage = {
    type: 'query';
    requestId: number;
    query: string;
    limit?: number;
    sortMode?: SitegraphSortMode;
    filters?: SitegraphSearchFilters;
};
type CancelMessage = { type: 'cancel'; requestId: number };
type IncomingMessage = InitMessage | QueryMessage | CancelMessage;

let manifest: SitegraphSearchManifest | null = null;
type CachedRoutedSession = SitegraphRoutedSession & {
    artifactCache?: ArtifactContentCache;
    packedImpactRetriever?: PackedImpactRetriever;
};

let session: CachedRoutedSession | null = null;
let activeController: AbortController | null = null;
let activeRequestId: number | null = null;
let lastCoverage: SitegraphSearchCoverage | null = null;
const artifactCache = createBrowserContentHashArtifactCache('njupt-public');
let packedImpactDecoderReady: Promise<unknown> | null = null;

const post = (payload: Record<string, unknown>) => {
    self.postMessage(payload);
};

const publicPath = (path: string): string => {
    if (/^https?:\/\//.test(path) || path.startsWith('/')) return path;
    return `/${path}`;
};

const isRecoverableArtifactError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return /\/generated\/collections\/njupt-public\/.+ HTTP (404|408|409|425|429|500|502|503|504)\b/.test(message);
};

const ensurePackedImpactDecoder = (): Promise<unknown> => {
    packedImpactDecoderReady ??= initPackedImpactDecoder(packedImpactDecoderUrl);
    return packedImpactDecoderReady;
};

const numeric = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;

const parseScoreEntries = (value: unknown): Array<readonly [number, number]> => {
    if (!Array.isArray(value)) return [];
    const entries: Array<readonly [number, number]> = [];
    for (const item of value) {
        if (!Array.isArray(item)) continue;
        const docIndex = numeric(item[0]);
        const score = numeric(item[1]);
        if (Number.isInteger(docIndex) && score > 0) entries.push([docIndex, score]);
    }
    return entries;
};

const parsePackedImpactMetrics = (payload: unknown): PackedImpactRetrievalMetrics => {
    const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    return {
        matchedTermCount: numeric(record.matched_term_count),
        blockCount: numeric(record.block_count),
        candidateCount: numeric(record.candidate_count),
        impactBlocksVisited: numeric(record.impact_blocks_visited),
        impactBlocksPruned: numeric(record.impact_blocks_pruned),
        postingsVisited: numeric(record.postings_visited),
        postingsPruned: numeric(record.postings_pruned),
        competitiveThreshold: numeric(record.competitive_threshold),
    };
};

const parsePackedImpactRetrieval = (payload: unknown): PackedImpactRetrievalResult => {
    const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    return {
        ...parsePackedImpactMetrics(record),
        scoreEntries: parseScoreEntries(record.score_entries),
    };
};

const packedImpactRetriever: PackedImpactRetriever = {
    engine: 'rust_wasm_packed_impact',
    async createSession(targetCandidates) {
        await ensurePackedImpactDecoder();
        const wasmSession = new WasmPackedImpactRetrievalSession(targetCandidates);
        return {
            async applyPackedImpactScores(input) {
                const payload = wasmSession.apply(
                    new Uint8Array(input.bytes),
                    JSON.stringify(input.terms),
                );
                return parsePackedImpactMetrics(JSON.parse(payload) as unknown);
            },
            async readScoreEntries() {
                const payload = JSON.parse(wasmSession.scores_json()) as unknown;
                const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
                return parseScoreEntries(record.score_entries);
            },
        };
    },
    async retrievePackedImpactScores(input) {
        await ensurePackedImpactDecoder();
        const payload = retrieve_packed_impact_topk_scores(
            new Uint8Array(input.bytes),
            JSON.stringify(input.terms),
            input.targetCandidates,
        );
        return parsePackedImpactRetrieval(JSON.parse(payload) as unknown);
    },
};

const loadManifest = async (controller: AbortController): Promise<SitegraphSearchManifest> => {
    if (manifest) return manifest;
    const manifestPath = publicPath(APP_CONFIG.DATA_URLS.SEARCH_MANIFEST);
    const manifestPayload = await fetchJson(manifestPath, controller.signal, 'manifest');
    manifest = parseSitegraphManifest(manifestPayload, manifestPath);
    return manifest;
};

const cacheStatsFrom = (results: Array<ArtifactFetchResult<unknown>>): SitegraphArtifactCacheStats => {
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

const hotQueryRankBaseScore = (document: RankedSitegraphDocument | HotQueryInitialCertificate['documents'][number]): number => {
    const value = (document as { rank_base_score?: unknown }).rank_base_score;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Hot query initial document ${document.id} is missing rank_base_score`);
    }
    return value;
};

const isAllFilter = (value: unknown): boolean => value === undefined || value === null || value === '' || value === 'all';

const canUseFastStart = (
    queryText: string,
    sortMode: SitegraphSortMode,
    filters: SitegraphSearchFilters
): boolean => {
    return queryText.trim().length >= 2
        && sortMode === 'relevance'
        && isAllFilter(filters.sourceId)
        && isAllFilter(filters.facet)
        && isAllFilter(filters.dateRange);
};

const makeFastStartPlan = (
    queryText: string,
    certificate: HotQueryInitialCertificate,
    estimatedBytes: number
): SitegraphQueryPlan => ({
    normalized_query: normalizeSearchText(queryText),
    aliases: certificate.match_phrases,
    intent: 'hot_query_fast_start',
    authority_sources: [],
    expected_result_types: [],
    source_ids: [],
    local_index_ids: [],
    verification_source_ids: [],
    declared_completion_scope: 'global',
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
    certificate: HotQueryInitialCertificate
): SitegraphSearchCoverage => ({
    phase: 'first_trusted_results',
    coverage_state: 'first_trusted_results',
    scope: 'global',
    searched_fields: ['title', 'section', 'nav_path', 'summary', 'content', 'attachments', 'url'],
    proved_no_match_shards: 0,
    scanned_shards: certificate.matched_shard_count,
    excluded_by_filter_shards: 0,
    excluded_by_declared_scope_shards: 0,
    pending_shards: Math.max(0, certificate.total_shards - certificate.matched_shard_count),
    failed_shards: 0,
    total_shards: certificate.total_shards,
    searched_documents: certificate.top_k_count,
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
    traceId: string
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

const tryEmitFastStart = async (
    requestId: number,
    queryText: string,
    limit: number,
    sortMode: SitegraphSortMode,
    filters: SitegraphSearchFilters,
    controller: AbortController
): Promise<boolean> => {
    if (session || !canUseFastStart(queryText, sortMode, filters)) return false;
    const loadedManifest = await loadManifest(controller);
    const fastStartArtifact = loadedManifest.artifacts.hot_query_fast_start;
    const fastStartPayload = await fetchJsonArtifact(publicPath(fastStartArtifact.path), controller.signal, 'index', artifactCache);
    const fastStart = parseHotQueryFastStartIndex(fastStartPayload.value, fastStartArtifact.path);
    const match = resolveHotQueryFastStartEntry(fastStart, queryText);
    if (!match) return false;
    const initialArtifact = match.entry.initial_certificate;
    const initialPayload = await fetchJsonArtifact(publicPath(initialArtifact.path), controller.signal, 'index', artifactCache);
    const certificate = parseHotQueryInitialCertificate(initialPayload.value, initialArtifact.path);
    const terms = certificate.rank_terms?.length ? certificate.rank_terms : tokenizeSitegraphQuery(queryText);
    const results = certificate.documents
        .map(document => rankSitegraphDocument(document, queryText, terms, hotQueryRankBaseScore(document)))
        .slice(0, limit);
    const cache = cacheStatsFrom([fastStartPayload, initialPayload]);
    const loadedBytes = fastStartPayload.byteLength + initialPayload.byteLength;
    const traceId = `${fastStartArtifact.sha256.slice(0, 8)}:${initialArtifact.sha256.slice(0, 8)}:${match.matchedQuery}`;
    const coverage = makeFastStartCoverage(loadedBytes, cache, certificate);
    const plan = makeFastStartPlan(queryText, certificate, loadedBytes);
    const stats = makeFastStartStats(coverage, plan, results, traceId);
    lastCoverage = coverage;
    post({
        type: 'first_trusted_results',
        requestId,
        query: queryText.trim(),
        coverage,
        results: results.map(result => ({ ...result, query_stats: stats })),
        stats,
    });
    return true;
};

const loadSession = async (requestId: number, controller: AbortController, postReady = true) => {
    const loadedManifest = await loadManifest(controller);
    const artifacts = loadedManifest.artifacts;
    const [sourceRegistryPayload, queryDirectoryPayload, aliasesPayload] = await Promise.all([
        fetchJsonArtifact(publicPath(artifacts.source_registry.path), controller.signal, 'index', artifactCache),
        fetchJsonArtifact(publicPath(artifacts.global_query_directory.path), controller.signal, 'index', artifactCache),
        fetchJsonArtifact(publicPath(artifacts.query_aliases.path), controller.signal, 'index', artifactCache),
    ]);
    const sourceRegistry = parseSitegraphSourceRegistry(sourceRegistryPayload.value, artifacts.source_registry.path);
    session = {
        manifest: loadedManifest,
        sourceRegistry,
        globalQueryDirectory: parseSitegraphGlobalQueryDirectory(queryDirectoryPayload.value, artifacts.global_query_directory.path),
        queryAliases: aliasesPayload.value as Record<string, unknown>,
        artifactCache,
        packedImpactRetriever,
    };
    if (postReady) {
        post({
            type: 'ready',
            requestId,
            manifest: loadedManifest,
            filterOptions: sourceRegistry.filter_options,
            firstScreenBytes: artifacts.source_registry.bytes + artifacts.global_query_directory.bytes + artifacts.query_aliases.bytes,
            bootstrapCache: {
                scope: artifactCache.scope,
                artifact_hits: [sourceRegistryPayload, queryDirectoryPayload, aliasesPayload].filter(item => item.cacheHit).length,
                artifact_misses: [sourceRegistryPayload, queryDirectoryPayload, aliasesPayload].filter(item => !item.cacheHit).length,
                cached_bytes: [sourceRegistryPayload, queryDirectoryPayload, aliasesPayload]
                    .filter(item => item.cacheHit)
                    .reduce((sum, item) => sum + item.byteLength, 0),
                uncached_bytes: [sourceRegistryPayload, queryDirectoryPayload, aliasesPayload]
                    .filter(item => !item.cacheHit)
                    .reduce((sum, item) => sum + item.byteLength, 0),
            },
        });
    }
};

const init = async (requestId: number) => {
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    activeRequestId = requestId;
    await loadSession(requestId, controller);
};

const query = async (
    requestId: number,
    queryText: string,
    limit = 30,
    sortMode: SitegraphSortMode = 'relevance',
    filters: SitegraphSearchFilters = {}
) => {
    activeController?.abort();
    let controller = new AbortController();
    activeController = controller;
    activeRequestId = requestId;
    let emittedFastStart = false;
    const runSearch = async () => {
        if (!session && !emittedFastStart) {
            emittedFastStart = await tryEmitFastStart(requestId, queryText, limit, sortMode, filters, controller);
        }
        if (!session) await loadSession(requestId, controller);
        if (!session) throw new Error('Search worker is not initialized');
        await searchSitegraphProgressively(session, queryText, controller.signal, event => {
            if (emittedFastStart && !event.results && (
                event.type === 'plan_started'
                || event.type === 'local_index_started'
                || event.type === 'body_index_started'
            )) {
                return;
            }
            lastCoverage = event.coverage;
            const stats = event.stats
                ? {
                    ...event.stats,
                    fast_start_used: emittedFastStart || event.stats.fast_start_used,
                    first_result_source: event.stats.first_result_source ?? (emittedFastStart ? 'hot_query_topk' : 'dynamic_retrieval'),
                }
                : event.stats;
            const results = event.results && stats
                ? event.results.map(result => ({ ...result, query_stats: stats }))
                : event.results;
            post({ ...event, stats, results, requestId });
        }, { limit, sortMode, filters });
    };
    try {
        await runSearch();
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        if (!isRecoverableArtifactError(error)) throw error;
        clearSitegraphRuntimeCaches();
        manifest = null;
        session = null;
        lastCoverage = null;
        emittedFastStart = false;
        controller = new AbortController();
        activeController = controller;
        activeRequestId = requestId;
        await loadSession(requestId, controller);
        await runSearch();
    }
};

self.onmessage = (event: MessageEvent<IncomingMessage>) => {
    const message = event.data;
    if (message.type === 'cancel') {
        if (message.requestId === activeRequestId) {
            activeController?.abort();
            activeController = null;
            activeRequestId = null;
        }
        post({
            type: 'cancelled',
            requestId: message.requestId,
            coverage: lastCoverage ? { ...lastCoverage, phase: 'cancelled', coverage_state: 'cancelled', exhaustive_complete: false } : null,
        });
        return;
    }

    const run = message.type === 'init'
        ? init(message.requestId)
        : query(message.requestId, message.query, message.limit, message.sortMode, message.filters);

    run.catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        post({
            type: 'error',
            requestId: message.requestId,
            message: error instanceof Error ? error.message : String(error),
            coverage: lastCoverage ? { ...lastCoverage, phase: 'error', coverage_state: 'error', exhaustive_complete: false } : null,
        });
    });
};
