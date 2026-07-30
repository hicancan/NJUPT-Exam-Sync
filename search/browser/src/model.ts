export type SortMode = 'relevance' | 'date_desc';

export type SearchFacet =
    | 'notice_article'
    | 'policy'
    | 'workflow'
    | 'download'
    | 'system'
    | 'exam'
    | 'news'
    | 'external';

export type DateRange = 'all' | 'past_year' | 'past_3_years' | 'past_5_years' | 'undated';

export interface SearchFilters {
    sourceId?: string;
    facet?: SearchFacet | 'all';
    dateRange?: DateRange;
}

export interface Query {
    query: string;
    limit: number;
    sort: SortMode;
    filters: SearchFilters;
}

export interface SearchAttachment {
    id: string;
    url: string;
    name: string;
    extension: string | null;
}

export interface SearchResult {
    id: string;
    source: string;
    sourceName: string;
    url: string;
    title: string;
    publishedAt: string | null;
    updatedAt: string | null;
    section: string | null;
    kind: string;
    facet: SearchFacet;
    score: number;
    snippet: string;
    matchedTerms: string[];
    attachments: SearchAttachment[];
}

export interface SearchResponse {
    query: string;
    totalCandidates: number;
    elapsedMicros: number;
    results: SearchResult[];
}

export interface FilterOption {
    id: string;
    label: string;
    count: number;
}

export interface FilterOptions {
    sources: FilterOption[];
    facets: FilterOption[];
}
