from __future__ import annotations

import argparse
from pathlib import Path

from .build import build_space_snapshot


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the current authoritative SpaceSnapshot")
    parser.add_argument("--reviewed-geometry", required=True, type=Path)
    parser.add_argument("--teaching-source", required=True, type=Path)
    parser.add_argument("--exam-snapshot", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()
    manifest = build_space_snapshot(
        output_dir=arguments.output,
        reviewed_geometry_path=arguments.reviewed_geometry,
        teaching_source_path=arguments.teaching_source,
        exam_snapshot_path=arguments.exam_snapshot,
    )
    print(
        f"SpaceSnapshot {manifest['snapshot_id']} "
        f"({manifest['campus_count']} campuses, {manifest['building_count']} buildings, "
        f"{manifest['floor_count']} floors, {manifest['space_family_count']} families, "
        f"{manifest['space_unit_count']} units)"
    )
