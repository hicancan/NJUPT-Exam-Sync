use anyhow::{bail, Context, Result};
use njupt_search_core::{Attachment, DocumentKind, IndexDocument};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::Path;

const CORPUS_FORMAT: &str = "njupt-corpus-snapshot";
const ARTIFACT_NAMES: [&str; 3] = [
    "documents.jsonl.zst",
    "attachments.jsonl.zst",
    "links.jsonl.zst",
];

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct CorpusManifest {
    format: String,
    snapshot_id: String,
    counts: CorpusCounts,
    sources: Vec<CorpusSource>,
    artifacts: BTreeMap<String, CorpusArtifact>,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct CorpusSource {
    id: String,
    name: String,
    counts: CorpusSourceCounts,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct CorpusCounts {
    sites: u64,
    documents: u64,
    attachments: u64,
    links: u64,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct CorpusSourceCounts {
    documents: u64,
    attachments: u64,
    links: u64,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct CorpusArtifact {
    path: String,
    bytes: u64,
    sha256: String,
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct CorpusDocument {
    id: String,
    source: String,
    url: String,
    title: String,
    content: String,
    published_at: Option<String>,
    updated_at: Option<String>,
    section: Option<String>,
    kind: String,
    tags: Vec<String>,
    attachment_ids: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct CorpusAttachment {
    id: String,
    source: String,
    url: String,
    name: String,
    extension: Option<String>,
    parent_id: Option<String>,
    parent_url: Option<String>,
    section: Option<String>,
}

pub struct CorpusInput {
    pub snapshot_id: String,
    pub documents: Vec<IndexDocument>,
}

fn read_manifest(path: &Path) -> Result<CorpusManifest> {
    serde_json::from_slice(&fs::read(path)?).with_context(|| format!("invalid {}", path.display()))
}

fn validate_artifact(corpus: &Path, name: &str, artifact: &CorpusArtifact) -> Result<()> {
    if artifact.path != name {
        bail!("corpus artifact path must be {name}");
    }
    let path = corpus.join(name);
    let bytes = fs::read(&path).with_context(|| format!("missing corpus artifact {name}"))?;
    if bytes.len() as u64 != artifact.bytes {
        bail!("corpus artifact size mismatch: {name}");
    }
    if hex::encode(Sha256::digest(&bytes)) != artifact.sha256 {
        bail!("corpus artifact hash mismatch: {name}");
    }
    Ok(())
}

fn read_rows<T: serde::de::DeserializeOwned>(path: &Path, label: &str) -> Result<Vec<T>> {
    let file =
        File::open(path).with_context(|| format!("missing corpus artifact {}", path.display()))?;
    let decoder = zstd::stream::read::Decoder::new(file)
        .with_context(|| format!("invalid zstd corpus artifact {}", path.display()))?;
    let mut rows = Vec::new();
    for (line_number, line) in BufReader::new(decoder).lines().enumerate() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        rows.push(
            serde_json::from_str(&line)
                .with_context(|| format!("invalid {label} row at line {}", line_number + 1))?,
        );
    }
    Ok(rows)
}

fn snapshot_id(manifest: &CorpusManifest) -> Result<String> {
    let value = serde_json::json!({
        "format": manifest.format,
        "counts": manifest.counts,
        "sources": manifest.sources,
        "artifacts": manifest.artifacts,
    });
    Ok(hex::encode(Sha256::digest(serde_json::to_vec(&value)?)))
}

fn document_kind(value: &str) -> Result<DocumentKind> {
    match value {
        "page" => Ok(DocumentKind::Page),
        "attachment" => Ok(DocumentKind::Attachment),
        "external" => Ok(DocumentKind::External),
        _ => bail!("unsupported corpus document kind: {value}"),
    }
}

pub fn read_corpus(corpus: &Path) -> Result<CorpusInput> {
    let mut expected_entries = HashSet::from(["manifest.json".to_string()]);
    expected_entries.extend(ARTIFACT_NAMES.map(str::to_string));
    let present_entries = fs::read_dir(corpus)
        .with_context(|| format!("missing corpus directory {}", corpus.display()))?
        .map(|entry| {
            let entry = entry?;
            if !entry.file_type()?.is_file() {
                bail!(
                    "corpus contains a non-file entry: {}",
                    entry.path().display()
                );
            }
            entry
                .file_name()
                .into_string()
                .map_err(|_| anyhow::anyhow!("corpus contains a non-Unicode file name"))
        })
        .collect::<Result<HashSet<_>>>()?;
    if present_entries != expected_entries {
        bail!("corpus directory does not match the current four-file format");
    }

    let manifest = read_manifest(&corpus.join("manifest.json"))?;
    if manifest.format != CORPUS_FORMAT {
        bail!("unsupported corpus snapshot format");
    }
    if manifest.artifacts.len() != ARTIFACT_NAMES.len()
        || !manifest
            .artifacts
            .keys()
            .all(|name| ARTIFACT_NAMES.contains(&name.as_str()))
    {
        bail!("corpus manifest must contain the exact three artifacts");
    }
    for name in ARTIFACT_NAMES {
        validate_artifact(
            corpus,
            name,
            manifest
                .artifacts
                .get(name)
                .with_context(|| format!("corpus manifest missing artifact {name}"))?,
        )?;
    }
    if manifest.snapshot_id != snapshot_id(&manifest)? {
        bail!("corpus snapshot identity mismatch");
    }
    if manifest.counts.sites as usize != manifest.sources.len() {
        bail!("corpus site count does not match sources");
    }

    let mut source_names = BTreeMap::new();
    let mut source_declared_counts = HashMap::new();
    for source in &manifest.sources {
        if source.id.trim().is_empty() || source.name.trim().is_empty() {
            bail!("corpus manifest contains an empty source id or name");
        }
        if source_names
            .insert(source.id.clone(), source.name.clone())
            .is_some()
        {
            bail!("corpus manifest contains duplicate source: {}", source.id);
        }
        if source_declared_counts
            .insert(
                source.id.clone(),
                (
                    source.counts.documents,
                    source.counts.attachments,
                    source.counts.links,
                ),
            )
            .is_some()
        {
            bail!("corpus manifest contains duplicate source counts");
        }
    }
    let declared_totals =
        source_declared_counts
            .values()
            .fold((0_u64, 0_u64, 0_u64), |totals, counts| {
                (
                    totals.0 + counts.0,
                    totals.1 + counts.1,
                    totals.2 + counts.2,
                )
            });
    if declared_totals
        != (
            manifest.counts.documents,
            manifest.counts.attachments,
            manifest.counts.links,
        )
    {
        bail!("corpus source counts do not match manifest totals");
    }

    let documents: Vec<CorpusDocument> =
        read_rows(&corpus.join("documents.jsonl.zst"), "corpus document")?;
    if documents.len() as u64 != manifest.counts.documents {
        bail!("corpus document count does not match manifest");
    }
    let attachments: Vec<CorpusAttachment> =
        read_rows(&corpus.join("attachments.jsonl.zst"), "corpus attachment")?;
    if attachments.len() as u64 != manifest.counts.attachments {
        bail!("corpus attachment count does not match manifest");
    }

    let mut attachments_by_id = HashMap::new();
    let mut source_actual_attachments: HashMap<String, u64> = HashMap::new();
    for attachment in attachments {
        if attachment.id.trim().is_empty()
            || attachment.source.trim().is_empty()
            || attachment.url.trim().is_empty()
            || attachment.name.trim().is_empty()
            || !source_names.contains_key(&attachment.source)
            || attachment
                .extension
                .as_ref()
                .is_some_and(|extension| extension.trim().is_empty())
            || attachment
                .parent_id
                .as_ref()
                .is_some_and(|parent| parent.trim().is_empty())
            || attachment
                .parent_url
                .as_ref()
                .is_some_and(|url| url.trim().is_empty())
            || attachment
                .section
                .as_ref()
                .is_some_and(|section| section.trim().is_empty())
        {
            bail!("invalid corpus attachment: {}", attachment.id);
        }
        *source_actual_attachments
            .entry(attachment.source.clone())
            .or_default() += 1;
        if attachments_by_id
            .insert(attachment.id.clone(), attachment)
            .is_some()
        {
            bail!("duplicate corpus attachment id");
        }
    }

    let mut document_ids = HashSet::new();
    let mut referenced_attachment_ids = HashSet::new();
    let mut source_actual_documents: HashMap<String, u64> = HashMap::new();
    let mut index_documents = Vec::with_capacity(documents.len());
    for document in documents {
        if document.id.trim().is_empty()
            || document.source.trim().is_empty()
            || document.url.trim().is_empty()
            || document.title.trim().is_empty()
            || !source_names.contains_key(&document.source)
            || document.tags.iter().any(|tag| tag.trim().is_empty())
            || !document_ids.insert(document.id.clone())
        {
            bail!("invalid or duplicate corpus document: {}", document.id);
        }
        let kind = document_kind(&document.kind)?;
        let mut joined_attachments = Vec::with_capacity(document.attachment_ids.len());
        let mut local_ids = HashSet::new();
        for attachment_id in &document.attachment_ids {
            if attachment_id.trim().is_empty()
                || !local_ids.insert(attachment_id)
                || !referenced_attachment_ids.insert(attachment_id.clone())
            {
                bail!(
                    "invalid or repeated attachment reference on document {}",
                    document.id
                );
            }
            let attachment = attachments_by_id
                .get(attachment_id)
                .with_context(|| format!("missing corpus attachment: {attachment_id}"))?;
            if attachment.source != document.source {
                bail!("attachment source does not match document: {attachment_id}");
            }
            match attachment.parent_id.as_deref() {
                Some(parent_id) if parent_id == document.id && kind == DocumentKind::Page => {}
                None if attachment.id == document.id && kind == DocumentKind::Attachment => {}
                _ => {
                    bail!("attachment parent does not match referencing document: {attachment_id}")
                }
            }
            joined_attachments.push(Attachment {
                id: attachment.id.clone(),
                url: attachment.url.clone(),
                name: attachment.name.clone(),
                extension: attachment.extension.clone(),
            });
        }
        *source_actual_documents
            .entry(document.source.clone())
            .or_default() += 1;
        index_documents.push(IndexDocument {
            id: document.id,
            source_name: source_names[&document.source].clone(),
            source: document.source,
            url: document.url,
            title: document.title,
            content: document.content,
            published_at: document.published_at,
            updated_at: document.updated_at,
            section: document.section,
            kind,
            tags: document.tags,
            attachments: joined_attachments,
        });
    }
    if referenced_attachment_ids.len() != attachments_by_id.len() {
        bail!("corpus contains unreferenced attachment rows");
    }

    for (source_id, (document_count, attachment_count, _link_count)) in source_declared_counts {
        if source_actual_documents
            .remove(&source_id)
            .unwrap_or_default()
            != document_count
            || source_actual_attachments
                .remove(&source_id)
                .unwrap_or_default()
                != attachment_count
        {
            bail!("search input row count mismatch for source: {source_id}");
        }
    }
    if !source_actual_documents.is_empty() || !source_actual_attachments.is_empty() {
        bail!("search input contains rows for undeclared sources");
    }

    Ok(CorpusInput {
        snapshot_id: manifest.snapshot_id,
        documents: index_documents,
    })
}
