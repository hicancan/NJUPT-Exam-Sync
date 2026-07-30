from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..records.model import ExamDataError

EXAM_SNAPSHOT_FORMAT = "njupt-exam-snapshot"
CLASS_INDEX_FORMAT = "njupt-exam-class-index"
CLASS_CHUNK_FORMAT = "njupt-exam-class-chunk"
SHA256_LENGTH = 64
MANIFEST_FIELDS = {
    "format",
    "snapshot_id",
    "source_id",
    "records_id",
    "source_updated_at",
    "source_url",
    "source_title",
    "exam_period",
    "total_records",
    "records",
    "class_index",
    "class_chunks",
}
EXAM_PERIOD_FIELDS = {"id", "academic_year", "term_number", "term_label"}
EXAM_RECORD_FIELDS = {
    "id",
    "stable_key",
    "content_fingerprint",
    "exam_period_id",
    "class_name",
    "course_name",
    "course_code",
    "teacher",
    "campus",
    "location",
    "raw_time",
    "count",
    "start_timestamp",
    "end_timestamp",
    "duration_minutes",
    "date",
    "notes",
}
CLASS_INDEX_FIELDS = {
    "format",
    "records_id",
    "total_records",
    "class_count",
    "classes",
}
CLASS_INDEX_ENTRY_FIELDS = {
    "class_name",
    "class_key",
    "record_count",
    "chunk_path",
    "chunk_id",
}
CLASS_CHUNK_FIELDS = {"format", "records_id", "chunk_id", "classes"}
CLASS_CHUNK_ENTRY_FIELDS = {"class_name", "exams"}


@dataclass(frozen=True)
class ExamSnapshot:
    snapshot_id: str
    source_id: str
    records_id: str
    source_updated_at: str
    exam_period_id: str
    academic_year: str
    term_number: int
    term_label: str
    source_url: str | None
    source_title: str | None
    records: list[dict[str, Any]]


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def artifact_ref(root: Path, relative_path: str) -> dict[str, Any]:
    content = (root / relative_path).read_bytes()
    return {
        "path": relative_path,
        "bytes": len(content),
        "sha256": _sha256(content),
    }


def _validate_artifact(
    snapshot_dir: Path,
    value: Any,
    *,
    expected_path: str | None = None,
) -> Path:
    if not isinstance(value, dict) or set(value) != {"path", "bytes", "sha256"}:
        raise ExamDataError("ExamSnapshot artifact reference is invalid")
    relative_path = value.get("path")
    if not isinstance(relative_path, str) or not relative_path:
        raise ExamDataError("ExamSnapshot artifact path is invalid")
    if expected_path is not None and relative_path != expected_path:
        raise ExamDataError(f"ExamSnapshot artifact path must be {expected_path}")
    path = snapshot_dir / relative_path
    try:
        content = path.read_bytes()
    except OSError as exc:
        raise ExamDataError(f"Missing ExamSnapshot artifact: {path}") from exc
    if value.get("bytes") != len(content):
        raise ExamDataError(f"ExamSnapshot artifact size mismatch: {relative_path}")
    if value.get("sha256") != _sha256(content):
        raise ExamDataError(f"ExamSnapshot artifact hash mismatch: {relative_path}")
    return path


def exam_snapshot_id(
    *,
    source_id: str,
    records_id: str,
    records: dict[str, Any],
    class_index: dict[str, Any],
    class_chunks: list[dict[str, Any]],
) -> str:
    identity = hashlib.sha256()
    for value in (EXAM_SNAPSHOT_FORMAT, source_id, records_id):
        identity.update(value.encode("utf-8"))
        identity.update(b"\0")
    for artifact in sorted(
        [records, class_index, *class_chunks], key=lambda item: str(item["path"])
    ):
        for value in (
            artifact["path"],
            str(artifact["bytes"]),
            artifact["sha256"],
        ):
            identity.update(str(value).encode("utf-8"))
            identity.update(b"\0")
    return identity.hexdigest()


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ExamDataError(f"Invalid ExamSnapshot JSON: {path}") from exc


def _require_sha256(value: Any, description: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) != SHA256_LENGTH
        or any(character not in "0123456789abcdef" for character in value)
    ):
        raise ExamDataError(f"{description} must be a SHA-256 hex string")
    return value


def load_exam_snapshot(snapshot_dir: Path) -> ExamSnapshot:
    manifest_path = snapshot_dir / "manifest.json"
    manifest = _read_json(manifest_path)
    if (
        not isinstance(manifest, dict)
        or set(manifest) != MANIFEST_FIELDS
        or manifest.get("format") != EXAM_SNAPSHOT_FORMAT
    ):
        raise ExamDataError(f"Unsupported ExamSnapshot: {manifest_path}")

    source_id = _require_sha256(manifest.get("source_id"), "source_id")
    records_id = _require_sha256(manifest.get("records_id"), "records_id")
    snapshot_id = _require_sha256(manifest.get("snapshot_id"), "snapshot_id")
    records_ref = manifest.get("records")
    class_index_ref = manifest.get("class_index")
    chunk_refs = manifest.get("class_chunks")
    if not isinstance(chunk_refs, list) or not chunk_refs:
        raise ExamDataError("ExamSnapshot class_chunks must be a non-empty list")

    records_path = _validate_artifact(
        snapshot_dir, records_ref, expected_path="exams.json"
    )
    class_index_path = _validate_artifact(
        snapshot_dir, class_index_ref, expected_path="class-index.json"
    )
    chunk_paths: dict[str, Path] = {}
    for ref in chunk_refs:
        path = _validate_artifact(snapshot_dir, ref)
        relative_path = str(ref["path"])
        if not relative_path.startswith("classes-") or not relative_path.endswith(".json"):
            raise ExamDataError(f"Invalid ExamSnapshot class chunk path: {relative_path}")
        if relative_path in chunk_paths:
            raise ExamDataError(f"Duplicate ExamSnapshot class chunk: {relative_path}")
        chunk_paths[relative_path] = path

    if snapshot_id != exam_snapshot_id(
        source_id=source_id,
        records_id=records_id,
        records=records_ref,
        class_index=class_index_ref,
        class_chunks=chunk_refs,
    ):
        raise ExamDataError(f"ExamSnapshot identity mismatch: {manifest_path}")

    expected_files = {
        "manifest.json",
        "exams.json",
        "class-index.json",
        *chunk_paths,
    }
    actual_files = {
        path.relative_to(snapshot_dir).as_posix()
        for path in snapshot_dir.rglob("*")
        if path.is_file()
    }
    if actual_files != expected_files:
        raise ExamDataError(
            f"ExamSnapshot file set mismatch: expected {sorted(expected_files)}, "
            f"got {sorted(actual_files)}"
        )

    records = _read_json(records_path)
    class_index = _read_json(class_index_path)
    if not isinstance(records, list) or not records:
        raise ExamDataError(f"ExamSnapshot has no records: {records_path}")
    if _sha256(records_path.read_bytes()) != records_id:
        raise ExamDataError("ExamSnapshot records_id does not identify exams.json")
    if manifest.get("total_records") != len(records):
        raise ExamDataError("ExamSnapshot total_records does not match exams.json")
    if any(not isinstance(record, dict) or set(record) != EXAM_RECORD_FIELDS for record in records):
        raise ExamDataError("ExamSnapshot contains an invalid exam record")
    record_ids = [record["id"] for record in records]
    if (
        any(not isinstance(record_id, str) or not record_id for record_id in record_ids)
        or len(set(record_ids)) != len(record_ids)
    ):
        raise ExamDataError("ExamSnapshot record IDs are missing or duplicated")

    if (
        not isinstance(class_index, dict)
        or set(class_index) != CLASS_INDEX_FIELDS
        or class_index.get("format") != CLASS_INDEX_FORMAT
        or class_index.get("records_id") != records_id
        or not isinstance(class_index.get("classes"), list)
    ):
        raise ExamDataError(f"Invalid ExamSnapshot class index: {class_index_path}")

    chunk_payloads: dict[str, dict[str, Any]] = {}
    for relative_path, path in chunk_paths.items():
        payload = _read_json(path)
        if (
            not isinstance(payload, dict)
            or set(payload) != CLASS_CHUNK_FIELDS
            or payload.get("format") != CLASS_CHUNK_FORMAT
            or payload.get("records_id") != records_id
            or not isinstance(payload.get("classes"), dict)
        ):
            raise ExamDataError(f"Invalid ExamSnapshot class chunk: {path}")
        classes = payload["classes"]
        expected_chunk_id = _sha256(
            json.dumps(
                classes,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        )
        if payload.get("chunk_id") != expected_chunk_id:
            raise ExamDataError(f"ExamSnapshot class chunk identity mismatch: {path}")
        chunk_payloads[relative_path] = payload

    seen_classes: set[str] = set()
    indexed_record_count = 0
    for entry in class_index["classes"]:
        if not isinstance(entry, dict) or set(entry) != CLASS_INDEX_ENTRY_FIELDS:
            raise ExamDataError("ExamSnapshot class index entry is invalid")
        class_name = entry.get("class_name")
        class_key = entry.get("class_key")
        chunk_path = entry.get("chunk_path")
        record_count = entry.get("record_count")
        if (
            not isinstance(class_name, str)
            or not class_name
            or not isinstance(class_key, str)
            or not class_key
            or class_name in seen_classes
            or not isinstance(record_count, int)
            or record_count <= 0
        ):
            raise ExamDataError("ExamSnapshot class index entry identity is invalid")
        chunk = chunk_payloads.get(str(chunk_path))
        class_payload = chunk["classes"].get(class_key) if chunk else None
        if (
            not isinstance(class_payload, dict)
            or set(class_payload) != CLASS_CHUNK_ENTRY_FIELDS
            or class_payload.get("class_name") != class_name
            or not isinstance(class_payload.get("exams"), list)
            or len(class_payload["exams"]) != record_count
            or any(
                not isinstance(record, dict)
                or record.get("class_name") != class_name
                for record in class_payload["exams"]
            )
        ):
            raise ExamDataError(f"ExamSnapshot class mapping is invalid: {class_name}")
        seen_classes.add(class_name)
        indexed_record_count += record_count

    if (
        class_index.get("class_count") != len(seen_classes)
        or class_index.get("total_records") != len(records)
        or indexed_record_count != len(records)
    ):
        raise ExamDataError("ExamSnapshot class index counts do not match records")

    period = manifest.get("exam_period")
    if not isinstance(period, dict) or set(period) != EXAM_PERIOD_FIELDS:
        raise ExamDataError("ExamSnapshot exam_period is invalid")
    source_updated_at = manifest.get("source_updated_at")
    if not isinstance(source_updated_at, str) or not source_updated_at:
        raise ExamDataError("ExamSnapshot source_updated_at is invalid")
    for field in ("source_url", "source_title"):
        if manifest.get(field) is not None and (
            not isinstance(manifest[field], str) or not manifest[field]
        ):
            raise ExamDataError(f"ExamSnapshot {field} is invalid")
    return ExamSnapshot(
        snapshot_id=snapshot_id,
        source_id=source_id,
        records_id=records_id,
        source_updated_at=source_updated_at,
        exam_period_id=str(period["id"]),
        academic_year=str(period["academic_year"]),
        term_number=int(period["term_number"]),
        term_label=str(period["term_label"]),
        source_url=manifest.get("source_url"),
        source_title=manifest.get("source_title"),
        records=records,
    )
