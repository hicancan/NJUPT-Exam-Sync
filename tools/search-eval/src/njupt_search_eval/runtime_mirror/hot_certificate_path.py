from __future__ import annotations

import math
from datetime import datetime
from typing import Any

from .config import BODY_SEARCH_FIELDS, FULL_SCAN_FIELDS
from .proof import coverage, full_scan_matches
from .ranking import hot_query_rank_base_score, rank_document, sorted_ranked
from ..sitegraph_hot_query_eval import (
    matching_hot_query_fast_start,
    matching_hot_query_proof,
    matching_hot_query_top_proof,
)


def try_hot_certificate_path(
    *,
    index: dict[str, Any],
    query: str,
    limit: int,
    terms: list[str],
    match_phrases: list[str],
    plan: dict[str, Any],
    started_at: datetime,
    started_perf: float,
) -> dict[str, Any]:
    phase_timings_ms: dict[str, float] = {}
    hot_initial_certificate: dict[str, Any] | None = None
    hot_initial_stats: dict[str, Any] = {"used": False}
    hot_initial_ranked: list[dict[str, Any]] = []
    hot_initial_coverage: dict[str, Any] | None = None
    hot_initial_proof = matching_hot_query_fast_start(index, query, match_phrases)
    if hot_initial_proof is not None:
        hot_initial_certificate, initial_filter_bytes = hot_initial_proof
        initial_match_phrases = [str(item) for item in hot_initial_certificate.get("match_phrases") or []]
        initial_documents = [
            document
            for document in hot_initial_certificate.get("documents", [])
            if isinstance(document, dict) and full_scan_matches(document, initial_match_phrases)
        ]
        if len(initial_documents) != len(hot_initial_certificate.get("documents") or []) or len(initial_documents) != int(hot_initial_certificate.get("top_k_count") or 0):
            raise ValueError(f"hot query initial certificate failed self-check: {query}")
        hot_initial_ranked = sorted_ranked([
            rank_document(document, query, terms, hot_query_rank_base_score(document))
            for document in initial_documents
        ])
        if math.isfinite(started_perf):
            import time

            phase_timings_ms["first_trusted_results"] = round((time.perf_counter() - started_perf) * 1000, 3)
        hot_initial_coverage = coverage(
            index,
            phase="first_trusted_results",
            fields=BODY_SEARCH_FIELDS,
            proved_no_match_shards=0,
            scanned_shards=int(hot_initial_certificate.get("matched_shard_count") or 0),
            searched_documents=len(initial_documents),
            total_shards=int(hot_initial_certificate.get("total_shards") or index["manifest"]["progressive_search"]["total_shards"]),
            total_documents=int(hot_initial_certificate.get("total_documents") or index["manifest"]["progressive_search"]["total_documents"]),
            loaded_paths=set(),
            local_index_bytes=0,
            hydrated_shard_bytes=0,
            filter_bytes=initial_filter_bytes,
            used_body_index=False,
            exhaustive_complete=False,
        )
        hot_initial_stats = {
            "used": True,
            "query": hot_initial_certificate.get("query"),
            "top_k_count": len(initial_documents),
            "match_count": int(hot_initial_certificate.get("match_count") or 0),
            "certificate_bytes": initial_filter_bytes,
            "dominance": hot_initial_certificate.get("dominance") or {},
        }
    hot_top_proof = matching_hot_query_top_proof(index, query, match_phrases)
    if hot_top_proof is not None:
        top_certificate, _entry, top_filter_bytes = hot_top_proof
        top_match_phrases = [str(item) for item in top_certificate.get("match_phrases") or []]
        top_documents = [
            document
            for document in top_certificate.get("documents", [])
            if isinstance(document, dict) and full_scan_matches(document, top_match_phrases)
        ]
        if len(top_documents) != len(top_certificate.get("documents") or []) or len(top_documents) != int(top_certificate.get("top_k_count") or 0):
            raise ValueError(f"hot query top-k proof certificate failed self-check: {query}")
        top_ranked = sorted_ranked([
            rank_document(document, query, terms, hot_query_rank_base_score(document))
            for document in top_documents
        ])
        ranked_by_id: dict[str, dict[str, Any]] = {str(item["id"]): item for item in top_ranked}
        plan["selected_local_indexes"] = []
        plan["phase_local_index_ids"] = {
            "first_trusted_results": [],
            "top_results_hydrated": [],
            "proof_complete": [],
        }
        plan["estimated_cost_bytes"] = top_filter_bytes
        if math.isfinite(started_perf):
            import time

            elapsed = round((time.perf_counter() - started_perf) * 1000, 3)
            phase_timings_ms["top_results_hydrated"] = elapsed
        total_certificate_shards = int(top_certificate.get("total_shards") or index["manifest"]["progressive_search"]["total_shards"])
        total_certificate_documents = int(top_certificate.get("total_documents") or index["manifest"]["progressive_search"]["total_documents"])
        top_matched_shards = int(top_certificate.get("matched_shard_count") or 0)
        first_trusted_coverage = hot_initial_coverage or coverage(
            index,
            phase="first_trusted_results",
            fields=BODY_SEARCH_FIELDS,
            proved_no_match_shards=0,
            scanned_shards=top_matched_shards,
            searched_documents=len(top_documents),
            total_shards=total_certificate_shards,
            total_documents=total_certificate_documents,
            loaded_paths=set(),
            local_index_bytes=0,
            hydrated_shard_bytes=0,
            filter_bytes=top_filter_bytes,
            used_body_index=False,
            exhaustive_complete=False,
        )
        top_results_coverage = coverage(
            index,
            phase="top_results_hydrated",
            fields=BODY_SEARCH_FIELDS,
            proved_no_match_shards=0,
            scanned_shards=top_matched_shards,
            searched_documents=len(top_documents),
            total_shards=total_certificate_shards,
            total_documents=total_certificate_documents,
            loaded_paths=set(),
            local_index_bytes=0,
            hydrated_shard_bytes=0,
            filter_bytes=top_filter_bytes,
            used_body_index=False,
            exhaustive_complete=False,
        )
        hot_query_proof = matching_hot_query_proof(index, query, match_phrases)
        if hot_query_proof is None:
            raise ValueError(f"hot query top-k proof is missing complete certificate: {query}")
        certificate, complete_filter_bytes = hot_query_proof
        certificate_documents = [
            document
            for document in certificate.get("documents", [])
            if isinstance(document, dict)
            and isinstance(document.get("match_evidence"), dict)
            and isinstance(document.get("rank_base_score"), int | float)
        ]
        verified_matches = len(certificate_documents)
        if verified_matches != int(certificate.get("match_count") or 0):
            raise ValueError(f"hot query complete proof certificate match count mismatch: {query}")
        ranked = sorted_ranked(list(ranked_by_id.values()))
        directory_bytes = int(((index.get("manifest", {}).get("artifacts", {}) or {}).get("hot_query_proof_directory") or {}).get("bytes") or 0)
        filter_bytes = top_filter_bytes + max(0, complete_filter_bytes - directory_bytes)
        matched_shard_count = int(certificate.get("matched_shard_count") or 0)
        total_certificate_shards = int(certificate.get("total_shards") or index["manifest"]["progressive_search"]["total_shards"])
        proved_no_match_shards = max(0, total_certificate_shards - matched_shard_count)
        final_coverage = coverage(
            index,
            phase="global_exhaustive_complete",
            fields=FULL_SCAN_FIELDS,
            proved_no_match_shards=proved_no_match_shards,
            scanned_shards=matched_shard_count,
            searched_documents=verified_matches,
            total_shards=total_certificate_shards,
            total_documents=int(certificate.get("total_documents") or index["manifest"]["progressive_search"]["total_documents"]),
            loaded_paths=set(),
            local_index_bytes=0,
            hydrated_shard_bytes=0,
            filter_bytes=filter_bytes,
            used_body_index=False,
            exhaustive_complete=True,
        )
        if math.isfinite(started_perf):
            import time

            phase_timings_ms["proof_complete"] = round((time.perf_counter() - started_perf) * 1000, 3)
        retrieval = {
            "dynamic_pruning": False,
            "impact_blocks_visited": 0,
            "impact_blocks_pruned": 0,
            "postings_visited": 0,
            "postings_pruned": 0,
            "competitive_threshold": 0.0,
        }
        return {
            "results": ranked[:limit],
            "stats": {
                "started_at": started_at.isoformat(),
                "used_body_index": False,
                "loaded_shard_count": 0,
                "loaded_shard_paths": [],
                "loaded_local_index_count": 0,
                "loaded_local_index_ids": [],
                "local_index_bytes": 0,
                "hydrated_shard_bytes": 0,
                "uncached_loaded_bytes": final_coverage["uncached_loaded_bytes"],
                "cached_artifact_bytes": final_coverage["cached_artifact_bytes"],
                "cache": final_coverage["cache"],
                "candidate_count": len(top_documents),
                "quick_result_count": len(top_ranked),
                "quick_results": top_ranked[:limit],
                "coverage": final_coverage,
                "candidate_shard_count": 0,
                "phase_coverages": {
                    "first_trusted_results": first_trusted_coverage,
                    "top_results_hydrated": top_results_coverage,
                    "proof_complete": final_coverage,
                },
                "phase_timings_ms": phase_timings_ms,
                "plan": plan,
                "proved_no_match_shards": proved_no_match_shards,
                "scanned_shards": matched_shard_count,
                "total_shards": total_certificate_shards,
                "verified_full_scan_matches": 0,
                "proof_scan_pressure": {
                    "certificate_used": True,
                    "certificate_bytes": complete_filter_bytes,
                    "topk_certificate_bytes": top_filter_bytes,
                    "true_match_shards": matched_shard_count,
                    "false_positive_shards": 0,
                    "true_match_bytes": 0,
                    "false_positive_bytes": 0,
                    "true_match_docs": verified_matches,
                    "matched_shard_bytes_avoided": int(certificate.get("matched_shard_bytes") or 0),
                    "false_positive_scan_ratio": 0.0,
                    "false_positive_byte_ratio": 0.0,
                },
                "exhaustive_complete": True,
                "result_count": int(certificate.get("match_count") or len(ranked)),
                "retrieval": retrieval,
                "local_meta_fallback_documents": 0,
                "hot_query_initial_certificate": hot_initial_stats,
                "hot_query_topk_certificate": {
                    "used": True,
                    "query": top_certificate.get("query"),
                    "top_k_count": len(top_documents),
                    "match_count": int(top_certificate.get("match_count") or 0),
                    "certificate_bytes": top_filter_bytes,
                    "dominance": top_certificate.get("dominance") or {},
                },
                "hot_query_complete_certificate": {
                    "used": True,
                    "query": certificate.get("query"),
                    "match_count": int(certificate.get("match_count") or 0),
                    "verified_match_count": verified_matches,
                    "matched_shard_count": matched_shard_count,
                    "matched_shard_bytes_avoided": int(certificate.get("matched_shard_bytes") or 0),
                    "certificate_bytes": complete_filter_bytes,
                },
            },
        }
    return {
        "phase_timings_ms": phase_timings_ms,
        "hot_initial_certificate": hot_initial_certificate,
        "hot_initial_stats": hot_initial_stats,
        "hot_initial_ranked": hot_initial_ranked,
        "hot_initial_coverage": hot_initial_coverage,
    }
