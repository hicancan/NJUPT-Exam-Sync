from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin


REPO_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_ROOT = REPO_ROOT / "apps" / "web" / "public"
PUBLIC_GENERATED = PUBLIC_ROOT / "generated"
COLLECTION_DIR = PUBLIC_GENERATED / "collections" / "njupt-public"
EXAM_DIR = PUBLIC_GENERATED / "exam"
EXAM_DOWNLOAD_CACHE = REPO_ROOT / "cache" / "exam-lock"
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
JWC_LIST_URL = "https://jwc.njupt.edu.cn/1594/list.htm"
JWC_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Referer": "https://jwc.njupt.edu.cn/",
}
REQUIRED_EXAM_TITLE_KEYWORDS = ("学年", "学期")
TARGET_EXAM_TITLE_KEYWORDS = ("考试安排表", "期末考试", "课程结束考试")
EXCLUDED_EXAM_TITLE_KEYWORDS = ("阶段性", "补考", "清欠", "分级", "补学", "换证", "重修", "选拔", "竞赛", "发车", "监考")
RETRYABLE_HTTP_STATUS_CODES = frozenset({408, 409, 425, 429, 500, 502, 503, 504})
RETRYABLE_REQUEST_EXCEPTIONS = (
    requests.exceptions.ChunkedEncodingError,
    requests.exceptions.ConnectionError,
    requests.exceptions.SSLError,
    requests.exceptions.Timeout,
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


def get_url_with_retries(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: int,
    verify: bool,
    purpose: str,
    attempts: int = 4,
) -> requests.Response:
    if attempts < 1:
        raise PublicAssetError("download attempts must be positive")
    for attempt in range(1, attempts + 1):
        try:
            response = requests.get(url, headers=headers, timeout=timeout, verify=verify)
            if response.status_code in RETRYABLE_HTTP_STATUS_CODES and attempt < attempts:
                print(
                    f"[prepare_public_assets] {purpose} returned HTTP {response.status_code}; "
                    f"retrying {attempt}/{attempts}",
                    file=sys.stderr,
                    flush=True,
                )
                time.sleep(min(2 ** (attempt - 1), 8))
                continue
            response.raise_for_status()
            return response
        except RETRYABLE_REQUEST_EXCEPTIONS as exc:
            if attempt >= attempts:
                raise PublicAssetError(f"{purpose} failed after {attempts} attempts: {url}") from exc
            print(
                f"[prepare_public_assets] {purpose} failed with {exc.__class__.__name__}; "
                f"retrying {attempt}/{attempts}",
                file=sys.stderr,
                flush=True,
            )
            time.sleep(min(2 ** (attempt - 1), 8))
        except requests.exceptions.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code in RETRYABLE_HTTP_STATUS_CODES and attempt < attempts:
                print(
                    f"[prepare_public_assets] {purpose} returned HTTP {status_code}; "
                    f"retrying {attempt}/{attempts}",
                    file=sys.stderr,
                    flush=True,
                )
                time.sleep(min(2 ** (attempt - 1), 8))
                continue
            raise PublicAssetError(f"{purpose} returned HTTP {status_code}: {url}") from exc
    raise PublicAssetError(f"{purpose} failed without returning a response: {url}")


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


def materialize_exam_data() -> None:
    lock = read_json(EXAM_LOCK)
    lock_sha256 = sha256_file(EXAM_LOCK)
    generated_at = str(lock.get("generated_at") or "").strip()
    if not generated_at:
        raise PublicAssetError(f"{EXAM_LOCK} missing generated_at")
    files = lock.get("files")
    if not isinstance(files, list) or not files:
        raise PublicAssetError(f"{EXAM_LOCK} files must be a non-empty list")

    with timed_phase("materialize exam public data"):
        EXAM_DIR.mkdir(parents=True, exist_ok=True)
        cache_dir = EXAM_DOWNLOAD_CACHE / lock_sha256
        cache_dir.mkdir(parents=True, exist_ok=True)

        downloaded_names: list[str] = []
        verify_tls = str(lock.get("tls_verify", True)).strip().lower() not in {"0", "false", "no"}
        for item in files:
            if not isinstance(item, dict):
                raise PublicAssetError(f"{EXAM_LOCK} files entries must be objects")
            name = str(item.get("name") or "").strip()
            url = str(item.get("url") or "").strip()
            expected_sha256 = str(item.get("sha256") or "").strip().lower()
            if not name or not url or not expected_sha256:
                raise PublicAssetError(f"{EXAM_LOCK} file entry missing name/url/sha256")
            target = EXAM_DIR / name
            cache_target = cache_dir / name
            if target.exists() and sha256_file(target) == expected_sha256:
                pass
            elif cache_target.exists() and sha256_file(cache_target) == expected_sha256:
                shutil.copy2(cache_target, target)
            else:
                response = get_url_with_retries(
                    url,
                    headers=JWC_HEADERS,
                    timeout=60,
                    verify=verify_tls,
                    purpose=f"download exam file {name}",
                )
                tmp_target = cache_target.with_suffix(cache_target.suffix + ".tmp")
                tmp_target.write_bytes(response.content)
                actual_sha256 = sha256_file(tmp_target)
                if actual_sha256 != expected_sha256:
                    tmp_target.unlink(missing_ok=True)
                    raise PublicAssetError(
                        f"exam lock hash mismatch for {name}: expected {expected_sha256}, got {actual_sha256}"
                    )
                tmp_target.replace(cache_target)
                shutil.copy2(cache_target, target)
            downloaded_names.append(name)
        expected_names = set(downloaded_names)
        for stale_excel in EXAM_DIR.glob("*.xls*"):
            if stale_excel.name not in expected_names:
                stale_excel.unlink()

        write_json(
            EXAM_DIR / "source_metadata.json",
            {
                "source_url": lock.get("source_url"),
                "source_title": lock.get("source_title"),
                "downloaded_files": downloaded_names,
                "updated_at": generated_at,
                "data_version": lock_sha256,
            },
        )

        env = os.environ.copy()
        env["NJUPT_SEARCH_GENERATED_AT"] = generated_at
        env["NJUPT_SEARCH_EXAM_DATA_VERSION"] = lock_sha256
        run([sys.executable, "-m", "njupt_exam_pipeline", "process"], env=env)


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
    for path in (summary_path, exams_path, metadata_path):
        if not path.exists():
            raise PublicAssetError(f"missing generated exam public asset: {path.relative_to(REPO_ROOT)}")

    summary = read_json(summary_path)
    metadata = read_json(metadata_path)
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
    print(
        json.dumps(
            {
                "exam_public_data_records": total_records,
                "exam_source_url": summary.get("source_url"),
                "exam_source_title": summary.get("source_title"),
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


def is_valid_exam_title(title: str) -> bool:
    return (
        all(keyword in title for keyword in REQUIRED_EXAM_TITLE_KEYWORDS)
        and any(keyword in title for keyword in TARGET_EXAM_TITLE_KEYWORDS)
        and not any(keyword in title for keyword in EXCLUDED_EXAM_TITLE_KEYWORDS)
    )


def is_student_exam_file(name: str) -> bool:
    return "学生" in name


def is_teacher_exam_file(name: str) -> bool:
    return any(keyword in name for keyword in ("监考", "教师", "巡考", "教务员"))


def discover_latest_exam_notice(*, tls_verify: bool) -> tuple[str, str]:
    response = get_url_with_retries(
        JWC_LIST_URL,
        headers=JWC_HEADERS,
        timeout=30,
        verify=tls_verify,
        purpose="discover latest exam notice list",
    )
    response.encoding = "utf-8"
    soup = BeautifulSoup(response.text, "html.parser")
    container = soup.select_one("div.col_news_con")
    if container is None:
        raise PublicAssetError("exam notice list container div.col_news_con was not found")
    for item in container.select("li.news"):
        title_span = item.select_one("span.news_title")
        link = title_span.find("a") if title_span else item.find("a")
        if link is None:
            continue
        title = str(link.get("title") or link.get_text(strip=True)).strip()
        href = str(link.get("href") or "").strip()
        if href and is_valid_exam_title(title):
            return urljoin(JWC_LIST_URL, href), title
    raise PublicAssetError("no valid current exam schedule notice found")


def discover_exam_files(source_url: str, *, tls_verify: bool) -> list[dict[str, str]]:
    response = get_url_with_retries(
        source_url,
        headers=JWC_HEADERS,
        timeout=30,
        verify=tls_verify,
        purpose="discover exam files",
    )
    response.encoding = "utf-8"
    soup = BeautifulSoup(response.text, "html.parser")
    candidates: list[dict[str, str]] = []
    for link in soup.find_all("a"):
        href = str(link.get("href") or "").strip()
        if not href.lower().endswith((".xls", ".xlsx")):
            continue
        name = str(link.get_text(strip=True) or Path(href).name).strip()
        if not name.lower().endswith((".xls", ".xlsx")):
            name = Path(href).name
        candidates.append({"name": name, "url": urljoin(source_url, href)})
    if not candidates:
        raise PublicAssetError(f"no Excel attachments found in {source_url}")
    student_files = [item for item in candidates if is_student_exam_file(item["name"])]
    selected = student_files or [item for item in candidates if not is_teacher_exam_file(item["name"])]
    if not selected:
        raise PublicAssetError(f"no student/non-teacher Excel attachments found in {source_url}")
    return selected


def update_exam_lock() -> None:
    existing = read_json(EXAM_LOCK) if EXAM_LOCK.exists() else {}
    tls_verify = str(existing.get("tls_verify", True)).strip().lower() not in {"0", "false", "no"}
    source_url, source_title = discover_latest_exam_notice(tls_verify=tls_verify)
    files = []
    for item in discover_exam_files(source_url, tls_verify=tls_verify):
        response = get_url_with_retries(
            item["url"],
            headers=JWC_HEADERS,
            timeout=60,
            verify=tls_verify,
            purpose=f"download exam lock candidate {item['name']}",
        )
        digest = hashlib.sha256(response.content).hexdigest()
        files.append(
            {
                "name": item["name"],
                "url": item["url"],
                "sha256": digest,
                "etag": response.headers.get("etag"),
                "last_modified": response.headers.get("last-modified"),
            }
        )
    existing_files = existing.get("files") if isinstance(existing.get("files"), list) else []
    changed = (
        existing.get("source_url") != source_url
        or existing.get("source_title") != source_title
        or existing_files != files
    )
    generated_at = (
        datetime.now(timezone.utc).isoformat()
        if changed
        else str(existing.get("generated_at") or files[0].get("last_modified") or "")
    )
    payload = {
        "version": "njupt-search-exam-lock-v1",
        "source_url": source_url,
        "source_title": source_title,
        "generated_at": generated_at,
        "tls_verify": tls_verify,
        "files": files,
    }
    write_json(EXAM_LOCK, payload)
    print(json.dumps({"updated": str(EXAM_LOCK.relative_to(REPO_ROOT)), "file_count": len(files)}, ensure_ascii=False, indent=2))


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
