from __future__ import annotations

import json

import pytest

from academics.exam.snapshot.model import ExamSnapshot
from academics.room.catalog import ROOM_CATALOG_FORMAT
from academics.room.occupancy.build import (
    RoomOccupancyError,
    write_room_occupancy_artifacts,
)


def test_room_occupancy_fails_on_room_missing_from_catalog(tmp_path) -> None:
    catalog_path = tmp_path / "catalog.json"
    catalog_path.write_text(
        json.dumps(
            {
                "format": ROOM_CATALOG_FORMAT,
                "floors": [
                    {
                        "campus": "仙林",
                        "building": "教2",
                        "floor": "2",
                        "rooms": [
                            {"room": "201"},
                        ],
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    with pytest.raises(
        RoomOccupancyError,
        match="rooms missing from RoomCatalog",
    ):
        write_room_occupancy_artifacts(
            output_dir=tmp_path / "room-occupancy",
            catalog_path=catalog_path,
            exam_snapshot=ExamSnapshot(
                snapshot_id="a" * 64,
                source_id="b" * 64,
                records_id="c" * 64,
                source_updated_at="2026-06-10T00:00:00+08:00",
                exam_period_id="2025-2026-2",
                academic_year="2025-2026",
                term_number=2,
                term_label="第二学期",
                source_url=None,
                source_title=None,
                records=[
                    {
                        "id": "exam-1",
                        "stable_key": "stable-1",
                        "class_name": "B240402",
                        "course_name": "算法分析与设计",
                        "course_code": "JS113400S",
                        "teacher": "张三",
                        "count": 31,
                        "date": "2026-06-20",
                        "start_timestamp": "2026-06-20T08:00:00+08:00",
                        "end_timestamp": "2026-06-20T10:00:00+08:00",
                        "duration_minutes": 120,
                        "campus": "仙林",
                        "location": "教2-202",
                    }
                ],
            ),
        )
