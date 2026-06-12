import type {
    SitegraphDocMeta,
    SitegraphLocalBodyIndex,
    SitegraphLocalIndexRef,
    SitegraphLocalLightIndex,
    SitegraphQueryPlan,
    SitegraphRoutedSession,
    SitegraphSourceManifest
} from '@njupt-search/contracts/search-index';
import type { ArtifactContentCache } from './fetchJson';

export const DEFAULT_CANDIDATE_LIMIT = 160;
export const DEFAULT_MAX_SHARD_LOADS = 40;
export const QUICK_MAX_SHARD_LOADS = 8;
export const BODY_MAX_SHARD_LOADS = 18;
export const HYDRATE_MAX_SHARD_LOADS = 18;
export const SHARD_BATCH_SIZE = 4;
export const ONE_MIB = 1024 * 1024;
export const FIRST_TRUSTED_MAX_UNCACHED_BYTES = Math.floor(1.5 * ONE_MIB);
export const FIRST_TRUSTED_HYDRATION_RESERVE_BYTES = Math.floor(0.5 * ONE_MIB);
export const TOP_RESULTS_MAX_UNCACHED_BYTES = 3 * ONE_MIB;
export const TOP_RESULTS_HYDRATION_RESERVE_BYTES = ONE_MIB;
export const MIN_FIRST_TRUSTED_LOCAL_INDEXES = 2;
export const MIN_TOP_RESULTS_LOCAL_INDEXES = 6;
export const RARE_DYNAMIC_FIRST_TRUSTED_LOCAL_INDEX_BYTES = 128 * 1024;
export const RARE_DYNAMIC_TOP_RESULTS_LOCAL_INDEX_BYTES = 512 * 1024;
export const RARE_DYNAMIC_QUICK_MAX_SHARD_LOADS = 4;
export const RARE_DYNAMIC_MIN_FIRST_TRUSTED_LOCAL_INDEXES = 1;
export const RARE_DYNAMIC_MIN_TOP_RESULTS_LOCAL_INDEXES = 3;
export const HIGH_DF_FIRST_TRUSTED_LOCAL_INDEX_BYTES = 384 * 1024;
export const HIGH_DF_TOP_RESULTS_LOCAL_INDEX_BYTES = ONE_MIB;
export const HIGH_DF_MIN_FIRST_TRUSTED_LOCAL_INDEXES = 3;
export const HIGH_DF_MIN_TOP_RESULTS_LOCAL_INDEXES = 6;
export const LIGHT_SEARCH_FIELDS = ['title', 'section', 'nav_path', 'tags', 'attachments', 'external', 'system'];
export const BODY_SEARCH_FIELDS = [...LIGHT_SEARCH_FIELDS, 'summary', 'content'];
export const FULL_SCAN_FIELDS = ['title', 'section', 'nav_path', 'summary', 'content', 'attachments', 'url'];

export type RoutedSessionWithArtifactCache = SitegraphRoutedSession & {
    artifactCache?: ArtifactContentCache;
    packedImpactRetriever?: PackedImpactRetriever;
};

export interface PackedImpactRetrievalInput {
    bytes: ArrayBuffer;
    terms: string[];
    targetCandidates: number;
    source: string;
}

export interface PackedImpactRetrievalResult {
    scoreEntries: Array<readonly [number, number]>;
    matchedTermCount: number;
    blockCount: number;
    candidateCount: number;
    impactBlocksVisited: number;
    impactBlocksPruned: number;
    postingsVisited: number;
    postingsPruned: number;
    competitiveThreshold: number;
}

export type PackedImpactRetrievalMetrics = Omit<PackedImpactRetrievalResult, 'scoreEntries'>;

export interface PackedImpactRetrievalSession {
    applyPackedImpactScores(input: PackedImpactRetrievalInput): Promise<PackedImpactRetrievalMetrics>;
    readScoreEntries(): Promise<Array<readonly [number, number]>>;
}

export interface PackedImpactRetriever {
    engine: 'rust_wasm_packed_impact' | string;
    createSession?(targetCandidates: number): Promise<PackedImpactRetrievalSession>;
    retrievePackedImpactScores(input: PackedImpactRetrievalInput): Promise<PackedImpactRetrievalResult>;
}

export interface LoadedPlanningScope {
    sourceManifests: SitegraphSourceManifest[];
    localRefs: SitegraphLocalIndexRef[];
    sourceManifestBytes: number;
    shardPathById: Map<string, string>;
    shardBytesByPath: Map<string, number>;
    selectedLocalIndexes: NonNullable<SitegraphQueryPlan['selected_local_indexes']>;
}

export interface VerificationShard {
    shard_id: string;
    source_id: string;
    path: string;
    sha256: string;
    bytes: number;
    count: number;
    facet_range: string[];
    record_type_range: string[];
    section_range: string[];
    year_range: string[];
    hash_bucket: string;
    filter_token_count?: number;
    filter_sha256?: string;
}

export interface SearchTelemetry {
    localMetaFallbackDocIndices: Set<number>;
    fullScanMatchDocIndices: Set<number>;
    retrieval: {
        dynamicPruning: boolean;
        engine: 'typescript_impact_index' | 'rust_wasm_packed_impact' | 'mixed';
        impactBlocksVisited: number;
        impactBlocksPruned: number;
        postingsVisited: number;
        postingsPruned: number;
        competitiveThreshold: number;
        wasmCalls: number;
        typescriptCalls: number;
        scoreEntriesReturned: number;
    };
}

export interface LoadedLocalLightRuntimeIndex {
    documents: SitegraphDocMeta[];
    index?: SitegraphLocalLightIndex;
    packedBytes?: ArrayBuffer;
    packedPath?: string;
}

export interface LoadedLocalBodyRuntimeIndex {
    index?: SitegraphLocalBodyIndex;
    packedBytes?: ArrayBuffer;
    packedPath?: string;
}
