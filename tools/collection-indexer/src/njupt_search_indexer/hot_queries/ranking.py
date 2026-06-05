from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..sitegraph_index_postings import FIELD_CODES, FIELD_IMPACTS
from ..sitegraph_text import normalize_text, sitegraph_tokens
from .constants import SEARCH_INTENT_CONFIG


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


def hot_query_structural_needles(normalized_query: str, terms: list[str]) -> list[str]:
    needles = [normalized_query] if len(normalized_query) >= 3 else []
    needles.extend(term for term in terms if len(term) >= 4)
    return list(dict.fromkeys(needles))


def hot_query_structural_match_length(text: str, needles: list[str]) -> int:
    return max((len(needle) for needle in needles if needle in text), default=0)


def hot_query_structural_boost(field: str, length: int) -> float:
    capped = min(length, 10)
    if field == "attachment":
        return 1200.0 + capped * 250.0
    if field == "url":
        return 600.0 + capped * 120.0
    if field == "tags":
        return 450.0 + capped * 90.0
    return 1600.0 + capped * 400.0


def hot_query_structural_relevance_score(
    normalized_query: str,
    terms: list[str],
    *,
    attachment: str,
    section: str,
    tags: str,
    title: str,
    url: str,
) -> float:
    needles = hot_query_structural_needles(normalized_query, terms)
    score = 0.0
    for field, text in (
        ("title", title),
        ("section", section),
        ("attachment", attachment),
        ("url", url),
        ("tags", tags),
    ):
        match_length = hot_query_structural_match_length(text, needles)
        if match_length > 0:
            score += hot_query_structural_boost(field, match_length)
    return score


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
    source_id = hot_query_source_id(document)
    task_kind = normalize_text(document.get("task_kind") or "")
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
    score += hot_query_structural_relevance_score(
        normalized_query,
        terms,
        attachment=attachment,
        section=section,
        tags=tags,
        title=title,
        url=url,
    )

    if source_id in profile["authority_sources"]:
        score += float(authority_weights["broad_source_boost"] if profile["intent"] == "broad_exploratory" else authority_weights["focused_source_boost"])
    elif len(profile["authority_sources"]) == 1 and profile["intent"] != "broad_exploratory":
        score -= float(authority_weights["single_source_miss_penalty"])

    for boost in SEARCH_INTENT_CONFIG["ranking"]["facet_boosts"]:
        if document.get("facet") == boost["facet"] and profile["intent"] in {str(item) for item in boost["intents"]}:
            score += float(boost["score"])
    if task_kind == normalize_text(profile["intent"]):
        score += float(SEARCH_INTENT_CONFIG["ranking"]["task_kind_match"])
    score += hot_query_freshness_score(document, profile["freshness_mode"])
    score -= hot_query_stale_penalty(document, profile["freshness_mode"])
    if profile["intent"] == "academic_policy" and hot_query_is_short_landing_page(document, normalized_query, title):
        score -= float(SEARCH_INTENT_CONFIG["ranking"]["short_landing_page_penalty"])
    if profile["intent"] == "form_download" and document.get("record_type") == "external":
        score -= float(SEARCH_INTENT_CONFIG["ranking"]["form_download_external_penalty"])
    if profile["intent"] == "scholarship_aid" and "学业困难" in title and "家庭经济困难" not in title:
        score -= float(SEARCH_INTENT_CONFIG["ranking"]["scholarship_non_financial_hardship_penalty"])
    return score


def hot_query_rank_field_tokens(document: dict[str, Any], field: str) -> set[str]:
    if field == "t":
        values = [document.get("title"), document.get("canonical_title")]
    elif field == "s":
        values = [document.get("summary")]
    elif field == "b":
        values = [document.get("content")]
    elif field == "c":
        values = [document.get("section"), document.get("nav_path_text")]
    elif field == "g":
        values = document.get("tags") if isinstance(document.get("tags"), list) else []
    elif field == "a":
        values = [
            " ".join(str(attachment.get(key) or "") for key in ("name", "extension", "section", "parent_url"))
            for attachment in document.get("attachments") or []
            if isinstance(attachment, dict)
        ]
    elif field == "u":
        values = [document.get("url")]
    elif field == "e" and document.get("record_type") == "external":
        values = [document.get("title"), document.get("url"), document.get("summary")]
    else:
        values = []
    return set(sitegraph_tokens(" ".join(str(value or "") for value in values)))


def hot_query_rank_base_score(document: dict[str, Any], terms: list[str]) -> float:
    score = 0.0
    for field in FIELD_CODES:
        field_tokens = hot_query_rank_field_tokens(document, field)
        if not field_tokens:
            continue
        field_impact = FIELD_IMPACTS[FIELD_CODES[field]]
        for term in terms:
            if term in field_tokens:
                score += field_impact
    return score


def hot_query_sort_timestamp(document: dict[str, Any]) -> float:
    for key in ("published_at", "updated_at", "recorded_at", "version_date"):
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
    base_score = hot_query_rank_base_score(document, terms)
    return (-hot_query_runtime_rank_score(document, query, terms, base_score), -hot_query_sort_timestamp(document), str(document.get("id") or ""))
