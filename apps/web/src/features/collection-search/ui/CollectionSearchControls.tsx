import { ArrowDownWideNarrow, CalendarDays, Filter, ListFilter, RotateCcw } from 'lucide-react';
import type {
    SitegraphFacet,
    SitegraphFilterOption,
    SitegraphFilterOptions,
    SitegraphSearchFilters,
    SitegraphSortMode,
} from '@/shared/lib/contracts';
import { DATE_FILTER_LABELS, FACET_LABELS, type FacetFilter } from './collectionSearchLabels';

interface CollectionSearchControlsProps {
    activeFilters: boolean;
    facetOptions: Array<SitegraphFilterOption & { id: SitegraphFacet }>;
    filterOptions: SitegraphFilterOptions | null;
    filters: SitegraphSearchFilters;
    sortMode: SitegraphSortMode;
    onFiltersChange: (patch: SitegraphSearchFilters) => void;
    onSortModeChange: (sortMode: SitegraphSortMode) => void;
}

export function CollectionSearchControls({
    activeFilters,
    facetOptions,
    filterOptions,
    filters,
    sortMode,
    onFiltersChange,
    onSortModeChange,
}: CollectionSearchControlsProps) {
    const sourceOptions = filterOptions?.sources || [];

    return (
        <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="inline-flex h-9 items-center rounded-md border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] p-0.5" aria-label="排序方式">
                <button
                    type="button"
                    aria-pressed={sortMode === 'relevance'}
                    onClick={() => onSortModeChange('relevance')}
                    className={`inline-flex h-7 items-center gap-1 rounded px-2.5 text-sm ${sortMode === 'relevance' ? 'bg-[#e8f0fe] text-[#1967d2] dark:bg-[#263850] dark:text-[#8ab4f8]' : 'text-[#5f6368] hover:bg-[#f1f3f4] dark:text-[#9aa0a6] dark:hover:bg-[#303134]'}`}
                >
                    <ArrowDownWideNarrow size={14} aria-hidden="true" />
                    相关性
                </button>
                <button
                    type="button"
                    aria-pressed={sortMode === 'date_desc'}
                    onClick={() => onSortModeChange('date_desc')}
                    className={`inline-flex h-7 items-center gap-1 rounded px-2.5 text-sm ${sortMode === 'date_desc' ? 'bg-[#e8f0fe] text-[#1967d2] dark:bg-[#263850] dark:text-[#8ab4f8]' : 'text-[#5f6368] hover:bg-[#f1f3f4] dark:text-[#9aa0a6] dark:hover:bg-[#303134]'}`}
                >
                    <CalendarDays size={14} aria-hidden="true" />
                    时间
                </button>
            </div>
            <label className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] px-2 text-sm text-[#4d5156] dark:text-[#bdc1c6]">
                <Filter size={14} aria-hidden="true" />
                <span className="sr-only">来源筛选</span>
                <select
                    id="collection-search-source-filter"
                    name="collection-search-source-filter"
                    value={filters.sourceId || 'all'}
                    onChange={event => onFiltersChange({ sourceId: event.target.value })}
                    className="max-w-[210px] bg-transparent text-sm outline-none"
                    aria-label="来源筛选"
                >
                    <option value="all">全部来源</option>
                    {sourceOptions.map(source => (
                        <option key={source.id} value={source.id}>{source.label} ({source.count})</option>
                    ))}
                </select>
            </label>
            <label className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] px-2 text-sm text-[#4d5156] dark:text-[#bdc1c6]">
                <ListFilter size={14} aria-hidden="true" />
                <span className="sr-only">类型筛选</span>
                <select
                    id="collection-search-facet-filter"
                    name="collection-search-facet-filter"
                    value={filters.facet || 'all'}
                    onChange={event => onFiltersChange({ facet: event.target.value as FacetFilter })}
                    className="bg-transparent text-sm outline-none"
                    aria-label="类型筛选"
                >
                    <option value="all">全部类型</option>
                    {facetOptions.map(facet => (
                        <option key={facet.id} value={facet.id}>{FACET_LABELS[facet.id]} ({facet.count})</option>
                    ))}
                </select>
            </label>
            <label className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] px-2 text-sm text-[#4d5156] dark:text-[#bdc1c6]">
                <CalendarDays size={14} aria-hidden="true" />
                <span className="sr-only">时间筛选</span>
                <select
                    id="collection-search-date-filter"
                    name="collection-search-date-filter"
                    value={filters.dateRange || 'all'}
                    onChange={event => onFiltersChange({ dateRange: event.target.value as NonNullable<SitegraphSearchFilters['dateRange']> })}
                    className="bg-transparent text-sm outline-none"
                    aria-label="时间筛选"
                >
                    {Object.entries(DATE_FILTER_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
            </label>
            {activeFilters ? (
                <button
                    type="button"
                    onClick={() => onFiltersChange({ sourceId: 'all', facet: 'all', dateRange: 'all' })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-[#1a73e8] hover:bg-[#f1f3f4] dark:text-[#8ab4f8] dark:hover:bg-[#303134]"
                >
                    <RotateCcw size={14} aria-hidden="true" />
                    清除筛选
                </button>
            ) : null}
        </div>
    );
}
