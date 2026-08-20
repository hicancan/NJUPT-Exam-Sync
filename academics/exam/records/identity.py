from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from typing import Any

from .model import ExamDataError, normalize_text


IDENTITY_FIELDS = ("class_name", "course_code", "course_name", "teacher")
HISTORY_IDENTITY_FIELDS = (
    "exam_period_id",
    "class_name",
    "course_code",
    "course_name",
)
CONTENT_FIELDS = (
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
)


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _normalized_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for field in CONTENT_FIELDS:
        value = record.get(field)
        normalized[field] = normalize_text(value) if isinstance(value, str) else value
    return normalized


def _business_identity(record: dict[str, Any]) -> str:
    return "\u001f".join(
        normalize_text(record.get(field)).lower() for field in IDENTITY_FIELDS
    )


def history_identity(record: dict[str, Any]) -> str:
    """Return the stable logical-exam identity used by ExamHistory.

    One class/course can be split into several source rows for different rooms,
    teachers, or student counts.  Those rows intentionally share one history
    identity so any of those mutable scheduling fields can be compared without
    fuzzy record pairing.
    """

    identity = "\u001f".join(
        normalize_text(record.get(field)).lower()
        for field in HISTORY_IDENTITY_FIELDS
    )
    if any(not normalize_text(record.get(field)) for field in HISTORY_IDENTITY_FIELDS):
        raise ExamDataError("Cannot assign ExamHistory identity with missing fields")
    return "history-" + _digest(identity)[:20]


def _source_order(record: dict[str, Any]) -> tuple[str, int]:
    return (
        str(record.get("_source_file") or ""),
        int(record.get("_row_index") or 0),
    )


def _stable_discriminator(records: list[dict[str, Any]]) -> tuple[str, ...]:
    candidates: tuple[tuple[str, ...], ...] = (
        ("location", "count"),
        ("location", "count", "start_timestamp", "end_timestamp"),
        CONTENT_FIELDS,
    )
    for fields in candidates:
        values = [
            _canonical_json({field: record.get(field) for field in fields})
            for record in records
        ]
        if len(set(values)) == len(values):
            return fields
    raise ExamDataError("Cannot assign an unambiguous stable identity to exam records")


def canonicalize_exam_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compile source rows into unique, minimal product ExamRecord objects."""

    grouped: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for source_record in records:
        record = _normalized_record(source_record)
        identity = _business_identity(record)
        fingerprint_text = _canonical_json(record)
        grouped[identity][fingerprint_text].append(source_record)

    output: list[dict[str, Any]] = []
    for identity in sorted(grouped):
        records_for_identity: list[dict[str, Any]] = []
        for fingerprint_text in sorted(grouped[identity]):
            source_rows = sorted(grouped[identity][fingerprint_text], key=_source_order)
            record = _normalized_record(source_rows[0])
            record["history_key"] = history_identity(record)
            record["content_fingerprint"] = _digest(fingerprint_text)
            record["id"] = "exam-" + _digest(identity + "\u001f" + fingerprint_text)[:20]
            records_for_identity.append(record)

        if len(records_for_identity) == 1:
            records_for_identity[0]["stable_key"] = "stable-" + _digest(identity)[:20]
        else:
            fields = _stable_discriminator(records_for_identity)
            for record in records_for_identity:
                discriminator = _canonical_json(
                    {field: record.get(field) for field in fields}
                )
                record["stable_key"] = (
                    "stable-" + _digest(identity + "\u001f" + discriminator)[:20]
                )
        output.extend(records_for_identity)

    output.sort(
        key=lambda record: (
            str(record["class_name"]),
            str(record["course_code"]),
            str(record["course_name"]),
            str(record["teacher"]),
            str(record["stable_key"]),
        )
    )
    return output
