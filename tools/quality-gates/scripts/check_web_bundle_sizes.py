from __future__ import annotations

import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
DIST_ASSETS = REPO_ROOT / "dist" / "assets"

BUNDLE_BUDGETS = {
    "collectionSearch.worker-*.js": 168 * 1024,
    "index-*.js": 352 * 1024,
    "packed_impact_decoder_bg-*.wasm": 190 * 1024,
}


def fail(message: str) -> None:
    print(f"[check_web_bundle_sizes] {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if not DIST_ASSETS.exists():
        fail(f"dist assets directory is missing; run npm run build first: {DIST_ASSETS}")
    for pattern, budget in BUNDLE_BUDGETS.items():
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
