from __future__ import annotations

from datetime import datetime
from typing import Any


def generate_markdown_report(
    analyses: list[dict[str, Any]],
    total_records: int,
    *,
    generated_at: datetime,
    field_mapping: dict[str, list[str]],
) -> str:
    """Generate comprehensive markdown report with Raw Excel Analysis + Processing Results"""
    lines = []

    # ========== Header ==========
    lines.append("# 📊 Data Inventory & Quality Report")
    lines.append("")
    lines.append(f"> **Generated on:** {generated_at.strftime('%Y-%m-%d %H:%M:%S')} (Beijing Time)")
    lines.append(">")
    lines.append("> This report provides complete visibility into raw Excel data and processing results.")
    lines.append("> You do NOT need to open the original Excel files - all information is captured here.")
    lines.append("")

    # ========== Executive Summary ==========
    lines.append("## 📋 Executive Summary")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("|--------|-------|")
    lines.append(f"| Total Files Processed | {len(analyses)} |")
    lines.append(f"| Total Records Extracted | {total_records:,} |")

    # Aggregate stats
    total_success = sum(a.get('parse_success_count', 0) for a in analyses)
    total_fail = sum(a.get('parse_fail_count', 0) for a in analyses)
    total_classes = sum(a.get('unique_classes', 0) for a in analyses)
    total_courses = sum(a.get('unique_courses', 0) for a in analyses)

    # Aggregate campus distribution
    all_campus = {}
    all_dates = set()
    for a in analyses:
        for campus, count in a.get('campus_distribution', {}).items():
            all_campus[campus] = all_campus.get(campus, 0) + count
        if a.get('date_range') and a.get('date_range') != 'N/A':
            parts = a.get('date_range', '').split(' ~ ')
            all_dates.update(parts)

    sorted_all_dates = sorted(all_dates) if all_dates else []
    global_date_range = f"{sorted_all_dates[0]} ~ {sorted_all_dates[-1]}" if len(sorted_all_dates) >= 2 else "N/A"

    lines.append(f"| Parse Success Rate | {total_success}/{total_success+total_fail} ({round(total_success/(total_success+total_fail)*100, 1) if (total_success+total_fail) > 0 else 0}%) |")
    lines.append(f"| Date Range (All Files) | {global_date_range} |")
    lines.append(f"| Unique Classes | ~{total_classes:,} |")
    lines.append(f"| Unique Courses | ~{total_courses:,} |")

    if all_campus:
        campus_str = ", ".join([f"{k} ({v:,})" for k, v in sorted(all_campus.items(), key=lambda x: -x[1])])
        lines.append(f"| Campus Distribution | {campus_str} |")

    lines.append("")
    lines.append("---")
    lines.append("")

    # ========== Per-File Sections ==========
    for analysis in analyses:
        status_icon = "✅" if analysis['total_errors'] == 0 else "⚠️"
        lines.append(f"## {status_icon} File: `{analysis['filename']}`")
        lines.append("")

        # Quick stats
        lines.append(f"**Rows:** {analysis['row_count']:,} | "
                    f"**Columns:** {len(analysis.get('raw_columns', []))} | "
                    f"**Parse Success:** {analysis.get('parse_success_count', 0)}/{analysis['row_count']} | "
                    f"**Date Range:** {analysis.get('date_range', 'N/A')}")
        lines.append("")

        # ========== Part A: Raw Excel Analysis ==========
        lines.append("### 🔹 Part A: Raw Excel Analysis")
        lines.append("")
        lines.append("#### Original Column Names (as in Excel)")
        lines.append("")
        lines.append("| # | Excel Column Name | Data Type | Non-Null % | Unique Values | Sample Values |")
        lines.append("|---|-------------------|-----------|------------|---------------|---------------|")

        for i, col_info in enumerate(analysis.get('raw_columns_info', []), 1):
            lines.append(f"| {i} | `{col_info['column_name']}` | {col_info['dtype']} | "
                        f"{col_info['non_null_pct']}% | {col_info['unique_count']:,} | {col_info['sample_values'][:50]} |")

        lines.append("")

        # Column Mapping
        lines.append("#### Column Mapping (Excel → Standard Field)")
        lines.append("")
        lines.append("| Standard Field | Excel Column | Status |")
        lines.append("|----------------|--------------|--------|")

        for mapping in analysis.get('mapping_details', []):
            status = "✅ Mapped" if mapping['mapped'] else "❌ Not Found"
            excel_col = f"`{mapping['excel_column']}`" if mapping['mapped'] else f"_(tried: {', '.join(mapping['possible_names'][:3])})_"
            lines.append(f"| `{mapping['standard_field']}` | {excel_col} | {status} |")

        lines.append("")

        # Raw Data Sample
        lines.append("#### Raw Data Sample (First 3 Rows, Unprocessed)")
        lines.append("")

        raw_samples = analysis.get('raw_samples', [])
        if raw_samples:
            raw_keys = list(raw_samples[0].keys())
            # Truncate column names for display
            header = " | ".join([str(k)[:15] for k in raw_keys])
            lines.append(f"| {header} |")
            lines.append("| " + " | ".join(["---"] * len(raw_keys)) + " |")
            for sample in raw_samples:
                row_vals = [str(sample.get(k, ''))[:20].replace('\n', ' ').replace('|', '/') for k in raw_keys]
                lines.append("| " + " | ".join(row_vals) + " |")
        else:
            lines.append("_No raw data available_")

        lines.append("")

        # ========== Part B: Processing Results ==========
        lines.append("### 🔹 Part B: Processing Results")
        lines.append("")

        # Stats
        lines.append("#### Processing Statistics")
        lines.append("")
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| Records Processed | {analysis['row_count']:,} |")
        lines.append(f"| Time Parse Success | {analysis.get('parse_success_count', 0):,} |")
        lines.append(f"| Time Parse Failed | {analysis.get('parse_fail_count', 0):,} |")
        lines.append(f"| Unique Classes | {analysis.get('unique_classes', 0):,} |")
        lines.append(f"| Unique Courses | {analysis.get('unique_courses', 0):,} |")
        lines.append(f"| Avg Exam Duration | {analysis.get('avg_duration_minutes', 0)} min |")

        campus_dist = analysis.get('campus_distribution', {})
        if campus_dist:
            campus_str = ", ".join([f"{k} ({v})" for k, v in campus_dist.items()])
            lines.append(f"| Campus Distribution | {campus_str} |")

        lines.append("")

        # Validation Errors
        if analysis['total_errors'] > 0:
            lines.append("#### ⚠️ Validation Warnings")
            lines.append("")
            lines.append(f"Found **{analysis['total_errors']}** rows with parsing issues:")
            lines.append("")
            for err in analysis['validation_errors'][:10]:
                lines.append(f"- {err}")
            if analysis['total_errors'] > 10:
                lines.append(f"- _...and {analysis['total_errors'] - 10} more_")
            lines.append("")
        else:
            lines.append("#### ✅ Validation: All Passed")
            lines.append("")

        # Processed Data Sample
        lines.append("#### Processed Data Sample (First 3 Rows)")
        lines.append("")

        processed_samples = analysis.get('processed_samples', [])
        if processed_samples:
            # Select key fields for display
            display_keys = ['class_name', 'course_name', 'campus', 'start_timestamp', 'location', 'teacher', 'count']
            available_keys = [k for k in display_keys if k in processed_samples[0]]

            lines.append("| " + " | ".join(available_keys) + " |")
            lines.append("| " + " | ".join(["---"] * len(available_keys)) + " |")
            for sample in processed_samples:
                row_vals = [str(sample.get(k, ''))[:25].replace('\n', ' ') for k in available_keys]
                lines.append("| " + " | ".join(row_vals) + " |")
        else:
            lines.append("_No processed data available_")

        lines.append("")
        lines.append("---")
        lines.append("")

    # ========== Appendix ==========
    lines.append("## 📚 Appendix")
    lines.append("")

    # A. Field Mapping Reference
    lines.append("### A. Field Mapping Reference")
    lines.append("")
    lines.append("The following table shows how Excel column names are mapped to standard field names:")
    lines.append("")
    lines.append("| Standard Field | Possible Excel Column Names |")
    lines.append("|----------------|----------------------------|")
    for std_field, possible_names in field_mapping.items():
        lines.append(f"| `{std_field}` | {', '.join(possible_names)} |")

    lines.append("")

    # B. Time Format Patterns
    lines.append("### B. Supported Time Formats")
    lines.append("")
    lines.append("The system can parse the following time formats:")
    lines.append("")
    lines.append("| Format | Example | Regex Pattern |")
    lines.append("|--------|---------|---------------|")
    lines.append("| Chinese Date | `2025年11月15日(10:25-12:15)` | `(\\d{4})年(\\d{1,2})月(\\d{1,2})日.*?(\\d{1,2}:\\d{2})\\s*[-~至]\\s*(\\d{1,2}:\\d{2})` |")
    lines.append("| ISO Date | `第11周周2(2025-11-18) 13:30-15:20` | `\\(?(\\d{4}-\\d{1,2}-\\d{1,2})\\)?.*?(\\d{1,2}:\\d{2})\\s*[-~至]\\s*(\\d{1,2}:\\d{2})` |")

    lines.append("")

    # C. Output Fields
    lines.append("### C. Output JSON Fields")
    lines.append("")
    lines.append("The processed `all_exams.json` contains these fields per record:")
    lines.append("")
    lines.append("| Field | Type | Description |")
    lines.append("|-------|------|-------------|")
    lines.append("| `id` | string | Unique identifier (filename-row) |")
    lines.append("| `class_name` | string | Class identifier (e.g., B240402) |")
    lines.append("| `course_name` | string | Course name |")
    lines.append("| `course_code` | string | Course code |")
    lines.append("| `campus` | string | Campus name |")
    lines.append("| `teacher` | string | Teacher name |")
    lines.append("| `location` | string | Exam location |")
    lines.append("| `raw_time` | string | Original time string from Excel |")
    lines.append("| `start_timestamp` | string | Parsed ISO datetime |")
    lines.append("| `end_timestamp` | string | Parsed ISO datetime |")
    lines.append("| `duration_minutes` | integer | Exam duration in minutes |")
    lines.append("| `count` | integer | Number of students |")
    lines.append("| `notes` | string | Additional notes |")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("*End of Report*")

    return "\n".join(lines)
