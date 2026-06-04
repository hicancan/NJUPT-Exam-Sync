from __future__ import annotations

from pathlib import Path
from typing import Any

from ..sitegraph_artifact_io import artifact_entry, write_hashed_json
from ..sitegraph_hot_query_proofs import (
    HOT_QUERY_CERTIFICATE_MODEL,
    HOT_QUERY_COMPLETE_CERTIFICATE_VERSION,
    HOT_QUERY_COMPLETE_PROOF_MODEL,
    HOT_QUERY_FAST_START_VERSION,
    HOT_QUERY_INITIAL_CERTIFICATE_VERSION,
    HOT_QUERY_INITIAL_LIMIT,
    HOT_QUERY_RANK_EVIDENCE_MODEL,
    HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
    HOT_QUERY_TOPK_CERTIFICATE_VERSION,
    HOT_QUERY_TOPK_LIMIT,
    expand_hot_query_proof_phrases,
    hot_query_document_payload,
    hot_query_phrase_key,
    hot_query_proof_document_payload,
    hot_query_runtime_rank_score,
    hot_query_runtime_terms,
    hot_query_topk_sort_key,
)
from ..sitegraph_index_postings import exhaustive_scan_blob
from ..sitegraph_query_config import load_search_query_list_config
from ..sitegraph_text import normalize_text, sha256_text, stable_ascii_slug


HOT_QUERY_PROOF_QUERIES = load_search_query_list_config("hot-query-proof-queries.json")
HOT_QUERY_FAST_START_ONLY_QUERIES = load_search_query_list_config("hot-query-fast-start-only-queries.json")
HOT_QUERY_FAST_START_QUERIES = list(dict.fromkeys([*HOT_QUERY_PROOF_QUERIES, *HOT_QUERY_FAST_START_ONLY_QUERIES]))
HOT_QUERY_COMPLETE_NORMALIZED_QUERIES = {normalize_text(query) for query in HOT_QUERY_PROOF_QUERIES}


def build_hot_query_artifacts(
    *,
    public_root: Path,
    artifact_dir: Path,
    hot_query_proof_dir: Path,
    documents: list[dict[str, Any]],
    query_aliases: dict[str, Any],
    full_shards: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, int], dict[str, int], dict[str, int]]:
    shard_ids = [str(shard["shard_id"]) for shard in full_shards]
    shard_bytes_by_id = {str(shard["shard_id"]): int(shard.get("bytes") or 0) for shard in full_shards}
    shard_count_by_id = {str(shard["shard_id"]): int(shard.get("count") or 0) for shard in full_shards}
    certificate_entries: dict[str, dict[str, Any]] = {}
    initial_entries: dict[str, dict[str, Any]] = {}
    certificate_bytes_by_query: dict[str, int] = {}
    top_certificate_bytes_by_query: dict[str, int] = {}
    initial_certificate_bytes_by_query: dict[str, int] = {}

    for query in HOT_QUERY_FAST_START_QUERIES:
        normalized_query = normalize_text(query)
        requires_complete_proof = normalized_query in HOT_QUERY_COMPLETE_NORMALIZED_QUERIES
        match_phrases = expand_hot_query_proof_phrases(query, query_aliases)
        rank_terms = hot_query_runtime_terms(query, match_phrases)
        phrase_key = hot_query_phrase_key(match_phrases)
        matching_documents: list[dict[str, Any]] = []
        matched_shards: set[str] = set()
        for document in documents:
            blob = exhaustive_scan_blob(document)
            if not any(phrase in blob for phrase in match_phrases):
                continue
            matching_documents.append(hot_query_document_payload(document, query, match_phrases, rank_terms))
            shard = document.get("shard") if isinstance(document.get("shard"), dict) else {}
            shard_id = str(shard.get("shard_id") or "")
            if shard_id:
                matched_shards.add(shard_id)

        matched_shard_list = sorted(matched_shards)
        ranked_matching_documents = sorted(matching_documents, key=lambda document: hot_query_topk_sort_key(document, query, rank_terms))
        initial_documents = ranked_matching_documents[:HOT_QUERY_INITIAL_LIMIT]
        top_documents = ranked_matching_documents[:HOT_QUERY_TOPK_LIMIT]
        initial_document_ids = {str(document.get("id") or "") for document in initial_documents}
        top_document_ids = {str(document.get("id") or "") for document in top_documents}
        initial_matched_shards = sorted(
            {
                str((document.get("shard") or {}).get("shard_id") or "")
                for document in documents
                if str(document.get("id") or "") in initial_document_ids
                and (document.get("shard") or {}).get("shard_id")
            }
        )
        top_matched_shards = sorted(
            {
                str((document.get("shard") or {}).get("shard_id") or "")
                for document in documents
                if str(document.get("id") or "") in top_document_ids
                and (document.get("shard") or {}).get("shard_id")
            }
        )
        initial_rank_floor = min(
            (
                hot_query_runtime_rank_score(document, query, rank_terms, float(document.get("rank_base_score") or 0.0))
                for document in initial_documents
            ),
            default=0.0,
        )
        initial_tail_rank_ceiling = max(
            (
                hot_query_runtime_rank_score(document, query, rank_terms, float(document.get("rank_base_score") or 0.0))
                for document in ranked_matching_documents[HOT_QUERY_INITIAL_LIMIT:]
            ),
            default=0.0,
        )
        top_rank_floor = min(
            (
                hot_query_runtime_rank_score(document, query, rank_terms, float(document.get("rank_base_score") or 0.0))
                for document in top_documents
            ),
            default=0.0,
        )
        tail_rank_ceiling = max(
            (
                hot_query_runtime_rank_score(document, query, rank_terms, float(document.get("rank_base_score") or 0.0))
                for document in ranked_matching_documents[HOT_QUERY_TOPK_LIMIT:]
            ),
            default=0.0,
        )
        initial_certificate = {
            "version": HOT_QUERY_INITIAL_CERTIFICATE_VERSION,
            "document_payload_model": HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            "rank_evidence_model": HOT_QUERY_RANK_EVIDENCE_MODEL,
            "query": query,
            "normalized_query": normalized_query,
            "match_phrases": match_phrases,
            "rank_terms": rank_terms,
            "phrase_key": phrase_key,
            "initial_limit": HOT_QUERY_INITIAL_LIMIT,
            "top_k_limit": HOT_QUERY_INITIAL_LIMIT,
            "top_k_count": len(initial_documents),
            "match_count": len(matching_documents),
            "total_shards": len(full_shards),
            "total_documents": len(documents),
            "matched_shards": initial_matched_shards,
            "matched_shard_count": len(initial_matched_shards),
            "proved_no_match_shards": 0,
            "dominance": {
                "model": "runtime_intent_rank_desc_then_date_desc_then_id_v1",
                "top_runtime_rank_floor": round(initial_rank_floor, 4),
                "tail_runtime_rank_ceiling": round(initial_tail_rank_ceiling, 4),
                "tail_document_count": max(0, len(matching_documents) - len(initial_documents)),
                "dominates_by_runtime_rank": initial_tail_rank_ceiling <= initial_rank_floor,
            },
            "documents": initial_documents,
        }
        initial_artifact = write_hashed_json(
            public_root,
            hot_query_proof_dir,
            f"hot_query_initial.{stable_ascii_slug(normalized_query, fallback='query', max_length=48)}",
            initial_certificate,
            compact=True,
        )
        initial_entry = {
            **artifact_entry(initial_artifact, role="hot_query_top_initial", count=len(initial_documents), load="fast_start"),
            "initial_limit": HOT_QUERY_INITIAL_LIMIT,
            "top_k_limit": HOT_QUERY_INITIAL_LIMIT,
            "match_count": len(matching_documents),
        }
        initial_entries[normalized_query] = {
            "query": query,
            "normalized_query": normalized_query,
            "match_phrases": match_phrases,
            "phrase_key": phrase_key,
            "match_count": len(matching_documents),
            "initial_certificate": initial_entry,
        }
        initial_certificate_bytes_by_query[normalized_query] = int(initial_artifact["bytes"])
        if not requires_complete_proof:
            continue

        top_certificate = {
            "version": HOT_QUERY_TOPK_CERTIFICATE_VERSION,
            "document_payload_model": HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
            "rank_evidence_model": HOT_QUERY_RANK_EVIDENCE_MODEL,
            "query": query,
            "normalized_query": normalized_query,
            "match_phrases": match_phrases,
            "rank_terms": rank_terms,
            "phrase_key": phrase_key,
            "top_k_limit": HOT_QUERY_TOPK_LIMIT,
            "top_k_count": len(top_documents),
            "match_count": len(matching_documents),
            "total_shards": len(full_shards),
            "total_documents": len(documents),
            "matched_shards": top_matched_shards,
            "matched_shard_count": len(top_matched_shards),
            "proved_no_match_shards": 0,
            "dominance": {
                "model": "runtime_intent_rank_desc_then_date_desc_then_id_v1",
                "top_runtime_rank_floor": round(top_rank_floor, 4),
                "tail_runtime_rank_ceiling": round(tail_rank_ceiling, 4),
                "tail_document_count": max(0, len(matching_documents) - len(top_documents)),
                "dominates_by_runtime_rank": tail_rank_ceiling <= top_rank_floor,
            },
            "documents": top_documents,
        }
        top_artifact = write_hashed_json(
            public_root,
            hot_query_proof_dir,
            f"hot_query_topk.{stable_ascii_slug(normalized_query, fallback='query', max_length=48)}",
            top_certificate,
            compact=True,
        )
        certificate = {
            "version": HOT_QUERY_COMPLETE_CERTIFICATE_VERSION,
            "proof_payload_model": HOT_QUERY_COMPLETE_PROOF_MODEL,
            "rank_evidence_model": HOT_QUERY_RANK_EVIDENCE_MODEL,
            "query": query,
            "normalized_query": normalized_query,
            "match_phrases": match_phrases,
            "rank_terms": rank_terms,
            "phrase_key": phrase_key,
            "scan_semantics": "any normalized match phrase is substring of exhaustive_scan_blob",
            "coverage_fields": ["title", "section", "nav_path", "summary", "content", "attachments", "url"],
            "total_shards": len(full_shards),
            "total_documents": len(documents),
            "matched_shards": matched_shard_list,
            "matched_shard_count": len(matched_shard_list),
            "matched_shard_bytes": sum(shard_bytes_by_id.get(shard_id, 0) for shard_id in matched_shard_list),
            "matched_shard_document_count": sum(shard_count_by_id.get(shard_id, 0) for shard_id in matched_shard_list),
            "proved_no_match_shards": max(0, len(full_shards) - len(matched_shard_list)),
            "documents": [
                hot_query_proof_document_payload(document, query, match_phrases, rank_terms)
                for document in documents
                if any(phrase in exhaustive_scan_blob(document) for phrase in match_phrases)
            ],
            "match_count": len(matching_documents),
        }
        artifact = write_hashed_json(
            public_root,
            hot_query_proof_dir,
            f"hot_query_complete.{stable_ascii_slug(normalized_query, fallback='query', max_length=48)}",
            certificate,
            compact=True,
        )
        certificate_entries[normalized_query] = {
            **artifact_entry(artifact, role="hot_query_complete_certificate", count=len(matching_documents), load="verify"),
            "query": query,
            "normalized_query": normalized_query,
            "match_phrases": match_phrases,
            "phrase_key": phrase_key,
            "initial_certificate": initial_entry,
            "top_certificate": {
                **artifact_entry(top_artifact, role="hot_query_topk_certificate", count=len(top_documents), load="query_planned"),
                "top_k_limit": HOT_QUERY_TOPK_LIMIT,
                "match_count": len(matching_documents),
            },
            "total_shards": len(full_shards),
            "total_documents": len(documents),
            "matched_shard_count": len(matched_shard_list),
            "matched_shard_bytes": certificate["matched_shard_bytes"],
            "match_count": len(matching_documents),
        }
        certificate_bytes_by_query[normalized_query] = int(artifact["bytes"])
        top_certificate_bytes_by_query[normalized_query] = int(top_artifact["bytes"])

    for entry in list(certificate_entries.values()):
        canonical_query = str(entry["normalized_query"])
        phrase_key = str(entry["phrase_key"])
        for alias in entry.get("match_phrases") or []:
            normalized_alias = normalize_text(alias)
            if not normalized_alias or normalized_alias in certificate_entries:
                continue
            alias_phrase_key = hot_query_phrase_key(expand_hot_query_proof_phrases(alias, query_aliases))
            if alias_phrase_key != phrase_key:
                continue
            certificate_entries[normalized_alias] = {
                **entry,
                "query": str(alias),
                "alias_of": canonical_query,
            }

    for entry in list(initial_entries.values()):
        canonical_query = str(entry["normalized_query"])
        phrase_key = str(entry["phrase_key"])
        for alias in entry.get("match_phrases") or []:
            normalized_alias = normalize_text(alias)
            if not normalized_alias or normalized_alias in initial_entries:
                continue
            alias_phrase_key = hot_query_phrase_key(expand_hot_query_proof_phrases(alias, query_aliases))
            if alias_phrase_key != phrase_key:
                continue
            initial_entries[normalized_alias] = {
                **entry,
                "query": str(alias),
                "alias_of": canonical_query,
            }

    fast_start_entries: dict[str, dict[str, Any]] = {}
    for normalized_key, entry in initial_entries.items():
        initial_entry = entry.get("initial_certificate")
        if not isinstance(initial_entry, dict):
            continue
        fast_start_entries[normalized_key] = {
            "query": str(entry.get("query") or normalized_key),
            "normalized_query": normalized_key,
            "alias_of": entry.get("alias_of"),
            "phrase_key": str(entry.get("phrase_key") or ""),
            "match_count": int(entry.get("match_count") or 0),
            "initial_certificate": initial_entry,
        }
    fast_start = {
        "version": HOT_QUERY_FAST_START_VERSION,
        "scope": "global_unfiltered_queries",
        "normalization": "nfkc-lower-command-affix-v1",
        "initial_certificate_version": HOT_QUERY_INITIAL_CERTIFICATE_VERSION,
        "top_document_payload_model": HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
        "rank_evidence_model": HOT_QUERY_RANK_EVIDENCE_MODEL,
        "query_count": len(fast_start_entries),
        "queries": fast_start_entries,
    }
    fast_start_artifact = write_hashed_json(public_root, artifact_dir, "hot_query_fast_start", fast_start, compact=True)

    directory = {
        "version": "sitegraph-hot-query-complete-directory-v3",
        "certificate_model": HOT_QUERY_CERTIFICATE_MODEL,
        "complete_proof_model": HOT_QUERY_COMPLETE_PROOF_MODEL,
        "top_document_payload_model": HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
        "rank_evidence_model": HOT_QUERY_RANK_EVIDENCE_MODEL,
        "scope": "global_unfiltered_queries",
        "query_count": len(certificate_entries),
        "queries": certificate_entries,
        "total_shards": len(full_shards),
        "total_documents": len(documents),
        "shard_ids_sha256": sha256_text(",".join(shard_ids), length=32),
    }
    directory_artifact = write_hashed_json(public_root, artifact_dir, "hot_query_proof_directory", directory, compact=True)
    return {
        **artifact_entry(directory_artifact, role="hot_query_proof_directory", count=len(certificate_entries), load="verify"),
        "query_count": len(certificate_entries),
        "certificate_model": directory["certificate_model"],
    }, {
        **artifact_entry(fast_start_artifact, role="hot_query_fast_start", count=len(fast_start_entries), load="fast_start"),
        "query_count": len(fast_start_entries),
        "initial_certificate_version": HOT_QUERY_INITIAL_CERTIFICATE_VERSION,
    }, certificate_bytes_by_query, top_certificate_bytes_by_query, initial_certificate_bytes_by_query
