from __future__ import annotations

import argparse
from .snapshot.build import publish_exam_artifacts
from .source.discovery import materialize_exam_files, update_exam_source
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Discover, materialize, and build ExamSnapshot artifacts.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    update = subparsers.add_parser("update-source", help="Discover the current exam source.")
    update.add_argument("--source", type=Path, required=True)

    materialize = subparsers.add_parser("materialize", help="Materialize an explicit exam source.")
    materialize.add_argument("--source", type=Path, required=True)
    materialize.add_argument("--materialized", type=Path, required=True)
    materialize.add_argument("--cache", type=Path, required=True)

    build = subparsers.add_parser("build", help="Build one ExamSnapshot from materialized input.")
    build.add_argument("--materialized", type=Path, required=True)
    build.add_argument("--output", type=Path, required=True)
    build.add_argument("--history", type=Path, action="append", default=[])
    args = parser.parse_args()

    if args.command == "update-source":
        update_exam_source(args.source)
    elif args.command == "materialize":
        materialize_exam_files(
            source_path=args.source,
            exam_dir=args.materialized,
            cache_root=args.cache,
        )
    elif args.command == "build":
        publish_exam_artifacts(
            input_dir=args.materialized,
            output_dir=args.output,
            previous_snapshots=tuple(args.history),
        )
