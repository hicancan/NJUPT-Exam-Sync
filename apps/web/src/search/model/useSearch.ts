import { useEffect, useMemo, useRef, useState } from 'react';
import {
    SearchClient,
    type FilterOptions,
    type SearchFilters,
    type SearchResponse,
    type SortMode,
} from '@njupt-search/search-browser';
import { APP_CONFIG } from '@/app/config/constants';

interface SearchState {
    key: string;
    response: SearchResponse | null;
    searching: boolean;
    error: string | null;
}

const emptyState: SearchState = {
    key: '',
    response: null,
    searching: false,
    error: null,
};

export function useSearch(
    query: string,
    enabled: boolean,
    sort: SortMode,
    filters: SearchFilters,
    limit: number,
) {
    const clientRef = useRef<SearchClient | null>(null);
    const [ready, setReady] = useState(false);
    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
    const [documentCount, setDocumentCount] = useState(0);
    const [initError, setInitError] = useState<string | null>(null);
    const [state, setState] = useState<SearchState>(emptyState);
    const trimmed = query.trim();
    const key = useMemo(
        () => `${trimmed}\u0000${sort}\u0000${filters.sourceId ?? 'all'}\u0000${filters.facet ?? 'all'}\u0000${filters.dateRange ?? 'all'}`,
        [trimmed, sort, filters.sourceId, filters.facet, filters.dateRange],
    );

    useEffect(() => {
        if (!enabled) return;
        const client = new SearchClient({ baseUrl: APP_CONFIG.DATA_URLS.SEARCH });
        clientRef.current = client;
        let active = true;
        client.initialize().then(value => {
            if (!active) return;
            setFilterOptions(value.filterOptions);
            setDocumentCount(value.documentCount);
            setReady(true);
            setInitError(null);
        }).catch(error => {
            if (!active) return;
            setInitError(error instanceof Error ? error.message : String(error));
        });
        return () => {
            active = false;
            client.dispose();
            if (clientRef.current === client) clientRef.current = null;
        };
    }, [enabled]);

    useEffect(() => {
        const client = clientRef.current;
        if (!enabled || !ready || !client || trimmed.length < 2) return;
        let active = true;
        queueMicrotask(() => {
            if (active) setState({ key, response: null, searching: true, error: null });
        });
        const pending = client.search({
            query: trimmed,
            limit,
            sort,
            filters,
        });
        pending.response.then(response => {
            if (active) setState({ key, response, searching: false, error: null });
        }).catch(error => {
            if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
                setState({
                    key,
                    response: null,
                    searching: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });
        return () => {
            active = false;
            client.cancel(pending.requestId);
        };
    }, [enabled, ready, key, trimmed, limit, sort, filters]);

    const current = state.key === key ? state : emptyState;
    return {
        response: current.response,
        searching: current.searching,
        searchError: current.error,
        filterOptions,
        documentCount,
        loading: enabled && !ready && !initError,
        initError,
    };
}
