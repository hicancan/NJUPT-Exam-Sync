from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..runtime_mirror.config import (
    DYNAMIC_HOLDOUT_FIRST_TRUSTED_MAX_UNCACHED_BYTES,
    DYNAMIC_HOLDOUT_PROOF_MAX_ARTIFACT_MISSES,
    DYNAMIC_HOLDOUT_PROOF_MAX_UNCACHED_BYTES,
    DYNAMIC_HOLDOUT_TOP_RESULTS_MAX_UNCACHED_BYTES,
    FIRST_TRUSTED_MAX_UNCACHED_BYTES,
    TOP_RESULTS_MAX_UNCACHED_BYTES,
)
from .config import QUERY_PATH_DECODE_REGRESSION_TOLERANCE_PERCENT


def format_int(value: Any) -> str:
    try:
        return f"{int(value):,}"
    except (TypeError, ValueError):
        return str(value)

def format_ms(value: Any) -> str:
    try:
        return f"{float(value):.3f}"
    except (TypeError, ValueError):
        return str(value)

def format_table_text(value: Any, *, limit: int = 220) -> str:
    if not isinstance(value, str):
        value = json.dumps(value, ensure_ascii=False)
    compact = value.replace("\n", " ").replace("|", "\\|")
    if len(compact) <= limit:
        return compact
    return f"{compact[: max(0, limit - 3)]}..."

def render_markdown_report(report: dict[str, Any]) -> str:
    lines: list[str] = [
        "# NJUPT Search Lower-Bound Evidence Report",
        "",
        f"- Generated at: `{report['generated_at']}`",
        f"- Collection: `{report['collection']}`",
        f"- Baseline ref: `{report['baseline']['ref']}`",
        f"- Current artifact generation: `{report['current'].get('generated_at')}`",
        "",
        "## Runtime Contract",
        "",
        "| Contract | Value |",
        "| --- | ---: |",
    ]
    for key, value in report["runtime_contract"].items():
        lines.append(f"| `{key}` | `{value}` |")

    lines.extend(
        [
            "",
            "## Byte Comparison",
            "",
            "| Metric | Baseline | Current | Delta | Change |",
            "| --- | ---: | ---: | ---: | ---: |",
        ]
    )
    for key, value in report["byte_comparison"].items():
        percent = value["percent_change"]
        percent_text = "" if percent is None else f"{percent:.3f}%"
        lines.append(
            f"| `{key}` | {format_int(value['baseline'])} | {format_int(value['current'])} | "
            f"{format_int(value['delta'])} | {percent_text} |"
        )

    lines.extend(
        [
            "",
            "## Parse And Decode",
            "",
            "| Family | Baseline bytes | Current bytes | Baseline mean ms | Current mean ms |",
            "| --- | ---: | ---: | ---: | ---: |",
        ]
    )
    for key, value in report["parse_decode_benchmark"].items():
        if key == "parse_runs":
            continue
        baseline = value["baseline"]
        current = value["current"]
        lines.append(
            f"| `{key}` | {format_int(baseline['bytes'])} | {format_int(current['bytes'])} | "
            f"{format_ms(baseline['mean_ms'])} | {format_ms(current['mean_ms'])} |"
        )
    runtime_decode = report.get("runtime_parse_decode_summary") or {}
    lines.extend(
        [
            "",
            "## Runtime Query-Term Decode Summary",
            "",
            f"- Baseline local-index runtime bytes: `{format_int(runtime_decode.get('baseline_local_index_runtime_bytes'))}`",
            f"- Current local-index runtime bytes: `{format_int(runtime_decode.get('current_local_index_runtime_bytes'))}`",
            f"- Runtime byte change: `{runtime_decode.get('bytes_percent_change')}%`",
            f"- Baseline local-index parse/decode mean: `{format_ms(runtime_decode.get('baseline_local_index_parse_decode_mean_ms'))}` ms",
            f"- Current query-term parse/decode mean: `{format_ms(runtime_decode.get('current_local_index_query_term_parse_decode_mean_ms'))}` ms",
            f"- Parse/decode change: `{runtime_decode.get('parse_decode_percent_change')}%`",
            f"- Light decode mode: `{runtime_decode.get('light_decode_mode')}`",
            f"- Body decode mode: `{runtime_decode.get('body_decode_mode')}`",
        ]
    )
    query_path_decode = report.get("query_path_parse_decode_benchmark") if isinstance(report.get("query_path_parse_decode_benchmark"), dict) else {}
    query_path_summary = query_path_decode.get("summary") if isinstance(query_path_decode.get("summary"), dict) else {}
    if query_path_summary:
        lines.extend(
            [
                "",
                "## Query Path Parse And Decode",
                "",
                "| Phase | Mean baseline bytes | Mean current bytes | Byte change | Mean baseline ms | Mean current ms | Decode change | Byte gate | Decode within tolerance |",
                "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
            ]
        )
        for phase in ("first_trusted_results", "top_results_hydrated"):
            phase_summary = query_path_summary.get(phase) or {}
            lines.append(
                f"| `{phase}` | {format_int(phase_summary.get('mean_baseline_bytes'))} | "
                f"{format_int(phase_summary.get('mean_current_bytes'))} | `{phase_summary.get('bytes_percent_change')}%` | "
                f"{format_ms(phase_summary.get('mean_baseline_decode_ms'))} | "
                f"{format_ms(phase_summary.get('mean_current_decode_ms'))} | "
                f"`{phase_summary.get('decode_percent_change')}%` | `{phase_summary.get('bytes_passed')}` | "
                f"`{phase_summary.get('decode_within_tolerance')}` |"
            )
        lines.append(
            f"- Query-path performance gate passed: `{query_path_summary.get('passed')}`. "
            f"Bytes must not regress, and decode timing must stay within "
            f"`{QUERY_PATH_DECODE_REGRESSION_TOLERANCE_PERCENT}%` tolerance."
        )

    wasm_decision = report.get("rust_wasm_decision") if isinstance(report.get("rust_wasm_decision"), dict) else {}
    if wasm_decision and not wasm_decision.get("missing"):
        decision = wasm_decision.get("decision") or {}
        ts_decode = wasm_decision.get("typescript_decode_to_object") or {}
        wasm_decode = wasm_decision.get("wasm_decode_to_json_then_parse") or {}
        wasm_stats = wasm_decision.get("wasm_stats_only_decode") or {}
        ts_retrieval = wasm_decision.get("typescript_retrieval_kernel") or {}
        wasm_retrieval = wasm_decision.get("wasm_retrieval_kernel") or {}
        wasm_session = wasm_decision.get("wasm_retrieval_session") or {}
        wasm_score_bridge = wasm_decision.get("wasm_retrieval_session_scores_bridge") or {}
        wasm_typed_scores = wasm_decision.get("wasm_retrieval_session_typed_scores") or {}
        lines.extend(
            [
                "",
                "## Rust/WASM Decision",
                "",
                f"- Decision: `{decision.get('status')}`",
                f"- Winner for current runtime: `{decision.get('winner')}`",
                f"- TypeScript decode mean ms: `{format_ms(ts_decode.get('mean_ms'))}`",
                f"- WASM materialized decode mean ms: `{format_ms(wasm_decode.get('mean_ms'))}`",
                f"- WASM stats-only decode mean ms: `{format_ms(wasm_stats.get('mean_ms'))}`",
                f"- TypeScript retrieval kernel mean ms: `{format_ms(ts_retrieval.get('mean_ms'))}`",
                f"- WASM stateless retrieval kernel mean ms: `{format_ms(wasm_retrieval.get('mean_ms'))}`",
                f"- WASM stateful retrieval session mean ms: `{format_ms(wasm_session.get('mean_ms'))}`",
                f"- WASM stateful retrieval JSON score bridge mean ms: `{format_ms(wasm_score_bridge.get('mean_ms'))}`",
                f"- WASM stateful retrieval typed score buffer mean ms: `{format_ms(wasm_typed_scores.get('mean_ms'))}`",
                f"- Reason: {decision.get('reason')}",
            ]
        )

    lines.extend(
        [
            "",
            "## Query Measurements",
            "",
            "| Query | Class | Serving path | ms | Results | Candidate shards | Loaded shards | Uncached bytes | Pruned postings | Bottleneck | Complete | Top result |",
            "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |",
        ]
    )
    for item in report["query_measurements"]:
        top = item.get("top_result") or {}
        bottleneck = item.get("dominant_bottleneck") or {}
        lines.append(
            f"| `{item['query']}` | `{item.get('query_class')}` | `{item.get('serving_path')}` | {format_ms(item['elapsed_ms'])} | {format_int(item['result_count'])} | "
            f"{format_int(item['candidate_shard_count'])} | {format_int(item['loaded_shard_count'])} | "
            f"{format_int(item['coverage']['uncached_loaded_bytes'])} | "
            f"{format_int(item['retrieval']['postings_pruned'])} | "
            f"`{bottleneck.get('layer')}` | "
            f"`{item['coverage']['exhaustive_complete']}` | {str(top.get('title') or '')[:80]} |"
        )

    class_summary = (report.get("query_measurement_summary") or {}).get("query_class_summary") or {}
    if class_summary:
        lines.extend(
            [
                "",
                "## Query Class Summary",
                "",
                "| Class | Queries | Max first bytes | Max top bytes | Max proof bytes | Max ms | Dominant bottlenecks |",
                "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
            ]
        )
        for query_class, summary in sorted(class_summary.items()):
            lines.append(
                f"| `{query_class}` | {format_int(summary.get('query_count'))} | "
                f"{format_int(summary.get('max_first_trusted_uncached_bytes'))} | "
                f"{format_int(summary.get('max_top_results_uncached_bytes'))} | "
                f"{format_int(summary.get('max_proof_complete_uncached_bytes'))} | "
                f"{format_ms(summary.get('max_elapsed_ms'))} | "
                f"{format_table_text(summary.get('dominant_bottlenecks') or {}, limit=160)} |"
            )
    serving_path_summary = (report.get("query_measurement_summary") or {}).get("serving_path_summary") or {}
    if serving_path_summary:
        lines.extend(
            [
                "",
                "## Serving Path Summary",
                "",
                "| Serving path | Queries | Max first bytes | Max top bytes | Max proof bytes | Postings visited | Postings pruned |",
                "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
            ]
        )
        for serving_path, summary in sorted(serving_path_summary.items()):
            lines.append(
                f"| `{serving_path}` | {format_int(summary.get('query_count'))} | "
                f"{format_int(summary.get('max_first_trusted_uncached_bytes'))} | "
                f"{format_int(summary.get('max_top_results_uncached_bytes'))} | "
                f"{format_int(summary.get('max_proof_complete_uncached_bytes'))} | "
                f"{format_int(summary.get('total_postings_visited'))} | "
                f"{format_int(summary.get('total_postings_pruned'))} |"
            )

    lines.extend(
        [
            "",
            "## Proof Scan Pressure",
            "",
            "| Query | Certificate | Certificate bytes | Avoided match-shard bytes | True-match shards | False-positive shards | True-match bytes | False-positive bytes | False-positive byte ratio | True-match docs |",
            "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for item in report["query_measurements"]:
        pressure = item.get("proof_scan_pressure") or {}
        lines.append(
            f"| `{item['query']}` | `{bool(pressure.get('certificate_used'))}` | "
            f"{format_int(pressure.get('certificate_bytes'))} | "
            f"{format_int(pressure.get('matched_shard_bytes_avoided'))} | "
            f"{format_int(pressure.get('true_match_shards'))} | "
            f"{format_int(pressure.get('false_positive_shards'))} | "
            f"{format_int(pressure.get('true_match_bytes'))} | "
            f"{format_int(pressure.get('false_positive_bytes'))} | "
            f"{format_ms(pressure.get('false_positive_byte_ratio'))} | "
            f"{format_int(pressure.get('true_match_docs'))} |"
        )

    lines.extend(
        [
            "",
            "## Phase Gates",
            "",
            "| Query | First trusted bytes | First trusted ms | Top hydrated bytes | Top hydrated ms | Proof bytes | Passed |",
            "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
        ]
    )
    for item in report["query_measurements"]:
        phases = item.get("phase_measurements") or {}
        first = phases.get("first_trusted_results") or {}
        top = phases.get("top_results_hydrated") or {}
        proof = phases.get("proof_complete") or {}
        gate = item.get("phase_gate") or {}
        lines.append(
            f"| `{item['query']}` | {format_int(first.get('uncached_loaded_bytes'))} | "
            f"{format_ms(first.get('elapsed_ms'))} | {format_int(top.get('uncached_loaded_bytes'))} | "
            f"{format_ms(top.get('elapsed_ms'))} | {format_int(proof.get('uncached_loaded_bytes'))} | "
            f"`{gate.get('passed')}` |"
        )
    query_measurement_summary = report.get("query_measurement_summary") or {}
    lines.extend(
        [
            "",
            f"- First trusted hard gate: `<={format_int(FIRST_TRUSTED_MAX_UNCACHED_BYTES)}` bytes or `<=10%` of proof bytes.",
            f"- Top hydrated hard gate: `<={format_int(TOP_RESULTS_MAX_UNCACHED_BYTES)}` bytes or `<=25%` of proof bytes.",
            f"- Phase gates passed: `{query_measurement_summary.get('phase_gates_passed')}`",
            f"- High-DF gates passed: `{query_measurement_summary.get('high_df_gates_passed')}` "
            f"(first `<={format_int(query_measurement_summary.get('high_df_first_trusted_limit_bytes'))}`, "
            f"top `<={format_int(query_measurement_summary.get('high_df_top_results_limit_bytes'))}`, "
            f"proof `<={format_int(query_measurement_summary.get('high_df_proof_limit_bytes'))}` bytes).",
            f"- Dynamic holdout gates passed: `{query_measurement_summary.get('dynamic_holdout_gates_passed')}` "
            f"(first `<={format_int(DYNAMIC_HOLDOUT_FIRST_TRUSTED_MAX_UNCACHED_BYTES)}`, "
            f"top `<={format_int(DYNAMIC_HOLDOUT_TOP_RESULTS_MAX_UNCACHED_BYTES)}`, "
            f"proof `<={format_int(DYNAMIC_HOLDOUT_PROOF_MAX_UNCACHED_BYTES)}` bytes, "
            f"proof requests `<={format_int(DYNAMIC_HOLDOUT_PROOF_MAX_ARTIFACT_MISSES)}`).",
        ]
    )
    high_df_failures = query_measurement_summary.get("high_df_gate_failures") or []
    if high_df_failures:
        lines.append(f"- High-DF gate failures: `{json.dumps(high_df_failures, ensure_ascii=False)}`")
    dynamic_failures = query_measurement_summary.get("dynamic_holdout_gate_failures") or []
    if dynamic_failures:
        lines.append(f"- Dynamic holdout gate failures: `{json.dumps(dynamic_failures, ensure_ascii=False)}`")

    cache = report.get("cache_benchmark") or {}
    if not cache.get("skipped"):
        summary = cache.get("summary") or {}
        lines.extend(
            [
                "",
                "## Cache Benchmark",
                "",
                f"- Query count: `{format_int(summary.get('query_count'))}`",
                f"- Max cold uncached bytes: `{format_int(summary.get('max_cold_uncached_bytes'))}`",
                f"- Max warm uncached bytes: `{format_int(summary.get('max_warm_uncached_bytes'))}`",
                f"- Total warm cached bytes: `{format_int(summary.get('total_warm_cached_bytes'))}`",
                f"- Passed: `{summary.get('passed')}`",
            ]
        )

    browser = report.get("browser_verification") if isinstance(report.get("browser_verification"), dict) else {}
    if browser and not browser.get("missing"):
        summary = browser.get("summary") or {}
        lines.extend(
            [
                "",
                "## Browser Verification",
                "",
                f"- Passed: `{summary.get('passed')}`",
                f"- Persistent cache passed: `{summary.get('persistent_cache_passed')}`",
                f"- Viewports: `{json.dumps(summary.get('viewports') or [], ensure_ascii=False)}`",
                f"- Scenario count: `{format_int(summary.get('scenario_count'))}`",
                f"- Max warm uncached immutable bytes: `{format_int(summary.get('max_warm_uncached_immutable_bytes'))}`",
            ]
        )

    gap_report = report.get("lower_bound_gap_report") if isinstance(report.get("lower_bound_gap_report"), dict) else {}
    gap_layers = gap_report.get("layers") if isinstance(gap_report.get("layers"), dict) else {}
    if gap_layers:
        lines.extend(
            [
                "",
                "## Lower Bound Gap Report",
                "",
                f"- Objective: {format_table_text(((gap_report.get('model') or {}).get('objective') or ''), limit=400)}",
                f"- Claim boundary: {format_table_text(((gap_report.get('model') or {}).get('claim_boundary') or ''), limit=400)}",
                "",
                "| Layer | Status | Current measurement | Gap | Next algorithmic step |",
                "| --- | --- | --- | --- | --- |",
            ]
        )
        for key in gap_report.get("required_layers") or gap_layers.keys():
            layer = gap_layers.get(str(key)) or {}
            lines.append(
                f"| `{key}` | `{layer.get('status')}` | "
                f"{format_table_text(layer.get('current_measurement') or {}, limit=260)} | "
                f"{format_table_text(layer.get('gap_to_lower_bound') or '', limit=220)} | "
                f"{format_table_text(layer.get('next_algorithmic_step') or '', limit=220)} |"
            )
        if gap_report.get("missing_layers"):
            lines.append(f"- Missing layers: `{json.dumps(gap_report.get('missing_layers'), ensure_ascii=False)}`")

    lines.extend(
        [
            "",
            "## Quality",
            "",
            f"- Smoke eval: `{'skipped' if report['quality_eval'].get('skipped') else 'passed'}`",
            f"- Task eval: `{'skipped' if report['task_eval'].get('skipped') else str(report['task_eval'].get('passed')) + '/' + str(report['task_eval'].get('expectation_count'))}`",
            "",
            "## Attachment Evidence",
            "",
            f"- Policy: `{report['attachment_evidence'].get('policy')}`",
            f"- Coverage: `{json.dumps(report['attachment_evidence'].get('coverage') or {}, ensure_ascii=False)}`",
            "",
            "## Definition Of Done Audit",
            "",
            "| Item | Status | Evidence |",
            "| ---: | --- | --- |",
        ]
    )
    for item, value in report["dod_audit"].items():
        evidence = value.get("evidence")
        if not isinstance(evidence, str):
            evidence = json.dumps(evidence, ensure_ascii=False)
        lines.append(f"| {item} | `{value.get('status')}` | {evidence[:240]} |")

    baseline_ref = str(report.get("baseline", {}).get("ref") or "HEAD")

    lines.extend(
        [
            "",
            "## Reproduction",
            "",
            "```powershell",
            f"uv run --python 3.13 python -m njupt_search_eval run-lower-bound-report --baseline-ref {baseline_ref} --collection apps\\web\\public\\generated\\collections\\njupt-public --output tools\\search-eval\\reports\\njupt-search-lower-bound-report.json --markdown tools\\search-eval\\reports\\njupt-search-lower-bound-report.md",
            "```",
            "",
            "This report is evidence for the active lower-bound goal. It does not claim final completion while DoD items remain unmet.",
            "",
        ]
    )
    return "\n".join(lines)

def write_report_files(report: dict[str, Any], *, output: Path | None, markdown: Path | None) -> None:
    if output is not None:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if markdown is not None:
        markdown.parent.mkdir(parents=True, exist_ok=True)
        markdown.write_text(render_markdown_report(report), encoding="utf-8")
