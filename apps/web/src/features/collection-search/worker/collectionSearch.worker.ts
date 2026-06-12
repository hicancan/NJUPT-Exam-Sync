import type {
    SitegraphQueryClass,
    SitegraphSearchCoverage,
    SitegraphSearchEvent,
    SitegraphSearchFilters,
    SitegraphSortMode,
} from '@njupt-search/contracts/search-index';
import {
    clearSitegraphRuntimeCaches,
    createBrowserContentHashArtifactCache,
    searchSitegraphProgressively,
} from '@njupt-search/search-core';
import { tryBuildFastStartEvent } from './fastStart/searchWorkerFastStart';
import { createPackedImpactRetriever } from './session/packedImpactRetriever';
import { createSearchWorkerSession, publicPath } from './session/searchWorkerSession';
import {
    classifyDynamicQuery,
    inferCertificateServingPath,
    inferHotProofEvent,
    isDegenerateQuery,
    makeDegenerateCoverage,
    makeDegenerateStats,
} from './telemetry/searchWorkerTelemetry';

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

let activeController: AbortController | null = null;
let activeRequestId: number | null = null;
let lastCoverage: SitegraphSearchCoverage | null = null;

const artifactCache = createBrowserContentHashArtifactCache('njupt-public');
const sessionRuntime = createSearchWorkerSession(artifactCache, createPackedImpactRetriever());

const post = (payload: Record<string, unknown>) => {
    self.postMessage(payload);
};

const isRecoverableArtifactError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return /\/generated\/collections\/njupt-public\/.+ HTTP (404|408|409|425|429|500|502|503|504)\b/.test(message);
};

const postReadySession = async (requestId: number, controller: AbortController) => {
    const loaded = await sessionRuntime.loadSession(requestId, controller);
    post(loaded.readyMessage);
    return loaded.session;
};

const init = async (requestId: number) => {
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    activeRequestId = requestId;
    await postReadySession(requestId, controller);
};

const emitDegenerateNoop = (requestId: number, queryText: string): void => {
    const coverage = makeDegenerateCoverage(artifactCache.scope);
    const stats = makeDegenerateStats(queryText, coverage);
    lastCoverage = coverage;
    post({
        type: 'global_exhaustive_complete',
        requestId,
        query: queryText.trim(),
        coverage,
        results: [],
        stats,
    });
};

const patchRuntimeEvent = (
    event: SitegraphSearchEvent,
    queryText: string,
    filters: SitegraphSearchFilters,
    emittedFastStart: boolean,
    fastStartQueryClass: SitegraphQueryClass | undefined
): SitegraphSearchEvent => {
    const queryClass = event.stats?.query_class
        ?? (emittedFastStart && fastStartQueryClass ? fastStartQueryClass : classifyDynamicQuery(queryText, filters, event));
    const stats = event.stats
        ? {
            ...event.stats,
            fast_start_used: emittedFastStart || event.stats.fast_start_used,
            first_result_source: event.stats.first_result_source
                ?? (emittedFastStart ? 'hot_query_initial' : inferHotProofEvent(event) ? 'hot_query_topk' : 'dynamic_retrieval'),
            query_class: queryClass,
            serving_path: event.stats.serving_path ?? inferCertificateServingPath(queryClass, event),
        }
        : event.stats;
    const results = event.results && stats
        ? event.results.map(result => ({ ...result, query_stats: stats }))
        : event.results;
    return { ...event, stats, results };
};

const query = async (
    requestId: number,
    queryText: string,
    limit = 30,
    sortMode: SitegraphSortMode = 'relevance',
    filters: SitegraphSearchFilters = {}
) => {
    activeController?.abort();
    if (isDegenerateQuery(queryText)) {
        activeController = null;
        activeRequestId = requestId;
        emitDegenerateNoop(requestId, queryText);
        return;
    }

    let controller = new AbortController();
    activeController = controller;
    activeRequestId = requestId;
    let emittedFastStart = false;
    let fastStartQueryClass: SitegraphQueryClass | undefined;

    const runSearch = async () => {
        if (!emittedFastStart) {
            const fastStart = await tryBuildFastStartEvent({
                requestId,
                queryText,
                limit,
                sortMode,
                filters,
                controller,
                loadManifest: sessionRuntime.loadManifest,
                artifactCache,
                publicPath,
            });
            if (fastStart.emitted) {
                emittedFastStart = true;
                fastStartQueryClass = fastStart.queryClass;
                lastCoverage = fastStart.coverage;
                post(fastStart.event);
            }
        }

        let loadedSession = sessionRuntime.getSession();
        if (!loadedSession) loadedSession = await postReadySession(requestId, controller);

        await searchSitegraphProgressively(loadedSession, queryText, controller.signal, event => {
            if (emittedFastStart && !event.results && (
                event.type === 'plan_started'
                || event.type === 'local_index_started'
                || event.type === 'body_index_started'
            )) {
                return;
            }
            lastCoverage = event.coverage;
            post({ ...patchRuntimeEvent(event, queryText, filters, emittedFastStart, fastStartQueryClass), requestId });
        }, { limit, sortMode, filters });
    };

    try {
        await runSearch();
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        if (!isRecoverableArtifactError(error)) throw error;
        clearSitegraphRuntimeCaches();
        sessionRuntime.clear();
        lastCoverage = null;
        emittedFastStart = false;
        fastStartQueryClass = undefined;
        controller = new AbortController();
        activeController = controller;
        activeRequestId = requestId;
        await postReadySession(requestId, controller);
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
