import type { SitegraphArtifactCacheStats } from '@njupt-search/contracts/search-index';
import {
    type ArtifactContentCache,
    type ArtifactCacheScope,
    fetchArrayBufferArtifact,
    fetchJsonArtifact
} from './fetchJson';

export const createCacheStats = (scope: ArtifactCacheScope = 'memory_content_hash'): SitegraphArtifactCacheStats => ({
    scope,
    artifact_hits: 0,
    artifact_misses: 0,
    cached_bytes: 0,
    uncached_bytes: 0,
    cacheable_bytes: 0,
    memory_hits: 0,
    persistent_hits: 0,
    network_misses: 0,
});

export const snapshotCacheStats = (stats: SitegraphArtifactCacheStats): SitegraphArtifactCacheStats => ({ ...stats });

export const recordArtifactCache = (
    stats: SitegraphArtifactCacheStats | undefined,
    cached: boolean,
    bytes: number,
    layer: 'memory' | 'persistent' | 'network' = cached ? 'memory' : 'network'
): void => {
    if (!stats) return;
    const safeBytes = Math.max(0, Number(bytes) || 0);
    stats.cacheable_bytes += safeBytes;
    if (cached) {
        stats.artifact_hits += 1;
        stats.cached_bytes += safeBytes;
        if (layer === 'persistent') stats.persistent_hits += 1;
        else stats.memory_hits += 1;
    } else {
        stats.artifact_misses += 1;
        stats.uncached_bytes += safeBytes;
        stats.network_misses += 1;
    }
};

const publicAssetPath = (path: string): string => {
    if (/^https?:\/\//.test(path) || path.startsWith('/')) return path;
    return `/${path}`;
};

export const artifactPersistentCached = async (
    cache: ArtifactContentCache | undefined,
    path: string
): Promise<boolean> => {
    if (!cache) return false;
    try {
        return await cache.has(publicAssetPath(path));
    } catch {
        return false;
    }
};

export const fetchJsonArtifactPayload = async <T = unknown>(
    path: string,
    signal: AbortSignal,
    resourceType: 'index' | 'shard',
    cacheStats: SitegraphArtifactCacheStats | undefined,
    artifactBytes: number,
    artifactCache?: ArtifactContentCache
): Promise<T> => {
    const result = await fetchJsonArtifact<T>(publicAssetPath(path), signal, resourceType, artifactCache);
    recordArtifactCache(
        cacheStats,
        result.cacheHit,
        artifactBytes,
        result.cacheHit ? 'persistent' : 'network'
    );
    return result.value;
};

export const fetchArrayBufferArtifactPayload = async (
    path: string,
    signal: AbortSignal,
    cacheStats: SitegraphArtifactCacheStats | undefined,
    artifactBytes: number,
    artifactCache?: ArtifactContentCache
): Promise<ArrayBuffer> => {
    const result = await fetchArrayBufferArtifact(publicAssetPath(path), signal, 'index', artifactCache);
    recordArtifactCache(
        cacheStats,
        result.cacheHit,
        artifactBytes,
        result.cacheHit ? 'persistent' : 'network'
    );
    return result.value;
};

export const throwIfAborted = (signal: AbortSignal): void => {
    if (signal.aborted) {
        throw new DOMException('Search cancelled', 'AbortError');
    }
};

export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

export const yieldToWorker = async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 0));
};
