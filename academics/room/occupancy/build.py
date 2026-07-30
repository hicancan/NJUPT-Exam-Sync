from __future__ import annotations

import json
import hashlib
from pathlib import Path
from typing import Any

from academics.exam.snapshot.model import ExamSnapshot
from academics.room.catalog import (
    ParsedRoom,
    floor_key_for,
    load_room_catalog,
    normalize_location,
    normalize_room_text,
    parse_room_location,
)


class RoomOccupancyError(RuntimeError):
    """Fatal RoomOccupancy construction failure."""


ROOM_OCCUPANCY_FORMAT = "njupt-room-occupancy-v3"
ROOM_FLOOR_FORMAT = "njupt-room-occupancy-floor-v2"
ROOM_DIAGNOSTICS_FORMAT = "njupt-room-occupancy-diagnostics-v2"


def write_json_file(path: Path, payload: Any, *, compact: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("w", encoding="utf-8", newline="\n") as handle:
            if compact:
                json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            else:
                json.dump(payload, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
    except Exception as exc:
        raise RoomOccupancyError(f"Failed to write {path}") from exc


def artifact_ref(root: Path, relative_path: str) -> dict[str, Any]:
    content = (root / relative_path).read_bytes()
    return {
        "path": relative_path,
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def room_occupancy_id(
    data_version: str,
    catalog_id: str,
    dates: list[dict[str, Any]],
    diagnostics: dict[str, Any],
) -> str:
    identity = hashlib.sha256()
    identity.update(ROOM_OCCUPANCY_FORMAT.encode())
    identity.update(b"\0")
    identity.update(data_version.encode())
    identity.update(b"\0")
    identity.update(catalog_id.encode())
    for date in dates:
        for floor in date["floors"]:
            artifact = floor["artifact"]
            for value in (
                artifact["path"],
                artifact["bytes"],
                artifact["sha256"],
            ):
                identity.update(b"\0")
                identity.update(str(value).encode())
    for value in (
        diagnostics["path"],
        diagnostics["bytes"],
        diagnostics["sha256"],
    ):
        identity.update(b"\0")
        identity.update(str(value).encode())
    return identity.hexdigest()


def _exam_booking(record: dict[str, Any], room: ParsedRoom) -> dict[str, Any]:
    return {
        "exam_id": record.get("id"),
        "stable_key": record.get("stable_key"),
        "class_name": record.get("class_name"),
        "course_name": record.get("course_name"),
        "course_code": record.get("course_code"),
        "teacher": record.get("teacher"),
        "count": record.get("count"),
        "date": record.get("date"),
        "start_timestamp": record.get("start_timestamp"),
        "end_timestamp": record.get("end_timestamp"),
        "duration_minutes": record.get("duration_minutes"),
        "location": record.get("location"),
        "campus": room.campus,
        "building": room.building,
        "floor": room.floor,
        "floor_key": floor_key_for(campus=room.campus, building=room.building, floor=room.floor),
        "room": room.room,
        "room_key": room.room_key,
    }


def write_room_occupancy_artifacts(
    *,
    output_dir: Path,
    exam_snapshot: ExamSnapshot,
    catalog_path: Path,
) -> dict[str, Any]:
    records = exam_snapshot.records
    manifest = {
        "generated_at": exam_snapshot.auto_updated_at,
        "data_version": exam_snapshot.data_version,
        "exam_period_id": exam_snapshot.exam_period_id,
        "academic_year": exam_snapshot.academic_year,
        "term_number": exam_snapshot.term_number,
        "term_label": exam_snapshot.term_label,
        "source_url": exam_snapshot.source_url,
        "source_title": exam_snapshot.source_title,
    }
    catalog = load_room_catalog(catalog_path)
    rooms_by_key = catalog.rooms_by_key
    rooms_dir = output_dir
    by_floor_dir = rooms_dir / "by-floor"
    rooms_dir.mkdir(parents=True, exist_ok=True)
    by_floor_dir.mkdir(parents=True, exist_ok=True)
    for stale in by_floor_dir.rglob("*.json"):
        stale.unlink()
    stale_by_date = rooms_dir / "by-date"
    if stale_by_date.exists():
        for stale in stale_by_date.glob("*.json"):
            stale.unlink()
        stale_by_date.rmdir()

    bookings_by_date_floor: dict[tuple[str, str], list[dict[str, Any]]] = {}
    unresolved_locations: dict[str, int] = {}
    unknown_catalog_rooms: dict[str, int] = {}

    for record in records:
        raw_location = normalize_location(record.get("location"))
        parsed = parse_room_location(
            campus=record.get("campus"),
            location=record.get("location"),
        )
        if parsed is None:
            if raw_location:
                unresolved_locations[raw_location] = unresolved_locations.get(raw_location, 0) + 1
            continue
        if parsed.room_key not in rooms_by_key:
            unknown_catalog_rooms[parsed.normalized_location] = unknown_catalog_rooms.get(parsed.normalized_location, 0) + 1
            continue
        date = normalize_room_text(record.get("date"))
        if not date:
            raise RoomOccupancyError(f"Exam record has no date for room occupancy: {record.get('id')}")
        floor_key = floor_key_for(campus=parsed.campus, building=parsed.building, floor=parsed.floor)
        bookings_by_date_floor.setdefault((date, floor_key), []).append(_exam_booking(record, parsed))

    if unknown_catalog_rooms:
        raise RoomOccupancyError(
            "Exam data contains rooms missing from the maintained room catalog: "
            + json.dumps(unknown_catalog_rooms, ensure_ascii=False, sort_keys=True)
        )

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
            for room in rooms_by_key.values()
        ),
        key=lambda item: (
            item["campus"],
            item["building"],
            item["floor"],
            item["room"],
        ),
    )
    floor_entries: list[dict[str, Any]] = []
    rooms_by_floor: dict[str, list[dict[str, Any]]] = {}
    for room in room_entries:
        floor_key = floor_key_for(campus=room["campus"], building=room["building"], floor=room["floor"])
        rooms_by_floor.setdefault(floor_key, []).append(room)
    for floor_key, floor_rooms in sorted(
        rooms_by_floor.items(),
        key=lambda item: (item[1][0]["campus"], item[1][0]["building"], item[1][0]["floor"]),
    ):
        first = floor_rooms[0]
        floor_entries.append(
            {
                "campus": first["campus"],
                "building": first["building"],
                "floor": first["floor"],
                "floor_key": floor_key,
                "room_count": len(floor_rooms),
                "room_keys": [room["room_key"] for room in floor_rooms],
            }
        )
    dates = sorted({date for date, _floor_key in bookings_by_date_floor})
    date_entries: list[dict[str, Any]] = []
    for date in dates:
        date_dir = by_floor_dir / date
        floor_artifacts: list[dict[str, Any]] = []
        for floor in floor_entries:
            floor_key = floor["floor_key"]
            bookings = sorted(
                bookings_by_date_floor.get((date, floor_key), []),
                key=lambda item: (str(item.get("start_timestamp") or ""), item["campus"], item["building"], item["room"], str(item.get("exam_id") or "")),
            )
            if not bookings:
                continue
            date_dir.mkdir(parents=True, exist_ok=True)
            write_json_file(
                date_dir / f"{floor_key}.json",
                {
                    "format": ROOM_FLOOR_FORMAT,
                    "generated_at": manifest["generated_at"],
                    "data_version": manifest["data_version"],
                    "exam_period_id": manifest["exam_period_id"],
                    "date": date,
                    "campus": floor["campus"],
                    "building": floor["building"],
                    "floor": floor["floor"],
                    "floor_key": floor_key,
                    "room_count": floor["room_count"],
                    "booking_count": len(bookings),
                    "bookings": bookings,
                },
                compact=True,
            )
            floor_artifacts.append(
                {
                    "floor_key": floor_key,
                    "artifact": artifact_ref(
                        rooms_dir,
                        f"by-floor/{date}/{floor_key}.json",
                    ),
                    "booking_count": len(bookings),
                }
            )
        date_entries.append(
            {
                "date": date,
                "floor_count": len(floor_artifacts),
                "booking_count": sum(item["booking_count"] for item in floor_artifacts),
                "floors": floor_artifacts,
            }
        )

    write_json_file(
        rooms_dir / "diagnostics.json",
        {
            "format": ROOM_DIAGNOSTICS_FORMAT,
            "generated_at": manifest["generated_at"],
            "data_version": manifest["data_version"],
            "exam_period_id": manifest["exam_period_id"],
            "non_room_locations": [],
            "unresolved_locations": [
                {"location": location, "count": count}
                for location, count in sorted(unresolved_locations.items())
            ],
            "unknown_catalog_rooms": [],
        },
        compact=False,
    )
    diagnostics = artifact_ref(rooms_dir, "diagnostics.json")
    index_payload = {
        "format": ROOM_OCCUPANCY_FORMAT,
        "occupancy_id": room_occupancy_id(
            exam_snapshot.data_version,
            catalog.content_hash,
            date_entries,
            diagnostics,
        ),
        "generated_at": manifest["generated_at"],
        "data_version": manifest["data_version"],
        "exam_period_id": manifest["exam_period_id"],
        "academic_year": manifest["academic_year"],
        "term_number": manifest["term_number"],
        "term_label": manifest["term_label"],
        "source_url": manifest.get("source_url"),
        "source_title": manifest.get("source_title"),
        "catalog_format": catalog.format,
        "catalog_id": catalog.content_hash,
        "room_count": len(room_entries),
        "floor_count": len(floor_entries),
        "date_count": len(dates),
        "rooms": room_entries,
        "floors": floor_entries,
        "dates": date_entries,
        "diagnostics": diagnostics,
    }
    write_json_file(rooms_dir / "manifest.json", index_payload, compact=False)
    return index_payload
