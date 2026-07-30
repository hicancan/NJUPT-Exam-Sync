import { useState } from 'react';
import { useSearch } from './model/useSearch';
import { CollectionResultsSkeleton } from './ui/CollectionResultsSkeleton';
import { CollectionSearchSection } from './ui/CollectionSearchSection';
import { InlineErrorBanner } from '@/shared/ui/InlineErrorBanner';
import type { SearchFilters, SortMode } from '@njupt-search/search-browser';
import { APP_CONFIG } from '@/app/config/constants';

interface SearchPageProps {
    query: string;
}

export function SearchPage({ query }: SearchPageProps) {
    const trimmedQuery = query.trim();
    const enabled = trimmedQuery.length >= 2;
    const [sortMode, setSortMode] = useState<SortMode>('relevance');
    const [filters, setFilters] = useState<SearchFilters>({
        sourceId: 'all',
        facet: 'all',
        dateRange: 'all',
    });
    const {
        response,
        searching,
        searchError,
        filterOptions,
        documentCount,
        loading: indexLoading,
        initError,
    } = useSearch(
        trimmedQuery,
        enabled,
        sortMode,
        filters,
        APP_CONFIG.COLLECTION_SEARCH_RESULT_LIMIT,
    );

    if (enabled && indexLoading) {
        return (
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
                <CollectionResultsSkeleton />
            </main>
        );
    }

    return (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
            <InlineErrorBanner message={initError || searchError} />
            <CollectionSearchSection
                query={query}
                response={response}
                searching={searching}
                documentCount={documentCount}
                sortMode={sortMode}
                filters={filters}
                filterOptions={filterOptions}
                onSortModeChange={setSortMode}
                onFiltersChange={(patch) => setFilters(previous => ({ ...previous, ...patch }))}
            />
        </main>
    );
}
