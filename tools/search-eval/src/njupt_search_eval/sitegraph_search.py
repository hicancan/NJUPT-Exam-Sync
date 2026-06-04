from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from .runtime_mirror.cache_io import (
    body_index_artifact,
    first_screen_bytes,
    light_index_artifact,
    load_index,
    load_local_body,
    load_local_light,
    load_shard,
    load_shard_filter,
    load_source_manifest,
    reset_cache_stats,
    select_local_refs_within_budget,
    unique_local_refs,
)
from .runtime_mirror.config import (
    BASE_DIR,
    BODY_SEARCH_FIELDS,
    DEFAULT_MAX_SHARD_LOADS,
    DYNAMIC_HIGH_DF_NORMALIZED_QUERIES,
    FIRST_TRUSTED_HYDRATION_RESERVE_BYTES,
    FIRST_TRUSTED_MAX_UNCACHED_BYTES,
    FULL_SCAN_FIELDS,
    HIGH_DF_FIRST_TRUSTED_LOCAL_INDEX_BYTES,
    HIGH_DF_MIN_FIRST_TRUSTED_LOCAL_INDEXES,
    HIGH_DF_MIN_TOP_RESULTS_LOCAL_INDEXES,
    HIGH_DF_TOP_RESULTS_LOCAL_INDEX_BYTES,
    LIGHT_SEARCH_FIELDS,
    MIN_FIRST_TRUSTED_LOCAL_INDEXES,
    MIN_TOP_RESULTS_LOCAL_INDEXES,
    PUBLIC_INDEX_DIR,
    PUBLIC_ROOT,
    TOP_RESULTS_HYDRATION_RESERVE_BYTES,
    TOP_RESULTS_MAX_UNCACHED_BYTES,
)
from .runtime_mirror.planning import build_plan, select_local_refs
from .runtime_mirror.proof import (
    coverage,
    full_scan_matches,
    local_shard_maps,
    proof_catalog_shards,
    shard_filter_proves_no_match,
    shard_path_for_meta,
)
from .runtime_mirror.ranking import (
    apply_impact_index,
    hot_query_rank_base_score,
    rank_document,
    sorted_ranked,
    text_blob,
)
from .runtime_mirror.text import expand_query_phrases, normalize_text, tokens_for_query
from .sitegraph_degenerate import degenerate_noop_result, is_degenerate_query
from .sitegraph_hot_query_eval import (
    matching_hot_query_fast_start,
    matching_hot_query_proof,
    matching_hot_query_top_proof,
)


def recall_documents_with_stats(
    query: str,
    *,
    limit: int = 20,
    candidate_limit: int = 160,
    max_shard_loads: int = DEFAULT_MAX_SHARD_LOADS,
    index: dict[str, Any] | None = None,
) -> dict[str, Any]:
    index = index if index is not None else load_index()
    reset_cache_stats(index)
    started_at = datetime.now(timezone.utc)
    started_perf = math.nan
    try:
        import time

        started_perf = time.perf_counter()
    except Exception:
        started_perf = math.nan
    if is_degenerate_query(query):
        return degenerate_noop_result(query, started_at)
    terms = tokens_for_query(query, index["aliases"])
    match_phrases = expand_query_phrases(query, index["aliases"])
    plan = build_plan(index, query, terms)
    high_df_dynamic_query = str(plan["normalized_query"]) in DYNAMIC_HIGH_DF_NORMALIZED_QUERIES
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
    source_manifests, local_refs, source_manifest_bytes = select_local_refs(index, plan, terms)
    shard_path_by_id, shard_bytes_by_path = local_shard_maps(local_refs, source_manifests)
    first_local_budget_base = max(
        0,
        FIRST_TRUSTED_MAX_UNCACHED_BYTES
        - first_screen_bytes(index)
        - source_manifest_bytes
        - FIRST_TRUSTED_HYDRATION_RESERVE_BYTES,
    )
    first_local_budget = min(first_local_budget_base, HIGH_DF_FIRST_TRUSTED_LOCAL_INDEX_BYTES) if high_df_dynamic_query else first_local_budget_base
    first_phase_refs = [] if hot_initial_certificate is not None else select_local_refs_within_budget(
        local_refs,
        first_local_budget,
        lambda ref: int(light_index_artifact(ref)["bytes"]),
        HIGH_DF_MIN_FIRST_TRUSTED_LOCAL_INDEXES if high_df_dynamic_query else MIN_FIRST_TRUSTED_LOCAL_INDEXES,
    )
    top_local_budget_base = max(
        0,
        TOP_RESULTS_MAX_UNCACHED_BYTES
        - first_screen_bytes(index)
        - source_manifest_bytes
        - TOP_RESULTS_HYDRATION_RESERVE_BYTES,
    )
    top_local_budget = min(top_local_budget_base, HIGH_DF_TOP_RESULTS_LOCAL_INDEX_BYTES) if high_df_dynamic_query else top_local_budget_base
    top_phase_refs = unique_local_refs(
        [
            *first_phase_refs,
            *select_local_refs_within_budget(
                local_refs,
                top_local_budget,
                lambda ref: int(light_index_artifact(ref)["bytes"]) + int(body_index_artifact(ref)["bytes"]),
                HIGH_DF_MIN_TOP_RESULTS_LOCAL_INDEXES if high_df_dynamic_query else MIN_TOP_RESULTS_LOCAL_INDEXES,
            ),
        ]
    )
    plan["phase_local_index_ids"] = {
        "first_trusted_results": [str(ref["index_id"]) for ref in first_phase_refs],
        "top_results_hydrated": [str(ref["index_id"]) for ref in top_phase_refs],
        "proof_complete": [str(ref["index_id"]) for ref in local_refs],
    }

    docs_by_index: dict[int, dict[str, Any]] = {}
    scores: dict[int, float] = {}
    retrieval = {
        "dynamic_pruning": False,
        "impact_blocks_visited": 0,
        "impact_blocks_pruned": 0,
        "postings_visited": 0,
        "postings_pruned": 0,
        "competitive_threshold": 0.0,
    }
    local_index_bytes = source_manifest_bytes
    loaded_local_index_ids: set[str] = set()
    for ref in first_phase_refs:
        local_index = load_local_light(index, ref, terms)
        local_index_bytes += int(light_index_artifact(ref)["bytes"])
        loaded_local_index_ids.add(str(ref["index_id"]))
        for document in local_index.get("documents", []):
            docs_by_index[int(document["doc_index"])] = document
        apply_impact_index(scores, local_index.get("terms", {}), terms, retrieval, candidate_limit)

    normalized_query = normalize_text(query)
    local_meta_fallbacks = 0
    if len(scores) < 8:
        for meta in docs_by_index.values():
            haystack = text_blob(meta, "title", "section", "nav_path_text")
            if normalized_query and normalized_query in haystack:
                index_id = int(meta["doc_index"])
                scores[index_id] = scores.get(index_id, 0.0) + 90.0
                local_meta_fallbacks += 1

    def select_candidates(limit_count: int, shard_limit: int) -> tuple[list[int], set[str]]:
        selected: list[int] = []
        paths: set[str] = set()
        for doc_index, _ in sorted(scores.items(), key=lambda item: (-item[1], item[0]))[:limit_count]:
            meta = docs_by_index.get(doc_index)
            if not meta:
                continue
            path = shard_path_for_meta(meta, shard_path_by_id)
            is_new_shard = bool(path) and path not in paths
            if is_new_shard and len(paths) >= shard_limit:
                continue
            selected.append(doc_index)
            if is_new_shard:
                paths.add(path)
        return selected, paths

    def load_shards_for_paths(paths: set[str]) -> dict[int, dict[str, Any]]:
        docs: dict[int, dict[str, Any]] = {}
        for path in paths:
            for document in load_shard(index, path, shard_bytes_by_path.get(path, 0)):
                docs[int(document["doc_index"])] = document
        return docs

    if hot_initial_coverage is not None:
        quick_indices: list[int] = []
        loaded_paths: set[str] = set()
        quick_docs: dict[int, dict[str, Any]] = {}
        quick_ranked = hot_initial_ranked
        first_trusted_coverage = hot_initial_coverage
    else:
        quick_indices, quick_paths = select_candidates(min(candidate_limit, 48), min(max_shard_loads, 8))
        loaded_paths = set(quick_paths)
        quick_docs = load_shards_for_paths(quick_paths)
        quick_ranked = sorted_ranked([
            rank_document(quick_docs[doc_index], query, terms, scores.get(doc_index, 0.0))
            for doc_index in quick_indices
            if doc_index in quick_docs and full_scan_matches(quick_docs[doc_index], match_phrases)
        ])
        quick_hydrated_shard_bytes = sum(shard_bytes_by_path.get(path, 0) for path in loaded_paths)
        if math.isfinite(started_perf):
            import time

            phase_timings_ms["first_trusted_results"] = round((time.perf_counter() - started_perf) * 1000, 3)
        first_trusted_coverage = coverage(
            index,
            phase="first_trusted_results",
            fields=LIGHT_SEARCH_FIELDS,
            proved_no_match_shards=0,
            scanned_shards=len(loaded_paths),
            searched_documents=len(quick_docs),
            total_shards=int(index["manifest"]["progressive_search"]["total_shards"]),
            total_documents=int(index["manifest"]["progressive_search"]["total_documents"]),
            loaded_paths=loaded_paths,
            local_index_bytes=local_index_bytes,
            hydrated_shard_bytes=quick_hydrated_shard_bytes,
            filter_bytes=0,
            used_body_index=False,
            exhaustive_complete=False,
        )

    used_body_index = False
    for ref in top_phase_refs:
        if str(ref["index_id"]) not in loaded_local_index_ids:
            local_index = load_local_light(index, ref, terms)
            local_index_bytes += int(light_index_artifact(ref)["bytes"])
            loaded_local_index_ids.add(str(ref["index_id"]))
            for document in local_index.get("documents", []):
                docs_by_index[int(document["doc_index"])] = document
            apply_impact_index(scores, local_index.get("terms", {}), terms, retrieval, candidate_limit)
        body_artifact = body_index_artifact(ref)
        body_index = load_local_body(index, ref, terms)
        local_index_bytes += int(body_artifact.get("bytes") or 0)
        apply_impact_index(scores, body_index.get("terms", {}), terms, retrieval, candidate_limit)
        used_body_index = True

    selected_candidate_indices, candidate_paths = select_candidates(candidate_limit, min(max_shard_loads, 18))
    new_candidate_paths = candidate_paths - loaded_paths
    loaded_paths |= candidate_paths
    full_docs = {**quick_docs, **load_shards_for_paths(new_candidate_paths)}
    ranked_by_id: dict[str, dict[str, Any]] = {
        str(item["id"]): item
        for item in quick_ranked
    }
    for doc_index in selected_candidate_indices:
        if doc_index not in full_docs or not full_scan_matches(full_docs[doc_index], match_phrases):
            continue
        item = rank_document(full_docs[doc_index], query, terms, scores.get(doc_index, 0.0))
        existing = ranked_by_id.get(str(item["id"]))
        if existing is None or float(item["score"]) > float(existing.get("score") or 0):
            ranked_by_id[str(item["id"])] = item
    top_hydrated_shard_bytes = sum(shard_bytes_by_path.get(path, 0) for path in loaded_paths)
    if math.isfinite(started_perf):
        import time

        phase_timings_ms["top_results_hydrated"] = round((time.perf_counter() - started_perf) * 1000, 3)
    top_results_coverage = coverage(
        index,
        phase="top_results_hydrated",
        fields=BODY_SEARCH_FIELDS,
        proved_no_match_shards=0,
        scanned_shards=len(loaded_paths),
        searched_documents=len(full_docs),
        total_shards=int(index["manifest"]["progressive_search"]["total_shards"]),
        total_documents=int(index["manifest"]["progressive_search"]["total_documents"]),
        loaded_paths=loaded_paths,
        local_index_bytes=local_index_bytes,
        hydrated_shard_bytes=top_hydrated_shard_bytes,
        filter_bytes=0,
        used_body_index=used_body_index,
        exhaustive_complete=False,
    )

    hot_query_proof = matching_hot_query_proof(index, query, match_phrases)
    if hot_query_proof is not None:
        certificate, filter_bytes = hot_query_proof
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
        matched_shard_count = int(certificate.get("matched_shard_count") or 0)
        total_certificate_shards = int(certificate.get("total_shards") or index["manifest"]["progressive_search"]["total_shards"])
        proved_no_match_shards = max(0, total_certificate_shards - matched_shard_count)
        hydrated_shard_bytes = sum(shard_bytes_by_path.get(path, 0) for path in loaded_paths)
        final_coverage = coverage(
            index,
            phase="global_exhaustive_complete",
            fields=FULL_SCAN_FIELDS,
            proved_no_match_shards=proved_no_match_shards,
            scanned_shards=matched_shard_count,
            searched_documents=verified_matches,
            total_shards=total_certificate_shards,
            total_documents=int(certificate.get("total_documents") or index["manifest"]["progressive_search"]["total_documents"]),
            loaded_paths=loaded_paths,
            local_index_bytes=local_index_bytes,
            hydrated_shard_bytes=hydrated_shard_bytes,
            filter_bytes=filter_bytes,
            used_body_index=used_body_index,
            exhaustive_complete=True,
        )
        if math.isfinite(started_perf):
            import time

            phase_timings_ms["proof_complete"] = round((time.perf_counter() - started_perf) * 1000, 3)
        return {
            "results": ranked[:limit],
            "stats": {
                "started_at": started_at.isoformat(),
                "used_body_index": used_body_index,
                "loaded_shard_count": len(loaded_paths),
                "loaded_shard_paths": sorted(loaded_paths),
                "loaded_local_index_count": len(loaded_local_index_ids),
                "loaded_local_index_ids": sorted(loaded_local_index_ids),
                "local_index_bytes": local_index_bytes,
                "hydrated_shard_bytes": hydrated_shard_bytes,
                "uncached_loaded_bytes": final_coverage["uncached_loaded_bytes"],
                "cached_artifact_bytes": final_coverage["cached_artifact_bytes"],
                "cache": final_coverage["cache"],
                "candidate_count": len(selected_candidate_indices),
                "quick_result_count": len(quick_ranked),
                "quick_results": quick_ranked[:limit],
                "coverage": final_coverage,
                "candidate_shard_count": len(candidate_paths),
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
                    "certificate_bytes": filter_bytes,
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
                "local_meta_fallback_documents": local_meta_fallbacks,
                "hot_query_initial_certificate": hot_initial_stats,
                "hot_query_complete_certificate": {
                    "used": True,
                    "query": certificate.get("query"),
                    "match_count": int(certificate.get("match_count") or 0),
                    "verified_match_count": verified_matches,
                    "matched_shard_count": matched_shard_count,
                    "matched_shard_bytes_avoided": int(certificate.get("matched_shard_bytes") or 0),
                    "certificate_bytes": filter_bytes,
                },
            },
        }

    verification_manifests = [
        source_manifest
        for source in index["source_registry"]["sources"]
        if (source_manifest := load_source_manifest(index, str(source["source_id"]))) is not None
    ]
    in_scope_shards = proof_catalog_shards(index, verification_manifests)
    shard_filters = {
        str(source_manifest["source_id"]): load_shard_filter(index, source_manifest)
        for source_manifest in verification_manifests
    }
    filter_bytes = sum(
        int(source_manifest["artifacts"]["proof_catalog"]["bytes"]) + int(source_manifest["artifacts"]["shard_filter"]["bytes"])
        for source_manifest in verification_manifests
    )
    proved_no_match_shards = 0
    scanned_shards = 0
    searched_documents = 0
    verified_matches = 0
    proof_true_match_shards = 0
    proof_false_positive_shards = 0
    proof_true_match_bytes = 0
    proof_false_positive_bytes = 0
    for shard in in_scope_shards:
        shard_id = str(shard["shard_id"])
        source_id = str(shard.get("source_id") or "")
        if shard_filter_proves_no_match(shard_id, shard_filters.get(source_id, {}), match_phrases):
            proved_no_match_shards += 1
            continue
        path = str(shard["path"])
        loaded_paths.add(path)
        shard_bytes_by_path[path] = int(shard["bytes"])
        scanned_shards += 1
        shard_had_match = False
        for document in load_shard(index, path, int(shard["bytes"])):
            searched_documents += 1
            doc_index = int(document["doc_index"])
            if full_scan_matches(document, match_phrases):
                shard_had_match = True
                verified_matches += 1
                base_score = scores.get(doc_index)
                if base_score is None and isinstance(document.get("rank_base_score"), int | float):
                    base_score = hot_query_rank_base_score(document)
                item = rank_document(document, query, terms, base_score if base_score is not None else 24.0)
                existing = ranked_by_id.get(str(item["id"]))
                if existing is None or float(item["score"]) > float(existing.get("score") or 0):
                    ranked_by_id[str(item["id"])] = item
        if shard_had_match:
            proof_true_match_shards += 1
            proof_true_match_bytes += int(shard["bytes"])
        else:
            proof_false_positive_shards += 1
            proof_false_positive_bytes += int(shard["bytes"])

    ranked = sorted_ranked(list(ranked_by_id.values()))
    hydrated_shard_bytes = sum(shard_bytes_by_path.get(path, 0) for path in loaded_paths)
    final_coverage = coverage(
        index,
        phase="global_exhaustive_complete",
        fields=FULL_SCAN_FIELDS,
        proved_no_match_shards=proved_no_match_shards,
        scanned_shards=scanned_shards,
        searched_documents=searched_documents,
        total_shards=len(in_scope_shards),
        total_documents=sum(int(shard["count"]) for shard in in_scope_shards),
        loaded_paths=loaded_paths,
        local_index_bytes=local_index_bytes,
        hydrated_shard_bytes=hydrated_shard_bytes,
        filter_bytes=filter_bytes,
        used_body_index=used_body_index,
        exhaustive_complete=True,
    )
    if math.isfinite(started_perf):
        import time

        phase_timings_ms["proof_complete"] = round((time.perf_counter() - started_perf) * 1000, 3)
    return {
        "results": ranked[:limit],
        "stats": {
            "started_at": started_at.isoformat(),
            "used_body_index": used_body_index,
            "loaded_shard_count": len(loaded_paths),
            "loaded_shard_paths": sorted(loaded_paths),
            "loaded_local_index_count": len(loaded_local_index_ids),
            "loaded_local_index_ids": sorted(loaded_local_index_ids),
            "local_index_bytes": local_index_bytes,
            "hydrated_shard_bytes": hydrated_shard_bytes,
            "uncached_loaded_bytes": final_coverage["uncached_loaded_bytes"],
            "cached_artifact_bytes": final_coverage["cached_artifact_bytes"],
            "cache": final_coverage["cache"],
            "candidate_count": len(selected_candidate_indices),
            "quick_result_count": len(quick_ranked),
            "quick_results": quick_ranked[:limit],
            "candidate_shard_count": len(candidate_paths),
            "phase_coverages": {
                "first_trusted_results": first_trusted_coverage,
                "top_results_hydrated": top_results_coverage,
                "proof_complete": final_coverage,
            },
            "phase_timings_ms": phase_timings_ms,
            "coverage": final_coverage,
            "proved_no_match_shards": proved_no_match_shards,
            "scanned_shards": scanned_shards,
            "verified_full_scan_matches": verified_matches,
            "proof_scan_pressure": {
                "true_match_shards": proof_true_match_shards,
                "false_positive_shards": proof_false_positive_shards,
                "true_match_bytes": proof_true_match_bytes,
                "false_positive_bytes": proof_false_positive_bytes,
                "true_match_docs": verified_matches,
                "false_positive_scan_ratio": round(proof_false_positive_shards / scanned_shards, 6) if scanned_shards else 0.0,
                "false_positive_byte_ratio": round(proof_false_positive_bytes / (proof_true_match_bytes + proof_false_positive_bytes), 6)
                if proof_true_match_bytes + proof_false_positive_bytes
                else 0.0,
            },
            "local_meta_fallback_documents": local_meta_fallbacks,
            "exhaustive_complete": True,
            "plan": plan,
            "retrieval": retrieval,
            "hot_query_initial_certificate": hot_initial_stats,
        },
    }


def recall_documents(
    query: str,
    *,
    limit: int = 20,
    candidate_limit: int = 120,
    max_shard_loads: int = DEFAULT_MAX_SHARD_LOADS,
) -> list[dict[str, Any]]:
    return recall_documents_with_stats(
        query,
        limit=limit,
        candidate_limit=candidate_limit,
        max_shard_loads=max_shard_loads,
    )["results"]
