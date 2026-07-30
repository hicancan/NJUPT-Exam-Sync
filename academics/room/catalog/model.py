from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOM_CATALOG_FORMAT = "njupt-room-catalog-v2"

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


class RoomCatalogError(RuntimeError):
    """Invalid maintained NJUPT room catalog or room identity."""


@dataclass(frozen=True)
class ParsedRoom:
    campus: str
    building: str
    floor: str
    room: str
    room_key: str
    normalized_location: str


@dataclass(frozen=True)
class CatalogRoom:
    campus: str
    building: str
    floor: str
    floor_key: str
    room: str
    room_key: str


@dataclass(frozen=True)
class RoomCatalog:
    format: str
    content_hash: str
    rooms_by_key: dict[str, CatalogRoom]


def normalize_room_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ").strip())


def normalize_location(value: Any) -> str:
    text = normalize_room_text(value)
    return (
        text.replace("－", "-")
        .replace("—", "-")
        .replace("–", "-")
        .replace("~", "-")
        .replace(" ", "")
    )


def room_key_for(*, campus: str, building: str, room: str) -> str:
    identity = "\u001f".join(
        [
            normalize_room_text(campus),
            normalize_room_text(building),
            normalize_room_text(room).upper(),
        ]
    )
    return "room-" + hashlib.sha256(identity.encode("utf-8")).hexdigest()[:16]


def floor_key_for(*, campus: str, building: str, floor: str) -> str:
    identity = "\u001f".join(
        [
            normalize_room_text(campus),
            normalize_room_text(building),
            normalize_room_text(floor),
        ]
    )
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
                    return _parsed_room(
                        campus=campus,
                        building=building,
                        room=suffix,
                        normalized_location=f"{building}-{suffix}",
                    )
        return None

    return _parsed_room(
        campus=campus,
        building=match.group("building"),
        room=match.group("room"),
        normalized_location=f"{match.group('building')}-{match.group('room')}",
    )


def _parsed_room(
    *,
    campus: Any,
    building: str,
    room: str,
    normalized_location: str,
) -> ParsedRoom:
    digits_match = re.match(r"\d+", room)
    if not digits_match or len(digits_match.group(0)) < 3:
        raise RoomCatalogError(f"invalid numeric room: {normalized_location}")
    normalized_building = normalize_room_text(building)
    normalized_campus = (
        "三牌楼"
        if normalized_building in SANPAILOU_BUILDINGS
        else normalize_room_text(campus)
    )
    normalized_room = normalize_room_text(room).upper()
    floor = digits_match.group(0)[0]
    return ParsedRoom(
        campus=normalized_campus,
        building=normalized_building,
        floor=floor,
        room=normalized_room,
        room_key=room_key_for(
            campus=normalized_campus,
            building=normalized_building,
            room=normalized_room,
        ),
        normalized_location=normalized_location,
    )


def _parsed_special_room(
    *,
    campus: Any,
    building: str,
    room: str,
    floor: str,
    normalized_location: str,
) -> ParsedRoom:
    normalized_campus = normalize_room_text(campus)
    normalized_building = normalize_room_text(building)
    normalized_room = normalize_room_text(room).upper()
    if not normalized_campus or not normalized_building or not normalized_room or not floor:
        raise RoomCatalogError(
            f"special room identity is incomplete: {normalized_location}"
        )
    return ParsedRoom(
        campus=normalized_campus,
        building=normalized_building,
        floor=floor,
        room=normalized_room,
        room_key=room_key_for(
            campus=normalized_campus,
            building=normalized_building,
            room=normalized_room,
        ),
        normalized_location=normalized_location,
    )


def load_room_catalog(path: Path) -> RoomCatalog:
    try:
        raw = path.read_bytes()
        payload = json.loads(raw)
    except FileNotFoundError as exc:
        raise RoomCatalogError(f"room catalog is required: {path}") from exc
    except Exception as exc:
        raise RoomCatalogError(f"failed to read room catalog: {path}") from exc
    if (
        not isinstance(payload, dict)
        or set(payload) != {"format", "floors"}
        or payload.get("format") != ROOM_CATALOG_FORMAT
        or not isinstance(payload.get("floors"), list)
        or not payload["floors"]
    ):
        raise RoomCatalogError(f"incompatible room catalog: {path}")

    rooms_by_key: dict[str, CatalogRoom] = {}
    floor_identities: set[tuple[str, str, str]] = set()
    for floor in payload["floors"]:
        if (
            not isinstance(floor, dict)
            or set(floor) != {"campus", "building", "floor", "rooms"}
            or not isinstance(floor.get("rooms"), list)
            or not floor["rooms"]
        ):
            raise RoomCatalogError(f"invalid room catalog floor: {floor}")
        campus = normalize_room_text(floor.get("campus"))
        building = normalize_room_text(floor.get("building"))
        floor_id = normalize_room_text(floor.get("floor"))
        floor_identity = (campus, building, floor_id)
        if (
            not campus
            or not building
            or not floor_id
            or floor_identity in floor_identities
        ):
            raise RoomCatalogError(f"invalid or duplicate room catalog floor: {floor}")
        floor_identities.add(floor_identity)
        floor_key = floor_key_for(
            campus=campus,
            building=building,
            floor=floor_id,
        )
        for entry in floor["rooms"]:
            if not isinstance(entry, dict) or set(entry) != {"room", "room_key"}:
                raise RoomCatalogError(f"invalid room catalog entry: {entry}")
            room = normalize_room_text(entry.get("room")).upper()
            room_key = normalize_room_text(entry.get("room_key"))
            expected_key = room_key_for(
                campus=campus,
                building=building,
                room=room,
            )
            if not room or room_key != expected_key or room_key in rooms_by_key:
                raise RoomCatalogError(f"invalid or duplicate room identity: {entry}")
            rooms_by_key[room_key] = CatalogRoom(
                campus=campus,
                building=building,
                floor=floor_id,
                floor_key=floor_key,
                room=room,
                room_key=room_key,
            )
    return RoomCatalog(
        format=ROOM_CATALOG_FORMAT,
        content_hash=hashlib.sha256(raw).hexdigest(),
        rooms_by_key=rooms_by_key,
    )
