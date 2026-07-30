use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const SEARCH_BUNDLE_FORMAT: &str = "njupt-search-bundle-v2";

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CorpusAttachment {
    pub id: String,
    pub url: String,
    pub name: String,
    pub extension: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CorpusDocument {
    pub id: String,
    pub source: String,
    pub url: String,
    pub title: String,
    pub content: String,
    pub published_at: Option<String>,
    pub updated_at: Option<String>,
    pub section: Option<String>,
    pub kind: String,
    pub tags: Vec<String>,
    pub attachments: Vec<CorpusAttachment>,
}

#[derive(Clone, Debug)]
pub struct DocumentMeta {
    pub id: String,
    pub source: String,
    pub source_name: String,
    pub url: String,
    pub title: String,
    pub published_at: Option<String>,
    pub updated_at: Option<String>,
    pub section: Option<String>,
    pub kind: String,
    pub facet: String,
    pub tags: Vec<String>,
    pub attachments: Vec<CorpusAttachment>,
    pub content_chunk: u32,
}

#[derive(Clone, Copy, Debug)]
pub struct Posting {
    pub document: u32,
    pub title_hits: u16,
    pub body_hits: u16,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArtifactRef {
    pub path: String,
    pub bytes: u64,
    pub decoded_bytes: u64,
    pub sha256: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SearchBundleManifest {
    pub format: String,
    pub corpus_snapshot_id: String,
    pub bundle_id: String,
    pub artifacts: BTreeMap<String, ArtifactRef>,
    pub postings: Vec<ArtifactRef>,
    pub content: Vec<ArtifactRef>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    pub source_id: Option<String>,
    pub facet: Option<String>,
    pub date_range: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SortMode {
    #[default]
    Relevance,
    DateDesc,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRequest {
    pub query: String,
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(default)]
    pub sort: SortMode,
    #[serde(default)]
    pub filters: SearchFilters,
}

fn default_limit() -> usize {
    30
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchAttachment {
    pub id: String,
    pub url: String,
    pub name: String,
    pub extension: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: String,
    pub source: String,
    pub source_name: String,
    pub url: String,
    pub title: String,
    pub published_at: Option<String>,
    pub updated_at: Option<String>,
    pub section: Option<String>,
    pub kind: String,
    pub facet: String,
    pub score: f32,
    pub snippet: String,
    pub matched_terms: Vec<String>,
    pub attachments: Vec<SearchAttachment>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub query: String,
    pub total_candidates: usize,
    pub elapsed_micros: u64,
    pub results: Vec<SearchResult>,
}

#[derive(Clone, Debug, Serialize)]
pub struct FilterOption {
    pub id: String,
    pub label: String,
    pub count: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct FilterOptions {
    pub sources: Vec<FilterOption>,
    pub facets: Vec<FilterOption>,
}
