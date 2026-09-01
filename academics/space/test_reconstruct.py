from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pytest

from .finalize_floor_plan_review import finalize
from .reconstruct import (
    apply_reviewed_geometry_corrections,
    infer_reviewed_rectangles,
)


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n",
        encoding="utf-8",
        newline="\n",
    )


def test_reviewed_rectangle_is_explicit_and_does_not_replace_evidence() -> None:
    units = [
        {"region_id": "missing", "raw_label": "1-101", "polygon": None},
        {"region_id": "reviewed", "raw_label": "1-102", "polygon": [[0, 0]]},
    ]
    inferred = infer_reviewed_rectangles(
        units,
        {
            "1-101": {
                "bounds_normalized": [0.1, 0.2, 0.3, 0.4],
                "review": "walls checked against the source",
            }
        },
    )
    assert inferred == {
        "missing": [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4], [0.1, 0.2]]
    }
    with pytest.raises(ValueError, match="would replace evidence"):
        infer_reviewed_rectangles(
            units,
            {
                "1-102": {
                    "bounds_normalized": [0.1, 0.2, 0.3, 0.4],
                    "review": "invalid replacement",
                }
            },
        )


def test_reviewed_correction_requires_prior_geometry_and_contains_label() -> None:
    floor = {
        "units": [
            {
                "region_id": "reviewed",
                "raw_label": "1-101",
                "polygon": [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6], [0.4, 0.4]],
                "label_point": [0.5, 0.5],
            },
            {"region_id": "missing", "raw_label": "1-102", "polygon": None},
        ]
    }
    apply_reviewed_geometry_corrections(
        floor,
        {
            "1-101": {
                "bounds_normalized": [0.1, 0.2, 0.3, 0.4],
                "label_point": [0.2, 0.3],
                "review": "the old binding selected the adjacent cell",
            }
        },
    )
    assert floor["units"][0]["polygon"][0] == [0.1, 0.2]
    assert floor["units"][0]["label_point"] == [0.2, 0.3]
    assert floor["units"][0]["geometry_binding"] == "manual_visual_review_correction"
    with pytest.raises(ValueError, match="cannot replace missing evidence"):
        apply_reviewed_geometry_corrections(
            floor,
            {
                "1-102": {
                    "bounds_normalized": [0.1, 0.2, 0.3, 0.4],
                    "review": "invalid correction",
                }
            },
        )


def finalizer_fixture(tmp_path: Path, *, overlap: bool = False) -> argparse.Namespace:
    reviewed_path = tmp_path / "reviewed.json"
    reviewed = {
        "format": "njupt-reviewed-floor-plan-geometry",
        "review_id": "review-1",
        "floors": [
            {
                "campus": "仙林",
                "building": "教1",
                "floor": 1,
                "source_image_sha256": "a" * 64,
                "units": [
                    {
                        "region_id": "jiao-1-floor-01-label-1",
                        "raw_label": "1-101",
                        "polygon": None,
                        "label_point": [0.2, 0.2],
                        "geometry_status": "label_point_only",
                    },
                    {
                        "region_id": "jiao-1-floor-01-label-2",
                        "raw_label": "1-102",
                        "polygon": [
                            [0.4, 0.1],
                            [0.6, 0.1],
                            [0.6, 0.3],
                            [0.4, 0.3],
                            [0.4, 0.1],
                        ],
                        "label_point": [0.5, 0.2],
                        "geometry_status": "schematic_polygon_visually_reviewed",
                    },
                ],
            }
        ],
    }
    write_json(reviewed_path, reviewed)
    config_path = tmp_path / "config.json"
    write_json(
        config_path,
        {"format": "njupt-floor-plan-reconstruction-review", "floors": {}},
    )
    reconstruction = tmp_path / "reconstruction"
    reconstruction_id = "b" * 64
    write_json(
        reconstruction / "manifest.json",
        {
            "format": "njupt-floor-plan-reconstruction",
            "reconstruction_id": reconstruction_id,
            "source_review_id": reviewed["review_id"],
            "source_review_sha256": hashlib.sha256(reviewed_path.read_bytes()).hexdigest(),
        },
    )
    right = 0.5 if overlap else 0.3
    write_json(
        reconstruction
        / "教1"
        / "floor-01"
        / "jiao-1-floor-01-geometry-candidates.json",
        {
            "format": "njupt-floor-plan-geometry-candidates",
            "source_image_sha256": "a" * 64,
            "candidates": {
                "jiao-1-floor-01-label-1": [
                    [0.1, 0.1],
                    [right, 0.1],
                    [right, 0.3],
                    [0.1, 0.3],
                    [0.1, 0.1],
                ]
            },
        },
    )
    acceptance_path = tmp_path / "acceptance.json"
    write_json(
        acceptance_path,
        {
            "format": "njupt-floor-plan-reconstruction-acceptance",
            "reconstruction_id": reconstruction_id,
            "accepted_candidate_count": 1,
            "label_point_exceptions": {},
            "unresolved": {},
        },
    )
    return argparse.Namespace(
        reviewed_geometry=str(reviewed_path),
        review_config=str(config_path),
        reconstruction=str(reconstruction),
        acceptance=str(acceptance_path),
        output=str(tmp_path / "final.json"),
    )


def test_finalizer_is_deterministic_and_promotes_only_accepted_candidates(
    tmp_path: Path,
) -> None:
    arguments = finalizer_fixture(tmp_path)
    finalize(arguments)
    first = Path(arguments.output).read_bytes()
    finalize(arguments)
    assert Path(arguments.output).read_bytes() == first
    result = json.loads(first)
    assert result["summary"] == {
        "floor_count": 1,
        "geometry_status_counts": {"schematic_polygon_visually_reviewed": 2},
        "promoted_candidate_count": 1,
        "space_unit_count": 2,
        "unresolved_count": 0,
    }


def test_finalizer_rejects_room_overlap(tmp_path: Path) -> None:
    arguments = finalizer_fixture(tmp_path, overlap=True)
    with pytest.raises(ValueError, match="overlaps another room"):
        finalize(arguments)
