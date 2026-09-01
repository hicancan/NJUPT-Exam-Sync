from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import Polygon, mapping
from shapely.validation import explain_validity


FORMAT = "njupt-floor-plan-reconstruction"

COMPONENT_TYPES = (
    "exterior_wall",
    "interior_partition",
    "single_door",
    "double_door",
    "window",
    "column",
    "ordinary_room",
    "split_room",
    "lecture_hall",
    "corridor",
    "atrium_or_courtyard",
    "stair",
    "elevator",
    "restroom",
    "entrance_or_exit",
    "roof_or_non_walkable_outline",
)


@dataclass(frozen=True)
class Crop:
    left: int
    top: int
    right: int
    bottom: int

    @property
    def width(self) -> int:
        return self.right - self.left

    @property
    def height(self) -> int:
        return self.bottom - self.top

    def to_json(self) -> dict[str, int]:
        return {
            "left": self.left,
            "top": self.top,
            "right": self.right,
            "bottom": self.bottom,
            "width": self.width,
            "height": self.height,
        }


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while block := source.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def canonical_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def write_json(path: Path, value: Any) -> None:
    path.write_bytes(canonical_bytes(value))


def write_png(path: Path, image: np.ndarray) -> None:
    """Write a PNG without relying on OpenCV's Unicode-path handling."""
    encoded, buffer = cv2.imencode(".png", image)
    if not encoded:
        raise ValueError(f"failed to encode PNG: {path}")
    path.write_bytes(buffer.tobytes())
    if not path.is_file() or path.stat().st_size == 0:
        raise OSError(f"failed to write PNG: {path}")


def contact_sheet(
    entries: list[tuple[str, Path]], destination: Path, *, columns: int = 2
) -> None:
    tile_width = 1000
    tile_height = 620
    label_height = 44
    rows = math.ceil(len(entries) / columns)
    canvas = Image.new("RGB", (columns * tile_width, rows * tile_height), "white")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=26)
    for index, (label, path) in enumerate(entries):
        image = Image.open(path).convert("RGB")
        image.thumbnail((tile_width - 24, tile_height - label_height - 20))
        column = index % columns
        row = index // columns
        x = column * tile_width + (tile_width - image.width) // 2
        y = row * tile_height + label_height
        canvas.paste(image, (x, y))
        draw.text((column * tile_width + 16, row * tile_height + 8), label, fill="black", font=font)
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, format="PNG", optimize=True)


def write_geopackage(
    path: Path,
    space_features: list[dict[str, Any]],
    label_features: list[dict[str, Any]],
    floor_records: list[dict[str, Any]],
) -> None:
    import geopandas as gpd

    if path.exists():
        path.unlink()
    spaces = gpd.GeoDataFrame.from_features(space_features, crs=None)
    labels = gpd.GeoDataFrame.from_features(label_features, crs=None)
    extents = gpd.GeoDataFrame(
        [
            {
                "building": record["building"],
                "level": record["level"],
                "floor_slug": record["slug"],
                "coordinate_system": "floor-local-source-crop-pixels",
                "geometry": Polygon(
                    [
                        (0, 0),
                        (record["metadata"]["crop"]["width"], 0),
                        (
                            record["metadata"]["crop"]["width"],
                            record["metadata"]["crop"]["height"],
                        ),
                        (0, record["metadata"]["crop"]["height"]),
                        (0, 0),
                    ]
                ),
            }
            for record in floor_records
        ],
        crs=None,
    )
    spaces.to_file(path, layer="spaces", driver="GPKG", engine="pyogrio")
    labels.to_file(path, layer="labels", driver="GPKG", engine="pyogrio", append=True)
    extents.to_file(
        path, layer="floor_extents", driver="GPKG", engine="pyogrio", append=True
    )


def floor_slug(building: str, level: int) -> str:
    building_number = building.removeprefix("教")
    return f"jiao-{building_number}-floor-{level:02d}"


def clamp(value: int, low: int, high: int) -> int:
    return max(low, min(value, high))


def component_crop(
    image: np.ndarray,
    building: str,
    level: int,
    units: list[dict[str, Any]],
    crop_override: list[float] | None = None,
) -> Crop:
    height, width = image.shape[:2]
    if crop_override is not None:
        if len(crop_override) != 4 or any(
            not isinstance(value, (int, float)) for value in crop_override
        ):
            raise ValueError(f"invalid crop override for {building} floor {level}")
        left, top, right, bottom = [float(value) for value in crop_override]
        if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
            raise ValueError(f"crop override is outside the source image: {building} floor {level}")
        return Crop(
            int(round(left * width)),
            int(round(top * height)),
            int(round(right * width)),
            int(round(bottom * height)),
        )
    points: list[tuple[float, float]] = []
    for unit in units:
        label_point = unit.get("label_point")
        if label_point:
            points.append((float(label_point[0]), float(label_point[1])))
        for point in unit.get("polygon") or []:
            points.append((float(point[0]), float(point[1])))

    if not points:
        raise ValueError(f"{building} floor {level} has no spatial anchor")

    point_x = np.array([point[0] * width for point in points], dtype=np.float32)
    point_y = np.array([point[1] * height for point in points], dtype=np.float32)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    dark_neutral = ((gray < 170) & ((hsv[:, :, 1] < 92) | (gray < 55))).astype(
        np.uint8
    ) * 255

    horizontal = cv2.morphologyEx(
        dark_neutral,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (max(35, width // 90), 1)),
    )
    vertical = cv2.morphologyEx(
        dark_neutral,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(28, height // 100))),
    )
    structural = cv2.bitwise_or(horizontal, vertical)

    min_y = max(0, int(point_y.min() - height * 0.18))
    max_y = min(height, int(point_y.max() + height * 0.18))
    if building == "教1":
        min_y = 0
        max_y = height

    band = structural[min_y:max_y, :]
    ys, xs = np.where(band > 0)
    if len(xs) > 0:
        line_left = int(np.quantile(xs, 0.002))
        line_right = int(np.quantile(xs, 0.998))
        line_top = int(np.quantile(ys, 0.002)) + min_y
        line_bottom = int(np.quantile(ys, 0.998)) + min_y
    else:
        line_left = int(point_x.min())
        line_right = int(point_x.max())
        line_top = int(point_y.min())
        line_bottom = int(point_y.max())

    anchor_left = int(point_x.min() - width * 0.08)
    anchor_right = int(point_x.max() + width * 0.08)
    anchor_top = int(point_y.min() - height * 0.10)
    anchor_bottom = int(point_y.max() + height * 0.10)

    left = min(line_left, anchor_left)
    right = max(line_right, anchor_right)
    top = min(line_top, anchor_top)
    bottom = max(line_bottom, anchor_bottom)

    margin_x = max(12, int(width * 0.012))
    margin_y = max(12, int(height * 0.012))
    return Crop(
        clamp(left - margin_x, 0, width - 1),
        clamp(top - margin_y, 0, height - 1),
        clamp(right + margin_x, 1, width),
        clamp(bottom + margin_y, 1, height),
    )


def structural_mask(crop: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]
    local_dark = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        71,
        13,
    )
    neutral = saturation < 82
    very_dark = gray < 46
    mask = ((local_dark > 0) & (neutral | very_dark)).astype(np.uint8) * 255
    mask = cv2.medianBlur(mask, 3)
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2)),
    )
    return mask


def contour_path(mask: np.ndarray, epsilon: float) -> tuple[str, int, int]:
    contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    parts: list[str] = []
    retained = 0
    vertices = 0
    for contour in contours:
        if abs(cv2.contourArea(contour)) < 1.25 and cv2.arcLength(contour, True) < 8:
            continue
        simplified = cv2.approxPolyDP(contour, epsilon, True)
        if len(simplified) < 2:
            continue
        coordinates = simplified[:, 0, :]
        head = coordinates[0]
        segment = [f"M{int(head[0])} {int(head[1])}"]
        segment.extend(f"L{int(point[0])} {int(point[1])}" for point in coordinates[1:])
        segment.append("Z")
        parts.append("".join(segment))
        retained += 1
        vertices += len(coordinates)
    return "".join(parts), retained, vertices


def _cluster_centers(values: np.ndarray) -> list[int]:
    if len(values) == 0:
        return []
    groups: list[list[int]] = [[int(values[0])]]
    for raw_value in values[1:]:
        value = int(raw_value)
        if value - groups[-1][-1] <= 4:
            groups[-1].append(value)
        else:
            groups.append([value])
    return [int(round(sum(group) / len(group))) for group in groups]


def infer_axis_aligned_room_candidates(
    image: np.ndarray, units: list[dict[str, Any]]
) -> dict[str, list[list[float]]]:
    """Infer conservative rectangular candidates from long wall segments.

    These are review candidates only. They never replace manually reviewed polygons.
    """
    height, width = image.shape[:2]
    foreground = structural_mask(image)
    horizontal = cv2.morphologyEx(
        foreground,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (35, 1)),
    )
    vertical = cv2.morphologyEx(
        foreground,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, 35)),
    )
    anchors = [
        (
            unit["region_id"],
            int(round(float(unit["label_point"][0]) * width)),
            int(round(float(unit["label_point"][1]) * height)),
        )
        for unit in units
        if unit.get("label_point")
    ]
    existing_shapes = [
        Polygon([(float(x) * width, float(y) * height) for x, y in unit["polygon"]])
        for unit in units
        if unit.get("polygon")
    ]
    inferred: dict[str, list[list[float]]] = {}
    for unit in units:
        label_point = unit.get("label_point")
        if unit.get("polygon") or not label_point:
            continue
        x = int(round(float(label_point[0]) * width))
        y = int(round(float(label_point[1]) * height))
        x_span = max(90, width // 18)
        y_span = max(90, height // 16)
        y0, y1 = max(0, y - y_span), min(height, y + y_span + 1)
        x0, x1 = max(0, x - x_span), min(width, x + x_span + 1)
        vertical_score = np.count_nonzero(vertical[y0:y1, :], axis=0)
        horizontal_score = np.count_nonzero(horizontal[:, x0:x1], axis=1)
        vertical_threshold = max(12, int((y1 - y0) * 0.10))
        horizontal_threshold = max(12, int((x1 - x0) * 0.10))
        x_lines = _cluster_centers(np.where(vertical_score >= vertical_threshold)[0])
        y_lines = _cluster_centers(np.where(horizontal_score >= horizontal_threshold)[0])
        lefts = [value for value in x_lines if value < x - 10]
        rights = [value for value in x_lines if value > x + 10]
        tops = [value for value in y_lines if value < y - 10]
        bottoms = [value for value in y_lines if value > y + 10]
        if not lefts or not rights or not tops or not bottoms:
            continue
        left, right = max(lefts), min(rights)
        top, bottom = max(tops), min(bottoms)
        if right - left < 28 or bottom - top < 24:
            continue
        if right - left > width * 0.30 or bottom - top > height * 0.30:
            continue
        candidate = Polygon(
            [(left, top), (right, top), (right, bottom), (left, bottom), (left, top)]
        )
        if not candidate.is_valid:
            continue
        contained_anchors = sum(
            1
            for _, anchor_x, anchor_y in anchors
            if left < anchor_x < right and top < anchor_y < bottom
        )
        if contained_anchors != 1:
            continue
        if any(
            candidate.intersection(shape).area / candidate.area > 0.18
            for shape in existing_shapes
            if candidate.intersects(shape)
        ):
            continue
        inferred[unit["region_id"]] = [
            [left / width, top / height],
            [right / width, top / height],
            [right / width, bottom / height],
            [left / width, bottom / height],
            [left / width, top / height],
        ]
    return inferred


def apply_reviewed_label_points(
    floor: dict[str, Any], points: dict[str, list[float]]
) -> None:
    """Attach manually reviewed anchors without modifying the source evidence file."""
    if not isinstance(points, dict):
        raise ValueError("manual label points must be an object")
    for identifier, raw_point in points.items():
        if (
            not isinstance(raw_point, list)
            or len(raw_point) != 2
            or any(not isinstance(value, (int, float)) for value in raw_point)
        ):
            raise ValueError(f"invalid manual label point: {identifier}")
        point = [float(raw_point[0]), float(raw_point[1])]
        if not (0 < point[0] < 1 and 0 < point[1] < 1):
            raise ValueError(f"manual label point is outside the source image: {identifier}")
        matches = [
            unit
            for unit in floor["units"]
            if unit["region_id"] == identifier or unit["raw_label"] == identifier
        ]
        if len(matches) != 1:
            raise ValueError(
                f"manual label point must identify exactly one region: {identifier}"
            )
        unit = matches[0]
        if unit.get("label_point"):
            raise ValueError(f"manual label point would replace source evidence: {identifier}")
        unit["label_point"] = point
        unit["label_point_source"] = "manual_visual_review"


def apply_reviewed_geometry_corrections(
    floor: dict[str, Any], corrections: dict[str, dict[str, Any]]
) -> None:
    """Correct an earlier polygon binding after reviewing the full-resolution source."""
    if not isinstance(corrections, dict):
        raise ValueError("reviewed geometry corrections must be an object")
    for identifier, correction in corrections.items():
        if not isinstance(correction, dict):
            raise ValueError(f"invalid reviewed geometry correction: {identifier}")
        bounds = correction.get("bounds_normalized")
        review = correction.get("review")
        if (
            not isinstance(bounds, list)
            or len(bounds) != 4
            or any(not isinstance(value, (int, float)) for value in bounds)
            or not isinstance(review, str)
            or not review.strip()
        ):
            raise ValueError(f"invalid reviewed geometry correction: {identifier}")
        left, top, right, bottom = [float(value) for value in bounds]
        if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
            raise ValueError(f"reviewed geometry correction is outside the source: {identifier}")
        matches = [
            unit
            for unit in floor["units"]
            if unit["region_id"] == identifier or unit["raw_label"] == identifier
        ]
        if len(matches) != 1:
            raise ValueError(
                f"reviewed geometry correction must identify exactly one region: {identifier}"
            )
        unit = matches[0]
        if not unit.get("polygon"):
            raise ValueError(
                f"reviewed geometry correction cannot replace missing evidence: {identifier}"
            )
        unit["polygon"] = [
            [left, top],
            [right, top],
            [right, bottom],
            [left, bottom],
            [left, top],
        ]
        label_point = correction.get("label_point")
        if label_point is not None:
            if (
                not isinstance(label_point, list)
                or len(label_point) != 2
                or any(not isinstance(value, (int, float)) for value in label_point)
            ):
                raise ValueError(
                    f"invalid corrected geometry label point: {identifier}"
                )
            point = [float(label_point[0]), float(label_point[1])]
            if not (left < point[0] < right and top < point[1] < bottom):
                raise ValueError(
                    f"corrected label point is outside its polygon: {identifier}"
                )
            unit["label_point"] = point
        unit["geometry_binding"] = "manual_visual_review_correction"
        unit["geometry_status"] = "schematic_polygon_visually_reviewed"
        unit["geometry_review"] = review.strip()


def infer_reviewed_rectangles(
    units: list[dict[str, Any]], rectangles: dict[str, dict[str, Any]]
) -> dict[str, list[list[float]]]:
    """Create explicit review candidates when shared grid snapping is inappropriate."""
    if not isinstance(rectangles, dict):
        raise ValueError("reviewed room rectangles must be an object")
    inferred: dict[str, list[list[float]]] = {}
    for identifier, rectangle in rectangles.items():
        if not isinstance(rectangle, dict):
            raise ValueError(f"invalid reviewed room rectangle: {identifier}")
        bounds = rectangle.get("bounds_normalized")
        review = rectangle.get("review")
        if (
            not isinstance(bounds, list)
            or len(bounds) != 4
            or any(not isinstance(value, (int, float)) for value in bounds)
            or not isinstance(review, str)
            or not review.strip()
        ):
            raise ValueError(f"invalid reviewed room rectangle: {identifier}")
        left, top, right, bottom = [float(value) for value in bounds]
        if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
            raise ValueError(f"reviewed room rectangle is outside the source: {identifier}")
        matches = [
            unit
            for unit in units
            if unit["region_id"] == identifier or unit["raw_label"] == identifier
        ]
        if len(matches) != 1:
            raise ValueError(
                f"reviewed room rectangle must identify exactly one region: {identifier}"
            )
        unit = matches[0]
        if unit.get("polygon"):
            raise ValueError(f"reviewed room rectangle would replace evidence: {identifier}")
        inferred[unit["region_id"]] = [
            [left, top],
            [right, top],
            [right, bottom],
            [left, bottom],
            [left, top],
        ]
    return inferred


def infer_reviewed_room_grids(
    image: np.ndarray,
    units: list[dict[str, Any]],
    groups: list[dict[str, Any]],
) -> dict[str, list[list[float]]]:
    height, width = image.shape[:2]
    unit_by_label = {unit["raw_label"]: unit for unit in units}
    foreground = structural_mask(image)
    horizontal = cv2.morphologyEx(
        foreground,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (24, 1)),
    )
    vertical = cv2.morphologyEx(
        foreground,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, 24)),
    )

    def snap(expected: float, scores: np.ndarray, radius: int) -> int:
        center = int(round(expected))
        low = max(0, center - radius)
        high = min(len(scores), center + radius + 1)
        if low >= high:
            return center
        return low + int(np.argmax(scores[low:high]))

    inferred: dict[str, list[list[float]]] = {}
    for group in groups:
        bounds = group.get("bounds_normalized")
        rows = group.get("rows")
        if (
            not isinstance(bounds, list)
            or len(bounds) != 4
            or not isinstance(rows, list)
            or not rows
            or any(not isinstance(row, list) or not row for row in rows)
        ):
            raise ValueError("invalid reviewed room grid")
        column_count = len(rows[0])
        if any(len(row) != column_count for row in rows):
            raise ValueError("reviewed room grid rows have inconsistent columns")
        left, top, right, bottom = [float(value) for value in bounds]
        if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
            raise ValueError("reviewed room grid bounds are outside the source image")
        x0, x1 = int(left * width), int(right * width)
        y0, y1 = int(top * height), int(bottom * height)
        vertical_scores = np.count_nonzero(vertical[y0:y1, :], axis=0)
        horizontal_scores = np.count_nonzero(horizontal[:, x0:x1], axis=1)
        x_radius = max(10, int(width * 0.012))
        y_radius = max(8, int(height * 0.012))
        x_lines = [
            snap(x0 + (x1 - x0) * index / column_count, vertical_scores, x_radius)
            for index in range(column_count + 1)
        ]
        y_lines = [
            snap(y0 + (y1 - y0) * index / len(rows), horizontal_scores, y_radius)
            for index in range(len(rows) + 1)
        ]
        if x_lines != sorted(x_lines) or y_lines != sorted(y_lines):
            raise ValueError("reviewed room grid wall snapping produced crossed boundaries")
        for row_index, row in enumerate(rows):
            for column_index, raw_label in enumerate(row):
                unit = unit_by_label.get(raw_label)
                if unit is None:
                    raise ValueError(f"reviewed room grid label is missing: {raw_label}")
                if unit.get("polygon"):
                    continue
                cell_left, cell_right = x_lines[column_index], x_lines[column_index + 1]
                cell_top, cell_bottom = y_lines[row_index], y_lines[row_index + 1]
                inferred[unit["region_id"]] = [
                    [cell_left / width, cell_top / height],
                    [cell_right / width, cell_top / height],
                    [cell_right / width, cell_bottom / height],
                    [cell_left / width, cell_bottom / height],
                    [cell_left / width, cell_top / height],
                ]
    return inferred


def semantic_shapes(
    floor: dict[str, Any],
    crop: Crop,
    image_width: int,
    image_height: int,
    inferred_polygons: dict[str, list[list[float]]],
) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    fragments: list[str] = []
    space_features: list[dict[str, Any]] = []
    label_features: list[dict[str, Any]] = []
    for unit in floor["units"]:
        reviewed_polygon = unit.get("polygon")
        polygon = reviewed_polygon or inferred_polygons.get(unit["region_id"])
        geometry_status = (
            unit["geometry_status"] if reviewed_polygon else "algorithmic_review_candidate"
        )
        label_point = unit.get("label_point")
        if polygon:
            local_points = [
                (
                    float(point[0]) * image_width - crop.left,
                    float(point[1]) * image_height - crop.top,
                )
                for point in polygon
            ]
            polygon_shape = Polygon(local_points)
            fragments.append(
                '<polygon class="{}" data-region-id="{}" points="{}"/>'.format(
                    "space" if reviewed_polygon else "candidate-space",
                    unit["region_id"],
                    " ".join(f"{x:.2f},{y:.2f}" for x, y in local_points),
                )
            )
            space_features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "building": floor["building"],
                        "level": floor["floor"],
                        "region_id": unit["region_id"],
                        "raw_label": unit["raw_label"],
                        "space_key": unit.get("space_key"),
                        "geometry_status": geometry_status,
                        "geometry_valid": polygon_shape.is_valid,
                        "geometry_validity": explain_validity(polygon_shape),
                    },
                    "geometry": mapping(polygon_shape),
                }
            )
        if label_point:
            x = float(label_point[0]) * image_width - crop.left
            y = float(label_point[1]) * image_height - crop.top
            fragments.append(
                '<circle class="label-point" cx="{:.2f}" cy="{:.2f}" r="4"/>'.format(x, y)
            )
            label_features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "building": floor["building"],
                        "level": floor["floor"],
                        "region_id": unit["region_id"],
                        "raw_label": unit["raw_label"],
                        "geometry_status": unit["geometry_status"],
                    },
                    "geometry": {"type": "Point", "coordinates": [x, y]},
                }
            )
    return "".join(fragments), space_features, label_features


def linework_svg(width: int, height: int, path_data: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
<rect width="100%" height="100%" fill="white"/>
<path d="{path_data}" fill="#151515" fill-rule="evenodd"/>
</svg>
'''


def semantic_svg(width: int, height: int, path_data: str, semantic: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
<style>
.space{{fill:#dbeafe;fill-opacity:.72;stroke:#2563eb;stroke-width:2;vector-effect:non-scaling-stroke}}
.candidate-space{{fill:#ffedd5;fill-opacity:.72;stroke:#ea580c;stroke-width:2;stroke-dasharray:8 5;vector-effect:non-scaling-stroke}}
.label-point{{fill:#dc2626;stroke:white;stroke-width:1;vector-effect:non-scaling-stroke}}
</style>
<rect width="100%" height="100%" fill="white"/>
<path d="{path_data}" fill="#202020" fill-rule="evenodd" opacity=".58"/>
<g>{semantic}</g>
</svg>
'''


def render_svg(inkscape: Path, source: Path, target: Path) -> None:
    subprocess.run(
        [
            str(inkscape),
            str(source),
            "--export-type=png",
            f"--export-filename={target}",
            "--export-overwrite",
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def comparison_image(
    source_crop: Path,
    linework_png: Path,
    semantic_png: Path,
    target: Path,
) -> None:
    source = Image.open(source_crop).convert("RGB")
    linework = Image.open(linework_png).convert("RGB").resize(source.size)
    semantic = Image.open(semantic_png).convert("RGB").resize(source.size)
    max_width = 1400
    scale = min(1.0, max_width / source.width)
    size = (max(1, round(source.width * scale)), max(1, round(source.height * scale)))
    source = source.resize(size)
    linework = linework.resize(size)
    semantic = semantic.resize(size)

    title_height = 58
    canvas = Image.new("RGB", (size[0] * 3, size[1] + title_height), "white")
    canvas.paste(source, (0, title_height))
    canvas.paste(linework, (size[0], title_height))
    canvas.paste(semantic, (size[0] * 2, title_height))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=26)
    draw.text((20, 14), "SOURCE CROP", fill="black", font=font)
    draw.text((size[0] + 20, 14), "VECTOR LINEWORK", fill="black", font=font)
    draw.text((size[0] * 2 + 20, 14), "SEMANTIC OVERLAY", fill="black", font=font)
    canvas.save(target, optimize=True)


def overlay_image(source_crop: Path, linework_png: Path, target: Path) -> None:
    source = np.asarray(Image.open(source_crop).convert("RGB"))
    vector = np.asarray(Image.open(linework_png).convert("L").resize((source.shape[1], source.shape[0])))
    overlay = source.copy()
    vector_mask = vector < 150
    overlay[vector_mask] = (
        overlay[vector_mask].astype(np.float32) * 0.35
        + np.array([235, 40, 75], dtype=np.float32) * 0.65
    ).astype(np.uint8)
    Image.fromarray(overlay).save(target, optimize=True)


def mask_metrics(source_mask: np.ndarray, rendered_png: Path) -> dict[str, float | int]:
    rendered = np.asarray(Image.open(rendered_png).convert("L"))
    if rendered.shape != source_mask.shape:
        rendered = cv2.resize(
            rendered,
            (source_mask.shape[1], source_mask.shape[0]),
            interpolation=cv2.INTER_AREA,
        )
    predicted = rendered < 160
    actual = source_mask > 0
    intersection = int(np.logical_and(actual, predicted).sum())
    union = int(np.logical_or(actual, predicted).sum())
    predicted_count = int(predicted.sum())
    actual_count = int(actual.sum())
    return {
        "source_pixels": actual_count,
        "rendered_pixels": predicted_count,
        "intersection_pixels": intersection,
        "union_pixels": union,
        "precision": intersection / predicted_count if predicted_count else 0.0,
        "recall": intersection / actual_count if actual_count else 0.0,
        "iou": intersection / union if union else 1.0,
    }


def build(args: argparse.Namespace) -> None:
    reviewed_path = Path(args.reviewed_geometry).resolve()
    output_root = Path(args.output).resolve()
    inkscape = Path(args.inkscape).resolve()
    if not inkscape.is_file():
        raise FileNotFoundError(f"Inkscape executable not found: {inkscape}")

    reviewed = json.loads(reviewed_path.read_text(encoding="utf-8"))
    if reviewed.get("format") != "njupt-reviewed-floor-plan-geometry":
        raise ValueError("unexpected reviewed geometry format")

    review_config: dict[str, Any] = {}
    if args.review_config:
        config_path = Path(args.review_config).resolve()
        review_config = json.loads(config_path.read_text(encoding="utf-8"))
        if review_config.get("format") != "njupt-floor-plan-reconstruction-review":
            raise ValueError("unexpected reconstruction review format")

    output_root.mkdir(parents=True, exist_ok=True)
    all_space_features: list[dict[str, Any]] = []
    all_label_features: list[dict[str, Any]] = []
    floor_records: list[dict[str, Any]] = []

    for source_floor in sorted(
        reviewed["floors"], key=lambda value: (value["building"], value["floor"])
    ):
        floor = copy.deepcopy(source_floor)
        source_path = Path(floor["source_image"]).resolve()
        source = cv2.imread(str(source_path), cv2.IMREAD_COLOR)
        if source is None:
            raise FileNotFoundError(source_path)
        image_height, image_width = source.shape[:2]
        if sha256_file(source_path) != floor["source_image_sha256"]:
            raise ValueError(f"source image identity mismatch: {source_path}")

        floor_config = review_config.get("floors", {}).get(
            f"{floor['building']}/{floor['floor']}", {}
        )
        apply_reviewed_geometry_corrections(
            floor, floor_config.get("reviewed_geometry_corrections", {})
        )
        apply_reviewed_label_points(
            floor, floor_config.get("manual_label_points", {})
        )
        crop = component_crop(
            source,
            floor["building"],
            floor["floor"],
            floor["units"],
            floor_config.get("crop_normalized"),
        )
        cropped = source[crop.top : crop.bottom, crop.left : crop.right]
        mask = structural_mask(cropped)

        slug = floor_slug(floor["building"], floor["floor"])
        floor_root = output_root / floor["building"] / f"floor-{floor['floor']:02d}"
        floor_root.mkdir(parents=True, exist_ok=True)
        source_crop_path = floor_root / f"{slug}-source-crop.png"
        write_png(source_crop_path, cropped)

        epsilon = 0.75
        path_data, contour_count, vertex_count = contour_path(mask, epsilon)
        linework_path = floor_root / f"{slug}-linework.svg"
        linework_path.write_text(
            linework_svg(crop.width, crop.height, path_data), encoding="utf-8", newline="\n"
        )
        inferred_polygons = infer_axis_aligned_room_candidates(source, floor["units"])
        inferred_polygons.update(
            infer_reviewed_room_grids(
                source, floor["units"], floor_config.get("room_grids", [])
            )
        )
        inferred_polygons.update(
            infer_reviewed_rectangles(
                floor["units"], floor_config.get("room_rectangles", {})
            )
        )
        candidate_path = floor_root / f"{slug}-geometry-candidates.json"
        write_json(
            candidate_path,
            {
                "format": "njupt-floor-plan-geometry-candidates",
                "building": floor["building"],
                "level": floor["floor"],
                "source_image_sha256": floor["source_image_sha256"],
                "coordinate_system": "source-image-normalized-top-left",
                "candidates": inferred_polygons,
            },
        )
        semantic_fragments, space_features, label_features = semantic_shapes(
            floor, crop, image_width, image_height, inferred_polygons
        )
        semantic_path = floor_root / f"{slug}-semantic.svg"
        semantic_path.write_text(
            semantic_svg(crop.width, crop.height, path_data, semantic_fragments),
            encoding="utf-8",
            newline="\n",
        )

        linework_png = floor_root / f"{slug}-linework.png"
        semantic_png = floor_root / f"{slug}-semantic.png"
        render_svg(inkscape, linework_path, linework_png)
        render_svg(inkscape, semantic_path, semantic_png)

        comparison_path = floor_root / f"{slug}-comparison.png"
        overlay_path = floor_root / f"{slug}-overlay.png"
        comparison_image(source_crop_path, linework_png, semantic_png, comparison_path)
        overlay_image(source_crop_path, linework_png, overlay_path)
        metrics = mask_metrics(mask, linework_png)

        counts: dict[str, int] = {}
        for unit in floor["units"]:
            counts[unit["geometry_status"]] = counts.get(unit["geometry_status"], 0) + 1

        metadata = {
            "format": FORMAT,
            "building": floor["building"],
            "level": floor["floor"],
            "source_image": str(source_path),
            "source_image_sha256": floor["source_image_sha256"],
            "source_size": {"width": image_width, "height": image_height},
            "crop": crop.to_json(),
            "orientation": floor["orientation"],
            "north_rotation_degrees": floor["north_rotation_degrees"],
            "north_confidence": floor["north_confidence"],
            "geometry_accuracy": "source-fidelity-vector-trace-plus-reviewed-semantic-polygons",
            "review_config": floor_config,
            "component_taxonomy": list(COMPONENT_TYPES),
            "component_type_count": len(COMPONENT_TYPES),
            "space_unit_count": len(floor["units"]),
            "space_geometry_status_counts": counts,
            "algorithmic_review_candidate_count": len(inferred_polygons),
            "linework_contour_count": contour_count,
            "linework_vertex_count": vertex_count,
            "linework_epsilon_pixels": epsilon,
            "linework_fidelity": metrics,
            "artifacts": {},
        }
        for artifact_path in (
            source_crop_path,
            linework_path,
            linework_png,
            semantic_path,
            semantic_png,
            candidate_path,
            overlay_path,
            comparison_path,
        ):
            metadata["artifacts"][artifact_path.name] = {
                "bytes": artifact_path.stat().st_size,
                "sha256": sha256_file(artifact_path),
            }
        metadata_path = floor_root / f"{slug}-metadata.json"
        write_json(metadata_path, metadata)

        for feature in space_features:
            feature["properties"]["floor_slug"] = slug
        for feature in label_features:
            feature["properties"]["floor_slug"] = slug
        all_space_features.extend(space_features)
        all_label_features.extend(label_features)
        floor_records.append(
            {
                "building": floor["building"],
                "level": floor["floor"],
                "slug": slug,
                "root": str(floor_root),
                "metadata": metadata,
                "source_crop": str(source_crop_path),
                "comparison": str(comparison_path),
            }
        )

    spaces_geojson = output_root / "spaces.geojson"
    labels_geojson = output_root / "labels.geojson"
    write_json(spaces_geojson, {"type": "FeatureCollection", "features": all_space_features})
    write_json(labels_geojson, {"type": "FeatureCollection", "features": all_label_features})
    geopackage_path = output_root / "floor-plans.gpkg"
    write_geopackage(
        geopackage_path, all_space_features, all_label_features, floor_records
    )

    contact_sheet_artifacts: dict[str, dict[str, Any]] = {}
    for building in sorted({record["building"] for record in floor_records}):
        building_records = [
            record for record in floor_records if record["building"] == building
        ]
        building_number = building.removeprefix("教")
        for kind in ("source_crop", "comparison"):
            destination = output_root / (
                f"jiao-{building_number}-{kind.replace('_', '-')}-contact-sheet.png"
            )
            contact_sheet(
                [
                    (record["slug"], Path(record[kind]))
                    for record in building_records
                ],
                destination,
            )
            contact_sheet_artifacts[destination.name] = {
                "bytes": destination.stat().st_size,
                "sha256": sha256_file(destination),
            }

    manifest_without_id = {
        "format": FORMAT,
        "source_review_id": reviewed["review_id"],
        "source_review_sha256": sha256_file(reviewed_path),
        "component_taxonomy": list(COMPONENT_TYPES),
        "component_type_count": len(COMPONENT_TYPES),
        "floor_count": len(floor_records),
        "space_feature_count": len(all_space_features),
        "label_feature_count": len(all_label_features),
        "floors": [
            {
                "building": record["building"],
                "level": record["level"],
                "slug": record["slug"],
                "metadata_sha256": sha256_file(
                    Path(record["root"]) / f"{record['slug']}-metadata.json"
                ),
                "linework_iou": record["metadata"]["linework_fidelity"]["iou"],
            }
            for record in floor_records
        ],
        "artifacts": {
            "spaces.geojson": {
                "bytes": spaces_geojson.stat().st_size,
                "sha256": sha256_file(spaces_geojson),
            },
            "labels.geojson": {
                "bytes": labels_geojson.stat().st_size,
                "sha256": sha256_file(labels_geojson),
            },
            "floor-plans.gpkg": {
                "bytes": geopackage_path.stat().st_size,
                "sha256": sha256_file(geopackage_path),
            },
            **contact_sheet_artifacts,
        },
    }
    reconstruction_id = hashlib.sha256(canonical_bytes(manifest_without_id)).hexdigest()
    manifest = {"reconstruction_id": reconstruction_id, **manifest_without_id}
    write_json(output_root / "manifest.json", manifest)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reviewed-geometry", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--inkscape", required=True)
    parser.add_argument("--review-config")
    return parser.parse_args()


if __name__ == "__main__":
    build(parse_args())
