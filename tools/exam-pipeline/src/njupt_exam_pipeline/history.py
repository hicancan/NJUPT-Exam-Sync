from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .contract import ExamPipelineError, normalize_text, parse_exam_period
from .diff import business_identity, canonicalize_exam_records, class_file_key, compare_exam_records
from .processor import get_xlsx_files, process_single_file
from .publisher import write_json_file


HISTORY_MANIFEST_VERSION = "exam-history-manifest-v1"
CLASS_HISTORY_VERSION = "exam-class-history-v2"
HISTORY_DIR_NAME = "history"


@dataclass(frozen=True)
class ExamSnapshot:
    data_version: str
    auto_updated_at: str
    exam_period_id: str
    academic_year: str
    term_number: int
    term_label: str
    source_url: str | None
    source_title: str | None
    records: list[dict[str, Any]]


def process_exam_snapshot_dir(*, data_dir: Path, data_version: str, auto_updated_at: str) -> ExamSnapshot:
    metadata_path = data_dir / "source_metadata.json"
    metadata: dict[str, Any] = {}
    if metadata_path.exists():
        import json

        with metadata_path.open("r", encoding="utf-8") as handle:
            loaded = json.load(handle)
        if not isinstance(loaded, dict):
            raise ExamPipelineError(f"Invalid source metadata: {metadata_path}")
        metadata = loaded

    period = parse_exam_period(metadata.get("source_title"))
    records: list[dict[str, Any]] = []
    for xlsx_path in get_xlsx_files(data_dir):
        result = process_single_file(xlsx_path)
        if result["parse_fail_count"] > 0:
            raise ExamPipelineError(f"{result['filename']} has {result['parse_fail_count']} unparsable exam rows")
        records.extend(result["raw_data"])

    if not records:
        raise ExamPipelineError(f"No exam records were generated for history snapshot: {data_dir}")

    canonical_records = canonicalize_exam_records(records)
    for record in canonical_records:
        record["exam_period_id"] = period.exam_period_id

    return ExamSnapshot(
        data_version=data_version,
        auto_updated_at=auto_updated_at,
        exam_period_id=period.exam_period_id,
        academic_year=period.academic_year,
        term_number=period.term_number,
        term_label=period.term_label,
        source_url=metadata.get("source_url"),
        source_title=metadata.get("source_title"),
        records=canonical_records,
    )


def _records_by_class(records: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        class_name = normalize_text(record.get("class_name"))
        if not class_name:
            raise ExamPipelineError(f"Exam record is missing class_name: {record.get('id')}")
        grouped.setdefault(class_name, []).append(record)
    for class_records in grouped.values():
        class_records.sort(key=lambda item: str(item.get("id") or ""))
    return grouped


def _added_changes(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "type": "added",
            "identity_key": business_identity(record),
            "course_name": record.get("course_name"),
            "course_code": record.get("course_code"),
            "teacher": record.get("teacher"),
            "after": {
                "id": record.get("id"),
                "stable_key": record.get("stable_key"),
                "exam_period_id": record.get("exam_period_id"),
                "duplicate_count": record.get("duplicate_count"),
                "class_name": record.get("class_name"),
                "course_name": record.get("course_name"),
                "course_code": record.get("course_code"),
                "teacher": record.get("teacher"),
                "start_timestamp": record.get("start_timestamp"),
                "end_timestamp": record.get("end_timestamp"),
                "duration_minutes": record.get("duration_minutes"),
                "location": record.get("location"),
                "campus": record.get("campus"),
                "notes": record.get("notes"),
                "count": record.get("count"),
                "raw_time": record.get("raw_time"),
            },
        }
        for record in records
    ]


def _removed_changes(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "type": "removed",
            "identity_key": business_identity(record),
            "course_name": record.get("course_name"),
            "course_code": record.get("course_code"),
            "teacher": record.get("teacher"),
            "before": {
                "id": record.get("id"),
                "stable_key": record.get("stable_key"),
                "exam_period_id": record.get("exam_period_id"),
                "duplicate_count": record.get("duplicate_count"),
                "class_name": record.get("class_name"),
                "course_name": record.get("course_name"),
                "course_code": record.get("course_code"),
                "teacher": record.get("teacher"),
                "start_timestamp": record.get("start_timestamp"),
                "end_timestamp": record.get("end_timestamp"),
                "duration_minutes": record.get("duration_minutes"),
                "location": record.get("location"),
                "campus": record.get("campus"),
                "notes": record.get("notes"),
                "count": record.get("count"),
                "raw_time": record.get("raw_time"),
            },
        }
        for record in records
    ]


def _snapshot_delta(
    *,
    snapshot: ExamSnapshot,
    previous: ExamSnapshot | None,
    status: str,
    previous_count: int,
    current_count: int,
    totals: dict[str, int],
    changes: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "data_version": snapshot.data_version,
        "auto_updated_at": snapshot.auto_updated_at,
        "exam_period_id": snapshot.exam_period_id,
        "previous_data_version": previous.data_version if previous else None,
        "previous_auto_updated_at": previous.auto_updated_at if previous else None,
        "status": status,
        "totals": {
            "added": totals.get("added", 0),
            "removed": totals.get("removed", 0),
            "changed": totals.get("changed", 0),
            "unchanged": totals.get("unchanged", 0),
            "previous_records": previous_count,
            "current_records": current_count,
        },
        "changes": changes,
    }


def _event_from_delta(delta: dict[str, Any]) -> dict[str, Any]:
    status = delta["status"]
    if status == "unchanged":
        raise ExamPipelineError("unchanged snapshot deltas must not be exposed as class history events")
    changes = delta.get("changes")
    if not isinstance(changes, list) or not changes:
        raise ExamPipelineError(f"class history event must include changes: {delta.get('data_version')}")
    return {
        "data_version": delta["data_version"],
        "auto_updated_at": delta["auto_updated_at"],
        "exam_period_id": delta["exam_period_id"],
        "previous_data_version": delta.get("previous_data_version"),
        "status": status,
        "totals": delta["totals"],
        "changes": changes,
    }


def build_exam_history(snapshots: list[ExamSnapshot], *, generated_at: str) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    if not snapshots:
        raise ExamPipelineError("Cannot build exam history without snapshots")
    period_ids = {snapshot.exam_period_id for snapshot in snapshots}
    if len(period_ids) != 1:
        raise ExamPipelineError(f"Exam history snapshots must belong to one exam_period_id: {sorted(period_ids)}")
    normalized_snapshots: list[ExamSnapshot] = []
    for snapshot in snapshots:
        records = canonicalize_exam_records(snapshot.records)
        for record in records:
            record["exam_period_id"] = snapshot.exam_period_id
        normalized_snapshots.append(
            ExamSnapshot(
                data_version=snapshot.data_version,
                auto_updated_at=snapshot.auto_updated_at,
                exam_period_id=snapshot.exam_period_id,
                academic_year=snapshot.academic_year,
                term_number=snapshot.term_number,
                term_label=snapshot.term_label,
                source_url=snapshot.source_url,
                source_title=snapshot.source_title,
                records=records,
            )
        )
    snapshots = normalized_snapshots
    data_versions = [snapshot.data_version for snapshot in snapshots]
    if len(set(data_versions)) != len(data_versions):
        raise ExamPipelineError("Exam history snapshots must have unique data_version values")

    snapshot_classes = [_records_by_class(snapshot.records) for snapshot in snapshots]
    all_classes = sorted(set().union(*(set(grouped) for grouped in snapshot_classes)))
    latest_snapshot = snapshots[-1]
    latest_classes = snapshot_classes[-1]

    class_files: dict[str, dict[str, Any]] = {}
    class_index: list[dict[str, Any]] = []

    for class_name in all_classes:
        key = class_file_key(class_name)
        snapshot_deltas: list[dict[str, Any]] = []
        seen_before = False
        events_chronological: list[dict[str, Any]] = []

        for index, snapshot in enumerate(snapshots):
            current_records = snapshot_classes[index].get(class_name, [])
            previous_snapshot = snapshots[index - 1] if index > 0 else None
            previous_records = snapshot_classes[index - 1].get(class_name, []) if index > 0 else []

            if not previous_records and not current_records:
                continue

            if not previous_records and current_records:
                status = "first_seen" if not seen_before else "reappeared"
                totals = {"added": len(current_records), "removed": 0, "changed": 0, "unchanged": 0}
                changes = _added_changes(current_records)
            elif previous_records and not current_records:
                status = "removed"
                totals = {"added": 0, "removed": len(previous_records), "changed": 0, "unchanged": 0}
                changes = _removed_changes(previous_records)
            else:
                delta = compare_exam_records(previous_records=previous_records, current_records=current_records)
                totals = delta["totals"]
                changes = delta["changes"]
                status = "changed" if totals["added"] or totals["removed"] or totals["changed"] else "unchanged"

            snapshot_delta = _snapshot_delta(
                snapshot=snapshot,
                previous=previous_snapshot,
                status=status,
                previous_count=len(previous_records),
                current_count=len(current_records),
                totals=totals,
                changes=changes,
            )
            snapshot_deltas.append(snapshot_delta)
            if current_records:
                seen_before = True
            if status in {"first_seen", "reappeared", "changed", "removed"}:
                events_chronological.append(_event_from_delta(snapshot_delta))

        if not snapshot_deltas:
            continue

        first_delta = snapshot_deltas[0]
        latest_delta = snapshot_deltas[-1]
        first_seen = next((item for item in snapshot_deltas if item["status"] in {"first_seen", "reappeared"}), first_delta)
        if not events_chronological:
            raise ExamPipelineError(f"class history has no version events: {class_name}")
        events = list(reversed(events_chronological))
        latest_change_event = events[0]
        current_record_count = len(latest_classes.get(class_name, []))

        payload = {
            "version": CLASS_HISTORY_VERSION,
            "exam_period_id": latest_snapshot.exam_period_id,
            "academic_year": latest_snapshot.academic_year,
            "term_number": latest_snapshot.term_number,
            "term_label": latest_snapshot.term_label,
            "class_name": class_name,
            "class_key": key,
            "generated_at": generated_at,
            "latest_data_version": latest_snapshot.data_version,
            "latest_auto_updated_at": latest_snapshot.auto_updated_at,
            "first_seen": {
                "data_version": first_seen["data_version"],
                "auto_updated_at": first_seen["auto_updated_at"],
            },
            "latest_change_event": latest_change_event,
            "events": events,
        }
        class_files[key] = payload
        class_index.append(
            {
                "class_name": class_name,
                "class_key": key,
                "path": f"generated/exam/history/classes/{key}.json",
                "exam_period_id": latest_snapshot.exam_period_id,
                "first_seen_data_version": first_seen["data_version"],
                "first_seen_at": first_seen["auto_updated_at"],
                "latest_status": latest_delta["status"],
                "latest_change_data_version": latest_change_event["data_version"],
                "latest_change_at": latest_change_event["auto_updated_at"],
                "current_record_count": current_record_count,
                "event_count": len(events),
            }
        )

    manifest = {
        "version": HISTORY_MANIFEST_VERSION,
        "generated_at": generated_at,
        "exam_period_id": latest_snapshot.exam_period_id,
        "academic_year": latest_snapshot.academic_year,
        "term_number": latest_snapshot.term_number,
        "term_label": latest_snapshot.term_label,
        "latest_data_version": latest_snapshot.data_version,
        "latest_auto_updated_at": latest_snapshot.auto_updated_at,
        "snapshots": [
            {
                "data_version": snapshot.data_version,
                "auto_updated_at": snapshot.auto_updated_at,
                "exam_period_id": snapshot.exam_period_id,
                "source_url": snapshot.source_url,
                "source_title": snapshot.source_title,
                "record_count": len(snapshot.records),
                "class_count": len(snapshot_classes[index]),
            }
            for index, snapshot in enumerate(snapshots)
        ],
        "totals": {
            "snapshot_count": len(snapshots),
            "class_count": len(class_index),
            "current_class_count": len(latest_classes),
            "current_record_count": len(latest_snapshot.records),
        },
        "classes": sorted(class_index, key=lambda item: item["class_name"]),
    }
    return manifest, class_files


def write_exam_history(*, output_dir: Path, manifest: dict[str, Any], class_files: dict[str, dict[str, Any]]) -> None:
    history_dir = output_dir / HISTORY_DIR_NAME
    classes_dir = history_dir / "classes"
    history_dir.mkdir(parents=True, exist_ok=True)
    classes_dir.mkdir(parents=True, exist_ok=True)

    for stale_file in classes_dir.glob("*.json"):
        stale_file.unlink()
    write_json_file(history_dir / "manifest.json", manifest, compact=False)
    for class_key, payload in class_files.items():
        write_json_file(classes_dir / f"{class_key}.json", payload, compact=False)
