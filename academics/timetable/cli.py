from __future__ import annotations

import argparse
from pathlib import Path

from .build import publish_teaching_artifacts
from .model import TeachingScheduleError, read_json, require_sha256


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compile a TeachingScheduleSource into current teaching artifacts")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--occupancy", required=True, type=Path)
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--exam", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    arguments = parse_arguments()
    exam_manifest = read_json(arguments.exam / "manifest.json")
    if not isinstance(exam_manifest, dict):
        raise TeachingScheduleError("ExamSnapshot manifest must be an object")
    exam_snapshot_id = require_sha256(exam_manifest.get("snapshot_id"), "ExamSnapshot snapshot_id")
    snapshot, occupancy = publish_teaching_artifacts(
        source_dir=arguments.source,
        snapshot_dir=arguments.snapshot,
        occupancy_dir=arguments.occupancy,
        catalog_path=arguments.catalog,
        exam_snapshot_id=exam_snapshot_id,
    )
    print(
        f"TeachingScheduleSnapshot {snapshot['snapshot_id']} "
        f"({snapshot['class_count']} classes, {snapshot['meeting_count']} meetings)"
    )
    print(
        f"TeachingRoomOccupancy {occupancy['occupancy_id']} "
        f"({len(occupancy['rooms'])} rooms, {len(occupancy['days'])} days)"
    )


if __name__ == "__main__":
    main()
