from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from ..runtime_mirror.config import BASE_DIR, PUBLIC_INDEX_DIR, PUBLIC_ROOT
from .config import DEFAULT_BROWSER_VERIFICATION_REPORT, DEFAULT_WASM_DECISION_REPORT


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)

def repo_relative(path: Path) -> str:
    return path.resolve().relative_to(BASE_DIR.resolve()).as_posix()

def public_artifact_repo_path(path_from_public_root: str) -> str:
    return f"apps/web/public/{path_from_public_root}"

def git_show_bytes(ref: str, repo_path: str) -> bytes:
    return subprocess.check_output(["git", "show", f"{ref}:{repo_path}"], cwd=BASE_DIR)

def git_show_json(ref: str, repo_path: str) -> Any:
    return json.loads(git_show_bytes(ref, repo_path))

def current_manifest(collection: Path = PUBLIC_INDEX_DIR) -> dict[str, Any]:
    return read_json(collection / "manifest.json")

def current_artifact_bytes(path_from_public_root: str) -> bytes:
    return (PUBLIC_ROOT / path_from_public_root).read_bytes()

def current_artifact_json(path_from_public_root: str) -> Any:
    return json.loads(current_artifact_bytes(path_from_public_root))

def manifest_size_report(manifest: dict[str, Any], *, baseline_ref: str | None = None) -> dict[str, Any]:
    artifact = manifest["artifacts"]["size_report"]
    path = public_artifact_repo_path(str(artifact["path"]))
    if baseline_ref is not None:
        return git_show_json(baseline_ref, path)
    return current_artifact_json(str(artifact["path"]))

def source_manifest_entries(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    sitegraph = manifest.get("sitegraph") if isinstance(manifest.get("sitegraph"), dict) else {}
    entries = sitegraph.get("source_manifests") if isinstance(sitegraph.get("source_manifests"), dict) else {}
    return {str(source_id): entry for source_id, entry in entries.items() if isinstance(entry, dict)}

def source_manifest_total_bytes(manifest: dict[str, Any]) -> int:
    return sum(int(entry.get("bytes") or 0) for entry in source_manifest_entries(manifest).values())

def load_source_manifest_payloads(manifest: dict[str, Any], *, baseline_ref: str | None = None) -> list[bytes]:
    payloads: list[bytes] = []
    for entry in source_manifest_entries(manifest).values():
        path = str(entry["path"])
        if baseline_ref is None:
            payloads.append(current_artifact_bytes(path))
        else:
            payloads.append(git_show_bytes(baseline_ref, public_artifact_repo_path(path)))
    return payloads

def load_source_manifest_jsons(manifest: dict[str, Any], *, baseline_ref: str | None = None) -> list[dict[str, Any]]:
    return [json.loads(payload) for payload in load_source_manifest_payloads(manifest, baseline_ref=baseline_ref)]

def load_shard_filter_payloads(manifest: dict[str, Any], *, baseline_ref: str | None = None) -> list[bytes]:
    payloads: list[bytes] = []
    for source_manifest in load_source_manifest_jsons(manifest, baseline_ref=baseline_ref):
        artifact = ((source_manifest.get("artifacts") or {}).get("shard_filter") or {})
        path = str(artifact.get("path") or "")
        if not path:
            continue
        manifest_payload = current_artifact_bytes(path) if baseline_ref is None else git_show_bytes(baseline_ref, public_artifact_repo_path(path))
        try:
            decoded = json.loads(manifest_payload)
        except json.JSONDecodeError:
            payloads.append(manifest_payload)
            continue
        if isinstance(decoded, dict) and decoded.get("version") == "sitegraph-shard-filter-parts-v1":
            for part in decoded.get("parts") or []:
                part_path = str(part.get("path") if isinstance(part, dict) else "")
                if not part_path:
                    continue
                payloads.append(current_artifact_bytes(part_path) if baseline_ref is None else git_show_bytes(baseline_ref, public_artifact_repo_path(part_path)))
        else:
            payloads.append(manifest_payload)
    return payloads

def load_local_body_payloads(manifest: dict[str, Any], *, baseline_ref: str | None = None, packed: bool = False) -> list[bytes]:
    payloads: list[bytes] = []
    for source_manifest in load_source_manifest_jsons(manifest, baseline_ref=baseline_ref):
        for ref in source_manifest.get("local_indexes") or []:
            artifact_key = "body_index_packed" if packed else "body_index"
            artifact = ref.get(artifact_key) if isinstance(ref, dict) else None
            if not isinstance(artifact, dict) or not artifact.get("path"):
                continue
            path = str(artifact["path"])
            if baseline_ref is None:
                payloads.append(current_artifact_bytes(path))
            else:
                payloads.append(git_show_bytes(baseline_ref, public_artifact_repo_path(path)))
    return payloads

def load_local_light_payloads(manifest: dict[str, Any], *, baseline_ref: str | None = None, artifact_key: str = "light_index") -> list[bytes]:
    payloads: list[bytes] = []
    for source_manifest in load_source_manifest_jsons(manifest, baseline_ref=baseline_ref):
        for ref in source_manifest.get("local_indexes") or []:
            artifact = ref.get(artifact_key) if isinstance(ref, dict) else None
            if not isinstance(artifact, dict) or not artifact.get("path"):
                continue
            path = str(artifact["path"])
            if baseline_ref is None:
                payloads.append(current_artifact_bytes(path))
            else:
                payloads.append(git_show_bytes(baseline_ref, public_artifact_repo_path(path)))
    return payloads

def local_index_refs_by_id(manifest: dict[str, Any], *, baseline_ref: str | None = None) -> dict[str, dict[str, Any]]:
    refs: dict[str, dict[str, Any]] = {}
    for source_manifest in load_source_manifest_jsons(manifest, baseline_ref=baseline_ref):
        for ref in source_manifest.get("local_indexes") or []:
            if isinstance(ref, dict) and ref.get("index_id"):
                refs[str(ref["index_id"])] = ref
    return refs

def local_index_payloads_by_ids(
    refs_by_id: dict[str, dict[str, Any]],
    index_ids: list[str],
    artifact_key: str,
    *,
    baseline_ref: str | None = None,
) -> list[bytes]:
    payloads: list[bytes] = []
    for index_id in dict.fromkeys(index_ids):
        ref = refs_by_id.get(str(index_id))
        artifact = ref.get(artifact_key) if isinstance(ref, dict) else None
        if not isinstance(artifact, dict) or not artifact.get("path"):
            continue
        path = str(artifact["path"])
        if baseline_ref is None:
            payloads.append(current_artifact_bytes(path))
        else:
            payloads.append(git_show_bytes(baseline_ref, public_artifact_repo_path(path)))
    return payloads

def load_wasm_decision_report(path: Path = DEFAULT_WASM_DECISION_REPORT) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return read_json(path)

def load_browser_verification_report(path: Path = DEFAULT_BROWSER_VERIFICATION_REPORT) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return read_json(path)
