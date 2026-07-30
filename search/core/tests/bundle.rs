use njupt_search_core::model::CorpusDocument;
use njupt_search_core::{build_search_bundle, QueryRequest, SearchEngine};
use std::collections::BTreeMap;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

fn document(id: &str, title: &str, content: &str) -> CorpusDocument {
    CorpusDocument {
        id: id.to_string(),
        source: "fixture".to_string(),
        url: format!("https://example.test/{id}"),
        title: title.to_string(),
        content: content.to_string(),
        published_at: Some("2026-01-01".to_string()),
        updated_at: None,
        section: Some("通知".to_string()),
        kind: "detail".to_string(),
        tags: Vec::new(),
        attachments: Vec::new(),
    }
}

#[test]
fn bundle_round_trip_uses_the_single_search_semantics() {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("njupt-search-core-{suffix}"));
    let source_names = BTreeMap::from([("fixture".to_string(), "Fixture Site".to_string())]);
    let report = build_search_bundle(
        vec![
            document("exam", "期末考试安排", "本学期期末考试考场安排"),
            document("award", "国家奖学金公示", "奖学金评选结果"),
        ],
        &source_names,
        "fixture-snapshot",
        &root,
    )
    .expect("build bundle");

    assert!(report
        .manifest
        .postings
        .iter()
        .all(|artifact| artifact.path.starts_with("postings-")));
    assert!(report
        .manifest
        .content
        .iter()
        .all(|artifact| artifact.path.starts_with("content-")));
    assert!(report
        .manifest
        .postings
        .iter()
        .all(|artifact| artifact.decoded_bytes <= 512 * 1024));
    assert!(report
        .manifest
        .content
        .iter()
        .all(|artifact| artifact.decoded_bytes <= 512 * 1024));

    let documents = fs::read(root.join("documents.bin")).expect("documents");
    let lexicon = fs::read(root.join("lexicon.bin")).expect("lexicon");
    let mut engine = SearchEngine::new(
        &documents,
        report.manifest.artifacts["documents"].decoded_bytes,
        &lexicon,
        report.manifest.artifacts["lexicon"].decoded_bytes,
    )
    .expect("engine");
    for (index, artifact) in report.manifest.postings.iter().enumerate() {
        engine
            .load_postings_chunk(
                index as u32,
                &fs::read(root.join(&artifact.path)).expect("postings"),
                artifact.decoded_bytes,
            )
            .expect("decode postings");
    }
    for (index, artifact) in report.manifest.content.iter().enumerate() {
        engine
            .load_content_chunk(
                index as u32,
                &fs::read(root.join(&artifact.path)).expect("content"),
                artifact.decoded_bytes,
            )
            .expect("decode content");
    }
    let response = engine
        .search(&QueryRequest {
            query: "期末考试".to_string(),
            limit: 10,
            sort: Default::default(),
            filters: Default::default(),
        })
        .expect("search");

    assert_eq!(response.results[0].id, "exam");
    assert!(response.results[0].snippet.contains("期末考试"));
    fs::remove_dir_all(root).expect("remove test bundle");
}

#[test]
fn bundle_build_rejects_an_unknown_corpus_source() {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("njupt-search-unknown-source-{suffix}"));
    let error = build_search_bundle(
        vec![document("exam", "期末考试安排", "本学期期末考试考场安排")],
        &BTreeMap::new(),
        "fixture-snapshot",
        &root,
    )
    .expect_err("unknown source must fail");

    assert_eq!(error, "unknown corpus source: fixture");
    assert!(!root.exists());
}

#[test]
fn corpus_document_rejects_unknown_fields() {
    let value = serde_json::json!({
        "id": "exam",
        "source": "fixture",
        "source_name": "old duplicated field",
        "url": "https://example.test/exam",
        "title": "期末考试安排",
        "content": "本学期期末考试考场安排",
        "published_at": null,
        "updated_at": null,
        "section": null,
        "kind": "page",
        "tags": [],
        "attachments": [],
    });

    assert!(serde_json::from_value::<CorpusDocument>(value).is_err());
}
