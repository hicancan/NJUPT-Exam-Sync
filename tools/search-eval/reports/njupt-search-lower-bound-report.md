# NJUPT Search Lower-Bound Evidence Report

- Generated at: `2026-06-02T14:58:47.065303+00:00`
- Collection: `apps/web/public/generated/collections/njupt-public`
- Baseline ref: `1a0996e`
- Current artifact generation: `2026-06-02T13:12:24.656507+00:00`

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
| `routed_first_screen_total_bytes` | 217,034 | 217,046 | 12 | 0.006% |
| `bootstrap_manifest_bytes` | 12,790 | 15,422 | 2,632 | 20.579% |
| `source_registry_bytes` | 4,405 | 4,805 | 400 | 9.081% |
| `global_query_directory_bytes` | 197,030 | 193,950 | -3,080 | -1.563% |
| `query_aliases_bytes` | 2,809 | 2,869 | 60 | 2.136% |
| `source_manifest_total_bytes` | 1,066,061 | 686,226 | -379,835 | -35.630% |
| `local_impact_light_index_total_bytes` | 28,563,086 | 0 | -28,563,086 | -100.000% |
| `local_impact_light_index_meta_total_bytes` | None | 11,967,576 | 11,967,576 |  |
| `local_impact_light_index_packed_total_bytes` | None | 9,008,869 | 9,008,869 |  |
| `local_impact_body_index_total_bytes` | 30,920,155 | 0 | -30,920,155 | -100.000% |
| `local_impact_body_index_packed_total_bytes` | None | 16,853,799 | 16,853,799 |  |
| `light_index_runtime_bytes` | None | 20,976,445 | 20,976,445 |  |
| `body_index_bytes` | 30,920,155 | 0 | -30,920,155 | -100.000% |
| `body_index_runtime_bytes` | None | 16,853,799 | 16,853,799 |  |
| `local_index_runtime_bytes` | None | 37,830,244 | 37,830,244 |  |
| `proof_catalog_total_bytes` | None | 736,839 | 736,839 |  |
| `shard_filter_total_bytes` | None | 6,037,127 | 6,037,127 |  |
| `proof_certificate_total_bytes` | None | 6,773,966 | 6,773,966 |  |
| `hot_query_proof_directory_bytes` | None | 78,006 | 78,006 |  |
| `hot_query_topk_certificate_total_bytes` | None | 5,234,786 | 5,234,786 |  |
| `hot_query_complete_certificate_total_bytes` | None | 56,634,490 | 56,634,490 |  |
| `full_scan_total_bytes` | 44,782,519 | 45,712,710 | 930,191 | 2.077% |
| `artifact_total_bytes` | 122,264,702 | 142,536,624 | 20,271,922 | 16.580% |
| `binary_artifact_total_bytes` | None | 25,862,668 | 25,862,668 |  |
| `runtime_artifact_total_bytes` | None | 168,399,292 | 168,399,292 |  |
| `artifact_count` | 1,465 | 1,266 | -199 | -13.584% |
| `binary_artifact_count` | None | 492 | 492 |  |
| `local_index_count` | 246 | 246 | 0 | 0.000% |
| `full_shard_count` | 942 | 942 | 0 | 0.000% |
| `max_full_shard_bytes` | 485,346 | 499,697 | 14,351 | 2.957% |
| `avg_full_shard_bytes` | 47,539 | 48,527 | 987 | 2.077% |

## Parse And Decode

| Family | Baseline bytes | Current bytes | Baseline mean ms | Current mean ms |
| --- | ---: | ---: | ---: | ---: |
| `bootstrap_json` | 217,034 | 217,514 | 0.713 | 0.850 |
| `source_manifests` | 1,066,061 | 701,999 | 3.085 | 1.926 |
| `shard_filters_json_and_bitsets` | 2,843,792 | 6,037,127 | 7.803 | 15.983 |
| `local_light_json` | 28,563,086 | 0 | 224.851 | 0.000 |
| `local_light_meta_json` | 0 | 11,967,576 | 0.000 | 33.785 |
| `local_light_packed` | 0 | 9,008,869 | 0.000 | 741.266 |
| `local_light_packed_query_terms` | 0 | 9,008,869 | 0.000 | 194.937 |
| `local_body_json` | 30,920,155 | 0 | 361.998 | 0.000 |
| `local_body_packed` | 0 | 16,853,799 | 0.000 | 1494.983 |
| `local_body_packed_query_terms` | 0 | 16,853,799 | 0.000 | 362.839 |

## Runtime Query-Term Decode Summary

- Baseline local-index runtime bytes: `59,483,241`
- Current local-index runtime bytes: `37,830,244`
- Runtime byte change: `-36.402%`
- Baseline local-index parse/decode mean: `586.849` ms
- Current query-term parse/decode mean: `591.561` ms
- Parse/decode change: `0.803%`
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
| `校历` | 33.081 | 12 | 0 | 0 | 672,784 | 0 | `True` | 2025-2026学年校历 |
| `搜校历` | 32.376 | 12 | 0 | 0 | 672,784 | 0 | `True` | 2025-2026学年校历 |
| `慕课考试` | 91.479 | 12 | 0 | 0 | 1,779,566 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期在线开放课程（慕课）线下考试报名通知 |
| `期末考试` | 167.177 | 12 | 0 | 0 | 3,471,086 | 0 | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期期末考试工作安排的通知 |
| `考试安排` | 164.621 | 12 | 0 | 0 | 3,471,086 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期考试安排表 |
| `选课` | 129.295 | 12 | 0 | 0 | 2,806,259 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生课程补改选及重修选课的通知 |
| `转专业` | 52.428 | 12 | 0 | 0 | 1,109,666 | 0 | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期全日制本科生转专业工作的通知 |
| `成绩` | 350.777 | 12 | 0 | 0 | 6,732,496 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `查成绩` | 355.323 | 12 | 0 | 0 | 6,732,496 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩查询` | 353.735 | 12 | 0 | 0 | 6,732,496 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `xlsx` | 333.806 | 12 | 0 | 0 | 7,911,271 | 0 | `True` | 关于举办第十二届全国大学生物理实验竞赛（创新）校内选拔赛的通知 |
| `大创` | 218.673 | 12 | 0 | 0 | 3,683,732 | 0 | `True` | 2024年度大学生创新创业训练计划项目结题验收成绩公示 |
| `推免` | 31.195 | 12 | 0 | 0 | 628,844 | 0 | `True` | 2026年各学院推荐优秀应届本科毕业生免试攻读研究生工作方案 |
| `助学金` | 110.269 | 12 | 0 | 0 | 2,168,388 | 0 | `True` | 校学发〔2024〕7号南京邮电大学“鼓楼区绿色低碳奖助学金”实施细则（试行） |
| `心理健康` | 32.172 | 12 | 0 | 0 | 688,983 | 0 | `True` | 心理健康 |
| `学工` | 347.554 | 12 | 0 | 0 | 5,962,412 | 0 | `True` | 南京工业大学浦江学院学工处来校调研 |
| `竞赛报名` | 97.152 | 12 | 0 | 0 | 1,669,267 | 0 | `True` | 关于举办“2026年南京邮电大学集成电路创新创业校选拔赛”的通知 |
| `规章制度` | 255.103 | 12 | 0 | 0 | 4,817,671 | 0 | `True` | 南京邮电大学本科教材供应管理办法 2024-04-26 |
| `办事流程` | 150.582 | 12 | 0 | 0 | 2,585,148 | 0 | `True` | 服兵役学生国家教育资助申请流程 |
| `学生相关文件及表格` | 18.449 | 12 | 0 | 0 | 497,909 | 0 | `True` | 南京邮电大学学生毕业申请表 2026-04-16 |
| `教务管理系统` | 160.206 | 12 | 0 | 0 | 3,110,156 | 0 | `True` | 教务管理系统 |
| `附件1` | 302.240 | 12 | 0 | 0 | 6,713,700 | 0 | `True` | 【科创竞赛】第九届“外教社杯”全国高校学生跨文化能力大赛南京邮电大学校园赛通知 |
| `奖学金` | 104.979 | 12 | 0 | 0 | 2,035,266 | 0 | `True` | 南京邮电大学2024-2025学年“甘霖励志奖学金”拟推荐名单公示 |
| `辅导员` | 189.109 | 12 | 0 | 0 | 3,102,003 | 0 | `True` | 红色校史润心田，南邮精神永相传 —— 第四届辅导员宣讲团 走进教育科学与技术学院 |
| `双创` | 36.304 | 12 | 0 | 0 | 595,204 | 0 | `True` | 双创信息管理系统 |
| `互联网+` | 47.288 | 12 | 0 | 0 | 841,642 | 0 | `True` | 南京邮电大学第五届 “互联网+”大学生创新创业大赛成绩公示 |
| `不存在的查询词` | 1.098 | 0 | 0 | 0 | 79,961 | 0 | `True` |  |

## Proof Scan Pressure

| Query | Certificate | Certificate bytes | Avoided match-shard bytes | True-match shards | False-positive shards | True-match bytes | False-positive bytes | False-positive byte ratio | True-match docs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `校历` | `True` | 395,036 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `搜校历` | `True` | 395,036 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `慕课考试` | `True` | 1,502,048 | 16,376,012 | 153 | 0 | 0 | 0 | 0.000 | 433 |
| `期末考试` | `True` | 3,278,970 | 18,333,088 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `考试安排` | `True` | 3,278,970 | 18,333,088 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `选课` | `True` | 2,533,286 | 28,458,652 | 283 | 0 | 0 | 0 | 0.000 | 762 |
| `转专业` | `True` | 805,312 | 18,027,905 | 160 | 0 | 0 | 0 | 0.000 | 205 |
| `成绩` | `True` | 6,546,839 | 39,620,522 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `查成绩` | `True` | 6,546,839 | 39,620,522 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `成绩查询` | `True` | 6,546,839 | 39,620,522 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `xlsx` | `True` | 7,751,708 | 31,382,687 | 430 | 0 | 0 | 0 | 0.000 | 2,310 |
| `大创` | `True` | 3,423,451 | 35,235,089 | 471 | 0 | 0 | 0 | 0.000 | 1,075 |
| `推免` | `True` | 395,160 | 9,648,543 | 94 | 0 | 0 | 0 | 0.000 | 108 |
| `助学金` | `True` | 1,891,132 | 25,151,907 | 255 | 0 | 0 | 0 | 0.000 | 505 |
| `心理健康` | `True` | 505,583 | 9,997,202 | 92 | 0 | 0 | 0 | 0.000 | 167 |
| `学工` | `True` | 5,764,649 | 39,150,454 | 539 | 0 | 0 | 0 | 0.000 | 1,909 |
| `竞赛报名` | `True` | 1,330,325 | 12,765,068 | 196 | 0 | 0 | 0 | 0.000 | 303 |
| `规章制度` | `True` | 4,575,010 | 20,388,638 | 256 | 0 | 0 | 0 | 0.000 | 1,238 |
| `办事流程` | `True` | 2,402,459 | 22,300,599 | 230 | 0 | 0 | 0 | 0.000 | 756 |
| `学生相关文件及表格` | `True` | 332,535 | 1,480,594 | 53 | 0 | 0 | 0 | 0.000 | 107 |
| `教务管理系统` | `True` | 2,869,594 | 19,580,088 | 161 | 0 | 0 | 0 | 0.000 | 797 |
| `附件1` | `True` | 6,381,010 | 28,253,234 | 330 | 0 | 0 | 0 | 0.000 | 1,536 |
| `奖学金` | `True` | 1,773,594 | 25,117,516 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `辅导员` | `True` | 2,888,477 | 21,380,491 | 250 | 0 | 0 | 0 | 0.000 | 1,094 |
| `双创` | `True` | 359,017 | 3,781,225 | 72 | 0 | 0 | 0 | 0.000 | 93 |
| `互联网+` | `True` | 644,438 | 12,904,091 | 150 | 0 | 0 | 0 | 0.000 | 222 |
| `不存在的查询词` | `True` | 78,995 | 0 | 0 | 0 | 0 | 0 | 0.000 | 0 |

## Phase Gates

| Query | First trusted bytes | First trusted ms | Top hydrated bytes | Top hydrated ms | Proof bytes | Passed |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `校历` | 355,754 | 15.735 | 355,754 | 15.735 | 672,784 | `True` |
| `搜校历` | 355,754 | 15.157 | 355,754 | 15.157 | 672,784 | `True` |
| `慕课考试` | 355,524 | 14.546 | 355,524 | 14.546 | 1,779,566 | `True` |
| `期末考试` | 270,122 | 9.929 | 270,122 | 9.929 | 3,471,086 | `True` |
| `考试安排` | 270,122 | 8.950 | 270,122 | 8.950 | 3,471,086 | `True` |
| `选课` | 350,979 | 12.707 | 350,979 | 12.707 | 2,806,259 | `True` |
| `转专业` | 382,360 | 14.736 | 382,360 | 14.736 | 1,109,666 | `True` |
| `成绩` | 263,663 | 10.190 | 263,663 | 10.190 | 6,732,496 | `True` |
| `查成绩` | 263,663 | 10.518 | 263,663 | 10.518 | 6,732,496 | `True` |
| `成绩查询` | 263,663 | 10.342 | 263,663 | 10.342 | 6,732,496 | `True` |
| `xlsx` | 237,569 | 6.725 | 237,569 | 6.725 | 7,911,271 | `True` |
| `大创` | 338,287 | 14.529 | 338,287 | 14.529 | 3,683,732 | `True` |
| `推免` | 311,690 | 13.185 | 311,690 | 13.185 | 628,844 | `True` |
| `助学金` | 355,262 | 14.840 | 355,262 | 14.840 | 2,168,388 | `True` |
| `心理健康` | 261,406 | 10.021 | 261,406 | 10.021 | 688,983 | `True` |
| `学工` | 275,769 | 12.869 | 275,769 | 12.869 | 5,962,412 | `True` |
| `竞赛报名` | 416,948 | 20.511 | 416,948 | 20.511 | 1,669,267 | `True` |
| `规章制度` | 320,667 | 12.276 | 320,667 | 12.276 | 4,817,671 | `True` |
| `办事流程` | 260,695 | 11.448 | 260,695 | 11.448 | 2,585,148 | `True` |
| `学生相关文件及表格` | 243,380 | 7.041 | 243,380 | 7.041 | 497,909 | `True` |
| `教务管理系统` | 318,568 | 12.151 | 318,568 | 12.151 | 3,110,156 | `True` |
| `附件1` | 410,696 | 16.815 | 410,696 | 16.815 | 6,713,700 | `True` |
| `奖学金` | 339,678 | 14.039 | 339,678 | 14.039 | 2,035,266 | `True` |
| `辅导员` | 291,532 | 14.420 | 291,532 | 14.420 | 3,102,003 | `True` |
| `双创` | 314,193 | 15.639 | 314,193 | 15.639 | 595,204 | `True` |
| `互联网+` | 275,210 | 12.155 | 275,210 | 12.155 | 841,642 | `True` |
| `不存在的查询词` | 78,972 | 0.895 | 78,972 | 0.895 | 79,961 | `True` |

- First trusted hard gate: `<=5,242,880` bytes or `<=10%` of proof bytes.
- Top hydrated hard gate: `<=10,485,760` bytes or `<=25%` of proof bytes.
- Phase gates passed: `True`

## Cache Benchmark

- Query count: `8`
- Max cold uncached bytes: `3,683,732`
- Max warm uncached bytes: `0`
- Total warm cached bytes: `13,593,088`
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
| `startup_entry_gap` | `engineering_gate_passed_not_absolute` | {"routed_first_screen_total_bytes": 217046, "bootstrap_manifest_bytes": 15422, "source_registry_bytes": 4805, "global_query_directory_bytes": 193950, "query_aliases_bytes": 2869, "startup_loads_local_indexes": false, "startup_loads_full_shards": false} | Metadata is already separated from local indexes and full shards, but the routed entry payload is still a practical JSON contract rather than an entropy-coded minimal decision table. | Delta-code source/query routing tables and measure whether a compact finite-state router beats the current manifest plus directory bytes without hurting debuggability. |
| `route_planning_gap` | `phase_gate_passed` | {"query_count": 27, "max_candidate_shard_count": 0, "max_loaded_shard_count": 0, "max_uncached_loaded_bytes": 7911271, "phase_gates_passed": true} | The planner emits expected byte costs and phase-local selections, but the route policy is still hand-calibrated rather than learned from an optimal decision rule. | Fit an offline decision policy on the evaluation corpus with byte cost as the Lagrange multiplier, then keep only policies that preserve task quality. |
| `first_trusted_gap` | `phase_gate_passed` | {"max_first_trusted_uncached_bytes": 416948, "absolute_limit_bytes": 5242880, "max_first_trusted_elapsed_ms": 20.511, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | The phase is byte-gated and query-path decode improved versus baseline, but the remaining gap is proving that no loaded local-index byte is irrelevant to the first trusted result. | Add per-term contribution accounting for first-result eligibility and drop zero-contribution term blocks. |
| `top_results_hydrated_gap` | `phase_gate_passed` | {"max_top_results_uncached_bytes": 416948, "absolute_limit_bytes": 10485760, "max_top_results_elapsed_ms": 20.511, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | Top results are separated from proof completion, but candidate upper bounds are not yet serialized as a formal certificate that every skipped block is dominated. | Persist block-level score upper bounds and emit a top-k dominance certificate for skipped blocks. |
| `proof_complete_certificate_gap` | `largest_remaining_theoretical_gap` | {"max_proof_complete_uncached_bytes": 7911271, "max_proof_complete_elapsed_ms": 354.473, "proof_catalog_total_bytes": 736839, "shard_filter_total_bytes": 6037127, "proof_certificate_total_bytes": 6773966, "hot_query_proof_directory_bytes": 78006, "hot_query... | Correctness is complete, but proof completion can still approach a full-shard read. The mathematical lower bound is a certificate stream, not full document hydration. | Separate false-positive filter pressure from true-match shard pressure, then generate doc/postings or hot-query certificates for true-match-heavy broad queries. |
| `full_shard_dependency_gap` | `known_remaining_dependency` | {"full_scan_total_bytes": 45712710, "proof_certificate_total_bytes": 6773966, "max_full_shard_bytes": 499697, "full_shard_count": 942, "max_proof_complete_uncached_bytes": 7911271} | The serving path no longer depends on full shards for startup or early results, but exhaustive proof still has a full-shard fallback. | Split proof certificates from full document bodies and make full bodies lazy even during proof completion. |
| `packed_index_decode_gap` | `query_path_gate_passed` | {"local_index_runtime_bytes": 37830244, "binary_artifact_total_bytes": 25862668, "runtime_byte_change_percent": -36.402, "runtime_decode_change_percent": 0.803, "query_path_passed": true, "body_decode_mode": "packed_query_term_selective", "light_decode_mode... | Packed selective decode is active on the hot query path, but block metadata is still decoded at artifact granularity rather than at the exact surviving term/block frontier. | Move to block directory offsets with direct term/block seeks and SIMD/WASM-friendly score scans. |
| `topk_pruning_gap` | `needs_attention` | {"any_dynamic_pruning": false, "total_postings_pruned": 0, "wasm_decision_status": "rust_wasm_retrieval_runtime_selected"} | Dynamic pruning is present, but the report does not yet prove that the pruning order is optimal for every query under the scoring function. | Record WAND/BMW-style upper-bound ledgers per query and compare visited postings against an oracle ordering. |
| `persistent_cache_gap` | `warm_cache_gate_passed` | {"cache_query_count": 8, "max_cold_uncached_bytes": 3683732, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 13593088, "browser_persistent_cache_passed": true} | Warm network bytes are gated locally; remaining lower-bound work is CPU decode reuse and browser-level confirmation when a browser report is missing. | Persist decoded packed-index pages and reuse score-session state across repeated same-version queries. |
| `attachment_semantics_gap` | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "text_extracted": 0... | Attachment evidence is summarized, but there is no per-query proof that the summary is the minimal sufficient statistic for attachment relevance. | Add query-term-to-attachment-evidence attribution and measure dropped attachment fields against task quality. |
| `ranking_calibration_gap` | `task_quality_gate_present` | {"quality_eval_skipped": null, "task_eval_skipped": null, "task_eval_passed": 29, "expectation_count": 29, "max_elapsed_ms": 355.323} | Quality gates exist, but ranking weights are still an engineered policy rather than a Pareto-optimal model over relevance, trust, recency, and byte cost. | Run ablations over ranking features and fit byte-aware weights that stay on the quality Pareto frontier. |
| `browser_resource_gap` | `browser_verified` | {"browser_report_missing": false, "passed": true, "persistent_cache_passed": true, "viewports": null, "scenario_count": null, "max_warm_uncached_immutable_bytes": null} | Browser verification is recorded only when the external browser report is present; the CLI report must not claim final browser lower-bound evidence without it. | Keep browser automation as a mandatory artifact and compare network/resource traces per phase. |

## Quality

- Smoke eval: `passed`
- Task eval: `29/29`

## Attachment Evidence

- Policy: `metadata_and_filename_only_no_extracted_attachment_content`
- Coverage: `{"total": 8100, "metadata_only": 8100, "filename_only": 8100, "text_extracted": 0, "snippet": 0, "full_content": 0}`

## Definition Of Done Audit

| Item | Status | Evidence |
| ---: | --- | --- |
| 1 | `evidence_present` | {"legacy_global_first_screen": false, "startup_loads_local_indexes": false, "startup_loads_full_shards": false, "startup_loads_global_document_metadata": false, "directory_contains_doc_postings": false, "completion_requires_ledger": true} |
| 2 | `evidence_present` | {"planner": "Planner telemetry includes route expected_cost_bytes, selected expected_uncached bytes, cache state per local index, and phase-specific local index selections.", "max_first_trusted_uncached_bytes": 416948, "first_trusted_absolu |
| 3 | `needs_attention` | {"any_dynamic_pruning": false, "total_postings_pruned": 0} |
| 4 | `evidence_present` | Measured queries report proof ledger complete with zero pending/failed shards; runtime tests cover no-match proof, failed shard refusal, and cancelled pending-ledger refusal. |
| 5 | `partial` | {"artifact_total_bytes_current": 142536624, "artifact_total_bytes_baseline": 122264702, "runtime_parse_decode_summary": {"baseline_local_index_runtime_bytes": 59483241, "current_local_index_runtime_bytes": 37830244, "bytes_delta": -21652997 |
| 6 | `evidence_present` | {"light_json_bytes": 0, "light_split_runtime_bytes": 20976445, "body_json_bytes": 0, "body_packed_runtime_bytes": 16853799, "note": "Packed binary light terms plus metadata JSON are used for query planning; packed binary light/body indexes  |
| 7 | `evidence_present` | {"artifact_count": 246, "benchmark": "packed-impact-retrieval-wasm-vs-typescript-v2", "collection": "apps/web/public/generated/collections/njupt-public", "decision": {"reason": "The browser runtime can consume Rust/WASM stateful score entri |
| 8 | `evidence_present` | {"query_count": 8, "max_cold_uncached_bytes": 3683732, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 13593088, "max_warm_ms": 205.186, "passed": true, "failure_count": 0, "cache_invalidation_test": "Changed content-hash artifact  |
| 9 | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "t |
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
