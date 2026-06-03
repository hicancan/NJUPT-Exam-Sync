from __future__ import annotations

import base64
import hashlib
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from .sitegraph_artifact_io import write_hashed_json
from .sitegraph_index_postings import exhaustive_scan_blob
from .sitegraph_text import clean_text, normalize_text, sha256_text, stable_ascii_slug


PROOF_FILTER_NGRAM_MAX = 5
PROOF_FILTER_RUN_RE = re.compile(r"[a-z0-9._+\-\u4e00-\u9fff]{2,}")
FILTER_SIZING_VERSION = "proof-ngram-symbol-plus-v1"
DEFAULT_FILTER_BIT_COUNT = 1024
SMALL_FILTER_TOKEN_THRESHOLD = 256
SMALL_FILTER_BIT_COUNT = 2048
MEDIUM_FILTER_TOKEN_THRESHOLD = 1024
MEDIUM_FILTER_BIT_COUNT = 8192
LARGE_FILTER_TOKEN_THRESHOLD = 4096
LARGE_FILTER_BIT_COUNT = 32768
VERY_LARGE_FILTER_TOKEN_THRESHOLD = 12000
VERY_LARGE_FILTER_BIT_COUNT = 65536
FILTER_HASH_COUNT = 3


def filter_token_hash_int(text: str, seed: int) -> int:
    value = (2166136261 ^ seed) & 0xFFFFFFFF
    for byte in text.encode("utf-8"):
        value ^= byte
        value = (value * 16777619) & 0xFFFFFFFF
    return value


def proof_filter_tokens(value: Any, *, ngram_max: int = PROOF_FILTER_NGRAM_MAX) -> set[str]:
    text = normalize_text(value)
    tokens: set[str] = set()
    for match in PROOF_FILTER_RUN_RE.finditer(text):
        part = match.group(0)
        for size in range(2, min(ngram_max, len(part)) + 1):
            for index in range(0, len(part) - size + 1):
                tokens.add(part[index : index + size])
    return tokens


def filter_bit_count_for_tokens(tokens: list[str]) -> int:
    count = len(tokens)
    if count < SMALL_FILTER_TOKEN_THRESHOLD:
        return DEFAULT_FILTER_BIT_COUNT
    if count < MEDIUM_FILTER_TOKEN_THRESHOLD:
        return SMALL_FILTER_BIT_COUNT
    if count < LARGE_FILTER_TOKEN_THRESHOLD:
        return MEDIUM_FILTER_BIT_COUNT
    if count < VERY_LARGE_FILTER_TOKEN_THRESHOLD:
        return LARGE_FILTER_BIT_COUNT
    return VERY_LARGE_FILTER_BIT_COUNT


def build_filter_bitset(tokens: list[str], *, bit_count: int | None = None, hash_count: int = FILTER_HASH_COUNT) -> dict[str, Any]:
    bit_count = bit_count if bit_count is not None else filter_bit_count_for_tokens(tokens)
    data = bytearray(bit_count // 8)
    for token in tokens:
        for seed in range(hash_count):
            bit = filter_token_hash_int(token, seed) % bit_count
            data[bit // 8] |= 1 << (bit % 8)
    return {
        "bitset_base64": base64.b64encode(bytes(data)).decode("ascii"),
        "bit_count": bit_count,
        "hash_count": hash_count,
    }


def shard_year(document: dict[str, Any]) -> str:
    date_text = clean_text(document.get("published_at")) or clean_text(document.get("version_date"))
    match = re.search(r"(20\d{2}|19\d{2})", date_text)
    return match.group(1) if match else "undated"


def shard_section(document: dict[str, Any]) -> str:
    nav_path = document.get("nav_path") if isinstance(document.get("nav_path"), list) else []
    section = nav_path[0] if nav_path else document.get("section_id") or document.get("section")
    return stable_ascii_slug(section, fallback="root", max_length=32)


def shard_bucket(document: dict[str, Any], bucket_count: int = 4) -> str:
    digest = hashlib.sha1(str(document.get("id") or "").encode("utf-8")).hexdigest()
    return f"b{int(digest[:2], 16) % bucket_count}"


def shard_id_for_document(document: dict[str, Any]) -> str:
    return "__".join(
        [
            stable_ascii_slug(document.get("source_id"), fallback="source"),
            stable_ascii_slug(document.get("facet"), fallback="facet"),
            stable_ascii_slug(document.get("record_type"), fallback="record"),
            shard_year(document),
            shard_section(document),
            shard_bucket(document),
        ]
    )


def build_locality_shards(
    documents: list[dict[str, Any]],
    *,
    public_root: Path,
    shard_dir: Path,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for document in documents:
        groups[shard_id_for_document(document)].append(document)

    shard_refs: list[dict[str, Any]] = []
    shard_by_id: dict[str, dict[str, Any]] = {}
    shard_filter: dict[str, dict[str, Any]] = {}
    for shard_id in sorted(groups):
        shard_docs = sorted(groups[shard_id], key=lambda item: int(item["doc_index"]))
        facets = sorted({str(item.get("facet")) for item in shard_docs})
        record_types = sorted({str(item.get("record_type")) for item in shard_docs})
        sections = sorted({str(item.get("section_id") or "unknown") for item in shard_docs})
        years = sorted({shard_year(item) for item in shard_docs})
        payload_docs = [
            {key: value for key, value in document.items() if key != "shard"}
            for document in shard_docs
        ]
        filter_tokens = sorted({
            token
            for document in payload_docs
            for token in proof_filter_tokens(exhaustive_scan_blob(document))
        })
        filter_bitset = build_filter_bitset(filter_tokens)
        filter_hash = sha256_text(filter_bitset["bitset_base64"], length=32)
        artifact = write_hashed_json(public_root, shard_dir, f"full.{shard_id}", payload_docs, compact=True)
        shard_ref = {
            "shard_id": shard_id,
            "path": artifact["path"],
            "sha256": artifact["sha256"],
            "bytes": artifact["bytes"],
            "count": len(shard_docs),
            "contains": "full_documents",
            "source_id": str(shard_docs[0].get("source_id") or ""),
            "facet_range": facets,
            "record_type_range": record_types,
            "section_range": sections[:24],
            "year_range": years,
            "hash_bucket": shard_id.rsplit("__", 1)[-1],
            "filter_token_count": len(filter_tokens),
            "filter_sha256": filter_hash,
        }
        shard_filter[shard_id] = {
            **filter_bitset,
            "token_count": len(filter_tokens),
            "sha256": filter_hash,
            "hash_algorithm": "bloom-fnv1a32-utf8",
            "sizing": FILTER_SIZING_VERSION,
            "coverage_fields": ["title", "section", "nav_path", "summary", "content", "attachments", "url"],
        }
        shard_refs.append(shard_ref)
        shard_by_id[shard_id] = shard_ref
        for document in shard_docs:
            document["shard"] = {
                "shard_id": shard_id,
            }
    return shard_refs, shard_by_id, shard_filter
