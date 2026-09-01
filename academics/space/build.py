from __future__ import annotations

import json
import shutil
import uuid
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

from academics.exam.snapshot.model import load_exam_snapshot
from academics.timetable.model import load_teaching_schedule_source

from .identity import (
    family_room_for,
    is_non_physical_location,
    normalize_location,
    normalize_space_text,
    parse_space_location,
    stable_id,
)
from .model import SPACE_FORMAT, SpaceSnapshotError, canonical_bytes, load_space_snapshot, sha256


REVIEW_FORMAT = "njupt-reviewed-floor-plan-geometry"
SCHEMATIC_CAMPUS_POINTS = {
    "三牌楼": [0.2, 0.5],
    "锁金": [0.5, 0.5],
    "仙林": [0.8, 0.5],
}


def _write_json(path: Path, value: Any, *, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        if pretty:
            json.dump(value, handle, ensure_ascii=False, sort_keys=True, indent=2)
            handle.write("\n")
        else:
            json.dump(value, handle, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _artifact(root: Path, relative: str) -> dict[str, Any]:
    content = (root / relative).read_bytes()
    return {"path": relative, "bytes": len(content), "sha256": sha256(content)}


def _read_review(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SpaceSnapshotError(f"Reviewed floor geometry is invalid: {path}") from exc
    if not isinstance(payload, dict) or payload.get("format") != REVIEW_FORMAT or not isinstance(payload.get("floors"), list):
        raise SpaceSnapshotError("Reviewed floor geometry has an incompatible format")
    if len(payload["floors"]) != 22:
        raise SpaceSnapshotError("The current reviewed intake must contain all 22 floor plans")
    return payload


def _room_from_printed_label(building: str, raw_label: str) -> str | None:
    normalized = normalize_location(raw_label)
    if "-" not in normalized:
        return None
    prefix, room = normalized.split("-", 1)
    expected_prefix = building.removeprefix("教")
    if prefix != expected_prefix:
        return None
    return room


def _stable_sources(values: Iterable[str]) -> list[str]:
    return sorted({normalize_space_text(value) for value in values if normalize_space_text(value)})


def _compile(
    *,
    output_dir: Path,
    reviewed_geometry_path: Path,
    teaching_source_path: Path,
    exam_snapshot_path: Path,
) -> dict[str, Any]:
    review = _read_review(reviewed_geometry_path)
    teaching = load_teaching_schedule_source(teaching_source_path)
    exam = load_exam_snapshot(exam_snapshot_path)

    normalized_review = {
        "floors": [
            {
                "campus": floor["campus"],
                "building": floor["building"],
                "floor": floor["floor"],
                "source_image_sha256": floor["source_image_sha256"],
                "image_width": floor["image_width"],
                "image_height": floor["image_height"],
                "orientation": floor["orientation"],
                "north_rotation_degrees": floor["north_rotation_degrees"],
                "north_confidence": floor["north_confidence"],
                "geometry_accuracy": floor["geometry_accuracy"],
                "units": [
                    {
                        key: unit.get(key)
                        for key in (
                            "region_id", "raw_label", "observation_status", "space_key",
                            "label_occurrence", "label_occurrence_count_on_floor",
                            "geometry_binding", "label_point", "polygon", "geometry_status",
                            "geometry_rejection",
                        )
                    }
                    for unit in floor["units"]
                ],
            }
            for floor in review["floors"]
        ],
        "anomalies": review.get("anomalies", []),
    }
    source_identity = {
        "format": "njupt-space-source-identity",
        "review": normalized_review,
        "teaching_source_id": teaching.source_id,
        "exam_snapshot_id": exam.snapshot_id,
        "schematic_campus_layout": SCHEMATIC_CAMPUS_POINTS,
    }
    source_id = sha256(canonical_bytes(source_identity))

    campuses: dict[str, dict[str, Any]] = {}
    buildings: dict[tuple[str, str], dict[str, Any]] = {}
    floors: dict[tuple[str, str, str], dict[str, Any]] = {}
    families: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    units: dict[str, dict[str, Any]] = {}
    units_by_exact_room: dict[tuple[str, str, str, str], list[str]] = defaultdict(list)
    family_evidence: dict[str, set[str]] = defaultdict(set)
    family_usage: dict[str, set[str]] = defaultdict(set)
    geometry_by_floor: dict[str, list[dict[str, Any]]] = defaultdict(list)
    aliases_by_text: dict[str, dict[str, Any]] = {}
    image_reviews: list[dict[str, Any]] = []

    def ensure_campus(name: str) -> dict[str, Any]:
        canonical = normalize_space_text(name)
        campus_id = stable_id("campus-", canonical)
        if campus_id not in campuses:
            campuses[campus_id] = {
                "campus_id": campus_id,
                "name": canonical,
                "aliases": [],
                "coordinate_system": "schematic",
                "point": SCHEMATIC_CAMPUS_POINTS.get(canonical),
                "footprint": None,
                "geometry_accuracy": "schematic" if canonical in SCHEMATIC_CAMPUS_POINTS else "missing",
                "evidence_refs": ["teaching-system"],
            }
        return campuses[campus_id]

    def ensure_building(campus_name: str, building_name: str) -> dict[str, Any]:
        campus = ensure_campus(campus_name)
        key = (campus["campus_id"], normalize_space_text(building_name))
        if key not in buildings:
            building_id = stable_id("building-", campus["campus_id"], key[1])
            buildings[key] = {
                "building_id": building_id,
                "campus_id": campus["campus_id"],
                "name": key[1],
                "aliases": [],
                "point": None,
                "footprint": None,
                "floor_ids": [],
                "geometry_accuracy": "missing",
                "evidence_refs": [],
            }
        return buildings[key]

    def ensure_floor(campus_name: str, building_name: str, level: str) -> dict[str, Any]:
        building = ensure_building(campus_name, building_name)
        key = (building["campus_id"], building["building_id"], normalize_space_text(level))
        if key not in floors:
            floor_id = stable_id("floor-", building["building_id"], key[2])
            floors[key] = {
                "floor_id": floor_id,
                "building_id": building["building_id"],
                "level": key[2],
                "outline": None,
                "local_coordinate_system": "unavailable",
                "north_rotation_degrees": None,
                "north_confidence": "unknown",
                "space_unit_ids": [],
                "connector_ids": [],
                "source_image_refs": [],
                "geometry_accuracy": "missing",
                "geometry_path": None,
            }
            building["floor_ids"].append(floor_id)
        return floors[key]

    def ensure_family(campus_name: str, building_name: str, level: str, room: str) -> dict[str, Any]:
        floor = ensure_floor(campus_name, building_name, level)
        building = next(value for value in buildings.values() if value["building_id"] == floor["building_id"])
        family_room = family_room_for(room)
        key = (building["campus_id"], building["building_id"], floor["floor_id"], family_room)
        if key not in families:
            family_id = stable_id("space-family-", building["building_id"], floor["floor_id"], family_room)
            families[key] = {
                "space_family_id": family_id,
                "building_id": building["building_id"],
                "floor_id": floor["floor_id"],
                "room_number": family_room,
                "aliases": [],
                "space_unit_ids": [],
                "evidence_status": "unresolved",
                "availability_eligible": "unknown",
            }
        return families[key]

    def ensure_unit(
        *,
        family: dict[str, Any],
        canonical_label: str,
        raw_labels: list[str],
        occurrence: int,
        identity_confidence: str,
        evidence_refs: list[str],
    ) -> dict[str, Any]:
        unit_id = stable_id("space-unit-", family["space_family_id"], canonical_label, occurrence)
        if unit_id not in units:
            units[unit_id] = {
                "space_unit_id": unit_id,
                "space_family_id": family["space_family_id"],
                "canonical_label": canonical_label,
                "raw_labels": _stable_sources(raw_labels),
                "space_type": "unknown",
                "availability_eligible": "unknown",
                "geometry_confidence": "missing",
                "identity_confidence": identity_confidence,
                "evidence_refs": _stable_sources(evidence_refs),
            }
            family["space_unit_ids"].append(unit_id)
        return units[unit_id]

    for floor_review in review["floors"]:
        campus_name = normalize_space_text(floor_review["campus"])
        building_name = normalize_space_text(floor_review["building"])
        level = str(floor_review["floor"])
        floor = ensure_floor(campus_name, building_name, level)
        building = next(value for value in buildings.values() if value["building_id"] == floor["building_id"])
        building["evidence_refs"] = _stable_sources([*building["evidence_refs"], floor_review["source_image_sha256"]])
        building["geometry_accuracy"] = "schematic"
        floor.update({
            "local_coordinate_system": "source_image_normalized_top_left",
            "north_rotation_degrees": floor_review.get("north_rotation_degrees"),
            "north_confidence": floor_review.get("north_confidence", "unknown"),
            "source_image_refs": [{
                "sha256": floor_review["source_image_sha256"],
                "review_status": "manually_reviewed",
            }],
            "geometry_accuracy": "schematic_from_evacuation_plan",
        })
        geometry_path = f"geometry-{floor['floor_id']}.json"
        floor["geometry_path"] = geometry_path
        geometry_counts = Counter()
        for reviewed_unit in floor_review["units"]:
            room = _room_from_printed_label(building_name, reviewed_unit["raw_label"])
            if room is None:
                geometry_by_floor[floor["floor_id"]].append({
                    "space_unit_id": stable_id("unresolved-region-", reviewed_unit["region_id"]),
                    "geometry_status": "identity_unresolved",
                    "label_point": reviewed_unit.get("label_point"),
                    "polygon": reviewed_unit.get("polygon"),
                })
                geometry_counts["identity_unresolved"] += 1
                continue
            family = ensure_family(campus_name, building_name, level, room)
            family_evidence[family["space_family_id"]].add("floor_plan")
            canonical_label = f"{building_name}-{room}"
            unit = ensure_unit(
                family=family,
                canonical_label=canonical_label,
                raw_labels=[reviewed_unit["raw_label"]],
                occurrence=int(reviewed_unit["label_occurrence"]),
                identity_confidence="high" if reviewed_unit["observation_status"] == "confirmed_context_label" else "ambiguous",
                evidence_refs=[floor_review["source_image_sha256"], reviewed_unit["region_id"]],
            )
            exact_key = (campus_name, building_name, level, room.upper())
            units_by_exact_room[exact_key].append(unit["space_unit_id"])
            floor["space_unit_ids"].append(unit["space_unit_id"])
            status = reviewed_unit.get("geometry_status", "missing")
            if reviewed_unit.get("polygon") is not None:
                unit["geometry_confidence"] = "reviewed_schematic"
            elif reviewed_unit.get("label_point") is not None:
                unit["geometry_confidence"] = "reviewed_label_point"
            geometry_by_floor[floor["floor_id"]].append({
                "space_unit_id": unit["space_unit_id"],
                "geometry_status": status,
                "label_point": reviewed_unit.get("label_point"),
                "polygon": reviewed_unit.get("polygon"),
            })
            geometry_counts[status] += 1
        image_reviews.append({
            "campus": campus_name,
            "building": building_name,
            "floor": level,
            "source_image_sha256": floor_review["source_image_sha256"],
            "image_width": floor_review["image_width"],
            "image_height": floor_review["image_height"],
            "orientation": floor_review["orientation"],
            "north_rotation_degrees": floor_review.get("north_rotation_degrees"),
            "north_confidence": floor_review.get("north_confidence", "unknown"),
            "geometry_accuracy": "schematic_from_evacuation_plan",
            "labeled_region_count": len(floor_review["units"]),
            "geometry_status_counts": dict(sorted(geometry_counts.items())),
            "review_status": "manually_reviewed",
        })

    def register_location(*, domain: str, campus: Any, location: Any) -> None:
        raw = normalize_space_text(location)
        normalized = normalize_location(raw)
        if not raw:
            return
        alias = aliases_by_text.setdefault(normalized, {
            "alias": raw,
            "normalized_alias": normalized,
            "sources": [],
            "status": "unresolved",
            "space_family_id": None,
            "space_unit_id": None,
        })
        alias["sources"] = _stable_sources([*alias["sources"], domain])
        if is_non_physical_location(raw):
            alias["status"] = "non_physical"
            return
        parsed = parse_space_location(campus=campus, location=raw)
        if parsed is None:
            alias["status"] = "unresolved"
            return
        family = ensure_family(parsed.campus, parsed.building, parsed.floor, parsed.family_room)
        family_evidence[family["space_family_id"]].add(domain)
        family_usage[family["space_family_id"]].add(domain)
        family["availability_eligible"] = "eligible"
        family["aliases"] = _stable_sources([*family["aliases"], raw, parsed.normalized_location])
        exact_key = (parsed.campus, parsed.building, parsed.floor, parsed.room.upper())
        exact_units = units_by_exact_room.get(exact_key, [])
        if not exact_units and parsed.room == parsed.family_room and len(family["space_unit_ids"]) == 1:
            exact_units = list(family["space_unit_ids"])
        if not family["space_unit_ids"]:
            unit = ensure_unit(
                family=family,
                canonical_label=f"{parsed.building}-{parsed.room}",
                raw_labels=[raw],
                occurrence=1,
                identity_confidence="high",
                evidence_refs=[domain],
            )
            exact_units = [unit["space_unit_id"]]
            units_by_exact_room[exact_key].append(unit["space_unit_id"])
            floor = ensure_floor(parsed.campus, parsed.building, parsed.floor)
            floor["space_unit_ids"].append(unit["space_unit_id"])
        alias["space_family_id"] = family["space_family_id"]
        if len(exact_units) == 1:
            alias["status"] = "resolved"
            alias["space_unit_id"] = exact_units[0]
            units[exact_units[0]]["space_type"] = "teaching_space"
            units[exact_units[0]]["availability_eligible"] = "eligible"
            units[exact_units[0]]["evidence_refs"] = _stable_sources([*units[exact_units[0]]["evidence_refs"], domain])
        else:
            alias["status"] = "ambiguous"

    for schedule in teaching.schedules:
        if schedule["status"] not in {"success", "empty"}:
            continue
        for meeting in schedule["meetings"]:
            register_location(domain="teaching", campus=meeting.get("campus"), location=meeting.get("location"))
    for record in exam.records:
        register_location(domain="exam", campus=record.get("campus"), location=record.get("location"))

    for family in families.values():
        evidence = family_evidence[family["space_family_id"]]
        used = family_usage[family["space_family_id"]]
        if "floor_plan" in evidence and used:
            family["evidence_status"] = "floor_plan_and_schedule"
        elif "floor_plan" in evidence:
            family["evidence_status"] = "floor_plan_only"
        elif used:
            family["evidence_status"] = "schedule_only_geometry_missing"
        else:
            family["evidence_status"] = "unresolved"
        family["space_unit_ids"] = sorted(set(family["space_unit_ids"]))
    for building in buildings.values():
        building["floor_ids"] = sorted(set(building["floor_ids"]))
        if not building["evidence_refs"]:
            building["evidence_refs"] = ["teaching-or-exam-system"]
    for floor in floors.values():
        floor["space_unit_ids"] = sorted(set(floor["space_unit_ids"]))

    campus_values = sorted(campuses.values(), key=lambda item: (item["name"], item["campus_id"]))
    building_values = sorted(buildings.values(), key=lambda item: (item["campus_id"], item["name"], item["building_id"]))
    floor_values = sorted(floors.values(), key=lambda item: (item["building_id"], item["level"], item["floor_id"]))
    family_values = sorted(families.values(), key=lambda item: (item["building_id"], item["floor_id"], item["room_number"], item["space_family_id"]))
    unit_values = sorted(units.values(), key=lambda item: (item["space_family_id"], item["canonical_label"], item["space_unit_id"]))
    alias_values = sorted(aliases_by_text.values(), key=lambda item: item["normalized_alias"])

    documents = {
        "campuses.json": {"format": "njupt-space-campuses", "source_id": source_id, "campuses": campus_values},
        "buildings.json": {"format": "njupt-space-buildings", "source_id": source_id, "buildings": building_values},
        "floors.json": {"format": "njupt-space-floors", "source_id": source_id, "floors": floor_values},
        "space-families.json": {"format": "njupt-space-families", "source_id": source_id, "space_families": family_values},
        "aliases.json": {"format": "njupt-space-aliases", "source_id": source_id, "aliases": alias_values},
        "connectors.json": {"format": "njupt-space-connectors", "source_id": source_id, "connectors": []},
    }
    for relative, document in documents.items():
        _write_json(output_dir / relative, document)

    unit_refs: list[dict[str, Any]] = []
    units_by_building: dict[str, list[dict[str, Any]]] = defaultdict(list)
    family_by_id = {family["space_family_id"]: family for family in family_values}
    for unit in unit_values:
        units_by_building[family_by_id[unit["space_family_id"]]["building_id"]].append(unit)
    for building_id, values in sorted(units_by_building.items()):
        relative = f"space-units-{building_id}.json"
        _write_json(output_dir / relative, {"format": "njupt-space-units", "source_id": source_id, "space_units": values})
        unit_refs.append(_artifact(output_dir, relative))

    geometry_refs: list[dict[str, Any]] = []
    floor_by_id = {floor["floor_id"]: floor for floor in floor_values}
    valid_unit_ids = set(units)
    unresolved_geometry_regions = 0
    for floor_id, values in sorted(geometry_by_floor.items()):
        public_values = [value for value in values if value["space_unit_id"] in valid_unit_ids]
        unresolved_geometry_regions += len(values) - len(public_values)
        floor = floor_by_id[floor_id]
        relative = f"geometry-{floor_id}.json"
        _write_json(output_dir / relative, {
            "format": "njupt-space-geometry",
            "source_id": source_id,
            "floor_id": floor_id,
            "coordinate_system": floor["local_coordinate_system"],
            "geometry_accuracy": floor["geometry_accuracy"],
            "space_units": public_values,
        })
        geometry_refs.append(_artifact(output_dir, relative))

    unresolved_aliases = [alias for alias in alias_values if alias["status"] in {"ambiguous", "unresolved"}]
    geometry_status = Counter(
        item["geometry_status"]
        for values in geometry_by_floor.values()
        for item in values
        if item["space_unit_id"] in valid_unit_ids
    )
    audit = {
        "image_reviews": image_reviews,
        "floor_plan_anomalies": review.get("anomalies", []),
        "locations": {
            "total_aliases": len(alias_values),
            "resolved": sum(alias["status"] == "resolved" for alias in alias_values),
            "ambiguous": sum(alias["status"] == "ambiguous" for alias in alias_values),
            "non_physical": sum(alias["status"] == "non_physical" for alias in alias_values),
            "unresolved": sum(alias["status"] == "unresolved" for alias in alias_values),
        },
        "geometry": {
            "status_counts": dict(sorted(geometry_status.items())),
            "unresolved_identity_regions": unresolved_geometry_regions,
            "connectors": "not_reconstructed_without_sufficient_verified_door_and_vertical_topology",
            "north_alignment": "unknown_where_the_source_plan_does_not_prove_north",
        },
        "unresolved_aliases": unresolved_aliases,
        "limitations": [
            "Campus points are explicitly schematic and are not geographic coordinates.",
            "Floor geometry is normalized to each photographed plan and is not survey-grade CAD.",
            "Fire-safety symbols, routes, QR codes and location markers are not published.",
            "A missing occupancy record is not proof that a room is physically available.",
        ],
        "teaching_source_id": teaching.source_id,
        "exam_snapshot_id": exam.snapshot_id,
    }
    _write_json(output_dir / "audit.json", {"format": "njupt-space-audit", "source_id": source_id, "audit": audit})

    artifacts = {
        "campuses": _artifact(output_dir, "campuses.json"),
        "buildings": _artifact(output_dir, "buildings.json"),
        "floors": _artifact(output_dir, "floors.json"),
        "space_families": _artifact(output_dir, "space-families.json"),
        "space_units": unit_refs,
        "aliases": _artifact(output_dir, "aliases.json"),
        "connectors": _artifact(output_dir, "connectors.json"),
        "geometry": geometry_refs,
        "audit": _artifact(output_dir, "audit.json"),
    }
    identity = {
        "format": SPACE_FORMAT,
        "source_id": source_id,
        "campus_count": len(campus_values),
        "building_count": len(building_values),
        "floor_count": len(floor_values),
        "space_family_count": len(family_values),
        "space_unit_count": len(unit_values),
        "geometry_unit_count": sum(item["polygon"] is not None for values in geometry_by_floor.values() for item in values if item["space_unit_id"] in valid_unit_ids),
        "unresolved_count": len(unresolved_aliases) + unresolved_geometry_regions,
        "artifacts": artifacts,
    }
    manifest = {**identity, "snapshot_id": sha256(canonical_bytes(identity))}
    _write_json(output_dir / "manifest.json", manifest, pretty=True)
    return manifest


def build_space_snapshot(
    *,
    output_dir: Path,
    reviewed_geometry_path: Path,
    teaching_source_path: Path,
    exam_snapshot_path: Path,
) -> dict[str, Any]:
    output_dir = output_dir.resolve()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = output_dir.parent / f"space.staging-{uuid.uuid4().hex}"
    backup = output_dir.parent / f"space.backup-{uuid.uuid4().hex}"
    staging.mkdir(parents=True)
    moved_old = False
    try:
        manifest = _compile(
            output_dir=staging,
            reviewed_geometry_path=reviewed_geometry_path.resolve(),
            teaching_source_path=teaching_source_path.resolve(),
            exam_snapshot_path=exam_snapshot_path.resolve(),
        )
        loaded = load_space_snapshot(staging)
        if loaded.snapshot_id != manifest["snapshot_id"]:
            raise SpaceSnapshotError("SpaceSnapshot self-validation identity mismatch")
        if output_dir.exists():
            output_dir.replace(backup)
            moved_old = True
        staging.replace(output_dir)
        if moved_old:
            shutil.rmtree(backup)
        return manifest
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        if moved_old and backup.exists() and not output_dir.exists():
            backup.replace(output_dir)
        raise
