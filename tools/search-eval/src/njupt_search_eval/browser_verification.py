from __future__ import annotations

import json
import shutil
import socket
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import urlopen


BASE_DIR = Path(__file__).resolve().parents[4]
REPORT_DIR = BASE_DIR / "tools" / "search-eval" / "reports"
DEFAULT_OUTPUT = REPORT_DIR / "njupt-search-browser-verification.json"
GENERATED_PREFIX = "/generated/"
ARTIFACT_EXTENSIONS = (".json", ".bin", ".wasm")


SCENARIOS: list[dict[str, Any]] = [
    {"name": "desktop-calendar", "query": "校历", "viewport": {"width": 1280, "height": 720}, "expect": "校历"},
    {"name": "desktop-cet", "query": "四六级", "viewport": {"width": 1280, "height": 720}, "expect": "四六级"},
    {"name": "desktop-grade", "query": "成绩", "viewport": {"width": 1280, "height": 720}, "expect": "成绩"},
    {"name": "desktop-high-df-notice", "query": "通知", "viewport": {"width": 1280, "height": 720}, "expect": "通知"},
    {"name": "desktop-high-df-student", "query": "学生", "viewport": {"width": 1280, "height": 720}, "expect": "学生"},
    {"name": "desktop-high-df-njupt", "query": "南京邮电大学", "viewport": {"width": 1280, "height": 720}, "expect": "南京邮电大学"},
    {"name": "desktop-cold-dynamic-holdout", "query": "物理实验科技作品", "viewport": {"width": 1280, "height": 720}, "expect": "匹配"},
    {"name": "desktop-miss-dynamic-holdout", "query": "不存在的物理实验科技作品zzzz", "viewport": {"width": 1280, "height": 720}, "expect": "没有找到"},
    {"name": "desktop-degenerate", "query": "a", "viewport": {"width": 1280, "height": 720}, "expect": "输入至少两个字符"},
    {
        "name": "desktop-filter-time",
        "query": "奖学金",
        "viewport": {"width": 1280, "height": 720},
        "expect": "奖学金",
        "filters": {"source": "xsc", "facet": "notice_article", "dateRange": "past_year"},
    },
    {"name": "mobile-hot-startup", "query": "大创", "viewport": {"width": 390, "height": 844}, "expect": "大创"},
]


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_for_http(base_url: str, timeout_s: float = 30.0) -> None:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            with urlopen(base_url, timeout=2) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.25)
    raise RuntimeError(f"preview server did not become ready: {base_url}")


def start_preview_server(port: int) -> subprocess.Popen[str]:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    out_log = (REPORT_DIR / "browser-devserver-current.out.log").open("w", encoding="utf-8")
    err_log = (REPORT_DIR / "browser-devserver-current.err.log").open("w", encoding="utf-8")
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if npm is None:
        raise RuntimeError("npm executable was not found")
    return subprocess.Popen(
        [npm, "run", "preview", "--", "--host", "127.0.0.1", "--port", str(port), "--strictPort"],
        cwd=BASE_DIR,
        stdout=out_log,
        stderr=err_log,
        text=True,
    )


def scenario_url(base_url: str, scenario: dict[str, Any], run_id: str) -> str:
    query = quote(str(scenario["query"]))
    url = f"{base_url}?q={query}&codexSmoke={run_id}"
    filters = scenario.get("filters")
    if isinstance(filters, dict):
        if filters.get("source"):
            url += f"&source={quote(str(filters['source']))}"
        if filters.get("facet"):
            url += f"&facet={quote(str(filters['facet']))}"
        if filters.get("dateRange"):
            url += f"&dateRange={quote(str(filters['dateRange']))}"
    return url


def resource_entries(page: Any) -> list[dict[str, Any]]:
    return page.evaluate(
        """() => performance.getEntriesByType('resource').map(entry => ({
            name: entry.name,
            transferSize: entry.transferSize || 0,
            encodedBodySize: entry.encodedBodySize || 0,
            decodedBodySize: entry.decodedBodySize || 0,
            duration: entry.duration || 0,
            initiatorType: entry.initiatorType || ''
        }))"""
    )


def immutable_artifact_bytes(entries: list[dict[str, Any]]) -> int:
    total = 0
    for entry in entries:
        name = str(entry.get("name") or "")
        if GENERATED_PREFIX not in name and not name.endswith(ARTIFACT_EXTENSIONS):
            continue
        total += int(entry.get("transferSize") or 0)
    return total


def layout_snapshot(page: Any) -> dict[str, Any]:
    return page.evaluate(
        """() => {
            const overflowing = [];
            for (const element of document.querySelectorAll('body *')) {
                const rect = element.getBoundingClientRect();
                if (rect.width > 0 && rect.right > document.documentElement.clientWidth + 1) {
                    overflowing.push({
                        tag: element.tagName,
                        className: String(element.className || ''),
                        right: Math.round(rect.right),
                        width: Math.round(rect.width)
                    });
                    if (overflowing.length >= 8) break;
                }
            }
            return {
                client_width: document.documentElement.clientWidth,
                scroll_width: document.documentElement.scrollWidth,
                overflow_x: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
                overflowing_elements: overflowing
            };
        }"""
    )


def technical_diagnostics(text: str) -> dict[str, Any]:
    return {
        "fast_start_visible": "fast-start 是" in text and "首屏路径 热查询首屏证书" in text,
        "topk_visible": "首屏路径 热查询 Top-K 证书" in text,
        "full_check_visible": "全量核查" in text,
        "cache_visible": "已缓存" in text or "0 B" in text,
    }


def completion_visible(page: Any) -> bool:
    return bool(
        page.evaluate(
            """() => {
                const text = document.body.innerText;
                return text.includes('全量核查完毕')
                    || text.includes('筛选范围核查完毕')
                    || text.includes('输入至少两个字符')
                    || text.includes('数据请求失败');
            }"""
        )
    )


def run_scenario(page: Any, base_url: str, scenario: dict[str, Any], run_id: str) -> dict[str, Any]:
    console_errors: list[str] = []
    http_errors: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on(
        "response",
        lambda response: http_errors.append(f"{response.status} {response.url}")
        if response.status >= 400 and (GENERATED_PREFIX in response.url or response.url.endswith(ARTIFACT_EXTENSIONS))
        else None,
    )
    page.set_viewport_size(scenario["viewport"])
    started = time.perf_counter()
    page.goto(scenario_url(base_url, scenario, run_id), wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=15_000)
    expected = str(scenario["expect"])
    wait_error: str | None = None
    page.wait_for_function(
        f"""() => {{
            const text = document.body.innerText;
            return text.includes({json.dumps(expected, ensure_ascii=False)})
                || text.includes('筛选范围核查完毕')
                || text.includes('输入至少两个字符')
                || text.includes('数据请求失败');
        }}""",
        timeout=int(scenario.get("visible_timeout_ms", 45_000)),
    )
    did_complete = completion_visible(page)
    if not did_complete:
        try:
            page.wait_for_function(
                """() => {
                    const text = document.body.innerText;
                    return text.includes('全量核查完毕')
                        || text.includes('筛选范围核查完毕')
                        || text.includes('输入至少两个字符')
                        || text.includes('数据请求失败');
                }""",
                timeout=int(scenario.get("completion_timeout_ms", 5_000)),
            )
            did_complete = True
        except Exception as exc:
            wait_error = f"completion marker not visible before optional timeout: {exc}"
    try:
        details = page.get_by_text("技术细节", exact=True)
        if details.count() > 0:
            details.first.click(timeout=1_000)
            page.wait_for_timeout(100)
    except Exception:
        pass
    body_text = page.locator("body").inner_text(timeout=5_000)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
    has_expected_text = expected in body_text
    has_data_error = "数据请求失败" in body_text or "HTTP 404" in body_text or "HTTP 500" in body_text
    layout = layout_snapshot(page)
    resources = resource_entries(page)
    passed = has_expected_text and not has_data_error and not console_errors and not http_errors and int(layout["overflow_x"]) == 0
    return {
        "name": scenario["name"],
        "query": scenario["query"],
        "viewport": f"{scenario['viewport']['width']}x{scenario['viewport']['height']}",
        "filters": scenario.get("filters"),
        "elapsed_ms": elapsed_ms,
        "has_expected_text": has_expected_text,
        "has_data_error": has_data_error,
        "diagnostics": technical_diagnostics(body_text),
        "completion_marker_visible": did_complete,
        "optional_completion_wait_error": wait_error,
        "immutable_artifact_transfer_bytes": immutable_artifact_bytes(resources),
        "layout": layout,
        "console_error_count": len(console_errors),
        "console_errors": console_errors[:8],
        "http_artifact_error_count": len(http_errors),
        "http_artifact_errors": http_errors[:8],
        "passed": passed,
    }


def run_warm_repeat(page: Any, base_url: str, run_id: str) -> dict[str, Any]:
    scenario = {"query": "校历", "viewport": {"width": 1280, "height": 720}}
    page.set_viewport_size(scenario["viewport"])
    page.goto(scenario_url(base_url, scenario, f"{run_id}-warm1"), wait_until="networkidle")
    first_entries = resource_entries(page)
    page.evaluate("performance.clearResourceTimings()")
    page.goto(scenario_url(base_url, scenario, f"{run_id}-warm2"), wait_until="networkidle")
    try:
        details = page.get_by_text("技术细节", exact=True)
        if details.count() > 0:
            details.first.click(timeout=1_000)
            page.wait_for_timeout(100)
    except Exception:
        pass
    second_text = page.locator("body").inner_text(timeout=5_000)
    second_entries = resource_entries(page)
    immutable_bytes = immutable_artifact_bytes(second_entries)
    return {
        "name": "desktop-warm-repeat-calendar",
        "query": "校历",
        "viewport": "1280x720",
        "first_immutable_artifact_transfer_bytes": immutable_artifact_bytes(first_entries),
        "immutable_artifact_transfer_bytes": immutable_bytes,
        "has_data_error": "数据请求失败" in second_text or "HTTP 404" in second_text or "HTTP 500" in second_text,
        "diagnostics_second": technical_diagnostics(second_text),
        "layout": layout_snapshot(page),
        "passed": immutable_bytes == 0,
    }


def run_browser_verification(output: Path = DEFAULT_OUTPUT, base_url: str | None = None) -> dict[str, Any]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit("Install browser dependencies with: uv run --extra browser python -m njupt_search_eval run-browser-verification") from exc

    port = find_free_port()
    process: subprocess.Popen[str] | None = None
    if base_url is None:
        process = start_preview_server(port)
        base_url = f"http://127.0.0.1:{port}/"
        wait_for_http(base_url)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            context = browser.new_context()
            page = context.new_page()
            scenarios = [run_scenario(page, base_url, scenario, run_id) for scenario in SCENARIOS]
            warm_repeat = run_warm_repeat(page, base_url, run_id)
            context.close()
            browser.close()
    finally:
        if process is not None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
    failed = [item["name"] for item in scenarios if not item["passed"]]
    if not warm_repeat["passed"]:
        failed.append(warm_repeat["name"])
    viewports = sorted({item["viewport"] for item in scenarios})
    report = {
        "report": "njupt-search-browser-verification-v21-compact-proof",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "summary": {
            "passed": not failed,
            "scenario_count": len(scenarios),
            "failed": failed,
            "persistent_cache_passed": warm_repeat["passed"],
            "max_warm_uncached_immutable_bytes": warm_repeat["immutable_artifact_transfer_bytes"],
            "viewports": viewports,
        },
        "scenarios": scenarios,
        "warm_repeat": warm_repeat,
        "evidence_notes": [
            "Generated immutable artifact transfer bytes are measured from browser ResourceTiming transferSize.",
            "Each scenario asserts expected visible text, no data request error, no generated artifact HTTP error, no console error, and no horizontal overflow.",
        ],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report
