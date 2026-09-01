from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .identity import normalize_location, stable_id
from .model import SPACE_FORMAT, canonical_bytes, sha256


def write_test_space_snapshot(root: Path, labels: list[str]) -> Path:
    """Write a minimal current-format SpaceSnapshot for producer contract tests."""
    root.mkdir(parents=True, exist_ok=True)
    source_id = "1" * 64
    campus_id = stable_id("campus-", "仙林")
    building_id = stable_id("building-", campus_id, "教2")
    floors: dict[str, dict[str, Any]] = {}
    families: list[dict[str, Any]] = []
    units: list[dict[str, Any]] = []
    aliases: list[dict[str, Any]] = []
    for label in labels:
        normalized = normalize_location(label)
        room = normalized.split("-", 1)[1]
        level = room[0]
        floor_id = stable_id("floor-", building_id, level)
        family_id = stable_id("space-family-", building_id, floor_id, room)
        unit_id = stable_id("space-unit-", family_id, normalized)
        floors.setdefault(floor_id, {
            "floor_id": floor_id, "building_id": building_id, "level": level,
            "outline": None, "local_coordinate_system": "schematic-normalized-image",
            "north_rotation_degrees": None, "north_confidence": "unknown",
            "space_unit_ids": [], "connector_ids": [], "source_image_refs": [],
            "geometry_accuracy": "missing", "geometry_path": None,
        })["space_unit_ids"].append(unit_id)
        families.append({
            "space_family_id": family_id, "building_id": building_id, "floor_id": floor_id,
            "room_number": room, "aliases": [normalized], "space_unit_ids": [unit_id],
            "evidence_status": "confirmed", "availability_eligible": "eligible",
        })
        units.append({
            "space_unit_id": unit_id, "space_family_id": family_id, "canonical_label": normalized,
            "raw_labels": [normalized], "space_type": "classroom", "availability_eligible": "eligible",
            "geometry_confidence": "missing", "identity_confidence": "confirmed", "evidence_refs": ["test"],
        })
        aliases.append({
            "alias": normalized, "normalized_alias": normalized, "sources": ["test"], "status": "resolved",
            "space_family_id": family_id, "space_unit_id": unit_id,
        })
    floor_values = sorted(floors.values(), key=lambda item: item["level"])
    for floor in floor_values:
        floor["space_unit_ids"].sort()
    documents: dict[str, Any] = {
        "campuses.json": {"format": "njupt-space-campuses", "source_id": source_id, "campuses": [{
            "campus_id": campus_id, "name": "仙林", "aliases": [], "coordinate_system": "schematic",
            "point": [0.5, 0.5], "footprint": None, "geometry_accuracy": "schematic", "evidence_refs": ["test"],
        }]},
        "buildings.json": {"format": "njupt-space-buildings", "source_id": source_id, "buildings": [{
            "building_id": building_id, "campus_id": campus_id, "name": "教2", "aliases": [], "point": None,
            "footprint": None, "floor_ids": [item["floor_id"] for item in floor_values],
            "geometry_accuracy": "missing", "evidence_refs": ["test"],
        }]},
        "floors.json": {"format": "njupt-space-floors", "source_id": source_id, "floors": floor_values},
        "space-families.json": {"format": "njupt-space-families", "source_id": source_id, "space_families": families},
        f"space-units-{building_id}.json": {"format": "njupt-space-units", "source_id": source_id, "space_units": units},
        "aliases.json": {"format": "njupt-space-aliases", "source_id": source_id, "aliases": aliases},
        "connectors.json": {"format": "njupt-space-connectors", "source_id": source_id, "connectors": []},
        "audit.json": {"format": "njupt-space-audit", "source_id": source_id, "audit": {"fixture": True}},
    }
    for relative, payload in documents.items():
        (root / relative).write_bytes(canonical_bytes(payload))
    artifact = lambda relative: {
        "path": relative,
        "bytes": (root / relative).stat().st_size,
        "sha256": sha256((root / relative).read_bytes()),
    }
    unit_path = f"space-units-{building_id}.json"
    identity = {
        "format": SPACE_FORMAT, "source_id": source_id, "campus_count": 1, "building_count": 1,
        "floor_count": len(floor_values), "space_family_count": len(families), "space_unit_count": len(units),
        "geometry_unit_count": 0, "unresolved_count": 0,
        "artifacts": {
            "campuses": artifact("campuses.json"), "buildings": artifact("buildings.json"),
            "floors": artifact("floors.json"), "space_families": artifact("space-families.json"),
            "space_units": [artifact(unit_path)], "aliases": artifact("aliases.json"),
            "connectors": artifact("connectors.json"), "geometry": [], "audit": artifact("audit.json"),
        },
    }
    manifest = {**identity, "snapshot_id": sha256(canonical_bytes(identity))}
    (root / "manifest.json").write_bytes(canonical_bytes(manifest))
    return root
