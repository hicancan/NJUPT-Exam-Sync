from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from academics.timetable.model import load_teaching_schedule_source

from .model import ROOM_CATALOG_FORMAT, parse_room_location


def merge_teaching_rooms(source_path: Path, catalog_path: Path) -> tuple[dict[str, Any], int]:
    source = load_teaching_schedule_source(source_path)
    payload = json.loads(catalog_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or payload.get("format") != ROOM_CATALOG_FORMAT or not isinstance(payload.get("floors"), list):
        raise ValueError("RoomCatalog has an incompatible shape")
    known = {
        (str(floor["campus"]), str(floor["building"]), str(floor["floor"]), str(room["room"]).upper())
        for floor in payload["floors"]
        for room in floor["rooms"]
    }
    discovered: set[tuple[str, str, str, str]] = set()
    for schedule in source.schedules:
        for meeting in schedule["meetings"]:
            parsed = parse_room_location(campus=meeting.get("campus"), location=meeting.get("location"))
            if parsed is not None:
                discovered.add((parsed.campus, parsed.building, parsed.floor, parsed.room))
    additions = sorted(discovered - known)
    floors = {
        (str(floor["campus"]), str(floor["building"]), str(floor["floor"])): floor
        for floor in payload["floors"]
    }
    for campus, building, floor_id, room in additions:
        floor = floors.get((campus, building, floor_id))
        if floor is None:
            floor = {"campus": campus, "building": building, "floor": floor_id, "rooms": []}
            floors[(campus, building, floor_id)] = floor
        floor["rooms"].append({"room": room})
    for floor in floors.values():
        floor["rooms"].sort(key=lambda value: str(value["room"]))
    payload["floors"] = sorted(floors.values(), key=lambda value: (str(value["campus"]), str(value["building"]), str(value["floor"])))
    return payload, len(additions)


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge physical rooms observed in a TeachingScheduleSource into RoomCatalog")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--write", action="store_true")
    arguments = parser.parse_args()
    payload, additions = merge_teaching_rooms(arguments.source, arguments.catalog)
    if arguments.write:
        arguments.catalog.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"discovered_additions": additions, "room_count": sum(len(floor["rooms"]) for floor in payload["floors"]), "written": arguments.write}))


if __name__ == "__main__":
    main()
