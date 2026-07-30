from __future__ import annotations

import pytest

from academics.exam.records.model import ExamDataError
from academics.exam.records.extract import process_single_file
from academics.exam.snapshot.build import get_source_updated_at, publish_exam_artifacts


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
    assert get_source_updated_at({"updated_at": value}) == value
    with pytest.raises(ExamDataError):
        get_source_updated_at({})
    with pytest.raises(ExamDataError):
        get_source_updated_at({"updated_at": "2026-06-10T10:06:41"})
