from __future__ import annotations

import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[4]


def load_search_query_list_config(filename: str) -> list[str]:
    payload = json.loads((BASE_DIR / "config" / "search" / filename).read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"{filename} must be a JSON list")
    return [str(query) for query in payload]
