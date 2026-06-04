from __future__ import annotations

from pathlib import Path
from typing import Any

from ..sitegraph_artifact_io import artifact_entry, json_bytes, write_hashed_json


DEFAULT_SPLIT_PUBLIC_JSON_TARGET_BYTES = 768 * 1024


def chunked_mapping_payloads(
    entries: dict[str, Any],
    *,
    wrapper: dict[str, Any],
    payload_key: str = "entries",
    target_bytes: int = DEFAULT_SPLIT_PUBLIC_JSON_TARGET_BYTES,
) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    current: dict[str, Any] = {}
    for key, value in sorted(entries.items()):
        candidate = {**current, key: value}
        candidate_payload = {**wrapper, payload_key: candidate}
        if current and len(json_bytes(candidate_payload, compact=True)) > target_bytes:
            chunks.append(current)
            current = {key: value}
        else:
            current = candidate
    if current or not entries:
        chunks.append(current)
    return chunks


def chunked_list_payloads(
    records: list[dict[str, Any]],
    *,
    wrapper: dict[str, Any],
    payload_key: str = "records",
    target_bytes: int = DEFAULT_SPLIT_PUBLIC_JSON_TARGET_BYTES,
) -> list[list[dict[str, Any]]]:
    chunks: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    for record in records:
        candidate = [*current, record]
        candidate_payload = {**wrapper, payload_key: candidate}
        if current and len(json_bytes(candidate_payload, compact=True)) > target_bytes:
            chunks.append(current)
            current = [record]
        else:
            current = candidate
    if current or not records:
        chunks.append(current)
    return chunks


def write_chunked_mapping_entry(
    *,
    public_root: Path,
    directory: Path,
    logical_prefix: str,
    source_id: str,
    entries: dict[str, Any],
    manifest_version: str,
    part_version: str,
    manifest_role: str,
    part_role: str,
    load: str,
) -> dict[str, Any]:
    part_entries: list[dict[str, Any]] = []
    for index, chunk in enumerate(chunked_mapping_payloads(entries, wrapper={"version": part_version, "source_id": source_id})):
        part_artifact = write_hashed_json(
            public_root,
            directory,
            f"{logical_prefix}.{source_id}.part{index:03d}",
            {"version": part_version, "source_id": source_id, "entries": chunk},
            compact=True,
        )
        part_entries.append(artifact_entry(part_artifact, role=part_role, count=len(chunk), load=load))
    manifest_payload = {
        "version": manifest_version,
        "source_id": source_id,
        "encoding": "chunked-json-object-v1",
        "entry_count": len(entries),
        "part_count": len(part_entries),
        "parts": part_entries,
    }
    manifest_artifact = write_hashed_json(public_root, directory, f"{logical_prefix}.{source_id}", manifest_payload, compact=True)
    entry = artifact_entry(manifest_artifact, role=manifest_role, count=len(entries), load=load)
    entry["part_count"] = len(part_entries)
    entry["runtime_bytes"] = int(entry["bytes"]) + sum(int(part["bytes"]) for part in part_entries)
    return entry


def write_chunked_list_entry(
    *,
    public_root: Path,
    directory: Path,
    logical_prefix: str,
    source_id: str,
    records: list[dict[str, Any]],
    manifest_version: str,
    part_version: str,
    manifest_role: str,
    part_role: str,
    load: str,
) -> dict[str, Any]:
    part_entries: list[dict[str, Any]] = []
    for index, chunk in enumerate(chunked_list_payloads(records, wrapper={"version": part_version, "source_id": source_id})):
        part_artifact = write_hashed_json(
            public_root,
            directory,
            f"{logical_prefix}.{source_id}.part{index:03d}",
            {"version": part_version, "source_id": source_id, "records": chunk},
            compact=True,
        )
        part_entries.append(artifact_entry(part_artifact, role=part_role, count=len(chunk), load=load))
    manifest_payload = {
        "version": manifest_version,
        "source_id": source_id,
        "encoding": "chunked-json-list-v1",
        "record_count": len(records),
        "part_count": len(part_entries),
        "parts": part_entries,
    }
    manifest_artifact = write_hashed_json(public_root, directory, f"{logical_prefix}.{source_id}", manifest_payload, compact=True)
    entry = artifact_entry(manifest_artifact, role=manifest_role, count=len(records), load=load)
    entry["part_count"] = len(part_entries)
    entry["runtime_bytes"] = int(entry["bytes"]) + sum(int(part["bytes"]) for part in part_entries)
    return entry
