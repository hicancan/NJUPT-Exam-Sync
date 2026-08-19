import { useMemo } from 'react';
import type {
    FilterOption,
    FilterOptions,
    SearchFacet,
    SearchFilters,
    SearchResponse,
    SortMode,
} from '@njupt-search/search-browser';
import { SearchControls } from './SearchControls';
import { SearchResultCard } from './SearchResultCard';
import { SearchStatus } from './SearchStatus';
import {
    hasActiveFilters,
    resultSummary,
    type SearchDatePreset,
} from './searchLabels';

interface SearchSectionProps {
    query: string;
    response: SearchResponse | null;
    searching: boolean;
    documentCount: number;
    sortMode: SortMode;
    filters: SearchFilters;
    datePreset: SearchDatePreset;
    filterOptions: FilterOptions | null;
    onSortModeChange: (sortMode: SortMode) => void;
    onFiltersChange: (patch: SearchFilters) => void;
    onDatePresetChange: (preset: SearchDatePreset) => void;
    onLoadMore: () => void;
}

function useFacetOptions(filterOptions: FilterOptions | null) {
    return useMemo(() => {
        const facets = Array.from(new Set((filterOptions?.facets || []).map(facet => facet.id)));
        const preferred: SearchFacet[] = ['notice_article', 'policy', 'workflow', 'download', 'exam', 'news', 'external'];
        const facetById = new Map((filterOptions?.facets || []).map(facet => [facet.id, facet]));
        return preferred
            .filter(facet => facets.includes(facet))
            .map(facet => facetById.get(facet))
            .filter((facet): facet is FilterOption & { id: SearchFacet } => Boolean(facet));
    }, [filterOptions]);
}

export function SearchSection({
    query,
    response,
    searching,
    documentCount,
    sortMode,
    filters,
    datePreset,
    filterOptions,
    onSortModeChange,
    onFiltersChange,
    onDatePresetChange,
    onLoadMore,
}: SearchSectionProps) {
    const trimmedQuery = query.trim();
    const facetOptions = useFacetOptions(filterOptions);
    const results = response?.results ?? [];
    const summary = resultSummary(filters, results.length, response?.totalCandidates ?? 0, sortMode);
    const statusText = trimmedQuery.length < 2
        ? '输入至少两个字符开始搜索。'
        : searching
            ? '正在搜索南邮官网信息。'
            : summary;
    const activeFilters = hasActiveFilters(filters);
    const showSearchingEmptyState = searching && trimmedQuery.length >= 2;

    return (
        <section>
            <div className="mb-2">
                <SearchControls
                    activeFilters={activeFilters}
                    facetOptions={facetOptions}
                    filterOptions={filterOptions}
                    filters={filters}
                    datePreset={datePreset}
                    sortMode={sortMode}
                    onFiltersChange={onFiltersChange}
                    onDatePresetChange={onDatePresetChange}
                    onSortModeChange={onSortModeChange}
                />
                <SearchStatus
                    documentCount={documentCount}
                    statusText={statusText}
                />
            </div>

            {results.length > 0 ? (
                <div>
                    {results.map(document => (
                        <SearchResultCard key={document.id} document={document} />
                    ))}
                    {results.length < (response?.totalCandidates ?? 0) ? (
                        <div className="pt-4 pb-2 text-center">
                            <button
                                type="button"
                                onClick={onLoadMore}
                                disabled={searching}
                                className="px-6 py-2 rounded-full border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] text-sm font-medium text-[#1a73e8] hover:bg-[#f8f9fa] dark:hover:bg-[#303134] transition-colors"
                            >
                                加载更多结果
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : showSearchingEmptyState ? (
                <div className="min-h-32 max-w-[692px] rounded-md border border-[#dadce0] bg-white p-6 text-[#4d5156] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#bdc1c6]">
                    <p>正在搜索南邮官网信息。</p>
                    <p className="mt-2 text-sm">正在加载本次查询所需的倒排索引与正文块。</p>
                </div>
            ) : (
                <div className="border border-[#dadce0] dark:border-[#3c4043] rounded-md bg-white dark:bg-[#202124] p-6 text-[#4d5156] dark:text-[#bdc1c6] max-w-[692px]">
                    <p>没有找到相关内容。</p>
                    <p className="mt-2 text-sm">试试搜索"期末考试""四六级""计算机等级""口语考试""奖学金""大创""竞赛报名"等。</p>
                </div>
            )}
        </section>
    );
}
