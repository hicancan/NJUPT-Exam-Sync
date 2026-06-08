from __future__ import annotations

import hashlib
from collections import defaultdict
from pathlib import Path
from typing import Any

from ..sitegraph_artifact_io import artifact_entry, write_hashed_bytes, write_hashed_json
from ..sitegraph_binary_index import pack_impact_index
from ..sitegraph_index_postings import build_body_inverted_index, build_light_inverted_index
from ..sitegraph_shards import shard_year
from ..sitegraph_source import document_source_id
from ..sitegraph_text import clean_text, stable_ascii_slug


LOCAL_DOC_META_FIELDS = (
    "doc_index",
    "id",
    "record_type",
    "facet",
    "title",
    "url",
    "source_id",
    "source",
    "section",
    "nav_path_text",
    "published_at",
    "recorded_at",
    "version_date",
    "academic_year",
    "term",
    "task_kind",
    "attachment_count",
    "shard",
)
LOCAL_INDEX_BUCKET_COUNT = 4


def local_index_bucket(document: dict[str, Any], bucket_count: int = LOCAL_INDEX_BUCKET_COUNT) -> str:
    digest = hashlib.sha1(str(document.get("id") or "").encode("utf-8")).hexdigest()
    return f"lb{int(digest[:2], 16) % bucket_count}"


def index_scope_for_document(document: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        document_source_id(document),
        clean_text(document.get("facet")) or "unknown",
        shard_year(document),
        local_index_bucket(document),
    )


def index_id_for_scope(source_id: str, facet: str, year: str, bucket: str = "lb0") -> str:
    return "__".join(
        [
            stable_ascii_slug(source_id, fallback="source"),
            stable_ascii_slug(facet, fallback="facet"),
            stable_ascii_slug(year, fallback="year"),
            stable_ascii_slug(bucket, fallback="bucket"),
        ]
    )


def local_doc_meta(document: dict[str, Any], shard_by_id: dict[str, dict[str, Any]]) -> dict[str, Any]:
    payload = {key: document.get(key) for key in LOCAL_DOC_META_FIELDS if key in document}
    canonical_title = clean_text(document.get("canonical_title"))
    if canonical_title and canonical_title != clean_text(document.get("title")):
        payload["canonical_title"] = canonical_title
    collection_method = clean_text(document.get("collection_method"))
    if collection_method and collection_method != "search_record":
        payload["collection_method"] = collection_method
    shard = payload.get("shard") if isinstance(payload.get("shard"), dict) else {}
    shard_id = str(shard.get("shard_id") or "")
    if shard_id and shard_id in shard_by_id:
        payload["shard"] = {
            "shard_id": shard_id,
        }
    return payload


def local_shard_refs(shard_ids: list[str], shard_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    for shard_id in shard_ids:
        shard = shard_by_id.get(shard_id)
        if not shard:
            continue
        refs.append(
            {
                "shard_id": shard_id,
                "path": shard["path"],
                "bytes": shard["bytes"],
                "count": shard["count"],
            }
        )
    return refs


def build_local_impact_indexes(
    documents: list[dict[str, Any]],
    shard_by_id: dict[str, dict[str, Any]],
    *,
    public_root: Path,
    light_meta_dir: Path,
    light_packed_dir: Path,
    body_packed_dir: Path,
) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    grouped: dict[tuple[str, str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for document in documents:
        grouped[index_scope_for_document(document)].append(document)

    local_refs: list[dict[str, Any]] = []
    refs_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for (source_id, facet, year, bucket), docs in sorted(grouped.items()):
        index_id = index_id_for_scope(source_id, facet, year, bucket)
        sorted_docs = sorted(docs, key=lambda item: int(item.get("doc_index") or 0))
        shard_ids = sorted(
            {
                str((document.get("shard") or {}).get("shard_id") or "")
                for document in sorted_docs
                if (document.get("shard") or {}).get("shard_id")
            }
        )
        scope = {
            "index_id": index_id,
            "source_id": source_id,
            "facet": facet,
            "year": year,
            "bucket": bucket,
            "shard_ids": shard_ids,
        }
        light_payload = {
            **build_light_inverted_index(sorted_docs),
            "version": "sitegraph-local-light-impact-v2",
            "scope": scope,
            "documents": [local_doc_meta(document, shard_by_id) for document in sorted_docs],
        }
        body_payload = {
            **build_body_inverted_index(sorted_docs),
            "version": "sitegraph-local-body-impact-v2",
            "scope": scope,
        }
        light_meta_payload = {key: value for key, value in light_payload.items() if key != "terms"}
        light_terms_payload = {key: value for key, value in light_payload.items() if key != "documents"}
        light_meta_artifact = write_hashed_json(public_root, light_meta_dir, f"local_impact_light_meta.{index_id}", light_meta_payload, compact=True)
        light_packed_artifact = write_hashed_bytes(
            public_root,
            light_packed_dir,
            f"local_impact_light.{index_id}",
            pack_impact_index(light_terms_payload),
            extension="bin",
        )
        body_packed_artifact = write_hashed_bytes(
            public_root,
            body_packed_dir,
            f"local_impact_body.{index_id}",
            pack_impact_index(body_payload),
            extension="bin",
        )
        ref = {
            "index_id": index_id,
            "scope": scope,
            "doc_count": len(sorted_docs),
            "shards": local_shard_refs(shard_ids, shard_by_id),
            "light_index_meta": artifact_entry(light_meta_artifact, role="local_impact_light_index_meta", count=len(sorted_docs), load="query_planned"),
            "light_index_packed": artifact_entry(light_packed_artifact, role="local_impact_light_index_packed", load="query_planned"),
            "body_index_packed": artifact_entry(body_packed_artifact, role="local_impact_body_index_packed", load="query_deepening"),
        }
        local_refs.append(ref)
        refs_by_source[source_id].append(ref)
    return local_refs, refs_by_source
