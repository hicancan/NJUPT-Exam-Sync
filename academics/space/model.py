from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SPACE_FORMAT = "njupt-space-snapshot"
ARTIFACT_FIELDS = {"path", "bytes", "sha256"}
MANIFEST_FIELDS = {
    "format",
    "snapshot_id",
    "source_id",
    "campus_count",
    "building_count",
    "floor_count",
    "space_family_count",
    "space_unit_count",
    "geometry_unit_count",
    "unresolved_count",
    "artifacts",
}


class SpaceSnapshotError(RuntimeError):
    """The current authoritative campus space artifact is invalid."""


@dataclass(frozen=True)
class SpaceSnapshot:
    root: Path
    snapshot_id: str
    source_id: str
    campuses: list[dict[str, Any]]
    buildings: list[dict[str, Any]]
    floors: list[dict[str, Any]]
    families: list[dict[str, Any]]
    units: list[dict[str, Any]]
    aliases: list[dict[str, Any]]
    connectors: list[dict[str, Any]]
    audit: dict[str, Any]

    @property
    def families_by_id(self) -> dict[str, dict[str, Any]]:
        return {item["space_family_id"]: item for item in self.families}

    @property
    def units_by_id(self) -> dict[str, dict[str, Any]]:
        return {item["space_unit_id"]: item for item in self.units}


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SpaceSnapshotError(f"Invalid JSON: {path}") from exc


def require_hash(value: Any, label: str) -> str:
    if not isinstance(value, str) or len(value) != 64 or any(char not in "0123456789abcdef" for char in value):
        raise SpaceSnapshotError(f"{label} must be a SHA-256 hex string")
    return value


def exact_object(value: Any, fields: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != fields:
        raise SpaceSnapshotError(f"{label} has an incompatible shape")
    return value


def validate_artifact(root: Path, value: Any) -> tuple[str, Any]:
    relative, content = validate_binary_artifact(root, value)
    try:
        return relative, json.loads(content)
    except Exception as exc:
        raise SpaceSnapshotError(f"SpaceSnapshot artifact is not valid JSON: {relative}") from exc


def validate_binary_artifact(root: Path, value: Any) -> tuple[str, bytes]:
    reference = exact_object(value, ARTIFACT_FIELDS, "SpaceSnapshot artifact")
    relative = reference.get("path")
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute() or ".." in Path(relative).parts:
        raise SpaceSnapshotError("SpaceSnapshot artifact path is invalid")
    path = root / relative
    try:
        content = path.read_bytes()
    except OSError as exc:
        raise SpaceSnapshotError(f"SpaceSnapshot artifact is missing: {relative}") from exc
    if reference.get("bytes") != len(content) or require_hash(reference.get("sha256"), "artifact.sha256") != sha256(content):
        raise SpaceSnapshotError(f"SpaceSnapshot artifact integrity mismatch: {relative}")
    return relative, content


def _validate_unique(items: list[dict[str, Any]], key: str, label: str) -> None:
    identities = [item.get(key) for item in items]
    if any(not isinstance(identity, str) or not identity for identity in identities) or len(set(identities)) != len(identities):
        raise SpaceSnapshotError(f"{label} identities are invalid or duplicated")


def _point(value: Any, label: str) -> None:
    if value is None:
        return
    if (
        not isinstance(value, list)
        or len(value) != 2
        or any(not isinstance(number, (int, float)) or number < 0 or number > 1 for number in value)
    ):
        raise SpaceSnapshotError(f"{label} must be null or a normalized point")


def _segments_intersect(a: list[float], b: list[float], c: list[float], d: list[float]) -> bool:
    def orientation(p: list[float], q: list[float], r: list[float]) -> float:
        return (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1])

    return orientation(a, b, c) * orientation(a, b, d) < 0 and orientation(c, d, a) * orientation(c, d, b) < 0


def _polygon(value: Any, label: str) -> None:
    if value is None:
        return
    if not isinstance(value, list) or len(value) < 4 or value[0] != value[-1]:
        raise SpaceSnapshotError(f"{label} must be a closed polygon")
    for index, point in enumerate(value):
        _point(point, f"{label}[{index}]")
    edges = list(zip(value[:-1], value[1:], strict=True))
    for first, (a, b) in enumerate(edges):
        for second, (c, d) in enumerate(edges):
            if abs(first - second) <= 1 or {first, second} == {0, len(edges) - 1}:
                continue
            if _segments_intersect(a, b, c, d):
                raise SpaceSnapshotError(f"{label} self-intersects")


def load_space_snapshot(root: Path) -> SpaceSnapshot:
    root = root.resolve()
    manifest = exact_object(read_json(root / "manifest.json"), MANIFEST_FIELDS, "SpaceSnapshot manifest")
    if manifest.get("format") != SPACE_FORMAT:
        raise SpaceSnapshotError("Unsupported SpaceSnapshot format")
    snapshot_id = require_hash(manifest.get("snapshot_id"), "snapshot_id")
    source_id = require_hash(manifest.get("source_id"), "source_id")
    identity = {key: value for key, value in manifest.items() if key != "snapshot_id"}
    if snapshot_id != sha256(canonical_bytes(identity)):
        raise SpaceSnapshotError("SpaceSnapshot identity mismatch")
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, dict) or set(artifacts) != {
        "campuses", "buildings", "floors", "space_families", "space_units", "aliases", "connectors", "geometry", "audit"
    }:
        raise SpaceSnapshotError("SpaceSnapshot artifact collection is incompatible")
    if not isinstance(artifacts["space_units"], list) or not artifacts["space_units"]:
        raise SpaceSnapshotError("SpaceSnapshot must have space unit chunks")
    if not isinstance(artifacts["geometry"], list):
        raise SpaceSnapshotError("SpaceSnapshot geometry references must be an array")

    loaded: dict[str, Any] = {}
    expected = {"manifest.json"}
    for name in ("campuses", "buildings", "floors", "space_families", "aliases", "connectors", "audit"):
        relative, payload = validate_artifact(root, artifacts[name])
        expected.add(relative)
        loaded[name] = payload
    unit_docs = []
    for reference in artifacts["space_units"]:
        relative, payload = validate_artifact(root, reference)
        expected.add(relative)
        unit_docs.append(payload)
    geometry_docs = []
    for reference in artifacts["geometry"]:
        relative, payload = validate_artifact(root, reference)
        expected.add(relative)
        geometry_docs.append(payload)
    doc_formats = {
        "campuses": "njupt-space-campuses",
        "buildings": "njupt-space-buildings",
        "floors": "njupt-space-floors",
        "space_families": "njupt-space-families",
        "aliases": "njupt-space-aliases",
        "connectors": "njupt-space-connectors",
        "audit": "njupt-space-audit",
    }
    item_fields = {
        "campuses": "campuses",
        "buildings": "buildings",
        "floors": "floors",
        "space_families": "space_families",
        "aliases": "aliases",
        "connectors": "connectors",
    }
    for name, expected_format in doc_formats.items():
        payload = loaded[name]
        required = {"format", "source_id", item_fields[name]} if name != "audit" else {"format", "source_id", "audit"}
        exact_object(payload, required, name)
        if payload["format"] != expected_format or payload["source_id"] != source_id:
            raise SpaceSnapshotError(f"{name} identity mismatch")

    campuses = loaded["campuses"]["campuses"]
    buildings = loaded["buildings"]["buildings"]
    floors = loaded["floors"]["floors"]
    families = loaded["space_families"]["space_families"]
    aliases = loaded["aliases"]["aliases"]
    connectors = loaded["connectors"]["connectors"]
    collections = (campuses, buildings, floors, families, aliases, connectors)
    if any(not isinstance(collection, list) for collection in collections):
        raise SpaceSnapshotError("SpaceSnapshot entity collections must be arrays")
    units: list[dict[str, Any]] = []
    for document in unit_docs:
        exact_object(document, {"format", "source_id", "space_units"}, "space unit chunk")
        if document["format"] != "njupt-space-units" or document["source_id"] != source_id or not isinstance(document["space_units"], list):
            raise SpaceSnapshotError("Space unit chunk identity mismatch")
        units.extend(document["space_units"])

    _validate_unique(campuses, "campus_id", "campus")
    _validate_unique(buildings, "building_id", "building")
    _validate_unique(floors, "floor_id", "floor")
    _validate_unique(families, "space_family_id", "space family")
    _validate_unique(units, "space_unit_id", "space unit")
    _validate_unique(connectors, "connector_id", "connector")
    if len(campuses) != manifest["campus_count"] or len(buildings) != manifest["building_count"] or len(floors) != manifest["floor_count"]:
        raise SpaceSnapshotError("SpaceSnapshot geography counts do not match")
    if len(families) != manifest["space_family_count"] or len(units) != manifest["space_unit_count"]:
        raise SpaceSnapshotError("SpaceSnapshot space counts do not match")

    unit_ids = {item["space_unit_id"] for item in units}
    family_ids = {item["space_family_id"] for item in families}
    if any(item.get("space_family_id") not in family_ids for item in units):
        raise SpaceSnapshotError("SpaceUnit references an unknown SpaceFamily")
    if any(any(unit_id not in unit_ids for unit_id in family.get("space_unit_ids", [])) for family in families):
        raise SpaceSnapshotError("SpaceFamily references an unknown SpaceUnit")
    geometry_count = 0
    seen_geometry_units: set[str] = set()
    for document in geometry_docs:
        exact_object(document, {"format", "source_id", "floor_id", "coordinate_system", "geometry_accuracy", "view_box", "plan", "space_units"}, "geometry chunk")
        if document["format"] != "njupt-space-geometry" or document["source_id"] != source_id or not isinstance(document["space_units"], list):
            raise SpaceSnapshotError("Space geometry identity mismatch")
        view_box = document["view_box"]
        if not isinstance(view_box, list) or len(view_box) != 2 or any(not isinstance(value, int) or value <= 0 for value in view_box):
            raise SpaceSnapshotError("Space geometry view box is invalid")
        plan_relative, plan_content = validate_binary_artifact(root, document["plan"])
        if not plan_relative.startswith("plans/plan-") or not plan_relative.endswith(".svg"):
            raise SpaceSnapshotError("Space floor plan path is invalid")
        try:
            plan_text = plan_content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise SpaceSnapshotError("Space floor plan is not UTF-8 SVG") from exc
        if "<!" in plan_text or "javascript:" in plan_text.lower() or "href=" in plan_text.lower():
            raise SpaceSnapshotError("Space floor plan contains unsafe content")
        expected.add(plan_relative)
        for entry in document["space_units"]:
            exact_object(entry, {"space_unit_id", "geometry_status", "label_point", "polygon"}, "space geometry")
            unit_id = entry["space_unit_id"]
            if unit_id not in unit_ids or unit_id in seen_geometry_units:
                raise SpaceSnapshotError("Space geometry references an invalid or duplicate unit")
            seen_geometry_units.add(unit_id)
            _point(entry["label_point"], "geometry.label_point")
            _polygon(entry["polygon"], "geometry.polygon")
            if entry["polygon"] is not None:
                geometry_count += 1
    if geometry_count != manifest["geometry_unit_count"]:
        raise SpaceSnapshotError("SpaceSnapshot geometry count does not match")
    actual = {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}
    if actual != expected:
        raise SpaceSnapshotError(f"SpaceSnapshot file set mismatch: expected {sorted(expected)}, got {sorted(actual)}")
    return SpaceSnapshot(
        root=root,
        snapshot_id=snapshot_id,
        source_id=source_id,
        campuses=campuses,
        buildings=buildings,
        floors=floors,
        families=families,
        units=units,
        aliases=aliases,
        connectors=connectors,
        audit=loaded["audit"]["audit"],
    )
