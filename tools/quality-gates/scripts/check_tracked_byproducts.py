from __future__ import annotations

import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]

BLOCKED_SUFFIXES = (
    ".log",
    ".pyc",
    ".pyo",
    ".tmp",
)

BLOCKED_PARTS = {
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    "node_modules",
    "target",
}

BLOCKED_PREFIXES = (
    "apps/web/dist/",
    "apps/web/public/generated/",
    "apps/web/src/features/collection-search/wasm/",
    "coverage/",
    "tools/search-eval/reports/",
    "tmp/",
)

ALLOWED_TRACKED_BYPRODUCTS = {
    "apps/web/src/features/collection-search/wasm/package.json",
    "apps/web/src/features/collection-search/wasm/packed_impact_decoder.d.ts",
    "apps/web/src/features/collection-search/wasm/packed_impact_decoder.js",
    "apps/web/src/features/collection-search/wasm/packed_impact_decoder_bg.wasm",
    "apps/web/src/features/collection-search/wasm/packed_impact_decoder_bg.wasm.d.ts",
}


def tracked_files() -> list[str]:
    output = subprocess.check_output(["git", "ls-files"], cwd=REPO_ROOT, text=True)
    return [line.strip().replace("\\", "/") for line in output.splitlines() if line.strip()]


def is_byproduct(path: str) -> bool:
    if path in ALLOWED_TRACKED_BYPRODUCTS:
        return False
    parts = set(path.split("/"))
    return (
        path.startswith(BLOCKED_PREFIXES)
        or path.endswith(BLOCKED_SUFFIXES)
        or bool(parts & BLOCKED_PARTS)
    )


def main() -> int:
    failures = [path for path in tracked_files() if is_byproduct(path)]
    if failures:
        print("[check_tracked_byproducts] tracked build/cache byproducts are forbidden", file=sys.stderr)
        for path in failures:
            print(f"  - {path}", file=sys.stderr)
        return 1
    print("[check_tracked_byproducts] ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
