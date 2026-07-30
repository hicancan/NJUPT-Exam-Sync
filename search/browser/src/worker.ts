/// <reference lib="webworker" />

import { ArtifactSource } from './artifacts';
import { CacheStore } from './cache';
import { SearchRuntime } from './runtime';
import type { SearchWorkerRequest, SearchWorkerResponse } from './protocol';

const scope = self as DedicatedWorkerGlobalScope;
let runtime: SearchRuntime | null = null;
let initController: AbortController | null = null;
const searches = new Map<number, AbortController>();

function post(message: SearchWorkerResponse): void {
    scope.postMessage(message);
}

scope.onmessage = async (event: MessageEvent<SearchWorkerRequest>) => {
    const request = event.data;
    if (request.type === 'cancel') {
        searches.get(request.requestId)?.abort();
        searches.delete(request.requestId);
        return;
    }

    if (request.type === 'init') {
        initController?.abort();
        for (const controller of searches.values()) controller.abort();
        searches.clear();
        const controller = new AbortController();
        initController = controller;
        runtime?.dispose();
        const cache = new CacheStore(request.cacheBudgetBytes);
        runtime = new SearchRuntime(
            new ArtifactSource(request.baseUrl, cache),
            request.chunkBudgetBytes,
        );
        try {
            const {
                manifest,
                documentCount,
                filterOptions,
            } = await runtime.initialize(controller.signal);
            post({
                type: 'ready',
                bundleId: manifest.bundle_id,
                documentCount,
                filterOptions,
            });
        } catch (error) {
            if (!controller.signal.aborted) {
                post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
            }
        }
        return;
    }

    if (!runtime) {
        post({ type: 'error', requestId: request.requestId, message: 'search worker is not initialized' });
        return;
    }
    const controller = new AbortController();
    searches.set(request.requestId, controller);
    try {
        const response = await runtime.search(request.query, controller.signal);
        if (!controller.signal.aborted) {
            post({ type: 'results', requestId: request.requestId, response });
        }
    } catch (error) {
        if (!controller.signal.aborted) {
            post({
                type: 'error',
                requestId: request.requestId,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    } finally {
        searches.delete(request.requestId);
    }
};
