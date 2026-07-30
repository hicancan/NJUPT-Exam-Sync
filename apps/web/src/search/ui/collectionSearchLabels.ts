import type {
    SearchFacet,
    SearchFilters,
    SortMode,
} from '@njupt-search/search-browser';

export type FacetFilter = SearchFacet | 'all';

export const FACET_LABELS: Record<FacetFilter, string> = {
    all: '全部',
    notice_article: '通知文章',
    policy: '政策制度',
    workflow: '办事流程',
    download: '下载资源',
    system: '系统入口',
    exam: '考试相关',
    news: '教务快讯',
    external: '外部链接',
};

export const DATE_FILTER_LABELS: Record<NonNullable<SearchFilters['dateRange']>, string> = {
    all: '全部时间',
    past_year: '近一年',
    past_3_years: '近三年',
    past_5_years: '近五年',
    undated: '未标日期',
};

export function hasActiveFilters(filters: SearchFilters): boolean {
    return (filters.sourceId || 'all') !== 'all'
        || (filters.facet || 'all') !== 'all'
        || (filters.dateRange || 'all') !== 'all';
}

export function resultSummary(
    filters: SearchFilters,
    returnedCount: number,
    totalCount: number,
    sortMode: SortMode
): string {
    const isCapped = totalCount > returnedCount;
    const scope = hasActiveFilters(filters) ? '筛选后' : '';
    const sortLabel = sortMode === 'date_desc' ? '时间较新的' : '相关性最高的';
    if (isCapped) {
        return `${scope}找到 ${totalCount} 条候选，展示${sortLabel}前 ${returnedCount} 条。`;
    }
    return `${scope}找到 ${totalCount} 条。`;
}
