import { useState } from 'react';
import { useProgressiveSearch } from '@/features/collection-search/model/useProgressiveSearch';
import { useSearchIndexWorker } from '@/features/collection-search/model/useSearchIndexWorker';
import { CollectionResultsSkeleton } from '@/features/collection-search/ui/CollectionResultsSkeleton';
import { CollectionSearchSection } from '@/features/collection-search/ui/CollectionSearchSection';
import { InlineErrorBanner } from '@/widgets/app-shell/InlineErrorBanner';
import type { SitegraphSearchFilters, SitegraphSortMode } from '@/shared/lib/contracts';

interface SearchPageProps {
    query: string;
}

export function SearchPage({ query }: SearchPageProps) {
    const trimmedQuery = query.trim();
    const enabled = trimmedQuery.length >= 2;
    const [sortMode, setSortMode] = useState<SitegraphSortMode>('relevance');
    const [filters, setFilters] = useState<SitegraphSearchFilters>({
        sourceId: 'all',
        facet: 'all',
        dateRange: 'all',
    });
    const { worker, loading: indexLoading, error: indexError, filterOptions } = useSearchIndexWorker(enabled);
    const {
        recalledResults,
        queryStats,
        queryCoverage,
        searchPhase,
        searching,
        searchError,
    } = useProgressiveSearch(worker, trimmedQuery, enabled, { sortMode, filters });

    if (enabled && indexLoading) {
        return (
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
                <CollectionResultsSkeleton />
            </main>
        );
    }

    return (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
            <InlineErrorBanner message={indexError || searchError} />
            <CollectionSearchSection
                query={query}
                results={recalledResults}
                queryStats={queryStats}
                queryCoverage={queryCoverage}
                searchPhase={searchPhase}
                searching={searching}
                sortMode={sortMode}
                filters={filters}
                filterOptions={filterOptions}
                onSortModeChange={setSortMode}
                onFiltersChange={(patch) => setFilters(previous => ({ ...previous, ...patch }))}
            />
        </main>
    );
}
