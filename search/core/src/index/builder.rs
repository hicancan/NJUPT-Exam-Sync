use crate::analysis::tokens;
use crate::index::codec::{encode_content, encode_documents, encode_lexicon, encode_postings};
use crate::index::compression::compress_artifact;
use crate::model::{
    ArtifactRef, CorpusDocument, DocumentMeta, Posting, SearchBundleManifest, SEARCH_BUNDLE_FORMAT,
};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

const TARGET_CHUNK_BYTES: usize = 512 * 1024;
const CHUNK_HEADER_BYTES: usize = 8 + 4;

#[derive(Clone, Debug)]
pub struct BuildReport {
    pub manifest: SearchBundleManifest,
    pub document_count: u32,
    pub lexicon_terms: usize,
    pub total_bytes: u64,
    pub file_count: usize,
}

fn facet_for(document: &CorpusDocument) -> String {
    if document.kind == "attachment" {
        return "download".to_string();
    }
    if document.kind == "external" {
        return "external".to_string();
    }
    let text = format!(
        "{} {} {}",
        document.title,
        document.section.as_deref().unwrap_or(""),
        document.tags.join(" ")
    )
    .to_lowercase();
    if ["考试", "补考", "重修", "考场", "四六级", "mooc"]
        .iter()
        .any(|term| text.contains(term))
    {
        "exam".to_string()
    } else if ["规定", "制度", "办法", "条例", "政策"]
        .iter()
        .any(|term| text.contains(term))
    {
        "policy".to_string()
    } else if ["流程", "办理", "申请", "指南"]
        .iter()
        .any(|term| text.contains(term))
    {
        "workflow".to_string()
    } else if ["新闻", "快讯", "动态"]
        .iter()
        .any(|term| text.contains(term))
    {
        "news".to_string()
    } else {
        "notice_article".to_string()
    }
}

fn artifact(path: &Path, relative: &str, decoded_bytes: u64) -> Result<ArtifactRef, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    Ok(ArtifactRef {
        path: relative.replace('\\', "/"),
        bytes: bytes.len() as u64,
        decoded_bytes,
        sha256: hex::encode(Sha256::digest(&bytes)),
    })
}

fn write_artifact(root: &Path, relative: &str, bytes: &[u8]) -> Result<ArtifactRef, String> {
    let path = root.join(relative);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let compressed = compress_artifact(bytes);
    fs::write(&path, compressed).map_err(|error| error.to_string())?;
    artifact(&path, relative, bytes.len() as u64)
}

fn term_counts(text: &str, max_n: usize) -> HashMap<String, u16> {
    let mut counts = HashMap::new();
    for token in tokens(text, max_n) {
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

fn build_contents(documents: &[CorpusDocument]) -> (Vec<Vec<(u32, String)>>, Vec<u32>) {
    let mut chunks: Vec<Vec<(u32, String)>> = Vec::new();
    let mut current = Vec::new();
    let mut current_bytes = CHUNK_HEADER_BYTES;
    let mut assignments = vec![0_u32; documents.len()];
    for (index, document) in documents.iter().enumerate() {
        let encoded_bytes = document.content.len() + 8;
        if !current.is_empty() && current_bytes + encoded_bytes > TARGET_CHUNK_BYTES {
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

pub fn build_search_bundle(
    documents: Vec<CorpusDocument>,
    source_names: &BTreeMap<String, String>,
    corpus_snapshot_id: &str,
    output: &Path,
) -> Result<BuildReport, String> {
    if documents.is_empty() {
        return Err("cannot build SearchBundle from an empty corpus".to_string());
    }
    for document in &documents {
        if !source_names.contains_key(&document.source) {
            return Err(format!("unknown corpus source: {}", document.source));
        }
    }
    if output.exists() {
        fs::remove_dir_all(output).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(output).map_err(|error| error.to_string())?;

    let (content_chunks, content_assignments) = build_contents(&documents);
    let metas: Vec<DocumentMeta> = documents
        .iter()
        .enumerate()
        .map(|(index, document)| {
            let source_name = source_names
                .get(&document.source)
                .ok_or_else(|| format!("unknown corpus source: {}", document.source))?;
            Ok(DocumentMeta {
                id: document.id.clone(),
                source: document.source.clone(),
                source_name: source_name.clone(),
                url: document.url.clone(),
                title: document.title.clone(),
                published_at: document.published_at.clone(),
                updated_at: document.updated_at.clone(),
                section: document.section.clone(),
                kind: document.kind.clone(),
                facet: facet_for(document),
                tags: document.tags.clone(),
                attachments: document.attachments.clone(),
                content_chunk: content_assignments[index],
            })
        })
        .collect::<Result<_, String>>()?;

    let mut postings_by_term: BTreeMap<String, Vec<Posting>> = BTreeMap::new();
    for (document_index, document) in documents.iter().enumerate() {
        let source_name = source_names
            .get(&document.source)
            .ok_or_else(|| format!("unknown corpus source: {}", document.source))?;
        let title_text = format!(
            "{} {} {} {}",
            document.title,
            document.section.as_deref().unwrap_or(""),
            source_name,
            document.tags.join(" ")
        );
        let title_terms = term_counts(&title_text, 4);
        let body_terms = term_counts(&document.content, 2);
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
        if !current.is_empty() && current_bytes + encoded_bytes > TARGET_CHUNK_BYTES {
            postings_chunks.push(std::mem::take(&mut current));
            current_bytes = CHUNK_HEADER_BYTES;
        }
        current.push((term, postings));
        current_bytes += encoded_bytes;
    }
    if !current.is_empty() {
        postings_chunks.push(current);
    }

    let mut artifacts = BTreeMap::new();
    artifacts.insert(
        "documents".to_string(),
        write_artifact(output, "documents.bin", &encode_documents(&metas))?,
    );
    let mut lexicon_entries = Vec::new();
    let mut posting_artifacts = Vec::new();
    for (chunk_index, entries) in postings_chunks.iter().enumerate() {
        for (term, _) in entries {
            lexicon_entries.push((term.clone(), chunk_index as u32));
        }
        let relative = format!("postings-{chunk_index:04}.bin");
        posting_artifacts.push(write_artifact(
            output,
            &relative,
            &encode_postings(entries),
        )?);
    }
    artifacts.insert(
        "lexicon".to_string(),
        write_artifact(output, "lexicon.bin", &encode_lexicon(&lexicon_entries))?,
    );
    let lexicon_terms = lexicon_entries.len();
    let mut content_artifacts = Vec::new();
    for (chunk_index, entries) in content_chunks.iter().enumerate() {
        let relative = format!("content-{chunk_index:04}.bin");
        content_artifacts.push(write_artifact(output, &relative, &encode_content(entries))?);
    }

    let mut identity = Sha256::new();
    identity.update(corpus_snapshot_id.as_bytes());
    for value in artifacts.values() {
        identity.update(value.sha256.as_bytes());
    }
    for value in posting_artifacts.iter().chain(content_artifacts.iter()) {
        identity.update(value.sha256.as_bytes());
    }
    let bundle_id = hex::encode(identity.finalize());
    let manifest = SearchBundleManifest {
        format: SEARCH_BUNDLE_FORMAT.to_string(),
        corpus_snapshot_id: corpus_snapshot_id.to_string(),
        bundle_id,
        artifacts,
        postings: posting_artifacts,
        content: content_artifacts,
    };
    let manifest_path = output.join("manifest.json");
    fs::write(
        &manifest_path,
        serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;

    let refs = manifest
        .artifacts
        .values()
        .chain(manifest.postings.iter())
        .chain(manifest.content.iter());
    let total_bytes = refs.clone().map(|artifact| artifact.bytes).sum::<u64>()
        + manifest_path
            .metadata()
            .map_err(|error| error.to_string())?
            .len();
    let file_count = refs.count() + 1;
    Ok(BuildReport {
        manifest,
        document_count: metas.len() as u32,
        lexicon_terms,
        total_bytes,
        file_count,
    })
}

pub fn discover_artifact_paths(manifest: &SearchBundleManifest, root: &Path) -> Vec<PathBuf> {
    manifest
        .artifacts
        .values()
        .chain(manifest.postings.iter())
        .chain(manifest.content.iter())
        .map(|artifact| root.join(&artifact.path))
        .collect()
}
