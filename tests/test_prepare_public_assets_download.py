from __future__ import annotations

import requests

from njupt_exam_pipeline import source


def make_response(status_code: int, body: bytes = b"ok") -> requests.Response:
    response = requests.Response()
    response.status_code = status_code
    response._content = body
    response.url = "https://example.invalid/file.xlsx"
    return response


def make_exam_list(items: list[tuple[str, str]]) -> bytes:
    news_items = "\n".join(
        f'<li class="news"><span class="news_title"><a href="{href}" title="{title}">{title}</a></span></li>'
        for title, href in items
    )
    return f'<div class="col_news_con"><ul>{news_items}</ul></div>'.encode("utf-8")


def test_get_url_with_retries_recovers_from_transient_ssl(monkeypatch) -> None:
    calls = []

    def fake_get(*args, **kwargs):
        calls.append((args, kwargs))
        if len(calls) == 1:
            raise requests.exceptions.SSLError("transient eof")
        return make_response(200, b"stable")

    monkeypatch.setattr(source.requests, "get", fake_get)
    monkeypatch.setattr(source.time, "sleep", lambda _seconds: None)

    response = source.get_url_with_retries(
        "https://example.invalid/file.xlsx",
        timeout=60,
        verify=True,
        purpose="test download",
    )

    assert response.content == b"stable"
    assert len(calls) == 2


def test_get_url_with_retries_rejects_non_retryable_http(monkeypatch) -> None:
    calls = []

    def fake_get(*args, **kwargs):
        calls.append((args, kwargs))
        return make_response(404)

    monkeypatch.setattr(source.requests, "get", fake_get)
    monkeypatch.setattr(source.time, "sleep", lambda _seconds: None)

    try:
        source.get_url_with_retries(
            "https://example.invalid/missing.xlsx",
            timeout=60,
            verify=True,
            purpose="test download",
        )
    except source.ExamPipelineError as exc:
        assert "HTTP 404" in str(exc)
    else:
        raise AssertionError("expected PublicAssetError")

    assert len(calls) == 1


def test_discover_latest_exam_notice_scans_paginated_notice_pages(monkeypatch) -> None:
    page_one = "https://jwc.njupt.edu.cn/1594/list.htm"
    page_two = "https://jwc.njupt.edu.cn/1594/list2.htm"
    bodies = {
        page_one: make_exam_list(
            [
                ("【教务管理办公室】2026-2027学年第一学期学生选课通知", "/2026/0610/c1594a303951/page.htm"),
            ]
        ),
        page_two: make_exam_list(
            [
                ("【教务管理办公室】2025-2026学年第二学期考试安排表 2026-06-10", "/2026/0610/c1594a303974/page.htm"),
            ]
        ),
    }
    calls = []

    def fake_get_url(url, **_kwargs):
        calls.append(url)
        return make_response(200, bodies[url])

    monkeypatch.setattr(source, "JWC_LIST_URLS", (page_one, page_two))
    monkeypatch.setattr(source, "get_url_with_retries", fake_get_url)

    notice_url, title = source.discover_latest_exam_notice(tls_verify=True)

    assert calls == [page_one, page_two]
    assert notice_url == "https://jwc.njupt.edu.cn/2026/0610/c1594a303974/page.htm"
    assert title == "【教务管理办公室】2025-2026学年第二学期考试安排表 2026-06-10"
