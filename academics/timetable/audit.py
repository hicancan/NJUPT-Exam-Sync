from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

from academics.space import load_space_snapshot, normalize_location
from .model import load_teaching_schedule_source


def audit_teaching_source(source_path: Path, space_path: Path) -> dict[str, Any]:
    source = load_teaching_schedule_source(source_path)
    space = load_space_snapshot(space_path)
    aliases = {entry["normalized_alias"]: entry for entry in space.aliases}
    locations: Counter[str] = Counter()
    terminal: Counter[str] = Counter()
    ambiguous: Counter[str] = Counter()
    non_physical: Counter[str] = Counter()
    unresolved: Counter[str] = Counter()
    families: set[str] = set()
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
            alias = aliases.get(location)
            if alias is None or alias["status"] == "unresolved":
                unresolved[location] += 1
            elif alias["status"] == "non_physical":
                non_physical[location] += 1
            elif alias["status"] == "ambiguous":
                ambiguous[location] += 1
                if alias.get("space_family_id"):
                    families.add(alias["space_family_id"])
            else:
                terminal[location] += 1
                if alias.get("space_family_id"):
                    families.add(alias["space_family_id"])
    return {
        "source_id": source.source_id,
        "space_snapshot_id": space.snapshot_id,
        "catalog_count": len(source.catalog),
        "real_class_count": sum(1 for entry in source.catalog if entry["descriptor"]["class_id"]),
        "special_count": sum(1 for entry in source.catalog if entry["status"] == "special"),
        "raw_record_count": raw_records,
        "course_count": len(courses),
        "teaching_class_count": len(teaching_classes),
        "recognized_space_family_count": len(families),
        "location_count": len(locations),
        "resolved_locations": [{"location": location, "count": count} for location, count in sorted(terminal.items())],
        "ambiguous_locations": [{"location": location, "count": count} for location, count in sorted(ambiguous.items())],
        "non_physical_locations": [{"location": location, "count": count} for location, count in sorted(non_physical.items())],
        "unresolved_locations": [{"location": location, "count": count} for location, count in sorted(unresolved.items())],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit a TeachingScheduleSource against the current SpaceSnapshot")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--space", required=True, type=Path)
    arguments = parser.parse_args()
    print(json.dumps(audit_teaching_source(arguments.source, arguments.space), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
