import type {
    QueryDirectoryRoute,
    SitegraphLocalIndexRef,
    SitegraphLocalShardRef,
    SitegraphQueryPlan,
    SitegraphRoutedSession,
    SitegraphSearchFilters,
    SitegraphArtifact,
    SourceRegistryEntry
} from '@njupt-search/contracts/search-index';
import { SearchContractError } from './sitegraphContract';
import { detectQueryIntent } from './intent/queryIntent';
import { expandSitegraphQueryPhrases, normalizeSearchText as normalize } from './tokenizer';
import type { RoutedSessionWithArtifactCache, VerificationShard } from './sitegraphSearchTypes';
import { localBodyPackedBytesCache, localLightMetaCache, localLightPackedBytesCache } from './sitegraphRuntimeCaches';

export const firstScreenBytes = (session: SitegraphRoutedSession): number => {
    const artifacts = session.manifest.artifacts;
    return artifacts.source_registry.bytes + artifacts.global_query_directory.bytes + artifacts.query_aliases.bytes;
};

export const activeFilters = (filters: SitegraphSearchFilters): boolean => {
    return (filters.sourceId || 'all') !== 'all'
        || (filters.facet || 'all') !== 'all'
        || (filters.dateRange || 'all') !== 'all';
};

export const dateRangeFloorYear = (dateRange: SitegraphSearchFilters['dateRange'], now: number): number => {
    if (!dateRange || dateRange === 'all' || dateRange === 'undated') return 0;
    const years = dateRange === 'past_year' ? 1 : dateRange === 'past_3_years' ? 3 : 5;
    return new Date(now - years * 365 * 86_400_000).getFullYear();
};

export const scopeMatchesFilters = (
    scope: SitegraphLocalIndexRef['scope'],
    filters: SitegraphSearchFilters,
    now: number
): boolean => {
    const sourceId = filters.sourceId || 'all';
    if (sourceId !== 'all' && scope.source_id !== sourceId) return false;
    const facet = filters.facet || 'all';
    if (facet !== 'all' && scope.facet !== facet) return false;
    const dateRange = filters.dateRange || 'all';
    if (dateRange === 'undated') return scope.year === 'undated';
    const floor = dateRangeFloorYear(dateRange, now);
    if (floor > 0) {
        const year = Number(scope.year);
        if (!Number.isFinite(year) || year < floor) return false;
    }
    return true;
};

export const shardMatchesFilters = (
    shard: VerificationShard,
    filters: SitegraphSearchFilters,
    now: number
): boolean => {
    const shardSourceId = String(shard.source_id || '');
    const sourceId = filters.sourceId || 'all';
    if (sourceId !== 'all' && shardSourceId !== sourceId) return false;
    const facet = filters.facet || 'all';
    if (facet !== 'all' && !shard.facet_range.includes(facet)) return false;
    const dateRange = filters.dateRange || 'all';
    if (dateRange === 'undated') return shard.year_range.includes('undated');
    const floor = dateRangeFloorYear(dateRange, now);
    if (floor > 0) {
        return shard.year_range.some(year => Number.isFinite(Number(year)) && Number(year) >= floor);
    }
    return true;
};

export const sourceEntriesById = (session: SitegraphRoutedSession): Map<string, SourceRegistryEntry> => {
    return new Map(session.sourceRegistry.sources.map(source => [source.source_id, source]));
};

export const routeForTerms = (
    session: RoutedSessionWithArtifactCache,
    terms: string[],
    intent: string
): QueryDirectoryRoute[] => {
    const routes: QueryDirectoryRoute[] = [];
    const seen = new Set<QueryDirectoryRoute>();
    for (const term of terms) {
        const route = session.globalQueryDirectory.entries[normalize(term)];
        if (route && !seen.has(route)) {
            seen.add(route);
            routes.push(route);
        }
    }
    const intentRoute = session.globalQueryDirectory.intents[intent];
    if (intentRoute && !seen.has(intentRoute)) routes.push(intentRoute);
    return routes;
};

export const uniqueOrdered = (values: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        if (!value || seen.has(value)) continue;
        seen.add(value);
        result.push(value);
    }
    return result;
};

const sourceIdsFromLocalIndexIds = (indexIds: string[]): string[] => {
    return indexIds
        .map(indexId => indexId.split('__')[0] || '')
        .filter(sourceId => sourceId.length > 0);
};

export const buildQueryPlan = (
    session: SitegraphRoutedSession,
    query: string,
    terms: string[],
    filters: SitegraphSearchFilters
): SitegraphQueryPlan => {
    const profile = detectQueryIntent(query);
    const routes = routeForTerms(session, terms, profile.intent);
    const routeSources = routes.flatMap(route => route.likely_sources);
    const routeLocalIndexes = routes.flatMap(route => route.local_index_ids);
    const routeResultTypes = routes.flatMap(route => route.expected_result_types);
    const routeDecisions = routes.map(route => ({
        term: route.term || profile.intent,
        local_index_count: route.local_index_ids.length,
        expected_cost_bytes: route.expected_cost_bytes,
        expected_utility_per_kb: route.expected_utility_per_kb,
        likely_sources: route.likely_sources,
        likely_facets: route.likely_facets,
    }));
    const estimatedCostBytes = routeDecisions.reduce((sum, route) => sum + route.expected_cost_bytes, 0);
    const estimatedUtility = routeDecisions.reduce((sum, route) => sum + route.expected_utility_per_kb, 0);
    const allSources = session.sourceRegistry.sources.map(source => source.source_id);
    const filteredSource = filters.sourceId && filters.sourceId !== 'all' ? [filters.sourceId] : [];
    const routedSourceIds = uniqueOrdered([
        ...filteredSource,
        ...profile.authoritySources,
        ...routeSources,
        ...sourceIdsFromLocalIndexIds(routeLocalIndexes),
    ]).filter(sourceId => allSources.includes(sourceId));
    const sourceIds = routedSourceIds.length > 0 ? routedSourceIds : allSources;
    const verificationSourceIds = filteredSource.length > 0 ? filteredSource : allSources;
    return {
        normalized_query: normalize(query),
        aliases: expandSitegraphQueryPhrases(query, session.queryAliases),
        intent: profile.intent,
        authority_sources: profile.authoritySources,
        expected_result_types: uniqueOrdered(routeResultTypes),
        source_ids: sourceIds,
        local_index_ids: uniqueOrdered(routeLocalIndexes),
        verification_source_ids: verificationSourceIds,
        declared_completion_scope: activeFilters(filters) ? 'scoped' : 'global',
        estimated_cost_bytes: estimatedCostBytes,
        estimated_utility_per_kb: Number(estimatedUtility.toFixed(6)),
        route_decisions: routeDecisions,
    };
};


export const localShardRefsFor = (ref: SitegraphLocalIndexRef): SitegraphLocalShardRef[] => {
    const shards = ref.shards ?? [];
    if (shards.length > 0) return shards;
    return ref.scope.shard_ids.map(shardId => ({
        shard_id: shardId,
        path: '',
        bytes: 0,
        count: 0,
    }));
};

export const lightIndexArtifactKey = (ref: SitegraphLocalIndexRef): string => {
    if (!ref.light_index_meta || !ref.light_index_packed) {
        throw new SearchContractError(`Local index ${ref.index_id} is missing split light artifacts`);
    }
    return `${ref.light_index_meta.path}|${ref.light_index_packed.path}`;
};

export const queryTermCacheKey = (terms: string[]): string => Array.from(new Set(terms)).sort().join('\u0000');

export const lightIndexRuntimeBytes = (ref: SitegraphLocalIndexRef): number => {
    if (!ref.light_index_meta || !ref.light_index_packed) {
        throw new SearchContractError(`Local index ${ref.index_id} is missing split light artifacts`);
    }
    return ref.light_index_meta.bytes + ref.light_index_packed.bytes;
};

export const lightIndexCachedBytes = (ref: SitegraphLocalIndexRef): number => {
    if (!ref.light_index_meta || !ref.light_index_packed) {
        throw new SearchContractError(`Local index ${ref.index_id} is missing split light artifacts`);
    }
    const metaBytes = localLightMetaCache.has(ref.light_index_meta.path) ? ref.light_index_meta.bytes : 0;
    const packedBytes = localLightPackedBytesCache.has(ref.light_index_packed.path) ? ref.light_index_packed.bytes : 0;
    return metaBytes + packedBytes;
};

export const bodyIndexArtifact = (ref: SitegraphLocalIndexRef): SitegraphArtifact => {
    if (!ref.body_index_packed) {
        throw new SearchContractError(`Local index ${ref.index_id} is missing packed body index artifact`);
    }
    return ref.body_index_packed;
};

export const bodyIndexCachedBytes = (ref: SitegraphLocalIndexRef): number => {
    const artifact = bodyIndexArtifact(ref);
    return localBodyPackedBytesCache.has(artifact.path) ? artifact.bytes : 0;
};

export const selectLocalRefsWithinBudget = (
    refs: SitegraphLocalIndexRef[],
    byteBudget: number,
    byteSize: (ref: SitegraphLocalIndexRef) => number,
    minimumRefs: number
): SitegraphLocalIndexRef[] => {
    const selected: SitegraphLocalIndexRef[] = [];
    let selectedBytes = 0;
    for (const ref of refs) {
        const bytes = byteSize(ref);
        const needMinimumCoverage = selected.length < minimumRefs;
        if (!needMinimumCoverage && selected.length > 0 && selectedBytes + bytes > byteBudget) {
            continue;
        }
        selected.push(ref);
        selectedBytes += bytes;
    }
    return selected.length > 0 ? selected : refs.slice(0, 1);
};

export const uniqueLocalRefs = (refs: SitegraphLocalIndexRef[]): SitegraphLocalIndexRef[] => {
    const seen = new Set<string>();
    const selected: SitegraphLocalIndexRef[] = [];
    for (const ref of refs) {
        if (seen.has(ref.index_id)) continue;
        seen.add(ref.index_id);
        selected.push(ref);
    }
    return selected;
};
