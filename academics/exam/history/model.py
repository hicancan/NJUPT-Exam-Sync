from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..records.model import ExamDataError
from ..snapshot.model import artifact_ref

EXAM_HISTORY_FORMAT = "njupt-exam-history"
EVENTS_FORMAT = "njupt-exam-history-events"
CLASS_INDEX_FORMAT = "njupt-exam-history-class-index"
CLASS_CHUNK_FORMAT = "njupt-exam-history-class-chunk"
SHA256_LENGTH = 64

MANIFEST_FIELDS = {
    "format",
    "history_id",
    "exam_period_id",
    "academic_year",
    "term_number",
    "term_label",
    "baseline_snapshot_id",
    "current_snapshot_id",
    "current_source_updated_at",
    "observed_snapshot_count",
    "events",
    "class_index",
    "class_chunks",
}
EVENTS_FIELDS = {
    "format",
    "exam_period_id",
    "baseline_snapshot_id",
    "current_snapshot_id",
    "observed_snapshot_count",
    "events",
}
GLOBAL_EVENT_FIELDS = {
    "snapshot_id",
    "previous_snapshot_id",
    "source_updated_at",
    "status",
    "total_records",
    "total_classes",
    "affected_class_count",
    "added",
    "removed",
    "changed",
    "unchanged",
}
CLASS_INDEX_FIELDS = {
    "format",
    "exam_period_id",
    "current_snapshot_id",
    "observed_snapshot_count",
    "class_count",
    "classes",
}
CLASS_INDEX_ENTRY_FIELDS = {
    "class_name",
    "class_key",
    "observed_snapshot_count",
    "affected_event_count",
    "current_record_count",
    "latest_affected_at",
    "chunk_path",
    "chunk_id",
}
CLASS_CHUNK_FIELDS = {
    "format",
    "exam_period_id",
    "current_snapshot_id",
    "chunk_id",
    "classes",
}
CLASS_HISTORY_FIELDS = {
    "class_name",
    "class_key",
    "observed_snapshot_count",
    "affected_event_count",
    "current_record_count",
    "latest_affected_at",
    "events",
}
CLASS_EVENT_FIELDS = {
    "snapshot_id",
    "previous_snapshot_id",
    "source_updated_at",
    "status",
    "previous_record_count",
    "current_record_count",
    "changes",
}
CHANGE_FIELDS = {
    "type",
    "history_key",
    "course_name",
    "course_code",
    "teacher",
    "fields",
}
FIELD_CHANGE_FIELDS = {"field", "before", "after"}


@dataclass(frozen=True)
class ExamHistory:
    history_id: str
    exam_period_id: str
    academic_year: str
    term_number: int
    term_label: str
    baseline_snapshot_id: str
    current_snapshot_id: str
    current_source_updated_at: str
    observed_snapshot_count: int
    events: list[dict[str, Any]]
    class_index: list[dict[str, Any]]
    classes: dict[str, dict[str, Any]]


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _require_hash(value: Any, description: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) != SHA256_LENGTH
        or any(character not in "0123456789abcdef" for character in value)
    ):
        raise ExamDataError(f"{description} must be a SHA-256 hex string")
    return value


def _require_string(value: Any, description: str) -> str:
    if not isinstance(value, str) or not value:
        raise ExamDataError(f"{description} must be a non-empty string")
    return value


def _require_nonnegative_int(value: Any, description: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ExamDataError(f"{description} must be a nonnegative integer")
    return value


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ExamDataError(f"Invalid ExamHistory JSON: {path}") from exc


def _validate_artifact(
    history_dir: Path,
    value: Any,
    *,
    expected_path: str | None = None,
) -> Path:
    if not isinstance(value, dict) or set(value) != {"path", "bytes", "sha256"}:
        raise ExamDataError("ExamHistory artifact reference is invalid")
    relative_path = value.get("path")
    if not isinstance(relative_path, str) or not relative_path:
        raise ExamDataError("ExamHistory artifact path is invalid")
    if expected_path is not None and relative_path != expected_path:
        raise ExamDataError(f"ExamHistory artifact path must be {expected_path}")
    path = history_dir / relative_path
    try:
        content = path.read_bytes()
    except OSError as exc:
        raise ExamDataError(f"Missing ExamHistory artifact: {path}") from exc
    if value.get("bytes") != len(content) or value.get("sha256") != _sha256(content):
        raise ExamDataError(f"ExamHistory artifact identity mismatch: {relative_path}")
    return path


def exam_history_id(
    *,
    exam_period_id: str,
    academic_year: str,
    term_number: int,
    term_label: str,
    baseline_snapshot_id: str,
    current_snapshot_id: str,
    current_source_updated_at: str,
    observed_snapshot_count: int,
    events: dict[str, Any],
    class_index: dict[str, Any],
    class_chunks: list[dict[str, Any]],
) -> str:
    identity = hashlib.sha256()
    values: list[Any] = [
        EXAM_HISTORY_FORMAT,
        exam_period_id,
        academic_year,
        term_number,
        term_label,
        baseline_snapshot_id,
        current_snapshot_id,
        current_source_updated_at,
        observed_snapshot_count,
    ]
    for value in values:
        identity.update(str(value).encode("utf-8"))
        identity.update(b"\0")
    for artifact in sorted(
        [events, class_index, *class_chunks], key=lambda item: str(item["path"])
    ):
        for value in (artifact["path"], artifact["bytes"], artifact["sha256"]):
            identity.update(str(value).encode("utf-8"))
            identity.update(b"\0")
    return identity.hexdigest()


def _validate_change(change: Any) -> None:
    if not isinstance(change, dict) or set(change) != CHANGE_FIELDS:
        raise ExamDataError("ExamHistory change is invalid")
    if change.get("type") not in {"added", "removed", "changed"}:
        raise ExamDataError("ExamHistory change type is invalid")
    for field in ("history_key", "course_name", "course_code", "teacher"):
        if not isinstance(change.get(field), str):
            raise ExamDataError(f"ExamHistory change {field} is invalid")
    fields = change.get("fields")
    if not isinstance(fields, list) or not fields:
        raise ExamDataError("ExamHistory change fields must be non-empty")
    names: set[str] = set()
    for field in fields:
        if not isinstance(field, dict) or set(field) != FIELD_CHANGE_FIELDS:
            raise ExamDataError("ExamHistory field change is invalid")
        name = _require_string(field.get("field"), "ExamHistory changed field")
        if name in names or field.get("before") == field.get("after"):
            raise ExamDataError("ExamHistory field change is duplicated or unchanged")
        names.add(name)


def _validate_class_history(value: Any, class_key: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != CLASS_HISTORY_FIELDS:
        raise ExamDataError(f"ExamHistory class payload is invalid: {class_key}")
    if value.get("class_key") != class_key:
        raise ExamDataError(f"ExamHistory class key mismatch: {class_key}")
    _require_string(value.get("class_name"), "ExamHistory class_name")
    observed = _require_nonnegative_int(
        value.get("observed_snapshot_count"), "ExamHistory observed_snapshot_count"
    )
    if observed < 1:
        raise ExamDataError("ExamHistory class observed_snapshot_count must be positive")
    affected = _require_nonnegative_int(
        value.get("affected_event_count"), "ExamHistory affected_event_count"
    )
    _require_nonnegative_int(
        value.get("current_record_count"), "ExamHistory current_record_count"
    )
    latest = value.get("latest_affected_at")
    if latest is not None and not isinstance(latest, str):
        raise ExamDataError("ExamHistory latest_affected_at is invalid")
    events = value.get("events")
    if not isinstance(events, list) or not events:
        raise ExamDataError("ExamHistory class events must be non-empty")
    actual_affected = 0
    for event in events:
        if not isinstance(event, dict) or set(event) != CLASS_EVENT_FIELDS:
            raise ExamDataError("ExamHistory class event is invalid")
        _require_hash(event.get("snapshot_id"), "ExamHistory class snapshot_id")
        previous = event.get("previous_snapshot_id")
        if previous is not None:
            _require_hash(previous, "ExamHistory class previous_snapshot_id")
        _require_string(event.get("source_updated_at"), "ExamHistory class event time")
        if event.get("status") not in {"first_seen", "changed", "removed", "reappeared"}:
            raise ExamDataError("ExamHistory class status is invalid")
        _require_nonnegative_int(event.get("previous_record_count"), "previous_record_count")
        _require_nonnegative_int(event.get("current_record_count"), "current_record_count")
        changes = event.get("changes")
        if not isinstance(changes, list):
            raise ExamDataError("ExamHistory class changes must be a list")
        for change in changes:
            _validate_change(change)
        if previous is not None:
            actual_affected += 1
    if actual_affected != affected:
        raise ExamDataError("ExamHistory affected_event_count mismatch")
    if (affected == 0) != (latest is None):
        raise ExamDataError("ExamHistory latest_affected_at mismatch")
    return value


def load_exam_history(history_dir: Path) -> ExamHistory:
    manifest_path = history_dir / "manifest.json"
    manifest = _read_json(manifest_path)
    if (
        not isinstance(manifest, dict)
        or set(manifest) != MANIFEST_FIELDS
        or manifest.get("format") != EXAM_HISTORY_FORMAT
    ):
        raise ExamDataError(f"Unsupported ExamHistory: {manifest_path}")

    history_id = _require_hash(manifest.get("history_id"), "history_id")
    baseline_snapshot_id = _require_hash(
        manifest.get("baseline_snapshot_id"), "baseline_snapshot_id"
    )
    current_snapshot_id = _require_hash(
        manifest.get("current_snapshot_id"), "current_snapshot_id"
    )
    observed_snapshot_count = _require_nonnegative_int(
        manifest.get("observed_snapshot_count"), "observed_snapshot_count"
    )
    if observed_snapshot_count < 1:
        raise ExamDataError("ExamHistory observed_snapshot_count must be positive")
    events_ref = manifest.get("events")
    index_ref = manifest.get("class_index")
    chunk_refs = manifest.get("class_chunks")
    if not isinstance(chunk_refs, list) or not chunk_refs:
        raise ExamDataError("ExamHistory class_chunks must be non-empty")
    events_path = _validate_artifact(history_dir, events_ref, expected_path="events.json")
    index_path = _validate_artifact(
        history_dir, index_ref, expected_path="class-index.json"
    )
    chunk_paths: dict[str, Path] = {}
    for index, ref in enumerate(chunk_refs):
        expected_path = f"classes-{index:03d}.json"
        path = _validate_artifact(history_dir, ref, expected_path=expected_path)
        chunk_paths[expected_path] = path

    expected_history_id = exam_history_id(
        exam_period_id=_require_string(manifest.get("exam_period_id"), "exam_period_id"),
        academic_year=_require_string(manifest.get("academic_year"), "academic_year"),
        term_number=_require_nonnegative_int(manifest.get("term_number"), "term_number"),
        term_label=_require_string(manifest.get("term_label"), "term_label"),
        baseline_snapshot_id=baseline_snapshot_id,
        current_snapshot_id=current_snapshot_id,
        current_source_updated_at=_require_string(
            manifest.get("current_source_updated_at"), "current_source_updated_at"
        ),
        observed_snapshot_count=observed_snapshot_count,
        events=events_ref,
        class_index=index_ref,
        class_chunks=chunk_refs,
    )
    if history_id != expected_history_id:
        raise ExamDataError("ExamHistory identity mismatch")

    expected_files = {"manifest.json", "events.json", "class-index.json", *chunk_paths}
    actual_files = {
        path.relative_to(history_dir).as_posix()
        for path in history_dir.rglob("*")
        if path.is_file()
    }
    if actual_files != expected_files:
        raise ExamDataError(
            f"ExamHistory file set mismatch: expected {sorted(expected_files)}, "
            f"got {sorted(actual_files)}"
        )

    events_payload = _read_json(events_path)
    if (
        not isinstance(events_payload, dict)
        or set(events_payload) != EVENTS_FIELDS
        or events_payload.get("format") != EVENTS_FORMAT
        or events_payload.get("exam_period_id") != manifest["exam_period_id"]
        or events_payload.get("baseline_snapshot_id") != baseline_snapshot_id
        or events_payload.get("current_snapshot_id") != current_snapshot_id
        or events_payload.get("observed_snapshot_count") != observed_snapshot_count
        or not isinstance(events_payload.get("events"), list)
        or len(events_payload["events"]) != observed_snapshot_count
    ):
        raise ExamDataError("ExamHistory events payload is invalid")
    previous_snapshot: str | None = None
    for index, event in enumerate(events_payload["events"]):
        if not isinstance(event, dict) or set(event) != GLOBAL_EVENT_FIELDS:
            raise ExamDataError("ExamHistory global event is invalid")
        snapshot_id = _require_hash(event.get("snapshot_id"), "event snapshot_id")
        previous = event.get("previous_snapshot_id")
        if previous is not None:
            _require_hash(previous, "event previous_snapshot_id")
        if previous != previous_snapshot:
            raise ExamDataError("ExamHistory snapshot chain is broken")
        if index == 0 and event.get("status") != "baseline":
            raise ExamDataError("ExamHistory must start with a baseline")
        if index > 0 and event.get("status") not in {"changed", "unchanged"}:
            raise ExamDataError("ExamHistory update status is invalid")
        _require_string(event.get("source_updated_at"), "event source_updated_at")
        for field in (
            "total_records",
            "total_classes",
            "affected_class_count",
            "added",
            "removed",
            "changed",
            "unchanged",
        ):
            _require_nonnegative_int(event.get(field), f"event {field}")
        previous_snapshot = snapshot_id
    if previous_snapshot != current_snapshot_id:
        raise ExamDataError("ExamHistory current snapshot is not the event chain head")

    index_payload = _read_json(index_path)
    if (
        not isinstance(index_payload, dict)
        or set(index_payload) != CLASS_INDEX_FIELDS
        or index_payload.get("format") != CLASS_INDEX_FORMAT
        or index_payload.get("exam_period_id") != manifest["exam_period_id"]
        or index_payload.get("current_snapshot_id") != current_snapshot_id
        or index_payload.get("observed_snapshot_count") != observed_snapshot_count
        or not isinstance(index_payload.get("classes"), list)
        or index_payload.get("class_count") != len(index_payload["classes"])
    ):
        raise ExamDataError("ExamHistory class index is invalid")

    chunks: dict[str, dict[str, Any]] = {}
    for relative_path, path in chunk_paths.items():
        payload = _read_json(path)
        if (
            not isinstance(payload, dict)
            or set(payload) != CLASS_CHUNK_FIELDS
            or payload.get("format") != CLASS_CHUNK_FORMAT
            or payload.get("exam_period_id") != manifest["exam_period_id"]
            or payload.get("current_snapshot_id") != current_snapshot_id
            or not isinstance(payload.get("classes"), dict)
            or payload.get("chunk_id") != _sha256(canonical_bytes(payload["classes"]))
        ):
            raise ExamDataError(f"ExamHistory class chunk is invalid: {relative_path}")
        chunks[relative_path] = payload

    classes: dict[str, dict[str, Any]] = {}
    for entry in index_payload["classes"]:
        if not isinstance(entry, dict) or set(entry) != CLASS_INDEX_ENTRY_FIELDS:
            raise ExamDataError("ExamHistory class index entry is invalid")
        class_key = _require_string(entry.get("class_key"), "class_key")
        class_name = _require_string(entry.get("class_name"), "class_name")
        chunk_path = _require_string(entry.get("chunk_path"), "chunk_path")
        chunk = chunks.get(chunk_path)
        payload = chunk["classes"].get(class_key) if chunk else None
        if (
            not isinstance(payload, dict)
            or payload.get("class_name") != class_name
            or chunk.get("chunk_id") != entry.get("chunk_id")
            or any(payload.get(field) != entry.get(field) for field in (
                "observed_snapshot_count",
                "affected_event_count",
                "current_record_count",
                "latest_affected_at",
            ))
        ):
            raise ExamDataError(f"ExamHistory class mapping is invalid: {class_name}")
        if class_key in classes:
            raise ExamDataError(f"Duplicate ExamHistory class key: {class_key}")
        classes[class_key] = _validate_class_history(payload, class_key)
    if len(classes) != index_payload["class_count"]:
        raise ExamDataError("ExamHistory class count mismatch")

    return ExamHistory(
        history_id=history_id,
        exam_period_id=manifest["exam_period_id"],
        academic_year=manifest["academic_year"],
        term_number=manifest["term_number"],
        term_label=manifest["term_label"],
        baseline_snapshot_id=baseline_snapshot_id,
        current_snapshot_id=current_snapshot_id,
        current_source_updated_at=manifest["current_source_updated_at"],
        observed_snapshot_count=observed_snapshot_count,
        events=events_payload["events"],
        class_index=index_payload["classes"],
        classes=classes,
    )


__all__ = [
    "CLASS_CHUNK_FORMAT",
    "CLASS_INDEX_FORMAT",
    "EVENTS_FORMAT",
    "EXAM_HISTORY_FORMAT",
    "ExamHistory",
    "artifact_ref",
    "canonical_bytes",
    "exam_history_id",
    "load_exam_history",
]
