import os
import json
import glob
import re
import logging
import sys
import shutil
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

from .report import generate_markdown_report


class ExamPipelineError(RuntimeError):
    """Fatal exam data pipeline failure."""

try:
    import pandas as pd
    import openpyxl
    from pydantic import BaseModel, Field, field_validator, model_validator, ValidationError
except ImportError as e:
    logger.error(f"Missing required libraries: {e}")
    logger.error("Please run: pip install pandas openpyxl pydantic")
    sys.exit(1)

# --- Configuration & Paths ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
PUBLIC_DIR = os.path.join(BASE_DIR, 'apps', 'web', 'public')
DATA_DIR = os.path.join(PUBLIC_DIR, 'generated', 'exam')
OUTPUT_DOC_PATH = os.path.join(DATA_DIR, 'DATA_INVENTORY.md')
MERGED_JSON_PATH = os.path.join(DATA_DIR, 'all_exams.json')

os.makedirs(DATA_DIR, exist_ok=True)

LEGACY_DATA_DIR = os.path.join(PUBLIC_DIR, 'data')
if os.path.isdir(LEGACY_DATA_DIR):
    shutil.rmtree(LEGACY_DATA_DIR)

# Field Mapping: Excel Column Names -> Model Fields
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
    "notes": ["备注"]
}

REGEX_CHINESE = re.compile(r'(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})')
REGEX_ISO = re.compile(r'\(?(\d{4}-\d{1,2}-\d{1,2})\)?.*?(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})')

def get_beijing_time() -> datetime:
    """Get current time in Beijing Timezone (UTC+8)"""
    utc_dt = datetime.now(timezone.utc)
    beijing_tz = timezone(timedelta(hours=8))
    return utc_dt.astimezone(beijing_tz)



# --- Pydantic Model ---
class ExamRecord(BaseModel):
    id: str
    source_file: str = Field(alias='_source_file')
    row_index: int = Field(alias='_row_index')

    # Raw Data Fields
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

    # Parsed/Derived Fields
    start_timestamp: Optional[str] = None
    end_timestamp: Optional[str] = None
    duration_minutes: int = 0
    date: Optional[str] = None
    parse_error: Optional[str] = None

    @field_validator(
        'campus', 'course_name', 'course_code', 'class_name', 'teacher', 
        'location', 'raw_time', 'school', 'student_school', 
        'major', 'grade', 'notes', 
        mode='before'
    )
    @classmethod
    def clean_text_fields(cls, v: Any) -> str:
        """Cleans string fields by removing non-breaking spaces and stripping whitespace."""
        if pd.isna(v) or v == "" or v is None:
            return ""
        return str(v).replace('\xa0', ' ').strip()

    @field_validator('count', mode='before')
    @classmethod
    def clean_count_field(cls, v: Any) -> int:
        """Safely parses the count field to integer."""
        try:
            return int(v) if pd.notnull(v) and v != "" else 0
        except (ValueError, TypeError):
            return 0

    @model_validator(mode='after')
    def parse_time_logic(self):
        """
        Parses the raw_time field to extract start/end timestamps and duration.
        Updates the model fields directly.
        """
        time_str = self.raw_time
        if not time_str:
            self.parse_error = "Missing time data"
            return self

        # If it's already a datetime object (rare in raw excel read as string, but possible)
        if isinstance(time_str, (datetime, pd.Timestamp)):
            time_str = str(time_str)

        start_dt = None
        end_dt = None
        date_str = ""

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

            start_str = f"{date_str} {start_hm}:00"
            end_str = f"{date_str} {end_hm}:00"

            # Add Beijing Timezone (UTC+8) explicitly
            beijing_tz = timezone(timedelta(hours=8))
            start_dt = datetime.strptime(start_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=beijing_tz)
            end_dt = datetime.strptime(end_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=beijing_tz)

            self.duration_minutes = int((end_dt - start_dt).total_seconds() / 60)
            self.start_timestamp = start_dt.isoformat()
            self.end_timestamp = end_dt.isoformat()
            self.date = date_str
            self.parse_error = None  # Clear error if successful

        except Exception as e:
            self.parse_error = f"Parsing exception: {str(e)}"
        
        return self


# --- Processing Logic ---

def get_xlsx_files() -> List[str]:
    return glob.glob(os.path.join(DATA_DIR, '*.xlsx'))

def process_single_file(file_path: str) -> Optional[Dict[str, Any]]:
    filename = os.path.basename(file_path)
    logger.info(f"Processing file: {filename}")
    
    try:
        df = pd.read_excel(file_path, engine='openpyxl')
        
        # ========== Part A: Raw Excel Analysis ==========
        raw_columns_info = []
        for col in df.columns:
            col_data = df[col]
            non_null_count = col_data.notna().sum()
            null_count = col_data.isna().sum()
            total = len(col_data)
            non_null_pct = (non_null_count / total * 100) if total > 0 else 0
            unique_count = col_data.nunique()
            
            # Sample values (first 3 non-null unique values)
            sample_values = col_data.dropna().unique()[:3].tolist()
            sample_str = ", ".join([str(v)[:30] for v in sample_values])
            
            raw_columns_info.append({
                "column_name": str(col),
                "dtype": str(col_data.dtype),
                "non_null_count": int(non_null_count),
                "null_count": int(null_count),
                "non_null_pct": round(non_null_pct, 1),
                "unique_count": int(unique_count),
                "sample_values": sample_str
            })
        
        # Raw data samples (first 3 rows as-is from Excel)
        raw_samples = df.head(3).to_dict(orient='records')
        # Convert any non-serializable types
        for sample in raw_samples:
            for k, v in sample.items():
                if pd.isna(v):
                    sample[k] = None
                elif hasattr(v, 'isoformat'):
                    sample[k] = v.isoformat()
                else:
                    sample[k] = str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v
        
        # ========== Column Mapping ==========
        current_file_mapping = {}
        mapping_details = []
        for std_key, possible_cols in FIELD_MAPPING.items():
            found_col = None
            for col in possible_cols:
                if col in df.columns:
                    found_col = col
                    break
            current_file_mapping[std_key] = found_col
            mapping_details.append({
                "standard_field": std_key,
                "excel_column": found_col if found_col else "(not found)",
                "possible_names": possible_cols,
                "mapped": found_col is not None
            })
        
        # ========== Part B: Processing ==========
        clean_models: List[ExamRecord] = []
        validation_errors = []
        parse_success_count = 0
        parse_fail_count = 0
        
        records = df.to_dict(orient='records')
        
        for idx, row in enumerate(records, start=2):
            raw_input = {
                '_source_file': filename,
                '_row_index': idx,
                'id': f"{filename}-{idx}"
            }
            
            for std_key, original_col in current_file_mapping.items():
                if original_col:
                    raw_input[std_key] = row.get(original_col)
                else:
                    raw_input[std_key] = None

            record = ExamRecord(**raw_input)
            
            if record.parse_error:
                err_msg = f"Row {idx}: {record.parse_error} (Raw: '{record.raw_time}')"
                validation_errors.append(err_msg)
                parse_fail_count += 1
            else:
                parse_success_count += 1
            
            clean_models.append(record)

        # Serialize processed data
        serialized_data = [
            model.model_dump(by_alias=True, exclude={'source_file', 'row_index'})
            for model in clean_models
        ]
        
        # ========== Data Distribution Stats ==========
        # Campus distribution
        campus_counts = {}
        date_set = set()
        class_set = set()
        course_set = set()
        
        for model in clean_models:
            if model.campus:
                campus_counts[model.campus] = campus_counts.get(model.campus, 0) + 1
            if model.date:
                date_set.add(model.date)
            if model.class_name:
                class_set.add(model.class_name)
            if model.course_name:
                course_set.add(model.course_name)
        
        # Date range
        sorted_dates = sorted(date_set) if date_set else []
        date_range = f"{sorted_dates[0]} ~ {sorted_dates[-1]}" if sorted_dates else "N/A"
        
        # Duration stats
        durations = [m.duration_minutes for m in clean_models if m.duration_minutes > 0]
        avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

        return {
            "filename": filename,
            "row_count": len(df),
            # Part A: Raw Excel info
            "raw_columns": list(df.columns),
            "raw_columns_info": raw_columns_info,
            "raw_samples": raw_samples,
            # Mapping info
            "mapping_details": mapping_details,
            "column_mapping": {k: v for k, v in current_file_mapping.items() if v},
            # Part B: Processing results
            "parse_success_count": parse_success_count,
            "parse_fail_count": parse_fail_count,
            "validation_errors": validation_errors,
            "total_errors": len(validation_errors),
            # Distribution stats
            "campus_distribution": campus_counts,
            "date_range": date_range,
            "unique_classes": len(class_set),
            "unique_courses": len(course_set),
            "avg_duration_minutes": avg_duration,
            # Processed data
            "raw_data": serialized_data,
            "processed_samples": serialized_data[:3] if serialized_data else []
        }

    except Exception as e:
        logger.error(f"Failed to process {file_path}: {e}", exc_info=True)
        raise ExamPipelineError(f"Failed to process exam spreadsheet: {file_path}") from e


def main():
    logger.info("Starting data extraction process (Pydantic Powered)...")
    files = get_xlsx_files()
    
    if not files:
        raise ExamPipelineError(
            f"No .xlsx files found in '{DATA_DIR}'. Base Dir: {BASE_DIR}; Public Dir: {PUBLIC_DIR}"
        )

    analyses = []
    all_rows = []

    for f in files:
        result = process_single_file(f)
        if result["parse_fail_count"] > 0:
            raise ExamPipelineError(
                f"{result['filename']} has {result['parse_fail_count']} unparsable exam rows"
            )
        analyses.append(result)
        all_rows.extend(result['raw_data'])

    if not analyses:
        raise ExamPipelineError("No exam spreadsheets were processed")

    logger.info(f"Generated {len(all_rows)} records.")
    
    # Idempotency Check
    data_changed = True
    if os.path.exists(MERGED_JSON_PATH):
        try:
            with open(MERGED_JSON_PATH, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
            # Compare assuming deterministic sorting/serialization
            if existing_data == all_rows:
                logger.info("⚡ Data is identical to existing file. Skipping write to prevent unnecessary commits.")
                data_changed = False
            else:
                logger.info("Data content has changed.")
        except Exception as e:
            logger.warning(f"Could not compare with existing data: {e}")

    if data_changed:
        logger.info(f"Saving {len(all_rows)} records to {MERGED_JSON_PATH}...")
        try:
            with open(MERGED_JSON_PATH, 'w', encoding='utf-8') as f:
                json.dump(all_rows, f, ensure_ascii=False, separators=(',', ':'))
        except Exception as e:
            logger.error(f"Failed to write JSON: {e}")
            raise ExamPipelineError(f"Failed to write {MERGED_JSON_PATH}") from e

        report_content = generate_markdown_report(
            analyses,
            len(all_rows),
            generated_at=get_beijing_time(),
            field_mapping=FIELD_MAPPING,
        )
        try:
            with open(OUTPUT_DOC_PATH, 'w', encoding='utf-8') as f:
                f.write(report_content)
        except Exception as e:
             logger.error(f"Failed to write Report: {e}")
             raise ExamPipelineError(f"Failed to write {OUTPUT_DOC_PATH}") from e

        manifest = {
            "generated_at": get_beijing_time().isoformat(),
            "files_processed": [a['filename'] for a in analyses],
            "total_records": len(all_rows)
        }

        # Try to load source metadata
        metadata_path = os.path.join(DATA_DIR, 'source_metadata.json')
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                    manifest['source_url'] = meta.get('source_url')
                    manifest['source_title'] = meta.get('source_title')
            except Exception as e:
                 logger.warning(f"Failed to load source metadata: {e}")

        try:
            with open(os.path.join(DATA_DIR, 'data_summary.json'), 'w', encoding='utf-8') as f:
                json.dump(manifest, f, indent=2, ensure_ascii=False)
        except Exception as e:
             logger.error(f"Failed to write Manifest: {e}")
             raise ExamPipelineError(f"Failed to write {os.path.join(DATA_DIR, 'data_summary.json')}") from e

        logger.info("✅ Data processing and updates complete.")
    else:
        logger.info("⚡ No changes detected. All files remain untouched.")

    logger.info("Process finished.")


if __name__ == "__main__":
    main()
