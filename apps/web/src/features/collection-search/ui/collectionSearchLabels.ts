import type {
    SitegraphFacet,
    SitegraphQueryStats,
    SitegraphSearchFilters,
    SitegraphSearchPhase,
    SitegraphSortMode,
} from '@/shared/lib/contracts';

export type FacetFilter = SitegraphFacet | 'all';

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

export const DATE_FILTER_LABELS: Record<NonNullable<SitegraphSearchFilters['dateRange']>, string> = {
    all: '全部时间',
    past_year: '近一年',
    past_3_years: '近三年',
    past_5_years: '近五年',
    undated: '未标日期',
};

export function methodLabel(method: string): string {
    if (method === 'search_record') return '官网页面收录';
    if (method === 'attachment_metadata_only') return '附件元数据收录';
    if (method === 'external_record_only') return '外部入口收录';
    return '站点图收录';
}

export function evidenceLevelLabel(level: string | undefined): string | null {
    if (level === 'filename_only') return '附件文件名';
    if (level === 'metadata_only' || level === 'source_metadata') return '来源元数据';
    if (level === 'text_extracted') return '附件文本';
    if (level === 'snippet') return '摘要片段';
    if (level === 'full_content') return '正文全文';
    return null;
}

export function phaseLabel(phase: SitegraphSearchPhase | null, searching: boolean): string {
    if (phase === 'scoped_exhaustive_complete' || phase === 'global_exhaustive_complete') return '';
    if (phase === 'cancelled') return '已取消本次核查';
    if (!searching) return '等待搜索';
    if (phase === 'plan_started') return '正在规划权威来源';
    if (phase === 'local_index_started') return '正在加载相关局部索引';
    if (phase === 'first_trusted_results') return '可信首批结果已返回，正在继续补全';
    if (phase === 'body_index_started') return '正在加载相关正文索引';
    if (phase === 'top_results_hydrated') return '高相关结果已补全，正在做覆盖证明';
    if (phase === 'verification_started' || phase === 'partial_verified') return '正在验证范围内官网分片';
    return '正在搜索';
}

export function fieldLabel(fields: string[]): string {
    if (fields.length === 0) return '尚未开始';
    const labels: Record<string, string> = {
        title: '标题',
        section: '栏目',
        nav_path: '导航路径',
        tags: '标签',
        attachments: '附件',
        external: '外部入口',
        system: '系统入口',
        summary: '摘要',
        content: '正文',
        url: 'URL',
    };
    return fields.map(field => labels[field] || field).join('、');
}

export function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
}

export function firstResultSourceLabel(source: SitegraphQueryStats['first_result_source']): string | null {
    if (source === 'hot_query_initial') return '热查询首屏证书';
    if (source === 'hot_query_topk') return '热查询 Top-K 证书';
    if (source === 'dynamic_retrieval') return '动态检索';
    return null;
}

export function queryClassLabel(queryClass: SitegraphQueryStats['query_class']): string | null {
    if (queryClass === 'degenerate') return '退化词';
    if (queryClass === 'hot') return '热查询';
    if (queryClass === 'hot_alias') return '热别名';
    if (queryClass === 'cold_high_df') return '高频泛词';
    if (queryClass === 'cold_rare_dynamic_holdout') return '动态冷查询';
    if (queryClass === 'miss_dynamic_holdout') return '动态未命中';
    if (queryClass === 'filtered') return '筛选查询';
    if (queryClass === 'time_filtered') return '时间筛选';
    return null;
}

export function servingPathLabel(servingPath: SitegraphQueryStats['serving_path']): string | null {
    if (servingPath === 'hot_certificate') return '热查询证书';
    if (servingPath === 'high_df_certificate') return '高频词证书';
    if (servingPath === 'dynamic_retrieval') return '动态检索';
    if (servingPath === 'noop') return '无需检索';
    return null;
}

export function hasActiveFilters(filters: SitegraphSearchFilters): boolean {
    return (filters.sourceId || 'all') !== 'all'
        || (filters.facet || 'all') !== 'all'
        || (filters.dateRange || 'all') !== 'all';
}

export function resultSummary(
    filters: SitegraphSearchFilters,
    returnedCount: number,
    totalCount: number,
    exhaustiveComplete: boolean,
    sortMode: SitegraphSortMode
): string {
    const phaseVerb = exhaustiveComplete ? '匹配' : '已召回';
    const isCapped = totalCount > returnedCount;
    const scope = hasActiveFilters(filters) ? '筛选后' : '';
    const sortLabel = sortMode === 'date_desc' ? '时间较新的' : '相关性最高的';
    if (isCapped) {
        return `${scope}${phaseVerb} ${totalCount} 条，展示${sortLabel}前 ${returnedCount} 条。`;
    }
    return `${scope}${phaseVerb} ${totalCount} 条。`;
}
