# 📊 Data Inventory & Quality Report

> **Generated on:** 2025-12-19 07:11:27
>
> This report provides complete visibility into raw Excel data and processing results.
> You do NOT need to open the original Excel files - all information is captured here.

## 📋 Executive Summary

| Metric | Value |
|--------|-------|
| Total Files Processed | 3 |
| Total Records Extracted | 9,212 |
| Parse Success Rate | 9212/9212 (100.0%) |
| Date Range (All Files) | 2025-11-05 ~ 2026-01-23 |
| Unique Classes | ~1,696 |
| Unique Courses | ~470 |
| Campus Distribution | 仙林 (8,325), 三牌楼 (825), 锁金 (62) |

---

## ✅ File: `2025-2026学年第一学期考试安排表（学院组织）-学生用表.xlsx`

**Rows:** 2,744 | **Columns:** 9 | **Parse Success:** 2744/2744 | **Date Range:** 2025-11-05 ~ 2026-01-23

### 🔹 Part A: Raw Excel Analysis

#### Original Column Names (as in Excel)

| # | Excel Column Name | Data Type | Non-Null % | Unique Values | Sample Values |
|---|-------------------|-----------|------------|---------------|---------------|
| 1 | `校区` | object | 100.0% | 3 | 仙林, 三牌楼, 锁金 |
| 2 | `开课学院` | object | 100.0% | 17 | 材料科学与工程学院, 自动化学院, 物联网学院 |
| 3 | `课程代码` | object | 100.0% | 394 | CL1712F2S, CL1713F2S, CL1721F2S |
| 4 | `课程名称` | object | 100.0% | 350 | 聚合物共混改性, 聚合物反应原理, 材料制备与加工技术 |
| 5 | `班级名称` | object | 100.0% | 631 | B220601(GF), B220602(GF), B220603(CW) |
| 6 | `任课教师` | object | 100.0% | 545 | 孙鹏飞, 陈莹, 许利刚 |
| 7 | `人数` | int64 | 100.0% | 40 | 19, 25, 33 |
| 8 | `考试时间` | object | 100.0% | 107 | 第11周周2(2025-11-18) 13:30-15:20, 第11周周4(2025-11-20) |
| 9 | `考试教室` | object | 100.0% | 91 | 教4－208, 教4－110, 教4－205 |

#### Column Mapping (Excel → Standard Field)

| Standard Field | Excel Column | Status |
|----------------|--------------|--------|
| `campus` | `校区` | ✅ Mapped |
| `course_name` | `课程名称` | ✅ Mapped |
| `course_code` | `课程代码` | ✅ Mapped |
| `class_name` | `班级名称` | ✅ Mapped |
| `teacher` | `任课教师` | ✅ Mapped |
| `location` | `考试教室` | ✅ Mapped |
| `raw_time` | `考试时间` | ✅ Mapped |
| `count` | `人数` | ✅ Mapped |
| `school` | `开课学院` | ✅ Mapped |
| `student_school` | _(tried: 学生所在学院, 所在学院)_ | ❌ Not Found |
| `major` | _(tried: 专业名称, 专业)_ | ❌ Not Found |
| `grade` | _(tried: 年级)_ | ❌ Not Found |
| `notes` | _(tried: 备注)_ | ❌ Not Found |

#### Raw Data Sample (First 3 Rows, Unprocessed)

| 校区 | 开课学院 | 课程代码 | 课程名称 | 班级名称 | 任课教师 | 人数 | 考试时间 | 考试教室 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 仙林 | 材料科学与工程学院 | CL1712F2S | 聚合物共混改性 | B220601(GF) | 孙鹏飞 | 19 | 第11周周2(2025-11-18) 1 | 教4－208 |
| 仙林 | 材料科学与工程学院 | CL1712F2S | 聚合物共混改性 | B220602(GF) | 孙鹏飞 | 25 | 第11周周2(2025-11-18) 1 | 教4－208 |
| 仙林 | 材料科学与工程学院 | CL1713F2S | 聚合物反应原理 | B220601(GF) | 陈莹 | 33 | 第11周周4(2025-11-20) 1 | 教4－110 |

### 🔹 Part B: Processing Results

#### Processing Statistics

| Metric | Value |
|--------|-------|
| Records Processed | 2,744 |
| Time Parse Success | 2,744 |
| Time Parse Failed | 0 |
| Unique Classes | 631 |
| Unique Courses | 350 |
| Avg Exam Duration | 110.0 min |
| Campus Distribution | 仙林 (2430), 三牌楼 (313), 锁金 (1) |

#### ✅ Validation: All Passed

#### Processed Data Sample (First 3 Rows)

| class_name | course_name | campus | start_timestamp | location | teacher | count |
| --- | --- | --- | --- | --- | --- | --- |
| B220601(GF) | 聚合物共混改性 | 仙林 | 2025-11-18T13:30:00 | 教4－208 | 孙鹏飞 | 19 |
| B220602(GF) | 聚合物共混改性 | 仙林 | 2025-11-18T13:30:00 | 教4－208 | 孙鹏飞 | 25 |
| B220601(GF) | 聚合物反应原理 | 仙林 | 2025-11-20T13:30:00 | 教4－110 | 陈莹 | 33 |

---

## ✅ File: `2025-2026学年第一学期集中考试周1安排表（学校组织）-学生用表.xlsx`

**Rows:** 263 | **Columns:** 12 | **Parse Success:** 263/263 | **Date Range:** 2025-11-15 ~ 2025-12-03

### 🔹 Part A: Raw Excel Analysis

#### Original Column Names (as in Excel)

| # | Excel Column Name | Data Type | Non-Null % | Unique Values | Sample Values |
|---|-------------------|-----------|------------|---------------|---------------|
| 1 | `校区` | object | 100.0% | 2 | 仙林, 三牌楼 |
| 2 | `开课学院` | object | 100.0% | 3 | 集成电路科学与工程学院, 马克思主义学院, 电子与光学工程学院 |
| 3 | `课程代码` | object | 100.0% | 4 | JC3106PIS, MY1002T0S, DG1001T0C |
| 4 | `课程名称` | object | 100.0% | 4 | 半导体集成电路工艺, 毛泽东思想和中国特色社会主义理论体系概论, 工程管理与经济决策 |
| 5 | `班级名称` | object | 100.0% | 236 | P220006, P220008, P230005 |
| 6 | `任课教师` | object | 100.0% | 22 | 李金泽, 沈金霞, 孙景珊 |
| 7 | `人数` | int64 | 100.0% | 31 | 2, 1, 29 |
| 8 | `考试时间` | object | 100.0% | 3 | 2025年11月15日(10:25-12:15), 2025年11月26日(13:30-15:20) |
| 9 | `教室名称` | object | 100.0% | 42 | 教2－209, 教2－208, 教东-101 |
| 10 | `学生所在学院` | object | 100.0% | 17 | 波特兰学院, 通信与信息工程学院, 电子与光学工程学院 |
| 11 | `年级` | int64 | 100.0% | 5 | 2022, 2023, 2024 |
| 12 | `专业名称` | object | 100.0% | 50 | 电子科学与技术(波特兰学院), 电子信息工程, 电磁场与无线技术 |

#### Column Mapping (Excel → Standard Field)

| Standard Field | Excel Column | Status |
|----------------|--------------|--------|
| `campus` | `校区` | ✅ Mapped |
| `course_name` | `课程名称` | ✅ Mapped |
| `course_code` | `课程代码` | ✅ Mapped |
| `class_name` | `班级名称` | ✅ Mapped |
| `teacher` | `任课教师` | ✅ Mapped |
| `location` | `教室名称` | ✅ Mapped |
| `raw_time` | `考试时间` | ✅ Mapped |
| `count` | `人数` | ✅ Mapped |
| `school` | `开课学院` | ✅ Mapped |
| `student_school` | `学生所在学院` | ✅ Mapped |
| `major` | `专业名称` | ✅ Mapped |
| `grade` | `年级` | ✅ Mapped |
| `notes` | _(tried: 备注)_ | ❌ Not Found |

#### Raw Data Sample (First 3 Rows, Unprocessed)

| 校区 | 开课学院 | 课程代码 | 课程名称 | 班级名称 | 任课教师 | 人数 | 考试时间 | 教室名称 | 学生所在学院 | 年级 | 专业名称 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 仙林 | 集成电路科学与工程学院 | JC3106PIS | 半导体集成电路工艺 | P220006 | 李金泽 | 2 | 2025年11月15日(10:25-12 | 教2－209 | 波特兰学院 | 2022 | 电子科学与技术(波特兰学院) |
| 仙林 | 集成电路科学与工程学院 | JC3106PIS | 半导体集成电路工艺 | P220008 | 李金泽 | 1 | 2025年11月15日(10:25-12 | 教2－209 | 波特兰学院 | 2022 | 电子科学与技术(波特兰学院) |
| 仙林 | 集成电路科学与工程学院 | JC3106PIS | 半导体集成电路工艺 | P230005 | 李金泽 | 29 | 2025年11月15日(10:25-12 | 教2－209 | 波特兰学院 | 2023 | 电子科学与技术(波特兰学院) |

### 🔹 Part B: Processing Results

#### Processing Statistics

| Metric | Value |
|--------|-------|
| Records Processed | 263 |
| Time Parse Success | 263 |
| Time Parse Failed | 0 |
| Unique Classes | 236 |
| Unique Courses | 4 |
| Avg Exam Duration | 110.0 min |
| Campus Distribution | 仙林 (252), 三牌楼 (11) |

#### ✅ Validation: All Passed

#### Processed Data Sample (First 3 Rows)

| class_name | course_name | campus | start_timestamp | location | teacher | count |
| --- | --- | --- | --- | --- | --- | --- |
| P220006 | 半导体集成电路工艺 | 仙林 | 2025-11-15T10:25:00 | 教2－209 | 李金泽 | 2 |
| P220008 | 半导体集成电路工艺 | 仙林 | 2025-11-15T10:25:00 | 教2－209 | 李金泽 | 1 |
| P230005 | 半导体集成电路工艺 | 仙林 | 2025-11-15T10:25:00 | 教2－209 | 李金泽 | 29 |

---

## ✅ File: `2025-2026学年第一学期考试安排表（学校组织19-20周）-学生用表.xlsx`

**Rows:** 6,205 | **Columns:** 12 | **Parse Success:** 6205/6205 | **Date Range:** 2026-01-07 ~ 2026-01-22

### 🔹 Part A: Raw Excel Analysis

#### Original Column Names (as in Excel)

| # | Excel Column Name | Data Type | Non-Null % | Unique Values | Sample Values |
|---|-------------------|-----------|------------|---------------|---------------|
| 1 | `校区` | object | 100.0% | 3 | 三牌楼, 仙林, 锁金 |
| 2 | `开课学院` | object | 100.0% | 15 | 电子与光学工程学院, 管理学院, 集成电路科学与工程学院 |
| 3 | `课程代码` | object | 100.0% | 181 | DG1003F4S, DG1003TXS, DG1004F4S |
| 4 | `课程名称` | object | 100.0% | 116 | 电路分析基础A, 电路分析基础A（混合式）, 电路分析基础B |
| 5 | `班级名称` | object | 100.0% | 829 | B200112, B220223, B230204 |
| 6 | `任课教师` | object | 100.0% | 508 | 李娟, 侯佳, 孙蔚 |
| 7 | `人数` | int64 | 100.0% | 39 | 1, 3, 2 |
| 8 | `考试时间` | object | 100.0% | 33 | 2026年01月21日(18:30-20:20), 2026年01月16日(08:00-09:50) |
| 9 | `教室名称` | object | 100.0% | 88 | 无1, 教2－305, 教2－304 |
| 10 | `学生所在学院` | object | 100.0% | 22 | 通信与信息工程学院, 电子与光学工程学院, 集成电路科学与工程学院 |
| 11 | `年级` | int64 | 100.0% | 6 | 2020, 2022, 2023 |
| 12 | `专业名称` | object | 100.0% | 90 | 通信工程, 柔性电子学, 电子科学与技术 |

#### Column Mapping (Excel → Standard Field)

| Standard Field | Excel Column | Status |
|----------------|--------------|--------|
| `campus` | `校区` | ✅ Mapped |
| `course_name` | `课程名称` | ✅ Mapped |
| `course_code` | `课程代码` | ✅ Mapped |
| `class_name` | `班级名称` | ✅ Mapped |
| `teacher` | `任课教师` | ✅ Mapped |
| `location` | `教室名称` | ✅ Mapped |
| `raw_time` | `考试时间` | ✅ Mapped |
| `count` | `人数` | ✅ Mapped |
| `school` | `开课学院` | ✅ Mapped |
| `student_school` | `学生所在学院` | ✅ Mapped |
| `major` | `专业名称` | ✅ Mapped |
| `grade` | `年级` | ✅ Mapped |
| `notes` | _(tried: 备注)_ | ❌ Not Found |

#### Raw Data Sample (First 3 Rows, Unprocessed)

| 校区 | 开课学院 | 课程代码 | 课程名称 | 班级名称 | 任课教师 | 人数 | 考试时间 | 教室名称 | 学生所在学院 | 年级 | 专业名称 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 三牌楼 | 电子与光学工程学院 | DG1003F4S | 电路分析基础A | B200112 | 李娟 | 1 | 2026年01月21日(18:30-20 | 无1 | 通信与信息工程学院 | 2020 | 通信工程 |
| 仙林 | 电子与光学工程学院 | DG1003F4S | 电路分析基础A | B220223 | 李娟 | 3 | 2026年01月21日(18:30-20 | 教2－305 | 电子与光学工程学院 | 2022 | 柔性电子学 |
| 仙林 | 电子与光学工程学院 | DG1003F4S | 电路分析基础A | B230204 | 李娟 | 1 | 2026年01月21日(18:30-20 | 教2－305 | 电子与光学工程学院 | 2023 | 电子科学与技术 |

### 🔹 Part B: Processing Results

#### Processing Statistics

| Metric | Value |
|--------|-------|
| Records Processed | 6,205 |
| Time Parse Success | 6,205 |
| Time Parse Failed | 0 |
| Unique Classes | 829 |
| Unique Courses | 116 |
| Avg Exam Duration | 111.7 min |
| Campus Distribution | 三牌楼 (501), 仙林 (5643), 锁金 (61) |

#### ✅ Validation: All Passed

#### Processed Data Sample (First 3 Rows)

| class_name | course_name | campus | start_timestamp | location | teacher | count |
| --- | --- | --- | --- | --- | --- | --- |
| B200112 | 电路分析基础A | 三牌楼 | 2026-01-21T18:30:00 | 无1 | 李娟 | 1 |
| B220223 | 电路分析基础A | 仙林 | 2026-01-21T18:30:00 | 教2－305 | 李娟 | 3 |
| B230204 | 电路分析基础A | 仙林 | 2026-01-21T18:30:00 | 教2－305 | 李娟 | 1 |

---

## 📚 Appendix

### A. Field Mapping Reference

The following table shows how Excel column names are mapped to standard field names:

| Standard Field | Possible Excel Column Names |
|----------------|----------------------------|
| `campus` | 校区, 校区名称 |
| `course_name` | 课程名称, 课程, 考试课程 |
| `course_code` | 课程代码, 选课课号 |
| `class_name` | 班级名称, 班级, 班级代码, 行政班级 |
| `teacher` | 任课教师, 教师, 监考教师 |
| `location` | 考试教室, 教室名称, 地点, 考试地点 |
| `raw_time` | 考试时间, 时间 |
| `count` | 人数, 学生人数, 考试人数 |
| `school` | 开课学院, 学院 |
| `student_school` | 学生所在学院, 所在学院 |
| `major` | 专业名称, 专业 |
| `grade` | 年级 |
| `notes` | 备注 |

### B. Supported Time Formats

The system can parse the following time formats:

| Format | Example | Regex Pattern |
|--------|---------|---------------|
| Chinese Date | `2025年11月15日(10:25-12:15)` | `(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})` |
| ISO Date | `第11周周2(2025-11-18) 13:30-15:20` | `\(?(\d{4}-\d{1,2}-\d{1,2})\)?.*?(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})` |

### C. Output JSON Fields

The processed `all_exams.json` contains these fields per record:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (filename-row) |
| `class_name` | string | Class identifier (e.g., B240402) |
| `course_name` | string | Course name |
| `course_code` | string | Course code |
| `campus` | string | Campus name |
| `teacher` | string | Teacher name |
| `location` | string | Exam location |
| `raw_time` | string | Original time string from Excel |
| `start_timestamp` | string | Parsed ISO datetime |
| `end_timestamp` | string | Parsed ISO datetime |
| `duration_minutes` | integer | Exam duration in minutes |
| `count` | integer | Number of students |
| `notes` | string | Additional notes |

---

*End of Report*