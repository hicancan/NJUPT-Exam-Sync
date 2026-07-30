use super::model::{
    FilterOption, FilterOptions, Query, SearchAttachment, SearchResponse, SearchResult, SortMode,
};
use super::ranking::{document_boost, posting_score};
use super::snippet::build_snippet;
use crate::analysis::{analyze_query, normalize_text};
use crate::bundle::{
    decode_content, decode_documents, decode_lexicon, decode_postings, decompress_artifact,
};
use crate::document::{DocumentMeta, Posting};
use std::collections::{BTreeMap, BTreeSet, HashMap};

pub struct SearchEngine {
    documents: Vec<DocumentMeta>,
    lexicon: HashMap<String, u32>,
    postings: HashMap<String, Vec<Posting>>,
    loaded_posting_chunks: BTreeSet<u32>,
    content: HashMap<u32, String>,
    loaded_content_chunks: BTreeSet<u32>,
}

struct RankedCandidate {
    document: u32,
    score: f32,
    title_phrase_match: bool,
    matched_terms: Vec<String>,
}

impl SearchEngine {
    pub fn new(
        documents: &[u8],
        document_bytes: u64,
        lexicon: &[u8],
        lexicon_bytes: u64,
    ) -> Result<Self, String> {
        Ok(Self {
            documents: decode_documents(&decompress_artifact(documents, document_bytes)?)?,
            lexicon: decode_lexicon(&decompress_artifact(lexicon, lexicon_bytes)?)?
                .into_iter()
                .collect(),
            postings: HashMap::new(),
            loaded_posting_chunks: BTreeSet::new(),
            content: HashMap::new(),
            loaded_content_chunks: BTreeSet::new(),
        })
    }

    pub fn document_count(&self) -> usize {
        self.documents.len()
    }

    pub fn load_postings_chunk(
        &mut self,
        chunk: u32,
        bytes: &[u8],
        decoded_bytes: u64,
    ) -> Result<(), String> {
        for (term, postings) in decode_postings(&decompress_artifact(bytes, decoded_bytes)?)? {
            if self.postings.insert(term.clone(), postings).is_some() {
                return Err(format!("duplicate term across postings chunks: {term}"));
            }
        }
        self.loaded_posting_chunks.insert(chunk);
        Ok(())
    }

    pub fn load_content_chunk(
        &mut self,
        chunk: u32,
        bytes: &[u8],
        decoded_bytes: u64,
    ) -> Result<(), String> {
        for (document, content) in decode_content(&decompress_artifact(bytes, decoded_bytes)?)? {
            if self.content.insert(document, content).is_some() {
                return Err(format!(
                    "duplicate document across content chunks: {document}"
                ));
            }
        }
        self.loaded_content_chunks.insert(chunk);
        Ok(())
    }

    pub fn required_posting_chunks(&self, query: &str) -> Vec<u32> {
        analyze_query(query, 4)
            .into_iter()
            .filter_map(|term| self.lexicon.get(&term).copied())
            .filter(|chunk| !self.loaded_posting_chunks.contains(chunk))
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect()
    }

    pub fn required_content_chunks(&self, request: &Query) -> Result<Vec<u32>, String> {
        let candidates = self.rank_candidates(request)?;
        Ok(candidates
            .into_iter()
            .take(request.limit)
            .filter_map(|candidate| self.documents.get(candidate.document as usize))
            .map(|document| document.content_chunk)
            .filter(|chunk| !self.loaded_content_chunks.contains(chunk))
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect())
    }

    pub fn filter_options(&self) -> FilterOptions {
        let mut sources: BTreeMap<(String, String), usize> = BTreeMap::new();
        let mut facets: BTreeMap<_, usize> = BTreeMap::new();
        for document in &self.documents {
            *sources
                .entry((document.source.clone(), document.source_name.clone()))
                .or_default() += 1;
            *facets.entry(document.facet).or_default() += 1;
        }
        FilterOptions {
            sources: sources
                .into_iter()
                .map(|((id, label), count)| FilterOption { id, label, count })
                .collect(),
            facets: facets
                .into_iter()
                .map(|(facet, count)| {
                    let id = serde_json::to_value(facet)
                        .expect("facet serialization")
                        .as_str()
                        .expect("facet string")
                        .to_string();
                    FilterOption {
                        label: id.clone(),
                        id,
                        count,
                    }
                })
                .collect(),
        }
    }

    fn validate_request(request: &Query) -> Result<(), String> {
        if normalize_text(&request.query).chars().count() < 2 {
            return Err("query must contain at least two normalized characters".to_string());
        }
        if !(1..=100).contains(&request.limit) {
            return Err("query limit must be between 1 and 100".to_string());
        }
        if request
            .filters
            .source_id
            .as_deref()
            .is_some_and(|source| source.trim().is_empty() || source == "all")
        {
            return Err("sourceId must be a real source identity".to_string());
        }
        for value in [
            request.filters.published_from.as_deref(),
            request.filters.published_to.as_deref(),
        ]
        .into_iter()
        .flatten()
        {
            if !valid_iso_date(value) {
                return Err(format!("invalid date filter: {value}"));
            }
        }
        if matches!(
            (
                request.filters.published_from.as_deref(),
                request.filters.published_to.as_deref()
            ),
            (Some(from), Some(to)) if from > to
        ) {
            return Err("publishedFrom must not be after publishedTo".to_string());
        }
        Ok(())
    }

    fn matches_filters(document: &DocumentMeta, request: &Query) -> bool {
        let filters = &request.filters;
        if filters
            .source_id
            .as_deref()
            .is_some_and(|source| document.source != source)
        {
            return false;
        }
        if filters.facet.is_some_and(|facet| document.facet != facet) {
            return false;
        }
        let has_date_bounds = filters.published_from.is_some() || filters.published_to.is_some();
        let Some(date) = document.published_at.as_deref() else {
            return !has_date_bounds || filters.include_undated;
        };
        if filters
            .published_from
            .as_deref()
            .is_some_and(|from| date < from)
            || filters.published_to.as_deref().is_some_and(|to| date > to)
        {
            return false;
        }
        true
    }

    fn rank_candidates(&self, request: &Query) -> Result<Vec<RankedCandidate>, String> {
        Self::validate_request(request)?;
        let query_terms = analyze_query(&request.query, 4);
        let missing = self.required_posting_chunks(&request.query);
        if !missing.is_empty() {
            return Err(format!(
                "required postings chunks are not loaded: {missing:?}"
            ));
        }
        let mut scores: HashMap<u32, (f32, bool, BTreeSet<String>)> = HashMap::new();
        let normalized_query = normalize_text(&request.query);
        for term in query_terms {
            let Some(postings) = self.postings.get(&term) else {
                continue;
            };
            for posting in postings {
                let Some(document) = self.documents.get(posting.document as usize) else {
                    return Err(format!(
                        "posting references missing document: {}",
                        posting.document
                    ));
                };
                if !Self::matches_filters(document, request) {
                    continue;
                }
                let entry = scores.entry(posting.document).or_default();
                entry.0 += posting_score(
                    &term,
                    *posting,
                    postings.len(),
                    self.documents.len(),
                    term == normalized_query,
                );
                entry.1 |= term == normalized_query && posting.title_hits > 0;
                entry.2.insert(term.clone());
            }
        }
        let mut ranked: Vec<_> = scores
            .into_iter()
            .map(|(index, (score, title_phrase_match, terms))| {
                let document = &self.documents[index as usize];
                RankedCandidate {
                    document: index,
                    score: score + document_boost(document, &request.query),
                    title_phrase_match,
                    matched_terms: terms.into_iter().collect(),
                }
            })
            .collect();
        match request.sort {
            SortMode::Relevance => ranked.sort_by(|left, right| {
                right
                    .title_phrase_match
                    .cmp(&left.title_phrase_match)
                    .then_with(|| {
                        if left.title_phrase_match && right.title_phrase_match {
                            self.documents[right.document as usize]
                                .published_at
                                .cmp(&self.documents[left.document as usize].published_at)
                        } else {
                            std::cmp::Ordering::Equal
                        }
                    })
                    .then_with(|| right.score.total_cmp(&left.score))
                    .then_with(|| {
                        self.documents[right.document as usize]
                            .published_at
                            .cmp(&self.documents[left.document as usize].published_at)
                    })
                    .then_with(|| {
                        self.documents[left.document as usize]
                            .id
                            .cmp(&self.documents[right.document as usize].id)
                    })
            }),
            SortMode::DateDesc => ranked.sort_by(|left, right| {
                self.documents[right.document as usize]
                    .published_at
                    .cmp(&self.documents[left.document as usize].published_at)
                    .then_with(|| right.score.total_cmp(&left.score))
                    .then_with(|| {
                        self.documents[left.document as usize]
                            .id
                            .cmp(&self.documents[right.document as usize].id)
                    })
            }),
        }
        Ok(ranked)
    }

    pub fn search(&self, request: &Query) -> Result<SearchResponse, String> {
        let ranked = self.rank_candidates(request)?;
        let total_candidates = ranked.len();
        let mut results = Vec::new();
        for candidate in ranked.into_iter().take(request.limit) {
            let document = &self.documents[candidate.document as usize];
            if !self.loaded_content_chunks.contains(&document.content_chunk) {
                return Err(format!(
                    "required content chunk is not loaded: {}",
                    document.content_chunk
                ));
            }
            let content = self
                .content
                .get(&candidate.document)
                .map(String::as_str)
                .unwrap_or("");
            results.push(SearchResult {
                id: document.id.clone(),
                source: document.source.clone(),
                source_name: document.source_name.clone(),
                url: document.url.clone(),
                title: document.title.clone(),
                published_at: document.published_at.clone(),
                updated_at: document.updated_at.clone(),
                section: document.section.clone(),
                kind: document.kind,
                facet: document.facet,
                snippet: build_snippet(
                    content,
                    &document.title,
                    &request.query,
                    &candidate.matched_terms,
                ),
                matched_terms: candidate.matched_terms,
                attachments: document
                    .attachments
                    .iter()
                    .map(|attachment| SearchAttachment {
                        id: attachment.id.clone(),
                        url: attachment.url.clone(),
                        name: attachment.name.clone(),
                        extension: attachment.extension.clone(),
                    })
                    .collect(),
            });
        }
        Ok(SearchResponse {
            total_candidates,
            results,
        })
    }
}

fn valid_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }
    let parse = |range: std::ops::Range<usize>| {
        std::str::from_utf8(&bytes[range]).ok()?.parse::<u32>().ok()
    };
    let Some(year) = parse(0..4) else {
        return false;
    };
    let Some(month) = parse(5..7) else {
        return false;
    };
    let Some(day) = parse(8..10) else {
        return false;
    };
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return false,
    };
    (1..=max_day).contains(&day)
}

#[cfg(test)]
mod tests {
    use super::valid_iso_date;

    #[test]
    fn validates_real_calendar_dates() {
        assert!(valid_iso_date("2026-07-30"));
        assert!(valid_iso_date("2024-02-29"));
        assert!(!valid_iso_date("2026-02-29"));
        assert!(!valid_iso_date("2026-13-01"));
    }
}
