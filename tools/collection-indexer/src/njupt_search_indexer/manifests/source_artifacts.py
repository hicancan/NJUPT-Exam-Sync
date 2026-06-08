from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from ..artifacts.chunked_json import chunked_list_payloads, write_chunked_list_entry, write_chunked_mapping_entry
from ..sitegraph_artifact_io import artifact_entry, write_hashed_json
from ..sitegraph_documents import site_display_name
from ..sitegraph_shards import shard_year
from ..sitegraph_source import document_source_id, package_source_domain, package_source_id, source_field_counts
from ..sitegraph_text import clean_text


ATTACHMENT_EVIDENCE_LEVELS = ("metadata_only", "filename_only", "text_extracted", "snippet", "full_content")
PROOF_CATALOG_VERSION = "sitegraph-proof-ledger-catalog-v2"
PROOF_CATALOG_PARTS_VERSION = "sitegraph-proof-ledger-catalog-parts-v1"
PROOF_CATALOG_PART_VERSION = "sitegraph-proof-ledger-catalog-part-v1"

SOURCE_AUTHORITY: dict[str, dict[str, Any]] = {
    "jwc": {
        "owner_unit": "本科生院 / 教务处",
        "authority_domains": ["academic", "exam", "course", "calendar", "forms"],
        "priority_by_intent": {
            "exam_schedule": "high",
            "academic_calendar": "high",
            "academic_policy": "high",
            "course_grade_credit": "high",
            "form_download": "high",
            "system_entry": "high",
        },
        "freshness_policy": "current_term_or_latest_notice",
    },
    "xsc": {
        "owner_unit": "学生工作处",
        "authority_domains": ["student_affairs", "scholarship_aid", "counselor", "forms"],
        "priority_by_intent": {
            "scholarship_aid": "high",
            "student_affairs": "high",
            "form_download": "medium",
        },
        "freshness_policy": "latest_notice_with_policy_backstop",
    },
    "cxcy": {
        "owner_unit": "创新创业教育学院",
        "authority_domains": ["innovation_entrepreneurship", "competition", "dual_creation"],
        "priority_by_intent": {
            "innovation_entrepreneurship": "high",
            "form_download": "medium",
            "system_entry": "high",
        },
        "freshness_policy": "latest_notice_with_project_history",
    },
    "lib": {
        "owner_unit": "图书馆",
        "authority_domains": ["library", "reading", "database", "research_support"],
        "priority_by_intent": {"library_hours": "high", "library_service": "high"},
        "freshness_policy": "latest_notice_with_service_backstop",
    },
    "xxb": {
        "owner_unit": "信息化建设与管理办公室",
        "authority_domains": ["campus_it", "network", "identity", "portal"],
        "priority_by_intent": {"campus_it": "high", "system_entry": "high"},
        "freshness_policy": "official_service_entry",
    },
    "www": {
        "owner_unit": "南京邮电大学",
        "authority_domains": ["university_news", "campus_notice", "official_links"],
        "priority_by_intent": {"broad_exploratory": "medium"},
        "freshness_policy": "latest_notice",
    },
    "job91": {
        "owner_unit": "就业创业指导服务中心",
        "authority_domains": ["employment", "job_fair", "career_service"],
        "priority_by_intent": {"employment": "high", "employment_workflow": "high"},
        "freshness_policy": "latest_notice_with_workflow_backstop",
    },
    "tyb": {
        "owner_unit": "体育部",
        "authority_domains": ["sports", "physical_test", "sports_course"],
        "priority_by_intent": {"sports_affairs": "high"},
        "freshness_policy": "latest_notice",
    },
    "bwc": {
        "owner_unit": "保卫处",
        "authority_domains": ["security", "campus_pass", "traffic", "fire_safety"],
        "priority_by_intent": {"security_service": "high", "student_affairs": "medium"},
        "freshness_policy": "official_service_entry",
    },
    "fwlc": {
        "owner_unit": "服务流程平台",
        "authority_domains": ["service_workflow", "student_service", "staff_service"],
        "priority_by_intent": {"service_workflow": "high", "form_download": "medium"},
        "freshness_policy": "official_service_entry",
    },
    "gzzd": {
        "owner_unit": "规章制度库",
        "authority_domains": ["policy", "rules", "governance"],
        "priority_by_intent": {"academic_policy": "medium", "broad_exploratory": "medium"},
        "freshness_policy": "current_policy",
    },
    "xxgk": {
        "owner_unit": "信息公开网",
        "authority_domains": ["public_disclosure", "procurement", "budget"],
        "priority_by_intent": {"public_disclosure": "high"},
        "freshness_policy": "latest_notice",
    },
    "cs": {
        "owner_unit": "计算机学院、软件学院、网络空间安全学院",
        "authority_domains": ["school_department", "computer_science", "software", "cyber_security"],
        "priority_by_intent": {"school_department": "high"},
        "freshness_policy": "latest_notice",
    },
    "scie": {
        "owner_unit": "通信与信息工程学院",
        "authority_domains": ["school_department", "communication_engineering"],
        "priority_by_intent": {"school_department": "high"},
        "freshness_policy": "latest_notice",
    },
    "bhs": {
        "owner_unit": "贝尔英才学院",
        "authority_domains": ["school_department", "honors_college"],
        "priority_by_intent": {"school_department": "high"},
        "freshness_policy": "latest_notice",
    },
}


def attachment_evidence_coverage(attachments: list[dict[str, Any]]) -> dict[str, int]:
    coverage = {level: 0 for level in ATTACHMENT_EVIDENCE_LEVELS}
    for attachment in attachments:
        available = attachment.get("available_evidence")
        if isinstance(available, list) and available:
            for level in available:
                if level in coverage:
                    coverage[level] += 1
        else:
            if attachment.get("metadata_only") is True:
                coverage["metadata_only"] += 1
            level = str(attachment.get("evidence_level") or "metadata_only")
            coverage[level if level in coverage else "metadata_only"] += 1
    return {"total": len(attachments), **coverage}


def attachment_filename_index(attachments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "attachment_id": item.get("attachment_id"),
            "source_id": item.get("source_id"),
            "name": item.get("name"),
            "extension": item.get("extension"),
            "parent_doc_id": item.get("parent_doc_id"),
            "parent_url": item.get("parent_url"),
            "url": item.get("url"),
            "section": item.get("section"),
            "nav_path": item.get("nav_path") or [],
            "metadata_only": item.get("metadata_only") is True,
            "evidence_level": item.get("evidence_level") or "filename_only",
            "text_extracted": item.get("text_extracted") is True,
            "snippet_available": item.get("snippet_available") is True,
            "full_content_available": item.get("full_content_available") is True,
        }
        for item in attachments
    ]


def write_proof_catalog_entry(
    *,
    public_root: Path,
    proof_catalog_dir: Path,
    source_id: str,
    proof_catalog: dict[str, Any],
) -> dict[str, Any]:
    shards = proof_catalog.get("shards")
    if not isinstance(shards, list):
        raise ValueError(f"proof catalog shards must be a list: {source_id}")
    part_entries: list[dict[str, Any]] = []
    for index, chunk in enumerate(
        chunked_list_payloads(
            shards,
            wrapper={"version": PROOF_CATALOG_PART_VERSION, "source_id": source_id},
            payload_key="shards",
        )
    ):
        part_artifact = write_hashed_json(
            public_root,
            proof_catalog_dir,
            f"proof_catalog.{source_id}.part{index:03d}",
            {"version": PROOF_CATALOG_PART_VERSION, "source_id": source_id, "shards": chunk},
            compact=True,
        )
        part_entries.append(artifact_entry(part_artifact, role="proof_catalog_part", count=len(chunk), load="verify"))
    manifest_payload = {
        "version": PROOF_CATALOG_PARTS_VERSION,
        "catalog_version": proof_catalog.get("version") or PROOF_CATALOG_VERSION,
        "source_id": source_id,
        "encoding": "chunked-proof-catalog-v1",
        "state_model": proof_catalog.get("state_model"),
        "complete_requires_no_states": proof_catalog.get("complete_requires_no_states"),
        "covered_fields": proof_catalog.get("covered_fields"),
        "shard_count": len(shards),
        "part_count": len(part_entries),
        "parts": part_entries,
    }
    manifest_artifact = write_hashed_json(public_root, proof_catalog_dir, f"proof_catalog.{source_id}", manifest_payload, compact=True)
    entry = artifact_entry(manifest_artifact, role="proof_catalog", count=len(shards), load="verify")
    entry["part_count"] = len(part_entries)
    entry["runtime_bytes"] = int(entry["bytes"]) + sum(int(part["bytes"]) for part in part_entries)
    return entry


def build_source_manifests(
    *,
    public_root: Path,
    source_manifest_dir: Path,
    local_index_ref_dir: Path,
    proof_catalog_dir: Path,
    shard_filter_dir: Path,
    attachment_meta_dir: Path,
    attachment_filename_dir: Path,
    attachment_text_dir: Path,
    section_dir: Path,
    external_dir: Path,
    packages: list[dict[str, Any]],
    documents: list[dict[str, Any]],
    built: dict[str, Any],
    full_shards: list[dict[str, Any]],
    shard_filter: dict[str, dict[str, Any]],
    local_refs_by_source: dict[str, list[dict[str, Any]]],
    section_index: list[dict[str, Any]],
    external_index: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    source_manifest_artifacts: dict[str, dict[str, Any]] = {}
    source_manifest_payloads: dict[str, dict[str, Any]] = {}
    attachments_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in built["attachment_index"]:
        attachments_by_source[str(item.get("source_id") or "unknown")].append(item)
    sections_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in section_index:
        sections_by_source[str(item.get("source_id") or "unknown")].append(item)
    external_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in external_index:
        source_id = str(item.get("document_id") or "").split("-", 1)[0] or "unknown"
        external_by_source[source_id].append(item)

    for package in packages:
        source_id = package_source_id(package)
        source_docs = [document for document in documents if document_source_id(document) == source_id]
        source_shards = [shard for shard in full_shards if shard.get("source_id") == source_id]
        source_shard_ids = {str(shard["shard_id"]) for shard in source_shards}
        source_filter = {
            shard_id: payload
            for shard_id, payload in shard_filter.items()
            if shard_id in source_shard_ids
        }
        attachment_meta = attachments_by_source.get(source_id, [])
        attachment_coverage = attachment_evidence_coverage(attachment_meta)
        proof_catalog = {
            "version": "sitegraph-proof-ledger-catalog-v2",
            "source_id": source_id,
            "state_model": [
                "pending",
                "scanned",
                "proved_no_match",
                "excluded_by_filter",
                "excluded_by_declared_scope",
                "failed",
            ],
            "complete_requires_no_states": ["pending", "failed"],
            "covered_fields": ["title", "section", "nav_path", "summary", "content", "attachments", "url"],
            "shards": [
                {
                    "shard_id": shard["shard_id"],
                    "source_id": shard["source_id"],
                    "path": shard["path"],
                    "sha256": shard["sha256"],
                    "bytes": shard["bytes"],
                    "document_count": shard["count"],
                    "scope": {
                        "facets": shard["facet_range"],
                        "record_types": shard["record_type_range"],
                        "sections": shard["section_range"],
                        "years": shard["year_range"],
                        "hash_bucket": shard["hash_bucket"],
                    },
                    "filter_contract": {
                        "artifact_family": "shard_filters",
                        "hash_algorithm": "bloom-fnv1a32-utf8",
                        "false_negative": False,
                        "filter_sha256": shard["filter_sha256"],
                        "filter_token_count": shard["filter_token_count"],
                        "filter_bit_count": int((shard_filter.get(str(shard["shard_id"])) or {}).get("bit_count") or 0),
                        "filter_hash_count": int((shard_filter.get(str(shard["shard_id"])) or {}).get("hash_count") or 0),
                        "filter_sizing": str((shard_filter.get(str(shard["shard_id"])) or {}).get("sizing") or ""),
                    },
                }
                for shard in source_shards
            ],
        }
        proof_catalog_entry = write_proof_catalog_entry(
            public_root=public_root,
            proof_catalog_dir=proof_catalog_dir,
            source_id=source_id,
            proof_catalog=proof_catalog,
        )
        local_index_entry = write_chunked_list_entry(
            public_root=public_root,
            directory=local_index_ref_dir,
            logical_prefix="local_indexes",
            source_id=source_id,
            records=local_refs_by_source.get(source_id, []),
            manifest_version="sitegraph-local-index-parts-v1",
            part_version="sitegraph-local-index-part-v1",
            manifest_role="local_index_manifest",
            part_role="local_index_part",
            load="query_planned",
        )
        shard_filter_entry = write_chunked_mapping_entry(
            public_root=public_root,
            directory=shard_filter_dir,
            logical_prefix="shard_filter",
            source_id=source_id,
            entries=source_filter,
            manifest_version="sitegraph-shard-filter-parts-v1",
            part_version="sitegraph-shard-filter-part-v1",
            manifest_role="shard_filter",
            part_role="shard_filter_part",
            load="verify",
        )
        attachment_meta_entry = write_chunked_list_entry(
            public_root=public_root,
            directory=attachment_meta_dir,
            logical_prefix="attachment_meta",
            source_id=source_id,
            records=attachment_meta,
            manifest_version="sitegraph-attachment-meta-parts-v1",
            part_version="sitegraph-attachment-meta-part-v1",
            manifest_role="attachment_meta_index",
            part_role="attachment_meta_part",
            load="on_demand",
        )
        attachment_filename_entry = write_chunked_list_entry(
            public_root=public_root,
            directory=attachment_filename_dir,
            logical_prefix="attachment_filename",
            source_id=source_id,
            records=attachment_filename_index(attachment_meta),
            manifest_version="sitegraph-attachment-filename-parts-v1",
            part_version="sitegraph-attachment-filename-part-v1",
            manifest_role="attachment_filename_index",
            part_role="attachment_filename_part",
            load="query_planned",
        )
        attachment_text_artifact = write_hashed_json(
            public_root,
            attachment_text_dir,
            f"attachment_text_manifest.{source_id}",
            {"version": "attachment-text-shards-v1", "source_id": source_id, "shards": [], "ocr_default": False},
            compact=True,
        )
        section_artifact = write_hashed_json(public_root, section_dir, f"section_index.{source_id}", sections_by_source.get(source_id, []), compact=True)
        external_artifact = write_hashed_json(public_root, external_dir, f"external_index.{source_id}", external_by_source.get(source_id, []), compact=True)
        payload = {
            "version": "sitegraph-source-manifest-proof-ledger-v3",
            "source_id": source_id,
            "display_name": site_display_name(package["site"]),
            "domain": package_source_domain(package),
            "doc_count": len(source_docs),
            "attachment_count": len(attachment_meta),
            "attachment_evidence_coverage": attachment_coverage,
            "facet_counts": source_field_counts(documents, source_id, "facet"),
            "record_counts": source_field_counts(documents, source_id, "record_type"),
            "year_counts": Counter(shard_year(document) for document in source_docs),
            "local_indexes": [],
            "artifacts": {
                "local_indexes": local_index_entry,
                "proof_catalog": proof_catalog_entry,
                "shard_filter": shard_filter_entry,
                "attachment_meta_index": attachment_meta_entry,
                "attachment_filename_index": attachment_filename_entry,
                "attachment_text_shards": artifact_entry(attachment_text_artifact, role="attachment_text_shards", count=0, load="future_lazy"),
                "section_index": artifact_entry(section_artifact, role="section_index", count=len(sections_by_source.get(source_id, [])), load="on_demand"),
                "external_index": artifact_entry(external_artifact, role="external_index", count=len(external_by_source.get(source_id, [])), load="on_demand"),
            },
        }
        payload["year_counts"] = dict(sorted(payload["year_counts"].items()))
        artifact = write_hashed_json(public_root, source_manifest_dir, f"source_manifest.{source_id}", payload, compact=False)
        source_manifest_artifacts[source_id] = artifact_entry(artifact, role="source_manifest", count=len(source_docs), load="query_planned")
        source_manifest_payloads[source_id] = payload
    return source_manifest_artifacts, source_manifest_payloads


def build_source_registry(
    *,
    collection_id: str,
    packages: list[dict[str, Any]],
    documents: list[dict[str, Any]],
    built: dict[str, Any],
    source_manifest_artifacts: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    facet_counts = Counter(str(document.get("facet") or "unknown") for document in documents)
    sources = []
    for package in packages:
        source_id = package_source_id(package)
        authority = SOURCE_AUTHORITY.get(source_id, {})
        source_docs = [document for document in documents if document_source_id(document) == source_id]
        source_attachments = [item for item in built["attachment_index"] if str(item.get("source_id") or "") == source_id]
        attachment_coverage = attachment_evidence_coverage(source_attachments)
        quality = package.get("manifest", {}).get("quality") if isinstance(package.get("manifest"), dict) else {}
        sources.append(
            {
                "source_id": source_id,
                "display_name": site_display_name(package["site"]),
                "owner_unit": authority.get("owner_unit") or site_display_name(package["site"]),
                "domain": package_source_domain(package),
                "source_kind": "sitegraph",
                "authority_domains": authority.get("authority_domains") or [],
                "priority_by_intent": authority.get("priority_by_intent") or {},
                "freshness_policy": authority.get("freshness_policy") or "balanced",
                "artifact_manifest": source_manifest_artifacts[source_id],
                "doc_count": len(source_docs),
                "attachment_count": len(source_attachments),
                "attachment_evidence_coverage": attachment_coverage,
                "updated_at": clean_text(package.get("manifest", {}).get("generated_at")) or None,
                "quality_status": "ok" if isinstance(quality, dict) and quality.get("errors", 0) == 0 else "degraded",
                "coverage_status": "audited" if isinstance(quality, dict) and quality.get("all_discovered_urls_have_outcomes") is True else "partial",
                "facet_counts": source_field_counts(documents, source_id, "facet"),
                "record_counts": source_field_counts(documents, source_id, "record_type"),
                "truth_counts": dict(package["actual_counts"]),
            }
        )
    return {
        "version": "sitegraph-source-registry-routed-v1",
        "collection_id": collection_id,
        "sources": sources,
        "filter_options": {
            "sources": [
                {"id": item["source_id"], "label": item["display_name"], "count": item["doc_count"]}
                for item in sources
            ],
            "facets": [
                {"id": facet, "label": facet, "count": count}
                for facet, count in sorted(facet_counts.items())
            ],
        },
    }
