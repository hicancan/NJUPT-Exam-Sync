use super::codec::{encode_content, encode_documents, encode_lexicon, encode_postings};
use super::compression::compress_artifact;
use super::model::{
    calculate_bundle_id, ArtifactRef, CompiledArtifact, CompiledBundle, SearchBundleManifest,
    SEARCH_BUNDLE_FORMAT,
};
use crate::analysis::analyze_document;
use crate::document::{DocumentKind, DocumentMeta, IndexDocument, Posting};
use crate::query::SearchFacet;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};

const POSTINGS_TARGET_CHUNK_BYTES: usize = 512 * 1024;
const CONTENT_TARGET_CHUNK_BYTES: usize = 128 * 1024;
const CHUNK_HEADER_BYTES: usize = 12;

fn facet_for(document: &IndexDocument) -> SearchFacet {
    if document.kind == DocumentKind::Attachment {
        return SearchFacet::Download;
    }
    if document.kind == DocumentKind::External {
        return SearchFacet::External;
    }
    let text = format!(
        "{} {} {}",
        document.title,
        document.section.as_deref().unwrap_or(""),
        document.tags.join(" ")
    )
    .to_lowercase();
    if ["考试", "补考", "重修", "考场", "准考证", "考务", "mooc"]
        .iter()
        .any(|term| text.contains(term))
    {
        SearchFacet::Exam
    } else if ["规定", "制度", "办法", "条例", "政策"]
        .iter()
        .any(|term| text.contains(term))
    {
        SearchFacet::Policy
    } else if ["流程", "办理", "申请", "指南"]
        .iter()
        .any(|term| text.contains(term))
    {
        SearchFacet::Workflow
    } else if ["新闻", "快讯", "动态"]
        .iter()
        .any(|term| text.contains(term))
    {
        SearchFacet::News
    } else {
        SearchFacet::NoticeArticle
    }
}

fn compiled_artifact(path: String, decoded: Vec<u8>) -> CompiledArtifact {
    let decoded_bytes = decoded.len() as u64;
    let bytes = compress_artifact(&decoded);
    let reference = ArtifactRef {
        path,
        bytes: bytes.len() as u64,
        decoded_bytes,
        sha256: hex::encode(Sha256::digest(&bytes)),
    };
    CompiledArtifact { reference, bytes }
}

fn term_counts(text: &str, max_n: usize) -> HashMap<String, u16> {
    let mut counts = HashMap::new();
    for token in analyze_document(text, max_n) {
        let count = counts.entry(token).or_insert(0_u16);
        *count = count.saturating_add(1);
    }
    counts
}

fn var_u32_bytes(mut value: u32) -> usize {
    let mut bytes = 1;
    while value >= 0x80 {
        value >>= 7;
        bytes += 1;
    }
    bytes
}

fn posting_entry_bytes(term: &str, postings: &[Posting]) -> usize {
    let mut bytes = 4 + term.len() + 4;
    let mut previous_document = 0_u32;
    for posting in postings {
        bytes += var_u32_bytes(posting.document - previous_document) + 2;
        previous_document = posting.document;
    }
    bytes
}

fn build_contents(documents: &[IndexDocument]) -> (Vec<Vec<(u32, String)>>, Vec<u32>) {
    let mut chunks: Vec<Vec<(u32, String)>> = Vec::new();
    let mut current = Vec::new();
    let mut current_bytes = CHUNK_HEADER_BYTES;
    let mut assignments = vec![0_u32; documents.len()];
    for (index, document) in documents.iter().enumerate() {
        let encoded_bytes = document.content.len() + 8;
        if !current.is_empty() && current_bytes + encoded_bytes > CONTENT_TARGET_CHUNK_BYTES {
            chunks.push(std::mem::take(&mut current));
            current_bytes = CHUNK_HEADER_BYTES;
        }
        assignments[index] = chunks.len() as u32;
        current.push((index as u32, document.content.clone()));
        current_bytes += encoded_bytes;
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    (chunks, assignments)
}

pub fn compile_search_bundle(
    documents: Vec<IndexDocument>,
    corpus_snapshot_id: &str,
) -> Result<CompiledBundle, String> {
    if documents.is_empty() {
        return Err("cannot build SearchBundle from an empty corpus".to_string());
    }
    if corpus_snapshot_id.len() != 64
        || !corpus_snapshot_id
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("invalid corpus snapshot identity".to_string());
    }

    let (content_chunks, content_assignments) = build_contents(&documents);
    let metas: Vec<DocumentMeta> = documents
        .iter()
        .enumerate()
        .map(|(index, document)| DocumentMeta {
            id: document.id.clone(),
            source: document.source.clone(),
            source_name: document.source_name.clone(),
            url: document.url.clone(),
            title: document.title.clone(),
            published_at: document.published_at.clone(),
            updated_at: document.updated_at.clone(),
            section: document.section.clone(),
            kind: document.kind,
            facet: facet_for(document),
            attachments: document.attachments.clone(),
            content_chunk: content_assignments[index],
        })
        .collect();

    let mut postings_by_term: BTreeMap<String, Vec<Posting>> = BTreeMap::new();
    for (document_index, document) in documents.iter().enumerate() {
        let title_terms = term_counts(&document.title, 4);
        let searchable_body = format!(
            "{} {} {} {}",
            document.content,
            document.section.as_deref().unwrap_or(""),
            document.source_name,
            document.tags.join(" ")
        );
        let body_terms = term_counts(&searchable_body, 2);
        let mut all_terms: BTreeMap<String, (u16, u16)> = BTreeMap::new();
        for (term, count) in title_terms {
            all_terms.entry(term).or_default().0 = count;
        }
        for (term, count) in body_terms {
            all_terms.entry(term).or_default().1 = count;
        }
        for (term, (title_hits, body_hits)) in all_terms {
            postings_by_term.entry(term).or_default().push(Posting {
                document: document_index as u32,
                title_hits,
                body_hits,
            });
        }
    }

    let mut postings_chunks: Vec<Vec<(String, Vec<Posting>)>> = Vec::new();
    let mut current = Vec::new();
    let mut current_bytes = CHUNK_HEADER_BYTES;
    for (term, postings) in postings_by_term {
        let encoded_bytes = posting_entry_bytes(&term, &postings);
        if !current.is_empty() && current_bytes + encoded_bytes > POSTINGS_TARGET_CHUNK_BYTES {
            postings_chunks.push(std::mem::take(&mut current));
            current_bytes = CHUNK_HEADER_BYTES;
        }
        current.push((term, postings));
        current_bytes += encoded_bytes;
    }
    if !current.is_empty() {
        postings_chunks.push(current);
    }

    let documents_artifact =
        compiled_artifact("documents.bin".to_string(), encode_documents(&metas));
    let mut artifacts = vec![documents_artifact];
    let mut lexicon_entries = Vec::new();
    let mut posting_refs = Vec::new();
    for (chunk_index, entries) in postings_chunks.iter().enumerate() {
        for (term, _) in entries {
            lexicon_entries.push((term.clone(), chunk_index as u32));
        }
        let artifact = compiled_artifact(
            format!("postings-{chunk_index:04}.bin"),
            encode_postings(entries),
        );
        posting_refs.push(artifact.reference.clone());
        artifacts.push(artifact);
    }
    let lexicon_terms = lexicon_entries.len();
    let lexicon_artifact =
        compiled_artifact("lexicon.bin".to_string(), encode_lexicon(&lexicon_entries));
    let lexicon_ref = lexicon_artifact.reference.clone();
    artifacts.insert(1, lexicon_artifact);

    let mut content_refs = Vec::new();
    for (chunk_index, entries) in content_chunks.iter().enumerate() {
        let artifact = compiled_artifact(
            format!("content-{chunk_index:04}.bin"),
            encode_content(entries),
        );
        content_refs.push(artifact.reference.clone());
        artifacts.push(artifact);
    }

    let mut manifest = SearchBundleManifest {
        format: SEARCH_BUNDLE_FORMAT.to_string(),
        bundle_id: String::new(),
        corpus_snapshot_id: corpus_snapshot_id.to_string(),
        documents: artifacts[0].reference.clone(),
        lexicon: lexicon_ref,
        postings: posting_refs,
        content: content_refs,
    };
    manifest.bundle_id = calculate_bundle_id(&manifest);
    Ok(CompiledBundle {
        manifest,
        artifacts,
        document_count: metas.len() as u32,
        lexicon_terms,
    })
}

#[cfg(test)]
mod tests {
    use super::term_counts;

    #[test]
    fn document_analysis_preserves_term_frequency() {
        let counts = term_counts("奖学金 奖学金 奖学金", 4);
        assert_eq!(counts.get("奖学金"), Some(&3));
    }
}
