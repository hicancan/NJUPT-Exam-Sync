import type {
    FilterOptions,
    Query,
    SearchResponse,
} from './model';
import type {
    SearchWorkerRequest,
    SearchWorkerResponse,
} from './protocol';

export interface SearchClientReady {
    bundleId: string;
    documentCount: number;
    filterOptions: FilterOptions;
}

interface PendingSearch {
    resolve: (response: SearchResponse) => void;
    reject: (error: Error) => void;
}

const MIB = 1024 * 1024;

export interface SearchClientOptions {
    baseUrl: string;
    cacheBudgetBytes?: number;
    chunkBudgetBytes?: number;
}

export class SearchClient {
    private readonly worker: Worker;
    private readonly options: Required<SearchClientOptions>;
    private readyPromise: Promise<SearchClientReady> | null = null;
    private readyResolve: ((ready: SearchClientReady) => void) | null = null;
    private readyReject: ((error: Error) => void) | null = null;
    private readonly pending = new Map<number, PendingSearch>();
    private nextRequestId = 1;
    private disposed = false;

    constructor(options: SearchClientOptions) {
        const baseUrl = options.baseUrl.trim();
        if (!baseUrl) throw new Error('SearchBundle base URL is required');
        this.options = {
            baseUrl,
            cacheBudgetBytes: options.cacheBudgetBytes ?? 64 * MIB,
            chunkBudgetBytes: options.chunkBudgetBytes ?? 48 * MIB,
        };
        this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (event: MessageEvent<SearchWorkerResponse>) => this.receive(event.data);
        this.worker.onerror = event => {
            const error = new Error(event.message || 'search worker failed');
            this.readyReject?.(error);
            for (const search of this.pending.values()) search.reject(error);
            this.pending.clear();
        };
    }

    initialize(): Promise<SearchClientReady> {
        this.requireActive();
        if (this.readyPromise) return this.readyPromise;
        this.readyPromise = new Promise<SearchClientReady>((resolve, reject) => {
            this.readyResolve = resolve;
            this.readyReject = reject;
        });
        this.post({ type: 'init', ...this.options });
        return this.readyPromise;
    }

    search(query: Query): { requestId: number; response: Promise<SearchResponse> } {
        this.requireActive();
        const requestId = this.nextRequestId++;
        const response = new Promise<SearchResponse>((resolve, reject) => {
            this.pending.set(requestId, { resolve, reject });
        });
        this.post({ type: 'search', requestId, query });
        return { requestId, response };
    }

    cancel(requestId: number): void {
        const pending = this.pending.get(requestId);
        if (pending) {
            pending.reject(new DOMException('search cancelled', 'AbortError'));
            this.pending.delete(requestId);
        }
        this.post({ type: 'cancel', requestId });
    }

    dispose(): void {
        if (this.disposed) return;
        for (const [requestId] of this.pending) this.cancel(requestId);
        this.disposed = true;
        this.worker.terminate();
    }

    private post(message: SearchWorkerRequest): void {
        this.worker.postMessage(message);
    }

    private requireActive(): void {
        if (this.disposed) throw new Error('SearchClient is disposed');
    }

    private receive(message: SearchWorkerResponse): void {
        if (message.type === 'ready') {
            this.readyResolve?.(message);
            this.readyResolve = null;
            this.readyReject = null;
            return;
        }
        if (message.type === 'results') {
            this.pending.get(message.requestId)?.resolve(message.response);
            this.pending.delete(message.requestId);
            return;
        }
        const error = new Error(message.message);
        if (message.requestId === undefined) {
            this.readyReject?.(error);
            this.readyReject = null;
            this.readyResolve = null;
        } else {
            this.pending.get(message.requestId)?.reject(error);
            this.pending.delete(message.requestId);
        }
    }
}
