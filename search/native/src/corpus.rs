use anyhow::{bail, Context, Result};
use njupt_search_core::model::CorpusDocument;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::Path;

const CORPUS_FORMAT: &str = "njupt-corpus-snapshot-v2";
const ARTIFACT_NAMES: [&str; 3] = [
    "documents.jsonl.zst",
    "attachments.jsonl.zst",
    "links.jsonl.zst",
];

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct CorpusManifest {
    format: String,
    snapshot_id: String,
    counts: CorpusCounts,
    sources: Vec<CorpusSource>,
    artifacts: BTreeMap<String, CorpusArtifact>,
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct CorpusSource {
    id: String,
    name: String,
    counts: CorpusSourceCounts,
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct CorpusCounts {
    sites: u64,
    documents: u64,
    attachments: u64,
    links: u64,
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct CorpusSourceCounts {
    documents: u64,
    attachments: u64,
    links: u64,
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct CorpusArtifact {
    path: String,
    bytes: u64,
    sha256: String,
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct CorpusAttachmentRow {
    id: String,
    source: String,
    url: String,
    name: String,
    extension: Option<String>,
    parent_id: Option<String>,
    parent_url: Option<String>,
    section: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct CorpusLinkRow {
    id: String,
    source: String,
    url: String,
    label: Option<String>,
    kind: String,
    from_url: Option<String>,
    category: Option<String>,
}

pub struct CorpusInput {
    pub snapshot_id: String,
    pub source_names: BTreeMap<String, String>,
    pub documents: Vec<CorpusDocument>,
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
    let actual_hash = hex::encode(Sha256::digest(&bytes));
    if actual_hash != artifact.sha256 {
        bail!("corpus artifact hash mismatch: {name}");
    }
    Ok(())
}

fn stable_id(kind: &str, source: &str, identity: &str) -> String {
    let digest = Sha256::digest(format!("{kind}\0{source}\0{identity}").as_bytes());
    format!("{source}-{kind}-{}", hex::encode(&digest[..12]))
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
    if manifest.artifacts.len() != ARTIFACT_NAMES.len() {
        bail!("corpus manifest must contain exactly three artifacts");
    }
    let mut identity = Sha256::new();
    for name in ARTIFACT_NAMES {
        let artifact = manifest
            .artifacts
            .get(name)
            .with_context(|| format!("corpus manifest missing artifact {name}"))?;
        validate_artifact(corpus, name, artifact)?;
        let hash = hex::decode(&artifact.sha256)
            .with_context(|| format!("invalid corpus artifact hash: {name}"))?;
        if hash.len() != 32 {
            bail!("invalid corpus artifact hash: {name}");
        }
        identity.update(name.as_bytes());
        identity.update(hash);
    }
    if hex::encode(identity.finalize()) != manifest.snapshot_id {
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
        source_declared_counts.insert(
            source.id.clone(),
            (
                source.counts.documents,
                source.counts.attachments,
                source.counts.links,
            ),
        );
        if source_names
            .insert(source.id.clone(), source.name.clone())
            .is_some()
        {
            bail!("corpus manifest contains duplicate source: {}", source.id);
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
    let mut document_ids = HashSet::new();
    let mut document_keys = HashSet::new();
    let mut document_meta = HashMap::new();
    let mut nested_attachments = HashMap::new();
    let mut source_actual_documents: HashMap<String, u64> = HashMap::new();
    for document in &documents {
        if document.id.trim().is_empty()
            || document.source.trim().is_empty()
            || document.url.trim().is_empty()
            || document.title.trim().is_empty()
            || !matches!(document.kind.as_str(), "page" | "attachment" | "external")
            || document.tags.iter().any(|tag| tag.trim().is_empty())
        {
            bail!("invalid corpus document: {}", document.id);
        }
        if !source_names.contains_key(&document.source) {
            bail!("corpus document has unknown source: {}", document.source);
        }
        if !document_ids.insert(document.id.clone()) {
            bail!("duplicate corpus document id: {}", document.id);
        }
        let key = (
            document.source.clone(),
            document.kind.clone(),
            if document.kind == "external" {
                format!("{}\0{}", document.url, document.title)
            } else {
                document.url.clone()
            },
        );
        if !document_keys.insert(key) {
            bail!(
                "duplicate corpus document source/kind/url: {}/{}/{}",
                document.source,
                document.kind,
                document.url
            );
        }
        let expected_id = match document.kind.as_str() {
            "page" => stable_id("document", &document.source, &document.url),
            "external" => stable_id(
                "external",
                &document.source,
                &format!("{}\0{}", document.url, document.title),
            ),
            "attachment" => stable_id(
                "attachment",
                &document.source,
                &format!("\0{}", document.url),
            ),
            _ => unreachable!(),
        };
        if document.id != expected_id {
            bail!("invalid corpus document identity: {}", document.id);
        }
        let mut canonical_tags = document.tags.clone();
        canonical_tags.sort();
        canonical_tags.dedup();
        if document.tags != canonical_tags {
            bail!("corpus document tags are not canonical: {}", document.id);
        }
        let mut local_attachment_ids = HashSet::new();
        for attachment in &document.attachments {
            if attachment.id.trim().is_empty()
                || attachment.url.trim().is_empty()
                || attachment.name.trim().is_empty()
                || attachment.extension.as_ref().is_some_and(|extension| {
                    extension.is_empty() || extension != &extension.to_lowercase()
                })
                || !local_attachment_ids.insert(attachment.id.clone())
                || nested_attachments
                    .insert(
                        attachment.id.clone(),
                        (document.id.clone(), attachment.clone()),
                    )
                    .is_some()
            {
                bail!("invalid or duplicate corpus attachment: {}", attachment.id);
            }
        }
        *source_actual_documents
            .entry(document.source.clone())
            .or_default() += 1;
        document_meta.insert(
            document.id.clone(),
            (
                document.kind.clone(),
                document.url.clone(),
                document.section.clone(),
            ),
        );
    }
    if documents.len() as u64 != manifest.counts.documents {
        bail!("corpus document count does not match manifest");
    }

    let attachments: Vec<CorpusAttachmentRow> =
        read_rows(&corpus.join("attachments.jsonl.zst"), "corpus attachment")?;
    if attachments.len() as u64 != manifest.counts.attachments {
        bail!("corpus attachment count does not match manifest");
    }
    let mut table_attachment_ids = HashSet::new();
    let mut source_actual_attachments: HashMap<String, u64> = HashMap::new();
    for attachment in &attachments {
        if attachment.id.trim().is_empty()
            || attachment.url.trim().is_empty()
            || attachment.name.trim().is_empty()
            || !source_names.contains_key(&attachment.source)
            || attachment.extension.as_ref().is_some_and(|extension| {
                extension.is_empty() || extension != &extension.to_lowercase()
            })
            || attachment
                .section
                .as_ref()
                .is_some_and(|section| section.trim().is_empty())
            || !table_attachment_ids.insert(attachment.id.clone())
        {
            bail!(
                "invalid or duplicate corpus attachment row: {}",
                attachment.id
            );
        }
        if attachment.id
            != stable_id(
                "attachment",
                &attachment.source,
                &format!(
                    "{}\0{}",
                    attachment.parent_id.as_deref().unwrap_or_default(),
                    attachment.url
                ),
            )
        {
            bail!("invalid corpus attachment identity: {}", attachment.id);
        }
        let (owner_id, nested) = nested_attachments.get(&attachment.id).with_context(|| {
            format!(
                "corpus attachment is not projected by a document: {}",
                attachment.id
            )
        })?;
        if nested.url != attachment.url
            || nested.name != attachment.name
            || nested.extension != attachment.extension
        {
            bail!("corpus attachment projection mismatch: {}", attachment.id);
        }
        match &attachment.parent_id {
            Some(parent_id) => {
                let (kind, url, section) = document_meta
                    .get(parent_id)
                    .with_context(|| format!("missing attachment parent: {parent_id}"))?;
                if kind != "page"
                    || owner_id != parent_id
                    || attachment.parent_url.as_ref() != Some(url)
                    || &attachment.section != section
                {
                    bail!("invalid attachment parent relationship: {}", attachment.id);
                }
            }
            None => {
                let (kind, url, section) =
                    document_meta.get(&attachment.id).with_context(|| {
                        format!("missing orphan attachment document: {}", attachment.id)
                    })?;
                if kind != "attachment"
                    || owner_id != &attachment.id
                    || url != &attachment.url
                    || attachment.parent_url.is_some()
                    || &attachment.section != section
                {
                    bail!("invalid orphan attachment relationship: {}", attachment.id);
                }
            }
        }
        *source_actual_attachments
            .entry(attachment.source.clone())
            .or_default() += 1;
    }
    if table_attachment_ids != nested_attachments.keys().cloned().collect() {
        bail!("corpus attachment table and document projections differ");
    }

    let links: Vec<CorpusLinkRow> = read_rows(&corpus.join("links.jsonl.zst"), "corpus link")?;
    if links.len() as u64 != manifest.counts.links {
        bail!("corpus link count does not match manifest");
    }
    let mut link_ids = HashSet::new();
    let mut source_actual_links: HashMap<String, u64> = HashMap::new();
    for link in &links {
        if link.id.trim().is_empty()
            || link.url.trim().is_empty()
            || !source_names.contains_key(&link.source)
            || !matches!(link.kind.as_str(), "external" | "edge")
            || link
                .label
                .as_ref()
                .is_some_and(|label| label.trim().is_empty())
            || link
                .from_url
                .as_ref()
                .is_some_and(|url| url.trim().is_empty())
            || link
                .category
                .as_ref()
                .is_some_and(|category| category.trim().is_empty())
            || !link_ids.insert(link.id.clone())
        {
            bail!("invalid or duplicate corpus link: {}", link.id);
        }
        let identity = [
            link.from_url.as_deref().unwrap_or_default(),
            &link.url,
            link.label.as_deref().unwrap_or_default(),
            link.category.as_deref().unwrap_or_default(),
        ]
        .join("\0");
        if link.id != stable_id(&link.kind, &link.source, &identity) {
            bail!("invalid corpus link identity: {}", link.id);
        }
        *source_actual_links.entry(link.source.clone()).or_default() += 1;
    }

    for (source_id, (documents_count, attachments_count, links_count)) in source_declared_counts {
        if source_actual_documents
            .remove(&source_id)
            .unwrap_or_default()
            != documents_count
            || source_actual_attachments
                .remove(&source_id)
                .unwrap_or_default()
                != attachments_count
            || source_actual_links.remove(&source_id).unwrap_or_default() != links_count
        {
            bail!("corpus row count mismatch for source: {source_id}");
        }
    }
    if !source_actual_documents.is_empty()
        || !source_actual_attachments.is_empty()
        || !source_actual_links.is_empty()
    {
        bail!("corpus contains rows for undeclared sources");
    }
    Ok(CorpusInput {
        snapshot_id: manifest.snapshot_id,
        source_names,
        documents,
    })
}
