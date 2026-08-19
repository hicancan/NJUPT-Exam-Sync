import type {
    SearchFacet,
    SearchFilters,
} from '@njupt-search/search-browser';

export const FACET_LABELS: Record<SearchFacet, string> = {
    notice_article: '通知',
    policy: '政策制度',
    workflow: '办事流程',
    download: '下载资源',
    exam: '考试信息',
    news: '新闻动态',
    external: '站外链接',
};

export type SearchDatePreset = 'all' | 'past_year' | 'past_3_years' | 'past_5_years';

export const DATE_FILTER_LABELS: Record<SearchDatePreset, string> = {
    all: '全部时间',
    past_year: '近一年',
    past_3_years: '近三年',
    past_5_years: '近五年',
};

export function hasActiveFilters(filters: SearchFilters): boolean {
    return Boolean(
        filters.sourceId
        || filters.facet
        || filters.publishedFrom
        || filters.publishedTo
        || filters.includeUndated,
    );
}

function yearsAgo(years: number, now: Date): string {
    const date = new Date(Date.UTC(
        now.getUTCFullYear() - years,
        now.getUTCMonth(),
        now.getUTCDate(),
    ));
    return date.toISOString().slice(0, 10);
}

export function dateFilters(
    preset: SearchDatePreset,
    now = new Date(),
): Pick<SearchFilters, 'publishedFrom' | 'publishedTo' | 'includeUndated'> {
    if (preset === 'all') {
        return {
            publishedFrom: undefined,
            publishedTo: undefined,
            includeUndated: undefined,
        };
    }
    const years = preset === 'past_year' ? 1 : preset === 'past_3_years' ? 3 : 5;
    return {
        publishedFrom: yearsAgo(years, now),
        publishedTo: now.toISOString().slice(0, 10),
        includeUndated: false,
    };
}

export function resultSummary(
    filters: SearchFilters,
    returnedCount: number,
    totalCount: number,
): string {
    const isCapped = totalCount > returnedCount;
    const scope = hasActiveFilters(filters) ? '筛选后' : '';
    if (isCapped) {
        return `${scope}找到 ${totalCount} 条相关结果，已显示前 ${returnedCount} 条。`;
    }
    return `${scope}找到 ${totalCount} 条相关结果。`;
}
