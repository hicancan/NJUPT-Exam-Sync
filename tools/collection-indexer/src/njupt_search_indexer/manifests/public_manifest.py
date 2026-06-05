from __future__ import annotations

import os
import json
from pathlib import Path
from collections.abc import Mapping, Sequence
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[5]
ARTIFACT_ROLE_REGISTRY = REPO_ROOT / "packages" / "contracts" / "src" / "search-index" / "artifact-roles.json"


def load_artifact_roles() -> list[str]:
    payload = json.loads(ARTIFACT_ROLE_REGISTRY.read_text(encoding="utf-8"))
    if not isinstance(payload, list) or not payload or not all(isinstance(item, str) and item for item in payload):
        raise ValueError(f"invalid artifact role registry: {ARTIFACT_ROLE_REGISTRY}")
    return payload


ARTIFACT_ROLES = load_artifact_roles()


def build_public_manifest(
    *,
    generated_at: str,
    producer_ref: str,
    collection_id: str,
    upstream_generated_at: str,
    truth_counts: Mapping[str, Any],
    source_truth_counts: Mapping[str, Any],
    quality: Mapping[str, Any],
    total_documents: int,
    record_counts: Mapping[str, int],
    facet_counts: Mapping[str, int],
    first_screen_artifacts: Sequence[str],
    fast_start_artifacts: Sequence[str],
    hot_query_initial_limit: int,
    total_shards: int,
    attachment_evidence_levels: Sequence[str],
    artifacts: Mapping[str, dict[str, Any]],
    source_manifest_artifacts: Mapping[str, Any],
    source_manifest_payloads: Mapping[str, Mapping[str, Any]],
    attachment_metadata_count: int,
    external_link_count: int,
    attachment_evidence_coverage: Mapping[str, int],
) -> dict[str, Any]:
    return {
        "generated_at": generated_at,
        "strategy": "routed-verifiable-static-search",
        "producer_repo": os.environ.get("GITHUB_REPOSITORY") or "hicancan/njupt-search",
        "producer_ref": producer_ref,
        "site_id": collection_id,
        "collection_id": collection_id,
        "artifact_path": f"generated/collections/{collection_id}",
        "upstream_generated_at": upstream_generated_at,
        "truth_counts": dict(truth_counts),
        "total_documents": total_documents,
        "record_counts": dict(record_counts),
        "facet_counts": dict(facet_counts),
        "exam_vertical_preserved": True,
        "core_search": {
            "algorithm": "cost-authority planned impact-block retrieval with lazy evidence hydration and per-shard proof ledger completion",
            "execution_model": "pure_frontend_worker",
            "readiness": "routed_bootstrap",
            "legacy_global_first_screen": False,
            "first_screen_artifacts": list(first_screen_artifacts),
            "fast_start_artifacts": list(fast_start_artifacts),
            "hot_query_initial_results": hot_query_initial_limit,
            "local_index_loading": "query_planned_on_demand",
            "body_index_loading": "query_planned_on_demand",
            "full_text_loading": "lazy_candidate_hydration_then_verified_scope_scan",
            "hot_path_runtime": "stateful_rust_wasm_packed_impact_typed_scores",
            "retrieval_kernel": "rust_wasm_global_topk_pruning_v1",
            "search_worker": True,
        },
        "progressive_search": {
            "total_shards": total_shards,
            "total_documents": total_documents,
            "full_scan_supported": True,
            "progressive_events": True,
            "artifact_roles": ARTIFACT_ROLES,
        },
        "coverage_contract": {
            "states": [
                "first_trusted_results",
                "top_results_hydrated",
                "partial_verified",
                "scoped_exhaustive_complete",
                "global_exhaustive_complete",
                "cancelled",
                "error",
            ],
            "coverage_fields": ["title", "section", "nav_path", "summary", "content", "attachments", "url"],
            "attachment_evidence_levels": list(attachment_evidence_levels),
            "proof": {
                "indexed_fields": ["title", "section", "nav_path", "tags", "attachments", "external", "system", "summary", "content"],
                "full_scan_fields": ["title", "section", "nav_path", "summary", "content", "attachments", "url"],
                "complete_requires": ["scanned_shard", "hot_query_complete_certificate", "explicit_filter_exclusion", "metadata_scope_exclusion", "no_false_negative_filter_exclusion"],
                "ledger_states": ["pending", "scanned", "proved_no_match", "excluded_by_filter", "excluded_by_declared_scope", "failed"],
            },
            "total_shards": total_shards,
            "total_documents": total_documents,
        },
        "verification_contract": {
            "shard_filter_supported": True,
            "proved_skip_supported": True,
            "filter_artifact_family": "shard_filters",
            "proof_catalog_artifact_family": "proof_catalogs",
            "hot_query_proof_supported": True,
            "hot_query_proof_artifact_family": "hot_query_proofs",
            "completion_requires_ledger": True,
        },
        "routing_contract": {
            "planner": "cost_authority_proof_ledger_planner_v2",
            "directory_contains_doc_postings": False,
            "startup_loads_local_indexes": False,
            "startup_loads_full_shards": False,
            "startup_loads_global_document_metadata": False,
        },
        "cache_contract": {
            "runtime_cache": "browser_persistent_content_hash",
            "cache_key": "content_hashed_artifact_url",
            "manifest_load": "reload_for_hash_invalidation",
            "immutable_artifact_load": "persistent_cache_first_then_http_cache_then_network",
            "warm_repeat_requires_zero_uncached_immutable_reads": True,
            "manifest_hash_invalidation": "changed content-hash paths are cold misses",
        },
        "artifacts": dict(artifacts),
        "sitegraph": {
            "truth_counts": dict(truth_counts),
            "source_truth_counts": dict(source_truth_counts),
            "quality": dict(quality),
            "upstream_generated_at": upstream_generated_at,
            "detail_page_records": int(record_counts.get("detail", 0)),
            "attachment_metadata_records": attachment_metadata_count,
            "attachment_evidence_policy": "metadata_and_filename_only_no_extracted_attachment_content",
            "attachment_evidence_coverage": dict(attachment_evidence_coverage),
            "direct_attachment_records": int(record_counts.get("attachment", 0)),
            "external_link_records": external_link_count,
            "external_document_records": int(record_counts.get("external", 0)),
            "utility_link_records": int(record_counts.get("utility", 0)),
            "attachment_policy": "metadata_only",
            "external_link_policy": "record_only",
            "source_manifests": dict(source_manifest_artifacts),
            "source_manifest_summaries": {
                source_id: {
                    "doc_count": payload["doc_count"],
                    "attachment_count": payload["attachment_count"],
                    "attachment_filename_only": payload["attachment_evidence_coverage"]["filename_only"],
                    "attachment_text_extracted": payload["attachment_evidence_coverage"]["text_extracted"],
                    "attachment_full_content": payload["attachment_evidence_coverage"]["full_content"],
                    "shard_count": int(payload["artifacts"]["proof_catalog"]["count"]),
                    "local_index_count": len(payload["local_indexes"]),
                }
                for source_id, payload in source_manifest_payloads.items()
            },
            "shard_strategy": {
                "version": "locality-source-facet-record-year-section-hash-routed",
                "dimensions": ["source_id", "facet", "record_type", "year", "top_nav_section", "hash_bucket"],
                "hash_bucket_count": 4,
                "sequential_fixed_size_shards": False,
            },
            "indexes": dict(artifacts),
        },
    }
