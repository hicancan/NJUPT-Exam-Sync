import { APP_CONFIG } from '@/app/config/constants';
import {
    SitegraphFacetSchema,
} from '@njupt-search/contracts/search-index';
import type {
    SitegraphArtifactCacheStats,
    SitegraphFilterOptions,
    SitegraphRoutedSession,
    SitegraphSearchManifest,
    SitegraphSourceRegistry,
} from '@njupt-search/contracts/search-index';
import { fetchJson } from '@/shared/lib/fetch';
import {
    fetchJsonArtifact,
    parseSitegraphGlobalQueryDirectory,
    parseSitegraphManifest,
    parseSitegraphSourceRegistry,
} from '@njupt-search/search-core';
import type {
    ArtifactContentCache,
    PackedImpactRetriever,
} from '@njupt-search/search-core';

export type CachedRoutedSession = SitegraphRoutedSession & {
    artifactCache?: ArtifactContentCache;
    packedImpactRetriever?: PackedImpactRetriever;
};

export type ReadyMessage = {
    type: 'ready';
    requestId: number;
    manifest: SitegraphSearchManifest;
    filterOptions: SitegraphFilterOptions;
    firstScreenBytes: number;
    bootstrapCache: Pick<SitegraphArtifactCacheStats, 'scope' | 'artifact_hits' | 'artifact_misses' | 'cached_bytes' | 'uncached_bytes'>;
};

export const publicPath = (path: string): string => {
    if (/^https?:\/\//.test(path) || path.startsWith('/')) return path;
    return `/${path}`;
};

const strictFilterOptions = (sourceRegistry: SitegraphSourceRegistry): SitegraphFilterOptions => ({
    sources: sourceRegistry.filter_options.sources,
    facets: sourceRegistry.filter_options.facets.map(facet => ({
        ...facet,
        id: SitegraphFacetSchema.parse(facet.id),
    })),
});

export const createSearchWorkerSession = (
    artifactCache: ArtifactContentCache,
    packedImpactRetriever: PackedImpactRetriever
) => {
    let manifest: SitegraphSearchManifest | null = null;
    let session: CachedRoutedSession | null = null;

    const loadManifest = async (controller: AbortController): Promise<SitegraphSearchManifest> => {
        if (manifest) return manifest;
        const manifestPath = publicPath(APP_CONFIG.DATA_URLS.SEARCH_MANIFEST);
        const manifestPayload = await fetchJson(manifestPath, controller.signal, 'manifest');
        manifest = parseSitegraphManifest(manifestPayload, manifestPath);
        return manifest;
    };

    const loadSession = async (
        requestId: number,
        controller: AbortController
    ): Promise<{ session: CachedRoutedSession; readyMessage: ReadyMessage }> => {
        const loadedManifest = await loadManifest(controller);
        const artifacts = loadedManifest.artifacts;
        const [sourceRegistryPayload, queryDirectoryPayload, aliasesPayload] = await Promise.all([
            fetchJsonArtifact(publicPath(artifacts.source_registry.path), controller.signal, 'index', artifactCache),
            fetchJsonArtifact(publicPath(artifacts.global_query_directory.path), controller.signal, 'index', artifactCache),
            fetchJsonArtifact(publicPath(artifacts.query_aliases.path), controller.signal, 'index', artifactCache),
        ]);
        const sourceRegistry = parseSitegraphSourceRegistry(sourceRegistryPayload.value, artifacts.source_registry.path);
        const filterOptions = strictFilterOptions(sourceRegistry);
        session = {
            manifest: loadedManifest,
            sourceRegistry,
            globalQueryDirectory: parseSitegraphGlobalQueryDirectory(queryDirectoryPayload.value, artifacts.global_query_directory.path),
            queryAliases: aliasesPayload.value as Record<string, unknown>,
            artifactCache,
            packedImpactRetriever,
        };
        const bootstrapPayloads = [sourceRegistryPayload, queryDirectoryPayload, aliasesPayload];
        return {
            session,
            readyMessage: {
                type: 'ready',
                requestId,
                manifest: loadedManifest,
                filterOptions,
                firstScreenBytes: artifacts.source_registry.bytes + artifacts.global_query_directory.bytes + artifacts.query_aliases.bytes,
                bootstrapCache: {
                    scope: artifactCache.scope,
                    artifact_hits: bootstrapPayloads.filter(item => item.cacheHit).length,
                    artifact_misses: bootstrapPayloads.filter(item => !item.cacheHit).length,
                    cached_bytes: bootstrapPayloads
                        .filter(item => item.cacheHit)
                        .reduce((sum, item) => sum + item.byteLength, 0),
                    uncached_bytes: bootstrapPayloads
                        .filter(item => !item.cacheHit)
                        .reduce((sum, item) => sum + item.byteLength, 0),
                },
            },
        };
    };

    return {
        clear() {
            manifest = null;
            session = null;
        },
        getSession() {
            return session;
        },
        loadManifest,
        loadSession,
    };
};
