from __future__ import annotations

import json
from pathlib import Path

import pytest

from .build import publish_teaching_artifacts
from .model import TeachingScheduleError, canonical_bytes, sha256


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical_bytes(value))


def _artifact(root: Path, relative: str) -> dict[str, object]:
    content = (root / relative).read_bytes()
    return {"path": relative, "bytes": len(content), "sha256": sha256(content)}


def _descriptor(class_id: str) -> dict[str, object]:
    return {
        "descriptor_id": f"descriptor-{class_id}",
        "class_id": class_id,
        "name": f"{class_id}课表",
        "campus_id": "2",
        "campus": "仙林",
        "grade": "2024",
        "college_id": "11",
        "college": "通信与信息工程学院",
        "major_id": "1101",
        "major": "通信工程",
        "direction_id": None,
        "direction": None,
        "level": None,
        "timetable_kind": "class",
        "timetable_display": f"{class_id}课表",
    }


def _meeting(composition: list[str], location: str = "教2-313") -> dict[str, object]:
    return {
        "course_code": "B010101",
        "course_name": "测试课程",
        "weekday": 2,
        "weekday_label": "星期二",
        "period_label": "3-4节",
        "periods": [3, 4],
        "week_label": "1-2周",
        "week_numbers": [1, 2],
        "room_id": "313",
        "location": location,
        "location_type": "physical",
        "teacher": "测试教师",
        "teacher_title": "讲师",
        "teaching_class_id": "teaching-class-1",
        "teaching_class_name": "测试教学班",
        "teaching_class_composition": composition,
        "direction_id": None,
        "direction": None,
        "course_category": "专业课",
        "course_nature": "必修",
        "teaching_class_size": 60,
        "enrollment_count": 59,
        "assessment_method": "考试",
        "enrollment_note": None,
        "class_hours_composition": "理论:32",
        "online_information": None,
        "total_hours": 32,
        "credits": 2.0,
        "capacity": 60,
        "campus_id": "2",
        "campus": "仙林",
        "teaching_method": "面授讲课",
        "instructor_role": "主讲",
        "course_total_hours": 32,
        "exam_method": "未安排",
        "weekly_hours": 2,
        "scheduling_flag": "1",
    }


def _write_source(root: Path, *, location: str = "教2-313") -> None:
    descriptors = [_descriptor("B240401"), _descriptor("B240402")]
    catalog = [{"descriptor": descriptor, "status": "success", "error": None} for descriptor in descriptors]
    weeks = [
        {"week": 1, "start_date": "2026-08-31", "end_date": "2026-09-06"},
        {"week": 2, "start_date": "2026-09-07", "end_date": "2026-09-13"},
    ]
    periods = [
        {"period": 1, "start_time": "08:00", "end_time": "08:45", "day_part": "morning"},
        {"period": 2, "start_time": "08:50", "end_time": "09:35", "day_part": "morning"},
        {"period": 3, "start_time": "09:50", "end_time": "10:35", "day_part": "morning"},
        {"period": 4, "start_time": "10:40", "end_time": "11:25", "day_part": "morning"},
    ]
    _write_json(root / "catalog.json", catalog)
    _write_json(root / "term.json", {"academic_year": "2026-2027", "term_number": 1, "internal_year_code": "2026", "internal_term_code": "3", "weeks": weeks})
    _write_json(root / "periods.json", {"source": "current-teaching-system", "periods": periods})
    composition = ["B240401", "B240402"]
    for descriptor in descriptors:
        schedule = {
            "descriptor": descriptor,
            "status": "success",
            "meetings": [_meeting(composition, location)],
            "practice_notes": [],
            "supplemental": {},
            "weeks": weeks,
            "weekday_names": {"1": "星期一", "2": "星期二"},
            "first_weekday": 1,
            "error": None,
        }
        _write_json(root / "schedules" / f"{descriptor['descriptor_id']}.json", schedule)
    artifacts = [_artifact(root, relative) for relative in [
        "catalog.json",
        "term.json",
        "periods.json",
        "schedules/descriptor-B240401.json",
        "schedules/descriptor-B240402.json",
    ]]
    identity = {
        "format": "njupt-teaching-schedule-source",
        "academic_year": "2026-2027",
        "term_number": 1,
        "internal_year_code": "2026",
        "internal_term_code": "3",
        "catalog_count": 2,
        "successful_count": 2,
        "empty_count": 0,
        "special_count": 0,
        "failed_count": 0,
        "week_count": 2,
        "period_count": 4,
        "artifacts": artifacts,
    }
    manifest = {**identity, "source_id": sha256(canonical_bytes(identity, newline=True)), "observed_at": "2026-08-31T09:00:00+08:00"}
    (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")


def _write_catalog(path: Path) -> None:
    _write_json(path, {"format": "njupt-room-catalog", "floors": [{"campus": "仙林", "building": "教2", "floor": "3", "rooms": [{"room": "313"}]}]})


def test_compiles_deterministically_and_deduplicates_shared_meeting(tmp_path: Path) -> None:
    source = tmp_path / "source"
    catalog = tmp_path / "catalog.json"
    _write_source(source)
    _write_catalog(catalog)
    first_snapshot, first_occupancy = publish_teaching_artifacts(
        source_dir=source,
        snapshot_dir=tmp_path / "first" / "timetable",
        occupancy_dir=tmp_path / "first" / "classrooms",
        catalog_path=catalog,
        exam_snapshot_id="a" * 64,
    )
    second_snapshot, second_occupancy = publish_teaching_artifacts(
        source_dir=source,
        snapshot_dir=tmp_path / "second" / "timetable",
        occupancy_dir=tmp_path / "second" / "classrooms",
        catalog_path=catalog,
        exam_snapshot_id="a" * 64,
    )
    assert first_snapshot == second_snapshot
    assert first_occupancy == second_occupancy
    assert first_snapshot["class_count"] == 2
    assert first_snapshot["meeting_count"] == 1
    assert first_occupancy["teaching_snapshot_id"] == first_snapshot["snapshot_id"]
    assert len(first_occupancy["days"]) == 2


def test_rejects_standard_room_missing_from_catalog(tmp_path: Path) -> None:
    source = tmp_path / "source"
    catalog = tmp_path / "catalog.json"
    _write_source(source, location="教4-999")
    _write_catalog(catalog)
    with pytest.raises(TeachingScheduleError, match="missing from RoomCatalog"):
        publish_teaching_artifacts(
            source_dir=source,
            snapshot_dir=tmp_path / "out" / "timetable",
            occupancy_dir=tmp_path / "out" / "classrooms",
            catalog_path=catalog,
            exam_snapshot_id="b" * 64,
        )
