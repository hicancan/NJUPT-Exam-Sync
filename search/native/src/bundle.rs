use anyhow::{bail, Context, Result};
use njupt_search_core::model::ArtifactRef;
use njupt_search_core::{SearchBundleManifest, SearchEngine, SEARCH_BUNDLE_FORMAT};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

fn read_manifest(path: &Path) -> Result<SearchBundleManifest> {
    serde_json::from_slice(&fs::read(path)?).with_context(|| format!("invalid {}", path.display()))
}

fn read_artifact(bundle: &Path, artifact: &ArtifactRef, expected_path: &str) -> Result<Vec<u8>> {
    if artifact.path != expected_path {
        bail!("SearchBundle artifact path must be {expected_path}");
    }
    let bytes = fs::read(bundle.join(expected_path))
        .with_context(|| format!("missing SearchBundle artifact {expected_path}"))?;
    if bytes.len() as u64 != artifact.bytes {
        bail!("SearchBundle artifact size mismatch: {expected_path}");
    }
    if hex::encode(Sha256::digest(&bytes)) != artifact.sha256 {
        bail!("SearchBundle artifact hash mismatch: {expected_path}");
    }
    Ok(bytes)
}

pub fn load_engine(bundle: &Path) -> Result<(SearchBundleManifest, SearchEngine)> {
    let manifest = read_manifest(&bundle.join("manifest.json"))?;
    if manifest.format != SEARCH_BUNDLE_FORMAT {
        bail!("unsupported SearchBundle format");
    }
    if manifest.artifacts.len() != 2 {
        bail!("SearchBundle must contain exactly documents and lexicon metadata");
    }
    let document_ref = manifest
        .artifacts
        .get("documents")
        .context("SearchBundle manifest missing documents")?;
    let lexicon_ref = manifest
        .artifacts
        .get("lexicon")
        .context("SearchBundle manifest missing lexicon")?;
    let documents = read_artifact(bundle, document_ref, "documents.bin")?;
    let lexicon = read_artifact(bundle, lexicon_ref, "lexicon.bin")?;
    let mut identity = Sha256::new();
    identity.update(manifest.corpus_snapshot_id.as_bytes());
    identity.update(document_ref.sha256.as_bytes());
    identity.update(lexicon_ref.sha256.as_bytes());
    let mut engine = SearchEngine::new(
        &documents,
        document_ref.decoded_bytes,
        &lexicon,
        lexicon_ref.decoded_bytes,
    )
    .map_err(anyhow::Error::msg)?;
    for (index, artifact) in manifest.postings.iter().enumerate() {
        let expected_path = format!("postings-{index:04}.bin");
        let bytes = read_artifact(bundle, artifact, &expected_path)?;
        identity.update(artifact.sha256.as_bytes());
        engine
            .load_postings_chunk(index as u32, &bytes, artifact.decoded_bytes)
            .map_err(anyhow::Error::msg)?;
    }
    for (index, artifact) in manifest.content.iter().enumerate() {
        let expected_path = format!("content-{index:04}.bin");
        let bytes = read_artifact(bundle, artifact, &expected_path)?;
        identity.update(artifact.sha256.as_bytes());
        engine
            .load_content_chunk(index as u32, &bytes, artifact.decoded_bytes)
            .map_err(anyhow::Error::msg)?;
    }
    if manifest.postings.is_empty() || manifest.content.is_empty() {
        bail!("SearchBundle postings and content must not be empty");
    }
    if hex::encode(identity.finalize()) != manifest.bundle_id {
        bail!("SearchBundle identity mismatch");
    }
    Ok((manifest, engine))
}
