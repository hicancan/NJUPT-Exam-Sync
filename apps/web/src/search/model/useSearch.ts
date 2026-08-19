import { useEffect, useMemo, useState } from 'react';
import {
    type SearchClient,
    type FilterOptions,
    type SearchFilters,
    type SearchResponse,
    type SortMode,
} from '@njupt-search/search-browser';

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
    client: SearchClient,
    query: string,
    enabled: boolean,
    sort: SortMode,
    filters: SearchFilters,
    limit: number,
) {
    const [ready, setReady] = useState(false);
    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
    const [documentCount, setDocumentCount] = useState(0);
    const [initError, setInitError] = useState<string | null>(null);
    const [state, setState] = useState<SearchState>(emptyState);
    const trimmed = query.trim();
    const key = useMemo(
        () => [
            trimmed,
            sort,
            filters.sourceId ?? '',
            filters.facet ?? '',
            filters.publishedFrom ?? '',
            filters.publishedTo ?? '',
            String(filters.includeUndated ?? false),
        ].join('\u0000'),
        [
            trimmed,
            sort,
            filters.sourceId,
            filters.facet,
            filters.publishedFrom,
            filters.publishedTo,
            filters.includeUndated,
        ],
    );

    useEffect(() => {
        if (!enabled) return;
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
        };
    }, [client, enabled]);

    useEffect(() => {
        if (!enabled || !ready || trimmed.length < 2) return;
        let active = true;
        let requestId: number | null = null;
        queueMicrotask(() => {
            if (!active) return;
            setState(previous => ({
                key,
                response: previous.response,
                searching: true,
                error: null,
            }));
            const pending = client.search({
                query: trimmed,
                limit,
                sort,
                filters,
            }, ranked => {
                if (active) setState({ key, response: ranked, searching: true, error: null });
            });
            requestId = pending.requestId;
            pending.response.then(response => {
                if (active) setState({ key, response, searching: false, error: null });
            }).catch(error => {
                if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
                    setState(previous => ({
                        key,
                        response: previous.response,
                        searching: false,
                        error: error instanceof Error ? error.message : String(error),
                    }));
                }
            });
        });
        return () => {
            active = false;
            if (requestId !== null) client.cancel(requestId);
        };
    }, [client, enabled, ready, key, trimmed, limit, sort, filters]);

    const current = enabled ? state : emptyState;
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
