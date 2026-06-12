import type {
    SitegraphFullDocument,
    SitegraphLocalBodyIndex,
    SitegraphLocalLightIndex,
    SitegraphProofCatalog,
    SitegraphSourceManifest
} from '@njupt-search/contracts/search-index';
import type { ShardFilterMap } from './sitegraphShardFilter';
import type { HotQueryProofCertificate, HotQueryProofDirectory, HotQueryTopCertificate } from './sitegraphHotQuery';

export const sourceManifestCache = new Map<string, SitegraphSourceManifest>();
export const localLightIndexCache = new Map<string, SitegraphLocalLightIndex>();
export const localLightMetaCache = new Map<string, Omit<SitegraphLocalLightIndex, 'terms'>>();
export const localLightPackedBytesCache = new Map<string, ArrayBuffer>();
export const localBodyIndexCache = new Map<string, SitegraphLocalBodyIndex>();
export const localBodyPackedBytesCache = new Map<string, ArrayBuffer>();
export const proofCatalogCache = new Map<string, SitegraphProofCatalog>();
export const shardFilterCache = new Map<string, ShardFilterMap>();
export const hotQueryProofDirectoryCache = new Map<string, HotQueryProofDirectory>();
export const hotQueryTopProofCache = new Map<string, HotQueryTopCertificate>();
export const hotQueryProofCache = new Map<string, HotQueryProofCertificate>();
export const shardCache = new Map<string, SitegraphFullDocument[]>();

export const clearSitegraphRuntimeCaches = (): void => {
    sourceManifestCache.clear();
    localLightIndexCache.clear();
    localLightMetaCache.clear();
    localLightPackedBytesCache.clear();
    localBodyIndexCache.clear();
    localBodyPackedBytesCache.clear();
    proofCatalogCache.clear();
    shardFilterCache.clear();
    hotQueryProofDirectoryCache.clear();
    hotQueryTopProofCache.clear();
    hotQueryProofCache.clear();
    shardCache.clear();
};
