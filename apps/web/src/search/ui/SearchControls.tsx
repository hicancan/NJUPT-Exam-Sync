import { ArrowDownWideNarrow, CalendarDays, Filter, ListFilter, RotateCcw } from 'lucide-react';
import type {
    FilterOption,
    FilterOptions,
    SearchFacet,
    SearchFilters,
    SortMode,
} from '@njupt-search/search-browser';
import {
    DATE_FILTER_LABELS,
    FACET_LABELS,
    dateFilters,
    type SearchDatePreset,
} from './searchLabels';
import { SEARCH_SCOPE_OPTIONS, type SearchScope } from '../searchScopes';

interface SearchControlsProps {
    activeFilters: boolean;
    facetOptions: Array<FilterOption & { id: SearchFacet }>;
    filterOptions: FilterOptions | null;
    filters: SearchFilters;
    scope: SearchScope;
    fixedSourceId?: string;
    fixedSourceName?: string;
    supportsDates?: boolean;
    datePreset: SearchDatePreset;
    sortMode: SortMode;
    onFiltersChange: (patch: SearchFilters) => void;
    onScopeChange: (route: SearchScope['route']) => void;
    onDatePresetChange: (preset: SearchDatePreset) => void;
    onSortModeChange: (sortMode: SortMode) => void;
}

export function SearchControls({
    activeFilters,
    facetOptions,
    filterOptions,
    filters,
    scope,
    fixedSourceId,
    fixedSourceName,
    supportsDates = true,
    datePreset,
    sortMode,
    onFiltersChange,
    onScopeChange,
    onDatePresetChange,
    onSortModeChange,
}: SearchControlsProps) {
    const sourceOptions = filterOptions?.sources || [];

    return (
        <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] px-2 text-sm text-[#4d5156] dark:text-[#bdc1c6]">
                <Filter size={14} aria-hidden="true" />
                <span className="sr-only">搜索范围</span>
                <select
                    id="search-scope-filter"
                    name="search-scope-filter"
                    value={scope.route}
                    onChange={event => onScopeChange(event.target.value as SearchScope['route'])}
                    className="max-w-[150px] bg-transparent text-sm outline-none"
                    aria-label="搜索范围"
                >
                    {SEARCH_SCOPE_OPTIONS.map(option => (
                        <option key={option.route} value={option.route}>{option.title}</option>
                    ))}
                </select>
            </label>
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
                {supportsDates ? <button
                    type="button"
                    aria-pressed={sortMode === 'date_desc'}
                    onClick={() => onSortModeChange('date_desc')}
                    className={`inline-flex h-7 items-center gap-1 rounded px-2.5 text-sm ${sortMode === 'date_desc' ? 'bg-[#e8f0fe] text-[#1967d2] dark:bg-[#263850] dark:text-[#8ab4f8]' : 'text-[#5f6368] hover:bg-[#f1f3f4] dark:text-[#9aa0a6] dark:hover:bg-[#303134]'}`}
                >
                    <CalendarDays size={14} aria-hidden="true" />
                    时间
                </button> : null}
            </div>
            <label className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] px-2 text-sm text-[#4d5156] dark:text-[#bdc1c6]">
                <Filter size={14} aria-hidden="true" />
                <span className="sr-only">具体来源</span>
                <select
                    id="search-source-filter"
                    name="search-source-filter"
                    value={filters.sourceId || ''}
                    onChange={event => onFiltersChange({ sourceId: event.target.value || undefined })}
                    disabled={Boolean(fixedSourceId)}
                    className="max-w-[210px] bg-transparent text-sm outline-none"
                    aria-label="具体来源"
                >
                    {fixedSourceId ? (
                        <option value={fixedSourceId}>{fixedSourceName ?? '当前来源'}</option>
                    ) : <option value="">全部网站</option>}
                    {!fixedSourceId ? sourceOptions.map(source => (
                        <option key={source.id} value={source.id}>{source.label} ({source.count})</option>
                    )) : null}
                </select>
            </label>
            <label className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] px-2 text-sm text-[#4d5156] dark:text-[#bdc1c6]">
                <ListFilter size={14} aria-hidden="true" />
                <span className="sr-only">类型筛选</span>
                <select
                    id="search-facet-filter"
                    name="search-facet-filter"
                    value={filters.facet || ''}
                    onChange={event => onFiltersChange({
                        facet: (event.target.value || undefined) as SearchFacet | undefined,
                    })}
                    className="bg-transparent text-sm outline-none"
                    aria-label="类型筛选"
                >
                    <option value="">全部类型</option>
                    {facetOptions.map(facet => (
                        <option key={facet.id} value={facet.id}>{FACET_LABELS[facet.id]} ({facet.count})</option>
                    ))}
                </select>
            </label>
            {supportsDates ? <label className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] px-2 text-sm text-[#4d5156] dark:text-[#bdc1c6]">
                <CalendarDays size={14} aria-hidden="true" />
                <span className="sr-only">时间筛选</span>
                <select
                    id="search-date-filter"
                    name="search-date-filter"
                    value={datePreset}
                    onChange={event => onDatePresetChange(event.target.value as SearchDatePreset)}
                    className="bg-transparent text-sm outline-none"
                    aria-label="时间筛选"
                >
                    {Object.entries(DATE_FILTER_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
            </label> : null}
            {activeFilters ? (
                <button
                    type="button"
                    onClick={() => {
                        onFiltersChange({
                            sourceId: fixedSourceId,
                            facet: undefined,
                            ...dateFilters('all'),
                        });
                        onDatePresetChange('all');
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-[#1a73e8] hover:bg-[#f1f3f4] dark:text-[#8ab4f8] dark:hover:bg-[#303134]"
                >
                    <RotateCcw size={14} aria-hidden="true" />
                    清除筛选
                </button>
            ) : null}
        </div>
    );
}
