from __future__ import annotations

import hashlib
import json
import logging
import shutil
import uuid
from pathlib import Path
from typing import Any

from academics.exam.snapshot.model import ExamSnapshot
from academics.space import load_space_snapshot, normalize_location, normalize_space_text


logger = logging.getLogger(__name__)
ROOM_OCCUPANCY_FORMAT = "njupt-room-occupancy"
ROOM_FLOOR_FORMAT = "njupt-room-floor-occupancy"


class RoomOccupancyError(RuntimeError):
    """Fatal exam room occupancy construction failure."""


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _write_json(path: Path, payload: Any, *, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        if pretty:
            json.dump(payload, handle, ensure_ascii=False, sort_keys=True, indent=2)
            handle.write("\n")
        else:
            json.dump(payload, handle, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _artifact_ref(root: Path, relative_path: str) -> dict[str, Any]:
    content = (root / relative_path).read_bytes()
    return {"path": relative_path, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}


def _occupancy_id(identity: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical_bytes(identity)).hexdigest()


def _build(*, output_dir: Path, exam_snapshot: ExamSnapshot, space_snapshot_path: Path) -> dict[str, Any]:
    space = load_space_snapshot(space_snapshot_path)
    aliases = {item["normalized_alias"]: item for item in space.aliases}
    families = space.families_by_id
    floors = {item["floor_id"]: item for item in space.floors}
    buildings = {item["building_id"]: item for item in space.buildings}
    campuses = {item["campus_id"]: item for item in space.campuses}
    by_date_floor: dict[tuple[str, str], list[dict[str, Any]]] = {}
    unresolved: dict[str, int] = {}

    for record in exam_snapshot.records:
        normalized = normalize_location(record.get("location"))
        alias = aliases.get(normalized)
        if alias is None or alias["status"] in {"non_physical", "unresolved"}:
            if normalized:
                unresolved[normalized] = unresolved.get(normalized, 0) + 1
            continue
        family_id = alias.get("space_family_id")
        family = families.get(family_id)
        if family is None:
            raise RoomOccupancyError(f"Exam alias references an unknown SpaceFamily: {normalized}")
        floor = floors[family["floor_id"]]
        building = buildings[family["building_id"]]
        campus = campuses[building["campus_id"]]
        date = normalize_space_text(record.get("date"))
        if not date:
            raise RoomOccupancyError(f"Exam record has no date: {record.get('id')}")
        booking = {
            "exam_id": record["id"],
            "stable_key": record["stable_key"],
            "class_name": record["class_name"],
            "course_name": record["course_name"],
            "course_code": record["course_code"],
            "teacher": record["teacher"],
            "count": record["count"],
            "date": record["date"],
            "start_timestamp": record["start_timestamp"],
            "end_timestamp": record["end_timestamp"],
            "duration_minutes": record["duration_minutes"],
            "location": record["location"],
            "campus": campus["name"],
            "building": building["name"],
            "floor": floor["level"],
            "floor_id": floor["floor_id"],
            "room": family["room_number"],
            "space_family_id": family["space_family_id"],
            "space_unit_id": alias.get("space_unit_id"),
        }
        by_date_floor.setdefault((date, floor["floor_id"]), []).append(booking)

    if unresolved:
        logger.warning(
            "Skipped %d terminal non-physical or unresolved exam locations: %s",
            sum(unresolved.values()),
            json.dumps(unresolved, ensure_ascii=False, sort_keys=True),
        )

    date_entries = []
    for date in sorted({date for date, _ in by_date_floor}):
        floor_artifacts = []
        for floor_id in sorted({floor_id for candidate_date, floor_id in by_date_floor if candidate_date == date}):
            floor = floors[floor_id]
            building = buildings[floor["building_id"]]
            campus = campuses[building["campus_id"]]
            bookings = sorted(
                by_date_floor[(date, floor_id)],
                key=lambda item: (item["start_timestamp"], item["space_family_id"], item["exam_id"]),
            )
            relative_path = f"floors/{date}-{floor_id}.json"
            _write_json(output_dir / relative_path, {
                "format": ROOM_FLOOR_FORMAT,
                "exam_snapshot_id": exam_snapshot.snapshot_id,
                "space_snapshot_id": space.snapshot_id,
                "date": date,
                "campus": campus["name"],
                "building": building["name"],
                "floor": floor["level"],
                "floor_id": floor_id,
                "booking_count": len(bookings),
                "bookings": bookings,
            })
            floor_artifacts.append({
                "floor_id": floor_id,
                "booking_count": len(bookings),
                "artifact": _artifact_ref(output_dir, relative_path),
            })
        date_entries.append({"date": date, "floors": floor_artifacts})

    identity = {
        "format": ROOM_OCCUPANCY_FORMAT,
        "exam_snapshot_id": exam_snapshot.snapshot_id,
        "space_snapshot_id": space.snapshot_id,
        "exam_period_id": exam_snapshot.exam_period_id,
        "source_updated_at": exam_snapshot.source_updated_at,
        "unresolved_locations": [{"location": location, "count": count} for location, count in sorted(unresolved.items())],
        "dates": date_entries,
    }
    manifest = {**identity, "occupancy_id": _occupancy_id(identity)}
    _write_json(output_dir / "manifest.json", manifest, pretty=True)
    return manifest


def _validate_output(output_dir: Path, manifest: dict[str, Any]) -> None:
    identity = {key: value for key, value in manifest.items() if key != "occupancy_id"}
    if manifest.get("occupancy_id") != _occupancy_id(identity):
        raise RoomOccupancyError("RoomOccupancy identity self-check failed")
    expected = {"manifest.json"}
    for date in manifest["dates"]:
        for floor in date["floors"]:
            artifact = floor["artifact"]
            path = output_dir / artifact["path"]
            content = path.read_bytes()
            if len(content) != artifact["bytes"] or hashlib.sha256(content).hexdigest() != artifact["sha256"]:
                raise RoomOccupancyError(f"RoomOccupancy artifact self-check failed: {artifact['path']}")
            payload = json.loads(content)
            if (
                payload.get("format") != ROOM_FLOOR_FORMAT
                or payload.get("exam_snapshot_id") != manifest["exam_snapshot_id"]
                or payload.get("space_snapshot_id") != manifest["space_snapshot_id"]
                or payload.get("floor_id") != floor["floor_id"]
            ):
                raise RoomOccupancyError(f"RoomOccupancy floor identity mismatch: {artifact['path']}")
            expected.add(artifact["path"])
    actual = {path.relative_to(output_dir).as_posix() for path in output_dir.rglob("*") if path.is_file()}
    if actual != expected:
        raise RoomOccupancyError(f"RoomOccupancy file set mismatch: expected {sorted(expected)}, got {sorted(actual)}")


def write_room_occupancy_artifacts(
    *, output_dir: Path, exam_snapshot: ExamSnapshot, space_snapshot_path: Path
) -> dict[str, Any]:
    output_dir = output_dir.resolve()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = output_dir.with_name(f"{output_dir.name}.staging-{uuid.uuid4().hex}")
    backup = output_dir.with_name(f"{output_dir.name}.backup-{uuid.uuid4().hex}")
    staging.mkdir()
    replaced = False
    try:
        manifest = _build(output_dir=staging, exam_snapshot=exam_snapshot, space_snapshot_path=space_snapshot_path.resolve())
        _validate_output(staging, manifest)
        if output_dir.exists():
            output_dir.replace(backup)
            replaced = True
        staging.replace(output_dir)
        if replaced:
            shutil.rmtree(backup)
        return manifest
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        if replaced and backup.exists() and not output_dir.exists():
            backup.replace(output_dir)
        raise
