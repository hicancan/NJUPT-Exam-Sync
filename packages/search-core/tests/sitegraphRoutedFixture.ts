import type {
    QueryDirectoryRoute,
    SitegraphFullDocument,
    SitegraphGlobalQueryDirectory,
    SitegraphImpactIndex,
    SitegraphLocalBodyIndex,
    SitegraphLocalIndexRef,
    SitegraphLocalLightIndex,
    SitegraphProofCatalog,
    SitegraphRoutedSession,
    SitegraphSearchManifest,
    SitegraphSourceManifest,
    SitegraphSourceRegistry
} from '@njupt-search/contracts';
import type { ArtifactContentCache } from '../src';
import {
    artifact,
    docMetaFrom,
    fullShard,
    impactTerms,
    packedImpactIndexFixture,
    packedImpactIndexFixtureV2,
    required,
    route
} from './sitegraphFixturePrimitives';

export interface RoutedFixture {
    session: SitegraphRoutedSession;
    sourceManifest: SitegraphSourceManifest;
    proofCatalog: SitegraphProofCatalog;
    localLightIndex: SitegraphLocalLightIndex;
    localBodyIndex: SitegraphLocalBodyIndex;
    shardFilter: Record<string, unknown>;
    documents: SitegraphFullDocument[];
}

export const makeRoutedFixture = (
    prefix: string,
    documents: SitegraphFullDocument[],
    options: {
        queryTerms?: string[];
        lightTerms?: SitegraphImpactIndex['terms'];
        bodyTerms?: SitegraphImpactIndex['terms'];
        queryAliases?: Record<string, unknown>;
        routeEntries?: Record<string, QueryDirectoryRoute>;
        intentRoutes?: Record<string, QueryDirectoryRoute>;
        facet?: string;
        filterBase64?: string;
        filterBitCount?: number;
        filterHashCount?: number;
    } = {}
): RoutedFixture => {
    const shard = fullShard(prefix, documents.length, options.facet || documents[0]?.facet || 'policy');
    const localIndexId = `jwc__${options.facet || documents[0]?.facet || 'policy'}__2026__${prefix}`;
    const scope = {
        index_id: localIndexId,
        source_id: 'jwc',
        facet: options.facet || documents[0]?.facet || 'policy',
        year: '2026',
        shard_ids: [shard.shard_id]
    };
    const localRef: SitegraphLocalIndexRef = {
        index_id: localIndexId,
        scope,
        doc_count: documents.length,
        shards: [{
            shard_id: shard.shard_id,
            path: shard.path,
            bytes: shard.bytes,
            count: shard.count
        }],
        light_index_meta: artifact(`${prefix}/local-impact-light-meta.json`, 'local_impact_light_index_meta', 'query_planned', documents.length),
        light_index_packed: artifact(`${prefix}/local-impact-light.bin`, 'local_impact_light_index_packed', 'query_planned', documents.length),
        body_index_packed: artifact(`${prefix}/local-impact-body.bin`, 'local_impact_body_index_packed', 'query_planned', documents.length)
    };
    const manifest: SitegraphSearchManifest = {
        generated_at: '2026-05-30T00:00:00Z',
        strategy: 'routed-verifiable-static-search',
        producer_repo: 'hicancan/njupt-search',
        producer_ref: 'fixture',
        site_id: 'njupt-public',
        collection_id: 'njupt-public',
        artifact_path: 'generated/collections/njupt-public',
        upstream_generated_at: '2026-05-30T00:00:00Z',
        truth_counts: { detail_pages: documents.length, attachments: 1, external_links: 0, edges: 0 },
        total_documents: documents.length,
        record_counts: { detail: documents.length },
        facet_counts: { [scope.facet]: documents.length },
        exam_vertical_preserved: true,
        core_search: {
            algorithm: 'routed fixture',
            execution_model: 'pure_frontend_worker',
            readiness: 'routed_bootstrap',
            legacy_global_first_screen: false,
            first_screen_artifacts: ['source_registry', 'global_query_directory', 'query_aliases'],
            fast_start_artifacts: ['hot_query_fast_start'],
            hot_query_initial_results: 20,
            local_index_loading: 'query_planned_on_demand',
            body_index_loading: 'query_planned_on_demand',
            full_text_loading: 'lazy_candidate_hydration_then_verified_scope_scan',
            search_worker: true
        },
        progressive_search: {
            total_shards: 1,
            total_documents: documents.length,
            full_scan_supported: true,
            progressive_events: true,
            artifact_roles: ['source_registry', 'global_query_directory', 'hot_query_fast_start', 'hot_query_top_initial', 'local_impact_light_index_meta', 'local_impact_light_index_packed', 'local_impact_body_index_packed', 'proof_catalog', 'full_shards']
        },
        coverage_contract: {
            states: ['plan_started', 'local_index_started', 'first_trusted_results', 'body_index_started', 'top_results_hydrated', 'verification_started', 'partial_verified', 'global_exhaustive_complete'],
            coverage_fields: ['title', 'section', 'nav_path', 'summary', 'content', 'attachments', 'url'],
            attachment_evidence_levels: ['metadata_only', 'filename_only', 'text_extracted', 'snippet', 'full_content'],
            proof: {
                indexed_fields: ['title', 'section', 'nav_path', 'attachments'],
                full_scan_fields: ['title', 'section', 'nav_path', 'summary', 'content', 'attachments', 'url'],
                complete_requires: ['proof_ledger', 'shard_filter', 'full_shard_scan_or_proof'],
                ledger_states: ['pending', 'scanned', 'proved_no_match', 'excluded_by_filter', 'excluded_by_declared_scope', 'failed']
            },
            total_shards: 1,
            total_documents: documents.length
        },
        verification_contract: {
            shard_filter_supported: true,
            proved_skip_supported: true,
            scan_fallback_supported: true,
            filter_artifact_family: 'shard_filters',
            proof_catalog_artifact_family: 'proof_catalogs',
            completion_requires_ledger: true
        },
        routing_contract: {
            planner: 'cost_authority_proof_ledger_planner_v2',
            directory_contains_doc_postings: false,
            startup_loads_local_indexes: false,
            startup_loads_full_shards: false,
            startup_loads_global_document_metadata: false
        },
        artifacts: {
            source_registry: artifact(`${prefix}/source-registry.json`, 'source_registry', 'bootstrap', 1),
            global_query_directory: artifact(`${prefix}/global-query-directory.json`, 'global_query_directory', 'bootstrap', 1),
            query_aliases: artifact(`${prefix}/query-aliases.json`, 'query_aliases', 'bootstrap', 1),
            hot_query_fast_start: artifact(`${prefix}/hot-query-fast-start.json`, 'hot_query_fast_start', 'fast_start', 1),
            outcomes: artifact(`${prefix}/outcomes.json`, 'outcomes', 'audit'),
            quality_report: artifact(`${prefix}/quality-report.json`, 'quality_report', 'audit'),
            query_eval_report: artifact(`${prefix}/query-eval-report.json`, 'query_eval_report', 'audit'),
            size_report: artifact(`${prefix}/size-report.json`, 'size_report', 'audit')
        },
        sitegraph: {
            truth_counts: { detail_pages: documents.length, attachments: 1, external_links: 0, edges: 0 },
            quality: { errors: 0 },
            upstream_generated_at: '2026-05-30T00:00:00Z',
            detail_page_records: documents.length,
            attachment_metadata_records: 1,
            direct_attachment_records: 0,
            external_link_records: 0,
            external_document_records: 0,
            utility_link_records: 0,
            attachment_policy: 'metadata_only',
            attachment_evidence_policy: 'metadata_and_filename_only_no_extracted_attachment_content',
            attachment_evidence_coverage: {
                total: 1,
                metadata_only: 1,
                filename_only: 1,
                text_extracted: 0,
                snippet: 0,
                full_content: 0
            },
            external_link_policy: 'record_only',
            source_manifests: {
                jwc: artifact(`${prefix}/source-manifest.json`, 'source_manifest', 'query_planned', documents.length)
            },
            source_manifest_summaries: {
                jwc: { doc_count: documents.length, shard_count: 1, local_index_count: 1 }
            },
            shard_strategy: {
                version: 'source-facet-record-year-section-hash-routed',
                dimensions: ['source_id', 'facet', 'record_type', 'year', 'top_nav_section', 'hash_bucket'],
                hash_bucket_count: 4,
                sequential_fixed_size_shards: false
            },
            indexes: {}
        }
    };
    manifest.sitegraph.indexes = manifest.artifacts;

    const sourceRegistry: SitegraphSourceRegistry = {
        version: 'sitegraph-source-registry-v1',
        collection_id: 'njupt-public',
        sources: [{
            source_id: 'jwc',
            display_name: '本科生院 / 教务处',
            owner_unit: '本科生院 / 教务处',
            domain: 'jwc.njupt.edu.cn',
            source_kind: 'sitegraph',
            authority_domains: ['academic', 'forms'],
            priority_by_intent: { academic_policy: 'high', form_download: 'high', academic_calendar: 'high' },
            freshness_policy: 'current_term_or_latest_notice',
            artifact_manifest: required(manifest.sitegraph.source_manifests.jwc, 'expected jwc source manifest artifact'),
            doc_count: documents.length,
            attachment_count: 1,
            attachment_evidence_coverage: {
                total: 1,
                metadata_only: 1,
                filename_only: 1,
                text_extracted: 0,
                snippet: 0,
                full_content: 0
            },
            updated_at: '2026-05-30T00:00:00Z',
            quality_status: 'ok',
            coverage_status: 'audited',
            facet_counts: { [scope.facet]: documents.length },
            record_counts: { detail: documents.length },
            truth_counts: { detail_pages: documents.length, attachments: 1, external_links: 0, edges: 0 }
        }],
        filter_options: {
            sources: [{ id: 'jwc', label: '本科生院 / 教务处', count: documents.length }],
            facets: [{ id: scope.facet, label: scope.facet, count: documents.length }]
        }
    };
    const defaultRoute = route(options.queryTerms?.[0] || documents[0]?.title || '转专业', [localIndexId], [scope.facet]);
    const entries = options.routeEntries || Object.fromEntries((options.queryTerms || ['转专业']).map(term => [term, route(term, [localIndexId], [scope.facet])]));
    const globalQueryDirectory: SitegraphGlobalQueryDirectory = {
        version: 'sitegraph-global-query-directory-v1',
        tokenizer: 'sitegraph-tokenizer-v1',
        entry_count: Object.keys(entries).length,
        entries,
        intents: options.intentRoutes || { academic_policy: defaultRoute, form_download: defaultRoute, academic_calendar: defaultRoute },
        fallback: {
            mode: 'load_authority_source_manifests_then_verify_in_scope_shards',
            false_negative_policy: 'verify with shard scan or safe filter proof'
        }
    };
    const sourceManifest: SitegraphSourceManifest = {
        version: 'sitegraph-source-manifest-v1',
        source_id: 'jwc',
        display_name: '本科生院 / 教务处',
        domain: 'jwc.njupt.edu.cn',
        doc_count: documents.length,
            attachment_count: 1,
            attachment_evidence_coverage: {
                total: 1,
                metadata_only: 1,
                filename_only: 1,
                text_extracted: 0,
                snippet: 0,
                full_content: 0
            },
            facet_counts: { [scope.facet]: documents.length },
        record_counts: { detail: documents.length },
        year_counts: { '2026': documents.length },
        local_indexes: [localRef],
        full_shards: [shard],
        artifacts: {
            proof_catalog: artifact(`${prefix}/proof-catalog.json`, 'proof_catalog', 'verify', 1),
            shard_filter: artifact(`${prefix}/shard-filter.json`, 'shard_filter', 'verify', 1),
            attachment_meta_index: artifact(`${prefix}/attachment-meta.json`, 'attachment_meta_index', 'on_demand', 1),
            attachment_filename_index: artifact(`${prefix}/attachment-filename.json`, 'attachment_filename_index', 'on_demand', 1),
            attachment_text_shards: artifact(`${prefix}/attachment-text-manifest.json`, 'attachment_text_shards', 'future', 0),
            section_index: artifact(`${prefix}/section-index.json`, 'section_index', 'on_demand', 1),
            external_index: artifact(`${prefix}/external-index.json`, 'external_index', 'on_demand', 0)
        }
    };
    const proofCatalog: SitegraphProofCatalog = {
        version: 'sitegraph-proof-ledger-catalog-v2',
        source_id: 'jwc',
        state_model: ['pending', 'scanned', 'proved_no_match', 'excluded_by_filter', 'excluded_by_declared_scope', 'failed'],
        complete_requires_no_states: ['pending', 'failed'],
        covered_fields: ['title', 'section', 'nav_path', 'summary', 'content', 'attachments', 'url'],
        shards: [{
            shard_id: shard.shard_id,
            source_id: 'jwc',
            path: shard.path,
            sha256: shard.sha256,
            bytes: shard.bytes,
            document_count: shard.count,
            scope: {
                facets: shard.facet_range,
                record_types: shard.record_type_range,
                sections: shard.section_range,
                years: shard.year_range,
                hash_bucket: shard.hash_bucket
            },
            filter_contract: {
                artifact_family: 'shard_filters',
                hash_algorithm: 'bloom-fnv1a32-utf8',
                false_negative: false,
                filter_sha256: shard.filter_sha256,
                filter_token_count: shard.filter_token_count
            }
        }]
    };
    const localLightIndex: SitegraphLocalLightIndex = {
        version: 'sitegraph-local-light-impact-v2',
        tokenizer: 'test',
        field_codes: { title: 't', attachment: 'a', section: 's' },
        field_impacts: { t: 120, a: 95, s: 60 },
        block_size: 32,
        scoring_model: 'impact-ordered-block-max-bm25f-lite-v2',
        scope,
        documents: documents.map(document => docMetaFrom({ ...document, shard: { shard_id: shard.shard_id, path: shard.path } })),
        terms: options.lightTerms || impactTerms({ 转专业: { t: [0] }, 申请表: { a: [0] } })
    };
    const localBodyIndex: SitegraphLocalBodyIndex = {
        version: 'sitegraph-local-body-impact-v2',
        tokenizer: 'test',
        field_codes: { summary: 'm', content: 'c' },
        field_impacts: { m: 16, c: 10 },
        block_size: 32,
        scoring_model: 'impact-ordered-block-max-bm25f-lite-v2',
        scope,
        terms: options.bodyTerms || impactTerms({ 转专业: { c: [0] }, 申请表: { c: [0] } })
    };
    const shardFilter = {
        [shard.shard_id]: {
            bitset_base64: options.filterBase64 || '/w==',
            bit_count: options.filterBitCount || 8,
            hash_count: options.filterHashCount || 1,
            token_count: 4,
            sha256: '0123456789abcdef0123456789abcdef',
            hash_algorithm: 'bloom-fnv1a32-utf8'
        }
    };

    return {
        session: {
            manifest,
            sourceRegistry,
            globalQueryDirectory,
            queryAliases: options.queryAliases || {}
        },
        sourceManifest,
        proofCatalog,
        localLightIndex,
        localBodyIndex,
        shardFilter,
        documents: documents.map(document => ({ ...document, shard: { shard_id: shard.shard_id, path: shard.path } }))
    };
};

export const withMockFetch = async (
    fixture: RoutedFixture,
    callback: () => Promise<void>,
    options: { failPaths?: string[]; extraResponses?: Record<string, unknown>; requestedPaths?: string[] } = {}
): Promise<void> => {
    const originalFetch = globalThis.fetch;
    const manifestArtifact = required(fixture.session.sourceRegistry.sources[0], 'expected source registry entry').artifact_manifest;
    const localRef = required(fixture.sourceManifest.local_indexes[0], 'expected local index ref');
    const sourceManifest = fixture.sourceManifest;
    const shard = required(sourceManifest.full_shards[0], 'expected full shard');
    const shardFilterArtifact = required(sourceManifest.artifacts.shard_filter, 'expected shard filter artifact');
    const proofCatalogArtifact = required(sourceManifest.artifacts.proof_catalog, 'expected proof catalog artifact');
    const responses = new Map<string, unknown>([
        [manifestArtifact.path, sourceManifest],
        [proofCatalogArtifact.path, fixture.proofCatalog],
        [required(localRef.light_index_meta, 'expected light index metadata artifact').path, Object.fromEntries(Object.entries(fixture.localLightIndex).filter(([key]) => key !== 'terms'))],
        [required(localRef.light_index_packed, 'expected packed light index artifact').path, packedImpactIndexFixture(Object.fromEntries(Object.entries(fixture.localLightIndex).filter(([key]) => key !== 'documents')) as SitegraphImpactIndex)],
        [required(localRef.body_index_packed, 'expected packed body index artifact').path, packedImpactIndexFixtureV2(fixture.localBodyIndex)],
        [shardFilterArtifact.path, fixture.shardFilter],
        [shard.path, fixture.documents]
    ]);
    for (const [path, payload] of Object.entries(options.extraResponses || {})) {
        responses.set(path, payload);
    }
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) {
            throw new DOMException('Search cancelled', 'AbortError');
        }
        const url = String(input).replace(/^\//, '');
        options.requestedPaths?.push(url);
        if ((options.failPaths || []).some(path => url.endsWith(path))) {
            return new Response('fixture failure', { status: 503 });
        }
        const match = Array.from(responses.entries()).find(([path]) => url.endsWith(path));
        if (!match) return new Response(JSON.stringify({}), { status: 404 });
        return match[1] instanceof ArrayBuffer
            ? new Response(match[1])
            : new Response(JSON.stringify(match[1]));
    }) as typeof fetch;
    try {
        await callback();
    } finally {
        globalThis.fetch = originalFetch;
    }
};

export const createPersistentFixtureCache = (): ArtifactContentCache => {
    const store = new Map<string, ArrayBuffer>();
    const clone = (buffer: ArrayBuffer): ArrayBuffer => buffer.slice(0);
    return {
        scope: 'browser_persistent_content_hash',
        async has(url: string): Promise<boolean> {
            return store.has(url);
        },
        async read(url: string): Promise<ArrayBuffer | null> {
            const payload = store.get(url);
            return payload ? clone(payload) : null;
        },
        async write(url: string, payload: ArrayBuffer): Promise<void> {
            store.set(url, clone(payload));
        },
    };
};
