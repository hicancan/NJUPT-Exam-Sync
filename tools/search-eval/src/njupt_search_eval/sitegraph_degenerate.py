from __future__ import annotations

import re
import unicodedata
from datetime import datetime
from typing import Any


def normalize_degenerate_query(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower()
    return re.sub(r"\s+", "", text)


def is_degenerate_query(query: str) -> bool:
    return len(normalize_degenerate_query(query.strip())) < 2


def empty_cache_stats() -> dict[str, Any]:
    return {
        "scope": "memory_content_hash",
        "artifact_hits": 0,
        "artifact_misses": 0,
        "cached_bytes": 0,
        "uncached_bytes": 0,
        "cacheable_bytes": 0,
        "memory_hits": 0,
        "persistent_hits": 0,
        "network_misses": 0,
    }


def degenerate_noop_result(query: str, started_at: datetime) -> dict[str, Any]:
    cache = empty_cache_stats()
    complete_coverage = {
        "phase": "global_exhaustive_complete",
        "coverage_state": "global_exhaustive_complete",
        "scope": "global",
        "searched_fields": [],
        "proved_no_match_shards": 0,
        "scanned_shards": 0,
        "excluded_by_filter_shards": 0,
        "excluded_by_declared_scope_shards": 0,
        "pending_shards": 0,
        "failed_shards": 0,
        "total_shards": 0,
        "searched_documents": 0,
        "total_documents": 0,
        "loaded_bytes": 0,
        "uncached_loaded_bytes": 0,
        "cached_artifact_bytes": 0,
        "first_screen_bytes": 0,
        "local_index_bytes": 0,
        "hydrated_shard_bytes": 0,
        "used_body_index": False,
        "exhaustive_complete": True,
        "proof_ledger": {
            "total_shards": 0,
            "pending_shards": 0,
            "scanned_shards": 0,
            "proved_no_match_shards": 0,
            "excluded_by_filter_shards": 0,
            "excluded_by_declared_scope_shards": 0,
            "failed_shards": 0,
            "complete": True,
        },
        "cache": cache,
    }
    plan = {
        "normalized_query": normalize_degenerate_query(query),
        "aliases": [],
        "intent": "degenerate_query_noop",
        "authority_sources": [],
        "expected_result_types": [],
        "source_ids": [],
        "local_index_ids": [],
        "verification_source_ids": [],
        "declared_completion_scope": "global",
        "estimated_cost_bytes": 0,
        "estimated_utility_per_kb": 0,
        "route_decisions": [],
        "selected_local_indexes": [],
        "phase_local_index_ids": {
            "first_trusted_results": [],
            "top_results_hydrated": [],
            "proof_complete": [],
        },
    }
    return {
        "results": [],
        "stats": {
            "started_at": started_at.isoformat(),
            "used_body_index": False,
            "loaded_shard_count": 0,
            "loaded_shard_paths": [],
            "loaded_local_index_count": 0,
            "loaded_local_index_ids": [],
            "local_index_bytes": 0,
            "hydrated_shard_bytes": 0,
            "uncached_loaded_bytes": 0,
            "cached_artifact_bytes": 0,
            "cache": cache,
            "candidate_count": 0,
            "quick_result_count": 0,
            "quick_results": [],
            "candidate_shard_count": 0,
            "phase_coverages": {
                "first_trusted_results": complete_coverage,
                "top_results_hydrated": complete_coverage,
                "proof_complete": complete_coverage,
            },
            "phase_timings_ms": {
                "first_trusted_results": 0.0,
                "top_results_hydrated": 0.0,
                "proof_complete": 0.0,
            },
            "coverage": complete_coverage,
            "proved_no_match_shards": 0,
            "scanned_shards": 0,
            "verified_full_scan_matches": 0,
            "proof_scan_pressure": {
                "true_match_shards": 0,
                "false_positive_shards": 0,
                "true_match_bytes": 0,
                "false_positive_bytes": 0,
                "true_match_docs": 0,
                "false_positive_scan_ratio": 0.0,
                "false_positive_byte_ratio": 0.0,
            },
            "local_meta_fallback_documents": 0,
            "exhaustive_complete": True,
            "result_count": 0,
            "query_class": "degenerate",
            "plan": plan,
            "retrieval": {
                "dynamic_pruning": False,
                "engine": "rust_wasm_packed_impact",
                "impact_blocks_visited": 0,
                "impact_blocks_pruned": 0,
                "postings_visited": 0,
                "postings_pruned": 0,
                "competitive_threshold": 0,
                "wasm_calls": 0,
                "typescript_calls": 0,
                "score_entries_returned": 0,
            },
        },
    }
