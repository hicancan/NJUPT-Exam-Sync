export type SortMode = 'relevance' | 'date_desc';

export type SearchFacet =
    | 'notice_article'
    | 'policy'
    | 'workflow'
    | 'download'
    | 'exam'
    | 'news'
    | 'external';

export interface SearchFilters {
    sourceId?: string;
    facet?: SearchFacet;
    publishedFrom?: string;
    publishedTo?: string;
    includeUndated?: boolean;
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
    kind: 'page' | 'attachment' | 'external';
    facet: SearchFacet;
    snippet: string | null;
    matchedTerms: string[];
    attachments: SearchAttachment[];
}

export interface SearchResponse {
    totalCandidates: number;
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
