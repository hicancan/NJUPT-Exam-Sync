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
import { SearchLanding } from './SearchLanding';
import type { SearchScope } from './searchScopes';

interface SearchPageProps {
    query: string;
    client: SearchClient;
    scope: SearchScope;
    onScopeChange: (route: SearchScope['route']) => void;
}

export function SearchPage({ query, client, scope, onScopeChange }: SearchPageProps) {
    const trimmedQuery = query.trim();
    const enabled = trimmedQuery.length >= 2;
    const [sortMode, setSortMode] = useState<SortMode>('relevance');
    const scopeFilters = (): SearchFilters => ({
        ...(scope.sourceId ? { sourceId: scope.sourceId } : {}),
        ...(scope.excludedSourceIds
            ? { excludedSourceIds: [...scope.excludedSourceIds] }
            : {}),
    });
    const [filters, setFilters] = useState<SearchFilters>(scopeFilters);
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

    if (!enabled) return <SearchLanding scope={scope} />;

    if (indexLoading) {
        return (
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
                <SearchResultsSkeleton />
            </main>
        );
    }

    if (initError || (searchError && !response)) {
        return (
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
                <InlineErrorBanner message={initError || searchError} />
            </main>
        );
    }

    const scopedSource = scope.sourceId
        ? filterOptions?.sources.find(source => source.id === scope.sourceId)
        : null;
    const excludedSources = new Set(scope.excludedSourceIds ?? []);
    const scopedFilterOptions = filterOptions ? {
        ...filterOptions,
        sources: filterOptions.sources.filter(source => !excludedSources.has(source.id)),
    } : null;
    const scopedDocumentCount = scopedSource?.count
        ?? scopedFilterOptions?.sources.reduce((sum, source) => sum + source.count, 0)
        ?? documentCount;
    if (scope.sourceId && filterOptions && !scopedSource) {
        return (
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-3 pb-6">
                <InlineErrorBanner message={`${scope.sourceName ?? '该来源'}的数据尚未发布，请稍后重试。`} />
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
                documentCount={scopedDocumentCount}
                sortMode={sortMode}
                filters={filters}
                scope={scope}
                datePreset={datePreset}
                filterOptions={scopedFilterOptions}
                fixedSourceId={scope.sourceId}
                fixedSourceName={scope.sourceName}
                supportsDates={scope.supportsDates}
                canLoadMore={Boolean(
                    response
                    && response.results.length < response.totalCandidates
                    && limit < APP_CONFIG.SEARCH_RESULT_MAX
                )}
                onSortModeChange={setSortMode}
                onFiltersChange={(patch) => setFilters(previous => ({
                    ...previous,
                    ...patch,
                    ...scopeFilters(),
                }))}
                onScopeChange={onScopeChange}
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
