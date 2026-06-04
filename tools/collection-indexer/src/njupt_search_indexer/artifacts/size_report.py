from __future__ import annotations

from pathlib import Path
from typing import Any


def artifact_runtime_bytes(entry: dict[str, Any]) -> int:
    return int(entry.get("runtime_bytes") or entry.get("bytes") or 0)


def local_light_runtime_bytes(ref: dict[str, Any]) -> int:
    meta = ref.get("light_index_meta") if isinstance(ref.get("light_index_meta"), dict) else None
    packed = ref.get("light_index_packed") if isinstance(ref.get("light_index_packed"), dict) else None
    if meta is None or packed is None:
        raise ValueError(f"local index missing split light artifacts: {ref.get('index_id')}")
    return int(meta.get("bytes") or 0) + int(packed.get("bytes") or 0)


def local_body_runtime_bytes(ref: dict[str, Any]) -> int:
    packed = ref.get("body_index_packed") if isinstance(ref.get("body_index_packed"), dict) else None
    if packed is None:
        raise ValueError(f"local index missing packed body artifact: {ref.get('index_id')}")
    return int(packed.get("bytes") or 0)


def _set_hot_query_size_fields(
    size_report: dict[str, Any],
    *,
    artifacts: dict[str, dict[str, Any]],
    hot_query_initial_certificate_bytes_by_query: dict[str, int],
    hot_query_top_certificate_bytes_by_query: dict[str, int],
    hot_query_certificate_bytes_by_query: dict[str, int],
) -> None:
    size_report["hot_query_proof_directory_bytes"] = artifacts["hot_query_proof_directory"]["bytes"]
    size_report["hot_query_fast_start_bytes"] = artifacts["hot_query_fast_start"]["bytes"]
    size_report["hot_query_initial_certificate_total_bytes"] = sum(hot_query_initial_certificate_bytes_by_query.values())
    size_report["hot_query_initial_certificate_bytes_by_query"] = hot_query_initial_certificate_bytes_by_query
    size_report["hot_query_first_trusted_max_uncached_bytes"] = int(artifacts["hot_query_fast_start"]["bytes"]) + max(hot_query_initial_certificate_bytes_by_query.values(), default=0)
    size_report["hot_query_topk_certificate_total_bytes"] = sum(hot_query_top_certificate_bytes_by_query.values())
    size_report["hot_query_topk_certificate_bytes_by_query"] = hot_query_top_certificate_bytes_by_query
    size_report["hot_query_complete_certificate_total_bytes"] = sum(hot_query_certificate_bytes_by_query.values())
    size_report["hot_query_complete_certificate_bytes_by_query"] = hot_query_certificate_bytes_by_query


def _set_artifact_totals(size_report: dict[str, Any], public_sitegraph_dir: Path) -> None:
    size_report["artifact_count"] = sum(1 for _ in public_sitegraph_dir.rglob("*.json"))
    size_report["artifact_total_bytes"] = sum(path.stat().st_size for path in public_sitegraph_dir.rglob("*.json"))
    size_report["max_public_json_artifact_bytes"] = max((path.stat().st_size for path in public_sitegraph_dir.rglob("*.json")), default=0)
    size_report["binary_artifact_count"] = sum(1 for _ in public_sitegraph_dir.rglob("*.bin"))
    size_report["binary_artifact_total_bytes"] = sum(path.stat().st_size for path in public_sitegraph_dir.rglob("*.bin"))
    size_report["runtime_artifact_total_bytes"] = sum(path.stat().st_size for path in public_sitegraph_dir.rglob("*") if path.is_file())


def build_size_report(
    *,
    generated_at: str,
    first_screen_artifacts: list[str],
    artifacts: dict[str, dict[str, Any]],
    local_refs: list[dict[str, Any]],
    source_manifest_payloads: dict[str, dict[str, Any]],
    full_shards: list[dict[str, Any]],
    public_sitegraph_dir: Path,
    total_full_scan_bytes: int,
    max_full_shard_bytes: int,
    avg_full_shard_bytes: float,
    representative_full_scan_ms: float,
    hot_query_initial_certificate_bytes_by_query: dict[str, int],
    hot_query_top_certificate_bytes_by_query: dict[str, int],
    hot_query_certificate_bytes_by_query: dict[str, int],
) -> dict[str, Any]:
    proof_catalog_total_bytes = sum(int(payload["artifacts"]["proof_catalog"]["bytes"]) for payload in source_manifest_payloads.values())
    shard_filter_total_bytes = sum(artifact_runtime_bytes(payload["artifacts"]["shard_filter"]) for payload in source_manifest_payloads.values())
    size_report: dict[str, Any] = {
        "generated_at": generated_at,
        "first_screen_files": [],
        "first_screen_bytes": 0,
        "routed_first_screen_files": [
            {"name": name, "path": artifacts[name]["path"], "bytes": artifacts[name]["bytes"]}
            for name in first_screen_artifacts
        ],
        "routed_first_screen_bytes": sum(int(artifacts[name]["bytes"]) for name in first_screen_artifacts),
        "routed_first_screen_total_bytes": sum(int(artifacts[name]["bytes"]) for name in first_screen_artifacts),
        "global_query_directory_bytes": artifacts["global_query_directory"]["bytes"],
        "source_registry_bytes": artifacts["source_registry"]["bytes"],
        "query_aliases_bytes": artifacts["query_aliases"]["bytes"],
        "local_impact_light_index_total_bytes": 0,
        "local_impact_light_index_meta_total_bytes": sum(int(ref["light_index_meta"]["bytes"]) for ref in local_refs),
        "local_impact_light_index_packed_total_bytes": sum(int(ref["light_index_packed"]["bytes"]) for ref in local_refs),
        "local_impact_body_index_total_bytes": 0,
        "local_impact_body_index_packed_total_bytes": sum(int(ref["body_index_packed"]["bytes"]) for ref in local_refs),
        "local_index_count": len(local_refs),
        "light_index_runtime_bytes": sum(local_light_runtime_bytes(ref) for ref in local_refs),
        "body_index_bytes": 0,
        "body_index_runtime_bytes": sum(local_body_runtime_bytes(ref) for ref in local_refs),
        "local_index_runtime_bytes": sum(local_light_runtime_bytes(ref) + local_body_runtime_bytes(ref) for ref in local_refs),
        "proof_catalog_total_bytes": proof_catalog_total_bytes,
        "shard_filter_total_bytes": shard_filter_total_bytes,
        "proof_certificate_total_bytes": proof_catalog_total_bytes + shard_filter_total_bytes,
        "full_scan_total_bytes": total_full_scan_bytes,
        "shard_count": len(full_shards),
        "max_shard_bytes": max_full_shard_bytes,
        "avg_shard_bytes": avg_full_shard_bytes,
        "full_shard_count": len(full_shards),
        "max_full_shard_bytes": max_full_shard_bytes,
        "avg_full_shard_bytes": avg_full_shard_bytes,
        "max_full_shard_documents": max((int(item["count"]) for item in full_shards), default=0),
        "avg_full_shard_documents": round(sum(int(item["count"]) for item in full_shards) / max(1, len(full_shards)), 2),
        "representative_query_phase_timings": {
            "query": "校历",
            "planning_ms": 0,
            "local_index_ms": 0,
            "hydrate_ms": 0,
            "verify_scan_ms": representative_full_scan_ms,
        },
        "exhaustive_scan": {
            "shard_count": len(full_shards),
            "max_shard_bytes": max_full_shard_bytes,
            "avg_shard_bytes": avg_full_shard_bytes,
            "estimated_full_scan_bytes": total_full_scan_bytes,
            "representative_query": "校历",
            "representative_query_full_scan_time_ms": representative_full_scan_ms,
        },
    }
    _set_hot_query_size_fields(
        size_report,
        artifacts=artifacts,
        hot_query_initial_certificate_bytes_by_query=hot_query_initial_certificate_bytes_by_query,
        hot_query_top_certificate_bytes_by_query=hot_query_top_certificate_bytes_by_query,
        hot_query_certificate_bytes_by_query=hot_query_certificate_bytes_by_query,
    )
    _set_artifact_totals(size_report, public_sitegraph_dir)
    return size_report


def refresh_size_report_after_manifest(
    size_report: dict[str, Any],
    *,
    collection_id: str,
    public_index_dir: Path,
    public_sitegraph_dir: Path,
    first_screen_artifacts: list[str],
    artifacts: dict[str, dict[str, Any]],
    source_manifest_payloads: dict[str, dict[str, Any]],
    hot_query_initial_certificate_bytes_by_query: dict[str, int],
    hot_query_top_certificate_bytes_by_query: dict[str, int],
    hot_query_certificate_bytes_by_query: dict[str, int],
) -> dict[str, Any]:
    bootstrap_bytes = (public_index_dir / "manifest.json").stat().st_size
    size_report["bootstrap_manifest_bytes"] = bootstrap_bytes
    size_report["routed_first_screen_files"] = [
        {"name": "bootstrap_manifest", "path": f"generated/collections/{collection_id}/manifest.json", "bytes": bootstrap_bytes},
        *[
            {"name": name, "path": artifacts[name]["path"], "bytes": artifacts[name]["bytes"]}
            for name in first_screen_artifacts
        ],
    ]
    size_report["routed_first_screen_bytes"] = bootstrap_bytes + sum(int(artifacts[name]["bytes"]) for name in first_screen_artifacts)
    size_report["routed_first_screen_total_bytes"] = size_report["routed_first_screen_bytes"]
    size_report["proof_catalog_total_bytes"] = sum(int(payload["artifacts"]["proof_catalog"]["bytes"]) for payload in source_manifest_payloads.values())
    size_report["shard_filter_total_bytes"] = sum(artifact_runtime_bytes(payload["artifacts"]["shard_filter"]) for payload in source_manifest_payloads.values())
    size_report["proof_certificate_total_bytes"] = size_report["proof_catalog_total_bytes"] + size_report["shard_filter_total_bytes"]
    _set_hot_query_size_fields(
        size_report,
        artifacts=artifacts,
        hot_query_initial_certificate_bytes_by_query=hot_query_initial_certificate_bytes_by_query,
        hot_query_top_certificate_bytes_by_query=hot_query_top_certificate_bytes_by_query,
        hot_query_certificate_bytes_by_query=hot_query_certificate_bytes_by_query,
    )
    _set_artifact_totals(size_report, public_sitegraph_dir)
    return size_report
