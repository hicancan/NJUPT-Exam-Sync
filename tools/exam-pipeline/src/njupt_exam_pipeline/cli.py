from __future__ import annotations

import argparse
from pathlib import Path

from .publisher import publish_exam_artifacts
from .source import update_exam_lock


REPO_ROOT = Path(__file__).resolve().parents[4]
EXAM_DIR = REPO_ROOT / "apps" / "web" / "public" / "generated" / "exam"
EXAM_LOCK = REPO_ROOT / "config" / "data-locks" / "exam.lock.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Update and process njupt-search exam artifacts.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("update-lock", help="Update exam.lock.json from JWC.")
    subparsers.add_parser("process", help="Process downloaded exam spreadsheets into JSON artifacts.")
    args = parser.parse_args()

    if args.command == "update-lock":
        update_exam_lock(EXAM_LOCK)
    elif args.command == "process":
        publish_exam_artifacts(
            data_dir=EXAM_DIR,
            output_doc_path=EXAM_DIR / "DATA_INVENTORY.md",
            merged_json_path=EXAM_DIR / "all_exams.json",
        )
