from __future__ import annotations

import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[5]
PUBLIC_ROOT = BASE_DIR / "apps" / "web" / "public"
PUBLIC_INDEX_DIR = PUBLIC_ROOT / "generated" / "collections" / "njupt-public"
SEARCH_INTENT_CONFIG = json.loads(
    (BASE_DIR / "packages" / "search-core" / "src" / "intent" / "queryIntentProfiles.json").read_text(encoding="utf-8")
)

FIELD_WEIGHTS = {key: float(value) for key, value in SEARCH_INTENT_CONFIG["field_weights"].items()}
DEFAULT_MAX_SHARD_LOADS = 32
ONE_MIB = 1024 * 1024
FIRST_TRUSTED_MAX_UNCACHED_BYTES = int(1.5 * ONE_MIB)
FIRST_TRUSTED_HYDRATION_RESERVE_BYTES = int(0.5 * ONE_MIB)
TOP_RESULTS_MAX_UNCACHED_BYTES = 3 * ONE_MIB
TOP_RESULTS_HYDRATION_RESERVE_BYTES = ONE_MIB
MIN_FIRST_TRUSTED_LOCAL_INDEXES = 2
MIN_TOP_RESULTS_LOCAL_INDEXES = 6
HIGH_DF_FIRST_TRUSTED_LOCAL_INDEX_BYTES = 384 * 1024
HIGH_DF_TOP_RESULTS_LOCAL_INDEX_BYTES = ONE_MIB
HIGH_DF_MIN_FIRST_TRUSTED_LOCAL_INDEXES = 3
HIGH_DF_MIN_TOP_RESULTS_LOCAL_INDEXES = 6
HIGH_DF_NORMALIZED_QUERIES = {"考试", "通知", "学生", "申请", "南京邮电大学"}
DYNAMIC_HIGH_DF_NORMALIZED_QUERIES = {"通知", "学生", "南京邮电大学"}
HIGH_DF_FIRST_TRUSTED_MAX_UNCACHED_BYTES = 128 * 1024
HIGH_DF_TOP_RESULTS_MAX_UNCACHED_BYTES = 512 * 1024
HIGH_DF_PROOF_MAX_UNCACHED_BYTES = 768 * 1024
LIGHT_SEARCH_FIELDS = ["title", "section", "nav_path", "tags", "attachments", "external", "system"]
BODY_SEARCH_FIELDS = [*LIGHT_SEARCH_FIELDS, "summary", "content"]
FULL_SCAN_FIELDS = ["title", "section", "nav_path", "summary", "content", "attachments", "url"]
