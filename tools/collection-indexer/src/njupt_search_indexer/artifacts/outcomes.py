from __future__ import annotations

from pathlib import Path
from typing import Any

from ..sitegraph_artifact_io import artifact_entry, write_hashed_json
from ..sitegraph_text import stable_ascii_slug
from .chunked_json import chunked_list_payloads


def write_outcomes_entry(*, public_root: Path, artifact_dir: Path, outcomes: dict[str, Any]) -> dict[str, Any]:
    families: dict[str, Any] = {}
    scalars: dict[str, Any] = {}
    for family, value in sorted(outcomes.items()):
        if not isinstance(value, list):
            scalars[family] = value
            continue
        part_entries: list[dict[str, Any]] = []
        if any(not isinstance(item, dict) for item in value):
            raise ValueError(f"outcomes.{family} must contain objects only")
        records = value
        for index, chunk in enumerate(chunked_list_payloads(records, wrapper={"version": "sitegraph-outcomes-part-v1", "family": family})):
            part_artifact = write_hashed_json(
                public_root,
                artifact_dir,
                f"outcomes.{stable_ascii_slug(family, fallback='family', max_length=48)}.part{index:03d}",
                {"version": "sitegraph-outcomes-part-v1", "family": family, "records": chunk},
                compact=True,
            )
            part_entries.append(artifact_entry(part_artifact, role="outcomes_part", count=len(chunk), load="audit"))
        families[family] = {
            "record_count": len(records),
            "part_count": len(part_entries),
            "parts": part_entries,
        }
    manifest_payload = {
        "version": "sitegraph-outcomes-manifest-v1",
        "encoding": "chunked-outcomes-v1",
        "families": families,
        "scalars": scalars,
    }
    manifest_artifact = write_hashed_json(public_root, artifact_dir, "outcomes", manifest_payload, compact=True)
    entry = artifact_entry(manifest_artifact, role="outcomes", load="audit")
    entry["runtime_bytes"] = int(entry["bytes"]) + sum(
        int(part["bytes"])
        for family in families.values()
        for part in family["parts"]
    )
    return entry
