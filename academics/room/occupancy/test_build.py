from __future__ import annotations

from academics.exam.snapshot.model import ExamSnapshot
from academics.room.occupancy.build import write_room_occupancy_artifacts
from academics.space.test_helpers import write_test_space_snapshot


def test_room_occupancy_records_unresolved_location_without_inventing_space(tmp_path) -> None:
    space = write_test_space_snapshot(tmp_path / "space", ["教2-201"])
    manifest = write_room_occupancy_artifacts(
        output_dir=tmp_path / "room-occupancy",
        space_snapshot_path=space,
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
            records=[{
                "id": "exam-1", "stable_key": "stable-1", "class_name": "B240402",
                "course_name": "算法分析与设计", "course_code": "JS113400S", "teacher": "张三",
                "count": 31, "date": "2026-06-20",
                "start_timestamp": "2026-06-20T08:00:00+08:00",
                "end_timestamp": "2026-06-20T10:00:00+08:00", "duration_minutes": 120,
                "campus": "仙林", "location": "教2-202",
            }],
        ),
    )
    assert manifest["dates"] == []
    assert manifest["unresolved_locations"] == [{"location": "教2-202", "count": 1}]
