from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import pandas as pd
from pydantic import BaseModel, Field, field_validator, model_validator


class ExamDataError(RuntimeError):
    """Fatal exam source, record, or snapshot error."""


FIELD_MAPPING = {
    "campus": ["校区", "校区名称"],
    "course_name": ["课程名称", "课程", "考试课程"],
    "course_code": ["课程代码", "选课课号"],
    "class_name": ["班级名称", "班级", "班级代码", "行政班级"],
    "teacher": ["任课教师", "教师", "监考教师"],
    "location": ["考试教室", "教室名称", "地点", "考试地点"],
    "raw_time": ["考试时间", "时间"],
    "count": ["人数", "学生人数", "考试人数"],
    "notes": ["备注"],
}

REGEX_CHINESE = re.compile(
    r"(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})"
)
REGEX_ISO = re.compile(
    r"\(?(\d{4}-\d{1,2}-\d{1,2})\)?.*?(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})"
)
EXAM_PERIOD_RE = re.compile(
    r"(?P<academic_year>\d{4}-\d{4})\s*学年\s*第\s*(?P<term>[一二三四1-4])\s*学期"
)
TERM_NUMBER_BY_LABEL = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
}
TERM_LABEL_BY_NUMBER = {
    1: "第一学期",
    2: "第二学期",
    3: "第三学期",
    4: "第四学期",
}


@dataclass(frozen=True)
class ExamPeriod:
    exam_period_id: str
    academic_year: str
    term_number: int
    term_label: str


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ").strip())


def parse_exam_period(source_title: Any) -> ExamPeriod:
    title = normalize_text(source_title)
    match = EXAM_PERIOD_RE.search(title)
    if not match:
        raise ExamDataError(f"Cannot parse exam period from source_title: {title!r}")
    academic_year = match.group("academic_year")
    term_number = TERM_NUMBER_BY_LABEL.get(match.group("term"))
    if term_number is None:
        raise ExamDataError(f"Unsupported exam term in source_title: {title!r}")
    return ExamPeriod(
        exam_period_id=f"{academic_year}-{term_number}",
        academic_year=academic_year,
        term_number=term_number,
        term_label=TERM_LABEL_BY_NUMBER[term_number],
    )


class ExtractedExamRow(BaseModel):
    """One parsed source row before stable product identity is assigned."""

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
    notes: str = ""
    start_timestamp: str | None = None
    end_timestamp: str | None = None
    duration_minutes: int = 0
    date: str | None = None
    validation_error: str | None = None

    @field_validator(
        "campus",
        "course_name",
        "course_code",
        "class_name",
        "teacher",
        "location",
        "raw_time",
        "notes",
        mode="before",
    )
    @classmethod
    def clean_text_fields(cls, value: Any) -> str:
        if pd.isna(value) or value == "" or value is None:
            return ""
        return normalize_text(value)

    @field_validator("count", mode="before")
    @classmethod
    def clean_count_field(cls, value: Any) -> int:
        if pd.isna(value) or value == "" or value is None:
            raise ValueError("count is required")
        try:
            count = int(value)
        except (ValueError, TypeError) as exc:
            raise ValueError(f"count must be an integer: {value!r}") from exc
        if count < 0:
            raise ValueError(f"count must be nonnegative: {count}")
        return count

    @model_validator(mode="after")
    def parse_time(self) -> "ExtractedExamRow":
        required = (
            "campus",
            "course_name",
            "course_code",
            "class_name",
            "teacher",
            "location",
            "raw_time",
        )
        missing = [field for field in required if not getattr(self, field)]
        if missing:
            self.validation_error = "Missing required field(s): " + ", ".join(missing)
            return self

        match_cn = REGEX_CHINESE.search(self.raw_time)
        match_iso = REGEX_ISO.search(self.raw_time)
        try:
            if match_cn:
                year, month, day, start_hm, end_hm = match_cn.groups()
                date_value = f"{year}-{int(month):02d}-{int(day):02d}"
            elif match_iso:
                raw_date, start_hm, end_hm = match_iso.groups()
                date_value = datetime.strptime(raw_date, "%Y-%m-%d").strftime("%Y-%m-%d")
            else:
                self.validation_error = "Unrecognized date format"
                return self
            beijing = timezone(timedelta(hours=8))
            start = datetime.strptime(
                f"{date_value} {start_hm}:00", "%Y-%m-%d %H:%M:%S"
            ).replace(tzinfo=beijing)
            end = datetime.strptime(
                f"{date_value} {end_hm}:00", "%Y-%m-%d %H:%M:%S"
            ).replace(tzinfo=beijing)
            duration = int((end - start).total_seconds() / 60)
            if duration <= 0:
                raise ValueError("end time must be after start time")
            self.start_timestamp = start.isoformat()
            self.end_timestamp = end.isoformat()
            self.duration_minutes = duration
            self.date = date_value
        except ValueError as exc:
            self.validation_error = f"Invalid exam time: {exc}"
        return self
