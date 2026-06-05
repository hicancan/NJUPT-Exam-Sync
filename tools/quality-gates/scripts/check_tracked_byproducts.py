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
    "coverage/",
    "tmp/",
)


def tracked_files() -> list[str]:
    output = subprocess.check_output(["git", "ls-files"], cwd=REPO_ROOT, text=True)
    return [line.strip().replace("\\", "/") for line in output.splitlines() if line.strip()]


def is_byproduct(path: str) -> bool:
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
