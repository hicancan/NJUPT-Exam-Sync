from __future__ import annotations

import base64
import json
import statistics
import time
from typing import Any

from njupt_search_indexer.sitegraph_binary_index import unpack_impact_index, unpack_impact_terms

from ..runtime_mirror.config import PUBLIC_INDEX_DIR
from ..runtime_mirror.text import tokens_for_query
from ..reports.config import QUERY_PATH_DECODE_REGRESSION_TOLERANCE_PERCENT
from ..reports.io import (
    current_artifact_bytes,
    git_show_bytes,
    load_local_body_payloads,
    load_local_light_payloads,
    load_shard_filter_payloads,
    load_source_manifest_payloads,
    local_index_payloads_by_ids,
    local_index_refs_by_id,
    public_artifact_repo_path,
    repo_relative,
)


def benchmark_json_parse(payloads: list[bytes], runs: int) -> dict[str, Any]:
    measurements: list[float] = []
    for _ in range(max(1, runs)):
        started = time.perf_counter()
        for payload in payloads:
            json.loads(payload)
        measurements.append((time.perf_counter() - started) * 1000)
    return {
        "artifact_count": len(payloads),
        "bytes": sum(len(payload) for payload in payloads),
        "runs": len(measurements),
        "mean_ms": round(statistics.fmean(measurements), 3),
        "min_ms": round(min(measurements), 3),
        "max_ms": round(max(measurements), 3),
    }

def benchmark_shard_filter_decode(payloads: list[bytes], runs: int) -> dict[str, Any]:
    measurements: list[float] = []
    bitsets = 0
    for _ in range(max(1, runs)):
        started = time.perf_counter()
        decoded_this_run = 0
        for payload in payloads:
            parsed = json.loads(payload)
            entries = parsed.get("entries") if isinstance(parsed, dict) and isinstance(parsed.get("entries"), dict) else parsed
            for item in entries.values():
                if isinstance(item, dict) and item.get("bitset_base64"):
                    base64.b64decode(str(item["bitset_base64"]))
                    decoded_this_run += 1
        measurements.append((time.perf_counter() - started) * 1000)
        bitsets = max(bitsets, decoded_this_run)
    return {
        "artifact_count": len(payloads),
        "bitset_count": bitsets,
        "bytes": sum(len(payload) for payload in payloads),
        "runs": len(measurements),
        "mean_ms": round(statistics.fmean(measurements), 3),
        "min_ms": round(min(measurements), 3),
        "max_ms": round(max(measurements), 3),
    }

def benchmark_packed_impact_decode(payloads: list[bytes], runs: int) -> dict[str, Any]:
    measurements: list[float] = []
    term_count = 0
    for _ in range(max(1, runs)):
        started = time.perf_counter()
        decoded_terms = 0
        for payload in payloads:
            decoded = unpack_impact_index(payload)
            decoded_terms += len(decoded.get("terms") or {})
        measurements.append((time.perf_counter() - started) * 1000)
        term_count = max(term_count, decoded_terms)
    if not measurements:
        measurements = [0.0]
    return {
        "artifact_count": len(payloads),
        "term_count": term_count,
        "bytes": sum(len(payload) for payload in payloads),
        "runs": len(measurements),
        "mean_ms": round(statistics.fmean(measurements), 3),
        "min_ms": round(min(measurements), 3),
        "max_ms": round(max(measurements), 3),
    }

def benchmark_packed_impact_selective_decode(payloads: list[bytes], terms: list[str], runs: int) -> dict[str, Any]:
    measurements: list[float] = []
    term_count = 0
    unique_terms = sorted(set(terms), key=len, reverse=True)
    for _ in range(max(1, runs)):
        started = time.perf_counter()
        decoded_terms = 0
        for payload in payloads:
            decoded = unpack_impact_terms(payload, unique_terms)
            decoded_terms += len(decoded.get("terms") or {})
        measurements.append((time.perf_counter() - started) * 1000)
        term_count = max(term_count, decoded_terms)
    if not measurements:
        measurements = [0.0]
    return {
        "artifact_count": len(payloads),
        "query_term_count": len(unique_terms),
        "matched_term_count": term_count,
        "bytes": sum(len(payload) for payload in payloads),
        "runs": len(measurements),
        "mean_ms": round(statistics.fmean(measurements), 3),
        "min_ms": round(min(measurements), 3),
        "max_ms": round(max(measurements), 3),
    }

def zero_json_benchmark(runs: int) -> dict[str, Any]:
    return {
        "artifact_count": 0,
        "bytes": 0,
        "runs": max(1, runs),
        "mean_ms": 0.0,
        "min_ms": 0.0,
        "max_ms": 0.0,
    }

def zero_packed_benchmark(runs: int) -> dict[str, Any]:
    return {
        "artifact_count": 0,
        "term_count": 0,
        "bytes": 0,
        "runs": max(1, runs),
        "mean_ms": 0.0,
        "min_ms": 0.0,
        "max_ms": 0.0,
    }

def zero_selective_benchmark(terms: list[str], runs: int) -> dict[str, Any]:
    return {
        "artifact_count": 0,
        "query_term_count": len(set(terms)),
        "matched_term_count": 0,
        "bytes": 0,
        "runs": max(1, runs),
        "mean_ms": 0.0,
        "min_ms": 0.0,
        "max_ms": 0.0,
    }

def parse_decode_benchmark(
    current: dict[str, Any],
    baseline: dict[str, Any],
    *,
    baseline_ref: str | None,
    parse_runs: int,
    runtime_terms: list[str],
    include_local_body: bool = True,
) -> dict[str, Any]:
    def baseline_artifact_bytes(path_from_public_root: str) -> bytes:
        if baseline_ref is None:
            return current_artifact_bytes(path_from_public_root)
        return git_show_bytes(baseline_ref, public_artifact_repo_path(path_from_public_root))

    current_bootstrap = [
        (PUBLIC_INDEX_DIR / "manifest.json").read_bytes(),
        *[
            current_artifact_bytes(str(current["artifacts"][name]["path"]))
            for name in ("source_registry", "global_query_directory", "query_aliases")
        ],
    ]
    baseline_bootstrap = [
        (PUBLIC_INDEX_DIR / "manifest.json").read_bytes()
        if baseline_ref is None
        else git_show_bytes(baseline_ref, repo_relative(PUBLIC_INDEX_DIR / "manifest.json")),
        *[
            baseline_artifact_bytes(str(baseline["artifacts"][name]["path"]))
            for name in ("source_registry", "global_query_directory", "query_aliases")
        ],
    ]
    current_source_manifests = load_source_manifest_payloads(current)
    baseline_source_manifests = load_source_manifest_payloads(baseline, baseline_ref=baseline_ref)
    current_filters = load_shard_filter_payloads(current)
    baseline_filters = load_shard_filter_payloads(baseline, baseline_ref=baseline_ref)
    benchmark = {
        "parse_runs": max(1, parse_runs),
        "bootstrap_json": {
            "current": benchmark_json_parse(current_bootstrap, parse_runs),
            "baseline": benchmark_json_parse(baseline_bootstrap, parse_runs),
        },
        "source_manifests": {
            "current": benchmark_json_parse(current_source_manifests, parse_runs),
            "baseline": benchmark_json_parse(baseline_source_manifests, parse_runs),
        },
        "shard_filters_json_and_bitsets": {
            "current": benchmark_shard_filter_decode(current_filters, parse_runs),
            "baseline": benchmark_shard_filter_decode(baseline_filters, parse_runs),
        },
    }
    if include_local_body:
        current_light_json = load_local_light_payloads(current)
        baseline_light_json = load_local_light_payloads(baseline, baseline_ref=baseline_ref)
        current_light_meta = load_local_light_payloads(current, artifact_key="light_index_meta")
        baseline_light_meta = load_local_light_payloads(baseline, baseline_ref=baseline_ref, artifact_key="light_index_meta")
        current_light_packed = load_local_light_payloads(current, artifact_key="light_index_packed")
        baseline_light_packed = load_local_light_payloads(baseline, baseline_ref=baseline_ref, artifact_key="light_index_packed")
        current_body_json = load_local_body_payloads(current)
        baseline_body_json = load_local_body_payloads(baseline, baseline_ref=baseline_ref)
        current_body_packed = load_local_body_payloads(current, packed=True)
        baseline_body_packed = load_local_body_payloads(baseline, baseline_ref=baseline_ref, packed=True)
        benchmark["local_light_json"] = {
            "current": benchmark_json_parse(current_light_json, parse_runs),
            "baseline": benchmark_json_parse(baseline_light_json, parse_runs),
        }
        benchmark["local_light_meta_json"] = {
            "current": benchmark_json_parse(current_light_meta, parse_runs),
            "baseline": benchmark_json_parse(baseline_light_meta, parse_runs) if baseline_light_meta else zero_json_benchmark(parse_runs),
        }
        benchmark["local_light_packed"] = {
            "current": benchmark_packed_impact_decode(current_light_packed, parse_runs),
            "baseline": benchmark_packed_impact_decode(baseline_light_packed, parse_runs) if baseline_light_packed else zero_packed_benchmark(parse_runs),
        }
        benchmark["local_light_packed_query_terms"] = {
            "current": benchmark_packed_impact_selective_decode(current_light_packed, runtime_terms, parse_runs),
            "baseline": benchmark_packed_impact_selective_decode(baseline_light_packed, runtime_terms, parse_runs)
            if baseline_light_packed
            else zero_selective_benchmark(runtime_terms, parse_runs),
        }
        benchmark["local_body_json"] = {
            "current": benchmark_json_parse(current_body_json, parse_runs),
            "baseline": benchmark_json_parse(baseline_body_json, parse_runs),
        }
        benchmark["local_body_packed"] = {
            "current": benchmark_packed_impact_decode(current_body_packed, parse_runs),
            "baseline": benchmark_packed_impact_decode(baseline_body_packed, parse_runs) if baseline_body_packed else zero_packed_benchmark(parse_runs),
        }
        benchmark["local_body_packed_query_terms"] = {
            "current": benchmark_packed_impact_selective_decode(current_body_packed, runtime_terms, parse_runs),
            "baseline": benchmark_packed_impact_selective_decode(baseline_body_packed, runtime_terms, parse_runs)
            if baseline_body_packed
            else zero_selective_benchmark(runtime_terms, parse_runs),
        }
    return benchmark

def runtime_parse_decode_summary(benchmark: dict[str, Any]) -> dict[str, Any]:
    def current(family: str) -> dict[str, Any]:
        return (benchmark.get(family) or {}).get("current") or {}

    def baseline(family: str) -> dict[str, Any]:
        return (benchmark.get(family) or {}).get("baseline") or {}

    baseline_json_bytes = int(baseline("local_light_json").get("bytes") or 0) + int(baseline("local_body_json").get("bytes") or 0)
    baseline_split_bytes = (
        int(baseline("local_light_meta_json").get("bytes") or 0)
        + int(baseline("local_light_packed").get("bytes") or 0)
        + int(baseline("local_body_packed").get("bytes") or 0)
    )
    baseline_bytes = baseline_json_bytes or baseline_split_bytes
    current_bytes = (
        int(current("local_light_meta_json").get("bytes") or 0)
        + int(current("local_light_packed").get("bytes") or 0)
        + int(current("local_body_packed").get("bytes") or 0)
    )
    baseline_json_mean_ms = float(baseline("local_light_json").get("mean_ms") or 0) + float(baseline("local_body_json").get("mean_ms") or 0)
    baseline_split_mean_ms = (
        float(baseline("local_light_meta_json").get("mean_ms") or 0)
        + float(baseline("local_light_packed_query_terms").get("mean_ms") or baseline("local_light_packed").get("mean_ms") or 0)
        + float(baseline("local_body_packed_query_terms").get("mean_ms") or baseline("local_body_packed").get("mean_ms") or 0)
    )
    baseline_mean_ms = baseline_json_mean_ms or baseline_split_mean_ms
    current_mean_ms = (
        float(current("local_light_meta_json").get("mean_ms") or 0)
        + float(current("local_light_packed_query_terms").get("mean_ms") or current("local_light_packed").get("mean_ms") or 0)
        + float(current("local_body_packed_query_terms").get("mean_ms") or current("local_body_packed").get("mean_ms") or 0)
    )
    return {
        "baseline_local_index_runtime_bytes": baseline_bytes,
        "current_local_index_runtime_bytes": current_bytes,
        "bytes_delta": current_bytes - baseline_bytes,
        "bytes_percent_change": None if baseline_bytes == 0 else round((current_bytes - baseline_bytes) / baseline_bytes * 100, 3),
        "baseline_local_index_parse_decode_mean_ms": round(baseline_mean_ms, 3),
        "current_local_index_query_term_parse_decode_mean_ms": round(current_mean_ms, 3),
        "parse_decode_delta_ms": round(current_mean_ms - baseline_mean_ms, 3),
        "parse_decode_percent_change": None if baseline_mean_ms == 0 else round((current_mean_ms - baseline_mean_ms) / baseline_mean_ms * 100, 3),
        "body_decode_mode": "packed_query_term_selective",
        "light_decode_mode": "metadata_json_plus_packed_query_term_selective",
    }

def percent_change(current: float, baseline: float) -> float | None:
    if baseline == 0:
        return None
    return round((current - baseline) / baseline * 100, 3)

def query_path_phase_parse_decode(
    *,
    current_refs: dict[str, dict[str, Any]],
    baseline_refs: dict[str, dict[str, Any]],
    index_ids: list[str],
    terms: list[str],
    parse_runs: int,
    baseline_ref: str | None,
    include_body: bool,
) -> dict[str, Any]:
    current_light_meta = local_index_payloads_by_ids(current_refs, index_ids, "light_index_meta")
    current_light_packed = local_index_payloads_by_ids(current_refs, index_ids, "light_index_packed")
    current_body_packed = local_index_payloads_by_ids(current_refs, index_ids, "body_index_packed") if include_body else []
    baseline_light_json = local_index_payloads_by_ids(
        baseline_refs,
        index_ids,
        "light_index",
        baseline_ref=baseline_ref,
    )
    baseline_body_json = (
        local_index_payloads_by_ids(baseline_refs, index_ids, "body_index", baseline_ref=baseline_ref)
        if include_body
        else []
    )
    baseline_light_meta = local_index_payloads_by_ids(
        baseline_refs,
        index_ids,
        "light_index_meta",
        baseline_ref=baseline_ref,
    )
    baseline_light_packed = local_index_payloads_by_ids(
        baseline_refs,
        index_ids,
        "light_index_packed",
        baseline_ref=baseline_ref,
    )
    baseline_body_packed = (
        local_index_payloads_by_ids(baseline_refs, index_ids, "body_index_packed", baseline_ref=baseline_ref)
        if include_body
        else []
    )

    current_meta = benchmark_json_parse(current_light_meta, parse_runs)
    current_light_terms = benchmark_packed_impact_selective_decode(current_light_packed, terms, parse_runs)
    current_body_terms = benchmark_packed_impact_selective_decode(current_body_packed, terms, parse_runs) if include_body else {
        "artifact_count": 0,
        "query_term_count": len(set(terms)),
        "matched_term_count": 0,
        "bytes": 0,
        "runs": max(1, parse_runs),
        "mean_ms": 0.0,
        "min_ms": 0.0,
        "max_ms": 0.0,
    }
    if baseline_light_json or baseline_body_json:
        baseline_decode = benchmark_json_parse([*baseline_light_json, *baseline_body_json], parse_runs)
        baseline_components = {"json": baseline_decode}
    else:
        baseline_meta = benchmark_json_parse(baseline_light_meta, parse_runs) if baseline_light_meta else zero_json_benchmark(parse_runs)
        baseline_light_terms = (
            benchmark_packed_impact_selective_decode(baseline_light_packed, terms, parse_runs)
            if baseline_light_packed
            else zero_selective_benchmark(terms, parse_runs)
        )
        baseline_body_terms = (
            benchmark_packed_impact_selective_decode(baseline_body_packed, terms, parse_runs)
            if include_body and baseline_body_packed
            else zero_selective_benchmark(terms, parse_runs)
        )
        baseline_decode = {
            "artifact_count": int(baseline_meta["artifact_count"])
            + int(baseline_light_terms["artifact_count"])
            + int(baseline_body_terms["artifact_count"]),
            "bytes": int(baseline_meta["bytes"]) + int(baseline_light_terms["bytes"]) + int(baseline_body_terms["bytes"]),
            "runs": max(1, parse_runs),
            "mean_ms": round(
                float(baseline_meta["mean_ms"])
                + float(baseline_light_terms["mean_ms"])
                + float(baseline_body_terms["mean_ms"]),
                3,
            ),
            "min_ms": round(
                float(baseline_meta["min_ms"])
                + float(baseline_light_terms["min_ms"])
                + float(baseline_body_terms["min_ms"]),
                3,
            ),
            "max_ms": round(
                float(baseline_meta["max_ms"])
                + float(baseline_light_terms["max_ms"])
                + float(baseline_body_terms["max_ms"]),
                3,
            ),
            "mode": "split_packed_query_terms",
        }
        baseline_components = {
            "light_meta_json": baseline_meta,
            "light_packed_query_terms": baseline_light_terms,
            "body_packed_query_terms": baseline_body_terms,
        }

    current_bytes = int(current_meta["bytes"]) + int(current_light_terms["bytes"]) + int(current_body_terms["bytes"])
    baseline_bytes = int(baseline_decode["bytes"])
    current_mean_ms = (
        float(current_meta["mean_ms"])
        + float(current_light_terms["mean_ms"])
        + float(current_body_terms["mean_ms"])
    )
    baseline_mean_ms = float(baseline_decode["mean_ms"])
    return {
        "local_index_count": len(dict.fromkeys(index_ids)),
        "current_artifact_count": int(current_meta["artifact_count"])
        + int(current_light_terms["artifact_count"])
        + int(current_body_terms["artifact_count"]),
        "baseline_artifact_count": int(baseline_decode["artifact_count"]),
        "current_bytes": current_bytes,
        "baseline_bytes": baseline_bytes,
        "bytes_percent_change": percent_change(float(current_bytes), float(baseline_bytes)),
        "current_mean_ms": round(current_mean_ms, 3),
        "baseline_mean_ms": round(baseline_mean_ms, 3),
        "decode_percent_change": percent_change(current_mean_ms, baseline_mean_ms),
        "current_components": {
            "light_meta_json": current_meta,
            "light_packed_query_terms": current_light_terms,
            "body_packed_query_terms": current_body_terms,
        },
        "baseline_json": baseline_decode,
        "baseline_components": baseline_components,
    }

def query_path_parse_decode_benchmark(
    current: dict[str, Any],
    baseline: dict[str, Any],
    *,
    baseline_ref: str | None,
    query_measurements: list[dict[str, Any]],
    aliases: dict[str, list[str]],
    parse_runs: int,
) -> dict[str, Any]:
    current_refs = local_index_refs_by_id(current)
    baseline_refs = local_index_refs_by_id(baseline, baseline_ref=baseline_ref)
    queries: list[dict[str, Any]] = []
    for item in query_measurements:
        query = str(item["query"])
        terms = tokens_for_query(query, aliases)
        phase_ids = ((item.get("planner") or {}).get("phase_local_index_ids") or {})
        first_ids = [str(index_id) for index_id in phase_ids.get("first_trusted_results") or []]
        top_ids = [str(index_id) for index_id in phase_ids.get("top_results_hydrated") or []]
        queries.append(
            {
                "query": query,
                "first_trusted_results": query_path_phase_parse_decode(
                    current_refs=current_refs,
                    baseline_refs=baseline_refs,
                    index_ids=first_ids,
                    terms=terms,
                    parse_runs=parse_runs,
                    baseline_ref=baseline_ref,
                    include_body=False,
                ),
                "top_results_hydrated": query_path_phase_parse_decode(
                    current_refs=current_refs,
                    baseline_refs=baseline_refs,
                    index_ids=top_ids,
                    terms=terms,
                    parse_runs=parse_runs,
                    baseline_ref=baseline_ref,
                    include_body=True,
                ),
            }
        )

    def summarize_phase(phase: str) -> dict[str, Any]:
        rows = [query[phase] for query in queries]
        current_bytes = [int(row.get("current_bytes") or 0) for row in rows]
        baseline_bytes = [int(row.get("baseline_bytes") or 0) for row in rows]
        current_ms = [float(row.get("current_mean_ms") or 0) for row in rows]
        baseline_ms = [float(row.get("baseline_mean_ms") or 0) for row in rows]
        mean_current_bytes = statistics.fmean(current_bytes) if current_bytes else 0.0
        mean_baseline_bytes = statistics.fmean(baseline_bytes) if baseline_bytes else 0.0
        mean_current_ms = statistics.fmean(current_ms) if current_ms else 0.0
        mean_baseline_ms = statistics.fmean(baseline_ms) if baseline_ms else 0.0
        bytes_change = percent_change(mean_current_bytes, mean_baseline_bytes)
        decode_change = percent_change(mean_current_ms, mean_baseline_ms)
        zero_decode_path = mean_current_bytes == 0 and mean_baseline_bytes == 0 and mean_current_ms < 0.05 and mean_baseline_ms < 0.05
        bytes_passed = zero_decode_path or (bytes_change is not None and bytes_change <= 0)
        decode_within_tolerance = zero_decode_path or (
            decode_change is not None and decode_change <= QUERY_PATH_DECODE_REGRESSION_TOLERANCE_PERCENT
        )
        return {
            "mean_current_bytes": round(mean_current_bytes),
            "mean_baseline_bytes": round(mean_baseline_bytes),
            "max_current_bytes": max(current_bytes, default=0),
            "max_baseline_bytes": max(baseline_bytes, default=0),
            "bytes_percent_change": bytes_change,
            "mean_current_decode_ms": round(mean_current_ms, 3),
            "mean_baseline_decode_ms": round(mean_baseline_ms, 3),
            "decode_percent_change": decode_change,
            "decode_regression_tolerance_percent": QUERY_PATH_DECODE_REGRESSION_TOLERANCE_PERCENT,
            "bytes_passed": bytes_passed,
            "decode_within_tolerance": decode_within_tolerance,
            "decode_improved": zero_decode_path or (decode_change is not None and decode_change < 0),
            "passed": bytes_passed,
        }

    summary = {
        "query_count": len(queries),
        "first_trusted_results": summarize_phase("first_trusted_results"),
        "top_results_hydrated": summarize_phase("top_results_hydrated"),
    }
    summary["passed"] = bool(
        summary["first_trusted_results"]["passed"]
        and summary["top_results_hydrated"]["passed"]
    )
    return {
        "benchmark": "query-path-parse-decode-v1",
        "parse_runs": max(1, parse_runs),
        "summary": summary,
        "queries": queries,
        "note": (
            "This measures the actual phase-selected local indexes from the query plan, "
            "not the diagnostic all-local-index family table."
        ),
    }
