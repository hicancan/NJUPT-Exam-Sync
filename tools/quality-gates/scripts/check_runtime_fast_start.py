from __future__ import annotations

import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
HOOK_PATH = REPO_ROOT / "apps" / "web" / "src" / "features" / "collection-search" / "model" / "useSearchIndexWorker.ts"
PROGRESSIVE_PATH = REPO_ROOT / "apps" / "web" / "src" / "features" / "collection-search" / "model" / "useProgressiveSearch.ts"
WORKER_PATH = REPO_ROOT / "apps" / "web" / "src" / "features" / "collection-search" / "worker" / "collectionSearch.worker.ts"
FAST_START_PATH = REPO_ROOT / "apps" / "web" / "src" / "features" / "collection-search" / "worker" / "fastStart" / "searchWorkerFastStart.ts"
SESSION_PATH = REPO_ROOT / "apps" / "web" / "src" / "features" / "collection-search" / "worker" / "session" / "searchWorkerSession.ts"
TELEMETRY_PATH = REPO_ROOT / "apps" / "web" / "src" / "features" / "collection-search" / "worker" / "telemetry" / "searchWorkerTelemetry.ts"
CONTRACT_PATHS = (
    REPO_ROOT / "packages" / "contracts" / "src" / "search-index" / "index.ts",
    REPO_ROOT / "packages" / "contracts" / "src" / "search-index" / "runtime.ts",
)
UI_PATHS = (
    REPO_ROOT / "apps" / "web" / "src" / "features" / "collection-search" / "ui" / "CollectionSearchSection.tsx",
    REPO_ROOT / "apps" / "web" / "src" / "features" / "collection-search" / "ui" / "CollectionSearchStatus.tsx",
)


def fail(message: str) -> None:
    print(f"[check_runtime_fast_start] {message}", file=sys.stderr)
    raise SystemExit(1)


def read(path: Path) -> str:
    if not path.exists():
        fail(f"missing source file: {path}")
    return path.read_text(encoding="utf-8")


def require_contains(source: str, needle: str, label: str) -> None:
    if needle not in source:
        fail(f"{label} is missing required source marker: {needle}")


def main() -> None:
    hook = read(HOOK_PATH)
    progressive = read(PROGRESSIVE_PATH)
    worker = read(WORKER_PATH)
    fast_start = read(FAST_START_PATH)
    session = read(SESSION_PATH)
    telemetry = read(TELEMETRY_PATH)
    contract = "\n".join(read(path) for path in CONTRACT_PATHS)
    ui = "\n".join(read(path) for path in UI_PATHS)

    if "type: 'init'" in hook or 'type: "init"' in hook:
        fail("useSearchIndexWorker must not auto-post init; URL queries must be able to cold-start fast-start")
    require_contains(hook, "setWorkerState(worker);", "useSearchIndexWorker immediate worker exposure")

    require_contains(progressive, "type: 'query'", "useProgressiveSearch direct query dispatch")
    require_contains(progressive, "trimmed.length < 2", "useProgressiveSearch UI degenerate-query guard")

    require_contains(worker, "tryBuildFastStartEvent", "worker fast-start coordinator")
    require_contains(worker, "sessionRuntime.loadSession", "worker session runtime")
    require_contains(worker, "isDegenerateQuery(queryText)", "worker degenerate-query no-op guard")
    require_contains(worker, "classifyDynamicQuery", "worker query-class telemetry")
    run_search_start = worker.find("const runSearch = async () =>")
    run_search_end = worker.find("await searchSitegraphProgressively", run_search_start)
    if run_search_start < 0 or run_search_end < 0:
        fail("worker query runtime shape changed; fast-start ordering must be re-audited")
    run_search = worker[run_search_start:run_search_end]
    fast_start_index = run_search.find("tryBuildFastStartEvent")
    load_session_index = run_search.find("postReadySession")
    if fast_start_index < 0 or load_session_index < 0 or fast_start_index > load_session_index:
        fail("worker must try hot-query fast-start before loading the full search session")
    if "global_query_directory" in run_search:
        fail("hot-query fast-start path must not load global_query_directory before first trusted results")

    require_contains(fast_start, "hot_query_fast_start", "fast-start artifact role")
    require_contains(fast_start, "parseHotQueryInitialCertificate", "fast-start initial certificate parser")
    require_contains(fast_start, "first_result_source: 'hot_query_initial'", "fast-start stats source")
    require_contains(session, "global_query_directory", "session global query directory loading")
    require_contains(session, "query_aliases", "session query aliases loading")
    require_contains(telemetry, "classifyDynamicQuery", "telemetry dynamic query classification")
    require_contains(telemetry, "isDegenerateQuery", "telemetry degenerate query guard")

    require_contains(contract, "export type SitegraphQueryClass", "query-class contract")
    require_contains(contract, "query_class?: SitegraphQueryClass", "query stats contract")
    require_contains(ui, "首屏路径", "browser-visible fast-start diagnostics")
    require_contains(ui, "查询类型", "browser-visible query-class diagnostics")
    print("[check_runtime_fast_start] ok")


if __name__ == "__main__":
    main()
