from __future__ import annotations

from typing import Any

from .config import BYTE_METRICS
from .io import source_manifest_total_bytes


def size_snapshot(manifest: dict[str, Any], size_report: dict[str, Any]) -> dict[str, Any]:
    snapshot = {key: size_report.get(key) for key in BYTE_METRICS if key in size_report}
    snapshot["source_manifest_total_bytes"] = source_manifest_total_bytes(manifest)
    snapshot["manifest_bytes"] = int(size_report.get("bootstrap_manifest_bytes") or 0)
    snapshot["total_documents"] = int(manifest.get("total_documents") or 0)
    snapshot["total_shards"] = int(((manifest.get("coverage_contract") or {}).get("total_shards")) or 0)
    return snapshot

def compare_values(current: Any, baseline: Any) -> dict[str, Any]:
    current_value = float(current or 0)
    baseline_value = float(baseline or 0)
    delta = current_value - baseline_value
    percent = None if baseline_value == 0 else (delta / baseline_value) * 100
    return {
        "current": current,
        "baseline": baseline,
        "delta": int(delta) if delta.is_integer() else round(delta, 3),
        "percent_change": None if percent is None else round(percent, 3),
    }

def byte_comparison(current: dict[str, Any], baseline: dict[str, Any]) -> dict[str, Any]:
    return {
        key: compare_values(current.get(key), baseline.get(key))
        for key in BYTE_METRICS
        if key in current or key in baseline
    }
