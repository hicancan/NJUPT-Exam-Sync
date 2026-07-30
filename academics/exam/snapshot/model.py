from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..records.model import ExamDataError

EXAM_SNAPSHOT_FORMAT = "njupt-exam-snapshot-v2"


@dataclass(frozen=True)
class ExamSnapshot:
    data_version: str
    auto_updated_at: str
    exam_period_id: str
    academic_year: str
    term_number: int
    term_label: str
    source_url: str | None
    source_title: str | None
    records: list[dict[str, Any]]


def _artifact(snapshot_dir: Path, value: Any, expected_path: str) -> Path:
    if not isinstance(value, dict) or value.get("path") != expected_path:
        raise ExamDataError(f"ExamSnapshot artifact path must be {expected_path}")
    path = snapshot_dir / expected_path
    try:
        content = path.read_bytes()
    except OSError as exc:
        raise ExamDataError(f"Missing ExamSnapshot artifact: {path}") from exc
    if value.get("bytes") != len(content):
        raise ExamDataError(f"ExamSnapshot artifact size mismatch: {expected_path}")
    if value.get("sha256") != hashlib.sha256(content).hexdigest():
        raise ExamDataError(f"ExamSnapshot artifact hash mismatch: {expected_path}")
    return path


def exam_snapshot_id(data_version: str, artifacts: dict[str, Any]) -> str:
    identity = hashlib.sha256()
    identity.update(EXAM_SNAPSHOT_FORMAT.encode())
    identity.update(b"\0")
    identity.update(data_version.encode())
    for name in sorted(artifacts):
        artifact = artifacts[name]
        identity.update(b"\0")
        identity.update(name.encode())
        identity.update(b"\0")
        identity.update(str(artifact["path"]).encode())
        identity.update(b"\0")
        identity.update(str(artifact["bytes"]).encode())
        identity.update(b"\0")
        identity.update(str(artifact["sha256"]).encode())
    return identity.hexdigest()


def load_exam_snapshot(snapshot_dir: Path) -> ExamSnapshot:
    manifest_path = snapshot_dir / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ExamDataError(f"Invalid ExamSnapshot manifest: {manifest_path}") from exc
    if not isinstance(manifest, dict) or manifest.get("format") != EXAM_SNAPSHOT_FORMAT:
        raise ExamDataError(f"Unsupported ExamSnapshot: {manifest_path}")
    data_version = manifest.get("data_version")
    if not isinstance(data_version, str) or len(data_version) != 64:
        raise ExamDataError(f"ExamSnapshot data identity is invalid: {manifest_path}")
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, dict) or set(artifacts) != {
        "records",
        "class_index",
        "history_manifest",
    }:
        raise ExamDataError(f"ExamSnapshot artifact set is invalid: {manifest_path}")
    records_path = _artifact(snapshot_dir, artifacts["records"], "exams.json")
    class_index_path = _artifact(snapshot_dir, artifacts["class_index"], "class-index.json")
    history_manifest_path = _artifact(
        snapshot_dir,
        artifacts["history_manifest"],
        "history/manifest.json",
    )
    if manifest.get("snapshot_id") != exam_snapshot_id(data_version, artifacts):
        raise ExamDataError(f"ExamSnapshot identity mismatch: {manifest_path}")
    try:
        records = json.loads(records_path.read_text(encoding="utf-8"))
        class_index = json.loads(class_index_path.read_text(encoding="utf-8"))
        history_manifest = json.loads(history_manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ExamDataError(f"Invalid ExamSnapshot JSON: {snapshot_dir}") from exc
    if not isinstance(records, list) or not records:
        raise ExamDataError(f"ExamSnapshot has no records: {records_path}")
    if manifest.get("total_records") != len(records):
        raise ExamDataError(f"ExamSnapshot record count mismatch: {snapshot_dir}")
    if (
        not isinstance(class_index, dict)
        or class_index.get("version") != "exam-class-index-v2"
        or not isinstance(class_index.get("classes"), list)
    ):
        raise ExamDataError(f"ExamSnapshot class index is invalid: {class_index_path}")
    class_history_refs: dict[str, dict[str, Any]] = {}
    for item in class_index["classes"]:
        if not isinstance(item, dict):
            raise ExamDataError(f"ExamSnapshot class entry is invalid: {class_index_path}")
        class_key = item.get("class_key")
        if not isinstance(class_key, str) or not class_key:
            raise ExamDataError(f"ExamSnapshot class entry has no class_key: {class_index_path}")
        _artifact(snapshot_dir, item.get("data"), f"classes/{class_key}.json")
        history_ref = item.get("history")
        _artifact(
            snapshot_dir,
            history_ref,
            f"history/classes/{class_key}.json",
        )
        class_history_refs[class_key] = history_ref
        if (
            item.get("exam_period_id") != manifest.get("exam_period_id")
            or class_index.get("data_version") != data_version
        ):
            raise ExamDataError(f"ExamSnapshot class identity mismatch: {class_index_path}")
    if (
        not isinstance(history_manifest, dict)
        or history_manifest.get("version") != "exam-history-manifest-v2"
        or not isinstance(history_manifest.get("classes"), list)
    ):
        raise ExamDataError(f"ExamSnapshot history manifest is invalid: {history_manifest_path}")
    manifest_history_refs: dict[str, dict[str, Any]] = {}
    for item in history_manifest["classes"]:
        if not isinstance(item, dict):
            raise ExamDataError(f"ExamSnapshot history class entry is invalid: {history_manifest_path}")
        class_key = item.get("class_key")
        if not isinstance(class_key, str) or not class_key:
            raise ExamDataError(f"ExamSnapshot history class entry has no class_key")
        artifact = item.get("artifact")
        _artifact(
            snapshot_dir,
            artifact,
            f"history/classes/{class_key}.json",
        )
        manifest_history_refs[class_key] = artifact
    if (
        class_history_refs != manifest_history_refs
        or class_index.get("class_count") != len(class_index["classes"])
        or history_manifest.get("latest_data_version") != data_version
        or history_manifest.get("exam_period_id") != manifest.get("exam_period_id")
        or history_manifest.get("totals", {}).get("class_count")
        != len(history_manifest["classes"])
    ):
        raise ExamDataError(f"ExamSnapshot cross-artifact identity mismatch: {snapshot_dir}")
    return ExamSnapshot(
        data_version=str(data_version),
        auto_updated_at=str(manifest["generated_at"]),
        exam_period_id=str(manifest["exam_period_id"]),
        academic_year=str(manifest["academic_year"]),
        term_number=int(manifest["term_number"]),
        term_label=str(manifest["term_label"]),
        source_url=manifest.get("source_url"),
        source_title=manifest.get("source_title"),
        records=records,
    )
