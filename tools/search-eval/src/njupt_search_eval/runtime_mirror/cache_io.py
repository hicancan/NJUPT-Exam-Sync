from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from njupt_search_indexer.sitegraph_binary_index import unpack_impact_terms

from .config import PUBLIC_INDEX_DIR, PUBLIC_ROOT


def new_cache_stats() -> dict[str, Any]:
    return {
        "scope": "memory_content_hash",
        "artifact_hits": 0,
        "artifact_misses": 0,
        "cached_bytes": 0,
        "uncached_bytes": 0,
        "cacheable_bytes": 0,
        "memory_hits": 0,
        "persistent_hits": 0,
        "network_misses": 0,
    }

def reset_cache_stats(index: dict[str, Any]) -> None:
    index["cache_stats"] = new_cache_stats()

def record_cache(index: dict[str, Any], hit: bool, bytes_count: int) -> None:
    stats = index.setdefault("cache_stats", new_cache_stats())
    safe_bytes = max(0, int(bytes_count or 0))
    stats["cacheable_bytes"] += safe_bytes
    if hit:
        stats["artifact_hits"] += 1
        stats["cached_bytes"] += safe_bytes
        stats["memory_hits"] = int(stats.get("memory_hits") or 0) + 1
    else:
        stats["artifact_misses"] += 1
        stats["uncached_bytes"] += safe_bytes
        stats["network_misses"] = int(stats.get("network_misses") or 0) + 1

def cache_snapshot(index: dict[str, Any]) -> dict[str, Any]:
    return dict(index.get("cache_stats") or new_cache_stats())

def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)

def artifact_payload(manifest: dict[str, Any], name: str) -> Any:
    entry = manifest.get("artifacts", {}).get(name)
    if not isinstance(entry, dict) or not entry.get("path"):
        raise FileNotFoundError(f"manifest.artifacts.{name}.path is missing")
    return read_json(PUBLIC_ROOT / str(entry["path"]))

def load_index() -> dict[str, Any]:
    manifest = read_json(PUBLIC_INDEX_DIR / "manifest.json")
    return {
        "manifest": manifest,
        "source_registry": artifact_payload(manifest, "source_registry"),
        "global_query_directory": artifact_payload(manifest, "global_query_directory"),
        "aliases": artifact_payload(manifest, "query_aliases"),
        "source_manifest_cache": {},
        "local_light_cache": {},
        "local_body_cache": {},
        "shard_filter_cache": {},
        "proof_catalog_cache": {},
        "hot_query_fast_start_cache": {},
        "hot_query_initial_certificate_cache": {},
        "hot_query_proof_directory_cache": {},
        "hot_query_top_proof_cache": {},
        "hot_query_proof_cache": {},
        "full_shard_cache": {},
        "cache_stats": new_cache_stats(),
    }

def source_entries_by_id(index: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(item["source_id"]): item
        for item in index["source_registry"]["sources"]
    }

def load_source_manifest(index: dict[str, Any], source_id: str) -> dict[str, Any] | None:
    cache = index["source_manifest_cache"]
    if source_id in cache:
        entry = source_entries_by_id(index).get(source_id)
        record_cache(index, True, int((entry or {}).get("artifact_manifest", {}).get("bytes") or 0))
        return cache[source_id]
    entry = source_entries_by_id(index).get(source_id)
    if not entry:
        return None
    path = PUBLIC_ROOT / str(entry["artifact_manifest"]["path"])
    payload = read_json(path)
    cache[source_id] = payload
    record_cache(index, False, int(entry["artifact_manifest"].get("bytes") or 0))
    return payload

def load_local_light(index: dict[str, Any], ref: dict[str, Any], terms: list[str]) -> dict[str, Any]:
    path = light_index_cache_key(ref)
    artifact = light_index_artifact(ref)
    cache_key = local_light_query_cache_key(path, artifact, terms)
    cache = index["local_light_cache"]
    if cache_key in cache:
        record_cache(index, True, int(artifact.get("bytes") or 0))
        return cache[cache_key]
    if "meta" in artifact and "packed" in artifact:
        payload = read_json(PUBLIC_ROOT / str(artifact["meta"]["path"]))
        packed_terms = unpack_impact_terms((PUBLIC_ROOT / str(artifact["packed"]["path"])).read_bytes(), terms)
        payload["terms"] = packed_terms.get("terms") or {}
        cache[cache_key] = payload
    else:
        cache[cache_key] = read_json(PUBLIC_ROOT / str(artifact["path"]))
    record_cache(index, False, int(artifact.get("bytes") or 0))
    return cache[cache_key]

def local_light_query_cache_key(path: str, artifact: dict[str, Any], terms: list[str]) -> str:
    return path if "packed" not in artifact else f"{path}\0{chr(0).join(sorted(set(terms)))}"

def load_local_body(index: dict[str, Any], ref: dict[str, Any], terms: list[str]) -> dict[str, Any]:
    artifact = body_index_artifact(ref)
    path = str(artifact["path"])
    cache_key = local_body_cache_key(path, terms)
    cache = index["local_body_cache"]
    if cache_key in cache:
        record_cache(index, True, int(artifact.get("bytes") or 0))
        return cache[cache_key]
    cache[cache_key] = unpack_impact_terms((PUBLIC_ROOT / path).read_bytes(), terms) if path.endswith(".bin") else read_json(PUBLIC_ROOT / path)
    record_cache(index, False, int(artifact.get("bytes") or 0))
    return cache[cache_key]

def local_body_cache_key(path: str, terms: list[str]) -> str:
    return path if not path.endswith(".bin") else f"{path}\0{chr(0).join(sorted(set(terms)))}"

def select_local_refs_within_budget(
    refs: list[dict[str, Any]],
    byte_budget: int,
    byte_size,
    minimum_refs: int,
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    selected_bytes = 0
    for ref in refs:
        size = int(byte_size(ref))
        need_minimum_coverage = len(selected) < minimum_refs
        if not need_minimum_coverage and selected and selected_bytes + size > byte_budget:
            continue
        selected.append(ref)
        selected_bytes += size
    return selected or refs[:1]

def unique_local_refs(refs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()
    for ref in refs:
        index_id = str(ref.get("index_id") or "")
        if index_id in seen:
            continue
        seen.add(index_id)
        selected.append(ref)
    return selected

def body_index_artifact(ref: dict[str, Any]) -> dict[str, Any]:
    packed = ref.get("body_index_packed")
    if isinstance(packed, dict) and packed.get("path"):
        return packed
    raise ValueError(f"local index missing packed body artifact: {ref.get('index_id')}")

def light_index_artifact(ref: dict[str, Any]) -> dict[str, Any]:
    meta = ref.get("light_index_meta")
    packed = ref.get("light_index_packed")
    if isinstance(meta, dict) and meta.get("path") and isinstance(packed, dict) and packed.get("path"):
        return {
            "bytes": int(meta.get("bytes") or 0) + int(packed.get("bytes") or 0),
            "meta": meta,
            "packed": packed,
            "path": light_index_cache_key(ref),
        }
    raise KeyError(f"local index missing split light artifacts: {ref.get('index_id')}")

def light_index_cache_key(ref: dict[str, Any]) -> str:
    meta = ref.get("light_index_meta")
    packed = ref.get("light_index_packed")
    if isinstance(meta, dict) and meta.get("path") and isinstance(packed, dict) and packed.get("path"):
        return f"{meta['path']}|{packed['path']}"
    raise KeyError(f"local index missing split light artifacts: {ref.get('index_id')}")

def load_shard_filter(index: dict[str, Any], source_manifest: dict[str, Any]) -> dict[str, Any]:
    path = str(source_manifest["artifacts"]["shard_filter"]["path"])
    cache = index["shard_filter_cache"]
    bytes_count = int(source_manifest["artifacts"]["shard_filter"].get("bytes") or 0)
    if path in cache:
        record_cache(index, True, bytes_count)
        return cache[path]
    payload = read_json(PUBLIC_ROOT / path)
    record_cache(index, False, bytes_count)
    if isinstance(payload, dict) and payload.get("version") == "sitegraph-shard-filter-parts-v1":
        merged: dict[str, Any] = {}
        for part in payload.get("parts") or []:
            if not isinstance(part, dict) or not part.get("path"):
                raise ValueError(f"invalid shard_filter part reference: {path}")
            part_path = str(part["path"])
            part_payload = read_json(PUBLIC_ROOT / part_path)
            record_cache(index, False, int(part.get("bytes") or 0))
            entries = part_payload.get("entries") if isinstance(part_payload, dict) else None
            if not isinstance(entries, dict):
                raise ValueError(f"invalid shard_filter part payload: {part_path}")
            merged.update(entries)
        if len(merged) != int(payload.get("entry_count") or -1):
            raise ValueError(f"shard_filter part count mismatch: {path}")
        payload = merged
    cache[path] = payload
    return cache[path]

def load_proof_catalog(index: dict[str, Any], source_manifest: dict[str, Any]) -> dict[str, Any]:
    path = str(source_manifest["artifacts"]["proof_catalog"]["path"])
    cache = index["proof_catalog_cache"]
    bytes_count = int(source_manifest["artifacts"]["proof_catalog"].get("bytes") or 0)
    if path in cache:
        record_cache(index, True, bytes_count)
        return cache[path]
    cache[path] = read_json(PUBLIC_ROOT / path)
    record_cache(index, False, bytes_count)
    return cache[path]

def load_shard(index: dict[str, Any], path: str, bytes_count: int = 0) -> list[dict[str, Any]]:
    cache = index["full_shard_cache"]
    if path in cache:
        record_cache(index, True, bytes_count)
        return cache[path]
    payload = read_json(PUBLIC_ROOT / path)
    cache[path] = payload
    record_cache(index, False, bytes_count)
    return payload

def source_id_for(item: dict[str, Any]) -> str:
    if item.get("source_id"):
        return str(item["source_id"])
    provenance = item.get("provenance") if isinstance(item.get("provenance"), dict) else {}
    if provenance.get("site_id"):
        return str(provenance["site_id"])
    return str(item.get("id") or "").split("-", 1)[0]

def first_screen_bytes(index: dict[str, Any]) -> int:
    artifacts = index["manifest"]["artifacts"]
    manifest_bytes = (PUBLIC_INDEX_DIR / "manifest.json").stat().st_size
    return manifest_bytes + sum(int(artifacts[name]["bytes"]) for name in ("source_registry", "global_query_directory", "query_aliases"))
