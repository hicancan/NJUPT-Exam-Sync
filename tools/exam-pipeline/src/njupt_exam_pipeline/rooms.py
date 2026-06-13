from __future__ import annotations

import json
import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .contract import ExamPipelineError, normalize_text


ROOM_CATALOG_VERSION = "njupt-room-catalog-v1"
ROOM_INDEX_VERSION = "exam-room-index-v1"
ROOM_FLOOR_DATE_VERSION = "exam-room-floor-date-v1"
ROOM_AUDIT_VERSION = "exam-room-audit-v1"

WIRELESS_ROOM_DIGITS = {
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "一": "1",
    "二": "2",
    "三": "3",
    "四": "4",
    "五": "5",
    "六": "6",
}
WIRELESS_BUILDING_RE = re.compile(r"^无(?P<room>[1-6一二三四五六])$")
LIBRARY_SCIENCE_ROOM_FLOORS = {"图4": "1", "图5": "4"}
STANDARD_LOCATION_RE = re.compile(r"^(?P<building>.+?)-(?P<room>\d{3,4}[A-Za-z]?)$")
KNOWN_COMPACT_BUILDINGS = ("自动化学科楼",)
SANPAILOU_BUILDINGS = {"教东", "教西", "图科楼", "无线楼"}
ROOM_SOURCE_VALUES = {"observed", "inferred_range", "manual_confirmed"}


@dataclass(frozen=True)
class ParsedRoom:
    campus: str
    building: str
    floor: str
    room: str
    room_key: str
    normalized_location: str


def normalize_location(value: Any) -> str:
    text = normalize_text(value)
    return (
        text.replace("－", "-")
        .replace("—", "-")
        .replace("–", "-")
        .replace("~", "-")
        .replace(" ", "")
    )


def room_key_for(*, campus: str, building: str, room: str) -> str:
    identity = "\u001f".join([normalize_text(campus), normalize_text(building), normalize_text(room).upper()])
    return "room-" + hashlib.sha256(identity.encode("utf-8")).hexdigest()[:16]


def floor_key_for(*, campus: str, building: str, floor: str) -> str:
    identity = "\u001f".join([normalize_text(campus), normalize_text(building), normalize_text(floor)])
    return "floor-" + hashlib.sha256(identity.encode("utf-8")).hexdigest()[:16]


def parse_room_location(*, campus: Any, location: Any) -> ParsedRoom | None:
    normalized_location = normalize_location(location)
    if not normalized_location:
        return None

    wireless_match = WIRELESS_BUILDING_RE.match(normalized_location)
    if wireless_match:
        room_number = WIRELESS_ROOM_DIGITS[wireless_match.group("room")]
        room = f"无{room_number}"
        return _parsed_special_room(
            campus="三牌楼",
            building="无线楼",
            room=room,
            floor=str(((int(room_number) - 1) // 2) + 1),
            normalized_location=room,
        )

    if normalized_location in LIBRARY_SCIENCE_ROOM_FLOORS:
        return _parsed_special_room(
            campus="三牌楼",
            building="图科楼",
            room=normalized_location,
            floor=LIBRARY_SCIENCE_ROOM_FLOORS[normalized_location],
            normalized_location=normalized_location,
        )

    match = STANDARD_LOCATION_RE.match(normalized_location)
    if not match:
        for building in KNOWN_COMPACT_BUILDINGS:
            if normalized_location.startswith(building):
                suffix = normalized_location[len(building) :]
                if re.fullmatch(r"\d{3,4}[A-Za-z]?", suffix):
                    match = re.match(r"^(?P<room>\d{3,4}[A-Za-z]?)$", suffix)
                    if match:
                        return _parsed_room(
                            campus=campus,
                            building=building,
                            room=match.group("room"),
                            normalized_location=f"{building}-{suffix}",
                        )
        return None

    return _parsed_room(
        campus=campus,
        building=match.group("building"),
        room=match.group("room"),
        normalized_location=f"{match.group('building')}-{match.group('room')}",
    )


def _parsed_room(*, campus: Any, building: str, room: str, normalized_location: str) -> ParsedRoom:
    digits_match = re.match(r"\d+", room)
    if not digits_match:
        raise ExamPipelineError(f"Room has no numeric prefix: {normalized_location}")
    digits = digits_match.group(0)
    if len(digits) < 3:
        raise ExamPipelineError(f"Room number must have at least 3 digits: {normalized_location}")
    normalized_building = normalize_text(building)
    normalized_campus = "三牌楼" if normalized_building in SANPAILOU_BUILDINGS else normalize_text(campus)
    normalized_room = normalize_text(room).upper()
    floor = digits[0]
    room_key = room_key_for(campus=normalized_campus, building=normalized_building, room=normalized_room)
    return ParsedRoom(
        campus=normalized_campus,
        building=normalized_building,
        floor=floor,
        room=normalized_room,
        room_key=room_key,
        normalized_location=normalized_location,
    )


def _parsed_special_room(*, campus: Any, building: str, room: str, floor: str, normalized_location: str) -> ParsedRoom:
    normalized_campus = normalize_text(campus)
    normalized_building = normalize_text(building)
    normalized_room = normalize_text(room).upper()
    if not normalized_campus or not normalized_building or not normalized_room or not floor:
        raise ExamPipelineError(f"Special room identity is incomplete: {normalized_location}")
    return ParsedRoom(
        campus=normalized_campus,
        building=normalized_building,
        floor=floor,
        room=normalized_room,
        room_key=room_key_for(campus=normalized_campus, building=normalized_building, room=normalized_room),
        normalized_location=normalized_location,
    )


def _record_room(record: dict[str, Any]) -> ParsedRoom | None:
    return parse_room_location(campus=record.get("campus"), location=record.get("location"))


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
        raise ExamPipelineError(f"Failed to write {path}") from exc


def build_initial_room_catalog(records: list[dict[str, Any]]) -> dict[str, Any]:
    observed: dict[tuple[str, str, str], dict[str, ParsedRoom]] = {}
    unresolved: dict[str, int] = {}

    for record in records:
        raw_location = normalize_location(record.get("location"))
        parsed = _record_room(record)
        if parsed is None:
            if raw_location:
                unresolved[raw_location] = unresolved.get(raw_location, 0) + 1
            continue
        observed.setdefault((parsed.campus, parsed.building, parsed.floor), {})[parsed.room] = parsed

    floors: list[dict[str, Any]] = []
    for (campus, building, floor), floor_rooms in sorted(observed.items()):
        numeric_room_values: list[int] = []
        for room in floor_rooms:
            match = re.fullmatch(r"\d+", room)
            if match:
                numeric_room_values.append(int(room))
        room_entries: list[dict[str, Any]] = []
        if numeric_room_values:
            min_room = min(numeric_room_values)
            max_room = max(numeric_room_values)
            for room_number in range(min_room, max_room + 1):
                room = str(room_number)
                observed_room = floor_rooms.get(room)
                room_entries.append(
                    {
                        "room": room,
                        "room_key": observed_room.room_key if observed_room else room_key_for(campus=campus, building=building, room=room),
                        "source": "observed" if observed_room else "inferred_range",
                    }
                )
        else:
            ordered_special_rooms = sorted(floor_rooms, key=lambda item: int(re.sub(r"\D+", "", item) or 0))
            min_room = ordered_special_rooms[0]
            max_room = ordered_special_rooms[-1]
            for room in ordered_special_rooms:
                observed_room = floor_rooms[room]
                room_entries.append({"room": room, "room_key": observed_room.room_key, "source": "observed"})
        floors.append(
            {
                "campus": campus,
                "building": building,
                "floor": floor,
                "range": {"min": str(min_room), "max": str(max_room)},
                "rooms": room_entries,
            }
        )

    return {
        "version": ROOM_CATALOG_VERSION,
        "source": "inferred_from_exam_public_data",
        "policy": "ranges are initialized from observed current/historical exam rooms; edit this file manually after confirmation",
        "floors": floors,
        "non_room_locations": [],
        "unresolved_locations": [
            {"location": location, "count": count}
            for location, count in sorted(unresolved.items())
        ],
    }


def load_room_catalog(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ExamPipelineError(f"Room catalog is required: {path}") from exc
    except Exception as exc:
        raise ExamPipelineError(f"Failed to read room catalog: {path}") from exc
    if not isinstance(payload, dict) or payload.get("version") != ROOM_CATALOG_VERSION:
        raise ExamPipelineError(f"Room catalog version is invalid: {path}")
    floors = payload.get("floors")
    if not isinstance(floors, list) or not floors:
        raise ExamPipelineError(f"Room catalog must contain floors: {path}")
    return payload


def _catalog_rooms(catalog: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rooms: dict[str, dict[str, Any]] = {}
    for floor in catalog["floors"]:
        if not isinstance(floor, dict):
            raise ExamPipelineError("Room catalog floor entries must be objects")
        campus = normalize_text(floor.get("campus"))
        building = normalize_text(floor.get("building"))
        floor_id = normalize_text(floor.get("floor"))
        entries = floor.get("rooms")
        if not campus or not building or not floor_id or not isinstance(entries, list):
            raise ExamPipelineError(f"Invalid room catalog floor: {floor}")
        for entry in entries:
            if not isinstance(entry, dict):
                raise ExamPipelineError(f"Invalid room catalog room entry: {entry}")
            room = normalize_text(entry.get("room")).upper()
            room_key = normalize_text(entry.get("room_key"))
            source = normalize_text(entry.get("source"))
            if not room or not room_key or not source:
                raise ExamPipelineError(f"Room catalog room entries require room, room_key and source: {entry}")
            if source not in ROOM_SOURCE_VALUES:
                raise ExamPipelineError(f"Room catalog room source is invalid: {source}")
            if room_key in rooms:
                raise ExamPipelineError(f"Duplicate room_key in room catalog: {room_key}")
            rooms[room_key] = {
                "campus": campus,
                "building": building,
                "floor": floor_id,
                "floor_key": floor_key_for(campus=campus, building=building, floor=floor_id),
                "room": room,
                "room_key": room_key,
                "source": source,
            }
    return rooms


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
    data_dir: Path,
    records: list[dict[str, Any]],
    manifest: dict[str, Any],
    catalog_path: Path,
) -> None:
    catalog = load_room_catalog(catalog_path)
    rooms_by_key = _catalog_rooms(catalog)
    rooms_dir = data_dir / "rooms"
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
        parsed = _record_room(record)
        if parsed is None:
            if raw_location:
                unresolved_locations[raw_location] = unresolved_locations.get(raw_location, 0) + 1
            continue
        if parsed.room_key not in rooms_by_key:
            unknown_catalog_rooms[parsed.normalized_location] = unknown_catalog_rooms.get(parsed.normalized_location, 0) + 1
            continue
        date = normalize_text(record.get("date"))
        if not date:
            raise ExamPipelineError(f"Exam record has no date for room occupancy: {record.get('id')}")
        floor_key = floor_key_for(campus=parsed.campus, building=parsed.building, floor=parsed.floor)
        bookings_by_date_floor.setdefault((date, floor_key), []).append(_exam_booking(record, parsed))

    if unknown_catalog_rooms:
        raise ExamPipelineError(
            "Exam data contains rooms missing from the maintained room catalog: "
            + json.dumps(unknown_catalog_rooms, ensure_ascii=False, sort_keys=True)
        )

    room_entries = sorted(
        rooms_by_key.values(),
        key=lambda item: (item["campus"], item["building"], item["floor"], item["room"]),
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
        floor_paths: list[dict[str, Any]] = []
        for floor in floor_entries:
            floor_key = floor["floor_key"]
            bookings = bookings_by_date_floor.get((date, floor_key), [])
            if not bookings:
                continue
            floor_paths.append(
                {
                    "floor_key": floor_key,
                    "path": f"generated/exam/rooms/by-floor/{date}/{floor_key}.json",
                    "booking_count": len(bookings),
                }
            )
        date_entries.append(
            {
                "date": date,
                "floor_count": len(floor_paths),
                "booking_count": sum(item["booking_count"] for item in floor_paths),
                "floors": floor_paths,
            }
        )
    index_payload = {
        "version": ROOM_INDEX_VERSION,
        "generated_at": manifest["generated_at"],
        "data_version": manifest["data_version"],
        "exam_period_id": manifest["exam_period_id"],
        "academic_year": manifest["academic_year"],
        "term_number": manifest["term_number"],
        "term_label": manifest["term_label"],
        "source_url": manifest.get("source_url"),
        "source_title": manifest.get("source_title"),
        "catalog_version": catalog["version"],
        "room_count": len(room_entries),
        "floor_count": len(floor_entries),
        "date_count": len(dates),
        "rooms": room_entries,
        "floors": floor_entries,
        "dates": date_entries,
        "audit_path": "generated/exam/rooms/audit.json",
    }
    write_json_file(rooms_dir / "index.json", index_payload, compact=False)

    for date in dates:
        date_dir = by_floor_dir / date
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
                    "version": ROOM_FLOOR_DATE_VERSION,
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

    write_json_file(
        rooms_dir / "audit.json",
        {
            "version": ROOM_AUDIT_VERSION,
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
