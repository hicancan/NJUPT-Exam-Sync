from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from njupt_exam_pipeline.contract import ExamPipelineError
from njupt_exam_pipeline.history import build_exam_history, process_exam_snapshot_dir, write_exam_history
from njupt_exam_pipeline.source import (
    materialize_locked_exam_files,
    update_exam_lock as update_exam_lock_from_source,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_ROOT = REPO_ROOT / "apps" / "web" / "public"
PUBLIC_GENERATED = PUBLIC_ROOT / "generated"
COLLECTION_DIR = PUBLIC_GENERATED / "collections" / "njupt-public"
EXAM_DIR = PUBLIC_GENERATED / "exam"
EXAM_DOWNLOAD_CACHE = REPO_ROOT / "cache" / "exam-lock"
EXAM_HISTORY_CACHE = REPO_ROOT / "cache" / "exam-history"
PUBLIC_ASSET_MARKER = PUBLIC_GENERATED / ".asset-locks.json"
SITEGRAPH_LOCK = REPO_ROOT / "config" / "data-locks" / "sitegraph.lock.json"
EXAM_LOCK = REPO_ROOT / "config" / "data-locks" / "exam.lock.json"
SITEGRAPH_COLLECTION_CONFIG = REPO_ROOT / "config" / "collections" / "njupt-public.sitegraph.json"
BUILDER_FINGERPRINT_INPUTS = (
    REPO_ROOT / "tools" / "ci" / "prepare_public_assets.py",
    REPO_ROOT / "tools" / "collection-indexer" / "src",
    REPO_ROOT / "tools" / "exam-pipeline" / "src",
    REPO_ROOT / "pyproject.toml",
    REPO_ROOT / "uv.lock",
)


class PublicAssetError(RuntimeError):
    pass


@contextmanager
def timed_phase(name: str):
    started = time.perf_counter()
    print(f"[prepare_public_assets] >>> {name}", flush=True)
    try:
        yield
    finally:
        elapsed = time.perf_counter() - started
        print(f"[prepare_public_assets] <<< {name} ({elapsed:.1f}s)", flush=True)


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise PublicAssetError(f"{path} must contain a JSON object")
    return value


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def run(args: list[str], *, env: dict[str, str] | None = None) -> None:
    print("+", " ".join(args), flush=True)
    subprocess.run(args, cwd=REPO_ROOT, env=env, check=True)


def capture(args: list[str], *, cwd: Path = REPO_ROOT) -> str:
    return subprocess.check_output(args, cwd=cwd, text=True).strip()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def public_asset_builder_fingerprint() -> str:
    digest = hashlib.sha256()
    for input_path in BUILDER_FINGERPRINT_INPUTS:
        if input_path.is_file():
            files = [input_path]
        elif input_path.is_dir():
            files = sorted(
                path
                for path in input_path.rglob("*")
                if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc"
            )
        else:
            raise PublicAssetError(f"public asset builder fingerprint input missing: {input_path}")
        for path in files:
            digest.update(str(path.relative_to(REPO_ROOT)).replace("\\", "/").encode("utf-8"))
            digest.update(b"\0")
            digest.update(sha256_file(path).encode("ascii"))
            digest.update(b"\0")
    return digest.hexdigest()


def exam_lock_history_paths() -> list[Path]:
    lock_rel = EXAM_LOCK.relative_to(REPO_ROOT).as_posix()
    history_lock_dir = EXAM_HISTORY_CACHE / "locks"
    history_lock_dir.mkdir(parents=True, exist_ok=True)
    try:
        raw_log = capture(["git", "log", "--format=%H", "--", lock_rel])
    except subprocess.CalledProcessError as exc:
        raise PublicAssetError("cannot read exam.lock.json history from Git") from exc

    commits = [line.strip() for line in raw_log.splitlines() if line.strip()]
    entries: list[tuple[str, Path]] = []
    seen: set[str] = set()

    def semantic_key(lock: dict[str, Any]) -> str:
        files = lock.get("files")
        if not isinstance(files, list) or not files:
            raise PublicAssetError("exam lock files must be a non-empty list")
        payload = {
            "generated_at": lock.get("generated_at"),
            "source_url": lock.get("source_url"),
            "source_title": lock.get("source_title"),
            "files": [
                {
                    "name": item.get("name"),
                    "url": item.get("url"),
                    "sha256": item.get("sha256"),
                }
                for item in files
                if isinstance(item, dict)
            ],
        }
        return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

    for commit in reversed(commits):
        try:
            raw = subprocess.check_output(["git", "show", f"{commit}:{lock_rel}"], cwd=REPO_ROOT)
        except subprocess.CalledProcessError as exc:
            raise PublicAssetError(f"cannot read historical exam lock at {commit}") from exc
        digest = hashlib.sha256(raw).hexdigest()
        if digest in seen:
            continue
        path = history_lock_dir / f"{digest}.json"
        path.write_bytes(raw)
        lock = read_json(path)
        if lock.get("version") != "njupt-search-exam-lock-v1":
            raise PublicAssetError(f"invalid historical exam lock version at {commit}")
        if not str(lock.get("generated_at") or "").strip():
            raise PublicAssetError(f"historical exam lock missing generated_at at {commit}")
        seen.add(digest)
        entries.append((semantic_key(lock), path))

    current_raw = EXAM_LOCK.read_bytes()
    current_digest = hashlib.sha256(current_raw).hexdigest()
    current_path = history_lock_dir / f"{current_digest}.json"
    if current_digest not in seen:
        current_path.write_bytes(current_raw)
    current_key = semantic_key(read_json(current_path))
    entries = [(key, path) for key, path in entries if key != current_key]
    entries.append((current_key, current_path))

    paths = [path for _, path in entries]
    if len(paths) < 2:
        raise PublicAssetError("exam history requires at least two lock snapshots")
    return paths


def build_exam_history_data(*, generated_at: str) -> None:
    snapshots = []
    lock_paths = exam_lock_history_paths()
    for lock_path in lock_paths:
        lock = read_json(lock_path)
        data_version = sha256_file(lock_path)
        snapshot_dir = EXAM_HISTORY_CACHE / "snapshots" / data_version
        with timed_phase(f"materialize exam history snapshot {data_version[:8]}"):
            try:
                materialize_locked_exam_files(lock_path=lock_path, exam_dir=snapshot_dir, cache_root=EXAM_DOWNLOAD_CACHE)
                snapshots.append(
                    process_exam_snapshot_dir(
                        data_dir=snapshot_dir,
                        data_version=data_version,
                        auto_updated_at=str(lock.get("generated_at") or ""),
                    )
                )
            except ExamPipelineError as exc:
                raise PublicAssetError(str(exc)) from exc
    manifest, class_files = build_exam_history(snapshots, generated_at=generated_at)
    write_exam_history(output_dir=EXAM_DIR, manifest=manifest, class_files=class_files)


def materialize_exam_data() -> None:
    lock = read_json(EXAM_LOCK)
    lock_sha256 = sha256_file(EXAM_LOCK)
    generated_at = str(lock.get("generated_at") or "").strip()
    if not generated_at:
        raise PublicAssetError(f"{EXAM_LOCK} missing generated_at")

    with timed_phase("materialize exam public data"):
        try:
            materialize_locked_exam_files(lock_path=EXAM_LOCK, exam_dir=EXAM_DIR, cache_root=EXAM_DOWNLOAD_CACHE)
        except ExamPipelineError as exc:
            raise PublicAssetError(str(exc)) from exc

        env = os.environ.copy()
        env["NJUPT_SEARCH_GENERATED_AT"] = generated_at
        env["NJUPT_SEARCH_EXAM_DATA_VERSION"] = lock_sha256
        run([sys.executable, "-m", "njupt_exam_pipeline", "process"], env=env)
        build_exam_history_data(generated_at=generated_at)


def resolve_sitegraph_repo(lock: dict[str, Any]) -> Path:
    env_value = os.environ.get("NJUPT_SITEGRAPH_REPO")
    candidates = []
    if env_value:
        candidates.append(Path(env_value))
    checkout_path = lock.get("checkout_path")
    if isinstance(checkout_path, str) and checkout_path:
        candidates.append(REPO_ROOT / checkout_path)
    candidates.append(REPO_ROOT.parent / "njupt-site-graph")
    expected_ref = str(lock.get("sitegraph_ref") or "").strip()
    existing: list[Path] = []
    for candidate in candidates:
        resolved = candidate.resolve()
        if not (resolved / ".git").exists():
            continue
        existing.append(resolved)
        if not expected_ref:
            return resolved
        try:
            if capture(["git", "rev-parse", "HEAD"], cwd=resolved) == expected_ref:
                return resolved
        except subprocess.CalledProcessError:
            continue
    if existing:
        return existing[0]
    raise PublicAssetError("Cannot find njupt-site-graph checkout for sitegraph.lock.json")


def configured_source_packages() -> list[str]:
    config = read_json(SITEGRAPH_COLLECTION_CONFIG)
    if config.get("collection_id") != "njupt-public":
        raise PublicAssetError(f"{SITEGRAPH_COLLECTION_CONFIG} collection_id must be njupt-public")
    source_packages = config.get("source_packages")
    if not isinstance(source_packages, list) or not source_packages:
        raise PublicAssetError(f"{SITEGRAPH_COLLECTION_CONFIG} source_packages must be a non-empty list")
    normalized: list[str] = []
    for item in source_packages:
        if not isinstance(item, str) or not item:
            raise PublicAssetError(f"{SITEGRAPH_COLLECTION_CONFIG} source_packages entries must be non-empty strings")
        normalized.append(item)
    return normalized


def assert_sitegraph_lock_matches_collection_config(lock: dict[str, Any]) -> list[str]:
    configured = configured_source_packages()
    locked = lock.get("source_packages")
    if locked != configured:
        raise PublicAssetError(
            "sitegraph lock source_packages must match collection config: "
            + json.dumps({"lock": locked, "config": configured}, ensure_ascii=False)
        )
    return configured


def materialize_collection_data() -> None:
    lock = read_json(SITEGRAPH_LOCK)
    assert_sitegraph_lock_matches_collection_config(lock)
    generated_at = str(lock.get("generated_at") or "").strip()
    sitegraph_ref = str(lock.get("sitegraph_ref") or "").strip()
    if not generated_at or not sitegraph_ref:
        raise PublicAssetError(f"{SITEGRAPH_LOCK} missing generated_at or sitegraph_ref")
    sitegraph_repo = resolve_sitegraph_repo(lock)
    actual_ref = capture(["git", "rev-parse", "HEAD"], cwd=sitegraph_repo)
    if actual_ref != sitegraph_ref:
        raise PublicAssetError(
            f"sitegraph checkout ref mismatch: expected {sitegraph_ref}, got {actual_ref} at {sitegraph_repo}"
        )

    env = os.environ.copy()
    env["NJUPT_SITEGRAPH_REPO"] = str(sitegraph_repo)
    env["NJUPT_SEARCH_GENERATED_AT"] = generated_at
    with timed_phase("validate sitegraph source packages"):
        run([sys.executable, "-m", "njupt_search_indexer", "validate", "--skip-output"], env=env)
    with timed_phase("build collection public data"):
        run(
            [
                sys.executable,
                "-m",
                "njupt_search_indexer",
                "build",
                "--collection-id",
                "njupt-public",
                "--out",
                str(COLLECTION_DIR),
            ],
            env=env,
        )
    with timed_phase("validate generated collection public data"):
        run([sys.executable, "-m", "njupt_search_indexer", "validate", "--collection", str(COLLECTION_DIR)], env=env)


def generated_family_summary(root: Path) -> list[dict[str, Any]]:
    if not root.exists():
        return []
    families: dict[str, dict[str, Any]] = {}
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        parts = relative.split("/")
        family = "/".join(parts[:2]) if len(parts) >= 2 else parts[0]
        entry = families.setdefault(family, {"family": family, "files": 0, "bytes": 0})
        entry["files"] += 1
        entry["bytes"] += path.stat().st_size
    return sorted(families.values(), key=lambda item: int(item["bytes"]), reverse=True)


def build_public_data() -> None:
    PUBLIC_GENERATED.mkdir(parents=True, exist_ok=True)
    with timed_phase("materialize collection public data"):
        materialize_collection_data()
    materialize_exam_data()
    with timed_phase("write public asset marker"):
        write_json(
            PUBLIC_ASSET_MARKER,
            {
                "version": "njupt-search-public-asset-marker-v1",
                "sitegraph_lock_sha256": sha256_file(SITEGRAPH_LOCK),
                "exam_lock_sha256": sha256_file(EXAM_LOCK),
                "builder_fingerprint": public_asset_builder_fingerprint(),
            },
        )
    summary = generated_family_summary(PUBLIC_GENERATED)
    print(
        json.dumps(
            {
                "public_generated_file_count": sum(int(item["files"]) for item in summary),
                "public_generated_bytes": sum(int(item["bytes"]) for item in summary),
                "largest_public_generated_families": summary[:12],
            },
            ensure_ascii=False,
            indent=2,
        ),
        flush=True,
    )


def build_exam_public_data() -> None:
    PUBLIC_GENERATED.mkdir(parents=True, exist_ok=True)
    materialize_exam_data()
    summary = generated_family_summary(EXAM_DIR)
    print(
        json.dumps(
            {
                "exam_generated_file_count": sum(int(item["files"]) for item in summary),
                "exam_generated_bytes": sum(int(item["bytes"]) for item in summary),
                "largest_exam_generated_families": summary[:12],
            },
            ensure_ascii=False,
            indent=2,
        ),
        flush=True,
    )


def public_data_current() -> bool:
    if not PUBLIC_ASSET_MARKER.exists():
        return False
    try:
        marker = read_json(PUBLIC_ASSET_MARKER)
    except PublicAssetError:
        return False
    return (
        marker.get("sitegraph_lock_sha256") == sha256_file(SITEGRAPH_LOCK)
        and marker.get("exam_lock_sha256") == sha256_file(EXAM_LOCK)
        and marker.get("builder_fingerprint") == public_asset_builder_fingerprint()
        and (COLLECTION_DIR / "manifest.json").exists()
        and (EXAM_DIR / "all_exams.json").exists()
        and (EXAM_DIR / "data_summary.json").exists()
        and (EXAM_DIR / "history" / "manifest.json").exists()
    )


def ensure_public_data() -> None:
    if public_data_current():
        print("[prepare_public_assets] public data is current")
        return
    build_public_data()


def ensure_public_assets_exist() -> None:
    required = [
        COLLECTION_DIR / "manifest.json",
        EXAM_DIR / "all_exams.json",
        EXAM_DIR / "data_summary.json",
        EXAM_DIR / "history" / "manifest.json",
    ]
    missing = [str(path.relative_to(REPO_ROOT)) for path in required if not path.exists()]
    if missing:
        raise PublicAssetError("missing generated public assets: " + ", ".join(missing))


def hash_tree(root: Path) -> dict[str, str]:
    if not root.exists():
        return {}
    result: dict[str, str] = {}
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        result[str(path.relative_to(root)).replace("\\", "/")] = sha256_file(path)
    return result


def verify_public_assets() -> None:
    ensure_public_assets_exist()
    print(json.dumps({"public_generated_files": len(hash_tree(PUBLIC_GENERATED))}, ensure_ascii=False, indent=2))


def verify_exam_public_data() -> None:
    lock = read_json(EXAM_LOCK)
    summary_path = EXAM_DIR / "data_summary.json"
    exams_path = EXAM_DIR / "all_exams.json"
    metadata_path = EXAM_DIR / "source_metadata.json"
    history_manifest_path = EXAM_DIR / "history" / "manifest.json"
    for path in (summary_path, exams_path, metadata_path, history_manifest_path):
        if not path.exists():
            raise PublicAssetError(f"missing generated exam public asset: {path.relative_to(REPO_ROOT)}")
    if (EXAM_DIR / "change_summary.json").exists():
        raise PublicAssetError("obsolete exam change_summary.json must not be generated")
    if (EXAM_DIR / "changes").exists():
        raise PublicAssetError("obsolete exam changes directory must not be generated")
    if (EXAM_DIR / "DATA_INVENTORY.md").exists():
        raise PublicAssetError("exam DATA_INVENTORY.md must not be generated in public assets")

    summary = read_json(summary_path)
    metadata = read_json(metadata_path)
    history_manifest = read_json(history_manifest_path)
    with exams_path.open("r", encoding="utf-8") as handle:
        exams = json.load(handle)
    if not isinstance(exams, list) or not exams:
        raise PublicAssetError(f"{exams_path.relative_to(REPO_ROOT)} must contain a non-empty list")
    if summary.get("source_url") != lock.get("source_url"):
        raise PublicAssetError("exam data_summary source_url does not match exam lock")
    if summary.get("source_title") != lock.get("source_title"):
        raise PublicAssetError("exam data_summary source_title does not match exam lock")
    if metadata.get("source_url") != lock.get("source_url"):
        raise PublicAssetError("exam source_metadata source_url does not match exam lock")
    lock_names = [str(item.get("name") or "") for item in lock.get("files", []) if isinstance(item, dict)]
    if metadata.get("downloaded_files") != lock_names:
        raise PublicAssetError("exam source_metadata downloaded_files does not match exam lock")
    expected_data_version = sha256_file(EXAM_LOCK)
    if summary.get("data_version") != expected_data_version:
        raise PublicAssetError("exam data_summary data_version does not match exam lock")
    if metadata.get("data_version") != expected_data_version:
        raise PublicAssetError("exam source_metadata data_version does not match exam lock")
    total_records = summary.get("total_records")
    if not isinstance(total_records, int) or total_records != len(exams):
        raise PublicAssetError("exam data_summary total_records does not match all_exams length")
    exam_ids: set[str] = set()
    stable_keys: set[str] = set()
    for item in exams:
        if not isinstance(item, dict):
            raise PublicAssetError("all_exams entries must be objects")
        if "parse_error" in item:
            raise PublicAssetError("all_exams entries must not expose parse_error")
        exam_id = str(item.get("id") or "")
        stable_key = str(item.get("stable_key") or "")
        if not exam_id or not stable_key:
            raise PublicAssetError("all_exams entries must contain id and stable_key")
        if exam_id in exam_ids:
            raise PublicAssetError(f"duplicate exam id: {exam_id}")
        if stable_key in stable_keys:
            raise PublicAssetError(f"duplicate exam stable_key: {stable_key}")
        exam_ids.add(exam_id)
        stable_keys.add(stable_key)
    if history_manifest.get("version") != "exam-history-manifest-v1":
        raise PublicAssetError("exam history manifest version is invalid")
    if history_manifest.get("latest_data_version") != expected_data_version:
        raise PublicAssetError("exam history manifest latest_data_version does not match exam lock")
    history_totals = history_manifest.get("totals")
    if not isinstance(history_totals, dict) or history_totals.get("current_record_count") != len(exams):
        raise PublicAssetError("exam history manifest current_record_count does not match all_exams length")
    snapshots = history_manifest.get("snapshots")
    if not isinstance(snapshots, list) or len(snapshots) < 2:
        raise PublicAssetError("exam history manifest must contain at least two snapshots")
    classes = history_manifest.get("classes")
    if not isinstance(classes, list) or not classes:
        raise PublicAssetError("exam history manifest classes must be a non-empty list")
    for item in classes:
        if not isinstance(item, dict):
            raise PublicAssetError("exam history manifest classes entries must be objects")
        path_value = str(item.get("path") or "")
        if not path_value.startswith("generated/exam/history/classes/") or not path_value.endswith(".json"):
            raise PublicAssetError(f"invalid exam class history path: {path_value}")
        class_history_path = PUBLIC_ROOT / path_value
        class_payload = read_json(class_history_path)
        if class_payload.get("version") != "exam-class-history-v1":
            raise PublicAssetError(f"invalid exam class history version: {path_value}")
        if class_payload.get("latest_data_version") != expected_data_version:
            raise PublicAssetError(f"exam class history latest_data_version mismatch: {path_value}")
        if not isinstance(class_payload.get("checkpoints"), list) or not class_payload["checkpoints"]:
            raise PublicAssetError(f"exam class history checkpoints must be non-empty: {path_value}")
    print(
        json.dumps(
            {
                "exam_public_data_records": total_records,
                "exam_source_url": summary.get("source_url"),
                "exam_source_title": summary.get("source_title"),
                "exam_history_snapshots": len(snapshots),
                "exam_history_classes": len(classes),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def verify_determinism() -> None:
    if public_data_current():
        first = hash_tree(PUBLIC_GENERATED)
    else:
        build_public_data()
        first = hash_tree(PUBLIC_GENERATED)
    build_public_data()
    second = hash_tree(PUBLIC_GENERATED)
    if first != second:
        changed = sorted(set(first) ^ set(second))
        common_changed = sorted(path for path in set(first) & set(second) if first[path] != second[path])
        raise PublicAssetError(
            "public asset generation is not deterministic: "
            + json.dumps({"changed_paths": changed[:20], "content_changed": common_changed[:20]}, ensure_ascii=False)
        )
    print(json.dumps({"deterministic_public_generated_files": len(second)}, ensure_ascii=False, indent=2))


def update_exam_lock() -> None:
    try:
        update_exam_lock_from_source(EXAM_LOCK)
    except ExamPipelineError as exc:
        raise PublicAssetError(str(exc)) from exc
    lock = read_json(EXAM_LOCK)
    files = lock.get("files")
    file_count = len(files) if isinstance(files, list) else 0
    print(json.dumps({"updated": str(EXAM_LOCK.relative_to(REPO_ROOT)), "file_count": file_count}, ensure_ascii=False, indent=2))


def update_sitegraph_lock(sitegraph_ref: str | None) -> None:
    existing = read_json(SITEGRAPH_LOCK) if SITEGRAPH_LOCK.exists() else {}
    lock_for_repo = dict(existing)
    if sitegraph_ref:
        lock_for_repo["sitegraph_ref"] = sitegraph_ref
    sitegraph_repo = resolve_sitegraph_repo(lock_for_repo)
    actual_ref = capture(["git", "rev-parse", "HEAD"], cwd=sitegraph_repo)
    expected_ref = str(lock_for_repo.get("sitegraph_ref") or actual_ref)
    if actual_ref != expected_ref:
        raise PublicAssetError(f"sitegraph checkout ref mismatch while updating lock: expected {expected_ref}, got {actual_ref}")

    source_packages = configured_source_packages()
    upstream_times: list[str] = []
    for source_package in source_packages:
        manifest_path = sitegraph_repo / str(source_package) / "manifest.json"
        manifest = read_json(manifest_path)
        generated_at = str(manifest.get("generated_at") or "").strip()
        if generated_at:
            upstream_times.append(generated_at)
    payload = {
        "version": "njupt-search-sitegraph-lock-v1",
        "sitegraph_repo": existing.get("sitegraph_repo") or "hicancan/njupt-site-graph",
        "checkout_path": existing.get("checkout_path") or "_sitegraph/njupt-site-graph",
        "sitegraph_ref": actual_ref,
        "generated_at": max(upstream_times) if upstream_times else existing.get("generated_at"),
        "collection_id": "njupt-public",
        "source_packages": source_packages,
    }
    if not payload["generated_at"]:
        raise PublicAssetError("cannot update sitegraph lock without generated_at")
    write_json(SITEGRAPH_LOCK, payload)
    print(json.dumps({"updated": str(SITEGRAPH_LOCK.relative_to(REPO_ROOT)), "sitegraph_ref": actual_ref}, ensure_ascii=False, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare CI-only public assets for njupt-search.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("build-public-data")
    subparsers.add_parser("build-exam-public-data")
    subparsers.add_parser("ensure-public-data")
    subparsers.add_parser("verify-public-assets")
    subparsers.add_parser("verify-exam-public-data")
    subparsers.add_parser("verify-determinism")
    sitegraph_lock_parser = subparsers.add_parser("update-sitegraph-lock")
    sitegraph_lock_parser.add_argument("--sitegraph-ref", default=None)
    subparsers.add_parser("update-exam-lock")
    args = parser.parse_args()

    try:
        if args.command == "build-public-data":
            build_public_data()
        elif args.command == "build-exam-public-data":
            build_exam_public_data()
        elif args.command == "ensure-public-data":
            ensure_public_data()
        elif args.command == "verify-public-assets":
            verify_public_assets()
        elif args.command == "verify-exam-public-data":
            verify_exam_public_data()
        elif args.command == "verify-determinism":
            verify_determinism()
        elif args.command == "update-sitegraph-lock":
            update_sitegraph_lock(args.sitegraph_ref)
        elif args.command == "update-exam-lock":
            update_exam_lock()
    except PublicAssetError as error:
        print(f"[prepare_public_assets] {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
