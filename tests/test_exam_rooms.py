from __future__ import annotations

import json
from pathlib import Path

import pytest

from njupt_exam_pipeline.contract import ExamPipelineError
from njupt_exam_pipeline.rooms import (
    ROOM_CATALOG_VERSION,
    build_initial_room_catalog,
    parse_room_location,
    write_room_occupancy_artifacts,
)


def test_sanpailou_special_buildings_are_deterministic():
    wireless_one = parse_room_location(campus="仙林", location="无一")
    wireless_six = parse_room_location(campus="仙林", location="无6")
    library_room_4 = parse_room_location(campus="仙林", location="图4")
    library_room_5 = parse_room_location(campus="仙林", location="图5")
    east = parse_room_location(campus="仙林", location="教东-201")
    west = parse_room_location(campus="仙林", location="教西-305")

    assert wireless_one is not None
    assert wireless_one.campus == "三牌楼"
    assert wireless_one.building == "无线楼"
    assert wireless_one.floor == "1"
    assert wireless_one.room == "无1"
    assert wireless_six is not None
    assert wireless_six.floor == "3"
    assert wireless_six.room == "无6"
    assert library_room_4 is not None
    assert library_room_4.campus == "三牌楼"
    assert library_room_4.building == "图科楼"
    assert library_room_4.floor == "1"
    assert library_room_5 is not None
    assert library_room_5.floor == "4"
    assert east is not None
    assert east.campus == "三牌楼"
    assert west is not None
    assert west.campus == "三牌楼"


def test_current_room_catalog_contains_confirmed_sanpailou_rooms():
    catalog = json.loads(Path("config/classrooms/njupt-room-catalog.json").read_text(encoding="utf-8"))
    assert catalog["version"] == ROOM_CATALOG_VERSION
    rooms = [
        (floor["campus"], floor["building"], floor["floor"], room["room"])
        for floor in catalog["floors"]
        for room in floor["rooms"]
    ]

    assert ("三牌楼", "无线楼", "1", "无1") in rooms
    assert ("三牌楼", "无线楼", "1", "无2") in rooms
    assert ("三牌楼", "无线楼", "2", "无3") in rooms
    assert ("三牌楼", "无线楼", "2", "无4") in rooms
    assert ("三牌楼", "无线楼", "3", "无5") in rooms
    assert ("三牌楼", "无线楼", "3", "无6") in rooms
    assert ("三牌楼", "图科楼", "1", "图4") in rooms
    assert ("三牌楼", "图科楼", "4", "图5") in rooms


def test_initial_catalog_range_fill_is_reproducible():
    catalog = build_initial_room_catalog(
        [
            {"campus": "仙林", "location": "教2-201"},
            {"campus": "仙林", "location": "教2-203"},
            {"campus": "仙林", "location": "自动化学科楼228"},
            {"campus": "仙林", "location": "无二"},
        ]
    )
    floors = {(floor["campus"], floor["building"], floor["floor"]): floor for floor in catalog["floors"]}

    jiao2_floor2 = floors[("仙林", "教2", "2")]
    assert [room["room"] for room in jiao2_floor2["rooms"]] == ["201", "202", "203"]
    assert jiao2_floor2["rooms"][1]["source"] == "inferred_range"
    assert floors[("仙林", "自动化学科楼", "2")]["rooms"][0]["room"] == "228"
    assert floors[("三牌楼", "无线楼", "1")]["rooms"][0]["room"] == "无2"
    assert catalog["unresolved_locations"] == []


def test_room_occupancy_fails_on_room_missing_from_catalog(tmp_path):
    catalog_path = tmp_path / "catalog.json"
    catalog_path.write_text(
        json.dumps(
            {
                "version": ROOM_CATALOG_VERSION,
                "floors": [
                    {
                        "campus": "仙林",
                        "building": "教2",
                        "floor": "2",
                        "range": {"min": "201", "max": "201"},
                        "rooms": [
                            {"room": "201", "room_key": "room-5c5e9fc40df965df", "source": "observed"},
                        ],
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    with pytest.raises(ExamPipelineError, match="rooms missing from the maintained room catalog"):
        write_room_occupancy_artifacts(
            data_dir=tmp_path,
            catalog_path=catalog_path,
            manifest={
                "generated_at": "2026-06-10T00:00:00+08:00",
                "data_version": "a" * 64,
                "exam_period_id": "2025-2026-2",
                "academic_year": "2025-2026",
                "term_number": 2,
                "term_label": "第二学期",
            },
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
        )
