from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
PUBLIC_ROOT = ROOT / "apps" / "web" / "public"
COLLECTION_DIR = PUBLIC_ROOT / "generated" / "collections" / "njupt-public"

ABSOLUTE_SIZE_BUDGETS = {
    "routed_first_screen_total_bytes": 1_000_000,
    "source_registry_bytes": 50_000,
    "query_aliases_bytes": 20_000,
    "max_full_shard_bytes": 512 * 1024,
    "avg_full_shard_bytes": 96 * 1024,
    "max_public_json_artifact_bytes": 768 * 1024,
    "hot_query_first_trusted_max_uncached_bytes": 128 * 1024,
}

LOGO_BYTE_BUDGET = 96 * 1024


def fail(message: str) -> None:
    print(f"[check_public_artifact_sizes] {message}", file=sys.stderr)
    raise SystemExit(1)


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def source_count_for(manifest: dict[str, Any]) -> int:
    source_entry = (manifest.get("artifacts") or {}).get("source_registry") or {}
    source_path = PUBLIC_ROOT / str(source_entry.get("path") or "")
    if not source_path.exists():
        fail(f"source_registry artifact is missing: {source_path}")
    registry = read_json(source_path)
    sources = registry.get("sources")
    if not isinstance(sources, list) or not sources:
        fail("source_registry must contain a non-empty sources list")
    return len(sources)


def derived_count_budgets(manifest: dict[str, Any]) -> dict[str, int]:
    source_count = source_count_for(manifest)
    total_documents = int(manifest.get("total_documents") or 0)
    source_summaries = (
        (manifest.get("sitegraph") or {}).get("source_manifest_summaries") or {}
    )
    if not isinstance(source_summaries, dict) or not source_summaries:
        fail("sitegraph.source_manifest_summaries must be a non-empty object")
    declared_full_shard_count = sum(
        int((summary or {}).get("shard_count") or 0)
        for summary in source_summaries.values()
    )
    if declared_full_shard_count <= 0:
        fail("sitegraph source summaries must declare shard_count")
    full_shard_budget = max(1_000, source_count * 300, declared_full_shard_count)
    local_index_budget = max(
        300,
        source_count * 160,
        math.ceil(total_documents / 6),
    )
    return {
        "global_query_directory_bytes": max(300_000, source_count * 32_000),
        "local_index_count": local_index_budget,
        "artifact_count": full_shard_budget
        + local_index_budget
        + max(700, source_count * 50),
        "full_shard_count": full_shard_budget,
    }


def main() -> None:
    manifest = read_json(COLLECTION_DIR / "manifest.json")
    size_entry = (manifest.get("artifacts") or {}).get("size_report") or {}
    size_path = PUBLIC_ROOT / str(size_entry.get("path") or "")
    if not size_path.exists():
        fail(f"size_report artifact is missing: {size_path}")
    size_report = read_json(size_path)
    if size_report.get("first_screen_bytes") not in (0, None):
        fail("legacy first_screen_bytes must not be used for routed readiness")
    if size_report.get("routed_first_screen_total_bytes") != size_report.get("routed_first_screen_bytes"):
        fail("routed first-screen total must equal routed first-screen bytes")

    budgets = {**ABSOLUTE_SIZE_BUDGETS, **derived_count_budgets(manifest)}
    for field, budget in budgets.items():
        actual = size_report.get(field)
        if actual is None:
            fail(f"size_report missing {field}")
        if float(actual) > budget:
            fail(f"{field}={actual} exceeds budget {budget}")
    logo_path = PUBLIC_ROOT / "assets" / "logo.png"
    if not logo_path.exists():
        fail(f"logo asset is missing: {logo_path}")
    logo_bytes = logo_path.stat().st_size
    if logo_bytes > LOGO_BYTE_BUDGET:
        fail(f"logo.png bytes={logo_bytes} exceeds budget {LOGO_BYTE_BUDGET}")
    print("[check_public_artifact_sizes] ok")


if __name__ == "__main__":
    main()
