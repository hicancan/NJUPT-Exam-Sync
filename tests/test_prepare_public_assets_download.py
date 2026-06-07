from __future__ import annotations

import requests

from tools.ci import prepare_public_assets


def make_response(status_code: int, body: bytes = b"ok") -> requests.Response:
    response = requests.Response()
    response.status_code = status_code
    response._content = body
    response.url = "https://example.invalid/file.xlsx"
    return response


def test_get_url_with_retries_recovers_from_transient_ssl(monkeypatch) -> None:
    calls = []

    def fake_get(*args, **kwargs):
        calls.append((args, kwargs))
        if len(calls) == 1:
            raise requests.exceptions.SSLError("transient eof")
        return make_response(200, b"stable")

    monkeypatch.setattr(prepare_public_assets.requests, "get", fake_get)
    monkeypatch.setattr(prepare_public_assets.time, "sleep", lambda _seconds: None)

    response = prepare_public_assets.get_url_with_retries(
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

    monkeypatch.setattr(prepare_public_assets.requests, "get", fake_get)
    monkeypatch.setattr(prepare_public_assets.time, "sleep", lambda _seconds: None)

    try:
        prepare_public_assets.get_url_with_retries(
            "https://example.invalid/missing.xlsx",
            timeout=60,
            verify=True,
            purpose="test download",
        )
    except prepare_public_assets.PublicAssetError as exc:
        assert "HTTP 404" in str(exc)
    else:
        raise AssertionError("expected PublicAssetError")

    assert len(calls) == 1
