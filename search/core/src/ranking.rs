use crate::analysis::{normalize_text, token_weight};
use crate::model::{DocumentMeta, Posting};

pub fn posting_score(
    token: &str,
    posting: Posting,
    document_frequency: usize,
    total: usize,
) -> f32 {
    let idf = (((total + 1) as f32 / (document_frequency + 1) as f32).ln() + 1.0).max(0.1);
    let hits = posting.title_hits as f32 * 6.0 + (posting.body_hits.min(12) as f32);
    token_weight(token) * idf * hits
}

pub fn document_boost(document: &DocumentMeta, query: &str) -> f32 {
    let title = normalize_text(&document.title);
    let query = normalize_text(query);
    if query.is_empty() {
        return 0.0;
    }
    if title == query {
        120.0
    } else if title.starts_with(&query) {
        70.0
    } else if title.contains(&query) {
        45.0
    } else {
        0.0
    }
}
