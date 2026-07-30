use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const SEARCH_BUNDLE_FORMAT: &str = "njupt-search-bundle";

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
    pub bundle_id: String,
    pub corpus_snapshot_id: String,
    pub documents: ArtifactRef,
    pub lexicon: ArtifactRef,
    pub postings: Vec<ArtifactRef>,
    pub content: Vec<ArtifactRef>,
}

impl SearchBundleManifest {
    pub fn artifact_refs(&self) -> impl Iterator<Item = &ArtifactRef> {
        std::iter::once(&self.documents)
            .chain(std::iter::once(&self.lexicon))
            .chain(self.postings.iter())
            .chain(self.content.iter())
    }
}

pub fn calculate_bundle_id(manifest: &SearchBundleManifest) -> String {
    let mut identity = Sha256::new();
    for artifact in manifest.artifact_refs() {
        identity.update(artifact.path.as_bytes());
        identity.update([0]);
        identity.update(artifact.bytes.to_string().as_bytes());
        identity.update([0]);
        identity.update(artifact.sha256.as_bytes());
        identity.update([0]);
    }
    hex::encode(identity.finalize())
}

#[derive(Clone, Debug)]
pub struct CompiledArtifact {
    pub reference: ArtifactRef,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug)]
pub struct CompiledBundle {
    pub manifest: SearchBundleManifest,
    pub artifacts: Vec<CompiledArtifact>,
    pub document_count: u32,
    pub lexicon_terms: usize,
}

impl CompiledBundle {
    pub fn total_artifact_bytes(&self) -> u64 {
        self.artifacts
            .iter()
            .map(|artifact| artifact.reference.bytes)
            .sum()
    }
}
