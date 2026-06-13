from __future__ import annotations

import pytest

from njupt_exam_pipeline.contract import ExamPipelineError
from njupt_exam_pipeline.contract import parse_exam_period
from njupt_exam_pipeline.diff import canonicalize_exam_records, class_file_key, compare_exam_records
from njupt_exam_pipeline.history import ExamSnapshot, build_exam_history


def exam(**patch):
    base = {
        "id": "schedule.xlsx-2",
        "class_name": "B240402",
        "course_name": "大学英语",
        "course_code": "EN1001",
        "location": "教2-101",
        "campus": "仙林",
        "teacher": "张三",
        "notes": "",
        "count": 31,
        "raw_time": "2026年06月08日 08:00-10:00",
        "start_timestamp": "2026-06-08T08:00:00+08:00",
        "end_timestamp": "2026-06-08T10:00:00+08:00",
        "duration_minutes": 120,
    }
    base.update(patch)
    return base


def snapshot(data_version: str, auto_updated_at: str, records, *, source_title: str = "2025-2026学年第二学期考试安排表"):
    period = parse_exam_period(source_title)
    return ExamSnapshot(
        data_version=data_version,
        auto_updated_at=auto_updated_at,
        exam_period_id=period.exam_period_id,
        academic_year=period.academic_year,
        term_number=period.term_number,
        term_label=period.term_label,
        source_url=None,
        source_title=source_title,
        records=list(records),
    )


def test_row_id_change_is_not_a_material_exam_change():
    delta = compare_exam_records(
        previous_records=[exam(id="old-row-2")],
        current_records=[exam(id="new-row-88")],
    )

    assert delta["totals"]["unchanged"] == 1
    assert delta["totals"]["changed"] == 0
    assert delta["changes"] == []


def test_exact_duplicate_source_rows_are_collapsed_before_history_diff():
    duplicate_a = exam(id="schedule.xlsx-2008")
    duplicate_b = exam(id="schedule.xlsx-2009")

    canonical = canonicalize_exam_records([duplicate_b, duplicate_a])

    assert len(canonical) == 1
    assert canonical[0]["duplicate_count"] == 2
    assert [item["id"] for item in canonical[0]["source_refs"]] == ["schedule.xlsx-2008", "schedule.xlsx-2009"]

    delta = compare_exam_records(
        previous_records=[duplicate_a, duplicate_b],
        current_records=[exam(id="next.xlsx-88")],
    )

    assert delta["totals"]["unchanged"] == 1
    assert delta["totals"]["changed"] == 0
    assert delta["changes"] == []


def test_duration_change_reports_field_level_diff():
    delta = compare_exam_records(
        previous_records=[exam(duration_minutes=120, end_timestamp="2026-06-08T10:00:00+08:00")],
        current_records=[exam(duration_minutes=130, end_timestamp="2026-06-08T10:10:00+08:00")],
    )

    changed = delta["changes"][0]
    assert delta["totals"]["changed"] == 1
    assert changed["type"] == "changed"
    assert {"field": "duration_minutes", "label": "时长", "before": 120, "after": 130} in changed["fields"]


def test_added_and_removed_exams_are_reported_by_identity_key():
    delta = compare_exam_records(
        previous_records=[exam(course_code="A", course_name="A课")],
        current_records=[exam(course_code="B", course_name="B课")],
    )

    assert delta["totals"]["added"] == 1
    assert delta["totals"]["removed"] == 1
    assert {change["type"] for change in delta["changes"]} == {"added", "removed"}


def test_duplicate_records_pair_by_deterministic_room_split():
    previous = [
        exam(id="old-1", location="教2-101", count=1, end_timestamp="2026-06-08T09:50:00+08:00", duration_minutes=110),
        exam(id="old-2", location="教2-102", count=1, end_timestamp="2026-06-08T09:50:00+08:00", duration_minutes=110),
    ]
    current = [
        exam(id="new-1", location="教2-101", count=1, end_timestamp="2026-06-08T10:00:00+08:00", duration_minutes=120),
        exam(id="new-2", location="教2-102", count=1, end_timestamp="2026-06-08T10:00:00+08:00", duration_minutes=120),
    ]

    delta = compare_exam_records(previous_records=previous, current_records=current)

    assert delta["totals"]["changed"] == 2
    assert all(change["type"] == "changed" for change in delta["changes"])


def test_ambiguous_duplicate_identity_group_fails_fast():
    with pytest.raises(ExamPipelineError):
        compare_exam_records(
            previous_records=[
                exam(id="old-1", location="教2-101", count=1),
                exam(id="old-2", location="教2-102", count=1),
            ],
            current_records=[
                exam(id="new-1", location="教3-201", count=1),
                exam(id="new-2", location="教3-202", count=1),
            ],
        )


def test_class_history_events_skip_unchanged_snapshots():
    first = snapshot("first", "2026-06-08T00:00:00+08:00", [exam(duration_minutes=110, end_timestamp="2026-06-08T09:50:00+08:00")])
    second = snapshot("second", "2026-06-09T00:00:00+08:00", [exam(duration_minutes=120, end_timestamp="2026-06-08T10:00:00+08:00")])
    third = snapshot("third", "2026-06-10T00:00:00+08:00", [exam(duration_minutes=120, end_timestamp="2026-06-08T10:00:00+08:00")])

    manifest, class_files = build_exam_history([first, second, third], generated_at="2026-06-10T00:00:00+08:00")
    b240402 = class_files[class_file_key("B240402")]

    assert manifest["totals"]["snapshot_count"] == 3
    assert manifest["exam_period_id"] == "2025-2026-2"
    assert b240402["version"] == "exam-class-history-v2"
    assert "checkpoints" not in b240402
    assert "latest_substantive_change" not in b240402
    assert [event["status"] for event in b240402["events"]] == ["changed", "first_seen"]
    assert b240402["latest_change_event"]["data_version"] == "second"
    assert b240402["events"][0]["totals"]["changed"] == 1
    assert {field["field"] for field in b240402["events"][0]["changes"][0]["fields"]} == {"end_timestamp", "duration_minutes"}


def test_single_snapshot_period_is_first_seen_without_previous_semester_diff():
    first_next_semester = snapshot(
        "next-first",
        "2026-12-01T00:00:00+08:00",
        [exam(raw_time="2027年01月02日 08:00-10:00", start_timestamp="2027-01-02T08:00:00+08:00", end_timestamp="2027-01-02T10:00:00+08:00")],
        source_title="2026-2027学年第一学期考试安排表",
    )

    manifest, class_files = build_exam_history([first_next_semester], generated_at="2026-12-01T00:00:00+08:00")
    b240402 = class_files[class_file_key("B240402")]

    assert manifest["exam_period_id"] == "2026-2027-1"
    assert manifest["totals"]["snapshot_count"] == 1
    assert b240402["events"][0]["status"] == "first_seen"
    assert b240402["events"][0]["previous_data_version"] is None


def test_mixed_exam_period_history_fails_fast():
    current_period = snapshot("current", "2026-06-10T00:00:00+08:00", [exam()])
    next_period = snapshot(
        "next",
        "2026-12-01T00:00:00+08:00",
        [exam(raw_time="2027年01月02日 08:00-10:00", start_timestamp="2027-01-02T08:00:00+08:00", end_timestamp="2027-01-02T10:00:00+08:00")],
        source_title="2026-2027学年第一学期考试安排表",
    )

    with pytest.raises(ExamPipelineError, match="one exam_period_id"):
        build_exam_history([current_period, next_period], generated_at="2026-12-01T00:00:00+08:00")
