from __future__ import annotations

from typing import Any

from .public_artifacts import ensure_public_hashed_path, fail, read_json


def expand_local_index_parts(source_manifest: dict[str, Any]) -> dict[str, Any]:
    if source_manifest.get("local_indexes"):
        return source_manifest
    source_id = str(source_manifest.get("source_id") or "")
    entry = (source_manifest.get("artifacts") or {}).get("local_indexes")
    if not isinstance(entry, dict) or not entry.get("path"):
        fail(f"source {source_id} missing artifact local_indexes")
    path = ensure_public_hashed_path(str(entry["path"]), f"source {source_id} artifact local_indexes")
    manifest = read_json(path)
    if manifest.get("version") != "sitegraph-local-index-parts-v1":
        fail(f"source {source_id} local_indexes manifest has invalid version")
    if manifest.get("source_id") != source_id:
        fail(f"source {source_id} local_indexes manifest source_id mismatch")
    refs: list[dict[str, Any]] = []
    for part in manifest.get("parts") or []:
        if not isinstance(part, dict) or not part.get("path"):
            fail(f"source {source_id} local_indexes part is invalid")
        part_payload = read_json(ensure_public_hashed_path(str(part["path"]), f"source {source_id} local_indexes part"))
        if part_payload.get("version") != "sitegraph-local-index-part-v1":
            fail(f"source {source_id} local_indexes part has invalid version")
        if part_payload.get("source_id") != source_id:
            fail(f"source {source_id} local_indexes part source_id mismatch")
        records = part_payload.get("records")
        if not isinstance(records, list):
            fail(f"source {source_id} local_indexes part records must be a list")
        refs.extend(item for item in records if isinstance(item, dict))
    if len(refs) != int(manifest.get("record_count") or -1):
        fail(f"source {source_id} local_indexes record_count mismatch")
    return {**source_manifest, "local_indexes": refs}


def load_source_manifests(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    source_manifests = ((manifest.get("sitegraph") or {}).get("source_manifests") or {})
    if not isinstance(source_manifests, dict) or not source_manifests:
        fail("manifest.sitegraph.source_manifests must declare routed source manifests")
    payloads: list[dict[str, Any]] = []
    for source_id, entry in source_manifests.items():
        if not isinstance(entry, dict) or not entry.get("path"):
            fail(f"source manifest entry missing path: {source_id}")
        payload = read_json(ensure_public_hashed_path(str(entry["path"]), f"source_manifest.{source_id}"))
        if payload.get("source_id") != source_id:
            fail(f"source manifest source_id mismatch: {source_id}")
        payloads.append(expand_local_index_parts(payload))
    return payloads


def expand_proof_catalog_parts(source_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get("version") != "sitegraph-proof-ledger-catalog-parts-v1":
        return payload
    if payload.get("source_id") != source_id:
        fail(f"source {source_id} proof catalog parts source_id mismatch")
    shards: list[dict[str, Any]] = []
    for part in payload.get("parts") or []:
        if not isinstance(part, dict) or not part.get("path"):
            fail(f"source {source_id} proof catalog part is invalid")
        part_payload = read_json(ensure_public_hashed_path(str(part["path"]), f"source {source_id} proof_catalog part"))
        if part_payload.get("version") != "sitegraph-proof-ledger-catalog-part-v1":
            fail(f"source {source_id} proof catalog part has unexpected version")
        if part_payload.get("source_id") != source_id:
            fail(f"source {source_id} proof catalog part source_id mismatch")
        part_shards = part_payload.get("shards")
        if not isinstance(part_shards, list):
            fail(f"source {source_id} proof catalog part shards must be a list")
        shards.extend(item for item in part_shards if isinstance(item, dict))
    if len(shards) != int(payload.get("shard_count") or -1):
        fail(f"source {source_id} proof catalog part count mismatch")
    return {
        "version": payload.get("catalog_version"),
        "source_id": source_id,
        "state_model": payload.get("state_model"),
        "complete_requires_no_states": payload.get("complete_requires_no_states"),
        "covered_fields": payload.get("covered_fields"),
        "shards": shards,
    }


def load_proof_catalogs(source_manifests: list[dict[str, Any]]) -> list[dict[str, Any]]:
    catalogs: list[dict[str, Any]] = []
    for source_manifest in source_manifests:
        source_id = str(source_manifest.get("source_id") or "")
        if "full_shards" in source_manifest:
            fail(f"source {source_id} manifest must not embed full_shards; use proof_catalog")
        entry = source_manifest.get("artifacts", {}).get("proof_catalog")
        if not isinstance(entry, dict) or not entry.get("path"):
            fail(f"source {source_id} missing artifact proof_catalog")
        payload = read_json(ensure_public_hashed_path(str(entry["path"]), f"source {source_id} artifact proof_catalog"))
        payload = expand_proof_catalog_parts(source_id, payload)
        if payload.get("version") != "sitegraph-proof-ledger-catalog-v2":
            fail(f"source {source_id} proof catalog has unexpected version")
        if payload.get("source_id") != source_id:
            fail(f"source {source_id} proof catalog source_id mismatch")
        if not {"pending", "failed"} <= set(payload.get("complete_requires_no_states") or []):
            fail(f"source {source_id} proof catalog must reject completion with pending or failed states")
        catalogs.append(payload)
    return catalogs


def proof_catalog_shards(proof_catalogs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    shards: list[dict[str, Any]] = []
    for catalog in proof_catalogs:
        catalog_shards = catalog.get("shards")
        if not isinstance(catalog_shards, list) or not catalog_shards:
            fail(f"proof catalog has no shards: {catalog.get('source_id')}")
        shards.extend(catalog_shards)
    return shards
