import os
import json
import glob
import re
import logging
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

try:
    import pandas as pd
    import openpyxl
    from pydantic import BaseModel, Field, field_validator, model_validator, ValidationError
except ImportError as e:
    logger.error(f"Missing required libraries: {e}")
    logger.error("Please run: pip install pandas openpyxl pydantic")
    sys.exit(1)

# --- Configuration & Paths ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
DATA_DIR = os.path.join(PUBLIC_DIR, 'data')
OUTPUT_DOC_PATH = os.path.join(DATA_DIR, 'DATA_INVENTORY.md')
MERGED_JSON_PATH = os.path.join(DATA_DIR, 'all_exams.json')

os.makedirs(DATA_DIR, exist_ok=True)

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

            start_dt = datetime.strptime(start_str, "%Y-%m-%d %H:%M:%S")
            end_dt = datetime.strptime(end_str, "%Y-%m-%d %H:%M:%S")

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
        
        # 1. Determine Column Mapping
        current_file_mapping = {}
        for std_key, possible_cols in FIELD_MAPPING.items():
            found_col = None
            for col in possible_cols:
                if col in df.columns:
                    found_col = col
                    break
            current_file_mapping[std_key] = found_col
        
        clean_models: List[ExamRecord] = []
        validation_errors = []
        
        records = df.to_dict(orient='records')
        
        # 2. Iterate and Validate using Pydantic
        for idx, row in enumerate(records, start=2):
            # Prepare raw dictionary for Pydantic
            raw_input = {
                '_source_file': filename,
                '_row_index': idx,
                'id': f"{filename}-{idx}"
            }
            
            # Extract mapped fields
            for std_key, original_col in current_file_mapping.items():
                if original_col:
                    raw_input[std_key] = row.get(original_col)
                else:
                    raw_input[std_key] = None

            # Create Record
            record = ExamRecord(**raw_input)
            
            # Check for soft validation errors (time parsing)
            if record.parse_error:
                err_msg = f"Row {idx}: {record.parse_error} (Raw: '{record.raw_time}')"
                validation_errors.append(err_msg)
            
            clean_models.append(record)

        # 3. Serialize Results
        # Pydantic models to dicts
        # Note: When by_alias=True, exclude must use alias names (_source_file, _row_index)
        serialized_data = [
            model.model_dump(by_alias=True, exclude={'_source_file', '_row_index'})
            for model in clean_models
        ]

        return {
            "filename": filename,
            "row_count": len(df),
            "validation_errors": validation_errors,
            "total_errors": len(validation_errors),
            "column_details": {col: str(df[col].dtype) for col in df.columns},
            "raw_data": serialized_data,
            "samples": serialized_data[:3] if serialized_data else []
        }

    except Exception as e:
        logger.error(f"Failed to process {file_path}: {e}", exc_info=True)
        return None

def generate_markdown_report(analyses: List[Dict], total_records: int) -> str:
    lines = ["# Data Inventory & Quality Report", ""]
    lines.append(f"**Generated on:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"**Total Files Processed:** {len(analyses)}")
    lines.append(f"**Total Records Extracted:** {total_records}")
    lines.append("")

    for analysis in analyses:
        status_icon = "✅" if analysis['total_errors'] == 0 else "⚠️"
        lines.append(f"## {status_icon} File: `{analysis['filename']}`")
        lines.append(f"- **Row Count:** {analysis['row_count']}")
        
        if analysis['total_errors'] > 0:
            lines.append(f"- **Validation Warnings:** {analysis['total_errors']}")
            lines.append("  > **Error Samples:**")
            for err in analysis['validation_errors'][:5]:
                lines.append(f"  - {err}")
        else:
            lines.append("- **Validation:** Passed")

        lines.append("")
        lines.append("### Data Preview (Top 3 Rows)")
        
        if analysis['samples']:
            # Filter internal keys for cleaner table
            keys = [k for k in analysis['samples'][0].keys() if not k.startswith('_') and k != 'id']
            # Prioritize some keys
            priority_keys = ['campus', 'course_name', 'class_name', 'teacher', 'raw_time', 'start_timestamp']
            sorted_keys = [k for k in priority_keys if k in keys] + [k for k in keys if k not in priority_keys]
            
            # Header
            lines.append("| " + " | ".join(sorted_keys) + " |")
            # Separator
            lines.append("| " + " | ".join(["---"] * len(sorted_keys)) + " |")
            # Rows
            for sample in analysis['samples']:
                row_vals = [str(sample.get(k, '')).replace('\n', ' ') for k in sorted_keys]
                lines.append("| " + " | ".join(row_vals) + " |")
        else:
            lines.append("_No data extracted_")

        lines.append("")
        lines.append("---")
        lines.append("")
        
    return "\n".join(lines)


def main():
    logger.info("Starting data extraction process (Pydantic Powered)...")
    files = get_xlsx_files()
    
    if not files:
        logger.warning(f"No .xlsx files found in '{DATA_DIR}' directory.")
        # Try to debug why
        logger.info(f"Base Dir: {BASE_DIR}")
        logger.info(f"Public Dir: {PUBLIC_DIR}")
        return

    analyses = []
    all_rows = []

    for f in files:
        result = process_single_file(f)
        if result:
            analyses.append(result)
            all_rows.extend(result['raw_data'])

    logger.info(f"Saving {len(all_rows)} records to {MERGED_JSON_PATH}...")
    try:
        with open(MERGED_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(all_rows, f, ensure_ascii=False, separators=(',', ':'))
    except Exception as e:
        logger.error(f"Failed to write JSON: {e}")

    report_content = generate_markdown_report(analyses, len(all_rows))
    try:
        with open(OUTPUT_DOC_PATH, 'w', encoding='utf-8') as f:
            f.write(report_content)
    except Exception as e:
         logger.error(f"Failed to write Report: {e}")

    manifest = {
        "generated_at": datetime.now().isoformat(),
        "files_processed": [a['filename'] for a in analyses],
        "total_records": len(all_rows)
    }
    try:
        with open(os.path.join(DATA_DIR, 'data_summary.json'), 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
    except Exception as e:
         logger.error(f"Failed to write Manifest: {e}")

    logger.info("Data processing complete.")


if __name__ == "__main__":
    main()