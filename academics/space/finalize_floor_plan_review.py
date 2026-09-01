from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
from typing import Any

from shapely.geometry import Point, Polygon

if __package__:
    from academics.space.reconstruct import apply_reviewed_geometry_corrections
else:
    from reconstruct import apply_reviewed_geometry_corrections


REVIEW_FORMAT = "njupt-reviewed-floor-plan-geometry"
RECONSTRUCTION_FORMAT = "njupt-floor-plan-reconstruction"
ACCEPTANCE_FORMAT = "njupt-floor-plan-reconstruction-acceptance"


def canonical_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while block := source.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def floor_slug(building: str, level: int) -> str:
    return f"jiao-{building.removeprefix('教')}-floor-{level:02d}"


def load_json(path: Path, expected_format: str) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if value.get("format") != expected_format:
        raise ValueError(f"unexpected format in {path}: {value.get('format')}")
    return value


def manual_points_for_floor(
    floor: dict[str, Any], floor_config: dict[str, Any]
) -> dict[str, list[float]]:
    result: dict[str, list[float]] = {}
    for identifier, raw_point in floor_config.get("manual_label_points", {}).items():
        matches = [
            unit
            for unit in floor["units"]
            if unit["region_id"] == identifier or unit["raw_label"] == identifier
        ]
        if len(matches) != 1:
            raise ValueError(
                f"manual label point must identify one region on "
                f"{floor['building']} floor {floor['floor']}: {identifier}"
            )
        point = [float(raw_point[0]), float(raw_point[1])]
        if not (0 < point[0] < 1 and 0 < point[1] < 1):
            raise ValueError(f"manual label point is outside the source: {identifier}")
        result[matches[0]["region_id"]] = point
    return result


def validate_candidate(
    region_id: str,
    raw_polygon: list[list[float]],
    label_point: list[float] | None,
    allow_label_offset: bool,
) -> Polygon:
    if len(raw_polygon) < 4 or raw_polygon[0] != raw_polygon[-1]:
        raise ValueError(f"candidate polygon is not closed: {region_id}")
    if any(
        len(point) != 2 or not (0 <= float(point[0]) <= 1 and 0 <= float(point[1]) <= 1)
        for point in raw_polygon
    ):
        raise ValueError(f"candidate polygon is outside normalized coordinates: {region_id}")
    polygon = Polygon([(float(x), float(y)) for x, y in raw_polygon])
    if not polygon.is_valid or polygon.area <= 1e-7:
        raise ValueError(f"candidate polygon is invalid or empty: {region_id}")
    # OCR label centroids can sit a few pixels across a narrow-room wall because
    # the printed vertical text itself straddles the boundary.  The tolerance is
    # still bounded to 1.2% of the source dimension and is never used to grow the
    # exported geometry.
    if label_point is not None and not allow_label_offset and not polygon.buffer(0.012).covers(
        Point(float(label_point[0]), float(label_point[1]))
    ):
        raise ValueError(f"candidate polygon does not contain its label: {region_id}")
    return polygon


def validate_promoted_topology(
    promoted: dict[str, Polygon], all_polygons: list[tuple[str, Polygon]]
) -> None:
    conflicts: list[str] = []
    for promoted_id, promoted_shape in promoted.items():
        promoted_floor = promoted_id.rsplit("-label-", 1)[0]
        for other_id, other_shape in all_polygons:
            if (
                promoted_id == other_id
                or other_id.rsplit("-label-", 1)[0] != promoted_floor
                or not promoted_shape.intersects(other_shape)
            ):
                continue
            overlap_area = promoted_shape.intersection(other_shape).area
            if overlap_area <= 1e-8:
                continue
            overlap_ratio = overlap_area / min(promoted_shape.area, other_shape.area)
            if overlap_ratio > 0.02:
                conflicts.append(
                    f"{promoted_id} / {other_id} ({overlap_ratio:.3%})"
                )
    if conflicts:
        unique_conflicts = list(dict.fromkeys(conflicts))
        raise ValueError(
            "promoted geometry overlaps another room:\n"
            + "\n".join(unique_conflicts[:50])
        )


def finalize(args: argparse.Namespace) -> None:
    reviewed_path = Path(args.reviewed_geometry).resolve()
    review_config_path = Path(args.review_config).resolve()
    reconstruction_root = Path(args.reconstruction).resolve()
    acceptance_path = Path(args.acceptance).resolve()
    output_path = Path(args.output).resolve()

    reviewed = load_json(reviewed_path, REVIEW_FORMAT)
    config = load_json(review_config_path, "njupt-floor-plan-reconstruction-review")
    manifest = load_json(reconstruction_root / "manifest.json", RECONSTRUCTION_FORMAT)
    acceptance = load_json(acceptance_path, ACCEPTANCE_FORMAT)
    if acceptance["reconstruction_id"] != manifest["reconstruction_id"]:
        raise ValueError("acceptance points to a different reconstruction")
    if manifest["source_review_id"] != reviewed["review_id"]:
        raise ValueError("reconstruction points to a different reviewed source")
    if manifest["source_review_sha256"] != sha256_file(reviewed_path):
        raise ValueError("reviewed source bytes changed after reconstruction")

    result = copy.deepcopy(reviewed)
    units_by_id = {
        unit["region_id"]: unit
        for floor in result["floors"]
        for unit in floor["units"]
    }
    promoted_shapes: dict[str, Polygon] = {}
    promoted_count = 0
    label_point_exceptions = acceptance.get("label_point_exceptions", {})
    used_label_point_exceptions: set[str] = set()

    for floor in result["floors"]:
        key = f"{floor['building']}/{floor['floor']}"
        floor_config = config.get("floors", {}).get(key, {})
        apply_reviewed_geometry_corrections(
            floor, floor_config.get("reviewed_geometry_corrections", {})
        )
        manual_points = manual_points_for_floor(floor, floor_config)
        slug = floor_slug(floor["building"], int(floor["floor"]))
        candidate_path = (
            reconstruction_root
            / floor["building"]
            / f"floor-{int(floor['floor']):02d}"
            / f"{slug}-geometry-candidates.json"
        )
        candidate_document = load_json(
            candidate_path, "njupt-floor-plan-geometry-candidates"
        )
        if candidate_document["source_image_sha256"] != floor["source_image_sha256"]:
            raise ValueError(f"candidate source mismatch: {key}")
        for region_id, raw_polygon in candidate_document["candidates"].items():
            unit = units_by_id.get(region_id)
            if unit is None or unit not in floor["units"]:
                raise ValueError(f"candidate references an unknown floor region: {region_id}")
            if unit.get("polygon"):
                raise ValueError(f"candidate would replace reviewed geometry: {region_id}")
            label_point = unit.get("label_point") or manual_points.get(region_id)
            allow_label_offset = region_id in label_point_exceptions
            shape = validate_candidate(
                region_id, raw_polygon, label_point, allow_label_offset
            )
            if allow_label_offset:
                used_label_point_exceptions.add(region_id)
            unit["polygon"] = [[float(x), float(y)] for x, y in raw_polygon]
            if unit.get("label_point") is None and region_id in manual_points:
                unit["label_point"] = manual_points[region_id]
                unit["label_point_source"] = "manual_visual_review"
            unit["geometry_status"] = "schematic_polygon_visually_reviewed"
            unit["geometry_binding"] = "source_linework_and_manual_visual_review"
            unit["geometry_rejection"] = None
            promoted_shapes[region_id] = shape
            promoted_count += 1

    if promoted_count != int(acceptance["accepted_candidate_count"]):
        raise ValueError(
            f"accepted candidate count changed: {promoted_count} != "
            f"{acceptance['accepted_candidate_count']}"
        )
    if used_label_point_exceptions != set(label_point_exceptions):
        raise ValueError("declared label-point exceptions were not all used")

    unresolved = acceptance.get("unresolved", {})
    remaining = [unit for unit in units_by_id.values() if not unit.get("polygon")]
    remaining_ids = {unit["region_id"] for unit in remaining}
    if remaining_ids != set(unresolved):
        raise ValueError(
            "unresolved regions do not exactly cover missing geometry: "
            f"missing={sorted(remaining_ids)}, declared={sorted(unresolved)}"
        )
    for unit in remaining:
        unit["geometry_status"] = "unresolved_source_conflict"
        unit["geometry_rejection"] = unresolved[unit["region_id"]]

    all_polygons = [
        (
            unit["region_id"],
            Polygon([(float(x), float(y)) for x, y in unit["polygon"]]),
        )
        for unit in units_by_id.values()
        if unit.get("polygon")
    ]
    validate_promoted_topology(promoted_shapes, all_polygons)

    status_counts: dict[str, int] = {}
    for unit in units_by_id.values():
        status = unit["geometry_status"]
        status_counts[status] = status_counts.get(status, 0) + 1
    result["summary"] = {
        "floor_count": len(result["floors"]),
        "space_unit_count": len(units_by_id),
        "geometry_status_counts": status_counts,
        "promoted_candidate_count": promoted_count,
        "unresolved_count": len(remaining),
    }
    result["method"] = (
        "immutable source photographs + visually reviewed labels + Inkscape/OpenCV "
        "linework + deterministic wall-snapped room components + topology validation"
    )
    result["reconstruction_id"] = manifest["reconstruction_id"]
    result["reconstruction_acceptance_sha256"] = sha256_file(acceptance_path)
    result.pop("review_id", None)
    result["review_id"] = hashlib.sha256(canonical_bytes(result)).hexdigest()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(canonical_bytes(result))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reviewed-geometry", required=True)
    parser.add_argument("--review-config", required=True)
    parser.add_argument("--reconstruction", required=True)
    parser.add_argument("--acceptance", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


if __name__ == "__main__":
    finalize(parse_args())
