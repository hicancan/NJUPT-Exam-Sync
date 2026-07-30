from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd
from pydantic import ValidationError

from .model import FIELD_MAPPING, ExamDataError, ExamRecord

logger = logging.getLogger(__name__)


def get_xlsx_files(data_dir: Path) -> list[Path]:
    return sorted(data_dir.glob("*.xlsx"))


def _json_safe_sample_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool, type(None))):
        return value
    return str(value)


def _analyze_raw_columns(df: pd.DataFrame) -> list[dict[str, Any]]:
    raw_columns_info = []
    for col in df.columns:
        col_data = df[col]
        total = len(col_data)
        non_null_count = col_data.notna().sum()
        sample_values = col_data.dropna().unique()[:3].tolist()
        raw_columns_info.append(
            {
                "column_name": str(col),
                "dtype": str(col_data.dtype),
                "non_null_count": int(non_null_count),
                "null_count": int(col_data.isna().sum()),
                "non_null_pct": round((non_null_count / total * 100) if total > 0 else 0, 1),
                "unique_count": int(col_data.nunique()),
                "sample_values": ", ".join(str(value)[:30] for value in sample_values),
            }
        )
    return raw_columns_info


def _resolve_column_mapping(df: pd.DataFrame) -> tuple[dict[str, str | None], list[dict[str, Any]]]:
    current_file_mapping: dict[str, str | None] = {}
    mapping_details: list[dict[str, Any]] = []
    for std_key, possible_cols in FIELD_MAPPING.items():
        found_col = next((col for col in possible_cols if col in df.columns), None)
        current_file_mapping[std_key] = found_col
        mapping_details.append(
            {
                "standard_field": std_key,
                "excel_column": found_col if found_col else "(not found)",
                "possible_names": possible_cols,
                "mapped": found_col is not None,
            }
        )
    return current_file_mapping, mapping_details


def process_single_file(file_path: str | Path) -> dict[str, Any]:
    path = Path(file_path)
    filename = path.name
    logger.info("Processing file: %s", filename)

    try:
        df = pd.read_excel(path, engine="openpyxl")
    except Exception as exc:
        logger.error("Failed to process %s: %s", path, exc, exc_info=True)
        raise ExamDataError(f"Failed to process exam spreadsheet: {path}") from exc

    raw_samples = df.head(3).to_dict(orient="records")
    for sample in raw_samples:
        for key, value in list(sample.items()):
            sample[key] = _json_safe_sample_value(value)

    current_file_mapping, mapping_details = _resolve_column_mapping(df)
    clean_models: list[ExamRecord] = []
    validation_errors: list[str] = []
    parse_success_count = 0
    parse_fail_count = 0

    for idx, row in enumerate(df.to_dict(orient="records"), start=2):
        raw_input: dict[str, Any] = {
            "_source_file": filename,
            "_row_index": idx,
            "id": f"{filename}-{idx}",
        }
        for std_key, original_col in current_file_mapping.items():
            raw_input[std_key] = row.get(original_col) if original_col else None

        try:
            record = ExamRecord(**raw_input)
        except ValidationError as exc:
            validation_errors.append(f"Row {idx}: {exc}")
            parse_fail_count += 1
            continue
        if record.validation_error:
            validation_errors.append(f"Row {idx}: {record.validation_error} (Raw: '{record.raw_time}')")
            parse_fail_count += 1
        else:
            parse_success_count += 1
        clean_models.append(record)

    serialized_data = [
        model.model_dump(by_alias=True, exclude={"source_file", "row_index", "validation_error"})
        for model in clean_models
    ]

    campus_counts: dict[str, int] = {}
    date_set: set[str] = set()
    class_set: set[str] = set()
    course_set: set[str] = set()
    for model in clean_models:
        if model.campus:
            campus_counts[model.campus] = campus_counts.get(model.campus, 0) + 1
        if model.date:
            date_set.add(model.date)
        if model.class_name:
            class_set.add(model.class_name)
        if model.course_name:
            course_set.add(model.course_name)

    sorted_dates = sorted(date_set)
    durations = [model.duration_minutes for model in clean_models if model.duration_minutes > 0]

    return {
        "filename": filename,
        "row_count": len(df),
        "raw_columns": list(df.columns),
        "raw_columns_info": _analyze_raw_columns(df),
        "raw_samples": raw_samples,
        "mapping_details": mapping_details,
        "column_mapping": {key: value for key, value in current_file_mapping.items() if value},
        "parse_success_count": parse_success_count,
        "parse_fail_count": parse_fail_count,
        "validation_errors": validation_errors,
        "total_errors": len(validation_errors),
        "campus_distribution": campus_counts,
        "date_range": f"{sorted_dates[0]} ~ {sorted_dates[-1]}" if sorted_dates else "N/A",
        "unique_classes": len(class_set),
        "unique_courses": len(course_set),
        "avg_duration_minutes": round(sum(durations) / len(durations), 1) if durations else 0,
        "raw_data": serialized_data,
        "processed_samples": serialized_data[:3] if serialized_data else [],
    }

