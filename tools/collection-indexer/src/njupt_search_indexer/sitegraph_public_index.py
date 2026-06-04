from __future__ import annotations

import os
import shutil
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .artifacts.outcomes import write_outcomes_entry
from .artifacts.size_report import (
    build_size_report,
    local_body_runtime_bytes,
    local_light_runtime_bytes,
    refresh_size_report_after_manifest,
)
from .indexes.local_impact import build_local_impact_indexes, index_id_for_scope, index_scope_for_document
from .sitegraph_artifact_io import artifact_entry, write_hashed_json, write_json
from .sitegraph_documents import section_label, site_display_name
from .sitegraph_index_postings import (
    QUERY_SYNONYMS,
    exhaustive_scan_blob,
    measure_representative_full_scan_ms,
    query_alias_payload,
)
from .hot_queries.public_hot_query_artifacts import build_hot_query_artifacts
from .manifests.public_manifest import build_public_manifest
from .manifests.source_artifacts import (
    ATTACHMENT_EVIDENCE_LEVELS,
    attachment_evidence_coverage,
    build_source_manifests,
    build_source_registry,
)
from .sitegraph_hot_query_proofs import HOT_QUERY_INITIAL_LIMIT
from .sitegraph_package_summary import (
    aggregate_counts,
    aggregate_quality,
    latest_upstream_generated_at,
    source_truth_counts,
)
from .sitegraph_shards import build_locality_shards, shard_year
from .sitegraph_source import document_source_id, package_source_id
from .sitegraph_text import clean_text, normalize_text


BASE_DIR = Path(__file__).resolve().parents[4]
PUBLIC_ROOT = BASE_DIR / "apps" / "web" / "public"
COLLECTION_ID = "njupt-public"
PUBLIC_INDEX_DIR = PUBLIC_ROOT / "generated" / "collections" / COLLECTION_ID
PUBLIC_SITEGRAPH_DIR = PUBLIC_INDEX_DIR / "sitegraph"
PUBLIC_ARTIFACT_DIR = PUBLIC_SITEGRAPH_DIR / "artifacts"
PUBLIC_SOURCE_MANIFEST_DIR = PUBLIC_SITEGRAPH_DIR / "source_manifests"
PUBLIC_LOCAL_LIGHT_META_DIR = PUBLIC_SITEGRAPH_DIR / "local_impact_light_meta_indexes"
PUBLIC_LOCAL_LIGHT_PACKED_DIR = PUBLIC_SITEGRAPH_DIR / "local_impact_light_packed_indexes"
PUBLIC_LOCAL_BODY_DIR = PUBLIC_SITEGRAPH_DIR / "local_impact_body_indexes"
PUBLIC_LOCAL_BODY_PACKED_DIR = PUBLIC_SITEGRAPH_DIR / "local_impact_body_packed_indexes"
PUBLIC_PROOF_CATALOG_DIR = PUBLIC_SITEGRAPH_DIR / "proof_catalogs"
PUBLIC_SHARD_FILTER_DIR = PUBLIC_SITEGRAPH_DIR / "shard_filters"
PUBLIC_HOT_QUERY_PROOF_DIR = PUBLIC_SITEGRAPH_DIR / "hot_query_proofs"
PUBLIC_FULL_SHARD_DIR = PUBLIC_SITEGRAPH_DIR / "full_shards"
PUBLIC_ATTACHMENT_META_DIR = PUBLIC_SITEGRAPH_DIR / "attachment_meta_indexes"
PUBLIC_ATTACHMENT_FILENAME_DIR = PUBLIC_SITEGRAPH_DIR / "attachment_filename_indexes"
PUBLIC_ATTACHMENT_TEXT_DIR = PUBLIC_SITEGRAPH_DIR / "attachment_text_shards"
PUBLIC_SECTION_DIR = PUBLIC_SITEGRAPH_DIR / "section_indexes"
PUBLIC_EXTERNAL_DIR = PUBLIC_SITEGRAPH_DIR / "external_indexes"
PUBLIC_SHARD_DIR = PUBLIC_FULL_SHARD_DIR
OBSOLETE_INDEX_DIR = PUBLIC_ROOT / "index"

MAX_PUBLIC_JSON_ARTIFACT_BYTES = 1024 * 1024


def configure_collection_output(collection_id: str = COLLECTION_ID, output_dir: Path | None = None) -> None:
    global COLLECTION_ID, PUBLIC_INDEX_DIR, PUBLIC_SITEGRAPH_DIR, PUBLIC_ARTIFACT_DIR
    global PUBLIC_SOURCE_MANIFEST_DIR, PUBLIC_LOCAL_LIGHT_META_DIR, PUBLIC_LOCAL_LIGHT_PACKED_DIR
    global PUBLIC_LOCAL_BODY_DIR, PUBLIC_LOCAL_BODY_PACKED_DIR
    global PUBLIC_PROOF_CATALOG_DIR, PUBLIC_SHARD_FILTER_DIR, PUBLIC_HOT_QUERY_PROOF_DIR, PUBLIC_FULL_SHARD_DIR, PUBLIC_SHARD_DIR
    global PUBLIC_ATTACHMENT_META_DIR, PUBLIC_ATTACHMENT_FILENAME_DIR, PUBLIC_ATTACHMENT_TEXT_DIR
    global PUBLIC_SECTION_DIR, PUBLIC_EXTERNAL_DIR

    if collection_id != "njupt-public":
        raise ValueError("Only collection-id njupt-public is currently supported")
    target = (output_dir.resolve() if output_dir is not None else PUBLIC_ROOT / "generated" / "collections" / collection_id)
    try:
        target.relative_to(PUBLIC_ROOT)
    except ValueError as exc:
        raise ValueError(f"collection output must be under {PUBLIC_ROOT}") from exc

    COLLECTION_ID = collection_id
    PUBLIC_INDEX_DIR = target
    PUBLIC_SITEGRAPH_DIR = PUBLIC_INDEX_DIR / "sitegraph"
    PUBLIC_ARTIFACT_DIR = PUBLIC_SITEGRAPH_DIR / "artifacts"
    PUBLIC_SOURCE_MANIFEST_DIR = PUBLIC_SITEGRAPH_DIR / "source_manifests"
    PUBLIC_LOCAL_LIGHT_META_DIR = PUBLIC_SITEGRAPH_DIR / "local_impact_light_meta_indexes"
    PUBLIC_LOCAL_LIGHT_PACKED_DIR = PUBLIC_SITEGRAPH_DIR / "local_impact_light_packed_indexes"
    PUBLIC_LOCAL_BODY_DIR = PUBLIC_SITEGRAPH_DIR / "local_impact_body_indexes"
    PUBLIC_LOCAL_BODY_PACKED_DIR = PUBLIC_SITEGRAPH_DIR / "local_impact_body_packed_indexes"
    PUBLIC_PROOF_CATALOG_DIR = PUBLIC_SITEGRAPH_DIR / "proof_catalogs"
    PUBLIC_SHARD_FILTER_DIR = PUBLIC_SITEGRAPH_DIR / "shard_filters"
    PUBLIC_HOT_QUERY_PROOF_DIR = PUBLIC_SITEGRAPH_DIR / "hot_query_proofs"
    PUBLIC_FULL_SHARD_DIR = PUBLIC_SITEGRAPH_DIR / "full_shards"
    PUBLIC_SHARD_DIR = PUBLIC_FULL_SHARD_DIR
    PUBLIC_ATTACHMENT_META_DIR = PUBLIC_SITEGRAPH_DIR / "attachment_meta_indexes"
    PUBLIC_ATTACHMENT_FILENAME_DIR = PUBLIC_SITEGRAPH_DIR / "attachment_filename_indexes"
    PUBLIC_ATTACHMENT_TEXT_DIR = PUBLIC_SITEGRAPH_DIR / "attachment_text_shards"
    PUBLIC_SECTION_DIR = PUBLIC_SITEGRAPH_DIR / "section_indexes"
    PUBLIC_EXTERNAL_DIR = PUBLIC_SITEGRAPH_DIR / "external_indexes"


def producer_ref() -> str:
    for env_name in ("GITHUB_SHA", "GITHUB_REF_NAME"):
        value = os.environ.get(env_name)
        if value:
            return value
    try:
        return subprocess.check_output(["git", "rev-parse", "--short=12", "HEAD"], cwd=BASE_DIR, text=True).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "local-unversioned"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_section_index(packages: list[dict[str, Any]], documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    section_counts = Counter(clean_text(document.get("section_id")) or "unknown" for document in documents)
    section_index: list[dict[str, Any]] = []
    for package in packages:
        source_id = package_source_id(package)
        source = site_display_name(package["site"])
        for section in package["sections"]:
            section_id = clean_text(section.get("section_id"))
            section_name, nav_path, tags = section_label(section)
            section_index.append(
                {
                    "source_id": source_id,
                    "source": source,
                    "section_id": section_id,
                    "name": section_name,
                    "url": clean_text(section.get("url")),
                    "section_type": clean_text(section.get("section_type")),
                    "nav_path": nav_path,
                    "business_tags": tags,
                    "document_count": section_counts.get(section_id, 0),
                }
            )
    return section_index


def route_blob(document: dict[str, Any]) -> str:
    attachment_text = " ".join(
        " ".join(clean_text(attachment.get(field)) for field in ("name", "extension", "section", "parent_url"))
        for attachment in document.get("attachments") or []
    )
    return normalize_text(
        " ".join(
            [
                clean_text(document.get("title")),
                clean_text(document.get("canonical_title")),
                clean_text(document.get("section")),
                clean_text(document.get("nav_path_text")),
                " ".join(clean_text(item) for item in document.get("nav_path") or []),
                clean_text(document.get("summary")),
                clean_text(document.get("content")),
                clean_text(document.get("url")),
                clean_text(document.get("facet")),
                clean_text(document.get("task_kind")),
                clean_text(document.get("source_id")),
                attachment_text,
            ]
        )
    )


def route_summary(
    docs: list[dict[str, Any]],
    *,
    term: str | None = None,
    local_index_costs: dict[str, int] | None = None,
    max_local_indexes: int = 24,
    max_shards: int = 12,
) -> dict[str, Any]:
    sources = Counter(document_source_id(document) for document in docs)
    facets = Counter(str(document.get("facet") or "unknown") for document in docs)
    years = Counter(shard_year(document) for document in docs)
    task_kinds = Counter(str(document.get("task_kind") or "broad_exploratory") for document in docs)
    result_types = Counter(str(document.get("record_type") or "detail") for document in docs)
    local_indexes = Counter(index_id_for_scope(*index_scope_for_document(document)) for document in docs)
    shard_ids = Counter(str((document.get("shard") or {}).get("shard_id") or "") for document in docs)
    selected_local_indexes = [key for key, _ in local_indexes.most_common(max_local_indexes)]
    expected_cost_bytes = sum((local_index_costs or {}).get(index_id, 0) for index_id in selected_local_indexes)
    expected_utility = round(
        (len(docs) + sum(sources.values()) * 0.4 + sum(facets.values()) * 0.2)
        / max(1, expected_cost_bytes / 1024),
        6,
    )
    summary = {
        "term": term,
        "likely_sources": [key for key, _ in sources.most_common()],
        "likely_facets": [key for key, _ in facets.most_common()],
        "likely_years": [key for key, _ in years.most_common()],
        "likely_task_kinds": [key for key, _ in task_kinds.most_common(8)],
        "expected_result_types": [key for key, _ in result_types.most_common()],
        "local_index_ids": selected_local_indexes,
        "sample_shard_ids": [key for key, _ in shard_ids.most_common(max_shards) if key],
        "candidate_shard_group_count": len(shard_ids),
        "authority_priors": {
            source_id: round(count / max(1, len(docs)), 4)
            for source_id, count in sources.most_common()
        },
        "freshness_policy": "prefer_recent_for_current_notice_intents",
        "matched_document_count": len(docs),
        "expected_cost_bytes": expected_cost_bytes,
        "expected_utility_per_kb": expected_utility,
        "planner_features": {
            "source_entropy": len(sources),
            "facet_entropy": len(facets),
            "year_entropy": len(years),
            "local_index_count": len(selected_local_indexes),
        },
    }
    return summary


def build_global_query_directory(
    documents: list[dict[str, Any]],
    query_aliases: dict[str, Any],
    local_index_costs: dict[str, int],
) -> dict[str, Any]:
    normalized_blobs = [(document, route_blob(document)) for document in documents]
    known_terms: set[str] = set()
    for key, payload in query_aliases.items():
        known_terms.add(str(key))
        if isinstance(payload, dict):
            known_terms.update(str(item) for item in payload.get("aliases") or [])
    for document in documents:
        known_terms.update(str(document.get(field) or "") for field in ("facet", "task_kind", "source_id"))

    entries: dict[str, Any] = {}
    for raw_term in sorted(known_terms):
        normalized = normalize_text(raw_term)
        if len(normalized) < 2:
            continue
        matched_docs = [document for document, blob in normalized_blobs if normalized in blob]
        if not matched_docs:
            continue
        entries[normalized] = route_summary(matched_docs, term=normalized, local_index_costs=local_index_costs)

    intents: dict[str, Any] = {}
    for intent in sorted({str(document.get("task_kind") or "broad_exploratory") for document in documents}):
        intent_docs = [document for document in documents if str(document.get("task_kind") or "broad_exploratory") == intent]
        intents[intent] = route_summary(intent_docs, term=intent, local_index_costs=local_index_costs, max_local_indexes=36, max_shards=16)

    return {
        "version": "sitegraph-global-query-directory-cost-v2",
        "description": "Routing evidence only. This directory maps query evidence to sources, facets, years, local indexes, and shard groups; it never stores corpus-wide document postings.",
        "tokenizer": "nfkc-lower-cjk-ngram-code",
        "planner": "cost_authority_proof_ledger_v2",
        "entry_count": len(entries),
        "entries": entries,
        "intents": intents,
        "fallback": {
            "mode": "cost_sort_authority_manifests_then_proof_ledger_verify",
            "false_negative_policy": "directory misses route broadly and cannot justify exhaustive completion without shard scan or safe filter proof",
        },
    }


def public_artifact_dirs() -> tuple[Path, ...]:
    return (
        PUBLIC_ARTIFACT_DIR,
        PUBLIC_SOURCE_MANIFEST_DIR,
        PUBLIC_LOCAL_LIGHT_META_DIR,
        PUBLIC_LOCAL_LIGHT_PACKED_DIR,
        PUBLIC_LOCAL_BODY_PACKED_DIR,
        PUBLIC_PROOF_CATALOG_DIR,
        PUBLIC_SHARD_FILTER_DIR,
        PUBLIC_HOT_QUERY_PROOF_DIR,
        PUBLIC_FULL_SHARD_DIR,
        PUBLIC_ATTACHMENT_META_DIR,
        PUBLIC_ATTACHMENT_FILENAME_DIR,
        PUBLIC_ATTACHMENT_TEXT_DIR,
        PUBLIC_SECTION_DIR,
        PUBLIC_EXTERNAL_DIR,
    )


def write_public_index(packages: list[dict[str, Any]], built: dict[str, Any], *, shard_size: int) -> dict[str, Any]:
    # The public index is locality-sharded; the CLI argument is accepted but has no effect.
    _ = shard_size

    for directory in (PUBLIC_INDEX_DIR, OBSOLETE_INDEX_DIR):
        if directory.exists():
            shutil.rmtree(directory)
    for directory in public_artifact_dirs():
        directory.mkdir(parents=True, exist_ok=True)

    documents = built["documents"]
    full_shards, shard_by_id, shard_filter = build_locality_shards(
        documents,
        public_root=PUBLIC_ROOT,
        shard_dir=PUBLIC_FULL_SHARD_DIR,
    )
    local_refs, local_refs_by_source = build_local_impact_indexes(
        documents,
        shard_by_id,
        public_root=PUBLIC_ROOT,
        light_meta_dir=PUBLIC_LOCAL_LIGHT_META_DIR,
        light_packed_dir=PUBLIC_LOCAL_LIGHT_PACKED_DIR,
        body_packed_dir=PUBLIC_LOCAL_BODY_PACKED_DIR,
    )
    section_index = build_section_index(packages, documents)
    query_aliases = query_alias_payload()
    (
        hot_query_proof_artifact,
        hot_query_fast_start_artifact,
        hot_query_certificate_bytes_by_query,
        hot_query_top_certificate_bytes_by_query,
        hot_query_initial_certificate_bytes_by_query,
    ) = build_hot_query_artifacts(
        public_root=PUBLIC_ROOT,
        artifact_dir=PUBLIC_ARTIFACT_DIR,
        hot_query_proof_dir=PUBLIC_HOT_QUERY_PROOF_DIR,
        documents=documents,
        query_aliases=query_aliases,
        full_shards=full_shards,
    )
    source_manifest_artifacts, source_manifest_payloads = build_source_manifests(
        public_root=PUBLIC_ROOT,
        source_manifest_dir=PUBLIC_SOURCE_MANIFEST_DIR,
        proof_catalog_dir=PUBLIC_PROOF_CATALOG_DIR,
        shard_filter_dir=PUBLIC_SHARD_FILTER_DIR,
        attachment_meta_dir=PUBLIC_ATTACHMENT_META_DIR,
        attachment_filename_dir=PUBLIC_ATTACHMENT_FILENAME_DIR,
        attachment_text_dir=PUBLIC_ATTACHMENT_TEXT_DIR,
        section_dir=PUBLIC_SECTION_DIR,
        external_dir=PUBLIC_EXTERNAL_DIR,
        packages=packages,
        documents=documents,
        built=built,
        full_shards=full_shards,
        shard_filter=shard_filter,
        local_refs_by_source=local_refs_by_source,
        section_index=section_index,
        external_index=built["external_index"],
    )
    source_registry = build_source_registry(
        collection_id=COLLECTION_ID,
        packages=packages,
        documents=documents,
        built=built,
        source_manifest_artifacts=source_manifest_artifacts,
    )
    local_index_costs = {
        ref["index_id"]: local_light_runtime_bytes(ref) + local_body_runtime_bytes(ref)
        for ref in local_refs
    }
    global_query_directory = build_global_query_directory(documents, query_aliases, local_index_costs)

    artifacts: dict[str, dict[str, Any]] = {}
    source_registry_artifact = write_hashed_json(PUBLIC_ROOT, PUBLIC_ARTIFACT_DIR, "source_registry", source_registry, compact=True)
    query_directory_artifact = write_hashed_json(PUBLIC_ROOT, PUBLIC_ARTIFACT_DIR, "global_query_directory", global_query_directory, compact=True)
    aliases_artifact = write_hashed_json(PUBLIC_ROOT, PUBLIC_ARTIFACT_DIR, "query_aliases", query_aliases, compact=False)
    outcomes_entry = write_outcomes_entry(public_root=PUBLIC_ROOT, artifact_dir=PUBLIC_ARTIFACT_DIR, outcomes=built["outcomes"])

    upstream_counts = aggregate_counts(packages)
    per_source_truth_counts = source_truth_counts(packages)
    upstream_quality = aggregate_quality(packages)
    record_counts = Counter(document["record_type"] for document in documents)
    facet_counts = Counter(document["facet"] for document in documents)
    total_full_scan_bytes = sum(int(item["bytes"]) for item in full_shards)
    max_full_shard_bytes = max((int(item["bytes"]) for item in full_shards), default=0)
    avg_full_shard_bytes = round(total_full_scan_bytes / max(1, len(full_shards)), 2)
    representative_full_scan_ms = measure_representative_full_scan_ms(documents, "校历")

    quality_report = {
        "generated_at": now_iso(),
        "truth_counts": upstream_counts,
        "source_truth_counts": per_source_truth_counts,
        "quality": upstream_quality,
        "all_discovered_urls_have_outcomes": upstream_quality.get("all_discovered_urls_have_outcomes") is True,
        "attachment_policy": upstream_quality.get("attachment_policy"),
        "external_link_policy": upstream_quality.get("external_link_policy"),
    }
    quality_report_artifact = write_hashed_json(PUBLIC_ROOT, PUBLIC_ARTIFACT_DIR, "quality_report", quality_report, compact=False)
    query_eval_report = {
        "generated_at": now_iso(),
        "representative_queries": sorted(QUERY_SYNONYMS),
        "metrics": {
            "local_index_bytes_per_query": "reported_by_search_eval",
            "hydrated_shard_bytes_per_query": "reported_by_search_eval",
            "coverage_truthfulness": "verified_by_smoke_and_task_queries",
        },
    }
    query_eval_artifact = write_hashed_json(PUBLIC_ROOT, PUBLIC_ARTIFACT_DIR, "query_eval_report", query_eval_report, compact=False)

    artifacts["source_registry"] = artifact_entry(source_registry_artifact, role="source_registry", count=len(source_registry["sources"]), load="bootstrap")
    artifacts["global_query_directory"] = artifact_entry(query_directory_artifact, role="global_query_directory", count=global_query_directory["entry_count"], load="bootstrap")
    artifacts["query_aliases"] = artifact_entry(aliases_artifact, role="query_aliases", count=len(query_aliases), load="bootstrap")
    artifacts["outcomes"] = outcomes_entry
    artifacts["quality_report"] = artifact_entry(quality_report_artifact, role="quality_report", load="audit")
    artifacts["query_eval_report"] = artifact_entry(query_eval_artifact, role="query_eval_report", load="audit")
    artifacts["hot_query_proof_directory"] = hot_query_proof_artifact
    artifacts["hot_query_fast_start"] = hot_query_fast_start_artifact

    generated_at = now_iso()
    upstream_generated_at = latest_upstream_generated_at(packages) or generated_at
    first_screen_artifacts = ["source_registry", "global_query_directory", "query_aliases"]
    fast_start_artifacts = ["hot_query_fast_start"]
    global_attachment_coverage = attachment_evidence_coverage(built["attachment_index"])

    def make_manifest() -> dict[str, Any]:
        return build_public_manifest(
            generated_at=generated_at,
            producer_ref=producer_ref(),
            collection_id=COLLECTION_ID,
            upstream_generated_at=upstream_generated_at,
            truth_counts=upstream_counts,
            source_truth_counts=per_source_truth_counts,
            quality=upstream_quality,
            total_documents=len(documents),
            record_counts=record_counts,
            facet_counts=facet_counts,
            first_screen_artifacts=first_screen_artifacts,
            fast_start_artifacts=fast_start_artifacts,
            hot_query_initial_limit=HOT_QUERY_INITIAL_LIMIT,
            total_shards=len(full_shards),
            attachment_evidence_levels=ATTACHMENT_EVIDENCE_LEVELS,
            artifacts=artifacts,
            source_manifest_artifacts=source_manifest_artifacts,
            source_manifest_payloads=source_manifest_payloads,
            attachment_metadata_count=len(built["attachment_index"]),
            external_link_count=len(built["external_index"]),
            attachment_evidence_coverage=global_attachment_coverage,
        )

    size_report = build_size_report(
        generated_at=now_iso(),
        first_screen_artifacts=first_screen_artifacts,
        artifacts=artifacts,
        local_refs=local_refs,
        source_manifest_payloads=source_manifest_payloads,
        full_shards=full_shards,
        public_sitegraph_dir=PUBLIC_SITEGRAPH_DIR,
        total_full_scan_bytes=total_full_scan_bytes,
        max_full_shard_bytes=max_full_shard_bytes,
        avg_full_shard_bytes=avg_full_shard_bytes,
        representative_full_scan_ms=representative_full_scan_ms,
        hot_query_initial_certificate_bytes_by_query=hot_query_initial_certificate_bytes_by_query,
        hot_query_top_certificate_bytes_by_query=hot_query_top_certificate_bytes_by_query,
        hot_query_certificate_bytes_by_query=hot_query_certificate_bytes_by_query,
    )
    size_artifact = write_hashed_json(PUBLIC_ROOT, PUBLIC_ARTIFACT_DIR, "size_report", size_report, compact=False)
    artifacts["size_report"] = artifact_entry(size_artifact, role="size_report", load="audit")

    manifest = make_manifest()
    write_json(PUBLIC_INDEX_DIR / "manifest.json", manifest)

    size_report = refresh_size_report_after_manifest(
        size_report,
        collection_id=COLLECTION_ID,
        public_index_dir=PUBLIC_INDEX_DIR,
        public_sitegraph_dir=PUBLIC_SITEGRAPH_DIR,
        first_screen_artifacts=first_screen_artifacts,
        artifacts=artifacts,
        source_manifest_payloads=source_manifest_payloads,
        hot_query_initial_certificate_bytes_by_query=hot_query_initial_certificate_bytes_by_query,
        hot_query_top_certificate_bytes_by_query=hot_query_top_certificate_bytes_by_query,
        hot_query_certificate_bytes_by_query=hot_query_certificate_bytes_by_query,
    )
    size_artifact = write_hashed_json(PUBLIC_ROOT, PUBLIC_ARTIFACT_DIR, "size_report", size_report, compact=False)
    artifacts["size_report"] = artifact_entry(size_artifact, role="size_report", load="audit")
    manifest = make_manifest()
    write_json(PUBLIC_INDEX_DIR / "manifest.json", manifest)
    return manifest
