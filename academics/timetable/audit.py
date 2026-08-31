from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

from academics.room.catalog import load_room_catalog, normalize_location, parse_room_location

from .model import load_teaching_schedule_source


def audit_teaching_source(source_path: Path, catalog_path: Path) -> dict[str, Any]:
    source = load_teaching_schedule_source(source_path)
    catalog = load_room_catalog(catalog_path)
    locations: Counter[str] = Counter()
    missing: Counter[str] = Counter()
    unresolved: Counter[str] = Counter()
    rooms: set[str] = set()
    courses: set[str] = set()
    teaching_classes: set[str] = set()
    raw_records = 0
    for schedule in source.schedules:
        for meeting in schedule["meetings"]:
            raw_records += 1
            course_identity = str(meeting.get("course_code") or meeting.get("course_name") or "").strip()
            if course_identity:
                courses.add(course_identity)
            teaching_class_id = str(meeting.get("teaching_class_id") or "").strip()
            if teaching_class_id:
                teaching_classes.add(teaching_class_id)
            location = normalize_location(meeting.get("location"))
            if not location:
                continue
            locations[location] += 1
            parsed = parse_room_location(campus=meeting.get("campus"), location=meeting.get("location"))
            if parsed is None:
                unresolved[location] += 1
            elif parsed.room_key not in catalog.rooms_by_key:
                missing[parsed.normalized_location] += 1
            else:
                rooms.add(parsed.room_key)
    return {
        "source_id": source.source_id,
        "catalog_count": len(source.catalog),
        "real_class_count": sum(1 for entry in source.catalog if entry["descriptor"]["class_id"]),
        "special_count": sum(1 for entry in source.catalog if entry["status"] == "special"),
        "raw_record_count": raw_records,
        "course_count": len(courses),
        "teaching_class_count": len(teaching_classes),
        "recognized_room_count": len(rooms),
        "location_count": len(locations),
        "room_catalog_missing": [{"location": location, "count": count} for location, count in sorted(missing.items())],
        "unresolved_locations": [{"location": location, "count": count} for location, count in sorted(unresolved.items())],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit one TeachingScheduleSource against the current RoomCatalog")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--catalog", required=True, type=Path)
    arguments = parser.parse_args()
    print(json.dumps(audit_teaching_source(arguments.source, arguments.catalog), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
