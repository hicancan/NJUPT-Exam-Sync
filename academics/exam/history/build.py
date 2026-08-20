from __future__ import annotations

import hashlib
import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from ..records.identity import history_identity
from ..records.model import ExamDataError
from ..snapshot.build import write_json_file
from ..snapshot.model import ExamSnapshot, load_exam_snapshot
from .model import (
    CLASS_CHUNK_FORMAT,
    CLASS_INDEX_FORMAT,
    EVENTS_FORMAT,
    EXAM_HISTORY_FORMAT,
    ExamHistory,
    artifact_ref,
    canonical_bytes,
    exam_history_id,
    load_exam_history,
)

CLASS_CHUNK_TARGET_BYTES = 256 * 1024
MUTABLE_FIELDS = (
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
)


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _class_key(class_name: str) -> str:
    return "class-" + _sha256(class_name.encode("utf-8"))[:16]


def _value(values: list[Any], *, sum_numbers: bool = False) -> Any:
    if sum_numbers:
        return sum(int(value) for value in values)
    unique = sorted(set(values), key=lambda value: json.dumps(value, ensure_ascii=False))
    return unique[0] if len(unique) == 1 else unique


def _logical_exams(snapshot: ExamSnapshot) -> dict[str, dict[str, dict[str, Any]]]:
    grouped: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for record in snapshot.records:
        expected_key = history_identity(record)
        if record.get("history_key") != expected_key:
            raise ExamDataError(f"Exam record has invalid history_key: {record.get('id')}")
        class_name = str(record["class_name"])
        grouped.setdefault(class_name, {}).setdefault(expected_key, []).append(record)

    result: dict[str, dict[str, dict[str, Any]]] = {}
    for class_name, class_groups in grouped.items():
        logical: dict[str, dict[str, Any]] = {}
        for history_key, records in class_groups.items():
            course_names = {str(record["course_name"]) for record in records}
            course_codes = {str(record["course_code"]) for record in records}
            if len(course_names) != 1 or len(course_codes) != 1:
                raise ExamDataError(f"ExamHistory group identity is ambiguous: {history_key}")
            fields = {
                field: _value(
                    [record[field] for record in records],
                    sum_numbers=field == "count",
                )
                for field in MUTABLE_FIELDS
            }
            teacher = fields["teacher"]
            logical[history_key] = {
                "history_key": history_key,
                "course_name": next(iter(course_names)),
                "course_code": next(iter(course_codes)),
                "teacher": "、".join(teacher) if isinstance(teacher, list) else str(teacher),
                "fields": fields,
            }
        result[class_name] = logical
    return result


def _change(
    change_type: str,
    current: dict[str, Any] | None,
    previous: dict[str, Any] | None,
) -> dict[str, Any]:
    logical = current or previous
    if logical is None:
        raise ExamDataError("ExamHistory change has no logical exam")
    fields = []
    for field in MUTABLE_FIELDS:
        before = previous["fields"][field] if previous else None
        after = current["fields"][field] if current else None
        if before != after:
            fields.append({"field": field, "before": before, "after": after})
    if not fields:
        raise ExamDataError("ExamHistory change has no changed fields")
    return {
        "type": change_type,
        "history_key": logical["history_key"],
        "course_name": logical["course_name"],
        "course_code": logical["course_code"],
        "teacher": (current or previous)["teacher"],
        "fields": fields,
    }


def _compare_class(
    previous: dict[str, dict[str, Any]],
    current: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    changes: list[dict[str, Any]] = []
    previous_keys = set(previous)
    current_keys = set(current)
    for key in sorted(current_keys - previous_keys):
        changes.append(_change("added", current[key], None))
    for key in sorted(previous_keys - current_keys):
        changes.append(_change("removed", None, previous[key]))
    changed = 0
    unchanged = 0
    for key in sorted(previous_keys & current_keys):
        if previous[key]["fields"] == current[key]["fields"]:
            unchanged += 1
            continue
        changes.append(_change("changed", current[key], previous[key]))
        changed += 1
    changes.sort(key=lambda item: (item["course_code"], item["course_name"], item["type"]))
    return changes, {
        "added": len(current_keys - previous_keys),
        "removed": len(previous_keys - current_keys),
        "changed": changed,
        "unchanged": unchanged,
    }


def _baseline(snapshot: ExamSnapshot) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    logical = _logical_exams(snapshot)
    event = {
        "snapshot_id": snapshot.snapshot_id,
        "previous_snapshot_id": None,
        "source_updated_at": snapshot.source_updated_at,
        "status": "baseline",
        "total_records": len(snapshot.records),
        "total_classes": len(logical),
        "affected_class_count": 0,
        "added": 0,
        "removed": 0,
        "changed": 0,
        "unchanged": sum(len(groups) for groups in logical.values()),
    }
    classes: dict[str, dict[str, Any]] = {}
    records_by_class: dict[str, int] = {}
    for record in snapshot.records:
        records_by_class[str(record["class_name"])] = records_by_class.get(str(record["class_name"]), 0) + 1
    for class_name in sorted(logical):
        key = _class_key(class_name)
        classes[key] = {
            "class_name": class_name,
            "class_key": key,
            "observed_snapshot_count": 1,
            "affected_event_count": 0,
            "current_record_count": records_by_class[class_name],
            "latest_affected_at": None,
            "events": [{
                "snapshot_id": snapshot.snapshot_id,
                "previous_snapshot_id": None,
                "source_updated_at": snapshot.source_updated_at,
                "status": "first_seen",
                "previous_record_count": 0,
                "current_record_count": records_by_class[class_name],
                "changes": [],
            }],
        }
    return [event], classes


def _parse_timestamp(value: str) -> datetime:
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ExamDataError(f"Invalid ExamHistory source timestamp: {value}") from exc
    if result.tzinfo is None:
        raise ExamDataError("ExamHistory source timestamp must include a timezone")
    return result


def _append(
    *,
    current: ExamSnapshot,
    previous_snapshot: ExamSnapshot,
    previous_history: ExamHistory,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    if previous_history.current_snapshot_id != previous_snapshot.snapshot_id:
        raise ExamDataError("ExamHistory does not identify the previous ExamSnapshot")
    if previous_history.current_source_updated_at != previous_snapshot.source_updated_at:
        raise ExamDataError("ExamHistory and previous ExamSnapshot timestamps do not match")
    if _parse_timestamp(current.source_updated_at) < _parse_timestamp(previous_snapshot.source_updated_at):
        raise ExamDataError("Current ExamSnapshot is older than the history head")

    previous_logical = _logical_exams(previous_snapshot)
    current_logical = _logical_exams(current)
    records_previous: dict[str, int] = {}
    records_current: dict[str, int] = {}
    for record in previous_snapshot.records:
        name = str(record["class_name"])
        records_previous[name] = records_previous.get(name, 0) + 1
    for record in current.records:
        name = str(record["class_name"])
        records_current[name] = records_current.get(name, 0) + 1

    classes = {
        key: {
            **value,
            "events": list(value["events"]),
        }
        for key, value in previous_history.classes.items()
    }
    totals = {"added": 0, "removed": 0, "changed": 0, "unchanged": 0}
    affected_classes = 0
    historical_classes = {
        str(payload["class_name"])
        for payload in previous_history.classes.values()
    }
    all_classes = sorted(
        set(previous_logical) | set(current_logical) | historical_classes
    )
    for class_name in all_classes:
        previous_groups = previous_logical.get(class_name, {})
        current_groups = current_logical.get(class_name, {})
        changes, class_totals = _compare_class(previous_groups, current_groups)
        for field in totals:
            totals[field] += class_totals[field]
        key = _class_key(class_name)
        payload = classes.get(key)
        if payload is None:
            payload = {
                "class_name": class_name,
                "class_key": key,
                "observed_snapshot_count": previous_history.observed_snapshot_count,
                "affected_event_count": 0,
                "current_record_count": 0,
                "latest_affected_at": None,
                "events": [],
            }
            classes[key] = payload
        payload["observed_snapshot_count"] = previous_history.observed_snapshot_count + 1
        payload["current_record_count"] = records_current.get(class_name, 0)
        if not changes:
            continue
        affected_classes += 1
        if not previous_groups and current_groups:
            status = "reappeared" if payload["events"] else "first_seen"
        elif previous_groups and not current_groups:
            status = "removed"
        else:
            status = "changed"
        payload["events"].append({
            "snapshot_id": current.snapshot_id,
            "previous_snapshot_id": previous_snapshot.snapshot_id,
            "source_updated_at": current.source_updated_at,
            "status": status,
            "previous_record_count": records_previous.get(class_name, 0),
            "current_record_count": records_current.get(class_name, 0),
            "changes": changes,
        })
        payload["affected_event_count"] += 1
        payload["latest_affected_at"] = current.source_updated_at

    events = list(previous_history.events)
    events.append({
        "snapshot_id": current.snapshot_id,
        "previous_snapshot_id": previous_snapshot.snapshot_id,
        "source_updated_at": current.source_updated_at,
        "status": "changed" if affected_classes else "unchanged",
        "total_records": len(current.records),
        "total_classes": len(current_logical),
        "affected_class_count": affected_classes,
        **totals,
    })
    return events, classes


def _chunks(classes: dict[str, dict[str, Any]]) -> list[dict[str, dict[str, Any]]]:
    chunks: list[dict[str, dict[str, Any]]] = []
    current: dict[str, dict[str, Any]] = {}
    current_bytes = 0
    for class_key in sorted(classes, key=lambda key: classes[key]["class_name"]):
        encoded_size = len(canonical_bytes({class_key: classes[class_key]}))
        if current and current_bytes + encoded_size > CLASS_CHUNK_TARGET_BYTES:
            chunks.append(current)
            current = {}
            current_bytes = 0
        current[class_key] = classes[class_key]
        current_bytes += encoded_size
    if current:
        chunks.append(current)
    return chunks


def _write_history(
    *,
    output_dir: Path,
    current: ExamSnapshot,
    baseline_snapshot_id: str,
    events: list[dict[str, Any]],
    classes: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    observed_snapshot_count = len(events)
    events_payload = {
        "format": EVENTS_FORMAT,
        "exam_period_id": current.exam_period_id,
        "baseline_snapshot_id": baseline_snapshot_id,
        "current_snapshot_id": current.snapshot_id,
        "observed_snapshot_count": observed_snapshot_count,
        "events": events,
    }
    write_json_file(output_dir / "events.json", events_payload, compact=True)

    class_entries: list[dict[str, Any]] = []
    chunk_refs: list[dict[str, Any]] = []
    for index, chunk_classes in enumerate(_chunks(classes)):
        chunk_id = _sha256(canonical_bytes(chunk_classes))
        relative_path = f"classes-{index:03d}.json"
        write_json_file(
            output_dir / relative_path,
            {
                "format": CLASS_CHUNK_FORMAT,
                "exam_period_id": current.exam_period_id,
                "current_snapshot_id": current.snapshot_id,
                "chunk_id": chunk_id,
                "classes": chunk_classes,
            },
            compact=True,
        )
        chunk_refs.append(artifact_ref(output_dir, relative_path))
        for payload in chunk_classes.values():
            class_entries.append({
                "class_name": payload["class_name"],
                "class_key": payload["class_key"],
                "observed_snapshot_count": payload["observed_snapshot_count"],
                "affected_event_count": payload["affected_event_count"],
                "current_record_count": payload["current_record_count"],
                "latest_affected_at": payload["latest_affected_at"],
                "chunk_path": relative_path,
                "chunk_id": chunk_id,
            })
    class_entries.sort(key=lambda entry: entry["class_name"])
    class_index_payload = {
        "format": CLASS_INDEX_FORMAT,
        "exam_period_id": current.exam_period_id,
        "current_snapshot_id": current.snapshot_id,
        "observed_snapshot_count": observed_snapshot_count,
        "class_count": len(class_entries),
        "classes": class_entries,
    }
    write_json_file(output_dir / "class-index.json", class_index_payload, compact=True)

    events_ref = artifact_ref(output_dir, "events.json")
    class_index_ref = artifact_ref(output_dir, "class-index.json")
    history_id = exam_history_id(
        exam_period_id=current.exam_period_id,
        academic_year=current.academic_year,
        term_number=current.term_number,
        term_label=current.term_label,
        baseline_snapshot_id=baseline_snapshot_id,
        current_snapshot_id=current.snapshot_id,
        current_source_updated_at=current.source_updated_at,
        observed_snapshot_count=observed_snapshot_count,
        events=events_ref,
        class_index=class_index_ref,
        class_chunks=chunk_refs,
    )
    manifest = {
        "format": EXAM_HISTORY_FORMAT,
        "history_id": history_id,
        "exam_period_id": current.exam_period_id,
        "academic_year": current.academic_year,
        "term_number": current.term_number,
        "term_label": current.term_label,
        "baseline_snapshot_id": baseline_snapshot_id,
        "current_snapshot_id": current.snapshot_id,
        "current_source_updated_at": current.source_updated_at,
        "observed_snapshot_count": observed_snapshot_count,
        "events": events_ref,
        "class_index": class_index_ref,
        "class_chunks": chunk_refs,
    }
    write_json_file(output_dir / "manifest.json", manifest, compact=False)
    return manifest


def _replace_output(staging: Path, output_dir: Path, backup: Path) -> None:
    replaced_existing = False
    try:
        if output_dir.exists():
            output_dir.replace(backup)
            replaced_existing = True
        staging.replace(output_dir)
        if replaced_existing:
            shutil.rmtree(backup)
    except Exception:
        if replaced_existing and backup.exists() and not output_dir.exists():
            backup.replace(output_dir)
        raise


def publish_exam_history_artifacts(
    *,
    current_snapshot_dir: Path,
    output_dir: Path,
    previous_history_dir: Path | None = None,
    previous_snapshot_dir: Path | None = None,
) -> dict[str, Any]:
    """Build, validate, and atomically publish the current ExamHistory."""

    if (previous_history_dir is None) != (previous_snapshot_dir is None):
        raise ExamDataError(
            "previous ExamHistory and previous ExamSnapshot must be provided together"
        )
    current = load_exam_snapshot(current_snapshot_dir.resolve())
    output_dir = output_dir.resolve()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = output_dir.with_name(f"{output_dir.name}.staging-{uuid.uuid4().hex}")
    backup = output_dir.with_name(f"{output_dir.name}.backup-{uuid.uuid4().hex}")
    staging.mkdir()
    try:
        if previous_history_dir is None or previous_snapshot_dir is None:
            events, classes = _baseline(current)
            baseline_snapshot_id = current.snapshot_id
        else:
            previous_history = load_exam_history(previous_history_dir.resolve())
            previous_snapshot = load_exam_snapshot(previous_snapshot_dir.resolve())
            if previous_history.current_snapshot_id != previous_snapshot.snapshot_id:
                raise ExamDataError(
                    "previous ExamHistory does not identify previous ExamSnapshot"
                )
            if (
                previous_history.current_source_updated_at
                != previous_snapshot.source_updated_at
                or previous_history.exam_period_id != previous_snapshot.exam_period_id
            ):
                raise ExamDataError(
                    "previous ExamHistory metadata does not match previous ExamSnapshot"
                )
            if current.snapshot_id == previous_snapshot.snapshot_id:
                shutil.copytree(previous_history_dir.resolve(), staging, dirs_exist_ok=True)
                load_exam_history(staging)
                manifest = json.loads((staging / "manifest.json").read_text(encoding="utf-8"))
                _replace_output(staging, output_dir, backup)
                return manifest
            if current.exam_period_id != previous_snapshot.exam_period_id:
                events, classes = _baseline(current)
                baseline_snapshot_id = current.snapshot_id
            else:
                events, classes = _append(
                    current=current,
                    previous_snapshot=previous_snapshot,
                    previous_history=previous_history,
                )
                baseline_snapshot_id = previous_history.baseline_snapshot_id
        manifest = _write_history(
            output_dir=staging,
            current=current,
            baseline_snapshot_id=baseline_snapshot_id,
            events=events,
            classes=classes,
        )
        load_exam_history(staging)
        _replace_output(staging, output_dir, backup)
        return manifest
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        raise
