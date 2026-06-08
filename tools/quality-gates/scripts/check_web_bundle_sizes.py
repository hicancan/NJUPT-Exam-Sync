from __future__ import annotations

import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
DIST_ASSETS = REPO_ROOT / "dist" / "assets"
COLLECTION_CONFIG = REPO_ROOT / "config" / "collections" / "njupt-public.sitegraph.json"

FIXED_BUNDLE_BUDGETS = {
    "index-*.js": 352 * 1024,
    "packed_impact_decoder_bg-*.wasm": 190 * 1024,
}
BASE_WORKER_BUDGET = 168 * 1024
BASE_SOURCE_COUNT = 3
WORKER_BYTES_PER_ADDED_SOURCE = 512


def fail(message: str) -> None:
    print(f"[check_web_bundle_sizes] {message}", file=sys.stderr)
    raise SystemExit(1)


def configured_source_count() -> int:
    try:
        payload = json.loads(COLLECTION_CONFIG.read_text(encoding="utf-8"))
    except OSError as exc:
        fail(f"failed to read collection config: {COLLECTION_CONFIG}: {exc}")
    except json.JSONDecodeError as exc:
        fail(f"invalid collection config JSON: {COLLECTION_CONFIG}: {exc}")
    source_packages = payload.get("source_packages")
    if not isinstance(source_packages, list) or not source_packages:
        fail(f"collection config must contain a non-empty source_packages list: {COLLECTION_CONFIG}")
    return len(source_packages)


def bundle_budgets() -> dict[str, int]:
    added_sources = max(0, configured_source_count() - BASE_SOURCE_COUNT)
    worker_budget = BASE_WORKER_BUDGET + added_sources * WORKER_BYTES_PER_ADDED_SOURCE
    return {
        "collectionSearch.worker-*.js": worker_budget,
        **FIXED_BUNDLE_BUDGETS,
    }


def main() -> None:
    if not DIST_ASSETS.exists():
        fail(f"dist assets directory is missing; run npm run build first: {DIST_ASSETS}")
    for pattern, budget in bundle_budgets().items():
        matches = sorted(DIST_ASSETS.glob(pattern))
        if len(matches) != 1:
            fail(f"expected exactly one {pattern} asset, found {len(matches)}")
        path = matches[0]
        size = path.stat().st_size
        if size > budget:
            fail(f"{path.name} size={size} exceeds budget {budget}")
    print("[check_web_bundle_sizes] ok")


if __name__ == "__main__":
    main()
