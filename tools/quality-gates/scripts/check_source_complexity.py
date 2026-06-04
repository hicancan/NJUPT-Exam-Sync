from __future__ import annotations

import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]

SOURCE_PREFIXES = (
    "apps/web/src/",
    "packages/contracts/src/",
    "packages/exam-core/src/",
    "packages/search-core/src/",
    "tools/collection-indexer/src/",
    "tools/exam-pipeline/src/",
    "tools/search-eval/src/",
    "tools/quality-gates/scripts/",
    "tools/wasm/packed-impact-decoder/src/",
)

GENERATED_PREFIXES = (
    "apps/web/src/features/collection-search/wasm/",
)

DEFAULT_LINE_LIMITS = {
    ".ts": 500,
    ".tsx": 500,
    ".py": 800,
    ".rs": 800,
}

FILE_LINE_LIMITS = {
    "apps/web/src/features/collection-search/worker/collectionSearch.worker.ts": 500,
    "packages/search-core/src/sitegraphSearch.ts": 500,
    "packages/search-core/src/sitegraphCompletionProofRuntime.ts": 500,
    "packages/search-core/src/sitegraphHotSearchPhases.ts": 500,
    "packages/search-core/src/sitegraphRecallRuntime.ts": 200,
}


def candidate_files() -> list[str]:
    output = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=REPO_ROOT, text=True)
    return [line.strip().replace("\\", "/") for line in output.splitlines() if line.strip()]


def should_check(path: str) -> bool:
    if path.startswith(GENERATED_PREFIXES):
        return False
    return path.endswith(tuple(DEFAULT_LINE_LIMITS)) and path.startswith(SOURCE_PREFIXES)


def line_count(path: Path) -> int:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
        return sum(1 for _ in handle)


def main() -> int:
    failures: list[str] = []
    checked = 0
    for relative_path in candidate_files():
        if not should_check(relative_path):
            continue
        checked += 1
        absolute_path = REPO_ROOT / relative_path
        limit = FILE_LINE_LIMITS.get(relative_path, DEFAULT_LINE_LIMITS[absolute_path.suffix])
        lines = line_count(absolute_path)
        if lines > limit:
            failures.append(f"{relative_path}: {lines} lines exceeds budget {limit}")

    if failures:
        print("[check_source_complexity] source complexity gate failed", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    print(f"[check_source_complexity] ok ({checked} source files checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
