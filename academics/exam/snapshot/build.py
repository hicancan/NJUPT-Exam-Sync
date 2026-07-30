from __future__ import annotations

import json
import logging
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any

from ..records.model import ExamDataError, parse_exam_period
from ..records.identity import canonicalize_exam_records, class_file_key
from ..records.extract import get_xlsx_files, process_single_file
from .model import EXAM_SNAPSHOT_FORMAT, exam_snapshot_id

logger = logging.getLogger(__name__)

def get_exam_data_version(metadata: dict[str, Any]) -> str:
    metadata_value = metadata.get("data_version")
    if isinstance(metadata_value, str) and metadata_value.strip():
        return metadata_value.strip()
    raise ExamDataError("materialized exam source metadata is missing data_version")


def get_source_updated_at(metadata: dict[str, Any]) -> str:
    value = metadata.get("updated_at")
    if not isinstance(value, str) or not value.strip():
        raise ExamDataError("materialized exam source metadata is missing updated_at")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ExamDataError("materialized exam source metadata has invalid updated_at") from exc
    if parsed.tzinfo is None:
        raise ExamDataError("materialized exam source metadata updated_at must include a timezone")
    return value


def load_source_metadata(data_dir: Path) -> dict[str, Any]:
    metadata_path = data_dir / "source_metadata.json"
    if not metadata_path.exists():
        return {}
    try:
        with metadata_path.open("r", encoding="utf-8") as handle:
            metadata = json.load(handle)
    except Exception as exc:
        raise ExamDataError(f"Failed to load source metadata: {metadata_path}") from exc
    if not isinstance(metadata, dict):
        raise ExamDataError(f"Source metadata must be a JSON object: {metadata_path}")
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
        raise ExamDataError(f"Failed to write {path}") from exc


def artifact_ref(root: Path, relative_path: str) -> dict[str, Any]:
    path = root / relative_path
    content = path.read_bytes()
    return {
        "path": relative_path,
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def _records_by_class(records: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        class_name = str(record.get("class_name") or "").strip()
        if not class_name:
            raise ExamDataError(f"Exam record is missing class_name: {record.get('id')}")
        grouped.setdefault(class_name, []).append(record)
    for class_records in grouped.values():
        class_records.sort(key=lambda item: (str(item.get("start_timestamp") or ""), str(item.get("id") or "")))
    return grouped


def write_class_exam_artifacts(
    *,
    output_dir: Path,
    records: list[dict[str, Any]],
    manifest: dict[str, Any],
) -> None:
    classes_dir = output_dir / "classes"
    classes_dir.mkdir(parents=True, exist_ok=True)
    for stale_file in classes_dir.glob("*.json"):
        stale_file.unlink()

    grouped = _records_by_class(records)
    class_entries: list[dict[str, Any]] = []
    for class_name in sorted(grouped):
        class_key = class_file_key(class_name)
        class_records = grouped[class_name]
        class_path = f"classes/{class_key}.json"
        history_path = f"history/classes/{class_key}.json"
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
                "data": artifact_ref(output_dir, class_path),
                "history": artifact_ref(output_dir, history_path),
            }
        )

    class_index = {
        "version": "exam-class-index-v2",
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
    write_json_file(output_dir / "class-index.json", class_index, compact=False)


def publish_exam_artifacts(
    *,
    input_dir: Path,
    output_dir: Path,
    previous_snapshots: tuple[Path, ...] = (),
) -> dict[str, Any]:
    logger.info("Building ExamSnapshot from %s", input_dir)
    files = get_xlsx_files(input_dir)
    if not files:
        raise ExamDataError(f"No .xlsx files found in '{input_dir}'.")

    analyses: list[dict[str, Any]] = []
    all_rows: list[dict[str, Any]] = []
    for file_path in files:
        result = process_single_file(file_path)
        if result["parse_fail_count"] > 0:
            raise ExamDataError(f"{result['filename']} has {result['parse_fail_count']} unparsable exam rows")
        analyses.append(result)
        all_rows.extend(result["raw_data"])

    if not analyses:
        raise ExamDataError("No exam spreadsheets were processed")
    all_rows = canonicalize_exam_records(all_rows)

    metadata = load_source_metadata(input_dir)
    period = parse_exam_period(metadata.get("source_title"))
    generated_at = get_source_updated_at(metadata)
    data_version = get_exam_data_version(metadata)
    for row in all_rows:
        row["exam_period_id"] = period.exam_period_id

    output_dir.mkdir(parents=True, exist_ok=True)
    records_path = output_dir / "exams.json"
    logger.info("Saving %s records to %s", len(all_rows), records_path)
    write_json_file(records_path, all_rows, compact=True)

    manifest = {
        "generated_at": generated_at,
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
    from ..history.build import build_exam_history, write_exam_history
    from .model import ExamSnapshot, load_exam_snapshot

    history_snapshots = [load_exam_snapshot(path) for path in previous_snapshots]
    history_snapshots.append(
        ExamSnapshot(
            data_version=data_version,
            auto_updated_at=manifest["generated_at"],
            exam_period_id=period.exam_period_id,
            academic_year=period.academic_year,
            term_number=period.term_number,
            term_label=period.term_label,
            source_url=manifest.get("source_url"),
            source_title=manifest.get("source_title"),
            records=all_rows,
        )
    )
    history_manifest, history_classes = build_exam_history(
        history_snapshots,
        generated_at=manifest["generated_at"],
    )
    write_exam_history(
        output_dir=output_dir,
        manifest=history_manifest,
        class_files=history_classes,
    )
    write_class_exam_artifacts(
        output_dir=output_dir,
        records=all_rows,
        manifest=manifest,
    )

    artifacts = {
        "records": artifact_ref(output_dir, "exams.json"),
        "class_index": artifact_ref(output_dir, "class-index.json"),
        "history_manifest": artifact_ref(output_dir, "history/manifest.json"),
    }
    manifest.update(
        {
            "format": EXAM_SNAPSHOT_FORMAT,
            "snapshot_id": exam_snapshot_id(data_version, artifacts),
            "artifacts": artifacts,
        }
    )
    write_json_file(output_dir / "manifest.json", manifest, compact=False)

    logger.info("ExamSnapshot build complete")
    return manifest
