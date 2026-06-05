from __future__ import annotations

from njupt_search_eval.sitegraph_hot_query_eval import resolve_hot_query_entry
from njupt_search_eval.sitegraph_search import expand_query_phrases, shard_filter_proves_no_match
from njupt_search_eval.sitegraph_lower_bound_report import (
    DEFAULT_REPORT_QUERIES,
    LOWER_BOUND_GAP_LAYER_KEYS,
    build_lower_bound_report,
    render_markdown_report,
)
from njupt_search_indexer.sitegraph_shards import build_filter_bitset, proof_filter_tokens


def test_alias_expansion_does_not_trigger_broad_reverse_alias_inside_long_query() -> None:
    aliases = {
        "学生相关文件及表格": {"aliases": ["学生表格", "常用下载", "表格下载", "学生相关文件"]},
        "xlsx": {"aliases": ["xls", "Excel", "表格"]},
        "附件1": {"aliases": ["附件 1", "附件一"]},
        "成绩": {"aliases": ["成绩查询", "成绩单", "成绩复核"]},
    }

    student_form_phrases = expand_query_phrases("学生相关文件及表格", aliases)
    assert "学生相关文件及表格" in student_form_phrases
    assert "学生相关文件" in student_form_phrases
    assert "表格" not in student_form_phrases
    assert "xlsx" not in student_form_phrases
    assert "xls" not in student_form_phrases

    table_phrases = expand_query_phrases("表格", aliases)
    assert table_phrases == ["excel", "xlsx", "xls", "表格"]

    attachment_one_phrases = expand_query_phrases("附件1", aliases)
    assert set(attachment_one_phrases) == {"附件1", "附件一"}
    assert "附件" not in attachment_one_phrases

    attachment_phrases = expand_query_phrases("附件", aliases)
    assert attachment_phrases == ["附件"]

    score_phrases = expand_query_phrases("成绩", aliases)
    assert set(score_phrases) == {"成绩", "成绩查询", "成绩单", "成绩复核"}
    assert "绩点" not in score_phrases

    gpa_phrases = expand_query_phrases("绩点", aliases)
    assert gpa_phrases == ["绩点"]


def test_hot_query_entry_resolution_accepts_query_commands_but_not_unsafe_substrings() -> None:
    directory = {
        "queries": {
            "成绩": {
                "query": "成绩",
                "normalized_query": "成绩",
                "phrase_key": "成绩复核\0成绩查询\0成绩单\0成绩",
            },
            "校历": {
                "query": "校历",
                "normalized_query": "校历",
                "phrase_key": "教学周历\0教学日历\0校历",
            },
        }
    }

    assert resolve_hot_query_entry(directory, "查成绩") == directory["queries"]["成绩"]
    assert resolve_hot_query_entry(directory, "成绩查询") == directory["queries"]["成绩"]
    assert resolve_hot_query_entry(directory, "搜校历") == directory["queries"]["校历"]
    assert resolve_hot_query_entry(directory, "成绩造假") is None


def test_shard_filter_proves_no_match_when_phrase_token_is_absent() -> None:
    payload = {
        "shard-1": {
            **build_filter_bitset(["材料"], bit_count=2048, hash_count=1),
            "hash_algorithm": "bloom-fnv1a32-utf8",
        }
    }

    assert shard_filter_proves_no_match("shard-1", payload, ["材料提交"]) is True
    assert shard_filter_proves_no_match("shard-1", payload, ["材料"]) is False


def test_shard_filter_does_not_exclude_long_phrase_inside_longer_run() -> None:
    tokens = sorted(proof_filter_tokens("关于召开在线开放课程建设项目对接会的通知 xxmoocxx"))
    payload = {
        "shard-1": {
            **build_filter_bitset(tokens, bit_count=8192, hash_count=1),
            "hash_algorithm": "bloom-fnv1a32-utf8",
        }
    }

    assert shard_filter_proves_no_match("shard-1", payload, ["在线开放课程"]) is False
    assert shard_filter_proves_no_match("shard-1", payload, ["mooc"]) is False


def test_shard_filter_supports_plus_operator_phrase_without_false_negative() -> None:
    payload = {
        "with-plus": {
            **build_filter_bitset(sorted(proof_filter_tokens("中国国际 互联网 + 大学生创新创业大赛")), bit_count=8192, hash_count=1),
            "hash_algorithm": "bloom-fnv1a32-utf8",
        },
        "without-plus": {
            **build_filter_bitset(sorted(proof_filter_tokens("中国国际互联网大学生创新创业大赛")), bit_count=8192, hash_count=1),
            "hash_algorithm": "bloom-fnv1a32-utf8",
        },
    }

    assert shard_filter_proves_no_match("with-plus", payload, ["互联网+"]) is False
    assert shard_filter_proves_no_match("without-plus", payload, ["互联网+"]) is True


def test_lower_bound_report_contains_rerunnable_evidence() -> None:
    report = build_lower_bound_report(
        baseline_ref="1a0996e",
        queries=["校历", "图像采集码"],
        cache_queries=["校历"],
        include_quality=False,
        include_task=False,
        include_cache=True,
        include_local_body_benchmark=False,
        parse_runs=3,
    )

    assert report["report"] == "njupt-search-lower-bound-evidence-v1"
    assert report["runtime_contract"]["legacy_global_first_screen"] is False
    assert report["runtime_contract"]["startup_loads_local_indexes"] is False
    assert report["runtime_contract"]["completion_requires_ledger"] is True
    assert report["byte_comparison"]["routed_first_screen_total_bytes"]["current"] > 0
    assert report["current_size_snapshot"]["hot_query_proof_directory_bytes"] > 0
    assert report["current_size_snapshot"]["hot_query_topk_certificate_total_bytes"] > 0
    assert report["current_size_snapshot"]["hot_query_complete_certificate_total_bytes"] > 0
    assert report["parse_decode_benchmark"]["source_manifests"]["current"]["bytes"] > 0

    measurement = report["query_measurements"][0]
    assert measurement["query"] == "校历"
    assert measurement["coverage"]["exhaustive_complete"] is True
    assert measurement["coverage"]["pending_shards"] == 0
    assert measurement["proof_scan_pressure"]["true_match_shards"] >= 0
    assert measurement["proof_scan_pressure"]["false_positive_shards"] >= 0
    assert measurement["proof_scan_pressure"]["certificate_used"] is True
    assert measurement["proof_scan_pressure"]["certificate_bytes"] > 0
    assert measurement["proof_scan_pressure"]["matched_shard_bytes_avoided"] > 0
    assert measurement["hot_query_topk_certificate"]["used"] is True
    assert measurement["hot_query_topk_certificate"]["certificate_bytes"] > 0
    assert measurement["hot_query_complete_certificate"]["used"] is True
    assert measurement["hot_query_complete_certificate"]["certificate_bytes"] > 0
    assert (
        measurement["proof_scan_pressure"]["true_match_shards"]
        + measurement["proof_scan_pressure"]["false_positive_shards"]
        == measurement["coverage"]["scanned_shards"]
    )
    assert measurement["planner"]["selected_local_index_count"] == 0
    assert measurement["planner"]["phase_local_index_ids"]["first_trusted_results"] == []
    assert measurement["retrieval"]["dynamic_pruning"] is False
    assert measurement["phase_measurements"]["first_trusted_results"]["uncached_loaded_bytes"] <= 5 * 1024 * 1024
    assert measurement["phase_gate"]["passed"] is True
    assert report["query_measurement_summary"]["phase_gates_passed"] is True
    assert report["query_measurement_summary"]["max_proof_complete_uncached_bytes"] >= measurement["phase_gate"]["proof_complete_uncached_bytes"]
    assert "max_proof_true_match_query" in report["query_measurement_summary"]
    assert "max_proof_false_positive_query" in report["query_measurement_summary"]
    query_path_summary = report["query_path_parse_decode_benchmark"]["summary"]
    assert query_path_summary["passed"] is True
    assert query_path_summary["first_trusted_results"]["bytes_passed"] is True
    assert query_path_summary["top_results_hydrated"]["bytes_passed"] is True
    assert query_path_summary["first_trusted_results"]["decode_improved"] is True

    assert report["cache_benchmark"]["summary"]["passed"] is True
    assert report["cache_benchmark"]["summary"]["max_warm_uncached_bytes"] == 0
    assert report["dod_audit"]["6"]["status"] == "evidence_present"
    assert report["dod_audit"]["15"]["status"] == "evidence_present"

    gap_report = report["lower_bound_gap_report"]
    assert gap_report["missing_layers"] == []
    assert gap_report["required_layers"] == LOWER_BOUND_GAP_LAYER_KEYS
    assert set(gap_report["layers"]) == set(LOWER_BOUND_GAP_LAYER_KEYS)
    proof_gap_measurement = gap_report["layers"]["proof_complete_certificate_gap"]["current_measurement"]
    assert proof_gap_measurement["hot_query_proof_directory_bytes"] == report["current_size_snapshot"]["hot_query_proof_directory_bytes"]
    assert (
        proof_gap_measurement["hot_query_complete_certificate_total_bytes"]
        == report["current_size_snapshot"]["hot_query_complete_certificate_total_bytes"]
    )
    assert (
        proof_gap_measurement["hot_query_topk_certificate_total_bytes"]
        == report["current_size_snapshot"]["hot_query_topk_certificate_total_bytes"]
    )
    assert proof_gap_measurement["hot_query_certificate_used_count"] >= 1
    for layer in gap_report["layers"].values():
        assert layer["lower_bound_definition"]
        assert layer["current_measurement"]
        assert layer["gap_to_lower_bound"]
        assert layer["next_algorithmic_step"]
        assert layer["correctness_guard"]
        assert layer["stop_condition"]
        assert layer["evidence_refs"]

    markdown = render_markdown_report(report)
    assert "NJUPT Search Lower-Bound Evidence Report" in markdown
    assert "## Lower Bound Gap Report" in markdown
    assert "## Proof Scan Pressure" in markdown
    assert "`startup_entry_gap`" in markdown
    assert "`proof_complete_certificate_gap`" in markdown
    assert "DoD items remain unmet" in markdown


def test_default_lower_bound_queries_include_broad_goal_queries() -> None:
    required_queries = {
        "成绩",
        "查成绩",
        "成绩查询",
        "成绩复核申请表",
        "搜校历",
        "xlsx",
        "大创",
        "学科竞赛",
        "普通话考试",
        "挑战杯",
        "国家奖学金",
        "困难认定",
        "缓考申请表",
        "信息门户",
        "规章制度",
        "办事流程",
        "附件1",
        "互联网+",
    }

    assert required_queries.issubset(set(DEFAULT_REPORT_QUERIES))
