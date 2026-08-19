use njupt_search_core::{
    compile_search_bundle, Attachment, CompiledBundle, DocumentKind, IndexDocument, Query,
    SearchEngine,
};

fn documents() -> Vec<IndexDocument> {
    vec![
        IndexDocument {
            id: "doc-a".to_string(),
            source: "jwc".to_string(),
            source_name: "教务处".to_string(),
            url: "https://example.test/a".to_string(),
            title: "转专业办理通知".to_string(),
            content: "转专业 转专业 申请材料与办理流程".to_string(),
            published_at: Some("2026-07-01".to_string()),
            updated_at: None,
            section: Some("通知公告".to_string()),
            kind: DocumentKind::Page,
            tags: vec!["本科生".to_string()],
            attachments: vec![Attachment {
                id: "attachment-a".to_string(),
                url: "https://example.test/a.pdf".to_string(),
                name: "申请表.pdf".to_string(),
                extension: Some("pdf".to_string()),
            }],
        },
        IndexDocument {
            id: "doc-b".to_string(),
            source: "www".to_string(),
            source_name: "南邮主页".to_string(),
            url: "https://example.test/b".to_string(),
            title: "校园新闻".to_string(),
            content: "学校新闻动态".to_string(),
            published_at: Some("2025-01-01".to_string()),
            updated_at: None,
            section: Some("新闻".to_string()),
            kind: DocumentKind::Page,
            tags: vec![],
            attachments: vec![],
        },
        IndexDocument {
            id: "doc-c".to_string(),
            source: "jwc".to_string(),
            source_name: "教务处".to_string(),
            url: "https://example.test/c".to_string(),
            title: "专业建设实施方案".to_string(),
            content: "专业 专业 专业 专业 专业 专业 专业 专业".to_string(),
            published_at: Some("2026-07-02".to_string()),
            updated_at: None,
            section: Some("政策".to_string()),
            kind: DocumentKind::Page,
            tags: vec![],
            attachments: vec![],
        },
    ]
}

fn artifact<'a>(bundle: &'a CompiledBundle, path: &str) -> &'a [u8] {
    &bundle
        .artifacts
        .iter()
        .find(|artifact| artifact.reference.path == path)
        .expect("artifact")
        .bytes
}

fn engine(bundle: &CompiledBundle) -> SearchEngine {
    let mut engine = SearchEngine::new(
        artifact(bundle, "documents.bin"),
        bundle.manifest.documents.decoded_bytes,
        artifact(bundle, "lexicon.bin"),
        bundle.manifest.lexicon.decoded_bytes,
    )
    .expect("metadata");
    for (index, reference) in bundle.manifest.postings.iter().enumerate() {
        engine
            .load_postings_chunk(
                index as u32,
                artifact(bundle, &reference.path),
                reference.decoded_bytes,
            )
            .expect("postings");
    }
    for (index, reference) in bundle.manifest.content.iter().enumerate() {
        engine
            .load_content_chunk(
                index as u32,
                artifact(bundle, &reference.path),
                reference.decoded_bytes,
            )
            .expect("content");
    }
    engine
}

#[test]
fn compiles_and_queries_the_current_bundle_contract() {
    let bundle = compile_search_bundle(documents(), &"a".repeat(64)).expect("compile");
    let engine = engine(&bundle);
    let response = engine
        .search(&Query {
            query: "转专业".to_string(),
            limit: 10,
            sort: Default::default(),
            filters: Default::default(),
        })
        .expect("search");
    assert_eq!(response.total_candidates, 2);
    assert_eq!(response.results[0].id, "doc-a");
    assert_eq!(response.results[0].attachments[0].name, "申请表.pdf");
}

#[test]
fn one_query_plan_keeps_exact_order_while_snippets_are_hydrated() {
    let bundle = compile_search_bundle(documents(), &"a".repeat(64)).expect("compile");
    let mut engine = engine(&bundle);
    let request = Query {
        query: "转专业".to_string(),
        limit: 10,
        sort: Default::default(),
        filters: Default::default(),
    };
    let preparation = engine.begin_query(&request).expect("analysis");
    let plan = engine.plan_query(&preparation).expect("ranking");
    let shells = engine.result_shells(&plan, 0, 10).expect("shells");
    assert!(shells.results.iter().all(|result| result.snippet.is_none()));

    engine.clear_content();
    let chunks = engine.required_content_chunks(&plan, 0, 10);
    for chunk in chunks {
        let reference = &bundle.manifest.content[chunk as usize];
        engine
            .load_content_chunk(
                chunk,
                artifact(&bundle, &reference.path),
                reference.decoded_bytes,
            )
            .expect("content");
    }
    let hydrated = engine.hydrate_results(&plan, 0, 10).expect("hydrated");
    assert_eq!(
        shells
            .results
            .iter()
            .map(|result| &result.id)
            .collect::<Vec<_>>(),
        hydrated
            .results
            .iter()
            .map(|result| &result.id)
            .collect::<Vec<_>>()
    );
    assert!(hydrated
        .results
        .iter()
        .all(|result| result.snippet.is_some()));
}

#[test]
fn output_identity_is_independent_of_corpus_provenance() {
    let left = compile_search_bundle(documents(), &"a".repeat(64)).expect("left");
    let right = compile_search_bundle(documents(), &"b".repeat(64)).expect("right");
    assert_ne!(
        left.manifest.corpus_snapshot_id,
        right.manifest.corpus_snapshot_id
    );
    assert_eq!(left.manifest.bundle_id, right.manifest.bundle_id);
    assert_eq!(
        left.artifacts
            .iter()
            .map(|artifact| (&artifact.reference.path, &artifact.bytes))
            .collect::<Vec<_>>(),
        right
            .artifacts
            .iter()
            .map(|artifact| (&artifact.reference.path, &artifact.bytes))
            .collect::<Vec<_>>()
    );
}

#[test]
fn rejects_ui_sentinels_and_invalid_dates() {
    let bundle = compile_search_bundle(documents(), &"a".repeat(64)).expect("compile");
    let engine = engine(&bundle);
    let mut query = Query {
        query: "转专业".to_string(),
        limit: 10,
        sort: Default::default(),
        filters: Default::default(),
    };
    query.filters.source_id = Some("all".to_string());
    assert!(engine.search(&query).unwrap_err().contains("real source"));
    query.filters.source_id = None;
    query.filters.published_from = Some("2026-02-30".to_string());
    assert!(engine.search(&query).unwrap_err().contains("invalid date"));
}

#[test]
fn result_page_does_not_repeat_same_day_department_reposts() {
    let mut values = documents();
    values.push(IndexDocument {
        id: "contest-jwc".to_string(),
        source: "jwc".to_string(),
        source_name: "教务处".to_string(),
        url: "https://jwc.example.test/contest".to_string(),
        title: "【实践科】2026年全国大学生数学建模竞赛报名通知".to_string(),
        content: "数学建模竞赛报名".to_string(),
        published_at: Some("2026-05-25".to_string()),
        updated_at: None,
        section: Some("通知公告".to_string()),
        kind: DocumentKind::Page,
        tags: vec![],
        attachments: vec![],
    });
    values.push(IndexDocument {
        id: "contest-cxcy".to_string(),
        source: "cxcy".to_string(),
        source_name: "创新创业教育学院".to_string(),
        url: "https://cxcy.example.test/contest".to_string(),
        title: "2026年全国大学生数学建模竞赛报名通知".to_string(),
        content: "数学建模竞赛报名".to_string(),
        published_at: Some("2026-05-25".to_string()),
        updated_at: None,
        section: Some("通知公告".to_string()),
        kind: DocumentKind::Page,
        tags: vec![],
        attachments: vec![],
    });
    let bundle = compile_search_bundle(values, &"a".repeat(64)).expect("compile");
    let response = engine(&bundle)
        .search(&Query {
            query: "数学建模竞赛报名".to_string(),
            limit: 10,
            sort: Default::default(),
            filters: Default::default(),
        })
        .expect("search");
    assert_eq!(
        response
            .results
            .iter()
            .filter(|result| result
                .title
                .contains("2026年全国大学生数学建模竞赛报名通知"))
            .count(),
        1
    );
}
