import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    SitegraphDocMetaSchema,
    SitegraphGlobalQueryDirectorySchema,
    SitegraphProofCatalogSchema,
    SitegraphSearchManifestSchema,
    SitegraphSourceManifestSchema,
    SitegraphSourceRegistrySchema
} from '../src';

const loadPublicJson = (relativePath: string): unknown => {
    return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf-8'));
};

const required = <T>(value: T | undefined, message: string): T => {
    if (value === undefined) throw new Error(message);
    return value;
};

const EXPECTED_SOURCE_IDS = [
    'bhs',
    'bwc',
    'cs',
    'cxcy',
    'fwlc',
    'gzzd',
    'job91',
    'jwc',
    'lib',
    'scie',
    'tyb',
    'www',
    'xsc',
    'xxb',
    'xxgk'
];

const asRecord = (value: unknown, message: string): Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(message);
    return value as Record<string, unknown>;
};

const asRecords = (value: unknown, message: string): Record<string, unknown>[] => {
    if (!Array.isArray(value) || value.some(item => typeof item !== 'object' || item === null || Array.isArray(item))) {
        throw new Error(message);
    }
    return value as Record<string, unknown>[];
};

const loadArtifactRecord = (path: string): Record<string, unknown> => {
    return asRecord(loadPublicJson(`../../../apps/web/public/${path}`), `expected artifact object: ${path}`);
};

const expandLocalIndexes = (sourceManifest: { artifacts: { local_indexes?: { path: string } } }): Record<string, unknown>[] => {
    const localIndexes = loadArtifactRecord(required(sourceManifest.artifacts.local_indexes, 'expected local index manifest').path);
    expect(localIndexes.version).toBe('sitegraph-local-index-parts-v1');
    const parts = asRecords(localIndexes.parts, 'expected local index parts');
    const records = parts.flatMap(part => {
        const payload = loadArtifactRecord(String(required(part.path as string | undefined, 'expected local index part path')));
        expect(payload.version).toBe('sitegraph-local-index-part-v1');
        return asRecords(payload.records, 'expected local index part records');
    });
    expect(records.length).toBe(localIndexes.record_count);
    return records;
};

const expandProofCatalog = (sourceManifest: { source_id: string; artifacts: { proof_catalog?: { path: string } } }): Record<string, unknown> => {
    const proofCatalog = loadArtifactRecord(required(sourceManifest.artifacts.proof_catalog, 'expected proof catalog').path);
    if (proofCatalog.version !== 'sitegraph-proof-ledger-catalog-parts-v1') return proofCatalog;
    const parts = asRecords(proofCatalog.parts, 'expected proof catalog parts');
    const shards = parts.flatMap(part => {
        const payload = loadArtifactRecord(String(required(part.path as string | undefined, 'expected proof catalog part path')));
        expect(payload.version).toBe('sitegraph-proof-ledger-catalog-part-v1');
        return asRecords(payload.shards, 'expected proof catalog part shards');
    });
    expect(shards.length).toBe(proofCatalog.shard_count);
    return {
        version: proofCatalog.catalog_version,
        source_id: sourceManifest.source_id,
        state_model: proofCatalog.state_model,
        complete_requires_no_states: proofCatalog.complete_requires_no_states,
        covered_fields: proofCatalog.covered_fields,
        shards
    };
};

describe('search index contracts package', () => {
    it('accepts the committed public search manifest', () => {
        const manifest = SitegraphSearchManifestSchema.parse(
            loadPublicJson('../../../apps/web/public/generated/collections/njupt-public/manifest.json')
        );

        expect(manifest.strategy).toBe('routed-verifiable-static-search');
        expect(manifest.exam_vertical_preserved).toBe(true);
        expect(manifest.core_search.first_screen_artifacts).toEqual(['source_registry', 'global_query_directory', 'query_aliases']);
        expect(manifest.progressive_search.full_scan_supported).toBe(true);
        expect(manifest.verification_contract.shard_filter_supported).toBe(true);
        expect(manifest.verification_contract.proof_catalog_artifact_family).toBe('proof_catalogs');
        expect(manifest.verification_contract.completion_requires_ledger).toBe(true);
        expect('full_shards' in manifest.sitegraph).toBe(false);
        expect(Object.keys(manifest.sitegraph.source_manifests).length).toBeGreaterThan(0);
        expect('doc_meta_light' in manifest.artifacts).toBe(false);
        expect('light_inverted_index' in manifest.artifacts).toBe(false);
    });

    it('accepts routed bootstrap artifacts and source manifests', () => {
        const manifest = SitegraphSearchManifestSchema.parse(
            loadPublicJson('../../../apps/web/public/generated/collections/njupt-public/manifest.json')
        );
        const sourceRegistry = SitegraphSourceRegistrySchema.parse(
            loadPublicJson(`../../../apps/web/public/${manifest.artifacts.source_registry.path}`)
        );
        const queryDirectory = SitegraphGlobalQueryDirectorySchema.parse(
            loadPublicJson(`../../../apps/web/public/${manifest.artifacts.global_query_directory.path}`)
        );
        const sourceManifest = SitegraphSourceManifestSchema.parse(
            loadPublicJson(`../../../apps/web/public/${manifest.sitegraph.source_manifests.jwc.path}`)
        );

        expect(sourceRegistry.sources.map(source => source.source_id).sort()).toEqual(EXPECTED_SOURCE_IDS);
        expect(queryDirectory.entry_count).toBe(Object.keys(queryDirectory.entries).length);
        expect(queryDirectory.entries['大创']?.local_index_ids.length).toBeGreaterThan(0);
        const localIndexes = expandLocalIndexes(sourceManifest);
        expect(localIndexes.length).toBeGreaterThan(0);
        expect(sourceManifest.full_shards.length).toBe(0);
        expect(sourceManifest.attachment_evidence_coverage?.filename_only).toBe(sourceManifest.attachment_count);
        expect(sourceManifest.attachment_evidence_coverage?.text_extracted).toBe(0);
        const firstLocalIndex = localIndexes[0] ?? {};
        expect(asRecords(firstLocalIndex.shards, 'expected local index shards').length).toBeGreaterThan(0);
        expect(asRecord(firstLocalIndex.light_index_meta, 'expected light meta').role).toBe('local_impact_light_index_meta');
        const lightIndexPacked = asRecord(firstLocalIndex.light_index_packed, 'expected packed light index');
        expect(lightIndexPacked.role).toBe('local_impact_light_index_packed');
        expect(String(lightIndexPacked.path).endsWith('.bin')).toBe(true);
        expect(firstLocalIndex.body_index).toBeUndefined();
        const bodyIndexPacked = asRecord(firstLocalIndex.body_index_packed, 'expected packed body index');
        expect(bodyIndexPacked.role).toBe('local_impact_body_index_packed');
        expect(String(bodyIndexPacked.path).endsWith('.bin')).toBe(true);
        expect(sourceManifest.artifacts.proof_catalog?.role).toBe('proof_catalog');
        const proofCatalog = SitegraphProofCatalogSchema.parse(
            expandProofCatalog(sourceManifest)
        );
        expect(proofCatalog.shards.length).toBeGreaterThan(0);
        expect(proofCatalog.complete_requires_no_states).toEqual(expect.arrayContaining(['pending', 'failed']));
    });

    it('keeps local light index metadata free of full-document fields', () => {
        const manifest = SitegraphSearchManifestSchema.parse(
            loadPublicJson('../../../apps/web/public/generated/collections/njupt-public/manifest.json')
        );
        const sourceManifest = SitegraphSourceManifestSchema.parse(
            loadPublicJson(`../../../apps/web/public/${manifest.sitegraph.source_manifests.jwc.path}`)
        );
        const firstLocalIndex = required(expandLocalIndexes(sourceManifest)[0], 'expected a local light index fixture');
        const localLightIndex = loadPublicJson(
            `../../../apps/web/public/${String(required(asRecord(firstLocalIndex.light_index_meta, 'expected light metadata artifact').path as string | undefined, 'expected light metadata path'))}`
        ) as Record<string, unknown>;
        const documents = required(localLightIndex.documents as unknown[] | undefined, 'expected local metadata documents');
        const firstDoc = required(documents[0] as Record<string, unknown> | undefined, 'expected local metadata');

        expect(firstDoc.source_id).toBe('jwc');
        expect('content' in firstDoc).toBe(false);
        expect('summary' in firstDoc).toBe(false);
        expect('attachments' in firstDoc).toBe(false);
        expect('provenance' in firstDoc).toBe(false);
        expect(firstLocalIndex.light_index).toBeUndefined();
        expect('tokens' in localLightIndex).toBe(false);
        expect('terms' in localLightIndex).toBe(false);
        expect(localLightIndex.scoring_model).toBe('impact-ordered-block-max-bm25f-lite-v2');
        expect(String(required(asRecord(firstLocalIndex.light_index_packed, 'expected packed light terms artifact').path as string | undefined, 'expected packed light path')).endsWith('.bin')).toBe(true);

        const docMeta = {
            doc_index: 0,
            id: 'jwc-detail-1',
            record_type: 'detail',
            facet: 'policy',
            title: '南京邮电大学本科生转专业管理办法',
            url: 'https://jwc.njupt.edu.cn/1/page.htm',
            source: '本科生院 / 教务处',
            section: '规章制度',
            nav_path: ['规章制度'],
            nav_path_text: '规章制度',
            attachment_count: 1,
            shard: { shard_id: 'policy__detail__2026__rules__b0', path: 'fixture.json' }
        };

        expect(SitegraphDocMetaSchema.parse(docMeta).id).toBe('jwc-detail-1');
        expect(SitegraphDocMetaSchema.safeParse({ ...docMeta, title: '' }).success).toBe(false);
    });
});
