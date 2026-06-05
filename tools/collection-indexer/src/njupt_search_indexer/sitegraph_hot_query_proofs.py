from __future__ import annotations

import unicodedata
from pathlib import Path
from typing import Any

from .sitegraph_text import clean_text, normalize_text, sitegraph_tokens

from .hot_queries.constants import (
    HOT_QUERY_ATTACHMENT_HEAD_LIMIT,
    HOT_QUERY_ATTACHMENT_SAMPLE_LIMIT,
    HOT_QUERY_CERTIFICATE_MODEL,
    HOT_QUERY_COMPLETE_CERTIFICATE_VERSION,
    HOT_QUERY_COMPLETE_PROOF_MODEL,
    HOT_QUERY_CONTENT_CONTEXT_CHARS,
    HOT_QUERY_CONTENT_FALLBACK_CHARS,
    HOT_QUERY_FAST_START_VERSION,
    HOT_QUERY_INITIAL_CERTIFICATE_VERSION,
    HOT_QUERY_INITIAL_LIMIT,
    HOT_QUERY_MAX_CONTENT_WINDOWS,
    HOT_QUERY_MAX_SUMMARY_WINDOWS,
    HOT_QUERY_PROOF_DOCUMENT_ENCODING,
    HOT_QUERY_RANK_EVIDENCE_MODEL,
    HOT_QUERY_SUMMARY_CONTEXT_CHARS,
    HOT_QUERY_SUMMARY_FALLBACK_CHARS,
    HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL,
    HOT_QUERY_TOPK_CERTIFICATE_VERSION,
    HOT_QUERY_TOPK_LIMIT,
)
from .hot_queries.ranking import (
    hot_query_rank_base_score,
    hot_query_runtime_rank_score,
    hot_query_topk_sort_key,
)


def expand_hot_query_proof_phrases(query: str, aliases: dict[str, Any]) -> list[str]:
    candidates = [query]
    normalized_query = normalize_text(query)
    for key, payload in aliases.items():
        normalized_key = normalize_text(key)
        alias_terms: list[str] = []
        if isinstance(payload, dict) and isinstance(payload.get("aliases"), list):
            alias_terms.extend(str(item) for item in payload["aliases"])
        alias_hits = [
            normalized_alias
            for term in alias_terms
            if (normalized_alias := normalize_text(term))
            and (normalized_query == normalized_alias or (len(normalized_alias) >= 4 and normalized_alias in normalized_query))
        ]
        if (normalized_key and normalized_key in normalized_query) or alias_hits:
            candidates.extend([key, *alias_terms])
    return sorted(
        {normalize_text(item) for item in candidates if len(normalize_text(item)) >= 2},
        key=lambda text: (-len(text), text),
    )


def hot_query_phrase_key(match_phrases: list[str]) -> str:
    return "\u0000".join(sorted(match_phrases, key=lambda text: (-len(text), text)))


def hot_query_proof_terms(query: str, match_phrases: list[str]) -> list[str]:
    tokens: set[str] = set()
    for phrase in [query, *match_phrases]:
        normalized = normalize_text(phrase)
        if len(normalized) >= 2:
            tokens.add(normalized)
        tokens.update(sitegraph_tokens(normalized, cjk_max_n=5))
    return sorted(tokens, key=lambda text: (-len(text), text))


def hot_query_runtime_terms(query: str, match_phrases: list[str]) -> list[str]:
    return hot_query_proof_terms(query, match_phrases)


def normalized_source_spans(text: str) -> tuple[str, list[int], list[int]]:
    normalized_chars: list[str] = []
    source_starts: list[int] = []
    source_ends: list[int] = []
    for source_index, char in enumerate(text):
        normalized = unicodedata.normalize("NFKC", char).lower()
        for normalized_char in normalized:
            if normalized_char.isspace():
                continue
            normalized_chars.append(normalized_char)
            source_starts.append(source_index)
            source_ends.append(source_index + 1)
    return "".join(normalized_chars), source_starts, source_ends


def merge_text_windows(windows: list[tuple[int, int]], *, max_windows: int) -> list[tuple[int, int]]:
    merged: list[tuple[int, int]] = []
    for start, end in sorted(windows):
        if start >= end:
            continue
        if not merged or start > merged[-1][1] + 8:
            merged.append((start, end))
            continue
        previous_start, previous_end = merged[-1]
        merged[-1] = (previous_start, max(previous_end, end))
    return merged[:max_windows]


def compact_text_windows(
    value: Any,
    needles: list[str],
    *,
    context_chars: int,
    max_windows: int,
    fallback_chars: int,
) -> str:
    text = clean_text(value)
    if not text:
        return ""
    if len(text) <= fallback_chars:
        return text
    normalized, source_starts, source_ends = normalized_source_spans(text)
    normalized_needles = []
    seen_needles: set[str] = set()
    for needle in needles:
        normalized_needle = normalize_text(needle)
        if len(normalized_needle) < 2 or normalized_needle in seen_needles:
            continue
        seen_needles.add(normalized_needle)
        normalized_needles.append(normalized_needle)
    windows: list[tuple[int, int]] = []
    for needle in normalized_needles:
        normalized_index = normalized.find(needle)
        if normalized_index < 0:
            continue
        normalized_end = normalized_index + len(needle) - 1
        if normalized_index >= len(source_starts) or normalized_end >= len(source_ends):
            continue
        source_start = source_starts[normalized_index]
        source_end = source_ends[normalized_end]
        windows.append((max(0, source_start - context_chars), min(len(text), source_end + context_chars)))
        if len(windows) >= max_windows:
            break
    if not windows:
        return text[:fallback_chars].strip()
    return " ... ".join(text[start:end].strip() for start, end in merge_text_windows(windows, max_windows=max_windows) if text[start:end].strip())


def attachment_matches_needles(attachment: dict[str, Any], needles: list[str]) -> bool:
    blob = normalize_text(" ".join(str(attachment.get(field) or "") for field in ("name", "extension", "url", "section", "parent_url")))
    return any(needle in blob for needle in needles)


def compact_attachment_payload(attachment: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for key in (
        "attachment_id", "name", "url", "extension", "parent_url", "section",
    ):
        if key in attachment and attachment.get(key) is not None:
            payload[key] = attachment.get(key)
    payload["metadata_only"] = True
    return payload


def compact_hot_query_attachments(document: dict[str, Any], needles: list[str]) -> list[dict[str, Any]]:
    attachments = document.get("attachments") if isinstance(document.get("attachments"), list) else []
    if len(attachments) <= HOT_QUERY_ATTACHMENT_SAMPLE_LIMIT:
        return [compact_attachment_payload(attachment) for attachment in attachments if isinstance(attachment, dict)]
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add_attachment(attachment: dict[str, Any]) -> None:
        key = f"{attachment.get('attachment_id') or ''}\0{attachment.get('url') or ''}\0{attachment.get('name') or ''}"
        if key in seen or len(selected) >= HOT_QUERY_ATTACHMENT_SAMPLE_LIMIT:
            return
        seen.add(key)
        selected.append(compact_attachment_payload(attachment))

    normalized_needles = [normalize_text(needle) for needle in needles if len(normalize_text(needle)) >= 2]
    for attachment in attachments:
        if isinstance(attachment, dict) and attachment_matches_needles(attachment, normalized_needles):
            add_attachment(attachment)
    for attachment in attachments[:HOT_QUERY_ATTACHMENT_HEAD_LIMIT]:
        if isinstance(attachment, dict):
            add_attachment(attachment)
    if not selected:
        for attachment in attachments[:HOT_QUERY_ATTACHMENT_SAMPLE_LIMIT]:
            if isinstance(attachment, dict):
                add_attachment(attachment)
    return selected


def compact_hot_query_provenance(document: dict[str, Any]) -> dict[str, Any]:
    provenance = document.get("provenance") if isinstance(document.get("provenance"), dict) else {}
    return {
        "site_id": str(provenance.get("site_id") or document.get("source_id") or "unknown"),
        "outcome": str(provenance.get("outcome") or "ok"),
    }


def hot_query_proof_needles(query: str, match_phrases: list[str]) -> list[str]:
    proof_needles: list[str] = []
    seen_needles: set[str] = set()
    for needle in [query, *match_phrases, *hot_query_proof_terms(query, match_phrases)]:
        normalized_needle = normalize_text(needle)
        if len(normalized_needle) < 2 or normalized_needle in seen_needles:
            continue
        seen_needles.add(normalized_needle)
        proof_needles.append(needle)
    return proof_needles


def hot_query_match_evidence(document: dict[str, Any], proof_needles: list[str]) -> dict[str, Any]:
    fields = {
        "title": document.get("title"),
        "section": " ".join(str(document.get(field) or "") for field in ("section", "nav_path_text")),
        "summary": document.get("summary"),
        "content": document.get("content"),
        "url": document.get("url"),
        "attachments": " ".join(
            " ".join(str(attachment.get(field) or "") for field in ("name", "extension", "url", "section", "parent_url"))
            for attachment in document.get("attachments") or []
            if isinstance(attachment, dict)
        ),
    }
    matched_fields: list[str] = []
    matched_phrases: list[str] = []
    normalized_needles = [normalize_text(needle) for needle in proof_needles if len(normalize_text(needle)) >= 2]
    for field, value in fields.items():
        normalized_value = normalize_text(value)
        if not normalized_value:
            continue
        for needle in normalized_needles:
            if needle in normalized_value:
                matched_fields.append(field)
                matched_phrases.append(needle)
    return {
        "fields": sorted(set(matched_fields)),
        "phrases": sorted(set(matched_phrases), key=lambda text: (-len(text), text)),
    }


def hot_query_proof_document_payload(
    document: dict[str, Any],
    query: str,
    match_phrases: list[str],
    rank_terms: list[str],
) -> dict[str, Any]:
    shard = document.get("shard") if isinstance(document.get("shard"), dict) else {}
    payload: dict[str, Any] = {
        "doc_index": int(document["doc_index"]),
        "id": str(document["id"]),
        "source_id": str(document["source_id"]),
        "facet": str(document["facet"]),
        "record_type": str(document["record_type"]),
        "shard_id": str(shard.get("shard_id") or ""),
        "rank_base_score": hot_query_rank_base_score(document, rank_terms),
        "match_evidence": hot_query_match_evidence(document, hot_query_proof_needles(query, match_phrases)),
    }
    for key in ("published_at", "updated_at", "recorded_at", "version_date", "date_kind", "date_confidence"):
        if key in document and document.get(key) is not None:
            payload[key] = document.get(key)
    return payload


def _intern_compact_value(
    dictionaries: dict[str, list[str]],
    indexes: dict[str, dict[str, int]],
    key: str,
    value: Any,
) -> int:
    text = str(value or "")
    existing = indexes[key].get(text)
    if existing is not None:
        return existing
    indexes[key][text] = len(dictionaries[key])
    dictionaries[key].append(text)
    return indexes[key][text]


def _compact_rank_score(value: float) -> int | float:
    rounded = round(float(value), 4)
    return int(rounded) if rounded.is_integer() else rounded


def _compact_date_index(
    dictionaries: dict[str, list[str]],
    indexes: dict[str, dict[str, int]],
    key: str,
    document: dict[str, Any],
) -> int:
    if key not in document or document.get(key) is None:
        return -1
    return _intern_compact_value(dictionaries, indexes, "dates", document.get(key))


def _compact_optional_string_index(
    dictionaries: dict[str, list[str]],
    indexes: dict[str, dict[str, int]],
    dictionary_key: str,
    document_key: str,
    document: dict[str, Any],
) -> int:
    if document_key not in document or document.get(document_key) is None:
        return -1
    return _intern_compact_value(dictionaries, indexes, dictionary_key, document.get(document_key))


def compact_hot_query_proof_documents(
    documents: list[dict[str, Any]],
    query: str,
    match_phrases: list[str],
    rank_terms: list[str],
) -> tuple[dict[str, list[str]], list[list[Any]]]:
    dictionaries: dict[str, list[str]] = {
        "source_ids": [],
        "facets": [],
        "record_types": [],
        "shards": [],
        "fields": [],
        "phrases": [],
        "dates": [],
        "date_kinds": [],
        "date_confidences": [],
    }
    indexes: dict[str, dict[str, int]] = {key: {} for key in dictionaries}
    proof_needles = hot_query_proof_needles(query, match_phrases)
    rows: list[list[Any]] = []
    for document in documents:
        evidence = hot_query_match_evidence(document, proof_needles)
        phrases = evidence["phrases"][:1]
        if not phrases:
            raise ValueError(f"hot query proof document has no matching phrase for query {query!r}")
        fields = evidence["fields"][:1] or ["content"]
        shard = document.get("shard") if isinstance(document.get("shard"), dict) else {}
        row: list[Any] = [
            int(document["doc_index"]),
            _intern_compact_value(dictionaries, indexes, "source_ids", document.get("source_id")),
            _intern_compact_value(dictionaries, indexes, "facets", document.get("facet")),
            _intern_compact_value(dictionaries, indexes, "record_types", document.get("record_type")),
            _intern_compact_value(dictionaries, indexes, "shards", shard.get("shard_id") or ""),
            _compact_rank_score(hot_query_rank_base_score(document, rank_terms)),
            [_intern_compact_value(dictionaries, indexes, "fields", field) for field in fields],
            [_intern_compact_value(dictionaries, indexes, "phrases", phrase) for phrase in phrases],
        ]
        optional_tail = [
            _compact_date_index(dictionaries, indexes, "published_at", document),
            -1,
            -1,
            _compact_date_index(dictionaries, indexes, "version_date", document),
        ]
        while optional_tail and optional_tail[-1] < 0:
            optional_tail.pop()
        row.extend(optional_tail)
        rows.append(row)
    return dictionaries, rows


def hot_query_document_payload(
    document: dict[str, Any],
    query: str,
    match_phrases: list[str],
    rank_terms: list[str],
) -> dict[str, Any]:
    proof_needles = hot_query_proof_needles(query, match_phrases)
    original_content = clean_text(document.get("content"))
    content = compact_text_windows(
        original_content,
        proof_needles,
        context_chars=HOT_QUERY_CONTENT_CONTEXT_CHARS,
        max_windows=HOT_QUERY_MAX_CONTENT_WINDOWS,
        fallback_chars=HOT_QUERY_CONTENT_FALLBACK_CHARS,
    ) or original_content[:1] or "."
    payload: dict[str, Any] = {
        "doc_index": int(document["doc_index"]),
        "id": str(document["id"]),
        "record_type": str(document["record_type"]),
        "page_type": str(document["page_type"]),
        "facet": str(document["facet"]),
        "title": str(document["title"]),
        "url": str(document["url"]),
        "source_id": str(document["source_id"]),
        "source": str(document["source"]),
        "source_domain": str(document["source_domain"]),
        "section": str(document["section"]),
        "nav_path": document.get("nav_path") if isinstance(document.get("nav_path"), list) else [],
        "nav_path_text": str(document.get("nav_path_text") or ""),
        "summary": compact_text_windows(
            document.get("summary"),
            proof_needles,
            context_chars=HOT_QUERY_SUMMARY_CONTEXT_CHARS,
            max_windows=HOT_QUERY_MAX_SUMMARY_WINDOWS,
            fallback_chars=HOT_QUERY_SUMMARY_FALLBACK_CHARS,
        ),
        "attachment_count": int(document.get("attachment_count") or len(document.get("attachments") or [])),
        "hash": str(document["hash"]),
        "collection_method": str(document["collection_method"]),
        "provenance": compact_hot_query_provenance(document),
        "content": content,
        "content_normalized_length": len(normalize_text(original_content)),
        "rank_base_score": hot_query_rank_base_score(document, rank_terms),
        "attachments": compact_hot_query_attachments(document, proof_needles),
    }
    for key in (
        "published_at", "updated_at", "recorded_at",
        "version_date", "academic_year", "term", "task_kind", "publisher",
    ):
        if key in document and document.get(key) is not None:
            payload[key] = document.get(key)
    return payload
