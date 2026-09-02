import type {
    FilterOption,
    FilterOptions,
    SearchFilters,
} from '@njupt-search/search-browser';
import type { SearchScope } from './searchScopes';

/**
 * Restrict filter metadata to the sources visible in the active product
 * route.  The search engine exposes per-source facet counts so a source-local
 * page never renders whole-corpus numbers next to its own result set.
 */
export function buildScopedFilterOptions(
    filterOptions: FilterOptions | null,
    scope: SearchScope,
    filters: SearchFilters,
): FilterOptions | null {
    if (!filterOptions) return null;

    const excludedSourceIds = new Set(scope.excludedSourceIds ?? []);
    const visibleSources = filterOptions.sources.filter(
        source => !excludedSourceIds.has(source.id),
    );
    const selectedSourceId = scope.sourceId ?? filters.sourceId;
    const sourceIds = selectedSourceId
        ? [selectedSourceId]
        : visibleSources.map(source => source.id);
    const byFacet = new Map<string, FilterOption>();

    for (const sourceId of sourceIds) {
        for (const facet of filterOptions.facetsBySource[sourceId] ?? []) {
            const previous = byFacet.get(facet.id);
            byFacet.set(facet.id, previous
                ? { ...previous, count: previous.count + facet.count }
                : { ...facet });
        }
    }

    return {
        ...filterOptions,
        sources: visibleSources,
        facets: [...byFacet.values()].sort((left, right) => left.id.localeCompare(right.id)),
    };
}
