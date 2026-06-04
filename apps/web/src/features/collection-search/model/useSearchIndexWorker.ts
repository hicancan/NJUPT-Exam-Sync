import { useEffect, useRef, useState } from 'react';
import { SitegraphFilterOptions, SitegraphSearchManifest } from '@/shared/lib/contracts';

interface UseSearchIndexWorkerResult {
    worker: Worker | null;
    manifest: SitegraphSearchManifest | null;
    filterOptions: SitegraphFilterOptions | null;
    loading: boolean;
    error: string | null;
}

export function useSearchIndexWorker(enabled = true): UseSearchIndexWorkerResult {
    const workerRef = useRef<Worker | null>(null);
    const [workerState, setWorkerState] = useState<Worker | null>(null);
    const [manifest, setManifest] = useState<SitegraphSearchManifest | null>(null);
    const [filterOptions, setFilterOptions] = useState<SitegraphFilterOptions | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const worker = new Worker(new URL('../worker/collectionSearch.worker.ts', import.meta.url), { type: 'module' });
        let disposed = false;
        workerRef.current = worker;
        queueMicrotask(() => {
            if (disposed || workerRef.current !== worker) return;
            setWorkerState(worker);
            setError(null);
        });

        worker.onmessage = (event: MessageEvent) => {
            const message = event.data as {
                type?: string;
                manifest?: SitegraphSearchManifest;
                filterOptions?: SitegraphFilterOptions;
            };
            if (message.type === 'ready' && message.manifest) {
                setManifest(message.manifest);
                setFilterOptions(message.filterOptions || null);
            }
        };
        worker.onerror = event => {
            setManifest(null);
            setFilterOptions(null);
            setWorkerState(null);
            setError(event.message || '南邮官网信息搜索 Worker 启动失败');
        };

        return () => {
            disposed = true;
            worker.terminate();
            if (workerRef.current === worker) {
                workerRef.current = null;
                setWorkerState(null);
                setManifest(null);
                setFilterOptions(null);
            }
        };
    }, [enabled]);

    return {
        worker: enabled ? workerState : null,
        manifest: enabled ? manifest : null,
        filterOptions: enabled ? filterOptions : null,
        loading: enabled && !workerState && !error,
        error: enabled ? error : null
    };
}
