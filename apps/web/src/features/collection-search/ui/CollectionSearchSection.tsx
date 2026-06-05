import { useMemo, useState } from 'react';
import type {
    RankedSitegraphDocument,
    SitegraphFacet,
    SitegraphFilterOption,
    SitegraphFilterOptions,
    SitegraphQueryStats,
    SitegraphSearchCoverage,
    SitegraphSearchFilters,
    SitegraphSearchPhase,
    SitegraphSortMode,
} from '@/shared/lib/contracts';
import { CollectionSearchControls } from './CollectionSearchControls';
import { CollectionSearchResultCard } from './CollectionSearchResultCard';
import { CollectionSearchStatus } from './CollectionSearchStatus';
import { hasActiveFilters, phaseLabel, resultSummary } from './collectionSearchLabels';

interface CollectionSearchSectionProps {
    query: string;
    results: RankedSitegraphDocument[];
    queryStats: SitegraphQueryStats | null;
    queryCoverage: SitegraphSearchCoverage | null;
    searchPhase: SitegraphSearchPhase | null;
    searching: boolean;
    sortMode: SitegraphSortMode;
    filters: SitegraphSearchFilters;
    filterOptions: SitegraphFilterOptions | null;
    onSortModeChange: (sortMode: SitegraphSortMode) => void;
    onFiltersChange: (patch: SitegraphSearchFilters) => void;
}

function visibleResultKey(query: string, sortMode: SitegraphSortMode, filters: SitegraphSearchFilters): string {
    return `${query.trim()}\u0000${sortMode}\u0000${filters.sourceId || 'all'}\u0000${filters.facet || 'all'}\u0000${filters.dateRange || 'all'}`;
}

function useFacetOptions(filterOptions: SitegraphFilterOptions | null) {
    return useMemo(() => {
        const facets = Array.from(new Set((filterOptions?.facets || []).map(facet => facet.id)));
        const preferred: SitegraphFacet[] = ['notice_article', 'policy', 'workflow', 'download', 'system', 'exam', 'news', 'external'];
        const facetById = new Map((filterOptions?.facets || []).map(facet => [facet.id, facet]));
        return preferred
            .filter(facet => facets.includes(facet))
            .map(facet => facetById.get(facet))
            .filter((facet): facet is SitegraphFilterOption & { id: SitegraphFacet } => Boolean(facet));
    }, [filterOptions]);
}

export function CollectionSearchSection({
    query,
    results,
    queryStats,
    queryCoverage,
    searchPhase,
    searching,
    sortMode,
    filters,
    filterOptions,
    onSortModeChange,
    onFiltersChange,
}: CollectionSearchSectionProps) {
    const trimmedQuery = query.trim();
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [visibleState, setVisibleState] = useState({ key: '', count: 20 });
    const facetOptions = useFacetOptions(filterOptions);
    const visibleKey = visibleResultKey(trimmedQuery, sortMode, filters);
    const visibleCount = visibleState.key === visibleKey ? visibleState.count : 20;
    const visibleResults = results.slice(0, visibleCount);
    const coverage = queryCoverage || queryStats?.coverage || null;
    const totalResultCount = queryStats?.resultCount ?? results.length;
    const phaseText = phaseLabel(searchPhase, searching);
    const summary = resultSummary(
        filters,
        results.length,
        totalResultCount,
        Boolean(coverage?.exhaustive_complete),
        sortMode
    );
    const statusText = trimmedQuery.length < 2
        ? '输入至少两个字符搜索南邮官网信息。'
        : phaseText
            ? `${summary}${phaseText}。`
            : summary;
    const activeFilters = hasActiveFilters(filters);
    const showSearchingEmptyState = searching && trimmedQuery.length >= 2 && !coverage?.exhaustive_complete;

    return (
        <section>
            <div className="mb-2">
                <CollectionSearchControls
                    activeFilters={activeFilters}
                    facetOptions={facetOptions}
                    filterOptions={filterOptions}
                    filters={filters}
                    sortMode={sortMode}
                    onFiltersChange={onFiltersChange}
                    onSortModeChange={onSortModeChange}
                />
                <CollectionSearchStatus
                    coverage={coverage}
                    queryStats={queryStats}
                    showDiagnostics={showDiagnostics}
                    statusText={statusText}
                    onDiagnosticsToggle={() => setShowDiagnostics(value => !value)}
                />
            </div>

            {visibleResults.length > 0 ? (
                <div>
                    {visibleResults.map(document => (
                        <CollectionSearchResultCard key={document.id} document={document} />
                    ))}
                    {visibleCount < results.length ? (
                        <div className="pt-4 pb-2 text-center">
                            <button
                                type="button"
                                onClick={() => setVisibleState({ key: visibleKey, count: visibleCount + 20 })}
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
                    <p className="mt-2 text-sm">首批可信结果返回后会立即显示，后续继续全量核查。</p>
                </div>
            ) : (
                <div className="border border-[#dadce0] dark:border-[#3c4043] rounded-md bg-white dark:bg-[#202124] p-6 text-[#4d5156] dark:text-[#bdc1c6] max-w-[692px]">
                    <p>没有找到匹配的南邮官网信息。</p>
                    <p className="mt-2 text-sm">可以尝试“期末考试”“四六级”“计算机等级”“口语考试”“奖学金”“大创”“竞赛报名”这类学生任务关键词。</p>
                </div>
            )}
        </section>
    );
}
