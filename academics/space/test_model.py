from __future__ import annotations

import json
from pathlib import Path

import pytest

from .model import SpaceSnapshotError, load_space_snapshot
from .test_helpers import write_test_space_snapshot


def test_current_space_snapshot_round_trips_deterministically(tmp_path: Path) -> None:
    first = write_test_space_snapshot(tmp_path / "first", ["教2-101", "教2-201"])
    second = write_test_space_snapshot(tmp_path / "second", ["教2-101", "教2-201"])
    first_snapshot = load_space_snapshot(first)
    second_snapshot = load_space_snapshot(second)
    assert first_snapshot.snapshot_id == second_snapshot.snapshot_id
    assert {
        path.relative_to(first).as_posix(): path.read_bytes()
        for path in first.rglob("*") if path.is_file()
    } == {
        path.relative_to(second).as_posix(): path.read_bytes()
        for path in second.rglob("*") if path.is_file()
    }


def test_space_snapshot_rejects_unknown_files(tmp_path: Path) -> None:
    root = write_test_space_snapshot(tmp_path / "space", ["教2-101"])
    (root / "legacy-room-catalog.json").write_text("{}", encoding="utf-8")
    with pytest.raises(SpaceSnapshotError, match="file set mismatch"):
        load_space_snapshot(root)


def test_space_snapshot_rejects_tampered_artifacts(tmp_path: Path) -> None:
    root = write_test_space_snapshot(tmp_path / "space", ["教2-101"])
    payload = json.loads((root / "campuses.json").read_text(encoding="utf-8"))
    payload["campuses"][0]["name"] = "篡改"
    (root / "campuses.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(SpaceSnapshotError, match="integrity mismatch"):
        load_space_snapshot(root)
