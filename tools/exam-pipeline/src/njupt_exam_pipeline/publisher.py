from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from .contract import ExamPipelineError, parse_exam_period
from .diff import canonicalize_exam_records, class_file_key
from .processor import get_xlsx_files, process_single_file

logger = logging.getLogger(__name__)


def get_beijing_time() -> datetime:
    locked_value = os.environ.get("NJUPT_SEARCH_GENERATED_AT")
    if locked_value:
        return datetime.fromisoformat(locked_value).astimezone(timezone(timedelta(hours=8)))
    return datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=8)))


def get_exam_data_version(metadata: dict[str, Any]) -> str:
    locked_value = os.environ.get("NJUPT_SEARCH_EXAM_DATA_VERSION")
    if locked_value:
        return locked_value
    metadata_value = metadata.get("data_version")
    if isinstance(metadata_value, str) and metadata_value.strip():
        return metadata_value.strip()
    raise ExamPipelineError("NJUPT_SEARCH_EXAM_DATA_VERSION is required to build exam data_summary.json")


def load_source_metadata(data_dir: Path) -> dict[str, Any]:
    metadata_path = data_dir / "source_metadata.json"
    if not metadata_path.exists():
        return {}
    try:
        with metadata_path.open("r", encoding="utf-8") as handle:
            metadata = json.load(handle)
    except Exception as exc:
        raise ExamPipelineError(f"Failed to load source metadata: {metadata_path}") from exc
    if not isinstance(metadata, dict):
        raise ExamPipelineError(f"Source metadata must be a JSON object: {metadata_path}")
    return metadata


def write_json_file(path: Path, payload: Any, *, compact: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("w", encoding="utf-8", newline="\n") as handle:
            if compact:
                json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            else:
                json.dump(payload, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
    except Exception as exc:
        raise ExamPipelineError(f"Failed to write {path}") from exc


def _records_by_class(records: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        class_name = str(record.get("class_name") or "").strip()
        if not class_name:
            raise ExamPipelineError(f"Exam record is missing class_name: {record.get('id')}")
        grouped.setdefault(class_name, []).append(record)
    for class_records in grouped.values():
        class_records.sort(key=lambda item: (str(item.get("start_timestamp") or ""), str(item.get("id") or "")))
    return grouped


def write_class_exam_artifacts(
    *,
    data_dir: Path,
    records: list[dict[str, Any]],
    manifest: dict[str, Any],
) -> None:
    classes_dir = data_dir / "classes"
    classes_dir.mkdir(parents=True, exist_ok=True)
    for stale_file in classes_dir.glob("*.json"):
        stale_file.unlink()

    grouped = _records_by_class(records)
    class_entries: list[dict[str, Any]] = []
    for class_name in sorted(grouped):
        class_key = class_file_key(class_name)
        class_records = grouped[class_name]
        class_path = f"generated/exam/classes/{class_key}.json"
        history_path = f"generated/exam/history/classes/{class_key}.json"
        payload = {
            "version": "exam-class-data-v1",
            "exam_period_id": manifest["exam_period_id"],
            "academic_year": manifest["academic_year"],
            "term_number": manifest["term_number"],
            "term_label": manifest["term_label"],
            "data_version": manifest["data_version"],
            "generated_at": manifest["generated_at"],
            "source_url": manifest.get("source_url"),
            "source_title": manifest.get("source_title"),
            "class_name": class_name,
            "class_key": class_key,
            "record_count": len(class_records),
            "exams": class_records,
        }
        write_json_file(classes_dir / f"{class_key}.json", payload, compact=True)
        class_entries.append(
            {
                "class_name": class_name,
                "class_key": class_key,
                "exam_period_id": manifest["exam_period_id"],
                "record_count": len(class_records),
                "path": class_path,
                "history_path": history_path,
            }
        )

    class_index = {
        "version": "exam-class-index-v1",
        "generated_at": manifest["generated_at"],
        "data_version": manifest["data_version"],
        "exam_period_id": manifest["exam_period_id"],
        "academic_year": manifest["academic_year"],
        "term_number": manifest["term_number"],
        "term_label": manifest["term_label"],
        "source_url": manifest.get("source_url"),
        "source_title": manifest.get("source_title"),
        "total_records": manifest["total_records"],
        "class_count": len(class_entries),
        "classes": class_entries,
    }
    write_json_file(data_dir / "class_index.json", class_index, compact=False)


def publish_exam_artifacts(
    *,
    data_dir: Path,
    merged_json_path: Path,
) -> None:
    logger.info("Starting data extraction process (Pydantic Powered)...")
    files = get_xlsx_files(data_dir)
    if not files:
        raise ExamPipelineError(f"No .xlsx files found in '{data_dir}'.")

    analyses: list[dict[str, Any]] = []
    all_rows: list[dict[str, Any]] = []
    for file_path in files:
        result = process_single_file(file_path)
        if result["parse_fail_count"] > 0:
            raise ExamPipelineError(f"{result['filename']} has {result['parse_fail_count']} unparsable exam rows")
        analyses.append(result)
        all_rows.extend(result["raw_data"])

    if not analyses:
        raise ExamPipelineError("No exam spreadsheets were processed")
    all_rows = canonicalize_exam_records(all_rows)

    metadata = load_source_metadata(data_dir)
    period = parse_exam_period(metadata.get("source_title"))
    generated_at = get_beijing_time()
    data_version = get_exam_data_version(metadata)
    for row in all_rows:
        row["exam_period_id"] = period.exam_period_id

    logger.info("Saving %s records to %s...", len(all_rows), merged_json_path)
    write_json_file(merged_json_path, all_rows, compact=True)

    manifest = {
        "generated_at": generated_at.isoformat(),
        "data_version": data_version,
        "exam_period_id": period.exam_period_id,
        "academic_year": period.academic_year,
        "term_number": period.term_number,
        "term_label": period.term_label,
        "files_processed": [analysis["filename"] for analysis in analyses],
        "total_records": len(all_rows),
        "source_url": metadata.get("source_url"),
        "source_title": metadata.get("source_title"),
    }
    write_json_file(data_dir / "data_summary.json", manifest, compact=False)
    write_class_exam_artifacts(data_dir=data_dir, records=all_rows, manifest=manifest)

    logger.info("Data processing and updates complete.")
