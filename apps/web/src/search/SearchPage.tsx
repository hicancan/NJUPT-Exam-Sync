import { useState } from 'react';
import { useSearch } from './model/useSearch';
import { SearchResultsSkeleton } from './ui/SearchResultsSkeleton';
import { SearchSection } from './ui/SearchSection';
import { InlineErrorBanner } from '@/shared/ui/InlineErrorBanner';
import type { SearchClient, SearchFilters, SortMode } from '@njupt-search/search-browser';
import { APP_CONFIG } from '@/app/config/constants';
import {
    dateFilters,
    type SearchDatePreset,
} from './ui/searchLabels';

interface SearchPageProps {
    query: string;
    client: SearchClient;
}

export function SearchPage({ query, client }: SearchPageProps) {
    const trimmedQuery = query.trim();
    const enabled = trimmedQuery.length >= 2;
    const [sortMode, setSortMode] = useState<SortMode>('relevance');
    const [filters, setFilters] = useState<SearchFilters>({});
    const [datePreset, setDatePreset] = useState<SearchDatePreset>('all');
    const paginationKey = JSON.stringify([trimmedQuery, sortMode, filters]);
    const [pagination, setPagination] = useState({
        key: paginationKey,
        limit: APP_CONFIG.SEARCH_RESULT_LIMIT,
    });
    const limit = pagination.key === paginationKey
        ? pagination.limit
        : APP_CONFIG.SEARCH_RESULT_LIMIT;
    const {
        response,
        searching,
        searchError,
        filterOptions,
        documentCount,
        loading: indexLoading,
        initError,
    } = useSearch(
        client,
        trimmedQuery,
        enabled,
        sortMode,
        filters,
        limit,
    );

    if (enabled && indexLoading) {
        return (
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
                <SearchResultsSkeleton />
            </main>
        );
    }

    if (enabled && (initError || (searchError && !response))) {
        return (
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
                <InlineErrorBanner message={initError || searchError} />
            </main>
        );
    }

    return (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
            <InlineErrorBanner message={initError || searchError} />
            <SearchSection
                query={query}
                response={response}
                searching={searching}
                documentCount={documentCount}
                sortMode={sortMode}
                filters={filters}
                datePreset={datePreset}
                filterOptions={filterOptions}
                canLoadMore={Boolean(
                    response
                    && response.results.length < response.totalCandidates
                    && limit < APP_CONFIG.SEARCH_RESULT_MAX
                )}
                onSortModeChange={setSortMode}
                onFiltersChange={(patch) => setFilters(previous => ({ ...previous, ...patch }))}
                onDatePresetChange={(preset) => {
                    setDatePreset(preset);
                    setFilters(previous => ({ ...previous, ...dateFilters(preset) }));
                }}
                onLoadMore={() => setPagination({
                    key: paginationKey,
                    limit: Math.min(limit + 10, APP_CONFIG.SEARCH_RESULT_MAX),
                })}
            />
        </main>
    );
}
