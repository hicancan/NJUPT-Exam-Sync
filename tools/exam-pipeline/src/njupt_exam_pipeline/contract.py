from __future__ import annotations

import re
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import pandas as pd
from pydantic import BaseModel, Field, field_validator, model_validator


class ExamPipelineError(RuntimeError):
    """Fatal exam data pipeline failure."""


FIELD_MAPPING = {
    "campus": ["校区", "校区名称"],
    "course_name": ["课程名称", "课程", "考试课程"],
    "course_code": ["课程代码", "选课课号"],
    "class_name": ["班级名称", "班级", "班级代码", "行政班级"],
    "teacher": ["任课教师", "教师", "监考教师"],
    "location": ["考试教室", "教室名称", "地点", "考试地点"],
    "raw_time": ["考试时间", "时间"],
    "count": ["人数", "学生人数", "考试人数"],
    "school": ["开课学院", "学院"],
    "student_school": ["学生所在学院", "所在学院"],
    "major": ["专业名称", "专业"],
    "grade": ["年级"],
    "notes": ["备注"],
}

REGEX_CHINESE = re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})")
REGEX_ISO = re.compile(r"\(?(\d{4}-\d{1,2}-\d{1,2})\)?.*?(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})")


class ExamRecord(BaseModel):
    id: str
    source_file: str = Field(alias="_source_file")
    row_index: int = Field(alias="_row_index")

    campus: str = ""
    course_name: str = ""
    course_code: str = ""
    class_name: str = ""
    teacher: str = ""
    location: str = ""
    raw_time: str = ""
    count: int = 0
    school: str = ""
    student_school: str = ""
    major: str = ""
    grade: str = ""
    notes: str = ""

    start_timestamp: Optional[str] = None
    end_timestamp: Optional[str] = None
    duration_minutes: int = 0
    date: Optional[str] = None
    parse_error: Optional[str] = None

    @field_validator(
        "campus",
        "course_name",
        "course_code",
        "class_name",
        "teacher",
        "location",
        "raw_time",
        "school",
        "student_school",
        "major",
        "grade",
        "notes",
        mode="before",
    )
    @classmethod
    def clean_text_fields(cls, value: Any) -> str:
        if pd.isna(value) or value == "" or value is None:
            return ""
        return str(value).replace("\xa0", " ").strip()

    @field_validator("count", mode="before")
    @classmethod
    def clean_count_field(cls, value: Any) -> int:
        try:
            return int(value) if pd.notnull(value) and value != "" else 0
        except (ValueError, TypeError):
            return 0

    @model_validator(mode="after")
    def parse_time_logic(self):
        time_str = self.raw_time
        if not time_str:
            self.parse_error = "Missing time data"
            return self

        if isinstance(time_str, (datetime, pd.Timestamp)):
            time_str = str(time_str)

        try:
            match_cn = REGEX_CHINESE.search(time_str)
            match_iso = REGEX_ISO.search(time_str)

            if match_cn:
                year, month, day, start_hm, end_hm = match_cn.groups()
                date_str = f"{year}-{int(month):02d}-{int(day):02d}"
            elif match_iso:
                d_str, start_hm, end_hm = match_iso.groups()
                try:
                    date_str = datetime.strptime(d_str, "%Y-%m-%d").strftime("%Y-%m-%d")
                except ValueError:
                    date_str = d_str
            else:
                self.parse_error = "Unrecognized date format"
                return self

            beijing_tz = timezone(timedelta(hours=8))
            start_dt = datetime.strptime(f"{date_str} {start_hm}:00", "%Y-%m-%d %H:%M:%S").replace(tzinfo=beijing_tz)
            end_dt = datetime.strptime(f"{date_str} {end_hm}:00", "%Y-%m-%d %H:%M:%S").replace(tzinfo=beijing_tz)

            self.duration_minutes = int((end_dt - start_dt).total_seconds() / 60)
            self.start_timestamp = start_dt.isoformat()
            self.end_timestamp = end_dt.isoformat()
            self.date = date_str
            self.parse_error = None
        except Exception as exc:
            self.parse_error = f"Parsing exception: {exc}"

        return self


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ").strip())

