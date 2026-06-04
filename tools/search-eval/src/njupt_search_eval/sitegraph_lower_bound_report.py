from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .benchmarks.parse_decode import (
    parse_decode_benchmark,
    query_path_parse_decode_benchmark,
    runtime_parse_decode_summary,
)
from .quality.query_measurements import attachment_evidence_summary, measure_queries, query_summary
from .reports.config import DEFAULT_REPORT_QUERIES, LOWER_BOUND_GAP_LAYER_KEYS
from .reports.gap_audit import dod_audit, lower_bound_gap_report
from .reports.io import (
    current_manifest,
    git_show_json,
    load_browser_verification_report,
    load_wasm_decision_report,
    manifest_size_report,
    repo_relative,
)
from .reports.markdown_report import render_markdown_report, write_report_files
from .reports.size_snapshot import byte_comparison, size_snapshot
from .runtime_mirror.cache_io import load_index
from .runtime_mirror.config import PUBLIC_INDEX_DIR
from .runtime_mirror.text import tokens_for_query
from .sitegraph_cache_benchmark import DEFAULT_CACHE_QUERIES, run_cache_benchmark
from .sitegraph_query_smoke_test import validate_quality
from .sitegraph_task_query_eval import validate_task_queries


def build_lower_bound_report(
    *,
    collection: Path = PUBLIC_INDEX_DIR,
    baseline_ref: str = "HEAD",
    queries: list[str] | None = None,
    cache_queries: list[str] | None = None,
    include_quality: bool = True,
    include_task: bool = True,
    include_cache: bool = True,
    include_local_body_benchmark: bool = True,
    parse_runs: int = 5,
) -> dict[str, Any]:
    if collection.resolve() != PUBLIC_INDEX_DIR.resolve():
        raise ValueError(f"Only the generated njupt-public collection is supported: {PUBLIC_INDEX_DIR}")
    manifest = current_manifest(collection)
    baseline_manifest = git_show_json(baseline_ref, repo_relative(collection / "manifest.json"))
    size_report = manifest_size_report(manifest)
    baseline_size_report = manifest_size_report(baseline_manifest, baseline_ref=baseline_ref)
    current_sizes = size_snapshot(manifest, size_report)
    baseline_sizes = size_snapshot(baseline_manifest, baseline_size_report)
    report_queries = queries or DEFAULT_REPORT_QUERIES
    alias_index = load_index()
    runtime_terms = sorted({
        term
        for query in report_queries
        for term in tokens_for_query(query, alias_index["aliases"])
    }, key=len, reverse=True)
    query_measurements = measure_queries(report_queries)
    parse_decode = parse_decode_benchmark(
        manifest,
        baseline_manifest,
        baseline_ref=baseline_ref,
        parse_runs=parse_runs,
        runtime_terms=runtime_terms,
        include_local_body=include_local_body_benchmark,
    )
    query_path_decode = query_path_parse_decode_benchmark(
        manifest,
        baseline_manifest,
        baseline_ref=baseline_ref,
        query_measurements=query_measurements,
        aliases=alias_index["aliases"],
        parse_runs=parse_runs,
    )

    report: dict[str, Any] = {
        "report": "njupt-search-lower-bound-evidence-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "collection": repo_relative(collection),
        "baseline": {
            "ref": baseline_ref,
            "generated_at": baseline_manifest.get("generated_at"),
            "producer_ref": baseline_manifest.get("producer_ref"),
        },
        "current": {
            "generated_at": manifest.get("generated_at"),
            "producer_ref": manifest.get("producer_ref"),
        },
        "runtime_contract": {
            "legacy_global_first_screen": bool((manifest.get("core_search") or {}).get("legacy_global_first_screen")),
            "startup_loads_local_indexes": bool((manifest.get("routing_contract") or {}).get("startup_loads_local_indexes")),
            "startup_loads_full_shards": bool((manifest.get("routing_contract") or {}).get("startup_loads_full_shards")),
            "startup_loads_global_document_metadata": bool((manifest.get("routing_contract") or {}).get("startup_loads_global_document_metadata")),
            "directory_contains_doc_postings": bool((manifest.get("routing_contract") or {}).get("directory_contains_doc_postings")),
            "completion_requires_ledger": bool((manifest.get("verification_contract") or {}).get("completion_requires_ledger")),
        },
        "current_size_snapshot": current_sizes,
        "baseline_size_snapshot": baseline_sizes,
        "byte_comparison": byte_comparison(current_sizes, baseline_sizes),
        "parse_decode_benchmark": parse_decode,
        "runtime_parse_decode_summary": runtime_parse_decode_summary(parse_decode),
        "query_path_parse_decode_benchmark": query_path_decode,
        "query_measurements": query_measurements,
        "query_measurement_summary": query_summary(query_measurements),
        "attachment_evidence": attachment_evidence_summary(manifest),
        "quality_eval": validate_quality() if include_quality else {"skipped": True},
        "task_eval": validate_task_queries() if include_task else {"skipped": True},
        "cache_benchmark": run_cache_benchmark(cache_queries or DEFAULT_CACHE_QUERIES) if include_cache else {"skipped": True},
        "rust_wasm_decision": load_wasm_decision_report() or {"missing": True},
        "browser_verification": load_browser_verification_report() or {"missing": True},
    }
    report["lower_bound_gap_report"] = lower_bound_gap_report(report)
    report["dod_audit"] = dod_audit(report)
    return report
