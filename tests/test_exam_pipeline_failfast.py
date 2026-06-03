from __future__ import annotations

import pytest

from njupt_exam_pipeline import analyze_and_update


def test_process_single_file_fails_fast_on_corrupt_xlsx(tmp_path):
    corrupt_file = tmp_path / "broken.xlsx"
    corrupt_file.write_bytes(b"not an xlsx")

    with pytest.raises(analyze_and_update.ExamPipelineError):
        analyze_and_update.process_single_file(str(corrupt_file))


def test_main_fails_fast_on_unparsable_rows(monkeypatch, tmp_path):
    monkeypatch.setattr(analyze_and_update, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(analyze_and_update, "MERGED_JSON_PATH", str(tmp_path / "all_exams.json"))
    monkeypatch.setattr(analyze_and_update, "OUTPUT_DOC_PATH", str(tmp_path / "DATA_INVENTORY.md"))
    monkeypatch.setattr(analyze_and_update, "get_xlsx_files", lambda: [str(tmp_path / "schedule.xlsx")])
    monkeypatch.setattr(
        analyze_and_update,
        "process_single_file",
        lambda _: {
            "filename": "schedule.xlsx",
            "parse_fail_count": 1,
            "raw_data": [],
        },
    )

    with pytest.raises(analyze_and_update.ExamPipelineError):
        analyze_and_update.main()
