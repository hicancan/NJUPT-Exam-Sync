from __future__ import annotations

import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from .contract import ExamPipelineError

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


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ExamPipelineError(f"{path} must contain a JSON object")
    return value


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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
        raise ExamPipelineError("download attempts must be positive")
    for attempt in range(1, attempts + 1):
        try:
            response = requests.get(url, headers=headers, timeout=timeout, verify=verify)
            if response.status_code in RETRYABLE_HTTP_STATUS_CODES and attempt < attempts:
                print(
                    f"[exam_source] {purpose} returned HTTP {response.status_code}; retrying {attempt}/{attempts}",
                    file=sys.stderr,
                    flush=True,
                )
                time.sleep(min(2 ** (attempt - 1), 8))
                continue
            response.raise_for_status()
            return response
        except RETRYABLE_REQUEST_EXCEPTIONS as exc:
            if attempt >= attempts:
                raise ExamPipelineError(f"{purpose} failed after {attempts} attempts: {url}") from exc
            print(
                f"[exam_source] {purpose} failed with {exc.__class__.__name__}; retrying {attempt}/{attempts}",
                file=sys.stderr,
                flush=True,
            )
            time.sleep(min(2 ** (attempt - 1), 8))
        except requests.exceptions.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code in RETRYABLE_HTTP_STATUS_CODES and attempt < attempts:
                print(
                    f"[exam_source] {purpose} returned HTTP {status_code}; retrying {attempt}/{attempts}",
                    file=sys.stderr,
                    flush=True,
                )
                time.sleep(min(2 ** (attempt - 1), 8))
                continue
            raise ExamPipelineError(f"{purpose} returned HTTP {status_code}: {url}") from exc
    raise ExamPipelineError(f"{purpose} failed without returning a response: {url}")


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
        raise ExamPipelineError("exam notice list container div.col_news_con was not found")
    for item in container.select("li.news"):
        title_span = item.select_one("span.news_title")
        link = title_span.find("a") if title_span else item.find("a")
        if link is None:
            continue
        title = str(link.get("title") or link.get_text(strip=True)).strip()
        href = str(link.get("href") or "").strip()
        if href and is_valid_exam_title(title):
            return urljoin(JWC_LIST_URL, href), title
    raise ExamPipelineError("no valid current exam schedule notice found")


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
        raise ExamPipelineError(f"no Excel attachments found in {source_url}")
    student_files = [item for item in candidates if is_student_exam_file(item["name"])]
    selected = student_files or [item for item in candidates if not is_teacher_exam_file(item["name"])]
    if not selected:
        raise ExamPipelineError(f"no student/non-teacher Excel attachments found in {source_url}")
    return selected


def update_exam_lock(lock_path: Path) -> None:
    existing = read_json(lock_path) if lock_path.exists() else {}
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
        files.append(
            {
                "name": item["name"],
                "url": item["url"],
                "sha256": hashlib.sha256(response.content).hexdigest(),
                "etag": response.headers.get("etag"),
                "last_modified": response.headers.get("last-modified"),
            }
        )
    existing_files = existing.get("files") if isinstance(existing.get("files"), list) else []
    changed = existing.get("source_url") != source_url or existing.get("source_title") != source_title or existing_files != files
    generated_at = datetime.now(timezone.utc).isoformat() if changed else str(existing.get("generated_at") or files[0].get("last_modified") or "")
    write_json(
        lock_path,
        {
            "version": "njupt-search-exam-lock-v1",
            "source_url": source_url,
            "source_title": source_title,
            "generated_at": generated_at,
            "tls_verify": tls_verify,
            "files": files,
        },
    )


def materialize_locked_exam_files(*, lock_path: Path, exam_dir: Path, cache_root: Path) -> None:
    lock = read_json(lock_path)
    lock_sha256 = sha256_file(lock_path)
    generated_at = str(lock.get("generated_at") or "").strip()
    if not generated_at:
        raise ExamPipelineError(f"{lock_path} missing generated_at")
    files = lock.get("files")
    if not isinstance(files, list) or not files:
        raise ExamPipelineError(f"{lock_path} files must be a non-empty list")

    exam_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = cache_root / lock_sha256
    cache_dir.mkdir(parents=True, exist_ok=True)
    downloaded_names: list[str] = []
    verify_tls = str(lock.get("tls_verify", True)).strip().lower() not in {"0", "false", "no"}
    for item in files:
        if not isinstance(item, dict):
            raise ExamPipelineError(f"{lock_path} files entries must be objects")
        name = str(item.get("name") or "").strip()
        url = str(item.get("url") or "").strip()
        expected_sha256 = str(item.get("sha256") or "").strip().lower()
        if not name or not url or not expected_sha256:
            raise ExamPipelineError(f"{lock_path} file entry missing name/url/sha256")
        target = exam_dir / name
        cache_target = cache_dir / name
        if target.exists() and sha256_file(target) == expected_sha256:
            pass
        elif cache_target.exists() and sha256_file(cache_target) == expected_sha256:
            target.write_bytes(cache_target.read_bytes())
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
                raise ExamPipelineError(f"exam lock hash mismatch for {name}: expected {expected_sha256}, got {actual_sha256}")
            tmp_target.replace(cache_target)
            target.write_bytes(cache_target.read_bytes())
        downloaded_names.append(name)

    expected_names = set(downloaded_names)
    for stale_excel in exam_dir.glob("*.xls*"):
        if stale_excel.name not in expected_names:
            stale_excel.unlink()

    write_json(
        exam_dir / "source_metadata.json",
        {
            "source_url": lock.get("source_url"),
            "source_title": lock.get("source_title"),
            "downloaded_files": downloaded_names,
            "updated_at": generated_at,
            "data_version": lock_sha256,
        },
    )

