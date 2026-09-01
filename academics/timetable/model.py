from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SOURCE_FORMAT = "njupt-teaching-schedule-source"
SNAPSHOT_FORMAT = "njupt-teaching-schedule"
OCCUPANCY_FORMAT = "njupt-teaching-room-occupancy"
SOURCE_MANIFEST_FIELDS = {
    "format",
    "source_id",
    "academic_year",
    "term_number",
    "internal_year_code",
    "internal_term_code",
    "observed_at",
    "catalog_count",
    "successful_count",
    "empty_count",
    "special_count",
    "failed_count",
    "week_count",
    "period_count",
    "artifacts",
}
ARTIFACT_FIELDS = {"path", "bytes", "sha256"}
CATALOG_ENTRY_FIELDS = {"descriptor", "status", "error"}
DESCRIPTOR_FIELDS = {
    "descriptor_id",
    "class_id",
    "name",
    "campus_id",
    "campus",
    "grade",
    "college_id",
    "college",
    "major_id",
    "major",
    "direction_id",
    "direction",
    "level",
    "timetable_kind",
    "timetable_display",
}
SCHEDULE_FIELDS = {
    "descriptor",
    "status",
    "meetings",
    "practice_notes",
    "supplemental",
    "weeks",
    "weekday_names",
    "first_weekday",
    "error",
}
MEETING_FIELDS = {
    "course_code",
    "course_name",
    "weekday",
    "weekday_label",
    "period_label",
    "periods",
    "week_label",
    "week_numbers",
    "room_id",
    "location",
    "location_type",
    "teacher",
    "teacher_title",
    "teaching_class_id",
    "teaching_class_name",
    "teaching_class_composition",
    "direction_id",
    "direction",
    "course_category",
    "course_nature",
    "teaching_class_size",
    "enrollment_count",
    "assessment_method",
    "enrollment_note",
    "class_hours_composition",
    "online_information",
    "total_hours",
    "credits",
    "capacity",
    "campus_id",
    "campus",
    "teaching_method",
    "instructor_role",
    "course_total_hours",
    "exam_method",
    "weekly_hours",
    "scheduling_flag",
}
WEEK_FIELDS = {"week", "start_date", "end_date"}
PERIOD_FIELDS = {"period", "start_time", "end_time", "day_part"}
STATUS_VALUES = {"success", "empty", "special", "failed"}


class TeachingScheduleError(RuntimeError):
    """A current teaching schedule artifact is invalid."""


@dataclass(frozen=True)
class TeachingScheduleSource:
    root: Path
    source_id: str
    academic_year: str
    term_number: int
    observed_at: str
    catalog: list[dict[str, Any]]
    weeks: list[dict[str, Any]]
    periods: list[dict[str, Any]]
    schedules: list[dict[str, Any]]


@dataclass(frozen=True)
class TeachingScheduleSnapshot:
    root: Path
    snapshot_id: str
    source_id: str
    space_snapshot_id: str
    academic_year: str
    term_number: int
    observed_at: str
    weeks: list[dict[str, Any]]
    periods: list[dict[str, Any]]
    classes: list[dict[str, Any]]
    meetings: list[dict[str, Any]]


def canonical_bytes(value: Any, *, newline: bool = False) -> bytes:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return encoded + (b"\n" if newline else b"")


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise TeachingScheduleError(f"Invalid JSON: {path}") from exc


def require_sha256(value: Any, label: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) != 64
        or any(character not in "0123456789abcdef" for character in value)
    ):
        raise TeachingScheduleError(f"{label} must be a SHA-256 hex string")
    return value


def validate_artifact(root: Path, value: Any) -> Path:
    if not isinstance(value, dict) or set(value) != ARTIFACT_FIELDS:
        raise TeachingScheduleError("Invalid artifact reference")
    relative = value.get("path")
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
        raise TeachingScheduleError("Invalid artifact path")
    path = root / relative
    try:
        content = path.read_bytes()
    except OSError as exc:
        raise TeachingScheduleError(f"Missing artifact: {relative}") from exc
    if value.get("bytes") != len(content) or value.get("sha256") != sha256(content):
        raise TeachingScheduleError(f"Artifact integrity mismatch: {relative}")
    return path


def _require_exact_object(value: Any, fields: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != fields:
        raise TeachingScheduleError(f"{label} has an incompatible shape")
    return value


def _validate_descriptor(value: Any) -> dict[str, Any]:
    descriptor = _require_exact_object(value, DESCRIPTOR_FIELDS, "descriptor")
    for field in ("descriptor_id", "name", "class_id", "timetable_kind", "timetable_display"):
        if not isinstance(descriptor.get(field), str):
            raise TeachingScheduleError(f"descriptor.{field} must be a string")
    return descriptor


def _validate_weeks(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise TeachingScheduleError("term.weeks must be a non-empty list")
    weeks: list[dict[str, Any]] = []
    for item in value:
        week = _require_exact_object(item, WEEK_FIELDS, "week")
        if not isinstance(week.get("week"), int) or not isinstance(week.get("start_date"), str) or not isinstance(week.get("end_date"), str):
            raise TeachingScheduleError("week fields are invalid")
        weeks.append(week)
    if [week["week"] for week in weeks] != list(range(1, len(weeks) + 1)):
        raise TeachingScheduleError("weeks must be contiguous and ordered")
    return weeks


def _validate_periods(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise TeachingScheduleError("periods must be a non-empty list")
    periods: list[dict[str, Any]] = []
    for item in value:
        period = _require_exact_object(item, PERIOD_FIELDS, "period")
        if (
            not isinstance(period.get("period"), int)
            or not isinstance(period.get("start_time"), str)
            or not isinstance(period.get("end_time"), str)
            or not isinstance(period.get("day_part"), str)
        ):
            raise TeachingScheduleError("period fields are invalid")
        periods.append(period)
    if [period["period"] for period in periods] != list(range(1, len(periods) + 1)):
        raise TeachingScheduleError("periods must be contiguous and ordered")
    return periods


def _validate_schedule(value: Any) -> dict[str, Any]:
    schedule = _require_exact_object(value, SCHEDULE_FIELDS, "schedule")
    descriptor = _validate_descriptor(schedule.get("descriptor"))
    status = schedule.get("status")
    if status not in STATUS_VALUES:
        raise TeachingScheduleError("schedule status is invalid")
    meetings = schedule.get("meetings")
    if not isinstance(meetings, list):
        raise TeachingScheduleError("schedule meetings must be a list")
    for meeting in meetings:
        record = _require_exact_object(meeting, MEETING_FIELDS, "meeting")
        if not isinstance(record.get("course_name"), str) or not record["course_name"]:
            raise TeachingScheduleError("meeting course_name is required")
        if not isinstance(record.get("week_numbers"), list) or any(not isinstance(week, int) for week in record["week_numbers"]):
            raise TeachingScheduleError("meeting week_numbers are invalid")
        if not isinstance(record.get("teaching_class_composition"), list):
            raise TeachingScheduleError("meeting teaching_class_composition is invalid")
    for field in ("practice_notes",):
        if not isinstance(schedule.get(field), list):
            raise TeachingScheduleError(f"schedule {field} must be a list")
    if not isinstance(schedule.get("supplemental"), dict) or not isinstance(schedule.get("weekday_names"), dict):
        raise TeachingScheduleError("schedule supplemental data is invalid")
    if schedule.get("weeks"):
        _validate_weeks(schedule["weeks"])
    if schedule.get("error") is not None and not isinstance(schedule.get("error"), str):
        raise TeachingScheduleError("schedule error must be null or string")
    if descriptor["descriptor_id"] == "":
        raise TeachingScheduleError("descriptor_id is required")
    return schedule


def load_teaching_schedule_source(root: Path) -> TeachingScheduleSource:
    root = root.resolve()
    manifest = read_json(root / "manifest.json")
    _require_exact_object(manifest, SOURCE_MANIFEST_FIELDS, "source manifest")
    if manifest.get("format") != SOURCE_FORMAT:
        raise TeachingScheduleError("Unsupported TeachingScheduleSource format")
    source_id = require_sha256(manifest.get("source_id"), "source_id")
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        raise TeachingScheduleError("source artifacts must be a non-empty list")
    paths: dict[str, Path] = {}
    for reference in artifacts:
        path = validate_artifact(root, reference)
        relative = path.relative_to(root).as_posix()
        if relative in paths:
            raise TeachingScheduleError(f"Duplicate artifact: {relative}")
        paths[relative] = path
    identity = {key: value for key, value in manifest.items() if key not in {"source_id", "observed_at"}}
    if source_id != sha256(canonical_bytes(identity, newline=True)):
        raise TeachingScheduleError("TeachingScheduleSource identity mismatch")
    expected_base = {"catalog.json", "term.json", "periods.json"}
    if not expected_base.issubset(paths) or not any(path.startswith("schedules/") for path in paths):
        raise TeachingScheduleError("TeachingScheduleSource file layout is incomplete")
    actual = {
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file()
    }
    if actual != {"manifest.json", *paths}:
        raise TeachingScheduleError("TeachingScheduleSource file set mismatch")

    catalog = read_json(paths["catalog.json"])
    if not isinstance(catalog, list) or len(catalog) != manifest.get("catalog_count"):
        raise TeachingScheduleError("TeachingScheduleSource catalog count mismatch")
    statuses = {status: 0 for status in STATUS_VALUES}
    descriptor_ids: set[str] = set()
    for value in catalog:
        entry = _require_exact_object(value, CATALOG_ENTRY_FIELDS, "catalog entry")
        descriptor = _validate_descriptor(entry.get("descriptor"))
        if descriptor["descriptor_id"] in descriptor_ids:
            raise TeachingScheduleError("Duplicate catalog descriptor")
        descriptor_ids.add(descriptor["descriptor_id"])
        status = entry.get("status")
        if status not in STATUS_VALUES:
            raise TeachingScheduleError("catalog status is invalid")
        statuses[status] += 1
    for status, field in (("success", "successful_count"), ("empty", "empty_count"), ("special", "special_count"), ("failed", "failed_count")):
        if statuses[status] != manifest.get(field):
            raise TeachingScheduleError(f"{field} does not match catalog")
    if statuses["failed"]:
        raise TeachingScheduleError("TeachingScheduleSource contains failed catalog entries")

    term = read_json(paths["term.json"])
    if not isinstance(term, dict) or set(term) != {"academic_year", "term_number", "internal_year_code", "internal_term_code", "weeks"}:
        raise TeachingScheduleError("term.json has an incompatible shape")
    weeks = _validate_weeks(term["weeks"])
    period_doc = read_json(paths["periods.json"])
    if not isinstance(period_doc, dict) or set(period_doc) != {"source", "periods"} or period_doc.get("source") != "current-teaching-system":
        raise TeachingScheduleError("periods.json has an incompatible shape")
    periods = _validate_periods(period_doc["periods"])
    if len(weeks) != manifest.get("week_count") or len(periods) != manifest.get("period_count"):
        raise TeachingScheduleError("week or period count mismatch")
    if (
        term.get("academic_year") != manifest.get("academic_year")
        or term.get("term_number") != manifest.get("term_number")
        or term.get("internal_year_code") != manifest.get("internal_year_code")
        or term.get("internal_term_code") != manifest.get("internal_term_code")
    ):
        raise TeachingScheduleError("term identity mismatch")

    schedules: list[dict[str, Any]] = []
    for relative in sorted(path for path in paths if path.startswith("schedules/")):
        schedule = _validate_schedule(read_json(paths[relative]))
        if schedule["descriptor"]["descriptor_id"] not in descriptor_ids:
            raise TeachingScheduleError("schedule is absent from catalog")
        schedules.append(schedule)
    if len(schedules) != len(catalog):
        raise TeachingScheduleError("every catalog entry must have one schedule artifact")
    schedule_ids = [item["descriptor"]["descriptor_id"] for item in schedules]
    if set(schedule_ids) != descriptor_ids or len(set(schedule_ids)) != len(schedule_ids):
        raise TeachingScheduleError("catalog and schedule descriptors do not match")

    observed_at = manifest.get("observed_at")
    if not isinstance(observed_at, str) or not observed_at:
        raise TeachingScheduleError("observed_at is required")
    return TeachingScheduleSource(
        root=root,
        source_id=source_id,
        academic_year=str(manifest["academic_year"]),
        term_number=int(manifest["term_number"]),
        observed_at=observed_at,
        catalog=catalog,
        weeks=weeks,
        periods=periods,
        schedules=schedules,
    )
