from __future__ import annotations

import json

from ..runtime_mirror.config import BASE_DIR


DEFAULT_REPORT_QUERIES = [
    str(query)
    for query in json.loads((BASE_DIR / "config" / "search" / "lower-bound-report-queries.json").read_text(encoding="utf-8"))
]
DEFAULT_WASM_DECISION_REPORT = BASE_DIR / "tools" / "search-eval" / "reports" / "njupt-search-wasm-decision.json"
DEFAULT_BROWSER_VERIFICATION_REPORT = BASE_DIR / "tools" / "search-eval" / "reports" / "njupt-search-browser-verification.json"
QUERY_PATH_DECODE_REGRESSION_TOLERANCE_PERCENT = 5.0

BYTE_METRICS = [
    "routed_first_screen_total_bytes",
    "bootstrap_manifest_bytes",
    "source_registry_bytes",
    "global_query_directory_bytes",
    "query_aliases_bytes",
    "source_manifest_total_bytes",
    "local_impact_light_index_total_bytes",
    "local_impact_light_index_meta_total_bytes",
    "local_impact_light_index_packed_total_bytes",
    "local_impact_body_index_total_bytes",
    "local_impact_body_index_packed_total_bytes",
    "light_index_runtime_bytes",
    "body_index_bytes",
    "body_index_runtime_bytes",
    "local_index_runtime_bytes",
    "proof_catalog_total_bytes",
    "shard_filter_total_bytes",
    "proof_certificate_total_bytes",
    "hot_query_proof_directory_bytes",
    "hot_query_topk_certificate_total_bytes",
    "hot_query_complete_certificate_total_bytes",
    "full_scan_total_bytes",
    "artifact_total_bytes",
    "binary_artifact_total_bytes",
    "runtime_artifact_total_bytes",
    "artifact_count",
    "binary_artifact_count",
    "local_index_count",
    "full_shard_count",
    "max_full_shard_bytes",
    "avg_full_shard_bytes",
]

LOWER_BOUND_GAP_LAYER_KEYS = [
    "startup_entry_gap",
    "route_planning_gap",
    "first_trusted_gap",
    "top_results_hydrated_gap",
    "proof_complete_certificate_gap",
    "full_shard_dependency_gap",
    "packed_index_decode_gap",
    "topk_pruning_gap",
    "persistent_cache_gap",
    "attachment_semantics_gap",
    "ranking_calibration_gap",
    "browser_resource_gap",
]
