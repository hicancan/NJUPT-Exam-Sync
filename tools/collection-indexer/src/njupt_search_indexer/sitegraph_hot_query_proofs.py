from __future__ import annotations

import json
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .sitegraph_index_postings import FIELD_CODES, FIELD_IMPACTS
from .sitegraph_text import clean_text, normalize_text, sitegraph_tokens


BASE_DIR = Path(__file__).resolve().parents[4]
SEARCH_INTENT_CONFIG = json.loads(
    (BASE_DIR / "packages" / "search-core" / "src" / "intent" / "queryIntentProfiles.json").read_text(encoding="utf-8")
)
HOT_QUERY_CERTIFICATE_MODEL = "hot-query-minimal-complete-proof-v3"
HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL = "rank-display-match-window-certificate-v2"
HOT_QUERY_COMPLETE_PROOF_MODEL = "match-proof-minimal-filter-v1"
HOT_QUERY_RANK_EVIDENCE_MODEL = "query-token-field-impact-full-document-v1"
HOT_QUERY_TOPK_CERTIFICATE_VERSION = "sitegraph-hot-query-topk-certificate-v2"
HOT_QUERY_COMPLETE_CERTIFICATE_VERSION = "sitegraph-hot-query-complete-certificate-v3"
HOT_QUERY_TOPK_LIMIT = 80
HOT_QUERY_CONTENT_CONTEXT_CHARS = 128
HOT_QUERY_SUMMARY_CONTEXT_CHARS = 80
HOT_QUERY_CONTENT_FALLBACK_CHARS = 180
HOT_QUERY_SUMMARY_FALLBACK_CHARS = 360
HOT_QUERY_MAX_CONTENT_WINDOWS = 16
HOT_QUERY_MAX_SUMMARY_WINDOWS = 6
HOT_QUERY_ATTACHMENT_SAMPLE_LIMIT = 4
HOT_QUERY_ATTACHMENT_HEAD_LIMIT = 4


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
    return sorted({normalize_text(item) for item in candidates if len(normalize_text(item)) >= 2}, key=len, reverse=True)


def hot_query_phrase_key(match_phrases: list[str]) -> str:
    return "\u0000".join(sorted(match_phrases, key=lambda text: (-len(text), text)))


def hot_query_text_blob(document: dict[str, Any], *fields: str) -> str:
    values: list[str] = []
    for field in fields:
        value = document.get(field)
        if isinstance(value, list):
            values.extend(str(item) for item in value)
        elif value is not None:
            values.append(str(value))
    return normalize_text(" ".join(values))


def hot_query_attachment_blob(document: dict[str, Any]) -> str:
    return normalize_text(
        " ".join(
            " ".join(str(attachment.get(field) or "") for field in ("name", "extension", "section", "parent_url"))
            for attachment in document.get("attachments") or []
            if isinstance(attachment, dict)
        )
    )


def hot_query_source_id(document: dict[str, Any]) -> str:
    provenance = document.get("provenance") if isinstance(document.get("provenance"), dict) else {}
    return str(document.get("source_id") or provenance.get("site_id") or str(document.get("id") or "").split("-", 1)[0] or "")


def hot_query_includes_any(text: str, terms: list[str]) -> bool:
    return any(normalize_text(term) in text for term in terms)


def hot_query_dynamic_system_authority_sources(text: str) -> list[str]:
    for rule in SEARCH_INTENT_CONFIG["intent_detection"]["system_authority_rules"]:
        if hot_query_includes_any(text, [str(item) for item in rule.get("match_any") or []]):
            return [str(rule["source_id"])]
    return [str(item) for item in SEARCH_INTENT_CONFIG["intent_detection"]["system_default_authority_sources"]]


def hot_query_detect_intent(query: str) -> dict[str, Any]:
    text = normalize_text(query)
    for rule in SEARCH_INTENT_CONFIG["intent_detection"]["profiles"]:
        if not hot_query_includes_any(text, [str(item) for item in rule.get("match_any") or []]):
            continue
        authority_sources = (
            hot_query_dynamic_system_authority_sources(text)
            if rule.get("authority_sources") == "dynamic_system"
            else [str(item) for item in rule.get("authority_sources") or []]
        )
        return {
            "intent": str(rule["intent"]),
            "authority_sources": authority_sources,
            "freshness_mode": str(rule["freshness_mode"]),
        }
    fallback = SEARCH_INTENT_CONFIG["intent_detection"]["fallback_profile"]
    return {
        "intent": str(fallback["intent"]),
        "authority_sources": [str(item) for item in fallback.get("authority_sources") or []],
        "freshness_mode": str(fallback["freshness_mode"]),
    }


def hot_query_date_sort_value(raw: Any) -> float:
    if not raw:
        return 0.0
    try:
        parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


def hot_query_age_days(timestamp: float) -> float:
    return max(0.0, (datetime.now(timezone.utc).timestamp() - timestamp) / 86_400)


def hot_query_decayed_freshness(timestamp: float, max_score: float, horizon_days: float) -> float:
    if not timestamp:
        return 0.0
    return max(0.0, max_score - min(hot_query_age_days(timestamp), horizon_days) / horizon_days * max_score)


def hot_query_freshness_score(document: dict[str, Any], mode: str) -> float:
    config = SEARCH_INTENT_CONFIG["ranking"]["freshness"].get(mode)
    if not isinstance(config, dict):
        return 0.0
    if mode == "official_entry":
        return float(config.get("system_facet_score") or 0.0) if document.get("facet") == "system" else 0.0
    timestamp = (
        hot_query_date_sort_value(document.get("version_date")) or hot_query_date_sort_value(document.get("published_at"))
        if mode == "form_version"
        else hot_query_date_sort_value(document.get("published_at")) or hot_query_date_sort_value(document.get("version_date"))
    )
    return hot_query_decayed_freshness(
        timestamp,
        float(config.get("max_score") or 0.0),
        float(config.get("horizon_days") or 3650.0),
    )


def hot_query_stale_penalty(document: dict[str, Any], mode: str) -> float:
    config = SEARCH_INTENT_CONFIG["ranking"]["stale_penalty"]
    if mode not in {str(item) for item in config["modes"]}:
        return 0.0
    value = hot_query_date_sort_value(document.get("published_at")) or hot_query_date_sort_value(document.get("version_date"))
    if not value:
        return 0.0
    days = hot_query_age_days(value)
    for threshold in config["thresholds"]:
        threshold_modes = threshold.get("modes")
        if isinstance(threshold_modes, list) and mode not in {str(item) for item in threshold_modes}:
            continue
        if days > float(threshold["older_than_days"]):
            return float(threshold["score"])
    return 0.0


def hot_query_normalized_content_length(document: dict[str, Any]) -> int:
    certified = document.get("content_normalized_length")
    if isinstance(certified, int | float):
        return int(certified)
    return len(normalize_text(document.get("content")))


def hot_query_is_short_landing_page(document: dict[str, Any], normalized_query: str, title: str) -> bool:
    return (
        title == normalized_query
        and document.get("facet") in {"workflow", "news", "notice_article"}
        and not hot_query_date_sort_value(document.get("published_at"))
        and hot_query_normalized_content_length(document) < 220
    )


def hot_query_runtime_rank_score(document: dict[str, Any], query: str, terms: list[str], base_score: float) -> float:
    profile = hot_query_detect_intent(query)
    normalized_query = normalize_text(query)
    title = hot_query_text_blob(document, "title")
    canonical_title = hot_query_text_blob(document, "canonical_title")
    section = hot_query_text_blob(document, "section", "nav_path_text")
    summary = hot_query_text_blob(document, "summary")
    content = hot_query_text_blob(document, "content")
    tags = hot_query_text_blob(document, "tags")
    attachment = hot_query_attachment_blob(document)
    url = hot_query_text_blob(document, "url")
    external = normalize_text(f"{document.get('title') or ''} {document.get('url') or ''} {document.get('summary') or ''}") if document.get("record_type") == "external" else ""
    text_weights = SEARCH_INTENT_CONFIG["ranking"]["text_match"]
    term_weights = SEARCH_INTENT_CONFIG["ranking"]["term_match"]
    authority_weights = SEARCH_INTENT_CONFIG["ranking"]["authority"]
    score = float(base_score)

    if normalized_query and (title == normalized_query or canonical_title == normalized_query):
        score += float(text_weights["system_title_exact"] if document.get("facet") == "system" else text_weights["title_exact"])
    elif normalized_query and (normalized_query in title or normalized_query in canonical_title):
        score += float(text_weights["title_contains"])
        if len(normalized_query) >= int(text_weights["long_query_min_length"]):
            score += float(text_weights["long_query_title_contains_extra"])
    if normalized_query and normalized_query in attachment:
        score += float(text_weights["attachment_contains"])
    if normalized_query and normalized_query in external:
        score += float(text_weights["external_contains"])
    if normalized_query and normalized_query in url:
        score += float(text_weights["url_contains"])
    if normalized_query and normalized_query in section:
        score += float(text_weights["section_contains"])
    if normalized_query and normalized_query in content:
        score += float(text_weights["content_contains"])
    if normalized_query and normalized_query in tags:
        score += float(text_weights["tags_contains"])

    for term in terms[:12]:
        if term in title or term in canonical_title:
            score += float(term_weights["title"])
        elif term in attachment:
            score += float(term_weights["attachment"])
        elif term in external:
            score += float(term_weights["external"])
        elif term in url:
            score += float(term_weights["url"])
        elif term in section:
            score += float(term_weights["section"])
        elif term in summary or term in content:
            score += float(term_weights["summary_or_content"])

    source_id = hot_query_source_id(document)
    authority_sources = profile["authority_sources"]
    if source_id in authority_sources:
        score += float(
            authority_weights["broad_source_boost"]
            if profile["intent"] == "broad_exploratory"
            else authority_weights["focused_source_boost"]
        )
    elif len(authority_sources) == 1 and profile["intent"] != "broad_exploratory":
        score -= float(authority_weights["single_source_miss_penalty"])

    for boost in SEARCH_INTENT_CONFIG["ranking"]["facet_boosts"]:
        if document.get("facet") == boost["facet"] and profile["intent"] in {str(item) for item in boost["intents"]}:
            score += float(boost["score"])
    if normalize_text(document.get("task_kind")) == normalize_text(profile["intent"]):
        score += float(SEARCH_INTENT_CONFIG["ranking"]["task_kind_match"])
    score += hot_query_freshness_score(document, profile["freshness_mode"])
    score -= hot_query_stale_penalty(document, profile["freshness_mode"])
    if profile["intent"] == "academic_policy" and hot_query_is_short_landing_page(document, normalized_query, title):
        score -= float(SEARCH_INTENT_CONFIG["ranking"]["short_landing_page_penalty"])
    if profile["intent"] == "form_download" and document.get("record_type") == "external":
        score -= float(SEARCH_INTENT_CONFIG["ranking"]["form_download_external_penalty"])
    if profile["intent"] == "scholarship_aid" and "学业困难" in title and "家庭经济困难" not in title:
        score -= float(SEARCH_INTENT_CONFIG["ranking"]["scholarship_non_financial_hardship_penalty"])
    return round(score, 4)


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


def hot_query_rank_field_tokens(document: dict[str, Any], field: str) -> set[str]:
    if field == "title":
        return sitegraph_tokens(document.get("title"), cjk_max_n=4, cap=120)
    if field == "section":
        return sitegraph_tokens([document.get("section"), document.get("nav_path_text")], cjk_max_n=4, cap=80)
    if field == "nav_path":
        return sitegraph_tokens(" ".join(document.get("nav_path") or []), cjk_max_n=4, cap=80)
    if field == "tag":
        return sitegraph_tokens(" ".join(document.get("tags") or []), cjk_max_n=4)
    if field == "attachment":
        attachment_text = " ".join(
            " ".join(clean_text(attachment.get(key)) for key in ("name", "extension", "section"))
            for attachment in document.get("attachments") or []
            if isinstance(attachment, dict)
        )
        return sitegraph_tokens(attachment_text, cjk_max_n=4, cap=80)
    if field == "external":
        return set() if document.get("record_type") != "external" else sitegraph_tokens([document.get("title"), document.get("url")], cjk_max_n=5)
    if field == "system":
        if document.get("record_type") != "utility" and document.get("facet") != "system":
            return set()
        return sitegraph_tokens([document.get("title"), document.get("url"), document.get("section")], cjk_max_n=5)
    if field == "summary":
        return sitegraph_tokens(document.get("summary"), cjk_max_n=4, cap=80)
    if field == "content":
        return sitegraph_tokens(document.get("content"), cjk_max_n=3, cap=180)
    return set()


def hot_query_rank_base_score(document: dict[str, Any], terms: list[str]) -> float:
    score = 0.0
    for field in ("title", "section", "nav_path", "tag", "attachment", "external", "system", "summary", "content"):
        field_tokens = hot_query_rank_field_tokens(document, field)
        if not field_tokens:
            continue
        field_impact = FIELD_IMPACTS[FIELD_CODES[field]]
        for term in terms:
            if term in field_tokens:
                score += field_impact + min(len(term), 8)
    return round(score, 4)


def hot_query_sort_timestamp(document: dict[str, Any]) -> float:
    for key in ("published_at", "version_date"):
        value = document.get(key)
        if not value:
            continue
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            continue
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.timestamp()
    return 0.0


def hot_query_topk_sort_key(document: dict[str, Any], query: str, terms: list[str]) -> tuple[float, float, str]:
    base_score = float(document.get("rank_base_score") or 0.0)
    return (-hot_query_runtime_rank_score(document, query, terms, base_score), -hot_query_sort_timestamp(document), str(document.get("id") or ""))


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
        "attachment_id", "name", "url", "extension", "parent_url", "parent_doc_id",
        "section_id", "section", "nav_path", "metadata_only", "evidence_level",
        "available_evidence", "unavailable_evidence", "text_extracted",
        "snippet_available", "full_content_available", "coverage_note", "position",
    ):
        if key in attachment and attachment.get(key) is not None:
            payload[key] = attachment.get(key)
    payload.setdefault("metadata_only", True)
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
        "hash": str(document["hash"]),
        "rank_base_score": hot_query_rank_base_score(document, rank_terms),
        "match_evidence": hot_query_match_evidence(document, hot_query_proof_needles(query, match_phrases)),
    }
    for key in ("published_at", "updated_at", "recorded_at", "version_date", "date_kind", "date_confidence"):
        if key in document and document.get(key) is not None:
            payload[key] = document.get(key)
    return payload


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
        "tags": [
            tag
            for tag in (document.get("tags") if isinstance(document.get("tags"), list) else [])
            if any(needle in normalize_text(tag) for needle in proof_needles)
        ],
        "collection_method": str(document["collection_method"]),
        "provenance": compact_hot_query_provenance(document),
        "content": content,
        "content_normalized_length": len(normalize_text(original_content)),
        "rank_base_score": hot_query_rank_base_score(document, rank_terms),
        "attachments": compact_hot_query_attachments(document, proof_needles),
    }
    for key in (
        "canonical_title", "section_id", "published_at", "updated_at", "recorded_at",
        "version_date", "date_kind", "date_confidence", "academic_year", "term",
        "task_kind", "authority_profile", "dedupe_key", "publisher",
    ):
        if key in document and document.get(key) is not None:
            payload[key] = document.get(key)
    return payload
