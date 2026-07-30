use anyhow::{bail, Context, Result};
use njupt_search_core::{
    calculate_bundle_id, ArtifactRef, CompiledBundle, SearchBundleManifest, SearchEngine,
    SEARCH_BUNDLE_FORMAT,
};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

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

fn expected_paths(manifest: &SearchBundleManifest) -> HashSet<String> {
    std::iter::once("manifest.json".to_string())
        .chain(
            manifest
                .artifact_refs()
                .map(|artifact| artifact.path.clone()),
        )
        .collect()
}

pub fn load_engine(bundle: &Path) -> Result<(SearchBundleManifest, SearchEngine)> {
    let manifest = read_manifest(&bundle.join("manifest.json"))?;
    if manifest.format != SEARCH_BUNDLE_FORMAT {
        bail!("unsupported SearchBundle format");
    }
    if manifest.postings.is_empty() || manifest.content.is_empty() {
        bail!("SearchBundle postings and content must not be empty");
    }
    if manifest.corpus_snapshot_id.len() != 64
        || !manifest
            .corpus_snapshot_id
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        bail!("invalid SearchBundle corpus provenance");
    }
    let actual_paths = fs::read_dir(bundle)
        .with_context(|| format!("missing SearchBundle directory {}", bundle.display()))?
        .map(|entry| {
            let entry = entry?;
            if !entry.file_type()?.is_file() {
                bail!(
                    "SearchBundle contains a non-file entry: {}",
                    entry.path().display()
                );
            }
            entry
                .file_name()
                .into_string()
                .map_err(|_| anyhow::anyhow!("SearchBundle contains a non-Unicode file name"))
        })
        .collect::<Result<HashSet<_>>>()?;
    if actual_paths != expected_paths(&manifest) {
        bail!("SearchBundle files do not match its manifest");
    }
    if calculate_bundle_id(&manifest) != manifest.bundle_id {
        bail!("SearchBundle identity mismatch");
    }

    let documents = read_artifact(bundle, &manifest.documents, "documents.bin")?;
    let lexicon = read_artifact(bundle, &manifest.lexicon, "lexicon.bin")?;
    let mut engine = SearchEngine::new(
        &documents,
        manifest.documents.decoded_bytes,
        &lexicon,
        manifest.lexicon.decoded_bytes,
    )
    .map_err(anyhow::Error::msg)?;
    for (index, artifact) in manifest.postings.iter().enumerate() {
        let expected_path = format!("postings-{index:04}.bin");
        let bytes = read_artifact(bundle, artifact, &expected_path)?;
        engine
            .load_postings_chunk(index as u32, &bytes, artifact.decoded_bytes)
            .map_err(anyhow::Error::msg)?;
    }
    for (index, artifact) in manifest.content.iter().enumerate() {
        let expected_path = format!("content-{index:04}.bin");
        let bytes = read_artifact(bundle, artifact, &expected_path)?;
        engine
            .load_content_chunk(index as u32, &bytes, artifact.decoded_bytes)
            .map_err(anyhow::Error::msg)?;
    }
    Ok((manifest, engine))
}

fn sibling_path(output: &Path, suffix: &str) -> Result<PathBuf> {
    let parent = output
        .parent()
        .context("SearchBundle output must have a parent directory")?;
    let name = output
        .file_name()
        .and_then(|name| name.to_str())
        .context("SearchBundle output must have a Unicode file name")?;
    Ok(parent.join(format!("{name}.{suffix}-{}", std::process::id())))
}

pub struct WriteReport {
    pub file_count: usize,
    pub total_bytes: u64,
}

pub fn write_bundle(output: &Path, bundle: &CompiledBundle) -> Result<WriteReport> {
    let parent = output
        .parent()
        .context("SearchBundle output must have a parent directory")?;
    fs::create_dir_all(parent)?;
    let staging = sibling_path(output, "staging")?;
    let backup = sibling_path(output, "replaced")?;
    if staging.exists() {
        fs::remove_dir_all(&staging)?;
    }
    if backup.exists() {
        fs::remove_dir_all(&backup)?;
    }
    fs::create_dir(&staging)?;

    for artifact in &bundle.artifacts {
        fs::write(staging.join(&artifact.reference.path), &artifact.bytes)?;
    }
    let manifest_bytes = serde_json::to_vec_pretty(&bundle.manifest)?;
    fs::write(staging.join("manifest.json"), &manifest_bytes)?;
    load_engine(&staging).context("compiled SearchBundle failed self-validation")?;

    let had_output = output.exists();
    if had_output {
        fs::rename(output, &backup)?;
    }
    if let Err(error) = fs::rename(&staging, output) {
        if had_output && backup.exists() {
            fs::rename(&backup, output)?;
        }
        return Err(error.into());
    }
    if backup.exists() {
        fs::remove_dir_all(&backup)?;
    }
    Ok(WriteReport {
        file_count: bundle.artifacts.len() + 1,
        total_bytes: bundle.total_artifact_bytes() + manifest_bytes.len() as u64,
    })
}
