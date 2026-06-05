from __future__ import annotations

from typing import Any

from .. import sitegraph_public_index as public_index
from ..sitegraph_hot_query_proofs import (
    HOT_QUERY_COMPLETE_CERTIFICATE_VERSION,
    HOT_QUERY_COMPLETE_PROOF_MODEL,
    HOT_QUERY_FAST_START_VERSION,
    HOT_QUERY_INITIAL_CERTIFICATE_VERSION,
    HOT_QUERY_INITIAL_LIMIT,
    HOT_QUERY_PROOF_DOCUMENT_ENCODING,
    HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
    HOT_QUERY_TOPK_CERTIFICATE_VERSION,
)
from .public_artifacts import artifact_path, ensure_public_hashed_path, fail, read_json


HOT_QUERY_FIRST_TRUSTED_BYTE_BUDGET = 150 * 1024
REQUIRED_FAST_START_QUERIES = (
    "四六级",
    "成绩",
    "期末考试",
    "考试安排",
    "考试",
    "申请",
    "通知",
    "学生",
    "南京邮电大学",
    "选课",
    "校历",
    "转专业",
    "奖学金",
    "大创",
    "竞赛报名",
    "教务管理系统",
    "信息门户",
)
REQUIRED_HIGH_DF_PROOF_QUERIES = (
    "通知",
    "学生",
    "南京邮电大学",
)

def validate_hot_query_fast_start(manifest: dict[str, Any]) -> None:
    fast_start_entry = (manifest.get("artifacts") or {}).get("hot_query_fast_start")
    if not isinstance(fast_start_entry, dict):
        fail("manifest.artifacts.hot_query_fast_start is missing")
    fast_start_path = artifact_path(manifest, "hot_query_fast_start")
    fast_start = read_json(fast_start_path)
    if not isinstance(fast_start, dict):
        fail("hot_query_fast_start must be an object")
    if fast_start.get("version") != HOT_QUERY_FAST_START_VERSION:
        fail("hot_query_fast_start has unexpected version")
    if fast_start.get("scope") != "global_unfiltered_queries":
        fail("hot_query_fast_start.scope must be global_unfiltered_queries")
    if fast_start.get("initial_certificate_version") != HOT_QUERY_INITIAL_CERTIFICATE_VERSION:
        fail("hot_query_fast_start.initial_certificate_version is invalid")
    if fast_start.get("top_document_payload_model") != HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL:
        fail("hot_query_fast_start.top_document_payload_model is invalid")
    queries = fast_start.get("queries")
    if not isinstance(queries, dict) or not queries:
        fail("hot_query_fast_start.queries must be non-empty")
    if int(fast_start.get("query_count") or -1) != len(queries):
        fail("hot_query_fast_start.query_count must equal queries length")

    max_initial_bytes = 0
    for normalized_query, entry in queries.items():
        if not isinstance(entry, dict):
            fail(f"hot_query_fast_start entry must be object: {normalized_query}")
        initial = entry.get("initial_certificate")
        if not isinstance(initial, dict):
            fail(f"hot_query_fast_start.{normalized_query}.initial_certificate is missing")
        if initial.get("role") != "hot_query_top_initial":
            fail(f"hot_query_fast_start.{normalized_query}.initial_certificate role must be hot_query_top_initial")
        if int(initial.get("count") or 0) > HOT_QUERY_INITIAL_LIMIT:
            fail(f"hot_query_fast_start.{normalized_query}.initial_certificate count exceeds HOT_QUERY_INITIAL_LIMIT")
        initial_path = ensure_public_hashed_path(str(initial.get("path") or ""), f"hot_query_fast_start.{normalized_query}.initial_certificate.path")
        certificate = read_json(initial_path)
        if not isinstance(certificate, dict):
            fail(f"hot query initial certificate must be object: {normalized_query}")
        if certificate.get("version") != HOT_QUERY_INITIAL_CERTIFICATE_VERSION:
            fail(f"hot query initial certificate has unexpected version: {normalized_query}")
        if certificate.get("document_payload_model") != HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL:
            fail(f"hot query initial certificate has invalid document payload model: {normalized_query}")
        documents = certificate.get("documents")
        if not isinstance(documents, list):
            fail(f"hot query initial certificate documents must be a list: {normalized_query}")
        top_k_count = certificate.get("top_k_count")
        if not isinstance(top_k_count, int) or len(documents) != top_k_count:
            fail(f"hot query initial certificate top_k_count mismatch: {normalized_query}")
        if len(documents) > HOT_QUERY_INITIAL_LIMIT:
            fail(f"hot query initial certificate exceeds initial limit: {normalized_query}")
        max_initial_bytes = max(max_initial_bytes, int(initial.get("bytes") or 0))

    missing = [
        query
        for query in REQUIRED_FAST_START_QUERIES
        if public_index.normalize_text(query) not in queries
    ]
    if missing:
        fail(f"hot_query_fast_start missing required hot queries: {missing}")
    total_first_trusted_bytes = int(fast_start_entry.get("bytes") or 0) + max_initial_bytes
    if total_first_trusted_bytes > HOT_QUERY_FIRST_TRUSTED_BYTE_BUDGET:
        fail(
            "hot_query_fast_start plus largest initial certificate exceeds "
            f"{HOT_QUERY_FIRST_TRUSTED_BYTE_BUDGET} bytes: {total_first_trusted_bytes}"
        )


def validate_high_df_hot_query_proofs(manifest: dict[str, Any]) -> None:
    directory_path = artifact_path(manifest, "hot_query_proof_directory")
    directory = read_json(directory_path)
    if directory.get("complete_proof_model") != HOT_QUERY_COMPLETE_PROOF_MODEL:
        fail("hot_query_proof_directory.complete_proof_model is invalid")
    queries = directory.get("queries") if isinstance(directory.get("queries"), dict) else {}
    if not queries:
        fail("hot_query_proof_directory.queries must be non-empty")
    for query in REQUIRED_HIGH_DF_PROOF_QUERIES:
        normalized = public_index.normalize_text(query)
        entry = queries.get(normalized)
        if not isinstance(entry, dict):
            fail(f"hot_query_proof_directory missing high-df proof query: {query}")
        if entry.get("role") != "hot_query_complete_certificate":
            fail(f"high-df proof query {query} must use hot_query_complete_certificate")
        complete_path = ensure_public_hashed_path(str(entry.get("path") or ""), f"hot_query_proof_directory.{normalized}.path")
        complete = read_json(complete_path)
        if complete.get("version") != HOT_QUERY_COMPLETE_CERTIFICATE_VERSION:
            fail(f"high-df complete certificate has unexpected version: {query}")
        if complete.get("proof_payload_model") != HOT_QUERY_COMPLETE_PROOF_MODEL:
            fail(f"high-df complete certificate has invalid proof payload model: {query}")
        if complete.get("document_encoding") != HOT_QUERY_PROOF_DOCUMENT_ENCODING:
            fail(f"high-df complete certificate must use compact document encoding: {query}")
        dictionaries = complete.get("document_dictionaries")
        documents = complete.get("documents")
        if not isinstance(dictionaries, dict) or not isinstance(documents, list):
            fail(f"high-df complete certificate is missing compact proof dictionaries/documents: {query}")
        for key in ("source_ids", "facets", "record_types", "shards", "fields", "phrases", "dates", "date_kinds", "date_confidences"):
            if not isinstance(dictionaries.get(key), list):
                fail(f"high-df complete certificate dictionary {key} must be a list: {query}")
        if any(not isinstance(row, list) or len(row) < 8 for row in documents):
            fail(f"high-df complete certificate documents must be compact rows: {query}")
        if len(documents) != int(complete.get("match_count") or -1):
            fail(f"high-df complete certificate compact document count mismatch: {query}")
        top_entry = entry.get("top_certificate")
        if not isinstance(top_entry, dict):
            fail(f"high-df proof query {query} is missing top_certificate")
        if top_entry.get("role") != "hot_query_topk_certificate":
            fail(f"high-df proof query {query} top_certificate must be hot_query_topk_certificate")
        top_path = ensure_public_hashed_path(str(top_entry.get("path") or ""), f"hot_query_proof_directory.{normalized}.top_certificate.path")
        top = read_json(top_path)
        if top.get("version") != HOT_QUERY_TOPK_CERTIFICATE_VERSION:
            fail(f"high-df top-k certificate has unexpected version: {query}")
        if int(top.get("top_k_count") or 0) > int(top.get("top_k_limit") or 0):
            fail(f"high-df top-k certificate exceeds top_k_limit: {query}")
        if int(complete.get("match_count") or -1) != int(entry.get("match_count") or -2):
            fail(f"high-df complete certificate match_count mismatch: {query}")
