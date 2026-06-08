from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[3]
COLLECTION_INDEXER_SRC = BASE_DIR / "tools" / "collection-indexer" / "src"
ARTIFACT_ROLE_REGISTRY = BASE_DIR / "packages" / "contracts" / "src" / "search-index" / "artifact-roles.json"
if str(COLLECTION_INDEXER_SRC) not in sys.path:
    sys.path.insert(0, str(COLLECTION_INDEXER_SRC))

from njupt_search_indexer.build_sitegraph_index import (  # noqa: E402
    OBSOLETE_INDEX_DIR,
    PUBLIC_INDEX_DIR,
    PUBLIC_ROOT,
)
from njupt_search_indexer.sitegraph_source import (  # noqa: E402
    load_collection_source_packages,
    package_source_id,
    validate_sitegraph_package,
)
from njupt_search_indexer.validate_sitegraph_index import validate_generated_index  # noqa: E402


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def fail(message: str) -> None:
    print(f"[validate_search_index] {message}", file=sys.stderr)
    raise SystemExit(1)


def artifact_role_registry() -> set[str]:
    roles = read_json(ARTIFACT_ROLE_REGISTRY)
    if not isinstance(roles, list) or not roles:
        fail(f"{ARTIFACT_ROLE_REGISTRY} must contain a non-empty JSON array")
    return {str(role) for role in roles}


def assert_registered_artifact_roles(label: str, artifacts: Any, roles: set[str]) -> None:
    if not isinstance(artifacts, dict):
        fail(f"{label} artifacts must be an object")
    for name, entry in artifacts.items():
        if not isinstance(entry, dict):
            fail(f"{label}.{name} artifact entry must be an object")
        role = str(entry.get("role") or "")
        if role not in roles:
            fail(f"{label}.{name} role {role!r} is not registered in packages/contracts/src/search-index/artifact-roles.json")


def main() -> None:
    os.chdir(BASE_DIR)
    manifest_path = PUBLIC_INDEX_DIR / "manifest.json"
    if not manifest_path.exists():
        fail(f"{manifest_path} does not exist")
    if OBSOLETE_INDEX_DIR.exists():
        fail(f"obsolete index directory must be removed: {OBSOLETE_INDEX_DIR}")
    manifest = read_json(manifest_path)
    if manifest.get("strategy") != "routed-verifiable-static-search":
        fail(f"unexpected manifest strategy: {manifest.get('strategy')!r}")
    roles = artifact_role_registry()
    assert_registered_artifact_roles("manifest.artifacts", manifest.get("artifacts"), roles)
    if manifest.get("core_search", {}).get("first_screen_artifacts") != ["source_registry", "global_query_directory", "query_aliases"]:
        fail("first screen must load only the routed bootstrap artifacts")
    if manifest.get("core_search", {}).get("fast_start_artifacts") != ["hot_query_fast_start"]:
        fail("fast-start must load only hot_query_fast_start")
    if any(name in (manifest.get("artifacts") or {}) for name in ("doc_meta_light", "light_inverted_index")):
        fail("legacy global startup artifacts must not be runtime artifacts")
    if manifest.get("routing_contract", {}).get("startup_loads_global_document_metadata") is not False:
        fail("routing contract must explicitly reject global document metadata startup")
    if manifest.get("routing_contract", {}).get("planner") != "cost_authority_proof_ledger_planner_v2":
        fail("routing planner must be cost_authority_proof_ledger_planner_v2")
    if manifest.get("verification_contract", {}).get("completion_requires_ledger") is not True:
        fail("completion must require a proof ledger")
    source_registry_payload: dict[str, Any] | None = None
    for name in ("source_registry", "global_query_directory", "query_aliases", "hot_query_fast_start", "size_report"):
        entry = (manifest.get("artifacts") or {}).get(name)
        if not isinstance(entry, dict) or not entry.get("path"):
            fail(f"manifest.artifacts.{name}.path is missing")
        path = PUBLIC_ROOT / str(entry["path"])
        if not path.exists():
            fail(f"missing routed search artifact: {entry['path']}")
        if name == "source_registry":
            source_registry_payload = read_json(path)
    for source_entry in (source_registry_payload or {}).get("sources") or []:
        manifest_entry = (source_entry or {}).get("artifact_manifest")
        if isinstance(manifest_entry, dict):
            source_manifest_path = PUBLIC_ROOT / str(manifest_entry.get("path") or "")
            if source_manifest_path.exists():
                source_manifest = read_json(source_manifest_path)
                assert_registered_artifact_roles(
                    f"source_manifest.{source_manifest.get('source_id')}.artifacts",
                    source_manifest.get("artifacts"),
                    roles,
                )

    packages = [validate_sitegraph_package(path) for path in load_collection_source_packages() if path.exists()]
    if packages:
        validate_generated_index(packages)
    source_ids = sorted(package_source_id(package) for package in packages)
    print(f"[validate_search_index] ok routed source_ids={source_ids}")


if __name__ == "__main__":
    main()
