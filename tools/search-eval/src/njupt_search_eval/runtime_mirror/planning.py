from __future__ import annotations

import math
from typing import Any

from .cache_io import (
    body_index_artifact,
    light_index_artifact,
    load_source_manifest,
    local_body_cache_key,
    local_light_query_cache_key,
    source_entries_by_id,
)
from .text import detect_query_intent, expand_query_phrases, normalize_text


def route_for_terms(index: dict[str, Any], terms: list[str], intent: str) -> list[dict[str, Any]]:
    directory = index["global_query_directory"]
    routes: list[dict[str, Any]] = []
    seen: set[int] = set()
    for term in terms:
        route = directory.get("entries", {}).get(normalize_text(term))
        if isinstance(route, dict) and id(route) not in seen:
            seen.add(id(route))
            routes.append(route)
    intent_route = directory.get("intents", {}).get(intent)
    if isinstance(intent_route, dict) and id(intent_route) not in seen:
        routes.append(intent_route)
    return routes

def unique_ordered(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result

def source_ids_from_local_index_ids(index_ids: list[str]) -> list[str]:
    return [source_id for index_id in index_ids if (source_id := str(index_id).split("__", 1)[0])]

def build_plan(index: dict[str, Any], query: str, terms: list[str]) -> dict[str, Any]:
    profile = detect_query_intent(query)
    routes = route_for_terms(index, terms, profile["intent"])
    all_sources = [str(source["source_id"]) for source in index["source_registry"]["sources"]]
    route_sources = [str(source) for route in routes for source in route.get("likely_sources", [])]
    local_index_ids = [str(item) for route in routes for item in route.get("local_index_ids", [])]
    result_types = [str(item) for route in routes for item in route.get("expected_result_types", [])]
    routed_source_ids = [
        source_id
        for source_id in unique_ordered([*profile["authority_sources"], *route_sources, *source_ids_from_local_index_ids(local_index_ids)])
        if source_id in all_sources
    ]
    route_decisions = [
        {
            "term": str(route.get("term") or profile["intent"]),
            "local_index_count": len(route.get("local_index_ids") or []),
            "expected_cost_bytes": int(route.get("expected_cost_bytes") or 0),
            "expected_utility_per_kb": float(route.get("expected_utility_per_kb") or 0.0),
            "likely_sources": [str(source) for source in route.get("likely_sources", [])],
            "likely_facets": [str(facet) for facet in route.get("likely_facets", [])],
        }
        for route in routes
    ]
    return {
        "normalized_query": normalize_text(query),
        "aliases": expand_query_phrases(query, index["aliases"]),
        "intent": profile["intent"],
        "authority_sources": profile["authority_sources"],
        "expected_result_types": unique_ordered(result_types),
        "source_ids": routed_source_ids or all_sources,
        "local_index_ids": unique_ordered(local_index_ids),
        "verification_source_ids": all_sources,
        "declared_completion_scope": "global",
        "estimated_cost_bytes": sum(int(route["expected_cost_bytes"]) for route in route_decisions),
        "estimated_utility_per_kb": round(sum(float(route["expected_utility_per_kb"]) for route in route_decisions), 6),
        "route_decisions": route_decisions,
    }

def select_local_refs(index: dict[str, Any], plan: dict[str, Any], terms: list[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int]:
    source_manifests = [
        source_manifest
        for source_id in plan["source_ids"]
        if (source_manifest := load_source_manifest(index, source_id)) is not None
    ]
    planned_ids = set(plan["local_index_ids"])
    planned_order = {str(index_id): order for order, index_id in enumerate(plan["local_index_ids"])}
    refs = [ref for manifest in source_manifests for ref in manifest["local_indexes"]]

    route_facets = {facet for route in plan["route_decisions"] for facet in route["likely_facets"]}
    route_sources = {source for route in plan["route_decisions"] for source in route["likely_sources"]}

    def year_score(year: Any) -> float:
        try:
            return max(0.2, min(1.2, (float(year) - 2015) / 10))
        except (TypeError, ValueError):
            return 0.2

    def expected_uncached_bytes(ref: dict[str, Any]) -> int:
        light_artifact = light_index_artifact(ref)
        light_path = local_light_query_cache_key(str(light_artifact["path"]), light_artifact, terms)
        body_artifact = body_index_artifact(ref)
        body_path = local_body_cache_key(str(body_artifact["path"]), terms)
        light_bytes = 0 if light_path in index["local_light_cache"] else int(light_artifact["bytes"])
        body_bytes = 0 if body_path in index["local_body_cache"] else int(body_artifact["bytes"])
        return light_bytes + body_bytes

    def cache_state(ref: dict[str, Any]) -> str:
        light_artifact = light_index_artifact(ref)
        light_cached = local_light_query_cache_key(str(light_artifact["path"]), light_artifact, terms) in index["local_light_cache"]
        body_cached = local_body_cache_key(str(body_index_artifact(ref)["path"]), terms) in index["local_body_cache"]
        if light_cached and body_cached:
            return "warm"
        if light_cached or body_cached:
            return "partial"
        return "cold"

    def utility(ref: dict[str, Any]) -> float:
        scope = ref.get("scope") or {}
        routed = 4.0 if str(ref["index_id"]) in planned_ids else 1.0
        source_prior = 2.0 if str(scope.get("source_id")) in {*route_sources, *plan["authority_sources"]} else 1.0
        facet_prior = 1.5 if str(scope.get("facet")) in route_facets else 1.0
        cost_kb = max(1.0, expected_uncached_bytes(ref) / 1024)
        return round(routed * source_prior * facet_prior * year_score(scope.get("year")) * math.log2(int(ref.get("doc_count") or 0) + 2) / cost_kb, 6)

    if planned_ids:
        routed_refs = [ref for ref in refs if ref["index_id"] in planned_ids]
        if routed_refs:
            refs = sorted(
                routed_refs,
                key=lambda ref: (
                    -utility(ref),
                    planned_order.get(str(ref["index_id"]), 999_999),
                    -int(ref.get("doc_count") or 0),
                    str(ref["index_id"]),
                ),
            )[:48]
        else:
            refs = sorted(
                refs,
                key=lambda ref: (
                    -utility(ref),
                    -int(str(ref["scope"].get("year", "0")).replace("undated", "0") or 0),
                    -int(ref.get("doc_count") or 0),
                    str(ref["index_id"]),
                ),
            )[:48]
    else:
        refs = sorted(
            refs,
            key=lambda ref: (
                -utility(ref),
                -int(str(ref["scope"].get("year", "0")).replace("undated", "0") or 0),
                -int(ref.get("doc_count") or 0),
                str(ref["index_id"]),
            ),
        )[:48]
    source_manifest_bytes = sum(
        int(source_entries_by_id(index)[manifest["source_id"]]["artifact_manifest"]["bytes"])
        for manifest in source_manifests
    )
    plan["selected_local_indexes"] = [
        {
            "index_id": str(ref["index_id"]),
            "expected_bytes": int(light_index_artifact(ref)["bytes"]) + int(body_index_artifact(ref)["bytes"]),
            "expected_uncached_bytes": expected_uncached_bytes(ref),
            "cache_state": cache_state(ref),
            "utility_score": utility(ref),
            "source_id": str((ref.get("scope") or {}).get("source_id")),
            "facet": str((ref.get("scope") or {}).get("facet")),
            "year": str((ref.get("scope") or {}).get("year")),
        }
        for ref in refs
    ]
    plan["estimated_cost_bytes"] = int(plan["estimated_cost_bytes"]) + sum(item["expected_uncached_bytes"] for item in plan["selected_local_indexes"])
    return source_manifests, refs, source_manifest_bytes
