from __future__ import annotations

import hashlib
import json
import re
import shutil
import uuid
from pathlib import Path
from typing import Any, Callable, Iterable

from academics.space import load_space_snapshot, normalize_location

from .model import (
    OCCUPANCY_FORMAT,
    SNAPSHOT_FORMAT,
    TeachingScheduleError,
    TeachingScheduleSnapshot,
    canonical_bytes,
    load_teaching_schedule_source,
    read_json,
    require_sha256,
    sha256,
)


TERM_FORMAT = "njupt-teaching-term"
PERIODS_FORMAT = "njupt-teaching-periods"
CLASS_INDEX_FORMAT = "njupt-teaching-class-index"
CLASS_CHUNK_FORMAT = "njupt-teaching-class-chunk"
MEETING_CHUNK_FORMAT = "njupt-teaching-meeting-chunk"
OCCUPANCY_DAY_FORMAT = "njupt-teaching-room-day"
CHUNK_TARGET_BYTES = 256 * 1024


def _write_json(path: Path, value: Any, *, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        if pretty:
            json.dump(value, handle, ensure_ascii=False, sort_keys=True, indent=2)
            handle.write("\n")
        else:
            json.dump(value, handle, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _artifact(root: Path, relative_path: str) -> dict[str, Any]:
    content = (root / relative_path).read_bytes()
    return {"path": relative_path, "bytes": len(content), "sha256": sha256(content)}


def _hash_id(prefix: str, value: Any) -> str:
    return prefix + sha256(canonical_bytes(value))[:24]


def _period_bounds(value: Any, period_count: int) -> tuple[int, int]:
    numbers = [int(item) for item in re.findall(r"\d+", str(value or ""))]
    if not numbers:
        raise TeachingScheduleError(f"meeting has no period numbers: {value!r}")
    start, end = min(numbers), max(numbers)
    if start < 1 or end > period_count:
        raise TeachingScheduleError(f"meeting period is outside 1..{period_count}: {value!r}")
    return start, end


def _stable_strings(values: Iterable[Any]) -> list[str]:
    return sorted({str(value).strip() for value in values if str(value).strip()})


def _meeting_payload(record: dict[str, Any], *, period_count: int) -> dict[str, Any]:
    weekday = record.get("weekday")
    if not isinstance(weekday, int) or weekday < 1 or weekday > 7:
        raise TeachingScheduleError(f"meeting weekday is invalid: {record.get('course_name')}")
    start_period, end_period = _period_bounds(record.get("periods"), period_count)
    weeks = sorted({int(week) for week in record.get("week_numbers", [])})
    if not weeks:
        raise TeachingScheduleError(f"meeting has no explicit weeks: {record.get('course_name')}")
    return {
        "teaching_class_id": record.get("teaching_class_id"),
        "teaching_class_name": record.get("teaching_class_name"),
        "course_code": record.get("course_code"),
        "course_name": record["course_name"],
        "course_category": record.get("course_category"),
        "course_nature": record.get("course_nature"),
        "teacher": record.get("teacher"),
        "teacher_title": record.get("teacher_title"),
        "instructor_role": record.get("instructor_role"),
        "campus": record.get("campus"),
        "space_family_id": None,
        "space_unit_id": None,
        "location": record.get("location"),
        "location_type": record.get("location_type"),
        "weekday": weekday,
        "start_period": start_period,
        "end_period": end_period,
        "week_numbers": weeks,
        "teaching_method": record.get("teaching_method"),
        "assessment_method": record.get("assessment_method"),
        "exam_method": record.get("exam_method"),
        "credits": record.get("credits"),
        "class_hours": record.get("total_hours"),
        "course_total_hours": record.get("course_total_hours"),
        "class_hours_composition": record.get("class_hours_composition"),
        "weekly_hours": record.get("weekly_hours"),
        "teaching_class_size": record.get("teaching_class_size"),
        "enrollment_count": record.get("enrollment_count"),
        "capacity": record.get("capacity"),
        "enrollment_note": record.get("enrollment_note"),
        "direction": record.get("direction"),
        "online_information": record.get("online_information"),
        "scheduling_flag": record.get("scheduling_flag"),
    }


def _chunk_mapping(
    values: dict[str, dict[str, Any]],
    *,
    sort_key: Callable[[str], Any] | None = None,
) -> list[dict[str, dict[str, Any]]]:
    chunks: list[dict[str, dict[str, Any]]] = []
    current: dict[str, dict[str, Any]] = {}
    current_bytes = 0
    for key in sorted(values, key=sort_key):
        size = len(canonical_bytes({key: values[key]}))
        if current and current_bytes + size > CHUNK_TARGET_BYTES:
            chunks.append(current)
            current = {}
            current_bytes = 0
        current[key] = values[key]
        current_bytes += size
    if current:
        chunks.append(current)
    return chunks


def _compile(source_dir: Path, output_dir: Path, space_snapshot_path: Path) -> tuple[dict[str, Any], TeachingScheduleSnapshot]:
    source = load_teaching_schedule_source(source_dir)
    space = load_space_snapshot(space_snapshot_path)
    aliases = {alias["normalized_alias"]: alias for alias in space.aliases}
    class_descriptors = {
        entry["descriptor"]["class_id"]: entry["descriptor"]
        for entry in source.catalog
        if entry["status"] in {"success", "empty"} and entry["descriptor"]["class_id"]
    }
    if not class_descriptors:
        raise TeachingScheduleError("TeachingScheduleSource contains no real classes")

    meetings_by_id: dict[str, dict[str, Any]] = {}
    class_meeting_ids: dict[str, set[str]] = {class_id: set() for class_id in class_descriptors}
    for schedule in source.schedules:
        descriptor = schedule["descriptor"]
        class_id = descriptor["class_id"]
        if schedule["status"] not in {"success", "empty"} or not class_id:
            continue
        for record in schedule["meetings"]:
            payload = _meeting_payload(record, period_count=len(source.periods))
            normalized_location = normalize_location(payload["location"])
            alias = aliases.get(normalized_location)
            if alias is not None and alias["status"] not in {"non_physical", "unresolved"}:
                payload["space_family_id"] = alias["space_family_id"]
                payload["space_unit_id"] = alias["space_unit_id"]
                family = space.families_by_id[alias["space_family_id"]]
                building = next(item for item in space.buildings if item["building_id"] == family["building_id"])
                campus = next(item for item in space.campuses if item["campus_id"] == building["campus_id"])
                payload["campus"] = campus["name"]
            elif normalized_location and (alias is None or alias["status"] != "non_physical"):
                raise TeachingScheduleError(
                    f"Teaching location has no terminal SpaceSnapshot alias: {normalized_location}"
                )
            identity = {key: value for key, value in payload.items() if key != "online_information"}
            meeting_id = _hash_id("meeting-", identity)
            related = _stable_strings([class_id, *record.get("teaching_class_composition", [])])
            related = [item for item in related if item in class_descriptors]
            if not related:
                related = [class_id]
            existing = meetings_by_id.get(meeting_id)
            if existing is None:
                meetings_by_id[meeting_id] = {"meeting_id": meeting_id, **payload, "class_ids": related}
            else:
                if {key: value for key, value in existing.items() if key not in {"meeting_id", "class_ids"}} != payload:
                    raise TeachingScheduleError(f"meeting identity collision: {meeting_id}")
                existing["class_ids"] = _stable_strings([*existing["class_ids"], *related])
            for related_class in related:
                class_meeting_ids[related_class].add(meeting_id)

    classes_by_id: dict[str, dict[str, Any]] = {}
    for class_id, descriptor in sorted(class_descriptors.items()):
        classes_by_id[class_id] = {
            "class_id": class_id,
            "class_name": descriptor["name"].removesuffix("课表") or class_id,
            "grade": descriptor.get("grade"),
            "college": descriptor.get("college"),
            "major": descriptor.get("major"),
            "direction": descriptor.get("direction"),
            "level": descriptor.get("level"),
            "campus": descriptor.get("campus"),
            "meeting_ids": sorted(class_meeting_ids[class_id]),
        }

    term_doc = {
        "format": TERM_FORMAT,
        "source_id": source.source_id,
        "academic_year": source.academic_year,
        "term_number": source.term_number,
        "weeks": source.weeks,
    }
    periods_doc = {"format": PERIODS_FORMAT, "source_id": source.source_id, "periods": source.periods}
    _write_json(output_dir / "term.json", term_doc)
    _write_json(output_dir / "periods.json", periods_doc)

    class_chunks: list[dict[str, Any]] = []
    class_entries: list[dict[str, Any]] = []
    for index, classes in enumerate(_chunk_mapping(classes_by_id)):
        relative = f"classes-{index:03d}.json"
        chunk_id = sha256(canonical_bytes(classes))
        _write_json(output_dir / relative, {"format": CLASS_CHUNK_FORMAT, "source_id": source.source_id, "chunk_id": chunk_id, "classes": classes})
        reference = _artifact(output_dir, relative)
        class_chunks.append(reference)
        for class_id, value in classes.items():
            class_entries.append({
                "class_id": class_id,
                "class_name": value["class_name"],
                "meeting_count": len(value["meeting_ids"]),
                "chunk_path": relative,
                "chunk_id": chunk_id,
            })

    meeting_chunks: list[dict[str, Any]] = []
    meeting_chunk_path: dict[str, str] = {}
    for index, meetings in enumerate(_chunk_mapping(
        meetings_by_id,
        sort_key=lambda meeting_id: (tuple(meetings_by_id[meeting_id]["class_ids"]), meeting_id),
    )):
        relative = f"meetings-{index:03d}.json"
        chunk_id = sha256(canonical_bytes(meetings))
        _write_json(output_dir / relative, {"format": MEETING_CHUNK_FORMAT, "source_id": source.source_id, "chunk_id": chunk_id, "meetings": meetings})
        meeting_chunks.append(_artifact(output_dir, relative))
        for meeting_id in meetings:
            meeting_chunk_path[meeting_id] = relative

    class_entries.sort(key=lambda value: (value["class_name"], value["class_id"]))
    class_index = {
        "format": CLASS_INDEX_FORMAT,
        "source_id": source.source_id,
        "class_count": len(class_entries),
        "meeting_count": len(meetings_by_id),
        "classes": class_entries,
        "meeting_chunks": [
            {"meeting_id": meeting_id, "chunk_path": meeting_chunk_path[meeting_id]}
            for meeting_id in sorted(meeting_chunk_path)
        ],
    }
    _write_json(output_dir / "class-index.json", class_index)
    references = {
        "term": _artifact(output_dir, "term.json"),
        "periods": _artifact(output_dir, "periods.json"),
        "class_index": _artifact(output_dir, "class-index.json"),
        "class_chunks": class_chunks,
        "meeting_chunks": meeting_chunks,
    }
    identity = {
        "format": SNAPSHOT_FORMAT,
        "source_id": source.source_id,
        "space_snapshot_id": space.snapshot_id,
        "observed_at": source.observed_at,
        "academic_year": source.academic_year,
        "term_number": source.term_number,
        "week_count": len(source.weeks),
        "class_count": len(class_entries),
        "meeting_count": len(meetings_by_id),
        **references,
    }
    snapshot_id = sha256(canonical_bytes(identity))
    manifest = {**identity, "snapshot_id": snapshot_id}
    _write_json(output_dir / "manifest.json", manifest, pretty=True)
    snapshot = TeachingScheduleSnapshot(
        root=output_dir,
        snapshot_id=snapshot_id,
        source_id=source.source_id,
        space_snapshot_id=space.snapshot_id,
        academic_year=source.academic_year,
        term_number=source.term_number,
        observed_at=source.observed_at,
        weeks=source.weeks,
        periods=source.periods,
        classes=list(classes_by_id.values()),
        meetings=list(meetings_by_id.values()),
    )
    return manifest, snapshot


def _build_occupancy(
    *,
    output_dir: Path,
    snapshot: TeachingScheduleSnapshot,
    space_snapshot_path: Path,
    exam_snapshot_id: str,
) -> dict[str, Any]:
    require_sha256(exam_snapshot_id, "exam_snapshot_id")
    space = load_space_snapshot(space_snapshot_path)
    families = space.families_by_id
    buildings = {item["building_id"]: item for item in space.buildings}
    campuses = {item["campus_id"]: item for item in space.campuses}
    floors = {item["floor_id"]: item for item in space.floors}

    by_day: dict[tuple[int, int], dict[str, list[dict[str, Any]]]] = {}
    unresolved: dict[str, int] = {}
    for meeting in snapshot.meetings:
        family_id = meeting.get("space_family_id")
        if not family_id:
            location = normalize_location(meeting.get("location"))
            if location:
                unresolved[location] = unresolved.get(location, 0) + 1
            continue
        family = families.get(str(family_id))
        if family is None:
            raise TeachingScheduleError(f"Meeting space is absent from SpaceSnapshot: {family_id}")
        floor = floors[family["floor_id"]]
        building = buildings[family["building_id"]]
        campus = campuses[building["campus_id"]]
        booking = {
            "meeting_id": meeting["meeting_id"],
            "course_name": meeting["course_name"],
            "course_code": meeting["course_code"],
            "class_ids": meeting["class_ids"],
            "teacher": meeting["teacher"],
            "campus": campus["name"],
            "building": building["name"],
            "floor": floor["level"],
            "floor_id": floor["floor_id"],
            "room": family["room_number"],
            "space_family_id": family["space_family_id"],
            "space_unit_id": meeting.get("space_unit_id"),
            "location": meeting["location"],
            "start_period": meeting["start_period"],
            "end_period": meeting["end_period"],
        }
        for week in meeting["week_numbers"]:
            day = by_day.setdefault((week, meeting["weekday"]), {})
            for period in range(meeting["start_period"], meeting["end_period"] + 1):
                day.setdefault(str(period), []).append(booking)

    day_refs: list[dict[str, Any]] = []
    for (week, weekday), periods in sorted(by_day.items()):
        for bookings in periods.values():
            bookings.sort(key=lambda value: (value["space_family_id"], value["meeting_id"]))
        relative = f"days/week-{week:02d}-day-{weekday}.json"
        payload = {
            "format": OCCUPANCY_DAY_FORMAT,
            "teaching_snapshot_id": snapshot.snapshot_id,
            "week": week,
            "weekday": weekday,
            "periods": periods,
        }
        _write_json(output_dir / relative, payload)
        day_refs.append({"week": week, "weekday": weekday, "artifact": _artifact(output_dir, relative)})

    identity = {
        "format": OCCUPANCY_FORMAT,
        "teaching_snapshot_id": snapshot.snapshot_id,
        "exam_snapshot_id": exam_snapshot_id,
        "space_snapshot_id": space.snapshot_id,
        "academic_year": snapshot.academic_year,
        "term_number": snapshot.term_number,
        "weeks": snapshot.weeks,
        "periods": snapshot.periods,
        "unresolved_locations": [{"location": location, "count": count} for location, count in sorted(unresolved.items())],
        "days": day_refs,
    }
    manifest = {**identity, "occupancy_id": sha256(canonical_bytes(identity))}
    _write_json(output_dir / "manifest.json", manifest, pretty=True)
    return manifest


def _validate_file_set(root: Path, manifest: dict[str, Any], *, kind: str) -> None:
    expected = {"manifest.json"}
    if kind == "snapshot":
        for key in ("term", "periods", "class_index"):
            expected.add(manifest[key]["path"])
        for key in ("class_chunks", "meeting_chunks"):
            expected.update(reference["path"] for reference in manifest[key])
        identity = {key: value for key, value in manifest.items() if key != "snapshot_id"}
        if manifest["snapshot_id"] != sha256(canonical_bytes(identity)):
            raise TeachingScheduleError("TeachingScheduleSnapshot identity mismatch")
    else:
        expected.update(entry["artifact"]["path"] for entry in manifest["days"])
        identity = {key: value for key, value in manifest.items() if key != "occupancy_id"}
        if manifest["occupancy_id"] != sha256(canonical_bytes(identity)):
            raise TeachingScheduleError("TeachingRoomOccupancy identity mismatch")
    actual = {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}
    if actual != expected:
        raise TeachingScheduleError(f"{kind} file set mismatch")
    references: list[dict[str, Any]] = []
    if kind == "snapshot":
        references.extend(manifest[key] for key in ("term", "periods", "class_index"))
        references.extend(manifest["class_chunks"])
        references.extend(manifest["meeting_chunks"])
    else:
        references.extend(entry["artifact"] for entry in manifest["days"])
    for reference in references:
        content = (root / reference["path"]).read_bytes()
        if len(content) != reference["bytes"] or sha256(content) != reference["sha256"]:
            raise TeachingScheduleError(f"artifact integrity mismatch: {reference['path']}")


def publish_teaching_artifacts(
    *,
    source_dir: Path,
    snapshot_dir: Path,
    occupancy_dir: Path,
    space_snapshot_path: Path,
    exam_snapshot_id: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    snapshot_dir = snapshot_dir.resolve()
    occupancy_dir = occupancy_dir.resolve()
    if snapshot_dir.parent != occupancy_dir.parent:
        raise TeachingScheduleError("teaching outputs must share a parent directory")
    parent = snapshot_dir.parent
    parent.mkdir(parents=True, exist_ok=True)
    staging = parent / f"teaching.staging-{uuid.uuid4().hex}"
    staging_snapshot = staging / "snapshot"
    staging_occupancy = staging / "occupancy"
    staging_snapshot.mkdir(parents=True)
    staging_occupancy.mkdir(parents=True)
    backups: list[tuple[Path, Path]] = []
    try:
        snapshot_manifest, snapshot = _compile(source_dir.resolve(), staging_snapshot, space_snapshot_path.resolve())
        occupancy_manifest = _build_occupancy(
            output_dir=staging_occupancy,
            snapshot=snapshot,
            space_snapshot_path=space_snapshot_path.resolve(),
            exam_snapshot_id=exam_snapshot_id,
        )
        _validate_file_set(staging_snapshot, snapshot_manifest, kind="snapshot")
        _validate_file_set(staging_occupancy, occupancy_manifest, kind="occupancy")
        for target in (snapshot_dir, occupancy_dir):
            if target.exists():
                backup = parent / f"{target.name}.backup-{uuid.uuid4().hex}"
                target.replace(backup)
                backups.append((target, backup))
        staging_snapshot.replace(snapshot_dir)
        staging_occupancy.replace(occupancy_dir)
        shutil.rmtree(staging)
        for _, backup in backups:
            shutil.rmtree(backup)
        return snapshot_manifest, occupancy_manifest
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        for target, backup in reversed(backups):
            if target.exists():
                shutil.rmtree(target)
            if backup.exists():
                backup.replace(target)
        raise


def load_teaching_schedule_snapshot(root: Path) -> TeachingScheduleSnapshot:
    root = root.resolve()
    manifest = read_json(root / "manifest.json")
    if not isinstance(manifest, dict) or manifest.get("format") != SNAPSHOT_FORMAT:
        raise TeachingScheduleError("Unsupported TeachingScheduleSnapshot")
    snapshot_id = require_sha256(manifest.get("snapshot_id"), "snapshot_id")
    _validate_file_set(root, manifest, kind="snapshot")
    term = read_json(root / manifest["term"]["path"])
    periods = read_json(root / manifest["periods"]["path"])
    index = read_json(root / manifest["class_index"]["path"])
    classes: list[dict[str, Any]] = []
    for reference in manifest["class_chunks"]:
        classes.extend(read_json(root / reference["path"])["classes"].values())
    meetings: list[dict[str, Any]] = []
    for reference in manifest["meeting_chunks"]:
        meetings.extend(read_json(root / reference["path"])["meetings"].values())
    if len(classes) != index.get("class_count") or len(meetings) != index.get("meeting_count"):
        raise TeachingScheduleError("TeachingScheduleSnapshot counts do not match")
    return TeachingScheduleSnapshot(
        root=root,
        snapshot_id=snapshot_id,
        source_id=require_sha256(manifest.get("source_id"), "source_id"),
        space_snapshot_id=require_sha256(manifest.get("space_snapshot_id"), "space_snapshot_id"),
        academic_year=manifest["academic_year"],
        term_number=manifest["term_number"],
        observed_at=manifest["observed_at"],
        weeks=term["weeks"],
        periods=periods["periods"],
        classes=classes,
        meetings=meetings,
    )
