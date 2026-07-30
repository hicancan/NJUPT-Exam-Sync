import { useState } from 'react';
import { useSearch } from './model/useSearch';
import { SearchResultsSkeleton } from './ui/SearchResultsSkeleton';
import { SearchSection } from './ui/SearchSection';
import { InlineErrorBanner } from '@/shared/ui/InlineErrorBanner';
import type { SearchFilters, SortMode } from '@njupt-search/search-browser';
import { APP_CONFIG } from '@/app/config/constants';
import {
    dateFilters,
    type SearchDatePreset,
} from './ui/searchLabels';

interface SearchPageProps {
    query: string;
}

export function SearchPage({ query }: SearchPageProps) {
    const trimmedQuery = query.trim();
    const enabled = trimmedQuery.length >= 2;
    const [sortMode, setSortMode] = useState<SortMode>('relevance');
    const [filters, setFilters] = useState<SearchFilters>({});
    const [datePreset, setDatePreset] = useState<SearchDatePreset>('all');
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
        APP_CONFIG.SEARCH_RESULT_LIMIT,
    );

    if (enabled && indexLoading) {
        return (
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
                <SearchResultsSkeleton />
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
                onSortModeChange={setSortMode}
                onFiltersChange={(patch) => setFilters(previous => ({ ...previous, ...patch }))}
                onDatePresetChange={(preset) => {
                    setDatePreset(preset);
                    setFilters(previous => ({ ...previous, ...dateFilters(preset) }));
                }}
            />
        </main>
    );
}
