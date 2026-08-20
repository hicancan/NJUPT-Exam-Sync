from __future__ import annotations

import pytest

from academics.exam.records.model import ExamDataError
from academics.exam.records.extract import process_single_file
from academics.exam.snapshot.build import get_source_updated_at, publish_exam_artifacts
from academics.exam.records.identity import canonicalize_exam_records


def test_process_single_file_fails_fast_on_corrupt_xlsx(tmp_path):
    corrupt_file = tmp_path / "broken.xlsx"
    corrupt_file.write_bytes(b"not an xlsx")

    with pytest.raises(ExamDataError):
        process_single_file(corrupt_file)


def test_main_fails_fast_on_unparsable_rows(monkeypatch, tmp_path):
    from academics.exam.snapshot import build as publisher

    monkeypatch.setattr(
        publisher,
        "get_xlsx_files",
        lambda _: [tmp_path / "schedule.xlsx"],
    )
    monkeypatch.setattr(
        publisher,
        "process_single_file",
        lambda _: {
            "filename": "schedule.xlsx",
            "parse_fail_count": 1,
            "raw_data": [],
        },
    )

    with pytest.raises(ExamDataError):
        publish_exam_artifacts(
            input_dir=tmp_path,
            output_dir=tmp_path / "snapshot",
        )


def test_source_updated_at_is_explicit_and_timezone_aware():
    value = "2026-06-10T10:06:41.783558+00:00"
    assert get_source_updated_at({"source_updated_at": value}) == value
    with pytest.raises(ExamDataError):
        get_source_updated_at({})
    with pytest.raises(ExamDataError):
        get_source_updated_at({"source_updated_at": "2026-06-10T10:06:41"})


def test_history_key_groups_split_rows_without_using_mutable_schedule_fields():
    base = {
        "exam_period_id": "2025-2026-2",
        "class_name": "B240402",
        "course_name": "算法分析与设计",
        "course_code": "JS113400S",
        "teacher": "张三",
        "campus": "仙林",
        "location": "教2-313",
        "raw_time": "2026年07月01日(08:00-09:50)",
        "count": 30,
        "start_timestamp": "2026-07-01T08:00:00+08:00",
        "end_timestamp": "2026-07-01T09:50:00+08:00",
        "duration_minutes": 110,
        "date": "2026-07-01",
        "notes": "",
        "_source_file": "schedule.xlsx",
        "_row_index": 2,
    }
    records = canonicalize_exam_records([
        base,
        {**base, "teacher": "李四", "location": "教2-314", "_row_index": 3},
    ])

    assert len(records) == 2
    assert len({record["history_key"] for record in records}) == 1
    assert len({record["stable_key"] for record in records}) == 2
