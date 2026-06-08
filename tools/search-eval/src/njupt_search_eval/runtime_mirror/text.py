from __future__ import annotations

import re
import unicodedata
from typing import Any

from .config import SEARCH_INTENT_CONFIG


def normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower()
    return re.sub(r"\s+", "", text)

def tokens_for_query(query: str, aliases: dict[str, Any]) -> list[str]:
    candidates = expand_query_phrases(query, aliases)
    tokens: set[str] = set()
    for candidate in candidates:
        text = normalize_text(candidate)
        if len(text) >= 2:
            tokens.add(text)
        for match in re.finditer(r"[\u4e00-\u9fff]{2,}|[a-z0-9][a-z0-9._-]{1,}", text):
            part = match.group(0)
            if re.fullmatch(r"[\u4e00-\u9fff]+", part):
                for size in range(2, min(5, len(part)) + 1):
                    for index in range(0, len(part) - size + 1):
                        tokens.add(part[index : index + size])
            else:
                tokens.add(part)
    return sorted(tokens, key=len, reverse=True)

def expand_query_phrases(query: str, aliases: dict[str, Any]) -> list[str]:
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

def includes_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(normalize_text(term) in text for term in terms)

def dynamic_system_authority_sources(text: str) -> list[str]:
    detection_config = SEARCH_INTENT_CONFIG["intent_detection"]
    for rule in detection_config["system_authority_rules"]:
        if includes_any(text, tuple(str(term) for term in rule["match_any"])):
            return [str(rule["source_id"])]
    return [str(source_id) for source_id in detection_config["system_default_authority_sources"]]

def expand_authority_sources(raw_sources: Any, text: str) -> list[str]:
    if raw_sources == "dynamic_system":
        return dynamic_system_authority_sources(text)
    return [str(source_id) for source_id in raw_sources]

def detect_query_intent(query: str) -> dict[str, Any]:
    text = normalize_text(query)
    detection_config = SEARCH_INTENT_CONFIG["intent_detection"]
    for rule in detection_config["profiles"]:
        if not includes_any(text, tuple(str(term) for term in rule["match_any"])):
            continue
        raw_sources = rule["authority_sources"]
        return {
            "intent": str(rule["intent"]),
            "authority_sources": expand_authority_sources(raw_sources, text),
            "freshness_mode": str(rule["freshness_mode"]),
        }
    fallback = detection_config["fallback_profile"]
    return {
        "intent": str(fallback["intent"]),
        "authority_sources": expand_authority_sources(fallback["authority_sources"], text),
        "freshness_mode": str(fallback["freshness_mode"]),
    }
