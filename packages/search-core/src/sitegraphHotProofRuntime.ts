import type {
    SitegraphArtifact,
    SitegraphArtifactCacheStats,
    SitegraphProofLedgerEntry,
    SitegraphRoutedSession,
    SitegraphSearchFilters
} from '@njupt-search/contracts';
import type { ArtifactContentCache } from './fetchJson';
import { sitegraphDocumentMatchesFilters } from './sitegraphFilters';
import { parseSitegraphFullDocuments, SearchContractError } from './sitegraphContract';
import type { RoutedSessionWithArtifactCache, VerificationShard } from './sitegraphSearchTypes';
import { fetchJsonArtifactPayload, recordArtifactCache } from './sitegraphRuntimeFetch';
import { hotQueryProofCache, hotQueryProofDirectoryCache, hotQueryTopProofCache } from './sitegraphRuntimeCaches';
import { shardMatchesFilters } from './sitegraphQueryPlanning';
import { buildProofLedger } from './sitegraphProofLedgerRuntime';
import {
    HOT_QUERY_CERTIFICATE_MODEL,
    HOT_QUERY_CERTIFICATE_VERSION,
    HOT_QUERY_COMPLETE_PROOF_MODEL,
    HOT_QUERY_DIRECTORY_VERSION,
    HOT_QUERY_PROOF_DOCUMENT_ENCODING,
    HOT_QUERY_RANK_EVIDENCE_MODEL,
    HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
    HOT_QUERY_TOPK_CERTIFICATE_VERSION,
    HotQueryProofCertificate,
    HotQueryProofDocument,
    HotQueryProofDirectory,
    HotQueryProofDirectoryEntry,
    HotQueryTopCertificate,
    parseHotQueryProofDocuments,
    resolveHotQueryProofEntry
} from './sitegraphHotQuery';

export const hotQueryProofDirectoryArtifact = (session: SitegraphRoutedSession): SitegraphArtifact | undefined => {
    const artifacts = session.manifest.artifacts as Record<string, SitegraphArtifact | undefined>;
    return artifacts.hot_query_proof_directory;
};

export const loadHotQueryProofDirectory = async (
    session: SitegraphRoutedSession,
    signal: AbortSignal,
    cacheStats?: SitegraphArtifactCacheStats,
    artifactCache?: ArtifactContentCache
): Promise<HotQueryProofDirectory | null> => {
    const artifact = hotQueryProofDirectoryArtifact(session);
    if (!artifact?.path) return null;
    const existing = hotQueryProofDirectoryCache.get(artifact.path);
    if (existing) {
        recordArtifactCache(cacheStats, true, artifact.bytes, 'memory');
        return existing;
    }
    const payload = await fetchJsonArtifactPayload<HotQueryProofDirectory>(
        artifact.path,
        signal,
        'index',
        cacheStats,
        artifact.bytes,
        artifactCache
    );
    if (
        !payload
        || payload.version !== HOT_QUERY_DIRECTORY_VERSION
        || payload.scope !== 'global_unfiltered_queries'
        || payload.certificate_model !== HOT_QUERY_CERTIFICATE_MODEL
        || payload.complete_proof_model !== HOT_QUERY_COMPLETE_PROOF_MODEL
        || payload.top_document_payload_model !== HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL
        || payload.rank_evidence_model !== HOT_QUERY_RANK_EVIDENCE_MODEL
        || !payload.queries
    ) {
        throw new SearchContractError(`Validation failed for ${artifact.path}: invalid hot query proof directory`);
    }
    hotQueryProofDirectoryCache.set(artifact.path, payload);
    return payload;
};

export const loadHotQueryProofCertificate = async (
    entry: HotQueryProofDirectoryEntry,
    signal: AbortSignal,
    cacheStats?: SitegraphArtifactCacheStats,
    artifactCache?: ArtifactContentCache
): Promise<HotQueryProofCertificate> => {
    const existing = hotQueryProofCache.get(entry.path);
    if (existing) {
        recordArtifactCache(cacheStats, true, entry.bytes, 'memory');
        return existing;
    }
    const payload = await fetchJsonArtifactPayload<HotQueryProofCertificate>(
        entry.path,
        signal,
        'index',
        cacheStats,
        entry.bytes,
        artifactCache
    );
    if (
        !payload
        || payload.version !== HOT_QUERY_CERTIFICATE_VERSION
        || payload.proof_payload_model !== HOT_QUERY_COMPLETE_PROOF_MODEL
        || payload.rank_evidence_model !== HOT_QUERY_RANK_EVIDENCE_MODEL
        || payload.document_encoding !== HOT_QUERY_PROOF_DOCUMENT_ENCODING
        || payload.normalized_query !== entry.normalized_query
        || payload.phrase_key !== entry.phrase_key
        || !Array.isArray(payload.rank_terms)
        || !payload.document_dictionaries
        || !Array.isArray(payload.documents)
    ) {
        throw new SearchContractError(`Validation failed for ${entry.path}: invalid hot query proof certificate`);
    }
    payload.documents = parseHotQueryProofDocuments(payload.documents, entry.path, payload.document_dictionaries);
    hotQueryProofCache.set(entry.path, payload);
    return payload;
};

export const loadHotQueryTopProofCertificate = async (
    entry: HotQueryProofDirectoryEntry,
    signal: AbortSignal,
    cacheStats?: SitegraphArtifactCacheStats,
    artifactCache?: ArtifactContentCache
): Promise<HotQueryTopCertificate | null> => {
    const topEntry = entry.top_certificate;
    if (!topEntry?.path) return null;
    const existing = hotQueryTopProofCache.get(topEntry.path);
    if (existing) {
        recordArtifactCache(cacheStats, true, topEntry.bytes, 'memory');
        return existing;
    }
    const payload = await fetchJsonArtifactPayload<HotQueryTopCertificate>(
        topEntry.path,
        signal,
        'index',
        cacheStats,
        topEntry.bytes,
        artifactCache
    );
    if (
        !payload
        || payload.version !== HOT_QUERY_TOPK_CERTIFICATE_VERSION
        || payload.document_payload_model !== HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL
        || payload.rank_evidence_model !== HOT_QUERY_RANK_EVIDENCE_MODEL
        || payload.normalized_query !== entry.normalized_query
        || payload.phrase_key !== entry.phrase_key
        || !Array.isArray(payload.rank_terms)
        || !Array.isArray(payload.documents)
    ) {
        throw new SearchContractError(`Validation failed for ${topEntry.path}: invalid hot query top-k proof certificate`);
    }
    payload.documents = parseSitegraphFullDocuments(payload.documents, topEntry.path);
    hotQueryTopProofCache.set(topEntry.path, payload);
    return payload;
};

export const loadMatchingHotQueryProof = async (
    session: RoutedSessionWithArtifactCache,
    normalizedQuery: string,
    signal: AbortSignal,
    cacheStats: SitegraphArtifactCacheStats
): Promise<{ certificate: HotQueryProofCertificate; bytes: number } | null> => {
    const directory = await loadHotQueryProofDirectory(session, signal, cacheStats, session.artifactCache);
    if (!directory) return null;
    const match = resolveHotQueryProofEntry(directory, normalizedQuery);
    if (!match) return null;
    const entry = match.entry;
    const certificate = await loadHotQueryProofCertificate(entry, signal, cacheStats, session.artifactCache);
    if (certificate.phrase_key !== entry.phrase_key) return null;
    const directoryBytes = hotQueryProofDirectoryArtifact(session)?.bytes ?? 0;
    return { certificate, bytes: directoryBytes + entry.bytes };
};

export const loadMatchingHotQueryTopProof = async (
    session: RoutedSessionWithArtifactCache,
    normalizedQuery: string,
    signal: AbortSignal,
    cacheStats: SitegraphArtifactCacheStats
): Promise<{ certificate: HotQueryTopCertificate; completeEntry: HotQueryProofDirectoryEntry; bytes: number } | null> => {
    const directory = await loadHotQueryProofDirectory(session, signal, cacheStats, session.artifactCache);
    if (!directory) return null;
    const match = resolveHotQueryProofEntry(directory, normalizedQuery);
    if (!match) return null;
    const entry = match.entry;
    const certificate = await loadHotQueryTopProofCertificate(entry, signal, cacheStats, session.artifactCache);
    if (!certificate || certificate.phrase_key !== entry.phrase_key) return null;
    const directoryBytes = hotQueryProofDirectoryArtifact(session)?.bytes ?? 0;
    return { certificate, completeEntry: entry, bytes: directoryBytes + (entry.top_certificate?.bytes ?? 0) };
};

export const buildHotQueryScopedLedger = (
    verificationShards: VerificationShard[],
    certificateMatches: HotQueryProofDocument[],
    certificateMatchedShards: string[],
    filters: SitegraphSearchFilters,
    now: number
): { entries: SitegraphProofLedgerEntry[]; inScopeDocumentCount: number } => {
    const entries = buildProofLedger(verificationShards, filters, now);
    const inScopeShards = verificationShards.filter(shard => shardMatchesFilters(shard, filters, now));
    const matchedShardIds = new Set(
        certificateMatchedShards
            .map(shardId => String(shardId || ''))
            .filter(Boolean)
    );
    if (matchedShardIds.size === 0) {
        for (const document of certificateMatches.filter(document => sitegraphDocumentMatchesFilters(document, filters, now))) {
            if (document.shard_id) matchedShardIds.add(document.shard_id);
        }
    }
    for (const entry of entries) {
        if (entry.state !== 'pending') continue;
        if (matchedShardIds.has(entry.shard_id)) {
            entry.state = 'scanned';
            entry.reason = 'hot query complete certificate enumerated every matching document in this scoped shard';
        } else {
            entry.state = 'proved_no_match';
            entry.reason = 'global hot query complete certificate proves no matching document exists in this scoped shard';
        }
    }
    return {
        entries,
        inScopeDocumentCount: inScopeShards.reduce((sum, shard) => sum + shard.count, 0),
    };
};
