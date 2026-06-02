# NJUPT Search Lower-Bound Evidence Report

- Generated at: `2026-06-02T17:17:46.813420+00:00`
- Collection: `apps/web/public/generated/collections/njupt-public`
- Baseline ref: `1a0996e`
- Current artifact generation: `2026-06-02T17:07:32.107140+00:00`

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
| `routed_first_screen_total_bytes` | 217,034 | 215,075 | -1,959 | -0.903% |
| `bootstrap_manifest_bytes` | 12,790 | 15,384 | 2,594 | 20.281% |
| `source_registry_bytes` | 4,405 | 4,805 | 400 | 9.081% |
| `global_query_directory_bytes` | 197,030 | 192,033 | -4,997 | -2.536% |
| `query_aliases_bytes` | 2,809 | 2,853 | 44 | 1.566% |
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
| `hot_query_proof_directory_bytes` | None | 91,708 | 91,708 |  |
| `hot_query_topk_certificate_total_bytes` | None | 6,651,089 | 6,651,089 |  |
| `hot_query_complete_certificate_total_bytes` | None | 9,903,339 | 9,903,339 |  |
| `full_scan_total_bytes` | 44,782,519 | 45,712,710 | 930,191 | 2.077% |
| `artifact_total_bytes` | 122,264,702 | 97,233,993 | -25,030,709 | -20.473% |
| `binary_artifact_total_bytes` | None | 25,862,668 | 25,862,668 |  |
| `runtime_artifact_total_bytes` | None | 123,096,661 | 123,096,661 |  |
| `artifact_count` | 1,465 | 1,282 | -183 | -12.491% |
| `binary_artifact_count` | None | 492 | 492 |  |
| `local_index_count` | 246 | 246 | 0 | 0.000% |
| `full_shard_count` | 942 | 942 | 0 | 0.000% |
| `max_full_shard_bytes` | 485,346 | 499,697 | 14,351 | 2.957% |
| `avg_full_shard_bytes` | 47,539 | 48,527 | 987 | 2.077% |

## Parse And Decode

| Family | Baseline bytes | Current bytes | Baseline mean ms | Current mean ms |
| --- | ---: | ---: | ---: | ---: |
| `bootstrap_json` | 217,034 | 215,075 | 0.782 | 0.998 |
| `source_manifests` | 1,066,061 | 686,226 | 3.579 | 2.141 |
| `shard_filters_json_and_bitsets` | 2,843,792 | 6,037,127 | 7.622 | 16.997 |
| `local_light_json` | 28,563,086 | 0 | 243.283 | 0.000 |
| `local_light_meta_json` | 0 | 11,967,576 | 0.000 | 36.806 |
| `local_light_packed` | 0 | 9,008,869 | 0.000 | 792.536 |
| `local_light_packed_query_terms` | 0 | 9,008,869 | 0.000 | 215.142 |
| `local_body_json` | 30,920,155 | 0 | 389.508 | 0.000 |
| `local_body_packed` | 0 | 16,853,799 | 0.000 | 1578.867 |
| `local_body_packed_query_terms` | 0 | 16,853,799 | 0.000 | 397.770 |

## Runtime Query-Term Decode Summary

- Baseline local-index runtime bytes: `59,483,241`
- Current local-index runtime bytes: `37,830,244`
- Runtime byte change: `-36.402%`
- Baseline local-index parse/decode mean: `632.791` ms
- Current query-term parse/decode mean: `649.718` ms
- Parse/decode change: `2.675%`
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
| `校历` | 16.206 | 12 | 0 | 0 | 413,483 | 0 | `True` | 2025-2026学年校历 |
| `搜校历` | 16.176 | 12 | 0 | 0 | 413,483 | 0 | `True` | 2025-2026学年校历 |
| `慕课考试` | 18.068 | 12 | 0 | 0 | 617,306 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期在线开放课程（慕课）线下考试报名通知 |
| `期末考试` | 17.021 | 12 | 0 | 0 | 844,277 | 0 | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期期末考试工作安排的通知 |
| `考试安排` | 16.807 | 12 | 0 | 0 | 844,277 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期考试安排表 |
| `选课` | 16.800 | 12 | 0 | 0 | 686,081 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生课程补改选及重修选课的通知 |
| `转专业` | 16.730 | 12 | 0 | 0 | 466,318 | 0 | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期全日制本科生转专业工作的通知 |
| `成绩` | 21.998 | 12 | 0 | 0 | 1,192,569 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `查成绩` | 22.363 | 12 | 0 | 0 | 1,192,569 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩查询` | 20.434 | 12 | 0 | 0 | 1,192,569 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩复核申请表` | 20.330 | 12 | 0 | 0 | 1,222,397 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `xlsx` | 17.170 | 12 | 0 | 0 | 1,193,038 | 0 | `True` | 关于举办第十二届全国大学生物理实验竞赛（创新）校内选拔赛的通知 |
| `大创` | 21.905 | 12 | 0 | 0 | 962,837 | 0 | `True` | 2024年度大学生创新创业训练计划项目结题验收成绩公示 |
| `学科竞赛` | 16.813 | 12 | 0 | 0 | 545,602 | 0 | `True` | 关于组织2026年全国大学生电子设计竞赛(TI杯)及电子信息类系列学科竞赛宣讲及选拔的通知 |
| `普通话考试` | 3.007 | 12 | 0 | 0 | 151,673 | 0 | `True` | 【教务管理办公室】关于2026年上半年普通话考试的通知 |
| `挑战杯` | 11.981 | 12 | 0 | 0 | 287,397 | 0 | `True` | 南邮获“挑战杯”国赛特等奖7项 再捧“优胜杯” |
| `推免` | 15.395 | 12 | 0 | 0 | 383,514 | 0 | `True` | 2026年各学院推荐优秀应届本科毕业生免试攻读研究生工作方案 |
| `助学金` | 15.721 | 12 | 0 | 0 | 534,846 | 0 | `True` | 校学发〔2024〕7号南京邮电大学“鼓楼区绿色低碳奖助学金”实施细则（试行） |
| `国家奖学金` | 15.328 | 12 | 0 | 0 | 528,473 | 0 | `True` | 本科学生国家奖学金评审办法 |
| `困难认定` | 10.920 | 12 | 0 | 0 | 285,727 | 0 | `True` | 家庭经济困难学生认定工作实施办法 |
| `心理健康` | 10.904 | 12 | 0 | 0 | 358,636 | 0 | `True` | 心理健康 |
| `学工` | 20.248 | 12 | 0 | 0 | 1,151,084 | 0 | `True` | 南京工业大学浦江学院学工处来校调研 |
| `竞赛报名` | 21.636 | 12 | 0 | 0 | 544,026 | 0 | `True` | 关于举办“2026年南京邮电大学集成电路创新创业校选拔赛”的通知 |
| `规章制度` | 19.186 | 12 | 0 | 0 | 901,695 | 0 | `True` | 南京邮电大学本科教材供应管理办法 2024-04-26 |
| `办事流程` | 19.401 | 12 | 0 | 0 | 667,443 | 0 | `True` | 服兵役学生国家教育资助申请流程 |
| `学生相关文件及表格` | 8.419 | 12 | 0 | 0 | 347,902 | 0 | `True` | 南京邮电大学学生毕业申请表 2026-04-16 |
| `教务管理系统` | 15.900 | 12 | 0 | 0 | 886,831 | 0 | `True` | 教务管理系统 |
| `信息门户` | 16.342 | 12 | 0 | 0 | 877,397 | 0 | `True` | 教务管理系统 |
| `附件1` | 20.131 | 12 | 0 | 0 | 1,054,017 | 0 | `True` | 【科创竞赛】第九届“外教社杯”全国高校学生跨文化能力大赛南京邮电大学校园赛通知 |
| `缓考申请表` | 1.449 | 3 | 0 | 0 | 101,111 | 0 | `True` | 南京邮电大学学生缓考申请表 2026-04-16 |
| `奖学金` | 15.084 | 12 | 0 | 0 | 519,179 | 0 | `True` | 南京邮电大学2024-2025学年“甘霖励志奖学金”拟推荐名单公示 |
| `辅导员` | 18.185 | 12 | 0 | 0 | 811,404 | 0 | `True` | 红色校史润心田，南邮精神永相传 —— 第四届辅导员宣讲团 走进教育科学与技术学院 |
| `双创` | 16.647 | 12 | 0 | 0 | 368,615 | 0 | `True` | 双创信息管理系统 |
| `互联网+` | 13.487 | 12 | 0 | 0 | 398,836 | 0 | `True` | 南京邮电大学第五届 “互联网+”大学生创新创业大赛成绩公示 |
| `不存在的查询词` | 1.253 | 0 | 0 | 0 | 93,662 | 0 | `True` |  |

## Proof Scan Pressure

| Query | Certificate | Certificate bytes | Avoided match-shard bytes | True-match shards | False-positive shards | True-match bytes | False-positive bytes | False-positive byte ratio | True-match docs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `校历` | `True` | 136,221 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `搜校历` | `True` | 136,221 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `慕课考试` | `True` | 321,557 | 16,376,012 | 153 | 0 | 0 | 0 | 0.000 | 433 |
| `期末考试` | `True` | 579,755 | 18,333,088 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `考试安排` | `True` | 579,755 | 18,333,088 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `选课` | `True` | 407,926 | 28,458,652 | 283 | 0 | 0 | 0 | 0.000 | 762 |
| `转专业` | `True` | 192,486 | 18,027,905 | 160 | 0 | 0 | 0 | 0.000 | 205 |
| `成绩` | `True` | 946,697 | 39,620,522 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `查成绩` | `True` | 946,697 | 39,620,522 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `成绩查询` | `True` | 946,697 | 39,620,522 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `成绩复核申请表` | `True` | 974,305 | 39,620,522 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `xlsx` | `True` | 933,865 | 30,975,141 | 393 | 0 | 0 | 0 | 0.000 | 2,053 |
| `大创` | `True` | 719,173 | 35,235,089 | 471 | 0 | 0 | 0 | 0.000 | 1,075 |
| `学科竞赛` | `True` | 334,282 | 21,490,018 | 287 | 0 | 0 | 0 | 0.000 | 509 |
| `普通话考试` | `True` | 105,002 | 1,731,223 | 14 | 0 | 0 | 0 | 0.000 | 23 |
| `挑战杯` | `True` | 122,344 | 6,625,754 | 60 | 0 | 0 | 0 | 0.000 | 67 |
| `推免` | `True` | 149,571 | 9,648,543 | 94 | 0 | 0 | 0 | 0.000 | 108 |
| `助学金` | `True` | 323,965 | 25,151,907 | 255 | 0 | 0 | 0 | 0.000 | 505 |
| `国家奖学金` | `True` | 313,783 | 25,117,516 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `困难认定` | `True` | 134,098 | 4,889,512 | 41 | 0 | 0 | 0 | 0.000 | 57 |
| `心理健康` | `True` | 176,193 | 9,997,202 | 92 | 0 | 0 | 0 | 0.000 | 167 |
| `学工` | `True` | 939,711 | 39,150,454 | 539 | 0 | 0 | 0 | 0.000 | 1,909 |
| `竞赛报名` | `True` | 255,967 | 12,765,068 | 196 | 0 | 0 | 0 | 0.000 | 303 |
| `规章制度` | `True` | 647,577 | 20,388,638 | 256 | 0 | 0 | 0 | 0.000 | 1,238 |
| `办事流程` | `True` | 398,427 | 22,300,599 | 230 | 0 | 0 | 0 | 0.000 | 756 |
| `学生相关文件及表格` | `True` | 181,300 | 1,480,594 | 53 | 0 | 0 | 0 | 0.000 | 107 |
| `教务管理系统` | `True` | 662,950 | 19,580,088 | 161 | 0 | 0 | 0 | 0.000 | 797 |
| `信息门户` | `True` | 634,781 | 19,184,464 | 151 | 0 | 0 | 0 | 0.000 | 756 |
| `附件1` | `True` | 733,660 | 28,253,234 | 330 | 0 | 0 | 0 | 0.000 | 1,536 |
| `缓考申请表` | `True` | 94,230 | 46,901 | 2 | 0 | 0 | 0 | 0.000 | 3 |
| `奖学金` | `True` | 307,440 | 25,117,516 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `辅导员` | `True` | 599,910 | 21,380,491 | 250 | 0 | 0 | 0 | 0.000 | 1,094 |
| `双创` | `True` | 134,418 | 3,781,225 | 72 | 0 | 0 | 0 | 0.000 | 93 |
| `互联网+` | `True` | 192,010 | 12,904,091 | 150 | 0 | 0 | 0 | 0.000 | 222 |
| `不存在的查询词` | `True` | 92,683 | 0 | 0 | 0 | 0 | 0 | 0.000 | 0 |

## Phase Gates

| Query | First trusted bytes | First trusted ms | Top hydrated bytes | Top hydrated ms | Proof bytes | Passed |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `校历` | 368,970 | 15.566 | 368,970 | 15.566 | 413,483 | `True` |
| `搜校历` | 368,970 | 15.548 | 368,970 | 15.548 | 413,483 | `True` |
| `慕课考试` | 387,457 | 16.387 | 387,457 | 16.387 | 617,306 | `True` |
| `期末考试` | 356,230 | 13.074 | 356,230 | 13.074 | 844,277 | `True` |
| `考试安排` | 356,230 | 12.634 | 356,230 | 12.634 | 844,277 | `True` |
| `选课` | 369,863 | 13.816 | 369,863 | 13.816 | 686,081 | `True` |
| `转专业` | 365,540 | 15.429 | 365,540 | 15.429 | 466,318 | `True` |
| `成绩` | 337,580 | 13.983 | 337,580 | 13.983 | 1,192,569 | `True` |
| `查成绩` | 337,580 | 14.742 | 337,580 | 14.742 | 1,192,569 | `True` |
| `成绩查询` | 337,580 | 13.340 | 337,580 | 13.340 | 1,192,569 | `True` |
| `成绩复核申请表` | 339,800 | 13.141 | 339,800 | 13.141 | 1,222,397 | `True` |
| `xlsx` | 350,881 | 11.815 | 350,881 | 11.815 | 1,193,038 | `True` |
| `大创` | 335,372 | 17.093 | 335,372 | 17.093 | 962,837 | `True` |
| `学科竞赛` | 303,028 | 14.648 | 303,028 | 14.648 | 545,602 | `True` |
| `普通话考试` | 138,379 | 2.684 | 138,379 | 2.684 | 151,673 | `True` |
| `挑战杯` | 256,761 | 11.392 | 256,761 | 11.392 | 287,397 | `True` |
| `推免` | 325,651 | 14.631 | 325,651 | 14.631 | 383,514 | `True` |
| `助学金` | 302,589 | 13.458 | 302,589 | 13.458 | 534,846 | `True` |
| `国家奖学金` | 306,398 | 13.281 | 306,398 | 13.281 | 528,473 | `True` |
| `困难认定` | 243,337 | 10.309 | 243,337 | 10.309 | 285,727 | `True` |
| `心理健康` | 274,151 | 10.063 | 274,151 | 10.063 | 358,636 | `True` |
| `学工` | 303,081 | 14.418 | 303,081 | 14.418 | 1,151,084 | `True` |
| `竞赛报名` | 379,767 | 19.497 | 379,767 | 19.497 | 544,026 | `True` |
| `规章制度` | 345,826 | 14.728 | 345,826 | 14.728 | 901,695 | `True` |
| `办事流程` | 360,724 | 16.458 | 360,724 | 16.458 | 667,443 | `True` |
| `学生相关文件及表格` | 258,310 | 7.617 | 258,310 | 7.617 | 347,902 | `True` |
| `教务管理系统` | 315,589 | 11.637 | 315,589 | 11.637 | 886,831 | `True` |
| `信息门户` | 334,324 | 12.114 | 334,324 | 12.114 | 877,397 | `True` |
| `附件1` | 412,065 | 15.614 | 412,065 | 15.614 | 1,054,017 | `True` |
| `缓考申请表` | 98,589 | 1.207 | 98,589 | 1.207 | 101,111 | `True` |
| `奖学金` | 303,447 | 12.807 | 303,447 | 12.807 | 519,179 | `True` |
| `辅导员` | 303,202 | 13.755 | 303,202 | 13.755 | 811,404 | `True` |
| `双创` | 325,905 | 16.033 | 325,905 | 16.033 | 368,615 | `True` |
| `互联网+` | 298,534 | 12.447 | 298,534 | 12.447 | 398,836 | `True` |
| `不存在的查询词` | 92,687 | 0.972 | 92,687 | 0.972 | 93,662 | `True` |

- First trusted hard gate: `<=5,242,880` bytes or `<=10%` of proof bytes.
- Top hydrated hard gate: `<=10,485,760` bytes or `<=25%` of proof bytes.
- Phase gates passed: `True`

## Cache Benchmark

- Query count: `8`
- Max cold uncached bytes: `962,837`
- Max warm uncached bytes: `0`
- Total warm cached bytes: `5,041,182`
- Passed: `True`

## Browser Verification

- Passed: `True`
- Persistent cache passed: `None`
- Viewports: `[]`
- Scenario count: `5`
- Max warm uncached immutable bytes: `None`

## Lower Bound Gap Report

- Objective: Minimize query-dependent bytes and decode work while preserving trusted top-k answers and exhaustive proof semantics.
- Claim boundary: Engineering gates can be passed without proving the mathematical lower bound; the gap entries identify what proof or algorithm is still missing.

| Layer | Status | Current measurement | Gap | Next algorithmic step |
| --- | --- | --- | --- | --- |
| `startup_entry_gap` | `engineering_gate_passed_not_absolute` | {"routed_first_screen_total_bytes": 215075, "bootstrap_manifest_bytes": 15384, "source_registry_bytes": 4805, "global_query_directory_bytes": 192033, "query_aliases_bytes": 2853, "startup_loads_local_indexes": false, "startup_loads_full_shards": false} | Metadata is already separated from local indexes and full shards, but the routed entry payload is still a practical JSON contract rather than an entropy-coded minimal decision table. | Delta-code source/query routing tables and measure whether a compact finite-state router beats the current manifest plus directory bytes without hurting debuggability. |
| `route_planning_gap` | `phase_gate_passed` | {"query_count": 35, "max_candidate_shard_count": 0, "max_loaded_shard_count": 0, "max_uncached_loaded_bytes": 1222397, "phase_gates_passed": true} | The planner emits expected byte costs and phase-local selections, but the route policy is still hand-calibrated rather than learned from an optimal decision rule. | Fit an offline decision policy on the evaluation corpus with byte cost as the Lagrange multiplier, then keep only policies that preserve task quality. |
| `first_trusted_gap` | `phase_gate_passed` | {"max_first_trusted_uncached_bytes": 412065, "absolute_limit_bytes": 5242880, "max_first_trusted_elapsed_ms": 19.497, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | The phase is byte-gated and query-path decode improved versus baseline, but the remaining gap is proving that no loaded local-index byte is irrelevant to the first trusted result. | Add per-term contribution accounting for first-result eligibility and drop zero-contribution term blocks. |
| `top_results_hydrated_gap` | `phase_gate_passed` | {"max_top_results_uncached_bytes": 412065, "absolute_limit_bytes": 10485760, "max_top_results_elapsed_ms": 19.497, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | Top results are separated from proof completion, but candidate upper bounds are not yet serialized as a formal certificate that every skipped block is dominated. | Persist block-level score upper bounds and emit a top-k dominance certificate for skipped blocks. |
| `proof_complete_certificate_gap` | `largest_remaining_theoretical_gap` | {"max_proof_complete_uncached_bytes": 1222397, "max_proof_complete_elapsed_ms": 22.328, "proof_catalog_total_bytes": 736839, "shard_filter_total_bytes": 6037127, "proof_certificate_total_bytes": 6773966, "hot_query_proof_directory_bytes": 91708, "hot_query_... | Correctness is complete, but proof completion can still approach a full-shard read. The mathematical lower bound is a certificate stream, not full document hydration. | Separate false-positive filter pressure from true-match shard pressure, then generate doc/postings or hot-query certificates for true-match-heavy broad queries. |
| `full_shard_dependency_gap` | `known_remaining_dependency` | {"full_scan_total_bytes": 45712710, "proof_certificate_total_bytes": 6773966, "max_full_shard_bytes": 499697, "full_shard_count": 942, "max_proof_complete_uncached_bytes": 1222397} | The serving path no longer depends on full shards for startup or early results, but exhaustive proof still has a full-shard fallback. | Split proof certificates from full document bodies and make full bodies lazy even during proof completion. |
| `packed_index_decode_gap` | `query_path_gate_passed` | {"local_index_runtime_bytes": 37830244, "binary_artifact_total_bytes": 25862668, "runtime_byte_change_percent": -36.402, "runtime_decode_change_percent": 2.675, "query_path_passed": true, "body_decode_mode": "packed_query_term_selective", "light_decode_mode... | Packed selective decode is active on the hot query path, but block metadata is still decoded at artifact granularity rather than at the exact surviving term/block frontier. | Move to block directory offsets with direct term/block seeks and SIMD/WASM-friendly score scans. |
| `topk_pruning_gap` | `needs_attention` | {"any_dynamic_pruning": false, "total_postings_pruned": 0, "wasm_decision_status": "rust_wasm_retrieval_runtime_selected"} | Dynamic pruning is present, but the report does not yet prove that the pruning order is optimal for every query under the scoring function. | Record WAND/BMW-style upper-bound ledgers per query and compare visited postings against an oracle ordering. |
| `persistent_cache_gap` | `warm_cache_gate_passed` | {"cache_query_count": 8, "max_cold_uncached_bytes": 962837, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 5041182, "browser_persistent_cache_passed": null} | Warm network bytes are gated locally; remaining lower-bound work is CPU decode reuse and browser-level confirmation when a browser report is missing. | Persist decoded packed-index pages and reuse score-session state across repeated same-version queries. |
| `attachment_semantics_gap` | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "text_extracted": 0... | Attachment evidence is summarized, but there is no per-query proof that the summary is the minimal sufficient statistic for attachment relevance. | Add query-term-to-attachment-evidence attribution and measure dropped attachment fields against task quality. |
| `ranking_calibration_gap` | `task_quality_gate_present` | {"quality_eval_skipped": null, "task_eval_skipped": null, "task_eval_passed": 29, "expectation_count": 29, "max_elapsed_ms": 22.363} | Quality gates exist, but ranking weights are still an engineered policy rather than a Pareto-optimal model over relevance, trust, recency, and byte cost. | Run ablations over ranking features and fit byte-aware weights that stay on the quality Pareto frontier. |
| `browser_resource_gap` | `browser_verified` | {"browser_report_missing": false, "passed": true, "persistent_cache_passed": null, "viewports": null, "scenario_count": 5, "max_warm_uncached_immutable_bytes": null} | Browser verification is recorded only when the external browser report is present; the CLI report must not claim final browser lower-bound evidence without it. | Keep browser automation as a mandatory artifact and compare network/resource traces per phase. |

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
| 2 | `evidence_present` | {"planner": "Planner telemetry includes route expected_cost_bytes, selected expected_uncached bytes, cache state per local index, and phase-specific local index selections.", "max_first_trusted_uncached_bytes": 412065, "first_trusted_absolu |
| 3 | `needs_attention` | {"any_dynamic_pruning": false, "total_postings_pruned": 0} |
| 4 | `evidence_present` | Measured queries report proof ledger complete with zero pending/failed shards; runtime tests cover no-match proof, failed shard refusal, and cancelled pending-ledger refusal. |
| 5 | `evidence_present` | {"artifact_total_bytes_current": 97233993, "artifact_total_bytes_baseline": 122264702, "runtime_parse_decode_summary": {"baseline_local_index_runtime_bytes": 59483241, "current_local_index_runtime_bytes": 37830244, "bytes_delta": -21652997, |
| 6 | `evidence_present` | {"light_json_bytes": 0, "light_split_runtime_bytes": 20976445, "body_json_bytes": 0, "body_packed_runtime_bytes": 16853799, "note": "Packed binary light terms plus metadata JSON are used for query planning; packed binary light/body indexes  |
| 7 | `evidence_present` | {"artifact_count": 246, "benchmark": "packed-impact-retrieval-wasm-vs-typescript-v2", "collection": "apps/web/public/generated/collections/njupt-public", "decision": {"reason": "The browser runtime can consume Rust/WASM stateful score entri |
| 8 | `evidence_present` | {"query_count": 8, "max_cold_uncached_bytes": 962837, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 5041182, "max_warm_ms": 17.773, "passed": true, "failure_count": 0, "cache_invalidation_test": "Changed content-hash artifact pat |
| 9 | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "t |
| 10 | `evidence_present` | Smoke queries, task queries, measured cold queries, warm cache queries, and a negative query are represented when full report mode is used. |
| 11 | `evidence_present` | {"report": "njupt-search-browser-verification-v16-local-post-merge-hot-query-proof-lower-bound", "generated_at": "2026-06-02T17:17:02.508Z", "base_url": "http://127.0.0.1:5187/", "summary": {"passed": true, "scenario_count": 5, "failed": [] |
| 12 | `external_ci_deploy_required` | Local validators/tests/builds can be recorded separately; CI/deployment status is outside this local report. |
| 13 | `evidence_present` | This report includes byte, time, quality, cache, pruning, parse/decode, and coverage sections. |
| 14 | `unmet` | Commit, push, CI, and deployment checks are intentionally not claimed by this report. |
| 15 | `evidence_present` | {"required_layers": ["startup_entry_gap", "route_planning_gap", "first_trusted_gap", "top_results_hydrated_gap", "proof_complete_certificate_gap", "full_shard_dependency_gap", "packed_index_decode_gap", "topk_pruning_gap", "persistent_cache |

## Reproduction

```powershell
uv run --python 3.13 python -m njupt_search_eval run-lower-bound-report --baseline-ref 1a0996e --collection apps\web\public\generated\collections\njupt-public --output tools\search-eval\reports\njupt-search-lower-bound-report.json --markdown tools\search-eval\reports\njupt-search-lower-bound-report.md
```

This report is evidence for the active lower-bound goal. It does not claim final completion while DoD items remain unmet.
