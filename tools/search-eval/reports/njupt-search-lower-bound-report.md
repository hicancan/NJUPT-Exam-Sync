# NJUPT Search Lower-Bound Evidence Report

- Generated at: `2026-06-02T12:59:01.290175+00:00`
- Collection: `apps/web/public/generated/collections/njupt-public`
- Baseline ref: `1a0996e`
- Current artifact generation: `2026-06-02T12:57:12.478511+00:00`

## Runtime Contract

| Contract | Value |
| --- | ---: |
| `legacy_global_first_screen` | `False` |
| `startup_loads_local_indexes` | `False` |
| `startup_loads_full_shards` | `False` |
| `startup_loads_global_document_metadata` | `False` |
| `directory_contains_doc_postings` | `False` |
| `completion_requires_ledger` | `True` |

## Byte Comparison

| Metric | Baseline | Current | Delta | Change |
| --- | ---: | ---: | ---: | ---: |
| `routed_first_screen_total_bytes` | 217,034 | 217,002 | -32 | -0.015% |
| `bootstrap_manifest_bytes` | 12,790 | 15,393 | 2,603 | 20.352% |
| `source_registry_bytes` | 4,405 | 4,804 | 399 | 9.058% |
| `global_query_directory_bytes` | 197,030 | 193,936 | -3,094 | -1.570% |
| `query_aliases_bytes` | 2,809 | 2,869 | 60 | 2.136% |
| `source_manifest_total_bytes` | 1,066,061 | 686,225 | -379,836 | -35.630% |
| `local_impact_light_index_total_bytes` | 28,563,086 | 0 | -28,563,086 | -100.000% |
| `local_impact_light_index_meta_total_bytes` | None | 11,962,895 | 11,962,895 |  |
| `local_impact_light_index_packed_total_bytes` | None | 9,006,665 | 9,006,665 |  |
| `local_impact_body_index_total_bytes` | 30,920,155 | 0 | -30,920,155 | -100.000% |
| `local_impact_body_index_packed_total_bytes` | None | 16,850,611 | 16,850,611 |  |
| `light_index_runtime_bytes` | None | 20,969,560 | 20,969,560 |  |
| `body_index_bytes` | 30,920,155 | 0 | -30,920,155 | -100.000% |
| `body_index_runtime_bytes` | None | 16,850,611 | 16,850,611 |  |
| `local_index_runtime_bytes` | None | 37,820,171 | 37,820,171 |  |
| `proof_catalog_total_bytes` | None | 736,838 | 736,838 |  |
| `shard_filter_total_bytes` | None | 6,037,127 | 6,037,127 |  |
| `proof_certificate_total_bytes` | None | 6,773,965 | 6,773,965 |  |
| `hot_query_proof_directory_bytes` | None | 78,006 | 78,006 |  |
| `hot_query_topk_certificate_total_bytes` | None | 5,233,912 | 5,233,912 |  |
| `hot_query_complete_certificate_total_bytes` | None | 56,607,734 | 56,607,734 |  |
| `full_scan_total_bytes` | 44,782,519 | 45,697,141 | 914,622 | 2.042% |
| `artifact_total_bytes` | 122,264,702 | 142,477,199 | 20,212,497 | 16.532% |
| `binary_artifact_total_bytes` | None | 25,857,276 | 25,857,276 |  |
| `runtime_artifact_total_bytes` | None | 168,334,475 | 168,334,475 |  |
| `artifact_count` | 1,465 | 1,266 | -199 | -13.584% |
| `binary_artifact_count` | None | 492 | 492 |  |
| `local_index_count` | 246 | 246 | 0 | 0.000% |
| `full_shard_count` | 942 | 942 | 0 | 0.000% |
| `max_full_shard_bytes` | 485,346 | 499,697 | 14,351 | 2.957% |
| `avg_full_shard_bytes` | 47,539 | 48,510 | 970 | 2.042% |

## Parse And Decode

| Family | Baseline bytes | Current bytes | Baseline mean ms | Current mean ms |
| --- | ---: | ---: | ---: | ---: |
| `bootstrap_json` | 217,034 | 217,002 | 0.893 | 0.961 |
| `source_manifests` | 1,066,061 | 686,225 | 3.859 | 2.329 |
| `shard_filters_json_and_bitsets` | 2,843,792 | 6,037,127 | 8.244 | 17.513 |
| `local_light_json` | 28,563,086 | 0 | 258.264 | 0.000 |
| `local_light_meta_json` | 0 | 11,962,895 | 0.000 | 40.126 |
| `local_light_packed` | 0 | 9,006,665 | 0.000 | 833.027 |
| `local_light_packed_query_terms` | 0 | 9,006,665 | 0.000 | 214.443 |
| `local_body_json` | 30,920,155 | 0 | 448.689 | 0.000 |
| `local_body_packed` | 0 | 16,850,611 | 0.000 | 1676.663 |
| `local_body_packed_query_terms` | 0 | 16,850,611 | 0.000 | 429.596 |

## Runtime Query-Term Decode Summary

- Baseline local-index runtime bytes: `59,483,241`
- Current local-index runtime bytes: `37,820,171`
- Runtime byte change: `-36.419%`
- Baseline local-index parse/decode mean: `706.953` ms
- Current query-term parse/decode mean: `684.165` ms
- Parse/decode change: `-3.223%`
- Light decode mode: `metadata_json_plus_packed_query_term_selective`
- Body decode mode: `packed_query_term_selective`

## Query Path Parse And Decode

| Phase | Mean baseline bytes | Mean current bytes | Byte change | Mean baseline ms | Mean current ms | Decode change | Byte gate | Decode within tolerance |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `first_trusted_results` | 0 | 0 | `None%` | 0.000 | 0.000 | `None%` | `True` | `True` |
| `top_results_hydrated` | 0 | 0 | `None%` | 0.000 | 0.000 | `None%` | `True` | `True` |
- Query-path byte gate passed: `True`. Decode timing is reported separately with tolerance `5.0%`.

## Rust/WASM Decision

- Decision: `rust_wasm_retrieval_runtime_selected`
- Winner for current runtime: `wasm_retrieval_session_scores_bridge`
- TypeScript decode mean ms: `645.327`
- WASM materialized decode mean ms: `685.090`
- WASM stats-only decode mean ms: `43.046`
- TypeScript retrieval kernel mean ms: `3360.691`
- WASM stateless retrieval kernel mean ms: `470.565`
- WASM stateful retrieval session mean ms: `587.936`
- WASM stateful retrieval score bridge mean ms: `587.416`
- Reason: The browser runtime can consume Rust/WASM stateful score entries directly. On the full packed body workload, the Rust/WASM session score bridge was 0.175x the TypeScript selective retrieval kernel for the same artifact format, query set, and global top-k pruning state.

## Query Measurements

| Query | ms | Results | Candidate shards | Loaded shards | Uncached bytes | Pruned postings | Complete | Top result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `校历` | 34.519 | 12 | 0 | 0 | 672,784 | 0 | `True` | 2025-2026学年校历 |
| `慕课考试` | 90.382 | 12 | 0 | 0 | 1,779,566 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期在线开放课程（慕课）线下考试报名通知 |
| `期末考试` | 166.419 | 12 | 0 | 0 | 3,460,809 | 0 | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期期末考试工作安排的通知 |
| `考试安排` | 165.690 | 12 | 0 | 0 | 3,460,809 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期考试安排表 |
| `选课` | 132.933 | 12 | 0 | 0 | 2,806,259 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生课程补改选及重修选课的通知 |
| `转专业` | 54.226 | 12 | 0 | 0 | 1,109,666 | 0 | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期全日制本科生转专业工作的通知 |
| `成绩` | 362.292 | 12 | 0 | 0 | 6,730,113 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `xlsx` | 335.423 | 12 | 0 | 0 | 7,903,421 | 0 | `True` | 关于举办第十二届全国大学生物理实验竞赛（创新）校内选拔赛的通知 |
| `大创` | 220.635 | 12 | 0 | 0 | 3,683,729 | 0 | `True` | 2024年度大学生创新创业训练计划项目结题验收成绩公示 |
| `推免` | 30.968 | 12 | 0 | 0 | 624,851 | 0 | `True` | 2026年各学院推荐优秀应届本科毕业生免试攻读研究生工作方案 |
| `助学金` | 112.785 | 12 | 0 | 0 | 2,168,388 | 0 | `True` | 校学发〔2024〕7号南京邮电大学“鼓楼区绿色低碳奖助学金”实施细则（试行） |
| `心理健康` | 33.244 | 12 | 0 | 0 | 688,983 | 0 | `True` | 心理健康 |
| `学工` | 352.385 | 12 | 0 | 0 | 5,962,411 | 0 | `True` | 南京工业大学浦江学院学工处来校调研 |
| `竞赛报名` | 97.949 | 12 | 0 | 0 | 1,669,266 | 0 | `True` | 关于举办“2026年南京邮电大学集成电路创新创业校选拔赛”的通知 |
| `规章制度` | 257.290 | 12 | 0 | 0 | 4,817,671 | 0 | `True` | 南京邮电大学本科教材供应管理办法 2024-04-26 |
| `办事流程` | 152.205 | 12 | 0 | 0 | 2,582,028 | 0 | `True` | 服兵役学生国家教育资助申请流程 |
| `学生相关文件及表格` | 18.479 | 12 | 0 | 0 | 497,909 | 0 | `True` | 南京邮电大学学生毕业申请表 2026-04-16 |
| `教务管理系统` | 162.789 | 12 | 0 | 0 | 3,110,156 | 0 | `True` | 教务管理系统 |
| `附件1` | 377.188 | 12 | 0 | 0 | 6,713,698 | 0 | `True` | 【科创竞赛】第九届“外教社杯”全国高校学生跨文化能力大赛南京邮电大学校园赛通知 |
| `奖学金` | 138.441 | 12 | 0 | 0 | 2,035,266 | 0 | `True` | 南京邮电大学2024-2025学年“甘霖励志奖学金”拟推荐名单公示 |
| `辅导员` | 243.786 | 12 | 0 | 0 | 3,102,003 | 0 | `True` | 红色校史润心田，南邮精神永相传 —— 第四届辅导员宣讲团 走进教育科学与技术学院 |
| `双创` | 46.195 | 12 | 0 | 0 | 595,204 | 0 | `True` | 双创信息管理系统 |
| `互联网+` | 63.609 | 12 | 0 | 0 | 841,642 | 0 | `True` | 南京邮电大学第五届 “互联网+”大学生创新创业大赛成绩公示 |
| `不存在的查询词` | 1.322 | 0 | 0 | 0 | 79,961 | 0 | `True` |  |

## Proof Scan Pressure

| Query | Certificate | Certificate bytes | Avoided match-shard bytes | True-match shards | False-positive shards | True-match bytes | False-positive bytes | False-positive byte ratio | True-match docs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `校历` | `True` | 395,036 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `慕课考试` | `True` | 1,502,048 | 16,369,972 | 153 | 0 | 0 | 0 | 0.000 | 433 |
| `期末考试` | `True` | 3,268,693 | 18,292,284 | 147 | 0 | 0 | 0 | 0.000 | 1,019 |
| `考试安排` | `True` | 3,268,693 | 18,292,284 | 147 | 0 | 0 | 0 | 0.000 | 1,019 |
| `选课` | `True` | 2,533,286 | 28,449,319 | 283 | 0 | 0 | 0 | 0.000 | 762 |
| `转专业` | `True` | 805,312 | 18,027,905 | 160 | 0 | 0 | 0 | 0.000 | 205 |
| `成绩` | `True` | 6,544,456 | 39,611,186 | 555 | 0 | 0 | 0 | 0.000 | 2,115 |
| `xlsx` | `True` | 7,743,858 | 31,369,152 | 430 | 0 | 0 | 0 | 0.000 | 2,308 |
| `大创` | `True` | 3,423,448 | 35,229,951 | 471 | 0 | 0 | 0 | 0.000 | 1,075 |
| `推免` | `True` | 392,041 | 9,614,587 | 93 | 0 | 0 | 0 | 0.000 | 107 |
| `助学金` | `True` | 1,891,132 | 25,151,907 | 255 | 0 | 0 | 0 | 0.000 | 505 |
| `心理健康` | `True` | 505,583 | 9,997,202 | 92 | 0 | 0 | 0 | 0.000 | 167 |
| `学工` | `True` | 5,764,648 | 39,139,569 | 539 | 0 | 0 | 0 | 0.000 | 1,909 |
| `竞赛报名` | `True` | 1,330,324 | 12,765,067 | 196 | 0 | 0 | 0 | 0.000 | 303 |
| `规章制度` | `True` | 4,575,010 | 20,384,439 | 256 | 0 | 0 | 0 | 0.000 | 1,238 |
| `办事流程` | `True` | 2,399,339 | 22,295,754 | 230 | 0 | 0 | 0 | 0.000 | 755 |
| `学生相关文件及表格` | `True` | 332,535 | 1,480,594 | 53 | 0 | 0 | 0 | 0.000 | 107 |
| `教务管理系统` | `True` | 2,869,594 | 19,575,598 | 161 | 0 | 0 | 0 | 0.000 | 797 |
| `附件1` | `True` | 6,381,008 | 28,246,384 | 330 | 0 | 0 | 0 | 0.000 | 1,536 |
| `奖学金` | `True` | 1,773,594 | 25,117,516 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `辅导员` | `True` | 2,888,477 | 21,376,292 | 250 | 0 | 0 | 0 | 0.000 | 1,094 |
| `双创` | `True` | 359,017 | 3,776,381 | 72 | 0 | 0 | 0 | 0.000 | 93 |
| `互联网+` | `True` | 644,438 | 12,899,247 | 150 | 0 | 0 | 0 | 0.000 | 222 |
| `不存在的查询词` | `True` | 78,995 | 0 | 0 | 0 | 0 | 0 | 0.000 | 0 |

## Phase Gates

| Query | First trusted bytes | First trusted ms | Top hydrated bytes | Top hydrated ms | Proof bytes | Passed |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `校历` | 355,754 | 15.796 | 355,754 | 15.796 | 672,784 | `True` |
| `慕课考试` | 355,524 | 14.473 | 355,524 | 14.473 | 1,779,566 | `True` |
| `期末考试` | 270,122 | 9.337 | 270,122 | 9.337 | 3,460,809 | `True` |
| `考试安排` | 270,122 | 9.173 | 270,122 | 9.173 | 3,460,809 | `True` |
| `选课` | 350,979 | 12.794 | 350,979 | 12.794 | 2,806,259 | `True` |
| `转专业` | 382,360 | 14.815 | 382,360 | 14.815 | 1,109,666 | `True` |
| `成绩` | 263,663 | 10.511 | 263,663 | 10.511 | 6,730,113 | `True` |
| `xlsx` | 237,569 | 6.985 | 237,569 | 6.985 | 7,903,421 | `True` |
| `大创` | 338,287 | 14.199 | 338,287 | 14.199 | 3,683,729 | `True` |
| `推免` | 310,816 | 13.383 | 310,816 | 13.383 | 624,851 | `True` |
| `助学金` | 355,262 | 14.790 | 355,262 | 14.790 | 2,168,388 | `True` |
| `心理健康` | 261,406 | 10.030 | 261,406 | 10.030 | 688,983 | `True` |
| `学工` | 275,769 | 14.849 | 275,769 | 14.849 | 5,962,411 | `True` |
| `竞赛报名` | 416,948 | 20.864 | 416,948 | 20.864 | 1,669,266 | `True` |
| `规章制度` | 320,667 | 12.556 | 320,667 | 12.556 | 4,817,671 | `True` |
| `办事流程` | 260,695 | 11.371 | 260,695 | 11.371 | 2,582,028 | `True` |
| `学生相关文件及表格` | 243,380 | 7.317 | 243,380 | 7.317 | 497,909 | `True` |
| `教务管理系统` | 318,568 | 11.898 | 318,568 | 11.898 | 3,110,156 | `True` |
| `附件1` | 410,696 | 16.476 | 410,696 | 16.476 | 6,713,698 | `True` |
| `奖学金` | 339,678 | 20.548 | 339,678 | 20.548 | 2,035,266 | `True` |
| `辅导员` | 291,532 | 15.393 | 291,532 | 15.393 | 3,102,003 | `True` |
| `双创` | 314,193 | 21.443 | 314,193 | 21.443 | 595,204 | `True` |
| `互联网+` | 275,210 | 16.641 | 275,210 | 16.641 | 841,642 | `True` |
| `不存在的查询词` | 78,972 | 1.096 | 78,972 | 1.096 | 79,961 | `True` |

- First trusted hard gate: `<=5,242,880` bytes or `<=10%` of proof bytes.
- Top hydrated hard gate: `<=10,485,760` bytes or `<=25%` of proof bytes.
- Phase gates passed: `True`

## Cache Benchmark

- Query count: `8`
- Max cold uncached bytes: `3,683,729`
- Max warm uncached bytes: `0`
- Total warm cached bytes: `13,593,085`
- Passed: `True`

## Browser Verification

- Passed: `True`
- Persistent cache passed: `True`
- Viewports: `[]`
- Scenario count: `None`
- Max warm uncached immutable bytes: `None`

## Lower Bound Gap Report

- Objective: Minimize query-dependent bytes and decode work while preserving trusted top-k answers and exhaustive proof semantics.
- Claim boundary: Engineering gates can be passed without proving the mathematical lower bound; the gap entries identify what proof or algorithm is still missing.

| Layer | Status | Current measurement | Gap | Next algorithmic step |
| --- | --- | --- | --- | --- |
| `startup_entry_gap` | `engineering_gate_passed_not_absolute` | {"routed_first_screen_total_bytes": 217002, "bootstrap_manifest_bytes": 15393, "source_registry_bytes": 4804, "global_query_directory_bytes": 193936, "query_aliases_bytes": 2869, "startup_loads_local_indexes": false, "startup_loads_full_shards": false} | Metadata is already separated from local indexes and full shards, but the routed entry payload is still a practical JSON contract rather than an entropy-coded minimal decision table. | Delta-code source/query routing tables and measure whether a compact finite-state router beats the current manifest plus directory bytes without hurting debuggability. |
| `route_planning_gap` | `phase_gate_passed` | {"query_count": 24, "max_candidate_shard_count": 0, "max_loaded_shard_count": 0, "max_uncached_loaded_bytes": 7903421, "phase_gates_passed": true} | The planner emits expected byte costs and phase-local selections, but the route policy is still hand-calibrated rather than learned from an optimal decision rule. | Fit an offline decision policy on the evaluation corpus with byte cost as the Lagrange multiplier, then keep only policies that preserve task quality. |
| `first_trusted_gap` | `phase_gate_passed` | {"max_first_trusted_uncached_bytes": 416948, "absolute_limit_bytes": 5242880, "max_first_trusted_elapsed_ms": 21.443, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | The phase is byte-gated and query-path decode improved versus baseline, but the remaining gap is proving that no loaded local-index byte is irrelevant to the first trusted result. | Add per-term contribution accounting for first-result eligibility and drop zero-contribution term blocks. |
| `top_results_hydrated_gap` | `phase_gate_passed` | {"max_top_results_uncached_bytes": 416948, "absolute_limit_bytes": 10485760, "max_top_results_elapsed_ms": 21.443, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | Top results are separated from proof completion, but candidate upper bounds are not yet serialized as a formal certificate that every skipped block is dominated. | Persist block-level score upper bounds and emit a top-k dominance certificate for skipped blocks. |
| `proof_complete_certificate_gap` | `largest_remaining_theoretical_gap` | {"max_proof_complete_uncached_bytes": 7903421, "max_proof_complete_elapsed_ms": 376.154, "proof_catalog_total_bytes": 736838, "shard_filter_total_bytes": 6037127, "proof_certificate_total_bytes": 6773965, "hot_query_proof_directory_bytes": 78006, "hot_query... | Correctness is complete, but proof completion can still approach a full-shard read. The mathematical lower bound is a certificate stream, not full document hydration. | Separate false-positive filter pressure from true-match shard pressure, then generate doc/postings or hot-query certificates for true-match-heavy broad queries. |
| `full_shard_dependency_gap` | `known_remaining_dependency` | {"full_scan_total_bytes": 45697141, "proof_certificate_total_bytes": 6773965, "max_full_shard_bytes": 499697, "full_shard_count": 942, "max_proof_complete_uncached_bytes": 7903421} | The serving path no longer depends on full shards for startup or early results, but exhaustive proof still has a full-shard fallback. | Split proof certificates from full document bodies and make full bodies lazy even during proof completion. |
| `packed_index_decode_gap` | `query_path_gate_passed` | {"local_index_runtime_bytes": 37820171, "binary_artifact_total_bytes": 25857276, "runtime_byte_change_percent": -36.419, "runtime_decode_change_percent": -3.223, "query_path_passed": true, "body_decode_mode": "packed_query_term_selective", "light_decode_mod... | Packed selective decode is active on the hot query path, but block metadata is still decoded at artifact granularity rather than at the exact surviving term/block frontier. | Move to block directory offsets with direct term/block seeks and SIMD/WASM-friendly score scans. |
| `topk_pruning_gap` | `needs_attention` | {"any_dynamic_pruning": false, "total_postings_pruned": 0, "wasm_decision_status": "rust_wasm_retrieval_runtime_selected"} | Dynamic pruning is present, but the report does not yet prove that the pruning order is optimal for every query under the scoring function. | Record WAND/BMW-style upper-bound ledgers per query and compare visited postings against an oracle ordering. |
| `persistent_cache_gap` | `warm_cache_gate_passed` | {"cache_query_count": 8, "max_cold_uncached_bytes": 3683729, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 13593085, "browser_persistent_cache_passed": true} | Warm network bytes are gated locally; remaining lower-bound work is CPU decode reuse and browser-level confirmation when a browser report is missing. | Persist decoded packed-index pages and reuse score-session state across repeated same-version queries. |
| `attachment_semantics_gap` | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8094, "metadata_only": 8094, "filename_only": 8094, "text_extracted": 0... | Attachment evidence is summarized, but there is no per-query proof that the summary is the minimal sufficient statistic for attachment relevance. | Add query-term-to-attachment-evidence attribution and measure dropped attachment fields against task quality. |
| `ranking_calibration_gap` | `task_quality_gate_present` | {"quality_eval_skipped": null, "task_eval_skipped": null, "task_eval_passed": 29, "expectation_count": 29, "max_elapsed_ms": 377.188} | Quality gates exist, but ranking weights are still an engineered policy rather than a Pareto-optimal model over relevance, trust, recency, and byte cost. | Run ablations over ranking features and fit byte-aware weights that stay on the quality Pareto frontier. |
| `browser_resource_gap` | `browser_verified` | {"browser_report_missing": false, "passed": true, "persistent_cache_passed": true, "viewports": null, "scenario_count": null, "max_warm_uncached_immutable_bytes": null} | Browser verification is recorded only when the external browser report is present; the CLI report must not claim final browser lower-bound evidence without it. | Keep browser automation as a mandatory artifact and compare network/resource traces per phase. |

## Quality

- Smoke eval: `passed`
- Task eval: `29/29`

## Attachment Evidence

- Policy: `metadata_and_filename_only_no_extracted_attachment_content`
- Coverage: `{"total": 8094, "metadata_only": 8094, "filename_only": 8094, "text_extracted": 0, "snippet": 0, "full_content": 0}`

## Definition Of Done Audit

| Item | Status | Evidence |
| ---: | --- | --- |
| 1 | `evidence_present` | {"legacy_global_first_screen": false, "startup_loads_local_indexes": false, "startup_loads_full_shards": false, "startup_loads_global_document_metadata": false, "directory_contains_doc_postings": false, "completion_requires_ledger": true} |
| 2 | `evidence_present` | {"planner": "Planner telemetry includes route expected_cost_bytes, selected expected_uncached bytes, cache state per local index, and phase-specific local index selections.", "max_first_trusted_uncached_bytes": 416948, "first_trusted_absolu |
| 3 | `needs_attention` | {"any_dynamic_pruning": false, "total_postings_pruned": 0} |
| 4 | `evidence_present` | Measured queries report proof ledger complete with zero pending/failed shards; runtime tests cover no-match proof, failed shard refusal, and cancelled pending-ledger refusal. |
| 5 | `partial` | {"artifact_total_bytes_current": 142477199, "artifact_total_bytes_baseline": 122264702, "runtime_parse_decode_summary": {"baseline_local_index_runtime_bytes": 59483241, "current_local_index_runtime_bytes": 37820171, "bytes_delta": -21663070 |
| 6 | `evidence_present` | {"light_json_bytes": 0, "light_split_runtime_bytes": 20969560, "body_json_bytes": 0, "body_packed_runtime_bytes": 16850611, "note": "Packed binary light terms plus metadata JSON are used for query planning; packed binary light/body indexes  |
| 7 | `evidence_present` | {"artifact_count": 246, "benchmark": "packed-impact-retrieval-wasm-vs-typescript-v2", "collection": "apps/web/public/generated/collections/njupt-public", "decision": {"reason": "The browser runtime can consume Rust/WASM stateful score entri |
| 8 | `evidence_present` | {"query_count": 8, "max_cold_uncached_bytes": 3683729, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 13593085, "max_warm_ms": 273.061, "passed": true, "failure_count": 0, "cache_invalidation_test": "Changed content-hash artifact  |
| 9 | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8094, "metadata_only": 8094, "filename_only": 8094, "t |
| 10 | `evidence_present` | Smoke queries, task queries, measured cold queries, warm cache queries, and a negative query are represented when full report mode is used. |
| 11 | `evidence_present` | {"report": "njupt-search-browser-verification-v12-scoped-hot-complete-certificate", "generated_at": "2026-06-02T09:38:48.274Z", "run_started_at": "2026-06-02T09:38:26.543Z", "app_url": "http://127.0.0.1:5187/", "dev_server": {"host": "127.0 |
| 12 | `external_ci_deploy_required` | Local validators/tests/builds can be recorded separately; CI/deployment status is outside this local report. |
| 13 | `evidence_present` | This report includes byte, time, quality, cache, pruning, parse/decode, and coverage sections. |
| 14 | `unmet` | Commit, push, CI, and deployment checks are intentionally not claimed by this report. |
| 15 | `evidence_present` | {"required_layers": ["startup_entry_gap", "route_planning_gap", "first_trusted_gap", "top_results_hydrated_gap", "proof_complete_certificate_gap", "full_shard_dependency_gap", "packed_index_decode_gap", "topk_pruning_gap", "persistent_cache |

## Reproduction

```powershell
uv run --python 3.13 python -m njupt_search_eval run-lower-bound-report --baseline-ref 1a0996e --collection apps\web\public\generated\collections\njupt-public --output tools\search-eval\reports\njupt-search-lower-bound-report.json --markdown tools\search-eval\reports\njupt-search-lower-bound-report.md
```

This report is evidence for the active lower-bound goal. It does not claim final completion while DoD items remain unmet.
