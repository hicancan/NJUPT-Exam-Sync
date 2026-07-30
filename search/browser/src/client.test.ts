import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchClient } from './client';
import type { SearchWorkerRequest, SearchWorkerResponse } from './protocol';

class FakeWorker {
    static instances: FakeWorker[] = [];

    onmessage: ((event: MessageEvent<SearchWorkerResponse>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    readonly messages: SearchWorkerRequest[] = [];
    terminated = false;

    constructor() {
        FakeWorker.instances.push(this);
    }

    postMessage(message: SearchWorkerRequest): void {
        this.messages.push(message);
    }

    terminate(): void {
        this.terminated = true;
    }

    emit(message: SearchWorkerResponse): void {
        this.onmessage?.({ data: message } as MessageEvent<SearchWorkerResponse>);
    }
}

afterEach(() => {
    FakeWorker.instances = [];
    vi.unstubAllGlobals();
});

describe('SearchClient', () => {
    it('owns initialization, cancellation, pending requests, and disposal', async () => {
        vi.stubGlobal('Worker', FakeWorker);
        const client = new SearchClient({
            baseUrl: '/explicit/search',
            cacheBudgetBytes: 1024,
            workingSetBudgetBytes: 512,
        });
        const worker = FakeWorker.instances[0];
        if (!worker) throw new Error('SearchClient did not create its Worker');

        const ready = client.initialize();
        expect(worker.messages).toEqual([{
            type: 'init',
            baseUrl: '/explicit/search',
            cacheBudgetBytes: 1024,
            workingSetBudgetBytes: 512,
        }]);
        worker.emit({
            type: 'ready',
            bundleId: 'a'.repeat(64),
            documentCount: 12,
            filterOptions: { sources: [], facets: [] },
        });
        await expect(ready).resolves.toMatchObject({ documentCount: 12 });

        const pending = client.search({
            query: '转专业',
            limit: 10,
            sort: 'relevance',
            filters: {},
        });
        await Promise.resolve();
        client.cancel(pending.requestId);
        await expect(pending.response).rejects.toMatchObject({ name: 'AbortError' });
        expect(worker.messages[worker.messages.length - 1]).toEqual({
            type: 'cancel',
            requestId: pending.requestId,
        });

        client.dispose();
        expect(worker.terminated).toBe(true);
        expect(() => client.search({
            query: '奖学金',
            limit: 10,
            sort: 'relevance',
            filters: {},
        })).toThrow('SearchClient is disposed');
    });

    it('can retry failed initialization and rejects readiness on disposal', async () => {
        vi.stubGlobal('Worker', FakeWorker);
        const client = new SearchClient({ baseUrl: '/explicit/search' });
        const worker = FakeWorker.instances[0];
        if (!worker) throw new Error('SearchClient did not create its Worker');

        const first = client.initialize();
        worker.emit({ type: 'error', message: 'bad manifest' });
        await expect(first).rejects.toThrow('bad manifest');

        const second = client.initialize();
        expect(worker.messages.filter(message => message.type === 'init')).toHaveLength(2);
        client.dispose();
        await expect(second).rejects.toThrow('disposed');
    });

    it('rejects every pending request when its owned worker fails', async () => {
        vi.stubGlobal('Worker', FakeWorker);
        const client = new SearchClient({ baseUrl: '/explicit/search' });
        const worker = FakeWorker.instances[0];
        if (!worker) throw new Error('SearchClient did not create its Worker');
        const ready = client.initialize();
        const pending = client.search({
            query: '期末考试',
            limit: 10,
            sort: 'relevance',
            filters: {},
        });

        worker.onerror?.({ message: 'worker crashed' } as ErrorEvent);

        await expect(ready).rejects.toThrow('worker crashed');
        await expect(pending.response).rejects.toThrow('worker crashed');
        client.dispose();
    });

    it('reinitializes the owned runtime and rejects in-flight work', async () => {
        vi.stubGlobal('Worker', FakeWorker);
        const client = new SearchClient({ baseUrl: '/explicit/search' });
        const worker = FakeWorker.instances[0];
        if (!worker) throw new Error('SearchClient did not create its Worker');

        const firstReady = client.initialize();
        worker.emit({
            type: 'ready',
            bundleId: 'a'.repeat(64),
            documentCount: 12,
            filterOptions: { sources: [], facets: [] },
        });
        await firstReady;

        const pending = client.search({
            query: '转专业',
            limit: 10,
            sort: 'relevance',
            filters: {},
        });
        await Promise.resolve();
        const secondReady = client.reinitialize();
        await expect(pending.response).rejects.toMatchObject({ name: 'AbortError' });
        expect(worker.messages.slice(-2)).toEqual([
            { type: 'cancel', requestId: pending.requestId },
            {
                type: 'init',
                baseUrl: '/explicit/search',
                cacheBudgetBytes: 64 * 1024 * 1024,
                workingSetBudgetBytes: 48 * 1024 * 1024,
            },
        ]);

        worker.emit({
            type: 'ready',
            bundleId: 'b'.repeat(64),
            documentCount: 13,
            filterOptions: { sources: [], facets: [] },
        });
        await expect(secondReady).resolves.toMatchObject({
            bundleId: 'b'.repeat(64),
            documentCount: 13,
        });
        client.dispose();
    });
});
