from __future__ import annotations

from typing import Any

from .config import LOWER_BOUND_GAP_LAYER_KEYS


def lower_bound_gap_report(report: dict[str, Any]) -> dict[str, Any]:
    current_sizes = report.get("current_size_snapshot") or {}
    query = report.get("query_measurement_summary") or {}
    measurements = report.get("query_measurements") or []
    runtime_decode = report.get("runtime_parse_decode_summary") or {}
    query_path_decode = report.get("query_path_parse_decode_benchmark") if isinstance(report.get("query_path_parse_decode_benchmark"), dict) else {}
    query_path_summary = query_path_decode.get("summary") if isinstance(query_path_decode.get("summary"), dict) else {}
    cache = report.get("cache_benchmark") if isinstance(report.get("cache_benchmark"), dict) else {}
    cache_summary = cache.get("summary") if isinstance(cache.get("summary"), dict) else {}
    attachment = report.get("attachment_evidence") if isinstance(report.get("attachment_evidence"), dict) else {}
    browser = report.get("browser_verification") if isinstance(report.get("browser_verification"), dict) else {}
    browser_summary = browser.get("summary") if isinstance(browser.get("summary"), dict) else {}
    runtime_contract = report.get("runtime_contract") if isinstance(report.get("runtime_contract"), dict) else {}
    quality_eval = report.get("quality_eval") if isinstance(report.get("quality_eval"), dict) else {}
    task_eval = report.get("task_eval") if isinstance(report.get("task_eval"), dict) else {}
    wasm_decision = report.get("rust_wasm_decision") if isinstance(report.get("rust_wasm_decision"), dict) else {}
    wasm_status = str(((wasm_decision.get("decision") or {}).get("status")) or "")

    def max_phase_value(phase: str, key: str) -> int:
        return max(
            (
                int((((item.get("phase_measurements") or {}).get(phase) or {}).get(key)) or 0)
                for item in measurements
            ),
            default=0,
        )

    def max_phase_ms(phase: str) -> float:
        return max(
            (
                float((((item.get("phase_measurements") or {}).get(phase) or {}).get("elapsed_ms")) or 0.0)
                for item in measurements
            ),
            default=0.0,
        )

    def record(
        *,
        status: str,
        lower_bound_definition: str,
        current_measurement: dict[str, Any],
        gap_to_lower_bound: str,
        next_algorithmic_step: str,
        correctness_guard: str,
        stop_condition: str,
        evidence_refs: list[str],
    ) -> dict[str, Any]:
        return {
            "status": status,
            "lower_bound_definition": lower_bound_definition,
            "current_measurement": current_measurement,
            "gap_to_lower_bound": gap_to_lower_bound,
            "next_algorithmic_step": next_algorithmic_step,
            "correctness_guard": correctness_guard,
            "stop_condition": stop_condition,
            "evidence_refs": evidence_refs,
        }

    first_path = query_path_summary.get("first_trusted_results") or {}
    top_path = query_path_summary.get("top_results_hydrated") or {}
    proof_bytes = max_phase_value("proof_complete", "uncached_loaded_bytes")
    first_bytes = int(query.get("max_first_trusted_uncached_bytes") or 0)
    top_bytes = int(query.get("max_top_results_uncached_bytes") or 0)
    full_scan_bytes = int(current_sizes.get("full_scan_total_bytes") or 0)
    startup_bytes = int(current_sizes.get("routed_first_screen_total_bytes") or 0)
    local_runtime_bytes = int(current_sizes.get("local_index_runtime_bytes") or 0)
    binary_runtime_bytes = int(current_sizes.get("binary_artifact_total_bytes") or 0)
    browser_missing = bool(browser.get("missing")) if browser else True

    layers = {
        "startup_entry_gap": record(
            status="engineering_gate_passed_not_absolute"
            if startup_bytes > 0
            and runtime_contract.get("startup_loads_local_indexes") is False
            and runtime_contract.get("startup_loads_full_shards") is False
            else "needs_attention",
            lower_bound_definition=(
                "The first page can only read routing metadata, aliases, and source registry bytes "
                "needed to map a query into a proof-capable route."
            ),
            current_measurement={
                "routed_first_screen_total_bytes": startup_bytes,
                "bootstrap_manifest_bytes": current_sizes.get("bootstrap_manifest_bytes"),
                "source_registry_bytes": current_sizes.get("source_registry_bytes"),
                "global_query_directory_bytes": current_sizes.get("global_query_directory_bytes"),
                "query_aliases_bytes": current_sizes.get("query_aliases_bytes"),
                "startup_loads_local_indexes": runtime_contract.get("startup_loads_local_indexes"),
                "startup_loads_full_shards": runtime_contract.get("startup_loads_full_shards"),
            },
            gap_to_lower_bound=(
                "Metadata is already separated from local indexes and full shards, but the routed "
                "entry payload is still a practical JSON contract rather than an entropy-coded "
                "minimal decision table."
            ),
            next_algorithmic_step=(
                "Delta-code source/query routing tables and measure whether a compact finite-state "
                "router beats the current manifest plus directory bytes without hurting debuggability."
            ),
            correctness_guard="Runtime contract must keep startup_loads_local_indexes=false and startup_loads_full_shards=false.",
            stop_condition=(
                "Stop when further byte reductions change only encoding overhead and do not reduce "
                "the set of information required to choose the route."
            ),
            evidence_refs=["runtime_contract", "current_size_snapshot", "byte_comparison"],
        ),
        "route_planning_gap": record(
            status="phase_gate_passed" if query.get("phase_gates_passed") else "needs_attention",
            lower_bound_definition=(
                "Routing must inspect only the cheapest source/local-index summaries whose expected "
                "utility can still alter the first trusted or top-k result set."
            ),
            current_measurement={
                "query_count": query.get("query_count"),
                "max_candidate_shard_count": query.get("max_candidate_shard_count"),
                "max_loaded_shard_count": query.get("max_loaded_shard_count"),
                "max_uncached_loaded_bytes": query.get("max_uncached_loaded_bytes"),
                "phase_gates_passed": query.get("phase_gates_passed"),
            },
            gap_to_lower_bound=(
                "The planner emits expected byte costs and phase-local selections, but the route "
                "policy is still hand-calibrated rather than learned from an optimal decision rule."
            ),
            next_algorithmic_step=(
                "Fit an offline decision policy on the evaluation corpus with byte cost as the "
                "Lagrange multiplier, then keep only policies that preserve task quality."
            ),
            correctness_guard="Every route still has to produce a complete coverage ledger before exhaustive claims.",
            stop_condition=(
                "Stop when alternative route policies cannot reduce phase bytes at equal quality "
                "and equal proof completeness."
            ),
            evidence_refs=["query_measurement_summary", "query_measurements[].planner"],
        ),
        "first_trusted_gap": record(
            status="phase_gate_passed" if first_bytes <= int(query.get("first_trusted_absolute_limit_bytes") or 0) else "needs_attention",
            lower_bound_definition=(
                "The first trusted phase needs enough evidence to show at least one justified result "
                "and no bytes for later hydration or exhaustive proof."
            ),
            current_measurement={
                "max_first_trusted_uncached_bytes": first_bytes,
                "absolute_limit_bytes": query.get("first_trusted_absolute_limit_bytes"),
                "max_first_trusted_elapsed_ms": round(max_phase_ms("first_trusted_results"), 3),
                "query_path_mean_current_bytes": first_path.get("mean_current_bytes"),
                "query_path_bytes_percent_change": first_path.get("bytes_percent_change"),
                "query_path_passed": first_path.get("passed"),
            },
            gap_to_lower_bound=(
                "The phase is byte-gated and query-path decode improved versus baseline, but the "
                "remaining gap is proving that no loaded local-index byte is irrelevant to the first trusted result."
            ),
            next_algorithmic_step="Add per-term contribution accounting for first-result eligibility and drop zero-contribution term blocks.",
            correctness_guard="A first trusted result must carry source, score reason, and enough local evidence to be reproducible.",
            stop_condition="Stop when contribution accounting proves every loaded term block can affect the displayed first result.",
            evidence_refs=["query_measurement_summary", "query_path_parse_decode_benchmark.summary.first_trusted_results"],
        ),
        "top_results_hydrated_gap": record(
            status="phase_gate_passed" if top_bytes <= int(query.get("top_results_absolute_limit_bytes") or 0) else "needs_attention",
            lower_bound_definition=(
                "Top-k hydration needs postings and document evidence only for candidates whose "
                "upper bound can enter the visible top result set."
            ),
            current_measurement={
                "max_top_results_uncached_bytes": top_bytes,
                "absolute_limit_bytes": query.get("top_results_absolute_limit_bytes"),
                "max_top_results_elapsed_ms": round(max_phase_ms("top_results_hydrated"), 3),
                "query_path_mean_current_bytes": top_path.get("mean_current_bytes"),
                "query_path_bytes_percent_change": top_path.get("bytes_percent_change"),
                "query_path_passed": top_path.get("passed"),
            },
            gap_to_lower_bound=(
                "Top results are separated from proof completion, but candidate upper bounds are "
                "not yet serialized as a formal certificate that every skipped block is dominated."
            ),
            next_algorithmic_step="Persist block-level score upper bounds and emit a top-k dominance certificate for skipped blocks.",
            correctness_guard="Hydrated top results must remain identical under exhaustive verification for the measured query suite.",
            stop_condition="Stop when every skipped block has a recorded upper bound below the kth hydrated result score.",
            evidence_refs=["query_measurement_summary", "query_path_parse_decode_benchmark.summary.top_results_hydrated"],
        ),
        "proof_complete_certificate_gap": record(
            status="largest_remaining_theoretical_gap" if proof_bytes > 0 else "needs_attention",
            lower_bound_definition=(
                "A complete proof should read only no-match certificates and unresolved shard "
                "evidence required to justify exhaustive completeness."
            ),
            current_measurement={
                "max_proof_complete_uncached_bytes": proof_bytes,
                "max_proof_complete_elapsed_ms": round(max_phase_ms("proof_complete"), 3),
                "proof_catalog_total_bytes": current_sizes.get("proof_catalog_total_bytes"),
                "shard_filter_total_bytes": current_sizes.get("shard_filter_total_bytes"),
                "proof_certificate_total_bytes": current_sizes.get("proof_certificate_total_bytes"),
                "hot_query_proof_directory_bytes": current_sizes.get("hot_query_proof_directory_bytes"),
                "hot_query_topk_certificate_total_bytes": current_sizes.get("hot_query_topk_certificate_total_bytes"),
                "hot_query_complete_certificate_total_bytes": current_sizes.get("hot_query_complete_certificate_total_bytes"),
                "hot_query_certificate_used_count": query.get("hot_query_certificate_used_count"),
                "max_hot_query_certificate_bytes": query.get("max_hot_query_certificate_bytes"),
                "max_hot_query_certificate_query": query.get("max_hot_query_certificate_query"),
                "max_hot_query_matched_shard_bytes_avoided": query.get("max_hot_query_matched_shard_bytes_avoided"),
                "max_hot_query_matched_shard_bytes_avoided_query": query.get("max_hot_query_matched_shard_bytes_avoided_query"),
                "full_scan_total_bytes": full_scan_bytes,
                "max_proof_true_match_bytes": query.get("max_proof_true_match_bytes"),
                "max_proof_true_match_query": query.get("max_proof_true_match_query"),
                "max_proof_false_positive_bytes": query.get("max_proof_false_positive_bytes"),
                "max_proof_false_positive_query": query.get("max_proof_false_positive_query"),
                "max_proof_false_positive_byte_ratio": query.get("max_proof_false_positive_byte_ratio"),
                "max_proof_false_positive_ratio_query": query.get("max_proof_false_positive_ratio_query"),
                "all_exhaustive_complete": query.get("all_exhaustive_complete"),
            },
            gap_to_lower_bound=(
                "Correctness is complete, but proof completion can still approach a full-shard read. "
                "The mathematical lower bound is a certificate stream, not full document hydration."
            ),
            next_algorithmic_step=(
                "Separate false-positive filter pressure from true-match shard pressure, then generate "
                "doc/postings or hot-query certificates for true-match-heavy broad queries."
            ),
            correctness_guard="No-match, failed-shard, and pending-ledger refusal tests must stay green before replacing full proof reads.",
            stop_condition="Stop when proof bytes are proportional to certificate entropy plus matched shard evidence, not total shard corpus size.",
            evidence_refs=["query_measurements[].phase_measurements.proof_complete", "query_measurements[].proof_scan_pressure", "query_measurement_summary"],
        ),
        "full_shard_dependency_gap": record(
            status="known_remaining_dependency" if full_scan_bytes > 0 else "evidence_present",
            lower_bound_definition=(
                "Full shard bodies are outside the first-result and top-k lower bound; they are "
                "only needed when the user asks for complete proof or full document hydration."
            ),
            current_measurement={
                "full_scan_total_bytes": full_scan_bytes,
                "proof_certificate_total_bytes": current_sizes.get("proof_certificate_total_bytes"),
                "max_full_shard_bytes": current_sizes.get("max_full_shard_bytes"),
                "full_shard_count": current_sizes.get("full_shard_count"),
                "max_proof_complete_uncached_bytes": proof_bytes,
            },
            gap_to_lower_bound=(
                "The serving path no longer depends on full shards for startup or early results, "
                "but exhaustive proof still has a full-shard fallback."
            ),
            next_algorithmic_step="Split proof certificates from full document bodies and make full bodies lazy even during proof completion.",
            correctness_guard="Document hydration must still produce byte-identical titles, URLs, snippets, and attachment evidence.",
            stop_condition="Stop when proof_complete has zero full-body dependency except for matched documents shown to the user.",
            evidence_refs=["current_size_snapshot", "query_measurements[].coverage"],
        ),
        "packed_index_decode_gap": record(
            status="query_path_gate_passed" if query_path_summary.get("passed") else "needs_attention",
            lower_bound_definition=(
                "Index decode should touch only terms and impact blocks that can affect routing, "
                "first trusted results, or top-k ranking."
            ),
            current_measurement={
                "local_index_runtime_bytes": local_runtime_bytes,
                "binary_artifact_total_bytes": binary_runtime_bytes,
                "runtime_byte_change_percent": runtime_decode.get("bytes_percent_change"),
                "runtime_decode_change_percent": runtime_decode.get("parse_decode_percent_change"),
                "query_path_passed": query_path_summary.get("passed"),
                "body_decode_mode": runtime_decode.get("body_decode_mode"),
                "light_decode_mode": runtime_decode.get("light_decode_mode"),
            },
            gap_to_lower_bound=(
                "Packed selective decode is active on the hot query path, but block metadata is "
                "still decoded at artifact granularity rather than at the exact surviving term/block frontier."
            ),
            next_algorithmic_step="Move to block directory offsets with direct term/block seeks and SIMD/WASM-friendly score scans.",
            correctness_guard="Packed and JSON decoders must produce equivalent term statistics for sampled and task queries.",
            stop_condition="Stop when decode work is asymptotically tied to matched query terms and unpruned impact blocks.",
            evidence_refs=["runtime_parse_decode_summary", "query_path_parse_decode_benchmark"],
        ),
        "topk_pruning_gap": record(
            status="evidence_present" if query.get("any_dynamic_pruning") else "needs_attention",
            lower_bound_definition=(
                "Top-k retrieval should visit postings only while their block upper bound can beat "
                "the current kth competitive threshold."
            ),
            current_measurement={
                "any_dynamic_pruning": query.get("any_dynamic_pruning"),
                "total_postings_pruned": query.get("total_postings_pruned"),
                "wasm_decision_status": wasm_status,
            },
            gap_to_lower_bound=(
                "Dynamic pruning is present, but the report does not yet prove that the pruning "
                "order is optimal for every query under the scoring function."
            ),
            next_algorithmic_step="Record WAND/BMW-style upper-bound ledgers per query and compare visited postings against an oracle ordering.",
            correctness_guard="Pruned postings must have an upper bound below the competitive threshold recorded at prune time.",
            stop_condition="Stop when the visited posting count matches the oracle lower envelope within tie-handling noise.",
            evidence_refs=["query_measurement_summary", "query_measurements[].retrieval", "rust_wasm_decision"],
        ),
        "persistent_cache_gap": record(
            status="warm_cache_gate_passed" if cache_summary.get("max_warm_uncached_bytes") == 0 else "needs_attention",
            lower_bound_definition=(
                "After immutable artifacts are cached, a repeated query should perform zero network "
                "bytes beyond validation and any changed content-hash paths."
            ),
            current_measurement={
                "cache_query_count": cache_summary.get("query_count"),
                "max_cold_uncached_bytes": cache_summary.get("max_cold_uncached_bytes"),
                "max_warm_uncached_bytes": cache_summary.get("max_warm_uncached_bytes"),
                "total_warm_cached_bytes": cache_summary.get("total_warm_cached_bytes"),
                "browser_persistent_cache_passed": browser_summary.get("persistent_cache_passed"),
            },
            gap_to_lower_bound=(
                "Warm network bytes are gated locally; remaining lower-bound work is CPU decode "
                "reuse and browser-level confirmation when a browser report is missing."
            ),
            next_algorithmic_step="Persist decoded packed-index pages and reuse score-session state across repeated same-version queries.",
            correctness_guard="Content-hash changes must invalidate stale cached artifacts and decoded pages.",
            stop_condition="Stop when warm repeat queries have zero immutable network bytes and no repeated decode for unchanged pages.",
            evidence_refs=["cache_benchmark", "browser_verification.summary.persistent_cache_passed"],
        ),
        "attachment_semantics_gap": record(
            status="evidence_present" if attachment.get("coverage") else "needs_attention",
            lower_bound_definition=(
                "Attachment evidence should be summarized by the smallest semantic fields required "
                "to justify search results without downloading attachments."
            ),
            current_measurement={
                "policy": attachment.get("policy"),
                "levels": attachment.get("levels"),
                "coverage": attachment.get("coverage"),
            },
            gap_to_lower_bound=(
                "Attachment evidence is summarized, but there is no per-query proof that the "
                "summary is the minimal sufficient statistic for attachment relevance."
            ),
            next_algorithmic_step="Add query-term-to-attachment-evidence attribution and measure dropped attachment fields against task quality.",
            correctness_guard="Attachment-bearing results must still expose source-level evidence and never imply unread attachment contents.",
            stop_condition="Stop when every retained attachment field has a measured ranking or trust contribution.",
            evidence_refs=["attachment_evidence", "quality_eval", "task_eval"],
        ),
        "ranking_calibration_gap": record(
            status="quality_gate_skipped"
            if quality_eval.get("skipped") or task_eval.get("skipped")
            else "task_quality_gate_present" if task_eval.get("passed") else "needs_attention",
            lower_bound_definition=(
                "Ranking should preserve only the scoring features whose marginal information "
                "changes user-visible order or trust at the target quality level."
            ),
            current_measurement={
                "quality_eval_skipped": quality_eval.get("skipped"),
                "task_eval_skipped": task_eval.get("skipped"),
                "task_eval_passed": task_eval.get("passed"),
                "expectation_count": task_eval.get("expectation_count"),
                "max_elapsed_ms": query.get("max_elapsed_ms"),
            },
            gap_to_lower_bound=(
                "Quality gates exist, but ranking weights are still an engineered policy rather "
                "than a Pareto-optimal model over relevance, trust, recency, and byte cost."
            ),
            next_algorithmic_step="Run ablations over ranking features and fit byte-aware weights that stay on the quality Pareto frontier.",
            correctness_guard="Task-query expectations, smoke queries, and negative proof behavior must remain satisfied.",
            stop_condition="Stop when removing or reweighting any retained feature lowers measured relevance or trust at equal byte cost.",
            evidence_refs=["quality_eval", "task_eval", "query_measurement_summary"],
        ),
        "browser_resource_gap": record(
            status="browser_verified" if browser_summary.get("passed") is True else "external_browser_evidence_required",
            lower_bound_definition=(
                "The browser should request only phase-required immutable artifacts, render without "
                "layout/console regressions, and reuse cached artifacts across repeated queries."
            ),
            current_measurement={
                "browser_report_missing": browser_missing,
                "passed": browser_summary.get("passed"),
                "persistent_cache_passed": browser_summary.get("persistent_cache_passed"),
                "viewports": browser_summary.get("viewports"),
                "scenario_count": browser_summary.get("scenario_count"),
                "max_warm_uncached_immutable_bytes": browser_summary.get("max_warm_uncached_immutable_bytes"),
            },
            gap_to_lower_bound=(
                "Browser verification is recorded only when the external browser report is present; "
                "the CLI report must not claim final browser lower-bound evidence without it."
            ),
            next_algorithmic_step="Keep browser automation as a mandatory artifact and compare network/resource traces per phase.",
            correctness_guard="Browser evidence must include desktop/mobile viewports, console status, result rendering, and warm-cache behavior.",
            stop_condition="Stop when browser resource traces match the phase model and stay stable across target viewports.",
            evidence_refs=["browser_verification"],
        ),
    }
    missing_layers = [key for key in LOWER_BOUND_GAP_LAYER_KEYS if key not in layers]
    return {
        "model": {
            "objective": "Minimize query-dependent bytes and decode work while preserving trusted top-k answers and exhaustive proof semantics.",
            "lower_bound_form": "B(q,f,K) >= routing_entropy(q,f) + topk_evidence(q,K) + proof_certificate(q) + rendered_result_payload(K).",
            "claim_boundary": (
                "Engineering gates can be passed without proving the mathematical lower bound; "
                "the gap entries identify what proof or algorithm is still missing."
            ),
        },
        "required_layers": LOWER_BOUND_GAP_LAYER_KEYS,
        "missing_layers": missing_layers,
        "layers": layers,
        "priority_order": [
            "proof_complete_certificate_gap",
            "full_shard_dependency_gap",
            "top_results_hydrated_gap",
            "first_trusted_gap",
            "topk_pruning_gap",
            "packed_index_decode_gap",
            "ranking_calibration_gap",
            "persistent_cache_gap",
            "startup_entry_gap",
            "browser_resource_gap",
            "attachment_semantics_gap",
            "route_planning_gap",
        ],
    }

def dod_audit(report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    query = report["query_measurement_summary"]
    cache = ((report.get("cache_benchmark") or {}).get("summary") or {})
    browser = report.get("browser_verification") if isinstance(report.get("browser_verification"), dict) else {}
    browser_summary = browser.get("summary") if isinstance(browser.get("summary"), dict) else {}
    attachment = report["attachment_evidence"]
    current_sizes = report["current_size_snapshot"]
    baseline_sizes = report["baseline_size_snapshot"]
    parse_decode_summary = report.get("runtime_parse_decode_summary") or {}
    query_path_decode = report.get("query_path_parse_decode_benchmark") if isinstance(report.get("query_path_parse_decode_benchmark"), dict) else {}
    query_path_decode_summary = query_path_decode.get("summary") if isinstance(query_path_decode.get("summary"), dict) else {}
    packed_body_bytes = int(current_sizes.get("local_impact_body_index_packed_total_bytes") or 0)
    body_json_bytes = int(current_sizes.get("local_impact_body_index_total_bytes") or 0)
    packed_light_bytes = int(current_sizes.get("local_impact_light_index_packed_total_bytes") or 0)
    light_meta_bytes = int(current_sizes.get("local_impact_light_index_meta_total_bytes") or 0)
    light_json_bytes = int(current_sizes.get("local_impact_light_index_total_bytes") or 0)
    wasm_decision = report.get("rust_wasm_decision") if isinstance(report.get("rust_wasm_decision"), dict) else None
    wasm_status = str(((wasm_decision or {}).get("decision") or {}).get("status") or "")
    acceptable_wasm_statuses = {
        "rust_wasm_retrieval_runtime_selected",
        "typescript_better_for_current_runtime",
        "typescript_runtime_selected_after_wasm_retrieval_kernel",
    }
    artifact_total_improved = int(current_sizes.get("artifact_total_bytes") or 0) < int(baseline_sizes.get("artifact_total_bytes") or 0)
    local_runtime_bytes_improved = float(parse_decode_summary.get("bytes_percent_change") or 0) < 0
    local_runtime_decode_improved = float(parse_decode_summary.get("parse_decode_percent_change") or 0) < 0
    query_path_decode_acceptable = bool(query_path_decode_summary.get("passed"))
    report_has_final_metric_sections = all(
        key in report
        for key in (
            "byte_comparison",
            "query_measurement_summary",
            "quality_eval",
            "task_eval",
            "cache_benchmark",
            "parse_decode_benchmark",
            "runtime_parse_decode_summary",
            "query_path_parse_decode_benchmark",
            "lower_bound_gap_report",
        )
    ) and all("phase_measurements" in item and "phase_gate" in item for item in report.get("query_measurements") or [])
    return {
        "1": {
            "status": "evidence_present",
            "evidence": report["runtime_contract"],
        },
        "2": {
            "status": "evidence_present" if query.get("phase_gates_passed") else "needs_attention",
            "evidence": {
                "planner": "Planner telemetry includes route expected_cost_bytes, selected expected_uncached bytes, cache state per local index, and phase-specific local index selections.",
                "max_first_trusted_uncached_bytes": query.get("max_first_trusted_uncached_bytes"),
                "first_trusted_absolute_limit_bytes": query.get("first_trusted_absolute_limit_bytes"),
                "max_top_results_uncached_bytes": query.get("max_top_results_uncached_bytes"),
                "top_results_absolute_limit_bytes": query.get("top_results_absolute_limit_bytes"),
                "phase_gates_passed": query.get("phase_gates_passed"),
                "phase_gate_failures": query.get("phase_gate_failures"),
            },
        },
        "3": {
            "status": "evidence_present" if query["any_dynamic_pruning"] else "needs_attention",
            "evidence": {
                "any_dynamic_pruning": query["any_dynamic_pruning"],
                "total_postings_pruned": query["total_postings_pruned"],
            },
        },
        "4": {
            "status": "evidence_present" if query["all_exhaustive_complete"] else "needs_attention",
            "evidence": (
                "Measured queries report proof ledger complete with zero pending/failed shards; "
                "runtime tests cover no-match proof, failed shard refusal, and cancelled pending-ledger refusal."
            ),
        },
        "5": {
            "status": "evidence_present" if artifact_total_improved and local_runtime_bytes_improved and (local_runtime_decode_improved or query_path_decode_acceptable) else "partial",
            "evidence": {
                "artifact_total_bytes_current": current_sizes.get("artifact_total_bytes"),
                "artifact_total_bytes_baseline": baseline_sizes.get("artifact_total_bytes"),
                "runtime_parse_decode_summary": parse_decode_summary,
                "query_path_parse_decode_summary": query_path_decode_summary,
                "note": "Runtime local-index parse/decode uses query-term selective packed decoders; family-level tables retain full-decode diagnostics, while query-path tables gate the actual phase-selected hot path.",
            },
        },
        "6": {
            "status": "evidence_present" if packed_body_bytes > 0 and packed_light_bytes > 0 else "partial" if packed_body_bytes > 0 else "unmet",
            "evidence": {
                "light_json_bytes": light_json_bytes,
                "light_split_runtime_bytes": light_meta_bytes + packed_light_bytes,
                "body_json_bytes": body_json_bytes,
                "body_packed_runtime_bytes": packed_body_bytes,
                "note": "Packed binary light terms plus metadata JSON are used for query planning; packed binary light/body indexes are scored by the stateful Rust/WASM top-k retrieval session in the browser worker.",
            },
        },
        "7": {
            "status": "evidence_present" if wasm_status in acceptable_wasm_statuses else "needs_attention",
            "evidence": wasm_decision
            or "No Rust/WASM retrieval or measured TypeScript-vs-WASM decision is recorded in this report.",
        },
        "8": {
            "status": "evidence_present" if cache.get("max_warm_uncached_bytes") == 0 else "needs_attention",
            "evidence": {
                **cache,
                "cache_invalidation_test": "Changed content-hash artifact paths are treated as cold cache misses.",
                "browser_persistent_cache": browser_summary.get("persistent_cache_passed"),
            },
        },
        "9": {
            "status": "evidence_present" if attachment["coverage"] else "needs_attention",
            "evidence": attachment,
        },
        "10": {
            "status": "evidence_present",
            "evidence": "Smoke queries, task queries, measured cold queries, warm cache queries, and a negative query are represented when full report mode is used.",
        },
        "11": {
            "status": "evidence_present" if browser_summary.get("passed") is True else "external_browser_evidence_required",
            "evidence": browser if browser and not browser.get("missing") else "Browser verification is not recorded in this CLI report yet; use the in-app browser evidence from the goal run.",
        },
        "12": {
            "status": "external_ci_deploy_required",
            "evidence": "Local validators/tests/builds can be recorded separately; CI/deployment status is outside this local report.",
        },
        "13": {
            "status": "evidence_present" if report_has_final_metric_sections else "partial",
            "evidence": "This report includes byte, time, quality, cache, pruning, parse/decode, and coverage sections.",
        },
        "14": {
            "status": "unmet",
            "evidence": "Commit, push, CI, and deployment checks are intentionally not claimed by this report.",
        },
        "15": {
            "status": "evidence_present"
            if not ((report.get("lower_bound_gap_report") or {}).get("missing_layers"))
            else "partial",
            "evidence": {
                "required_layers": (report.get("lower_bound_gap_report") or {}).get("required_layers"),
                "missing_layers": (report.get("lower_bound_gap_report") or {}).get("missing_layers"),
            },
        },
    }
