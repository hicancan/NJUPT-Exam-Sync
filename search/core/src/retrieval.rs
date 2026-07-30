use crate::analysis::{normalize_text, tokens};
use crate::index::codec::{decode_content, decode_documents, decode_lexicon, decode_postings};
use crate::index::compression::decompress_artifact;
use crate::model::{
    DocumentMeta, FilterOption, FilterOptions, Posting, QueryRequest, SearchAttachment,
    SearchResponse, SearchResult, SortMode,
};
use crate::ranking::{document_boost, posting_score};
use crate::snippet::build_snippet;
use std::collections::{BTreeMap, BTreeSet, HashMap};
#[cfg(not(target_arch = "wasm32"))]
use std::time::Instant;

pub struct SearchEngine {
    documents: Vec<DocumentMeta>,
    lexicon: HashMap<String, u32>,
    postings: HashMap<String, Vec<Posting>>,
    loaded_posting_chunks: BTreeSet<u32>,
    content: HashMap<u32, String>,
    loaded_content_chunks: BTreeSet<u32>,
    reference_year: i32,
}

impl SearchEngine {
    pub fn new(
        documents: &[u8],
        document_bytes: u64,
        lexicon: &[u8],
        lexicon_bytes: u64,
    ) -> Result<Self, String> {
        let documents = decode_documents(&decompress_artifact(documents, document_bytes)?)?;
        let reference_year = documents
            .iter()
            .filter_map(|document| document.published_at.as_deref())
            .filter_map(|value| value.get(..4))
            .filter_map(|value| value.parse::<i32>().ok())
            .max()
            .unwrap_or(0);
        Ok(Self {
            documents,
            lexicon: decode_lexicon(&decompress_artifact(lexicon, lexicon_bytes)?)?
                .into_iter()
                .collect(),
            postings: HashMap::new(),
            loaded_posting_chunks: BTreeSet::new(),
            content: HashMap::new(),
            loaded_content_chunks: BTreeSet::new(),
            reference_year,
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
            self.postings.insert(term, postings);
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
            self.content.insert(document, content);
        }
        self.loaded_content_chunks.insert(chunk);
        Ok(())
    }

    pub fn required_posting_chunks(&self, query: &str) -> Vec<u32> {
        tokens(query, 4)
            .into_iter()
            .filter_map(|term| self.lexicon.get(&term).copied())
            .filter(|chunk| !self.loaded_posting_chunks.contains(chunk))
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect()
    }

    pub fn required_content_chunks(&self, request: &QueryRequest) -> Result<Vec<u32>, String> {
        let candidates = self.rank_candidates(request)?;
        Ok(candidates
            .into_iter()
            .take(request.limit.clamp(1, 100))
            .filter_map(|(index, _, _)| self.documents.get(index as usize))
            .map(|document| document.content_chunk)
            .filter(|chunk| !self.loaded_content_chunks.contains(chunk))
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect())
    }

    pub fn filter_options(&self) -> FilterOptions {
        let mut sources: BTreeMap<(String, String), usize> = BTreeMap::new();
        let mut facets: BTreeMap<String, usize> = BTreeMap::new();
        for document in &self.documents {
            *sources
                .entry((document.source.clone(), document.source_name.clone()))
                .or_default() += 1;
            *facets.entry(document.facet.clone()).or_default() += 1;
        }
        FilterOptions {
            sources: sources
                .into_iter()
                .map(|((id, label), count)| FilterOption { id, label, count })
                .collect(),
            facets: facets
                .into_iter()
                .map(|(id, count)| FilterOption {
                    label: id.clone(),
                    id,
                    count,
                })
                .collect(),
        }
    }

    fn matches_filters(&self, document: &DocumentMeta, request: &QueryRequest) -> bool {
        let filters = &request.filters;
        if let Some(source) = filters.source_id.as_deref() {
            if source != "all" && document.source != source {
                return false;
            }
        }
        if let Some(facet) = filters.facet.as_deref() {
            if facet != "all" && document.facet != facet {
                return false;
            }
        }
        if let Some(range) = filters.date_range.as_deref() {
            let year = document
                .published_at
                .as_deref()
                .and_then(|value| value.get(..4))
                .and_then(|value| value.parse::<i32>().ok());
            match range {
                "undated" if year.is_some() => return false,
                "past_year" if year.is_none_or(|value| value < self.reference_year - 1) => {
                    return false
                }
                "past_3_years" if year.is_none_or(|value| value < self.reference_year - 3) => {
                    return false
                }
                "past_5_years" if year.is_none_or(|value| value < self.reference_year - 5) => {
                    return false
                }
                _ => {}
            }
        }
        true
    }

    fn rank_candidates(
        &self,
        request: &QueryRequest,
    ) -> Result<Vec<(u32, f32, Vec<String>)>, String> {
        let query_terms = tokens(&request.query, 4);
        if query_terms.is_empty() {
            return Ok(Vec::new());
        }
        let missing = self.required_posting_chunks(&request.query);
        if !missing.is_empty() {
            return Err(format!(
                "required postings chunks are not loaded: {missing:?}"
            ));
        }
        let mut scores: HashMap<u32, (f32, BTreeSet<String>)> = HashMap::new();
        for term in query_terms {
            let Some(postings) = self.postings.get(&term) else {
                continue;
            };
            for posting in postings {
                let Some(document) = self.documents.get(posting.document as usize) else {
                    continue;
                };
                if !self.matches_filters(document, request) {
                    continue;
                }
                let entry = scores.entry(posting.document).or_default();
                entry.0 += posting_score(&term, *posting, postings.len(), self.documents.len());
                entry.1.insert(term.clone());
            }
        }
        let mut ranked: Vec<_> = scores
            .into_iter()
            .map(|(index, (score, terms))| {
                let document = &self.documents[index as usize];
                (
                    index,
                    score + document_boost(document, &request.query),
                    terms.into_iter().collect::<Vec<_>>(),
                )
            })
            .collect();
        match request.sort {
            SortMode::Relevance => ranked.sort_by(|left, right| {
                right
                    .1
                    .total_cmp(&left.1)
                    .then_with(|| {
                        self.documents[right.0 as usize]
                            .published_at
                            .cmp(&self.documents[left.0 as usize].published_at)
                    })
                    .then_with(|| {
                        self.documents[left.0 as usize]
                            .id
                            .cmp(&self.documents[right.0 as usize].id)
                    })
            }),
            SortMode::DateDesc => ranked.sort_by(|left, right| {
                self.documents[right.0 as usize]
                    .published_at
                    .cmp(&self.documents[left.0 as usize].published_at)
                    .then_with(|| right.1.total_cmp(&left.1))
                    .then_with(|| {
                        self.documents[left.0 as usize]
                            .id
                            .cmp(&self.documents[right.0 as usize].id)
                    })
            }),
        }
        Ok(ranked)
    }

    pub fn search(&self, request: &QueryRequest) -> Result<SearchResponse, String> {
        #[cfg(not(target_arch = "wasm32"))]
        let started = Instant::now();
        let normalized_query = normalize_text(&request.query);
        if normalized_query.chars().count() < 2 {
            return Ok(SearchResponse {
                query: normalized_query,
                total_candidates: 0,
                elapsed_micros: {
                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        started.elapsed().as_micros() as u64
                    }
                    #[cfg(target_arch = "wasm32")]
                    {
                        0
                    }
                },
                results: Vec::new(),
            });
        }
        let ranked = self.rank_candidates(request)?;
        let total_candidates = ranked.len();
        let mut results = Vec::new();
        for (index, score, matched_terms) in ranked.into_iter().take(request.limit.clamp(1, 100)) {
            let document = &self.documents[index as usize];
            if !self.loaded_content_chunks.contains(&document.content_chunk) {
                return Err(format!(
                    "required content chunk is not loaded: {}",
                    document.content_chunk
                ));
            }
            let content = self.content.get(&index).map(String::as_str).unwrap_or("");
            results.push(SearchResult {
                id: document.id.clone(),
                source: document.source.clone(),
                source_name: document.source_name.clone(),
                url: document.url.clone(),
                title: document.title.clone(),
                published_at: document.published_at.clone(),
                updated_at: document.updated_at.clone(),
                section: document.section.clone(),
                kind: document.kind.clone(),
                facet: document.facet.clone(),
                score,
                snippet: build_snippet(content, &document.title, &request.query, &matched_terms),
                matched_terms,
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
            query: normalized_query,
            total_candidates,
            elapsed_micros: {
                #[cfg(not(target_arch = "wasm32"))]
                {
                    started.elapsed().as_micros() as u64
                }
                #[cfg(target_arch = "wasm32")]
                {
                    0
                }
            },
            results,
        })
    }
}
