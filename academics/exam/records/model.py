from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

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
    "school": ["开课学院", "学院"],
    "student_school": ["学生所在学院", "所在学院"],
    "major": ["专业名称", "专业"],
    "grade": ["年级"],
    "notes": ["备注"],
}

REGEX_CHINESE = re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})")
REGEX_ISO = re.compile(r"\(?(\d{4}-\d{1,2}-\d{1,2})\)?.*?(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})")
EXAM_PERIOD_RE = re.compile(r"(?P<academic_year>\d{4}-\d{4})\s*学年\s*第\s*(?P<term>[一二三四1-4])\s*学期")
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


def parse_exam_period(source_title: Any) -> ExamPeriod:
    title = normalize_text(source_title)
    match = EXAM_PERIOD_RE.search(title)
    if not match:
        raise ExamDataError(f"Cannot parse exam period from source_title: {title!r}")
    academic_year = match.group("academic_year")
    term_token = match.group("term")
    term_number = TERM_NUMBER_BY_LABEL.get(term_token)
    if term_number is None:
        raise ExamDataError(f"Unsupported exam term in source_title: {title!r}")
    return ExamPeriod(
        exam_period_id=f"{academic_year}-{term_number}",
        academic_year=academic_year,
        term_number=term_number,
        term_label=TERM_LABEL_BY_NUMBER[term_number],
    )


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
    validation_error: Optional[str] = None

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
    def parse_time_logic(self):
        required_text_fields = (
            "campus",
            "course_name",
            "course_code",
            "class_name",
            "teacher",
            "location",
            "raw_time",
        )
        missing = [field for field in required_text_fields if not getattr(self, field)]
        if missing:
            self.validation_error = "Missing required field(s): " + ", ".join(missing)
            return self

        time_str = self.raw_time
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
                self.validation_error = "Unrecognized date format"
                return self

            beijing_tz = timezone(timedelta(hours=8))
            start_dt = datetime.strptime(f"{date_str} {start_hm}:00", "%Y-%m-%d %H:%M:%S").replace(tzinfo=beijing_tz)
            end_dt = datetime.strptime(f"{date_str} {end_hm}:00", "%Y-%m-%d %H:%M:%S").replace(tzinfo=beijing_tz)

            self.duration_minutes = int((end_dt - start_dt).total_seconds() / 60)
            self.start_timestamp = start_dt.isoformat()
            self.end_timestamp = end_dt.isoformat()
            self.date = date_str
            self.validation_error = None
        except Exception as exc:
            self.validation_error = f"Parsing exception: {exc}"

        return self


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ").strip())

