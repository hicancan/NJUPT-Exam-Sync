from __future__ import annotations

import argparse
from pathlib import Path

from academics.exam.snapshot.model import load_exam_snapshot

from .occupancy.build import write_room_occupancy_artifacts


def main() -> None:
    parser = argparse.ArgumentParser(description="Build RoomOccupancy from one ExamSnapshot.")
    parser.add_argument("--exam", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    write_room_occupancy_artifacts(
        output_dir=args.output,
        exam_snapshot=load_exam_snapshot(args.exam),
        catalog_path=args.catalog,
    )
