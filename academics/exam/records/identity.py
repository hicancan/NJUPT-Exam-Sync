from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from typing import Any

from .model import ExamDataError, normalize_text


IDENTITY_FIELDS = ("class_name", "course_code", "course_name", "teacher")
PUBLIC_RECORD_FIELDS = (
    "campus",
    "course_name",
    "course_code",
    "class_name",
    "teacher",
    "location",
    "raw_time",
    "count",
    "school",
    "student_school",
    "major",
    "grade",
    "notes",
    "start_timestamp",
    "end_timestamp",
    "duration_minutes",
    "date",
)
COMPARE_FIELDS = (
    "start_timestamp",
    "end_timestamp",
    "duration_minutes",
    "location",
    "campus",
    "notes",
    "count",
    "raw_time",
)
FIELD_LABELS = {
    "start_timestamp": "开始时间",
    "end_timestamp": "结束时间",
    "duration_minutes": "时长",
    "location": "地点",
    "campus": "校区",
    "notes": "备注",
    "count": "人数",
    "raw_time": "原始时间",
}
SOURCE_REF_FIELDS = {
    "id",
    "_source_file",
    "_row_index",
    "source_file",
    "row_index",
    "source_refs",
    "duplicate_count",
    "stable_key",
    "content_fingerprint",
    "validation_error",
}


def class_file_key(class_name: str) -> str:
    normalized = normalize_text(class_name).lower()
    safe = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    if safe:
        return safe
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12]
    return f"class-{digest}"


def business_identity(record: dict[str, Any]) -> str:
    values = [normalize_text(record.get(field)).lower() for field in IDENTITY_FIELDS]
    return "\u001f".join(values)


def class_name_of(record: dict[str, Any]) -> str:
    return normalize_text(record.get("class_name"))


def _normalized_value(value: Any) -> Any:
    if isinstance(value, str):
        return normalize_text(value)
    return value


def _record_fingerprint(record: dict[str, Any], fields: tuple[str, ...]) -> str:
    payload = {field: _normalized_value(record.get(field)) for field in fields}
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _fingerprint_digest(fingerprint: str) -> str:
    return hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()


def _source_ordinal(record: dict[str, Any]) -> tuple[str, int, str]:
    record_id = str(record.get("id") or "")
    source_file = str(record.get("_source_file") or record.get("source_file") or "")
    row_index = record.get("_row_index") or record.get("row_index")
    if not source_file and "-" in record_id:
        source_file = record_id.rsplit("-", 1)[0]
    if not row_index and "-" in record_id:
        suffix = record_id.rsplit("-", 1)[-1]
        if suffix.isdigit():
            row_index = int(suffix)
    return source_file, int(row_index or 0), record_id


def _exam_summary(record: dict[str, Any]) -> dict[str, Any]:
    return {
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
    }


def _source_ref(record: dict[str, Any]) -> dict[str, Any]:
    source_file, row_index, record_id = _source_ordinal(record)
    return {
        "id": record_id,
        "source_file": source_file,
        "row_index": row_index,
    }


def _canonical_exam_id(identity: str, fingerprint: str) -> str:
    return "exam-" + _fingerprint_digest(identity + "\u001f" + fingerprint)[:20]


def _stable_key_digest(identity: str, discriminator: str = "") -> str:
    return "stable-" + _fingerprint_digest(identity + "\u001f" + discriminator)[:20]


def _strip_source_fields(record: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in record.items() if key not in SOURCE_REF_FIELDS}


def _stable_discriminator_fields(records: list[dict[str, Any]]) -> tuple[str, ...]:
    candidates: tuple[tuple[str, ...], ...] = (
        ("location", "count"),
        ("location", "count", "start_timestamp", "end_timestamp"),
        PUBLIC_RECORD_FIELDS,
    )
    for fields in candidates:
        fingerprints = [_record_fingerprint(record, fields) for record in records]
        if len(set(fingerprints)) == len(fingerprints):
            return fields
    raise ExamDataError(
        "Cannot assign deterministic occurrence keys after exact duplicate collapse: "
        + json.dumps([_exam_summary(record) for record in records], ensure_ascii=False)
    )


def canonicalize_exam_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Collapse byte-equivalent official duplicate rows into one deterministic exam record."""
    grouped = _group_by_identity(records)
    canonical_records: list[dict[str, Any]] = []

    for identity in sorted(grouped):
        by_content: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for record in grouped[identity]:
            by_content[_record_fingerprint(record, PUBLIC_RECORD_FIELDS)].append(record)

        identity_records: list[dict[str, Any]] = []
        for fingerprint in sorted(by_content):
            duplicates = sorted(by_content[fingerprint], key=_source_ordinal)
            canonical = _strip_source_fields(dict(duplicates[0]))
            source_refs = [_source_ref(record) for record in duplicates]
            canonical["id"] = _canonical_exam_id(identity, fingerprint)
            canonical["duplicate_count"] = len(source_refs)
            if len(source_refs) > 1:
                canonical["source_refs"] = source_refs
            canonical["content_fingerprint"] = _fingerprint_digest(fingerprint)
            identity_records.append(canonical)

        if len(identity_records) == 1:
            identity_records[0]["stable_key"] = _stable_key_digest(identity)
        else:
            discriminator_fields = _stable_discriminator_fields(identity_records)
            for record in identity_records:
                discriminator = _record_fingerprint(record, discriminator_fields)
                record["stable_key"] = _stable_key_digest(identity, discriminator)

        canonical_records.extend(identity_records)

    return sorted(
        canonical_records,
        key=lambda item: (
            str(item.get("class_name") or ""),
            str(item.get("course_code") or ""),
            str(item.get("course_name") or ""),
            str(item.get("teacher") or ""),
            str(item.get("stable_key") or ""),
        ),
    )


def _changed_fields(previous: dict[str, Any], current: dict[str, Any]) -> list[dict[str, Any]]:
    fields: list[dict[str, Any]] = []
    for field in COMPARE_FIELDS:
        before = _normalized_value(previous.get(field))
        after = _normalized_value(current.get(field))
        if before != after:
            fields.append({"field": field, "label": FIELD_LABELS[field], "before": before, "after": after})
    return fields


def _group_by_identity(records: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[business_identity(record)].append(record)
    return grouped


def _pop_exact_pairs(
    previous_left: list[dict[str, Any]],
    current_left: list[dict[str, Any]],
    *,
    fields: tuple[str, ...],
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
    current_by_fingerprint: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in sorted(current_left, key=_source_ordinal):
        current_by_fingerprint[_record_fingerprint(record, fields)].append(record)

    for previous_record in list(sorted(previous_left, key=_source_ordinal)):
        fingerprint = _record_fingerprint(previous_record, fields)
        candidates = current_by_fingerprint.get(fingerprint) or []
        if not candidates:
            continue
        current_record = candidates.pop(0)
        pairs.append((previous_record, current_record))
        previous_left.remove(previous_record)
        current_left.remove(current_record)
    return pairs


def _pair_by_unique_discriminator(
    previous_left: list[dict[str, Any]],
    current_left: list[dict[str, Any]],
    *,
    fields: tuple[str, ...],
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    previous_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    current_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in previous_left:
        previous_by_key[_record_fingerprint(record, fields)].append(record)
    for record in current_left:
        current_by_key[_record_fingerprint(record, fields)].append(record)

    pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for fingerprint in sorted(set(previous_by_key) & set(current_by_key)):
        previous_records = previous_by_key[fingerprint]
        current_records = current_by_key[fingerprint]
        if len(previous_records) != 1 or len(current_records) != 1:
            continue
        previous_record = previous_records[0]
        current_record = current_records[0]
        pairs.append((previous_record, current_record))
        previous_left.remove(previous_record)
        current_left.remove(current_record)
    return pairs


def _ambiguous_error(identity: str, previous_left: list[dict[str, Any]], current_left: list[dict[str, Any]]) -> ExamDataError:
    return ExamDataError(
        "Ambiguous duplicate exam records under immutable identity: "
        + json.dumps(
            {
                "identity_fields": IDENTITY_FIELDS,
                "identity": identity,
                "previous": [_exam_summary(record) for record in sorted(previous_left, key=_source_ordinal)],
                "current": [_exam_summary(record) for record in sorted(current_left, key=_source_ordinal)],
            },
            ensure_ascii=False,
        )
    )


def _pair_group(
    identity: str,
    previous_records: list[dict[str, Any]],
    current_records: list[dict[str, Any]],
) -> tuple[list[tuple[dict[str, Any], dict[str, Any]]], list[dict[str, Any]], list[dict[str, Any]]]:
    previous_left = list(previous_records)
    current_left = list(current_records)
    pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []

    pairs.extend(_pop_exact_pairs(previous_left, current_left, fields=COMPARE_FIELDS))

    if not previous_left or not current_left:
        return pairs, previous_left, current_left

    pairs.extend(_pair_by_unique_discriminator(previous_left, current_left, fields=("location", "count")))

    if not previous_left or not current_left:
        return pairs, previous_left, current_left

    if len(previous_left) == 1 and len(current_left) == 1:
        pairs.append((previous_left[0], current_left[0]))
        return pairs, [], []

    raise _ambiguous_error(identity, previous_left, current_left)


def compare_exam_records(
    *,
    previous_records: list[dict[str, Any]],
    current_records: list[dict[str, Any]],
) -> dict[str, Any]:
    previous_records = canonicalize_exam_records(previous_records)
    current_records = canonicalize_exam_records(current_records)
    previous_groups = _group_by_identity(previous_records)
    current_groups = _group_by_identity(current_records)
    identities = sorted(set(previous_groups) | set(current_groups))
    changes: list[dict[str, Any]] = []
    totals = {"added": 0, "removed": 0, "changed": 0, "unchanged": 0}

    for identity in identities:
        previous_group = previous_groups.get(identity, [])
        current_group = current_groups.get(identity, [])
        pairs, removed_records, added_records = _pair_group(identity, previous_group, current_group)

        for previous_record, current_record in pairs:
            fields = _changed_fields(previous_record, current_record)
            if not fields:
                totals["unchanged"] += 1
                continue
            totals["changed"] += 1
            changes.append(
                {
                    "type": "changed",
                    "identity_key": identity,
                    "course_name": current_record.get("course_name") or previous_record.get("course_name"),
                    "course_code": current_record.get("course_code") or previous_record.get("course_code"),
                    "teacher": current_record.get("teacher") or previous_record.get("teacher"),
                    "before_id": previous_record.get("id"),
                    "after_id": current_record.get("id"),
                    "fields": fields,
                }
            )

        for record in removed_records:
            totals["removed"] += 1
            changes.append(
                {
                    "type": "removed",
                    "identity_key": identity,
                    "course_name": record.get("course_name"),
                    "course_code": record.get("course_code"),
                    "teacher": record.get("teacher"),
                    "before": _exam_summary(record),
                }
            )

        for record in added_records:
            totals["added"] += 1
            changes.append(
                {
                    "type": "added",
                    "identity_key": identity,
                    "course_name": record.get("course_name"),
                    "course_code": record.get("course_code"),
                    "teacher": record.get("teacher"),
                    "after": _exam_summary(record),
                }
            )

    changes.sort(
        key=lambda item: (
            str(item.get("course_name") or ""),
            str(item.get("teacher") or ""),
            str(item.get("identity_key") or ""),
            str(item.get("type") or ""),
            str(item.get("before_id") or item.get("after_id") or ""),
        )
    )
    return {"totals": totals, "changes": changes}
