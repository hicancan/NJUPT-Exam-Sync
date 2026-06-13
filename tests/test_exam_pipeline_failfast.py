from __future__ import annotations

import pytest

from njupt_exam_pipeline.contract import ExamPipelineError
from njupt_exam_pipeline.processor import process_single_file
from njupt_exam_pipeline.publisher import publish_exam_artifacts


def test_process_single_file_fails_fast_on_corrupt_xlsx(tmp_path):
    corrupt_file = tmp_path / "broken.xlsx"
    corrupt_file.write_bytes(b"not an xlsx")

    with pytest.raises(ExamPipelineError):
        process_single_file(corrupt_file)


def test_main_fails_fast_on_unparsable_rows(monkeypatch, tmp_path):
    import njupt_exam_pipeline.publisher as publisher

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

    with pytest.raises(ExamPipelineError):
        publish_exam_artifacts(
            data_dir=tmp_path,
            merged_json_path=tmp_path / "all_exams.json",
        )
