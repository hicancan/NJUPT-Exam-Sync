from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from .cache_io import source_id_for
from .config import FIELD_WEIGHTS, SEARCH_INTENT_CONFIG
from .text import detect_query_intent, normalize_text


def text_blob(document: dict[str, Any], *fields: str) -> str:
    values: list[str] = []
    for field in fields:
        value = document.get(field)
        if isinstance(value, list):
            values.extend(str(item) for item in value)
        elif value is not None:
            values.append(str(value))
    return normalize_text(" ".join(values))

def date_sort_value(raw: Any) -> float:
    if not raw:
        return 0.0
    try:
        published = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    if published.tzinfo is None:
        published = published.replace(tzinfo=timezone.utc)
    return published.timestamp()

def ranking_date_sort_value(document: dict[str, Any]) -> float:
    return date_sort_value(document.get("published_at")) or date_sort_value(document.get("version_date"))

def age_days(timestamp: float) -> float:
    return max(0.0, (datetime.now(timezone.utc).timestamp() - timestamp) / 86400)

def decayed_freshness(timestamp: float, max_score: float, horizon_days: float) -> float:
    if not timestamp:
        return 0.0
    return max(0.0, max_score - min(age_days(timestamp), horizon_days) / horizon_days * max_score)

def intent_freshness_score(document: dict[str, Any], mode: str) -> float:
    config = SEARCH_INTENT_CONFIG["ranking"]["freshness"].get(mode)
    if not isinstance(config, dict):
        return 0.0
    if mode == "official_entry":
        return float(config.get("system_facet_score") or 0.0) if document.get("facet") == "system" else 0.0
    timestamp = (
        date_sort_value(document.get("version_date")) or date_sort_value(document.get("published_at"))
        if mode == "form_version"
        else date_sort_value(document.get("published_at")) or date_sort_value(document.get("version_date"))
    )
    return decayed_freshness(
        timestamp,
        float(config.get("max_score") or 0.0),
        float(config.get("horizon_days") or 3650.0),
    )

def stale_penalty(document: dict[str, Any], mode: str) -> float:
    config = SEARCH_INTENT_CONFIG["ranking"]["stale_penalty"]
    if mode not in set(str(item) for item in config["modes"]):
        return 0.0
    value = date_sort_value(document.get("published_at")) or date_sort_value(document.get("version_date"))
    if not value:
        return 0.0
    days = age_days(value)
    for threshold in config["thresholds"]:
        threshold_modes = threshold.get("modes")
        if isinstance(threshold_modes, list) and mode not in set(str(item) for item in threshold_modes):
            continue
        if days > float(threshold["older_than_days"]):
            return float(threshold["score"])
    return 0.0

def is_short_landing_page(document: dict[str, Any], normalized_query: str, title: str) -> bool:
    content_length = document.get("content_normalized_length")
    if not isinstance(content_length, int | float):
        content_length = len(normalize_text(document.get("content")))
    return (
        title == normalized_query
        and document.get("facet") in {"workflow", "news", "notice_article"}
        and not date_sort_value(document.get("published_at"))
        and int(content_length) < 220
    )

def structural_needles(normalized_query: str, terms: list[str]) -> list[str]:
    needles = [normalized_query] if len(normalized_query) >= 3 else []
    needles.extend(term for term in terms if len(term) >= 4)
    return list(dict.fromkeys(needles))

def structural_match_length(text: str, needles: list[str]) -> int:
    return max((len(needle) for needle in needles if needle in text), default=0)

def structural_boost(field: str, length: int) -> float:
    capped = min(length, 10)
    if field == "attachment":
        return 1200.0 + capped * 250.0
    if field == "url":
        return 600.0 + capped * 120.0
    if field == "tags":
        return 450.0 + capped * 90.0
    return 1600.0 + capped * 400.0

def structural_relevance_boost(
    normalized_query: str,
    terms: list[str],
    *,
    attachment: str,
    section: str,
    tags: str,
    title: str,
    url: str,
) -> tuple[float, list[str]]:
    needles = structural_needles(normalized_query, terms)
    hits = (
        ("title", title, "标题命中"),
        ("section", section, "栏目路径命中"),
        ("attachment", attachment, "附件名命中"),
        ("url", url, "URL 命中"),
        ("tags", tags, "标签命中"),
    )
    score = 0.0
    reasons: list[str] = []
    for field, text, reason in hits:
        match_length = structural_match_length(text, needles)
        if match_length > 0:
            score += structural_boost(field, match_length)
            reasons.append(reason)
    return score, reasons

def rank_document(document: dict[str, Any], query: str, terms: list[str], light_score: float) -> dict[str, Any]:
    profile = detect_query_intent(query)
    normalized_query = normalize_text(query)
    title = text_blob(document, "title")
    canonical_title = text_blob(document, "canonical_title")
    section = text_blob(document, "section", "nav_path_text")
    summary = text_blob(document, "summary")
    content = text_blob(document, "content")
    tags = text_blob(document, "tags")
    url = text_blob(document, "url")
    external = title + text_blob(document, "url") if document.get("record_type") == "external" else ""
    attachment = normalize_text(" ".join(
        " ".join(str(attachment.get(field) or "") for field in ("name", "extension", "section", "parent_url"))
        for attachment in document.get("attachments") or []
    ))

    text_weights = SEARCH_INTENT_CONFIG["ranking"]["text_match"]
    term_weights = SEARCH_INTENT_CONFIG["ranking"]["term_match"]
    authority_weights = SEARCH_INTENT_CONFIG["ranking"]["authority"]
    score = light_score
    reasons: list[str] = []
    if normalized_query and (title == normalized_query or canonical_title == normalized_query):
        score += float(text_weights["system_title_exact"] if document.get("facet") == "system" else text_weights["title_exact"])
        reasons.append("标题精确")
    elif normalized_query and (normalized_query in title or normalized_query in canonical_title):
        score += float(text_weights["title_contains"])
        reasons.append("标题包含")
        if len(normalized_query) >= int(text_weights["long_query_min_length"]):
            score += float(text_weights["long_query_title_contains_extra"])
            reasons.append("标题短语命中")
        else:
            score += float(text_weights["short_query_title_contains_extra"])
            reasons.append("短词标题命中")
    if normalized_query and normalized_query in attachment:
        score += float(text_weights["attachment_contains"])
        reasons.append("附件名命中")
    if normalized_query and normalized_query in external:
        score += float(text_weights["external_contains"])
        reasons.append("外部系统/外链命中")
    if normalized_query and normalized_query in url:
        score += float(text_weights["url_contains"])
        reasons.append("URL 命中")
    if normalized_query and normalized_query in section:
        score += float(text_weights["section_contains"])
        reasons.append("栏目路径命中")
    if normalized_query and normalized_query in content:
        score += float(text_weights["content_contains"])
        reasons.append("正文命中")
    if normalized_query and normalized_query in tags:
        score += float(text_weights["tags_contains"])
        reasons.append("标签命中")

    matched_terms = []
    for term in terms[:12]:
        if term in title or term in canonical_title:
            score += float(term_weights["title"])
            matched_terms.append(term)
        elif term in attachment:
            score += float(term_weights["attachment"])
            matched_terms.append(term)
        elif term in external:
            score += float(term_weights["external"])
            matched_terms.append(term)
        elif term in url:
            score += float(term_weights["url"])
            matched_terms.append(term)
        elif term in section:
            score += float(term_weights["section"])
            matched_terms.append(term)
        elif term in summary or term in content:
            score += float(term_weights["summary_or_content"])
            matched_terms.append(term)
    if matched_terms:
        reasons.append("词项: " + "、".join(sorted(set(matched_terms), key=len, reverse=True)[:6]))
    structural_score, structural_reasons = structural_relevance_boost(
        normalized_query,
        terms,
        attachment=attachment,
        section=section,
        tags=tags,
        title=title,
        url=url,
    )
    score += structural_score
    for reason in structural_reasons:
        if reason not in reasons:
            reasons.append(reason)

    source_id = source_id_for(document)
    if source_id in profile["authority_sources"]:
        score += float(authority_weights["broad_source_boost"] if profile["intent"] == "broad_exploratory" else authority_weights["focused_source_boost"])
        reasons.append("权威来源")
    elif len(profile["authority_sources"]) == 1 and profile["intent"] != "broad_exploratory":
        score -= float(authority_weights["single_source_miss_penalty"])

    for boost in SEARCH_INTENT_CONFIG["ranking"]["facet_boosts"]:
        if document.get("facet") == boost["facet"] and profile["intent"] in set(str(item) for item in boost["intents"]):
            score += float(boost["score"])
            reasons.append(str(boost["reason"]))
    if normalize_text(document.get("task_kind")) == normalize_text(profile["intent"]):
        score += float(SEARCH_INTENT_CONFIG["ranking"]["task_kind_match"])
        reasons.append("任务匹配")

    freshness = intent_freshness_score(document, str(profile["freshness_mode"]))
    if freshness > 0:
        score += freshness
        freshness_config = SEARCH_INTENT_CONFIG["ranking"]["freshness"].get(str(profile["freshness_mode"]), {})
        reasons.append(str(freshness_config.get("reason") or "时间较新"))
    penalty = stale_penalty(document, str(profile["freshness_mode"]))
    if penalty > 0:
        score -= penalty
        reasons.append("历史内容降权")
    if profile["intent"] == "academic_policy" and is_short_landing_page(document, normalized_query, title):
        score -= float(SEARCH_INTENT_CONFIG["ranking"]["short_landing_page_penalty"])
        reasons.append("短入口降权")
    if profile["intent"] == "form_download" and document.get("record_type") == "external":
        score -= float(SEARCH_INTENT_CONFIG["ranking"]["form_download_external_penalty"])
        reasons.append("外链非下载降权")
    if profile["intent"] == "scholarship_aid" and "学业困难" in title and "家庭经济困难" not in title:
        score -= float(SEARCH_INTENT_CONFIG["ranking"]["scholarship_non_financial_hardship_penalty"])
        reasons.append("非资助困难降权")

    ranked = dict(document)
    ranked["score"] = round(score, 4)
    ranked["score_reason"] = "；".join(reasons or ["局部索引候选"])
    return ranked

def hot_query_rank_base_score(document: dict[str, Any]) -> float:
    value = document.get("rank_base_score")
    if not isinstance(value, int | float) or not math.isfinite(float(value)):
        raise ValueError(f"hot query proof document {document.get('id')} is missing rank_base_score")
    return float(value)

def apply_impact_index(
    scores: dict[int, float],
    impact_terms: dict[str, Any],
    terms: list[str],
    retrieval: dict[str, Any],
    target_candidates: int,
) -> None:
    blocks: list[dict[str, Any]] = []
    for term in terms:
        term_payload = impact_terms.get(term)
        if not isinstance(term_payload, dict):
            continue
        for field, doc_ids in term_payload.items():
            impact = float(FIELD_WEIGHTS.get(field, 8.0) + min(len(term), 8))
            ids = [int(doc_id) for doc_id in doc_ids]
            for offset in range(0, len(ids), 32):
                blocks.append({"key": f"{term}\0{field}", "impact": impact, "ids": ids[offset: offset + 32]})
    blocks.sort(key=lambda item: (-float(item["impact"]), str(item["key"])))
    suffix = [0.0 for _ in range(len(blocks) + 1)]
    seen: set[str] = set()
    total = 0.0
    for index in range(len(blocks) - 1, -1, -1):
        key = str(blocks[index]["key"])
        if key not in seen:
            seen.add(key)
            total += float(blocks[index]["impact"])
        suffix[index] = total

    def threshold() -> float:
        if len(scores) < target_candidates:
            return float("-inf")
        return sorted(scores.values(), reverse=True)[target_candidates - 1]

    retrieval["dynamic_pruning"] = True
    for index, block in enumerate(blocks):
        current_threshold = threshold()
        if math.isfinite(current_threshold):
            retrieval["competitive_threshold"] = current_threshold
        max_possible = float(block["impact"]) + suffix[index + 1]
        has_known = any(doc_id in scores for doc_id in block["ids"])
        if not has_known and len(scores) >= target_candidates and max_possible <= current_threshold:
            retrieval["impact_blocks_pruned"] += 1
            retrieval["postings_pruned"] += len(block["ids"])
            continue
        retrieval["impact_blocks_visited"] += 1
        for doc_index in block["ids"]:
            retrieval["postings_visited"] += 1
            scores[int(doc_index)] = scores.get(int(doc_index), 0.0) + float(block["impact"])

def sorted_ranked(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        results,
        key=lambda item: (
            -float(item.get("score") or 0),
            -ranking_date_sort_value(item),
            str(item.get("id") or ""),
        ),
    )
