from __future__ import annotations

import hashlib
import json
import logging
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from ..records.extract import get_xlsx_files, process_single_file
from ..records.identity import canonicalize_exam_records
from ..records.model import ExamDataError, parse_exam_period
from .model import (
    CLASS_CHUNK_FORMAT,
    CLASS_INDEX_FORMAT,
    EXAM_SNAPSHOT_FORMAT,
    artifact_ref,
    exam_snapshot_id,
    load_exam_snapshot,
)

logger = logging.getLogger(__name__)
CLASS_CHUNK_TARGET_BYTES = 256 * 1024


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def get_source_updated_at(metadata: dict[str, Any]) -> str:
    value = metadata.get("source_updated_at")
    if not isinstance(value, str) or not value.strip():
        raise ExamDataError(
            "materialized exam source metadata is missing source_updated_at"
        )
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ExamDataError(
            "materialized exam source metadata has invalid source_updated_at"
        ) from exc
    if parsed.tzinfo is None:
        raise ExamDataError(
            "materialized exam source metadata source_updated_at must include a timezone"
        )
    return value


def load_source_metadata(data_dir: Path) -> dict[str, Any]:
    metadata_path = data_dir / "source_metadata.json"
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ExamDataError(f"Failed to load source metadata: {metadata_path}") from exc
    if not isinstance(metadata, dict):
        raise ExamDataError(f"Source metadata must be an object: {metadata_path}")
    source_id = metadata.get("source_id")
    if (
        not isinstance(source_id, str)
        or len(source_id) != 64
        or any(character not in "0123456789abcdef" for character in source_id)
    ):
        raise ExamDataError(f"Source metadata has invalid source_id: {metadata_path}")
    return metadata


def write_json_file(path: Path, payload: Any, *, compact: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        if compact:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")


def _records_by_class(records: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        class_name = str(record.get("class_name") or "").strip()
        if not class_name:
            raise ExamDataError(f"Exam record is missing class_name: {record.get('id')}")
        grouped.setdefault(class_name, []).append(record)
    for class_records in grouped.values():
        class_records.sort(
            key=lambda item: (
                str(item.get("start_timestamp") or ""),
                str(item.get("id") or ""),
            )
        )
    return grouped


def _class_key(class_name: str) -> str:
    return "class-" + _sha256(class_name.encode("utf-8"))[:16]


def _class_chunks(
    records: list[dict[str, Any]],
) -> list[dict[str, dict[str, Any]]]:
    grouped = _records_by_class(records)
    chunks: list[dict[str, dict[str, Any]]] = []
    current: dict[str, dict[str, Any]] = {}
    current_bytes = 0
    for class_name in sorted(grouped):
        class_key = _class_key(class_name)
        class_payload = {"class_name": class_name, "exams": grouped[class_name]}
        encoded_size = len(
            json.dumps(
                {class_key: class_payload},
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
        )
        if current and current_bytes + encoded_size > CLASS_CHUNK_TARGET_BYTES:
            chunks.append(current)
            current = {}
            current_bytes = 0
        current[class_key] = class_payload
        current_bytes += encoded_size
    if current:
        chunks.append(current)
    return chunks


def _build_snapshot(input_dir: Path, output_dir: Path) -> dict[str, Any]:
    files = get_xlsx_files(input_dir)
    if not files:
        raise ExamDataError(f"No .xlsx files found in '{input_dir}'.")

    source_rows: list[dict[str, Any]] = []
    for file_path in files:
        result = process_single_file(file_path)
        if result["parse_fail_count"] > 0:
            raise ExamDataError(
                f"{result['filename']} has {result['parse_fail_count']} unparsable exam rows"
            )
        source_rows.extend(result["raw_data"])
    if not source_rows:
        raise ExamDataError("Exam source contains no records")

    metadata = load_source_metadata(input_dir)
    period = parse_exam_period(metadata.get("source_title"))
    for row in source_rows:
        row["exam_period_id"] = period.exam_period_id
    records = canonicalize_exam_records(source_rows)

    records_path = output_dir / "exams.json"
    write_json_file(records_path, records, compact=True)
    records_id = _sha256(records_path.read_bytes())

    chunk_refs: list[dict[str, Any]] = []
    class_entries: list[dict[str, Any]] = []
    for index, classes in enumerate(_class_chunks(records)):
        canonical_classes = json.dumps(
            classes,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        chunk_id = _sha256(canonical_classes)
        relative_path = f"classes-{index:03d}.json"
        payload = {
            "format": CLASS_CHUNK_FORMAT,
            "records_id": records_id,
            "chunk_id": chunk_id,
            "classes": classes,
        }
        write_json_file(output_dir / relative_path, payload, compact=True)
        chunk_refs.append(artifact_ref(output_dir, relative_path))
        for class_key, class_payload in classes.items():
            class_entries.append(
                {
                    "class_name": class_payload["class_name"],
                    "class_key": class_key,
                    "record_count": len(class_payload["exams"]),
                    "chunk_path": relative_path,
                    "chunk_id": chunk_id,
                }
            )

    class_entries.sort(key=lambda entry: str(entry["class_name"]))
    class_index = {
        "format": CLASS_INDEX_FORMAT,
        "records_id": records_id,
        "total_records": len(records),
        "class_count": len(class_entries),
        "classes": class_entries,
    }
    write_json_file(output_dir / "class-index.json", class_index, compact=True)

    records_ref = artifact_ref(output_dir, "exams.json")
    class_index_ref = artifact_ref(output_dir, "class-index.json")
    source_id = str(metadata["source_id"])
    snapshot_id = exam_snapshot_id(
        source_id=source_id,
        records_id=records_id,
        records=records_ref,
        class_index=class_index_ref,
        class_chunks=chunk_refs,
    )
    manifest = {
        "format": EXAM_SNAPSHOT_FORMAT,
        "snapshot_id": snapshot_id,
        "source_id": source_id,
        "records_id": records_id,
        "source_updated_at": get_source_updated_at(metadata),
        "source_url": metadata.get("source_url"),
        "source_title": metadata.get("source_title"),
        "exam_period": {
            "id": period.exam_period_id,
            "academic_year": period.academic_year,
            "term_number": period.term_number,
            "term_label": period.term_label,
        },
        "total_records": len(records),
        "records": records_ref,
        "class_index": class_index_ref,
        "class_chunks": chunk_refs,
    }
    write_json_file(output_dir / "manifest.json", manifest, compact=False)
    return manifest


def publish_exam_artifacts(*, input_dir: Path, output_dir: Path) -> dict[str, Any]:
    """Build, self-validate, then replace one complete ExamSnapshot."""

    output_dir = output_dir.resolve()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = output_dir.with_name(f"{output_dir.name}.staging-{uuid.uuid4().hex}")
    backup = output_dir.with_name(f"{output_dir.name}.backup-{uuid.uuid4().hex}")
    staging.mkdir()
    replaced_existing = False
    try:
        manifest = _build_snapshot(input_dir.resolve(), staging)
        load_exam_snapshot(staging)
        if output_dir.exists():
            output_dir.replace(backup)
            replaced_existing = True
        staging.replace(output_dir)
        if replaced_existing:
            shutil.rmtree(backup)
        return manifest
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        if replaced_existing and backup.exists() and not output_dir.exists():
            backup.replace(output_dir)
        raise
