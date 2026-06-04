from __future__ import annotations

import base64
import re
from typing import Any

from .cache_io import cache_snapshot, first_screen_bytes, load_proof_catalog
from .ranking import text_blob
from .text import normalize_text


PROOF_FILTER_NGRAM_MAX = 5
PROOF_FILTER_RUN_RE = re.compile(r"[a-z0-9._+\-一-鿿]{2,}")


def local_shard_maps(refs: list[dict[str, Any]], source_manifests: list[dict[str, Any]]) -> tuple[dict[str, str], dict[str, int]]:
    shard_path_by_id: dict[str, str] = {}
    shard_bytes_by_path: dict[str, int] = {}
    for ref in refs:
        for shard in ref.get("shards") or []:
            shard_path_by_id[str(shard["shard_id"])] = str(shard["path"])
            shard_bytes_by_path[str(shard["path"])] = int(shard.get("bytes") or 0)
    for source_manifest in source_manifests:
        for shard in source_manifest.get("full_shards") or []:
            shard_path_by_id[str(shard["shard_id"])] = str(shard["path"])
            shard_bytes_by_path[str(shard["path"])] = int(shard.get("bytes") or 0)
    return shard_path_by_id, shard_bytes_by_path

def proof_catalog_shards(index: dict[str, Any], source_manifests: list[dict[str, Any]]) -> list[dict[str, Any]]:
    shards: list[dict[str, Any]] = []
    for source_manifest in source_manifests:
        catalog = load_proof_catalog(index, source_manifest)
        for shard in catalog.get("shards") or []:
            scope = shard.get("scope") or {}
            shards.append(
                {
                    "shard_id": str(shard["shard_id"]),
                    "source_id": str(shard["source_id"]),
                    "path": str(shard["path"]),
                    "bytes": int(shard["bytes"]),
                    "count": int(shard["document_count"]),
                    "facet_range": [str(item) for item in scope.get("facets") or []],
                    "record_type_range": [str(item) for item in scope.get("record_types") or []],
                    "section_range": [str(item) for item in scope.get("sections") or []],
                    "year_range": [str(item) for item in scope.get("years") or []],
                    "hash_bucket": str(scope.get("hash_bucket") or ""),
                }
            )
    if shards:
        return shards
    return [
        shard
        for source_manifest in source_manifests
        for shard in source_manifest.get("full_shards") or []
    ]

def full_scan_blob(document: dict[str, Any]) -> str:
    attachment_text = " ".join(
        " ".join(str(attachment.get(field) or "") for field in ("name", "extension", "url", "section", "parent_url"))
        for attachment in document.get("attachments") or []
    )
    return normalize_text(
        " ".join(
            [
                text_blob(document, "title"),
                text_blob(document, "section"),
                text_blob(document, "nav_path"),
                text_blob(document, "nav_path_text"),
                text_blob(document, "summary"),
                text_blob(document, "content"),
                text_blob(document, "url"),
                attachment_text,
            ]
        )
    )

def full_scan_matches(document: dict[str, Any], match_phrases: list[str]) -> bool:
    blob = full_scan_blob(document)
    return any(phrase in blob for phrase in match_phrases)

def filter_token_hash_int(text: str, seed: int) -> int:
    value = (2166136261 ^ seed) & 0xFFFFFFFF
    for byte in text.encode("utf-8"):
        value ^= byte
        value = (value * 16777619) & 0xFFFFFFFF
    return value

def shard_filter_phrase_tokens(phrase: str) -> list[str]:
    text = normalize_text(phrase)
    if len(text) < 2:
        return []
    matches = list(PROOF_FILTER_RUN_RE.finditer(text))
    if len(matches) != 1 or matches[0].group(0) != text:
        return []
    tokens: set[str] = set()
    for size in range(2, min(PROOF_FILTER_NGRAM_MAX, len(text)) + 1):
        for index in range(0, len(text) - size + 1):
            tokens.add(text[index : index + size])
    return sorted(tokens, key=len, reverse=True)

def shard_filter_proves_no_match(shard_id: str, shard_filter: dict[str, Any], match_phrases: list[str]) -> bool:
    payload = shard_filter.get(shard_id)
    if not isinstance(payload, dict) or payload.get("hash_algorithm") != "bloom-fnv1a32-utf8":
        return False
    bitset_base64 = str(payload.get("bitset_base64") or "")
    bit_count = int(payload.get("bit_count") or 0)
    hash_count = int(payload.get("hash_count") or 0)
    if not bitset_base64 or bit_count <= 0 or hash_count <= 0:
        return False
    data = base64.b64decode(bitset_base64)

    def may_contain(term: str) -> bool:
        for seed in range(hash_count):
            bit = filter_token_hash_int(term, seed) % bit_count
            if (data[bit // 8] & (1 << (bit % 8))) == 0:
                return False
        return True

    phrases = [shard_filter_phrase_tokens(phrase) for phrase in match_phrases]
    if not phrases or any(not tokens for tokens in phrases):
        return False
    return all(any(not may_contain(token) for token in tokens) for tokens in phrases)

def coverage(
    index: dict[str, Any],
    *,
    phase: str,
    fields: list[str],
    proved_no_match_shards: int,
    scanned_shards: int,
    searched_documents: int,
    total_shards: int,
    total_documents: int,
    loaded_paths: set[str],
    local_index_bytes: int,
    hydrated_shard_bytes: int,
    filter_bytes: int,
    used_body_index: bool,
    exhaustive_complete: bool,
    excluded_by_filter_shards: int = 0,
    failed_shards: int = 0,
) -> dict[str, Any]:
    first_bytes = first_screen_bytes(index)
    pending_shards = 0 if exhaustive_complete else max(0, total_shards - scanned_shards - proved_no_match_shards - excluded_by_filter_shards - failed_shards)
    ledger_complete = pending_shards == 0 and failed_shards == 0
    cache = cache_snapshot(index)
    return {
        "phase": phase,
        "coverage_state": phase,
        "scope": "global",
        "searched_fields": fields,
        "proved_no_match_shards": proved_no_match_shards,
        "scanned_shards": scanned_shards,
        "excluded_by_filter_shards": excluded_by_filter_shards,
        "excluded_by_declared_scope_shards": 0,
        "pending_shards": pending_shards,
        "failed_shards": failed_shards,
        "total_shards": total_shards,
        "searched_documents": searched_documents,
        "total_documents": total_documents,
        "loaded_bytes": first_bytes + local_index_bytes + hydrated_shard_bytes + filter_bytes,
        "uncached_loaded_bytes": cache["uncached_bytes"],
        "cached_artifact_bytes": cache["cached_bytes"],
        "first_screen_bytes": first_bytes,
        "local_index_bytes": local_index_bytes,
        "hydrated_shard_bytes": hydrated_shard_bytes,
        "used_body_index": used_body_index,
        "exhaustive_complete": exhaustive_complete and ledger_complete,
        "proof_ledger": {
            "total_shards": total_shards,
            "pending_shards": pending_shards,
            "scanned_shards": scanned_shards,
            "proved_no_match_shards": proved_no_match_shards,
            "excluded_by_filter_shards": excluded_by_filter_shards,
            "excluded_by_declared_scope_shards": 0,
            "failed_shards": failed_shards,
            "complete": ledger_complete,
        },
        "cache": cache,
    }

def shard_path_for_meta(meta: dict[str, Any], shard_path_by_id: dict[str, str]) -> str:
    shard = meta.get("shard") if isinstance(meta.get("shard"), dict) else {}
    return str(shard.get("path") or shard_path_by_id.get(str(shard.get("shard_id") or ""), ""))
