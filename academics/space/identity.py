from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any


ROOM_TOKEN = r"\d{3,4}[A-Za-z]?(?:-\d+|\(\d+\))?"
STANDARD_LOCATION_RE = re.compile(rf"^(?P<building>.+?)-(?P<room>{ROOM_TOKEN})$")
LABELED_STANDARD_LOCATION_RE = re.compile(rf"(?P<building>教\d+)-(?P<room>{ROOM_TOKEN})\)?$")
KNOWN_COMPACT_BUILDINGS = ("自动化学科楼", "有线楼")
LABELED_COMPACT_LOCATION_RE = re.compile(
    rf"(?P<building>{'|'.join(map(re.escape, KNOWN_COMPACT_BUILDINGS))})-?(?P<room>{ROOM_TOKEN})\)?$"
)
WIRELESS_ROOM_DIGITS = {
    "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6",
    "一": "1", "二": "2", "三": "3", "四": "4", "五": "5", "六": "6",
}
WIRELESS_BUILDING_RE = re.compile(r"^无(?P<room>[1-6一二三四五六])$")
LIBRARY_SCIENCE_ROOM_FLOORS = {"图4": "1", "图5": "4"}
SANPAILOU_BUILDINGS = {"教东", "教西", "图科楼", "无线楼", "有线楼"}
CAMPUS_ALIASES = {"本部": "三牌楼", "锁金村": "锁金"}
NON_PHYSICAL_LOCATIONS = {
    "不要教室",
    "未排地点",
    "翻转课堂线上自学",
    "线上",
    "在线",
}


@dataclass(frozen=True)
class ParsedSpaceLocation:
    campus: str
    building: str
    floor: str
    room: str
    family_room: str
    normalized_location: str


def normalize_space_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ").strip())


def normalize_location(value: Any) -> str:
    return (
        normalize_space_text(value)
        .replace("－", "-")
        .replace("—", "-")
        .replace("–", "-")
        .replace("~", "-")
        .replace(" ", "")
    )


def stable_id(prefix: str, *parts: Any) -> str:
    identity = "\u001f".join(normalize_space_text(part) for part in parts)
    return prefix + hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]


def family_room_for(room: str) -> str:
    return re.sub(r"(?:-\d+|\(\d+\))$", "", normalize_space_text(room).upper())


def is_non_physical_location(value: Any) -> bool:
    normalized = normalize_location(value)
    return (
        not normalized
        or normalized in NON_PHYSICAL_LOCATIONS
        or "线上" in normalized
        or "在线" in normalized
        or normalized.startswith("操场")
    )


def parse_space_location(*, campus: Any, location: Any) -> ParsedSpaceLocation | None:
    normalized = normalize_location(location)
    if not normalized or is_non_physical_location(normalized):
        return None

    wireless = WIRELESS_BUILDING_RE.fullmatch(normalized)
    if wireless:
        number = WIRELESS_ROOM_DIGITS[wireless.group("room")]
        return _parsed(
            campus="三牌楼",
            building="无线楼",
            room=f"无{number}",
            floor=str(((int(number) - 1) // 2) + 1),
            normalized_location=f"无{number}",
        )

    if normalized in LIBRARY_SCIENCE_ROOM_FLOORS:
        return _parsed(
            campus="三牌楼",
            building="图科楼",
            room=normalized,
            floor=LIBRARY_SCIENCE_ROOM_FLOORS[normalized],
            normalized_location=normalized,
        )
    if re.fullmatch(r"图\d{3,4}[A-Za-z]?", normalized):
        room = normalized[1:]
        return _parsed(campus="三牌楼", building="图科楼", room=room, normalized_location=f"图科楼-{room}")

    match = LABELED_STANDARD_LOCATION_RE.search(normalized)
    if match:
        return _parsed(
            campus=campus,
            building=match.group("building"),
            room=match.group("room"),
            normalized_location=f"{match.group('building')}-{match.group('room')}",
        )
    compact = LABELED_COMPACT_LOCATION_RE.search(normalized)
    if compact:
        return _parsed(
            campus=campus,
            building=compact.group("building"),
            room=compact.group("room"),
            normalized_location=f"{compact.group('building')}-{compact.group('room')}",
        )
    match = STANDARD_LOCATION_RE.fullmatch(normalized)
    if match:
        return _parsed(
            campus=campus,
            building=match.group("building"),
            room=match.group("room"),
            normalized_location=f"{match.group('building')}-{match.group('room')}",
        )
    for building in KNOWN_COMPACT_BUILDINGS:
        if normalized.startswith(building):
            suffix = normalized[len(building):]
            if re.fullmatch(ROOM_TOKEN, suffix):
                return _parsed(
                    campus=campus,
                    building=building,
                    room=suffix,
                    normalized_location=f"{building}-{suffix}",
                )
    return None


def _parsed(
    *,
    campus: Any,
    building: str,
    room: str,
    normalized_location: str,
    floor: str | None = None,
) -> ParsedSpaceLocation:
    normalized_building = normalize_space_text(building)
    normalized_campus = (
        "三牌楼"
        if normalized_building in SANPAILOU_BUILDINGS
        else CAMPUS_ALIASES.get(normalize_space_text(campus), normalize_space_text(campus))
    )
    normalized_room = normalize_space_text(room).upper()
    digits = re.search(r"\d{3,4}", normalized_room)
    resolved_floor = floor or (digits.group(0)[0] if digits else "unknown")
    if not normalized_campus or not normalized_building or not normalized_room:
        raise ValueError(f"incomplete physical location: {normalized_location}")
    return ParsedSpaceLocation(
        campus=normalized_campus,
        building=normalized_building,
        floor=resolved_floor,
        room=normalized_room,
        family_room=family_room_for(normalized_room),
        normalized_location=normalized_location,
    )
