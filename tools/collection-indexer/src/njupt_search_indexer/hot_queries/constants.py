from __future__ import annotations

import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[5]
SEARCH_INTENT_CONFIG = json.loads(
    (BASE_DIR / "packages" / "search-core" / "src" / "intent" / "queryIntentProfiles.json").read_text(encoding="utf-8")
)
HOT_QUERY_CERTIFICATE_MODEL = "hot-query-minimal-complete-proof-v3"
HOT_QUERY_TOP_DOCUMENT_PAYLOAD_MODEL = "rank-display-match-window-certificate-v2"
HOT_QUERY_COMPLETE_PROOF_MODEL = "match-proof-compact-filter-v2"
HOT_QUERY_RANK_EVIDENCE_MODEL = "query-token-field-impact-full-document-v1"
HOT_QUERY_FAST_START_VERSION = "sitegraph-hot-query-fast-start-v1"
HOT_QUERY_TOPK_CERTIFICATE_VERSION = "sitegraph-hot-query-topk-certificate-v2"
HOT_QUERY_INITIAL_CERTIFICATE_VERSION = "sitegraph-hot-query-initial-certificate-v1"
HOT_QUERY_COMPLETE_CERTIFICATE_VERSION = "sitegraph-hot-query-complete-certificate-v4"
HOT_QUERY_PROOF_DOCUMENT_ENCODING = "sitegraph-hot-query-proof-doc-tuples-v1"
HOT_QUERY_TOPK_LIMIT = 80
HOT_QUERY_INITIAL_LIMIT = 20
HOT_QUERY_CONTENT_CONTEXT_CHARS = 128
HOT_QUERY_SUMMARY_CONTEXT_CHARS = 80
HOT_QUERY_CONTENT_FALLBACK_CHARS = 180
HOT_QUERY_SUMMARY_FALLBACK_CHARS = 360
HOT_QUERY_MAX_CONTENT_WINDOWS = 16
HOT_QUERY_MAX_SUMMARY_WINDOWS = 6
HOT_QUERY_ATTACHMENT_SAMPLE_LIMIT = 4
HOT_QUERY_ATTACHMENT_HEAD_LIMIT = 4
