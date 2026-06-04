from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from njupt_search_indexer.sitegraph_text import normalize_text


BASE_DIR = Path(__file__).resolve().parents[4]
PUBLIC_ROOT = BASE_DIR / "apps" / "web" / "public"
HOT_QUERY_NORMALIZATION_CONFIG = json.loads(
    (BASE_DIR / "config" / "search" / "hot-query-normalization.json").read_text(encoding="utf-8")
)

HOT_QUERY_CERTIFICATE_MODEL = "hot-query-minimal-complete-proof-v3"
HOT_QUERY_FAST_START_VERSION = "sitegraph-hot-query-fast-start-v1"
HOT_QUERY_INITIAL_CERTIFICATE_VERSION = "sitegraph-hot-query-initial-certificate-v1"
HOT_QUERY_COMPLETE_CERTIFICATE_VERSION = "sitegraph-hot-query-complete-certificate-v3"
HOT_QUERY_COMPLETE_PROOF_MODEL = "match-proof-minimal-filter-v1"
HOT_QUERY_TOPK_CERTIFICATE_VERSION = "sitegraph-hot-query-topk-certificate-v2"
HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL = "rank-display-match-window-certificate-v2"
HOT_QUERY_RANK_EVIDENCE_MODEL = "query-token-field-impact-full-document-v1"


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def record_cache(index: dict[str, Any], hit: bool, bytes_count: int) -> None:
    stats = index.setdefault("cache_stats", {})
    for key in ("artifact_hits", "artifact_misses", "cached_bytes", "uncached_bytes", "cacheable_bytes", "memory_hits", "network_misses"):
        stats.setdefault(key, 0)
    stats["artifact_hits" if hit else "artifact_misses"] += 1
    stats["cacheable_bytes"] += bytes_count
    if hit:
        stats["cached_bytes"] += bytes_count
        stats["memory_hits"] += 1
    else:
        stats["uncached_bytes"] += bytes_count
        stats["network_misses"] += 1


def hot_query_phrase_key(match_phrases: list[str]) -> str:
    return "\0".join(sorted(match_phrases, key=lambda text: (-len(text), text)))


HOT_QUERY_COMMAND_PREFIXES = tuple(str(item) for item in HOT_QUERY_NORMALIZATION_CONFIG["command_prefixes"])
HOT_QUERY_COMMAND_SUFFIXES = tuple(str(item) for item in HOT_QUERY_NORMALIZATION_CONFIG["command_suffixes"])


def hot_query_intent_candidates(query: str) -> list[str]:
    candidates: list[str] = []
    seen: set[str] = set()
    queue = [normalize_text(query)]
    while queue and len(seen) < 48:
        value = queue.pop(0)
        if len(value) < 2 or value in seen:
            continue
        seen.add(value)
        candidates.append(value)
        for prefix in HOT_QUERY_COMMAND_PREFIXES:
            if value.startswith(prefix) and len(value) > len(prefix) + 1:
                queue.append(value[len(prefix) :])
        for suffix in HOT_QUERY_COMMAND_SUFFIXES:
            if value.endswith(suffix) and len(value) > len(suffix) + 1:
                queue.append(value[: -len(suffix)])
    return candidates


def resolve_hot_query_entry(directory: dict[str, Any], query: str) -> dict[str, Any] | None:
    queries = directory.get("queries") if isinstance(directory.get("queries"), dict) else {}
    for candidate in hot_query_intent_candidates(query):
        entry = queries.get(candidate)
        if isinstance(entry, dict):
            return entry
        for value in queries.values():
            if isinstance(value, dict) and normalize_text(value.get("query")) == candidate:
                return value
    return None


def load_hot_query_proof_directory(index: dict[str, Any]) -> dict[str, Any] | None:
    artifact = (index.get("manifest", {}).get("artifacts", {}) or {}).get("hot_query_proof_directory")
    if not isinstance(artifact, dict) or not artifact.get("path"):
        return None
    path = str(artifact["path"])
    cache = index["hot_query_proof_directory_cache"]
    bytes_count = int(artifact.get("bytes") or 0)
    if path in cache:
        record_cache(index, True, bytes_count)
        return cache[path]
    cache[path] = read_json(PUBLIC_ROOT / path)
    record_cache(index, False, bytes_count)
    return cache[path]


def load_hot_query_proof_certificate(index: dict[str, Any], entry: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(entry, dict) or not entry.get("path"):
        return None
    path = str(entry["path"])
    cache = index["hot_query_proof_cache"]
    bytes_count = int(entry.get("bytes") or 0)
    if path in cache:
        record_cache(index, True, bytes_count)
        return cache[path]
    cache[path] = read_json(PUBLIC_ROOT / path)
    record_cache(index, False, bytes_count)
    return cache[path]


def load_hot_query_top_proof_certificate(index: dict[str, Any], entry: dict[str, Any]) -> dict[str, Any] | None:
    top_entry = entry.get("top_certificate") if isinstance(entry.get("top_certificate"), dict) else None
    if not isinstance(top_entry, dict) or not top_entry.get("path"):
        return None
    path = str(top_entry["path"])
    cache = index["hot_query_top_proof_cache"]
    bytes_count = int(top_entry.get("bytes") or 0)
    if path in cache:
        record_cache(index, True, bytes_count)
        return cache[path]
    cache[path] = read_json(PUBLIC_ROOT / path)
    record_cache(index, False, bytes_count)
    return cache[path]


def load_hot_query_fast_start(index: dict[str, Any]) -> dict[str, Any] | None:
    artifact = (index.get("manifest", {}).get("artifacts", {}) or {}).get("hot_query_fast_start")
    if not isinstance(artifact, dict) or not artifact.get("path"):
        return None
    path = str(artifact["path"])
    cache = index["hot_query_fast_start_cache"]
    bytes_count = int(artifact.get("bytes") or 0)
    if path in cache:
        record_cache(index, True, bytes_count)
        return cache[path]
    cache[path] = read_json(PUBLIC_ROOT / path)
    record_cache(index, False, bytes_count)
    return cache[path]


def load_hot_query_initial_certificate(index: dict[str, Any], entry: dict[str, Any]) -> dict[str, Any] | None:
    initial_entry = entry.get("initial_certificate") if isinstance(entry.get("initial_certificate"), dict) else None
    if not isinstance(initial_entry, dict) or not initial_entry.get("path"):
        return None
    path = str(initial_entry["path"])
    cache = index["hot_query_initial_certificate_cache"]
    bytes_count = int(initial_entry.get("bytes") or 0)
    if path in cache:
        record_cache(index, True, bytes_count)
        return cache[path]
    cache[path] = read_json(PUBLIC_ROOT / path)
    record_cache(index, False, bytes_count)
    return cache[path]


def matching_hot_query_fast_start(index: dict[str, Any], query: str, match_phrases: list[str]) -> tuple[dict[str, Any], int] | None:
    del match_phrases
    fast_start = load_hot_query_fast_start(index)
    if not isinstance(fast_start, dict):
        return None
    if str(fast_start.get("version") or "") != HOT_QUERY_FAST_START_VERSION:
        return None
    if str(fast_start.get("initial_certificate_version") or "") != HOT_QUERY_INITIAL_CERTIFICATE_VERSION:
        return None
    if str(fast_start.get("top_document_payload_model") or "") != HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL:
        return None
    if str(fast_start.get("rank_evidence_model") or "") != HOT_QUERY_RANK_EVIDENCE_MODEL:
        return None
    entry = resolve_hot_query_entry(fast_start, query)
    if not isinstance(entry, dict):
        return None
    phrase_key = str(entry.get("phrase_key") or "")
    if not phrase_key:
        return None
    certificate = load_hot_query_initial_certificate(index, entry)
    if not isinstance(certificate, dict):
        return None
    if str(certificate.get("version") or "") != HOT_QUERY_INITIAL_CERTIFICATE_VERSION:
        return None
    if str(certificate.get("document_payload_model") or "") != HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL:
        return None
    if str(certificate.get("rank_evidence_model") or "") != HOT_QUERY_RANK_EVIDENCE_MODEL:
        return None
    if str(certificate.get("phrase_key") or "") != phrase_key:
        return None
    if not isinstance(certificate.get("rank_terms"), list):
        return None
    fast_start_bytes = int(((index.get("manifest", {}).get("artifacts", {}) or {}).get("hot_query_fast_start") or {}).get("bytes") or 0)
    initial_entry = entry.get("initial_certificate") if isinstance(entry.get("initial_certificate"), dict) else {}
    return certificate, fast_start_bytes + int(initial_entry.get("bytes") or 0)


def matching_hot_query_proof(index: dict[str, Any], query: str, match_phrases: list[str]) -> tuple[dict[str, Any], int] | None:
    del match_phrases
    directory = load_hot_query_proof_directory(index)
    if not isinstance(directory, dict):
        return None
    if str(directory.get("certificate_model") or "") != HOT_QUERY_CERTIFICATE_MODEL:
        return None
    if str(directory.get("complete_proof_model") or "") != HOT_QUERY_COMPLETE_PROOF_MODEL:
        return None
    if str(directory.get("top_document_payload_model") or "") != HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL:
        return None
    if str(directory.get("rank_evidence_model") or "") != HOT_QUERY_RANK_EVIDENCE_MODEL:
        return None
    entry = resolve_hot_query_entry(directory, query)
    if not isinstance(entry, dict):
        return None
    phrase_key = str(entry.get("phrase_key") or "")
    if not phrase_key:
        return None
    certificate = load_hot_query_proof_certificate(index, entry)
    if not isinstance(certificate, dict):
        return None
    if str(certificate.get("version") or "") != HOT_QUERY_COMPLETE_CERTIFICATE_VERSION:
        return None
    if str(certificate.get("proof_payload_model") or "") != HOT_QUERY_COMPLETE_PROOF_MODEL:
        return None
    if str(certificate.get("rank_evidence_model") or "") != HOT_QUERY_RANK_EVIDENCE_MODEL:
        return None
    if not isinstance(certificate.get("rank_terms"), list):
        return None
    if str(certificate.get("phrase_key") or "") != phrase_key:
        return None
    proof_bytes = int(((index.get("manifest", {}).get("artifacts", {}) or {}).get("hot_query_proof_directory") or {}).get("bytes") or 0)
    proof_bytes += int(entry.get("bytes") or 0)
    return certificate, proof_bytes


def matching_hot_query_top_proof(index: dict[str, Any], query: str, match_phrases: list[str]) -> tuple[dict[str, Any], dict[str, Any], int] | None:
    del match_phrases
    directory = load_hot_query_proof_directory(index)
    if not isinstance(directory, dict):
        return None
    if str(directory.get("certificate_model") or "") != HOT_QUERY_CERTIFICATE_MODEL:
        return None
    if str(directory.get("complete_proof_model") or "") != HOT_QUERY_COMPLETE_PROOF_MODEL:
        return None
    if str(directory.get("top_document_payload_model") or "") != HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL:
        return None
    if str(directory.get("rank_evidence_model") or "") != HOT_QUERY_RANK_EVIDENCE_MODEL:
        return None
    entry = resolve_hot_query_entry(directory, query)
    if not isinstance(entry, dict):
        return None
    phrase_key = str(entry.get("phrase_key") or "")
    if not phrase_key:
        return None
    certificate = load_hot_query_top_proof_certificate(index, entry)
    if not isinstance(certificate, dict):
        return None
    if str(certificate.get("version") or "") != HOT_QUERY_TOPK_CERTIFICATE_VERSION:
        return None
    if str(certificate.get("document_payload_model") or "") != HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL:
        return None
    if str(certificate.get("rank_evidence_model") or "") != HOT_QUERY_RANK_EVIDENCE_MODEL:
        return None
    if str(certificate.get("phrase_key") or "") != phrase_key:
        return None
    if not isinstance(certificate.get("rank_terms"), list):
        return None
    top_entry = entry.get("top_certificate") if isinstance(entry.get("top_certificate"), dict) else {}
    proof_bytes = int(((index.get("manifest", {}).get("artifacts", {}) or {}).get("hot_query_proof_directory") or {}).get("bytes") or 0)
    proof_bytes += int(top_entry.get("bytes") or 0)
    return certificate, entry, proof_bytes
