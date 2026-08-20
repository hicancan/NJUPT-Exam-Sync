from __future__ import annotations

import json
from pathlib import Path

import pytest

from academics.exam.history import load_exam_history, publish_exam_history_artifacts
from academics.exam.records.model import ExamDataError
from academics.exam.snapshot.build import publish_exam_artifacts


def row(**patch):
    value = {
        "_source_file": "schedule.xlsx",
        "_row_index": 2,
        "campus": "仙林",
        "course_name": "算法分析与设计",
        "course_code": "JS113400S",
        "class_name": "B240402",
        "teacher": "张三",
        "location": "教2-313",
        "raw_time": "2026年07月01日(08:00-09:50)",
        "count": 31,
        "notes": "",
        "start_timestamp": "2026-07-01T08:00:00+08:00",
        "end_timestamp": "2026-07-01T09:50:00+08:00",
        "duration_minutes": 110,
        "date": "2026-07-01",
        "validation_error": None,
    }
    value.update(patch)
    return value


def snapshot(
    monkeypatch,
    root: Path,
    name: str,
    rows,
    *,
    source_id: str,
    updated_at: str,
    title: str = "2025-2026学年第二学期考试安排表",
) -> Path:
    from academics.exam.snapshot import build as publisher

    monkeypatch.setattr(publisher, "get_xlsx_files", lambda _: [root / "schedule.xlsx"])
    monkeypatch.setattr(
        publisher,
        "process_single_file",
        lambda _: {
            "filename": "schedule.xlsx",
            "parse_fail_count": 0,
            "raw_data": list(rows),
        },
    )
    monkeypatch.setattr(
        publisher,
        "load_source_metadata",
        lambda _: {
            "source_id": source_id,
            "source_updated_at": updated_at,
            "source_url": "https://example.test/exam",
            "source_title": title,
        },
    )
    output = root / name
    publish_exam_artifacts(input_dir=root, output_dir=output)
    return output


def history_files(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file()
    }


def test_first_snapshot_is_a_deterministic_baseline(monkeypatch, tmp_path):
    current = snapshot(
        monkeypatch,
        tmp_path,
        "snapshot",
        [row()],
        source_id="1" * 64,
        updated_at="2026-06-10T08:14:13+00:00",
    )
    first = tmp_path / "history-first"
    second = tmp_path / "history-second"

    manifest = publish_exam_history_artifacts(
        current_snapshot_dir=current,
        output_dir=first,
    )
    publish_exam_history_artifacts(current_snapshot_dir=current, output_dir=second)
    loaded = load_exam_history(first)

    assert manifest["format"] == "njupt-exam-history"
    assert loaded.observed_snapshot_count == 1
    assert loaded.baseline_snapshot_id == loaded.current_snapshot_id
    assert loaded.events[0]["status"] == "baseline"
    assert next(iter(loaded.classes.values()))["events"][0]["status"] == "first_seen"
    assert history_files(first) == history_files(second)


def test_same_snapshot_reuses_identical_history(monkeypatch, tmp_path):
    current = snapshot(
        monkeypatch,
        tmp_path,
        "snapshot",
        [row()],
        source_id="1" * 64,
        updated_at="2026-06-10T08:14:13+00:00",
    )
    previous = tmp_path / "history"
    output = tmp_path / "history-rebuilt"
    publish_exam_history_artifacts(current_snapshot_dir=current, output_dir=previous)

    publish_exam_history_artifacts(
        current_snapshot_dir=current,
        previous_snapshot_dir=current,
        previous_history_dir=previous,
        output_dir=output,
    )

    assert history_files(previous) == history_files(output)


@pytest.mark.parametrize(
    ("patch", "field"),
    [
        ({"raw_time": "2026年07月01日(09:00-10:50)", "start_timestamp": "2026-07-01T09:00:00+08:00"}, "start_timestamp"),
        ({"location": "教2-314"}, "location"),
        ({"count": 29}, "count"),
        ({"teacher": "李四"}, "teacher"),
        ({"notes": "携带计算器"}, "notes"),
    ],
)
def test_mutable_exam_fields_are_reported_as_changes(monkeypatch, tmp_path, patch, field):
    previous_snapshot = snapshot(
        monkeypatch,
        tmp_path,
        "previous-snapshot",
        [row()],
        source_id="1" * 64,
        updated_at="2026-06-10T08:14:13+00:00",
    )
    current_snapshot = snapshot(
        monkeypatch,
        tmp_path,
        "current-snapshot",
        [row(**patch)],
        source_id="2" * 64,
        updated_at="2026-06-11T08:14:13+00:00",
    )
    previous_history = tmp_path / "previous-history"
    output = tmp_path / "history"
    publish_exam_history_artifacts(
        current_snapshot_dir=previous_snapshot,
        output_dir=previous_history,
    )
    publish_exam_history_artifacts(
        current_snapshot_dir=current_snapshot,
        previous_snapshot_dir=previous_snapshot,
        previous_history_dir=previous_history,
        output_dir=output,
    )
    loaded = load_exam_history(output)
    event = next(iter(loaded.classes.values()))["events"][-1]

    assert loaded.observed_snapshot_count == 2
    assert loaded.events[-1]["status"] == "changed"
    assert event["status"] == "changed"
    assert event["changes"][0]["type"] == "changed"
    assert field in {item["field"] for item in event["changes"][0]["fields"]}


def test_order_and_duplicate_rows_do_not_create_false_changes(monkeypatch, tmp_path):
    first_rows = [
        row(_row_index=2),
        row(_row_index=3, teacher="李四", location="教2-314"),
        row(_row_index=4),
    ]
    second_rows = list(reversed(first_rows))
    previous_snapshot = snapshot(
        monkeypatch, tmp_path, "previous-snapshot", first_rows,
        source_id="1" * 64, updated_at="2026-06-10T08:14:13+00:00",
    )
    current_snapshot = snapshot(
        monkeypatch, tmp_path, "current-snapshot", second_rows,
        source_id="2" * 64, updated_at="2026-06-11T08:14:13+00:00",
    )
    previous_history = tmp_path / "previous-history"
    output = tmp_path / "history"
    publish_exam_history_artifacts(current_snapshot_dir=previous_snapshot, output_dir=previous_history)
    publish_exam_history_artifacts(
        current_snapshot_dir=current_snapshot,
        previous_snapshot_dir=previous_snapshot,
        previous_history_dir=previous_history,
        output_dir=output,
    )

    loaded = load_exam_history(output)
    assert loaded.events[-1]["status"] == "unchanged"
    assert loaded.events[-1]["affected_class_count"] == 0
    assert len(next(iter(loaded.classes.values()))["events"]) == 1


def test_added_removed_and_reappeared_are_class_events(monkeypatch, tmp_path):
    first = snapshot(
        monkeypatch, tmp_path, "snapshot-1", [row()],
        source_id="1" * 64, updated_at="2026-06-10T08:14:13+00:00",
    )
    second = snapshot(
        monkeypatch, tmp_path, "snapshot-2", [row(class_name="B240403")],
        source_id="2" * 64, updated_at="2026-06-11T08:14:13+00:00",
    )
    third = snapshot(
        monkeypatch, tmp_path, "snapshot-3", [row(class_name="B240403")],
        source_id="3" * 64, updated_at="2026-06-12T08:14:13+00:00",
    )
    fourth = snapshot(
        monkeypatch, tmp_path, "snapshot-4", [row()],
        source_id="4" * 64, updated_at="2026-06-13T08:14:13+00:00",
    )
    history_1 = tmp_path / "history-1"
    history_2 = tmp_path / "history-2"
    history_3 = tmp_path / "history-3"
    history_4 = tmp_path / "history-4"
    publish_exam_history_artifacts(current_snapshot_dir=first, output_dir=history_1)
    publish_exam_history_artifacts(
        current_snapshot_dir=second,
        previous_snapshot_dir=first,
        previous_history_dir=history_1,
        output_dir=history_2,
    )
    publish_exam_history_artifacts(
        current_snapshot_dir=third,
        previous_snapshot_dir=second,
        previous_history_dir=history_2,
        output_dir=history_3,
    )
    publish_exam_history_artifacts(
        current_snapshot_dir=fourth,
        previous_snapshot_dir=third,
        previous_history_dir=history_3,
        output_dir=history_4,
    )

    loaded = load_exam_history(history_4)
    target = next(value for value in loaded.classes.values() if value["class_name"] == "B240402")
    assert [event["status"] for event in target["events"]] == [
        "first_seen", "removed", "reappeared"
    ]
    assert target["observed_snapshot_count"] == 4
    assert target["events"][1]["changes"][0]["type"] == "removed"
    assert target["events"][2]["changes"][0]["type"] == "added"


def test_new_exam_period_starts_a_new_baseline(monkeypatch, tmp_path):
    previous_snapshot = snapshot(
        monkeypatch, tmp_path, "previous-snapshot", [row()],
        source_id="1" * 64, updated_at="2026-06-10T08:14:13+00:00",
    )
    current_snapshot = snapshot(
        monkeypatch, tmp_path, "current-snapshot", [row()],
        source_id="2" * 64, updated_at="2026-09-01T08:14:13+00:00",
        title="2026-2027学年第一学期考试安排表",
    )
    previous_history = tmp_path / "previous-history"
    output = tmp_path / "history"
    publish_exam_history_artifacts(current_snapshot_dir=previous_snapshot, output_dir=previous_history)
    publish_exam_history_artifacts(
        current_snapshot_dir=current_snapshot,
        previous_snapshot_dir=previous_snapshot,
        previous_history_dir=previous_history,
        output_dir=output,
    )

    loaded = load_exam_history(output)
    assert loaded.exam_period_id == "2026-2027-1"
    assert loaded.observed_snapshot_count == 1
    assert loaded.baseline_snapshot_id == loaded.current_snapshot_id


def test_corrupt_history_and_mismatched_previous_snapshot_fail_fast(monkeypatch, tmp_path):
    first = snapshot(
        monkeypatch, tmp_path, "snapshot-1", [row()],
        source_id="1" * 64, updated_at="2026-06-10T08:14:13+00:00",
    )
    other = snapshot(
        monkeypatch, tmp_path, "snapshot-2", [row(location="教2-314")],
        source_id="2" * 64, updated_at="2026-06-11T08:14:13+00:00",
    )
    history = tmp_path / "history"
    publish_exam_history_artifacts(current_snapshot_dir=first, output_dir=history)

    with pytest.raises(ExamDataError, match="does not identify"):
        publish_exam_history_artifacts(
            current_snapshot_dir=other,
            previous_snapshot_dir=other,
            previous_history_dir=history,
            output_dir=tmp_path / "mismatch",
        )

    manifest_path = history / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["unknown"] = True
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ExamDataError, match="Unsupported ExamHistory"):
        load_exam_history(history)

    clean = tmp_path / "clean-history"
    publish_exam_history_artifacts(current_snapshot_dir=first, output_dir=clean)
    (clean / "unexpected.json").write_text("{}", encoding="utf-8")
    with pytest.raises(ExamDataError, match="file set mismatch"):
        load_exam_history(clean)
