from __future__ import annotations

import hashlib
import json
import logging
import shutil
import uuid
from pathlib import Path
from typing import Any

from academics.exam.snapshot.model import ExamSnapshot
from academics.room.catalog import (
    CatalogRoom,
    floor_key_for,
    load_room_catalog,
    normalize_location,
    normalize_room_text,
    parse_room_location,
)

logger = logging.getLogger(__name__)

ROOM_OCCUPANCY_FORMAT = "njupt-room-occupancy"
ROOM_FLOOR_FORMAT = "njupt-room-floor-occupancy"


class RoomOccupancyError(RuntimeError):
    """Fatal RoomOccupancy construction failure."""


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _write_json(path: Path, payload: Any, *, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        if pretty:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        else:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))


def _artifact_ref(root: Path, relative_path: str) -> dict[str, Any]:
    content = (root / relative_path).read_bytes()
    return {
        "path": relative_path,
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def _booking(record: dict[str, Any], room: CatalogRoom) -> dict[str, Any]:
    return {
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
        "campus": room.campus,
        "building": room.building,
        "floor": room.floor,
        "floor_key": room.floor_key,
        "room": room.room,
        "room_key": room.room_key,
    }


def _occupancy_id(manifest_without_id: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical_bytes(manifest_without_id)).hexdigest()


def _build(
    *,
    output_dir: Path,
    exam_snapshot: ExamSnapshot,
    catalog_path: Path,
) -> dict[str, Any]:
    catalog = load_room_catalog(catalog_path)
    room_entries = sorted(
        (
            {
                "campus": room.campus,
                "building": room.building,
                "floor": room.floor,
                "floor_key": room.floor_key,
                "room": room.room,
                "room_key": room.room_key,
            }
            for room in catalog.rooms_by_key.values()
        ),
        key=lambda room: (
            room["campus"],
            room["building"],
            room["floor"],
            room["room"],
        ),
    )
    rooms_by_floor: dict[str, list[dict[str, Any]]] = {}
    for room in room_entries:
        rooms_by_floor.setdefault(room["floor_key"], []).append(room)
    floor_entries = []
    for floor_key, rooms in sorted(
        rooms_by_floor.items(),
        key=lambda item: (
            item[1][0]["campus"],
            item[1][0]["building"],
            item[1][0]["floor"],
        ),
    ):
        first = rooms[0]
        floor_entries.append(
            {
                "campus": first["campus"],
                "building": first["building"],
                "floor": first["floor"],
                "floor_key": floor_key,
                "room_keys": [room["room_key"] for room in rooms],
            }
        )

    by_date_floor: dict[tuple[str, str], list[dict[str, Any]]] = {}
    unresolved: dict[str, int] = {}
    unknown: dict[str, int] = {}
    for record in exam_snapshot.records:
        parsed = parse_room_location(
            campus=record.get("campus"),
            location=record.get("location"),
        )
        if parsed is None:
            location = normalize_location(record.get("location"))
            if location:
                unresolved[location] = unresolved.get(location, 0) + 1
            continue
        catalog_room = catalog.rooms_by_key.get(parsed.room_key)
        if catalog_room is None:
            unknown[parsed.normalized_location] = (
                unknown.get(parsed.normalized_location, 0) + 1
            )
            continue
        date = normalize_room_text(record.get("date"))
        if not date:
            raise RoomOccupancyError(
                f"Exam record has no date for room occupancy: {record.get('id')}"
            )
        by_date_floor.setdefault((date, catalog_room.floor_key), []).append(
            _booking(record, catalog_room)
        )

    if unresolved:
        logger.warning(
            "Skipped %d unrecognized exam locations: %s",
            sum(unresolved.values()),
            json.dumps(unresolved, ensure_ascii=False, sort_keys=True),
        )
    if unknown:
        raise RoomOccupancyError(
            "Exam locations resolve to rooms missing from RoomCatalog: "
            + json.dumps(unknown, ensure_ascii=False, sort_keys=True)
        )

    date_entries = []
    for date in sorted({date for date, _ in by_date_floor}):
        floor_artifacts = []
        for floor in floor_entries:
            bookings = sorted(
                by_date_floor.get((date, floor["floor_key"]), []),
                key=lambda booking: (
                    booking["start_timestamp"],
                    booking["room"],
                    booking["exam_id"],
                ),
            )
            if not bookings:
                continue
            relative_path = f"floors/{date}-{floor['floor_key']}.json"
            _write_json(
                output_dir / relative_path,
                {
                    "format": ROOM_FLOOR_FORMAT,
                    "exam_snapshot_id": exam_snapshot.snapshot_id,
                    "room_catalog_id": catalog.catalog_id,
                    "date": date,
                    "campus": floor["campus"],
                    "building": floor["building"],
                    "floor": floor["floor"],
                    "floor_key": floor["floor_key"],
                    "booking_count": len(bookings),
                    "bookings": bookings,
                },
            )
            floor_artifacts.append(
                {
                    "floor_key": floor["floor_key"],
                    "booking_count": len(bookings),
                    "artifact": _artifact_ref(output_dir, relative_path),
                }
            )
        date_entries.append({"date": date, "floors": floor_artifacts})

    manifest_without_id = {
        "format": ROOM_OCCUPANCY_FORMAT,
        "exam_snapshot_id": exam_snapshot.snapshot_id,
        "room_catalog_id": catalog.catalog_id,
        "exam_period_id": exam_snapshot.exam_period_id,
        "source_updated_at": exam_snapshot.source_updated_at,
        "rooms": room_entries,
        "floors": floor_entries,
        "dates": date_entries,
    }
    manifest = {
        **manifest_without_id,
        "occupancy_id": _occupancy_id(manifest_without_id),
    }
    _write_json(output_dir / "manifest.json", manifest, pretty=True)
    return manifest


def _validate_output(output_dir: Path, manifest: dict[str, Any]) -> None:
    identity_payload = {
        key: value for key, value in manifest.items() if key != "occupancy_id"
    }
    if manifest.get("occupancy_id") != _occupancy_id(identity_payload):
        raise RoomOccupancyError("RoomOccupancy identity self-check failed")
    expected = {"manifest.json"}
    for date in manifest["dates"]:
        for floor in date["floors"]:
            artifact = floor["artifact"]
            path = output_dir / artifact["path"]
            content = path.read_bytes()
            if (
                len(content) != artifact["bytes"]
                or hashlib.sha256(content).hexdigest() != artifact["sha256"]
            ):
                raise RoomOccupancyError(
                    f"RoomOccupancy artifact self-check failed: {artifact['path']}"
                )
            payload = json.loads(content)
            if (
                payload.get("format") != ROOM_FLOOR_FORMAT
                or payload.get("exam_snapshot_id") != manifest["exam_snapshot_id"]
                or payload.get("room_catalog_id") != manifest["room_catalog_id"]
            ):
                raise RoomOccupancyError(
                    f"RoomOccupancy floor identity mismatch: {artifact['path']}"
                )
            expected.add(artifact["path"])
    actual = {
        path.relative_to(output_dir).as_posix()
        for path in output_dir.rglob("*")
        if path.is_file()
    }
    if actual != expected:
        raise RoomOccupancyError(
            f"RoomOccupancy file set mismatch: expected {sorted(expected)}, "
            f"got {sorted(actual)}"
        )


def write_room_occupancy_artifacts(
    *,
    output_dir: Path,
    exam_snapshot: ExamSnapshot,
    catalog_path: Path,
) -> dict[str, Any]:
    output_dir = output_dir.resolve()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = output_dir.with_name(f"{output_dir.name}.staging-{uuid.uuid4().hex}")
    backup = output_dir.with_name(f"{output_dir.name}.backup-{uuid.uuid4().hex}")
    staging.mkdir()
    replaced_existing = False
    try:
        manifest = _build(
            output_dir=staging,
            exam_snapshot=exam_snapshot,
            catalog_path=catalog_path.resolve(),
        )
        _validate_output(staging, manifest)
        if output_dir.exists():
            output_dir.replace(backup)
            replaced_existing = True
        staging.replace(output_dir)
        if replaced_existing:
            shutil.rmtree(backup)
        return manifest
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        if replaced_existing and backup.exists() and not output_dir.exists():
            backup.replace(output_dir)
        raise
