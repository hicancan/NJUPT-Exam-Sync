from __future__ import annotations

import time
from typing import Any

from ..runtime_mirror.cache_io import load_index
from ..runtime_mirror.config import FIRST_TRUSTED_MAX_UNCACHED_BYTES, TOP_RESULTS_MAX_UNCACHED_BYTES
from ..sitegraph_search import recall_documents_with_stats


def summarize_top_result(results: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not results:
        return None
    top = results[0]
    return {
        "id": top.get("id"),
        "title": top.get("title"),
        "source_id": top.get("source_id"),
        "facet": top.get("facet"),
        "url": top.get("url"),
        "score": top.get("score"),
        "score_reason": top.get("score_reason"),
    }

def planner_summary(plan: dict[str, Any]) -> dict[str, Any]:
    selected = plan.get("selected_local_indexes") or []
    route_decisions = plan.get("route_decisions") or []
    return {
        "intent": plan.get("intent"),
        "estimated_cost_bytes": int(plan.get("estimated_cost_bytes") or 0),
        "estimated_utility_per_kb": float(plan.get("estimated_utility_per_kb") or 0),
        "source_ids": plan.get("source_ids") or [],
        "local_index_ids": plan.get("local_index_ids") or [],
        "selected_local_index_count": len(selected),
        "selected_expected_bytes": sum(int(item.get("expected_bytes") or 0) for item in selected),
        "selected_expected_uncached_bytes": sum(int(item.get("expected_uncached_bytes") or 0) for item in selected),
        "selected_cache_states": sorted({str(item.get("cache_state") or "cold") for item in selected}),
        "selected_local_indexes_sample": selected[:8],
        "phase_local_index_ids": plan.get("phase_local_index_ids") or {},
        "route_decisions": route_decisions,
        "route_cost_bytes": [int(item.get("expected_cost_bytes") or 0) for item in route_decisions],
    }

def retrieval_summary(retrieval: dict[str, Any]) -> dict[str, Any]:
    visited = int(retrieval.get("postings_visited") or 0)
    pruned = int(retrieval.get("postings_pruned") or 0)
    total = visited + pruned
    return {
        "dynamic_pruning": bool(retrieval.get("dynamic_pruning")),
        "impact_blocks_visited": int(retrieval.get("impact_blocks_visited") or 0),
        "impact_blocks_pruned": int(retrieval.get("impact_blocks_pruned") or 0),
        "postings_visited": visited,
        "postings_pruned": pruned,
        "postings_pruned_ratio": None if total == 0 else round(pruned / total, 6),
        "competitive_threshold": float(retrieval.get("competitive_threshold") or 0),
    }

def coverage_summary(coverage: dict[str, Any]) -> dict[str, Any]:
    ledger = coverage.get("proof_ledger") if isinstance(coverage.get("proof_ledger"), dict) else {}
    return {
        "coverage_state": coverage.get("coverage_state"),
        "exhaustive_complete": bool(coverage.get("exhaustive_complete")),
        "total_shards": int(coverage.get("total_shards") or 0),
        "scanned_shards": int(coverage.get("scanned_shards") or 0),
        "proved_no_match_shards": int(coverage.get("proved_no_match_shards") or 0),
        "pending_shards": int(coverage.get("pending_shards") or 0),
        "failed_shards": int(coverage.get("failed_shards") or 0),
        "loaded_bytes": int(coverage.get("loaded_bytes") or 0),
        "uncached_loaded_bytes": int(coverage.get("uncached_loaded_bytes") or 0),
        "cached_artifact_bytes": int(coverage.get("cached_artifact_bytes") or 0),
        "first_screen_bytes": int(coverage.get("first_screen_bytes") or 0),
        "local_index_bytes": int(coverage.get("local_index_bytes") or 0),
        "hydrated_shard_bytes": int(coverage.get("hydrated_shard_bytes") or 0),
        "proof_ledger_complete": bool(ledger.get("complete")),
    }

def phase_measurement_summary(stats: dict[str, Any]) -> dict[str, Any]:
    coverages = stats.get("phase_coverages") if isinstance(stats.get("phase_coverages"), dict) else {}
    timings = stats.get("phase_timings_ms") if isinstance(stats.get("phase_timings_ms"), dict) else {}
    phases: dict[str, Any] = {}
    for phase in ("first_trusted_results", "top_results_hydrated", "proof_complete"):
        coverage = coverages.get(phase) if isinstance(coverages.get(phase), dict) else {}
        summary = coverage_summary(coverage)
        summary["elapsed_ms"] = float(timings.get(phase) or 0.0)
        phases[phase] = summary
    return phases

def phase_gate_result(phases: dict[str, Any]) -> dict[str, Any]:
    first = phases.get("first_trusted_results") or {}
    top = phases.get("top_results_hydrated") or {}
    proof = phases.get("proof_complete") or {}
    proof_bytes = int(proof.get("uncached_loaded_bytes") or 0)
    first_bytes = int(first.get("uncached_loaded_bytes") or 0)
    top_bytes = int(top.get("uncached_loaded_bytes") or 0)
    first_relative_limit = proof_bytes * 0.10
    top_relative_limit = proof_bytes * 0.25
    first_passed = first_bytes <= FIRST_TRUSTED_MAX_UNCACHED_BYTES or (
        proof_bytes > 0 and first_bytes <= first_relative_limit
    )
    top_passed = top_bytes <= TOP_RESULTS_MAX_UNCACHED_BYTES or (
        proof_bytes > 0 and top_bytes <= top_relative_limit
    )
    return {
        "first_trusted_uncached_bytes": first_bytes,
        "first_trusted_absolute_limit_bytes": FIRST_TRUSTED_MAX_UNCACHED_BYTES,
        "first_trusted_relative_limit_bytes": round(first_relative_limit),
        "first_trusted_passed": first_passed,
        "top_results_uncached_bytes": top_bytes,
        "top_results_absolute_limit_bytes": TOP_RESULTS_MAX_UNCACHED_BYTES,
        "top_results_relative_limit_bytes": round(top_relative_limit),
        "top_results_passed": top_passed,
        "proof_complete_uncached_bytes": proof_bytes,
        "passed": first_passed and top_passed,
    }

def proof_scan_pressure_summary(stats: dict[str, Any]) -> dict[str, Any]:
    pressure = stats.get("proof_scan_pressure") if isinstance(stats.get("proof_scan_pressure"), dict) else {}
    return {
        "certificate_used": bool(pressure.get("certificate_used")),
        "certificate_bytes": int(pressure.get("certificate_bytes") or 0),
        "topk_certificate_bytes": int(pressure.get("topk_certificate_bytes") or 0),
        "true_match_shards": int(pressure.get("true_match_shards") or 0),
        "false_positive_shards": int(pressure.get("false_positive_shards") or 0),
        "true_match_bytes": int(pressure.get("true_match_bytes") or 0),
        "false_positive_bytes": int(pressure.get("false_positive_bytes") or 0),
        "true_match_docs": int(pressure.get("true_match_docs") or 0),
        "matched_shard_bytes_avoided": int(pressure.get("matched_shard_bytes_avoided") or 0),
        "false_positive_scan_ratio": float(pressure.get("false_positive_scan_ratio") or 0.0),
        "false_positive_byte_ratio": float(pressure.get("false_positive_byte_ratio") or 0.0),
    }

def measure_queries(queries: list[str]) -> list[dict[str, Any]]:
    measurements: list[dict[str, Any]] = []
    for query in queries:
        index = load_index()
        started = time.perf_counter()
        payload = recall_documents_with_stats(query, limit=12, index=index)
        elapsed_ms = (time.perf_counter() - started) * 1000
        stats = payload["stats"]
        phases = phase_measurement_summary(stats)
        measurements.append(
            {
                "query": query,
                "elapsed_ms": round(elapsed_ms, 3),
                "result_count": len(payload["results"]),
                "top_result": summarize_top_result(payload["results"]),
                "quick_result_count": int(stats.get("quick_result_count") or 0),
                "candidate_count": int(stats.get("candidate_count") or 0),
                "candidate_shard_count": int(stats.get("candidate_shard_count") or 0),
                "loaded_shard_count": int(stats.get("loaded_shard_count") or 0),
                "loaded_local_index_count": int(stats.get("loaded_local_index_count") or 0),
                "planner": planner_summary(stats.get("plan") or {}),
                "retrieval": retrieval_summary(stats.get("retrieval") or {}),
                "phase_measurements": phases,
                "phase_gate": phase_gate_result(phases),
                "coverage": coverage_summary(stats.get("coverage") or {}),
                "proof_scan_pressure": proof_scan_pressure_summary(stats),
                "hot_query_initial_certificate": stats.get("hot_query_initial_certificate") or {"used": False},
                "hot_query_topk_certificate": stats.get("hot_query_topk_certificate") or {"used": False},
                "hot_query_complete_certificate": stats.get("hot_query_complete_certificate") or {"used": False},
            }
        )
    return measurements

def query_summary(measurements: list[dict[str, Any]]) -> dict[str, Any]:
    phase_gates = [item.get("phase_gate") or {} for item in measurements]
    pressure_items = [item.get("proof_scan_pressure") or {} for item in measurements]
    hot_initial_items = [item.get("hot_query_initial_certificate") or {} for item in measurements]
    hot_top_items = [item.get("hot_query_topk_certificate") or {} for item in measurements]
    hot_items = [item.get("hot_query_complete_certificate") or {} for item in measurements]
    max_true_match = max(
        measurements,
        key=lambda item: int((item.get("proof_scan_pressure") or {}).get("true_match_bytes") or 0),
        default=None,
    )
    max_false_positive = max(
        measurements,
        key=lambda item: int((item.get("proof_scan_pressure") or {}).get("false_positive_bytes") or 0),
        default=None,
    )
    max_false_positive_ratio = max(
        measurements,
        key=lambda item: float((item.get("proof_scan_pressure") or {}).get("false_positive_byte_ratio") or 0.0),
        default=None,
    )
    max_certificate = max(
        measurements,
        key=lambda item: int((item.get("hot_query_complete_certificate") or {}).get("certificate_bytes") or 0),
        default=None,
    )
    max_certificate_avoided = max(
        measurements,
        key=lambda item: int((item.get("hot_query_complete_certificate") or {}).get("matched_shard_bytes_avoided") or 0),
        default=None,
    )
    max_true_match_bytes = max((int(item.get("true_match_bytes") or 0) for item in pressure_items), default=0)
    max_false_positive_bytes = max((int(item.get("false_positive_bytes") or 0) for item in pressure_items), default=0)
    max_false_positive_ratio_value = max((float(item.get("false_positive_byte_ratio") or 0.0) for item in pressure_items), default=0.0)
    max_hot_certificate_bytes = max((int(item.get("certificate_bytes") or 0) for item in hot_items), default=0)
    max_hot_initial_certificate_bytes = max((int(item.get("certificate_bytes") or 0) for item in hot_initial_items), default=0)
    max_hot_top_certificate_bytes = max((int(item.get("certificate_bytes") or 0) for item in hot_top_items), default=0)
    max_hot_certificate_avoided_bytes = max((int(item.get("matched_shard_bytes_avoided") or 0) for item in hot_items), default=0)
    return {
        "query_count": len(measurements),
        "max_elapsed_ms": max((float(item["elapsed_ms"]) for item in measurements), default=0.0),
        "max_candidate_shard_count": max((int(item["candidate_shard_count"]) for item in measurements), default=0),
        "max_loaded_shard_count": max((int(item["loaded_shard_count"]) for item in measurements), default=0),
        "max_uncached_loaded_bytes": max((int(item["coverage"]["uncached_loaded_bytes"]) for item in measurements), default=0),
        "max_first_trusted_uncached_bytes": max((int(gate.get("first_trusted_uncached_bytes") or 0) for gate in phase_gates), default=0),
        "max_top_results_uncached_bytes": max((int(gate.get("top_results_uncached_bytes") or 0) for gate in phase_gates), default=0),
        "max_proof_complete_uncached_bytes": max((int(gate.get("proof_complete_uncached_bytes") or 0) for gate in phase_gates), default=0),
        "first_trusted_absolute_limit_bytes": FIRST_TRUSTED_MAX_UNCACHED_BYTES,
        "top_results_absolute_limit_bytes": TOP_RESULTS_MAX_UNCACHED_BYTES,
        "phase_gates_passed": all(bool(gate.get("passed")) for gate in phase_gates) if phase_gates else False,
        "phase_gate_failures": [
            {
                "query": item["query"],
                **(item.get("phase_gate") or {}),
            }
            for item in measurements
            if not bool((item.get("phase_gate") or {}).get("passed"))
        ],
        "all_exhaustive_complete": all(bool(item["coverage"]["exhaustive_complete"]) for item in measurements),
        "any_dynamic_pruning": any(bool(item["retrieval"]["dynamic_pruning"]) for item in measurements),
        "total_postings_pruned": sum(int(item["retrieval"]["postings_pruned"]) for item in measurements),
        "max_proof_true_match_bytes": max_true_match_bytes,
        "max_proof_true_match_query": None if max_true_match_bytes == 0 or max_true_match is None else max_true_match.get("query"),
        "max_proof_false_positive_bytes": max_false_positive_bytes,
        "max_proof_false_positive_query": None if max_false_positive_bytes == 0 or max_false_positive is None else max_false_positive.get("query"),
        "max_proof_false_positive_byte_ratio": max_false_positive_ratio_value,
        "max_proof_false_positive_ratio_query": None if max_false_positive_ratio_value == 0.0 or max_false_positive_ratio is None else max_false_positive_ratio.get("query"),
        "hot_query_initial_certificate_used_count": sum(1 for item in hot_initial_items if item.get("used") is True),
        "max_hot_query_initial_certificate_bytes": max_hot_initial_certificate_bytes,
        "hot_query_topk_certificate_used_count": sum(1 for item in hot_top_items if item.get("used") is True),
        "max_hot_query_topk_certificate_bytes": max_hot_top_certificate_bytes,
        "hot_query_certificate_used_count": sum(1 for item in hot_items if item.get("used") is True),
        "max_hot_query_certificate_bytes": max_hot_certificate_bytes,
        "max_hot_query_certificate_query": None if max_hot_certificate_bytes == 0 or max_certificate is None else max_certificate.get("query"),
        "max_hot_query_matched_shard_bytes_avoided": max_hot_certificate_avoided_bytes,
        "max_hot_query_matched_shard_bytes_avoided_query": None if max_hot_certificate_avoided_bytes == 0 or max_certificate_avoided is None else max_certificate_avoided.get("query"),
    }

def attachment_evidence_summary(manifest: dict[str, Any]) -> dict[str, Any]:
    sitegraph = manifest.get("sitegraph") if isinstance(manifest.get("sitegraph"), dict) else {}
    contract = manifest.get("coverage_contract") if isinstance(manifest.get("coverage_contract"), dict) else {}
    return {
        "policy": sitegraph.get("attachment_evidence_policy"),
        "levels": contract.get("attachment_evidence_levels") or [],
        "coverage": sitegraph.get("attachment_evidence_coverage") or {},
        "source_manifest_summaries": sitegraph.get("source_manifest_summaries") or {},
    }
