from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

from .. import sitegraph_public_index as public_index


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def fail(message: str) -> None:
    print(f"[validate_sitegraph_index] {message}", file=sys.stderr)
    raise SystemExit(1)


def ensure_no_obsolete_fields(payload: Any, obsolete_fields: set[str], path: str = "$") -> None:
    if isinstance(payload, dict):
        for key, value in payload.items():
            if key in obsolete_fields:
                fail(f"{path}.{key} is an obsolete search field")
            ensure_no_obsolete_fields(value, obsolete_fields, f"{path}.{key}")
    elif isinstance(payload, list):
        for index, item in enumerate(payload):
            ensure_no_obsolete_fields(item, obsolete_fields, f"{path}[{index}]")


def ensure_public_hashed_path(path: str, label: str, *, extension: str = "json") -> Path:
    if "\\" in path or re.search(r"^[A-Za-z]:", path):
        fail(f"{label} must be public-relative: {path}")
    escaped_extension = re.escape(extension.lstrip("."))
    if not re.search(rf"\.[0-9a-f]{{16}}\.{escaped_extension}$", path):
        fail(f"{label} must use content hash filename: {path}")
    resolved = public_index.PUBLIC_ROOT / path
    if not resolved.exists():
        fail(f"{label} is missing: {resolved}")
    return resolved


def artifact_path(manifest: dict[str, Any], name: str) -> Path:
    artifacts = manifest.get("artifacts") if isinstance(manifest.get("artifacts"), dict) else {}
    entry = artifacts.get(name)
    if not isinstance(entry, dict) or not entry.get("path"):
        fail(f"manifest.artifacts.{name}.path is missing")
    return ensure_public_hashed_path(str(entry["path"]), f"manifest.artifacts.{name}.path")
