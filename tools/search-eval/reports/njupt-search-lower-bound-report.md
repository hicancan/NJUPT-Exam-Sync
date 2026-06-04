# NJUPT Search Lower-Bound Evidence Report

- Generated at: `2026-06-04T09:25:27.530405+00:00`
- Collection: `apps/web/public/generated/collections/njupt-public`
- Baseline ref: `origin/main`
- Current artifact generation: `2026-06-04T08:55:04.212390+00:00`

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
| `routed_first_screen_total_bytes` | 230,177 | 230,155 | -22 | -0.010% |
| `bootstrap_manifest_bytes` | 16,558 | 16,538 | -20 | -0.121% |
| `source_registry_bytes` | 4,805 | 4,805 | 0 | 0.000% |
| `global_query_directory_bytes` | 205,961 | 205,959 | -2 | -0.001% |
| `query_aliases_bytes` | 2,853 | 2,853 | 0 | 0.000% |
| `source_manifest_total_bytes` | 716,754 | 716,754 | 0 | 0.000% |
| `local_impact_light_index_total_bytes` | 0 | 0 | 0 |  |
| `local_impact_light_index_meta_total_bytes` | 12,204,605 | 12,203,497 | -1,108 | -0.009% |
| `local_impact_light_index_packed_total_bytes` | 9,018,795 | 9,018,637 | -158 | -0.002% |
| `local_impact_body_index_total_bytes` | 0 | 0 | 0 |  |
| `local_impact_body_index_packed_total_bytes` | 16,865,979 | 16,865,808 | -171 | -0.001% |
| `light_index_runtime_bytes` | 21,223,400 | 21,222,134 | -1,266 | -0.006% |
| `body_index_bytes` | 0 | 0 | 0 |  |
| `body_index_runtime_bytes` | 16,865,979 | 16,865,808 | -171 | -0.001% |
| `local_index_runtime_bytes` | 38,089,379 | 38,087,942 | -1,437 | -0.004% |
| `proof_catalog_total_bytes` | 756,879 | 756,879 | 0 | 0.000% |
| `shard_filter_total_bytes` | 6,050,937 | 6,050,937 | 0 | 0.000% |
| `proof_certificate_total_bytes` | 6,807,816 | 6,807,816 | 0 | 0.000% |
| `hot_query_proof_directory_bytes` | 135,549 | 137,986 | 2,437 | 1.798% |
| `hot_query_topk_certificate_total_bytes` | 7,211,949 | 7,696,245 | 484,296 | 6.715% |
| `hot_query_complete_certificate_total_bytes` | 10,962,074 | 11,876,218 | 914,144 | 8.339% |
| `full_scan_total_bytes` | 45,721,382 | 45,717,182 | -4,200 | -0.009% |
| `artifact_total_bytes` | 101,097,287 | 102,844,383 | 1,747,096 | 1.728% |
| `binary_artifact_total_bytes` | 25,884,774 | 25,884,445 | -329 | -0.001% |
| `runtime_artifact_total_bytes` | 126,982,061 | 128,728,828 | 1,746,767 | 1.376% |
| `artifact_count` | 1,357 | 1,366 | 9 | 0.663% |
| `binary_artifact_count` | 492 | 492 | 0 | 0.000% |
| `local_index_count` | 246 | 246 | 0 | 0.000% |
| `full_shard_count` | 942 | 942 | 0 | 0.000% |
| `max_full_shard_bytes` | 499,697 | 499,697 | 0 | 0.000% |
| `avg_full_shard_bytes` | 48,536 | 48,532 | -4 | -0.009% |

## Parse And Decode

| Family | Baseline bytes | Current bytes | Baseline mean ms | Current mean ms |
| --- | ---: | ---: | ---: | ---: |
| `bootstrap_json` | 230,177 | 230,827 | 1.657 | 0.963 |
| `source_manifests` | 716,754 | 732,545 | 2.000 | 2.070 |
| `shard_filters_json_and_bitsets` | 6,047,886 | 6,047,886 | 10.052 | 10.458 |
| `local_light_json` | 0 | 0 | 0.000 | 0.000 |
| `local_light_meta_json` | 0 | 12,203,497 | 0.000 | 42.043 |
| `local_light_packed` | 0 | 9,018,637 | 0.000 | 881.813 |
| `local_light_packed_query_terms` | 0 | 9,018,637 | 0.000 | 224.768 |
| `local_body_json` | 0 | 0 | 0.000 | 0.000 |
| `local_body_packed` | 0 | 16,865,808 | 0.000 | 1756.788 |
| `local_body_packed_query_terms` | 0 | 16,865,808 | 0.000 | 427.652 |

## Runtime Query-Term Decode Summary

- Baseline local-index runtime bytes: `0`
- Current local-index runtime bytes: `38,087,942`
- Runtime byte change: `None%`
- Baseline local-index parse/decode mean: `0.000` ms
- Current query-term parse/decode mean: `694.463` ms
- Parse/decode change: `None%`
- Light decode mode: `metadata_json_plus_packed_query_term_selective`
- Body decode mode: `packed_query_term_selective`

## Query Path Parse And Decode

| Phase | Mean baseline bytes | Mean current bytes | Byte change | Mean baseline ms | Mean current ms | Decode change | Byte gate | Decode within tolerance |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `first_trusted_results` | 0 | 0 | `None%` | 0.000 | 0.000 | `None%` | `True` | `True` |
| `top_results_hydrated` | 0 | 83,085 | `None%` | 0.000 | 1.374 | `None%` | `False` | `False` |
- Query-path byte gate passed: `False`. Decode timing is reported separately with tolerance `5.0%`.

## Rust/WASM Decision

- Decision: `rust_wasm_retrieval_runtime_selected`
- Winner for current runtime: `wasm_retrieval_session_scores_bridge`
- TypeScript decode mean ms: `680.869`
- WASM materialized decode mean ms: `741.618`
- WASM stats-only decode mean ms: `44.771`
- TypeScript retrieval kernel mean ms: `3941.645`
- WASM stateless retrieval kernel mean ms: `377.284`
- WASM stateful retrieval session mean ms: `511.046`
- WASM stateful retrieval score bridge mean ms: `523.395`
- Reason: The browser runtime can consume Rust/WASM stateful score entries directly. On the full packed body workload, the Rust/WASM session score bridge was 0.133x the TypeScript selective retrieval kernel for the same artifact format, query set, and global top-k pruning state.

## Query Measurements

| Query | ms | Results | Candidate shards | Loaded shards | Uncached bytes | Pruned postings | Complete | Top result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `校历` | 23.743 | 12 | 0 | 0 | 601,875 | 0 | `True` | 2025-2026学年校历 |
| `搜校历` | 22.362 | 12 | 0 | 0 | 601,875 | 0 | `True` | 2025-2026学年校历 |
| `慕课考试` | 26.307 | 12 | 0 | 0 | 794,505 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期在线开放课程（慕课）线下考试报名通知 |
| `期末考试` | 22.682 | 12 | 0 | 0 | 997,010 | 0 | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期期末考试工作安排的通知 |
| `考试安排` | 20.805 | 12 | 0 | 0 | 1,012,862 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期考试安排表 |
| `选课` | 23.542 | 12 | 0 | 0 | 853,850 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生课程补改选及重修选课的通知 |
| `转专业` | 20.124 | 12 | 0 | 0 | 639,933 | 0 | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期全日制本科生转专业工作的通知 |
| `成绩` | 26.841 | 12 | 0 | 0 | 1,310,681 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `通知` | 2477.936 | 12 | 18 | 674 | 51,311,067 | 0 | `True` | 【教务管理办公室】关于做好2027届毕业生图像信息采集工作的通知 |
| `学生` | 3227.879 | 12 | 18 | 844 | 54,616,083 | 0 | `True` | 省教育厅关于印发《江苏省高等学校学生企业实习管理规定》的通知 2025-04-08 |
| `查成绩` | 32.024 | 12 | 0 | 0 | 1,310,681 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩查询` | 32.366 | 12 | 0 | 0 | 1,310,681 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩复核申请表` | 25.418 | 12 | 0 | 0 | 1,339,974 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `xlsx` | 28.026 | 12 | 0 | 0 | 1,333,112 | 0 | `True` | 关于举办第十二届全国大学生物理实验竞赛（创新）校内选拔赛的通知 |
| `大创` | 30.615 | 12 | 0 | 0 | 1,114,915 | 0 | `True` | 2024年度大学生创新创业训练计划项目结题验收成绩公示 |
| `学科竞赛` | 26.825 | 12 | 0 | 0 | 699,280 | 0 | `True` | 关于组织2026年全国大学生电子设计竞赛(TI杯)及电子信息类系列学科竞赛宣讲及选拔的通知 |
| `普通话考试` | 7.068 | 12 | 0 | 0 | 294,856 | 0 | `True` | 【教务管理办公室】关于2026年上半年普通话考试的通知 |
| `挑战杯` | 20.243 | 12 | 0 | 0 | 438,318 | 0 | `True` | 南邮获“挑战杯”国赛特等奖7项 再捧“优胜杯” |
| `推免` | 25.121 | 12 | 0 | 0 | 543,466 | 0 | `True` | 2026年各学院推荐优秀应届本科毕业生免试攻读研究生工作方案 |
| `助学金` | 25.002 | 12 | 0 | 0 | 678,766 | 0 | `True` | 校学发〔2024〕7号南京邮电大学“鼓楼区绿色低碳奖助学金”实施细则（试行） |
| `国家奖学金` | 26.277 | 12 | 0 | 0 | 670,013 | 0 | `True` | 本科学生国家奖学金评审办法 |
| `困难认定` | 20.154 | 12 | 0 | 0 | 437,773 | 0 | `True` | 家庭经济困难学生认定工作实施办法 |
| `心理健康` | 19.160 | 12 | 0 | 0 | 508,715 | 0 | `True` | 心理健康 |
| `学工` | 31.603 | 12 | 0 | 0 | 1,278,058 | 0 | `True` | 南京工业大学浦江学院学工处来校调研 |
| `竞赛报名` | 38.496 | 12 | 0 | 0 | 727,377 | 0 | `True` | 关于举办“2026年南京邮电大学集成电路创新创业校选拔赛”的通知 |
| `规章制度` | 29.183 | 12 | 0 | 0 | 1,051,313 | 0 | `True` | 南京邮电大学本科教材供应管理办法 2024-04-26 |
| `办事流程` | 29.722 | 12 | 0 | 0 | 820,769 | 0 | `True` | 服兵役学生国家教育资助申请流程 |
| `学生相关文件及表格` | 14.515 | 12 | 0 | 0 | 494,259 | 0 | `True` | 南京邮电大学学生毕业申请表 2026-04-16 |
| `教务管理系统` | 23.532 | 12 | 0 | 0 | 1,023,605 | 0 | `True` | 教务管理系统 |
| `信息门户` | 25.771 | 12 | 0 | 0 | 1,023,611 | 0 | `True` | 教务管理系统 |
| `附件1` | 31.118 | 12 | 0 | 0 | 1,211,289 | 0 | `True` | 【科创竞赛】第九届“外教社杯”全国高校学生跨文化能力大赛南京邮电大学校园赛通知 |
| `缓考申请表` | 3.278 | 3 | 0 | 0 | 212,529 | 0 | `True` | 南京邮电大学学生缓考申请表 2026-04-16 |
| `奖学金` | 25.143 | 12 | 0 | 0 | 656,656 | 0 | `True` | 南京邮电大学2024-2025学年“甘霖励志奖学金”拟推荐名单公示 |
| `辅导员` | 29.687 | 12 | 0 | 0 | 953,696 | 0 | `True` | 红色校史润心田，南邮精神永相传 —— 第四届辅导员宣讲团 走进教育科学与技术学院 |
| `双创` | 26.093 | 12 | 0 | 0 | 523,048 | 0 | `True` | 双创信息管理系统 |
| `互联网+` | 22.648 | 12 | 0 | 0 | 545,107 | 0 | `True` | 南京邮电大学第五届 “互联网+”大学生创新创业大赛成绩公示 |
| `不存在的查询词` | 2.543 | 0 | 0 | 0 | 199,195 | 0 | `True` |  |
| `a` | 0.031 | 0 | 0 | 0 | 0 | 0 | `True` |  |

## Proof Scan Pressure

| Query | Certificate | Certificate bytes | Avoided match-shard bytes | True-match shards | False-positive shards | True-match bytes | False-positive bytes | False-positive byte ratio | True-match docs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `校历` | `True` | 181,533 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `搜校历` | `True` | 181,533 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `慕课考试` | `True` | 361,244 | 16,376,270 | 153 | 0 | 0 | 0 | 0.000 | 433 |
| `期末考试` | `True` | 608,183 | 18,334,896 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `考试安排` | `True` | 608,183 | 18,334,896 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `选课` | `True` | 442,743 | 28,458,910 | 283 | 0 | 0 | 0 | 0.000 | 762 |
| `转专业` | `True` | 236,605 | 18,027,905 | 160 | 0 | 0 | 0 | 0.000 | 205 |
| `成绩` | `True` | 958,685 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `通知` | `False` | 0 | 0 | 612 | 62 | 39,192,844 | 2,741,330 | 0.065 | 5,281 |
| `学生` | `False` | 0 | 0 | 839 | 5 | 45,222,273 | 19,921 | 0.000 | 6,842 |
| `查成绩` | `True` | 958,685 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `成绩查询` | `True` | 958,685 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `成绩复核申请表` | `True` | 986,293 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `xlsx` | `True` | 945,369 | 30,979,612 | 393 | 0 | 0 | 0 | 0.000 | 2,053 |
| `大创` | `True` | 750,082 | 35,239,561 | 471 | 0 | 0 | 0 | 0.000 | 1,075 |
| `学科竞赛` | `True` | 373,938 | 21,490,019 | 287 | 0 | 0 | 0 | 0.000 | 509 |
| `普通话考试` | `True` | 150,997 | 1,731,223 | 14 | 0 | 0 | 0 | 0.000 | 23 |
| `挑战杯` | `True` | 168,009 | 6,627,562 | 60 | 0 | 0 | 0 | 0.000 | 67 |
| `推免` | `True` | 194,819 | 9,648,543 | 94 | 0 | 0 | 0 | 0.000 | 108 |
| `助学金` | `True` | 363,381 | 25,156,121 | 255 | 0 | 0 | 0 | 0.000 | 505 |
| `国家奖学金` | `True` | 353,321 | 25,121,730 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `困难认定` | `True` | 179,732 | 4,889,512 | 41 | 0 | 0 | 0 | 0.000 | 57 |
| `心理健康` | `True` | 220,310 | 9,997,202 | 92 | 0 | 0 | 0 | 0.000 | 167 |
| `学工` | `True` | 955,993 | 39,231,406 | 540 | 0 | 0 | 0 | 0.000 | 1,910 |
| `竞赛报名` | `True` | 298,644 | 12,765,068 | 196 | 0 | 0 | 0 | 0.000 | 303 |
| `规章制度` | `True` | 672,765 | 20,388,638 | 256 | 0 | 0 | 0 | 0.000 | 1,238 |
| `办事流程` | `True` | 433,235 | 22,304,814 | 230 | 0 | 0 | 0 | 0.000 | 757 |
| `学生相关文件及表格` | `True` | 225,600 | 1,480,594 | 53 | 0 | 0 | 0 | 0.000 | 107 |
| `教务管理系统` | `True` | 695,820 | 19,584,559 | 161 | 0 | 0 | 0 | 0.000 | 797 |
| `信息门户` | `True` | 668,332 | 19,188,935 | 151 | 0 | 0 | 0 | 0.000 | 756 |
| `附件1` | `True` | 754,325 | 28,259,257 | 330 | 0 | 0 | 0 | 0.000 | 1,536 |
| `缓考申请表` | `True` | 140,461 | 46,901 | 2 | 0 | 0 | 0 | 0.000 | 3 |
| `奖学金` | `True` | 346,978 | 25,121,730 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `辅导员` | `True` | 628,140 | 21,380,491 | 250 | 0 | 0 | 0 | 0.000 | 1,094 |
| `双创` | `True` | 179,709 | 3,781,225 | 72 | 0 | 0 | 0 | 0.000 | 93 |
| `互联网+` | `True` | 235,708 | 12,904,091 | 150 | 0 | 0 | 0 | 0.000 | 222 |
| `不存在的查询词` | `True` | 138,961 | 0 | 0 | 0 | 0 | 0 | 0.000 | 0 |
| `a` | `False` | 0 | 0 | 0 | 0 | 0 | 0 | 0.000 | 0 |

## Phase Gates

| Query | First trusted bytes | First trusted ms | Top hydrated bytes | Top hydrated ms | Proof bytes | Passed |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `校历` | 142,343 | 5.986 | 558,328 | 23.030 | 601,875 | `True` |
| `搜校历` | 142,343 | 5.793 | 558,328 | 21.638 | 601,875 | `True` |
| `慕课考试` | 137,012 | 4.677 | 571,247 | 24.477 | 794,505 | `True` |
| `期末考试` | 123,953 | 3.526 | 526,813 | 18.642 | 997,010 | `True` |
| `考试安排` | 131,576 | 4.167 | 542,665 | 17.427 | 1,012,862 | `True` |
| `选课` | 132,491 | 4.805 | 549,093 | 21.078 | 853,850 | `True` |
| `转专业` | 128,749 | 4.340 | 541,314 | 19.030 | 639,933 | `True` |
| `成绩` | 105,723 | 3.517 | 489,982 | 19.564 | 1,310,681 | `True` |
| `通知` | 135,717 | 5.940 | 3,989,728 | 95.924 | 51,311,067 | `True` |
| `学生` | 132,713 | 5.343 | 3,968,896 | 93.747 | 54,616,083 | `True` |
| `查成绩` | 105,723 | 4.570 | 489,982 | 24.769 | 1,310,681 | `True` |
| `成绩查询` | 105,723 | 4.373 | 489,982 | 24.566 | 1,310,681 | `True` |
| `成绩复核申请表` | 105,079 | 4.203 | 491,667 | 16.986 | 1,339,974 | `True` |
| `xlsx` | 128,075 | 4.522 | 525,729 | 22.253 | 1,333,112 | `True` |
| `大创` | 120,652 | 6.919 | 502,819 | 25.998 | 1,114,915 | `True` |
| `学科竞赛` | 113,419 | 6.179 | 463,328 | 24.977 | 699,280 | `True` |
| `普通话考试` | 97,034 | 2.902 | 281,845 | 6.622 | 294,856 | `True` |
| `挑战杯` | 104,596 | 5.246 | 408,295 | 19.608 | 438,318 | `True` |
| `推免` | 113,956 | 5.553 | 486,633 | 24.245 | 543,466 | `True` |
| `助学金` | 104,020 | 4.693 | 453,371 | 22.842 | 678,766 | `True` |
| `国家奖学金` | 101,507 | 4.823 | 454,678 | 24.209 | 670,013 | `True` |
| `困难认定` | 105,967 | 5.531 | 396,027 | 19.301 | 437,773 | `True` |
| `心理健康` | 105,533 | 4.531 | 426,391 | 18.202 | 508,715 | `True` |
| `学工` | 110,219 | 6.001 | 460,051 | 25.270 | 1,278,058 | `True` |
| `竞赛报名` | 140,004 | 8.423 | 566,719 | 36.526 | 727,377 | `True` |
| `规章制度` | 124,069 | 5.930 | 516,534 | 24.911 | 1,051,313 | `True` |
| `办事流程` | 120,512 | 6.257 | 525,520 | 27.243 | 820,769 | `True` |
| `学生相关文件及表格` | 101,798 | 3.461 | 406,645 | 13.648 | 494,259 | `True` |
| `教务管理系统` | 103,365 | 3.784 | 465,771 | 18.623 | 1,023,605 | `True` |
| `信息门户` | 112,267 | 4.737 | 493,265 | 20.976 | 1,023,611 | `True` |
| `附件1` | 136,177 | 6.869 | 594,950 | 26.477 | 1,211,289 | `True` |
| `缓考申请表` | 65,172 | 1.469 | 210,054 | 2.980 | 212,529 | `True` |
| `奖学金` | 97,424 | 4.362 | 447,664 | 23.086 | 656,656 | `True` |
| `辅导员` | 113,754 | 6.092 | 463,542 | 24.977 | 953,696 | `True` |
| `双创` | 108,444 | 4.859 | 481,325 | 25.402 | 523,048 | `True` |
| `互联网+` | 101,838 | 4.219 | 447,385 | 21.408 | 545,107 | `True` |
| `不存在的查询词` | 59,255 | 1.089 | 198,220 | 2.285 | 199,195 | `True` |
| `a` | 0 | 0.000 | 0 | 0.000 | 0 | `True` |

- First trusted hard gate: `<=5,242,880` bytes or `<=10%` of proof bytes.
- Top hydrated hard gate: `<=10,485,760` bytes or `<=25%` of proof bytes.
- Phase gates passed: `True`

## Cache Benchmark

- Query count: `8`
- Max cold uncached bytes: `1,114,915`
- Max warm uncached bytes: `0`
- Total warm cached bytes: `6,628,831`
- Passed: `True`

## Browser Verification

- Passed: `True`
- Persistent cache passed: `True`
- Viewports: `["1280x720", "390x844"]`
- Scenario count: `9`
- Max warm uncached immutable bytes: `0`

## Lower Bound Gap Report

- Objective: Minimize query-dependent bytes and decode work while preserving trusted top-k answers and exhaustive proof semantics.
- Claim boundary: Engineering gates can be passed without proving the mathematical lower bound; the gap entries identify what proof or algorithm is still missing.

| Layer | Status | Current measurement | Gap | Next algorithmic step |
| --- | --- | --- | --- | --- |
| `startup_entry_gap` | `engineering_gate_passed_not_absolute` | {"routed_first_screen_total_bytes": 230155, "bootstrap_manifest_bytes": 16538, "source_registry_bytes": 4805, "global_query_directory_bytes": 205959, "query_aliases_bytes": 2853, "startup_loads_local_indexes": false, "startup_loads_full_shards": false} | Metadata is already separated from local indexes and full shards, but the routed entry payload is still a practical JSON contract rather than an entropy-coded minimal decision table. | Delta-code source/query routing tables and measure whether a compact finite-state router beats the current manifest plus directory bytes without hurting debuggability. |
| `route_planning_gap` | `phase_gate_passed` | {"query_count": 38, "max_candidate_shard_count": 18, "max_loaded_shard_count": 844, "max_uncached_loaded_bytes": 54616083, "phase_gates_passed": true} | The planner emits expected byte costs and phase-local selections, but the route policy is still hand-calibrated rather than learned from an optimal decision rule. | Fit an offline decision policy on the evaluation corpus with byte cost as the Lagrange multiplier, then keep only policies that preserve task quality. |
| `first_trusted_gap` | `phase_gate_passed` | {"max_first_trusted_uncached_bytes": 142343, "absolute_limit_bytes": 5242880, "max_first_trusted_elapsed_ms": 8.423, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | The phase is byte-gated and query-path decode improved versus baseline, but the remaining gap is proving that no loaded local-index byte is irrelevant to the first trusted result. | Add per-term contribution accounting for first-result eligibility and drop zero-contribution term blocks. |
| `top_results_hydrated_gap` | `phase_gate_passed` | {"max_top_results_uncached_bytes": 3989728, "absolute_limit_bytes": 10485760, "max_top_results_elapsed_ms": 95.924, "query_path_mean_current_bytes": 83085, "query_path_bytes_percent_change": null, "query_path_passed": false} | Top results are separated from proof completion, but candidate upper bounds are not yet serialized as a formal certificate that every skipped block is dominated. | Persist block-level score upper bounds and emit a top-k dominance certificate for skipped blocks. |
| `proof_complete_certificate_gap` | `largest_remaining_theoretical_gap` | {"max_proof_complete_uncached_bytes": 54616083, "max_proof_complete_elapsed_ms": 3222.549, "proof_catalog_total_bytes": 756879, "shard_filter_total_bytes": 6050937, "proof_certificate_total_bytes": 6807816, "hot_query_proof_directory_bytes": 137986, "hot_qu... | Correctness is complete, but proof completion can still approach a full-shard read. The mathematical lower bound is a certificate stream, not full document hydration. | Separate false-positive filter pressure from true-match shard pressure, then generate doc/postings or hot-query certificates for true-match-heavy broad queries. |
| `full_shard_dependency_gap` | `known_remaining_dependency` | {"full_scan_total_bytes": 45717182, "proof_certificate_total_bytes": 6807816, "max_full_shard_bytes": 499697, "full_shard_count": 942, "max_proof_complete_uncached_bytes": 54616083} | The serving path no longer depends on full shards for startup or early results, but exhaustive proof still has a full-shard fallback. | Split proof certificates from full document bodies and make full bodies lazy even during proof completion. |
| `packed_index_decode_gap` | `needs_attention` | {"local_index_runtime_bytes": 38087942, "binary_artifact_total_bytes": 25884445, "runtime_byte_change_percent": null, "runtime_decode_change_percent": null, "query_path_passed": false, "body_decode_mode": "packed_query_term_selective", "light_decode_mode": ... | Packed selective decode is active on the hot query path, but block metadata is still decoded at artifact granularity rather than at the exact surviving term/block frontier. | Move to block directory offsets with direct term/block seeks and SIMD/WASM-friendly score scans. |
| `topk_pruning_gap` | `evidence_present` | {"any_dynamic_pruning": true, "total_postings_pruned": 0, "wasm_decision_status": "rust_wasm_retrieval_runtime_selected"} | Dynamic pruning is present, but the report does not yet prove that the pruning order is optimal for every query under the scoring function. | Record WAND/BMW-style upper-bound ledgers per query and compare visited postings against an oracle ordering. |
| `persistent_cache_gap` | `warm_cache_gate_passed` | {"cache_query_count": 8, "max_cold_uncached_bytes": 1114915, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 6628831, "browser_persistent_cache_passed": true} | Warm network bytes are gated locally; remaining lower-bound work is CPU decode reuse and browser-level confirmation when a browser report is missing. | Persist decoded packed-index pages and reuse score-session state across repeated same-version queries. |
| `attachment_semantics_gap` | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "text_extracted": 0... | Attachment evidence is summarized, but there is no per-query proof that the summary is the minimal sufficient statistic for attachment relevance. | Add query-term-to-attachment-evidence attribution and measure dropped attachment fields against task quality. |
| `ranking_calibration_gap` | `task_quality_gate_present` | {"quality_eval_skipped": null, "task_eval_skipped": null, "task_eval_passed": 29, "expectation_count": 29, "max_elapsed_ms": 3227.879} | Quality gates exist, but ranking weights are still an engineered policy rather than a Pareto-optimal model over relevance, trust, recency, and byte cost. | Run ablations over ranking features and fit byte-aware weights that stay on the quality Pareto frontier. |
| `browser_resource_gap` | `browser_verified` | {"browser_report_missing": false, "passed": true, "persistent_cache_passed": true, "viewports": ["1280x720", "390x844"], "scenario_count": 9, "max_warm_uncached_immutable_bytes": 0} | Browser verification is recorded only when the external browser report is present; the CLI report must not claim final browser lower-bound evidence without it. | Keep browser automation as a mandatory artifact and compare network/resource traces per phase. |

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
| 2 | `evidence_present` | {"planner": "Planner telemetry includes route expected_cost_bytes, selected expected_uncached bytes, cache state per local index, and phase-specific local index selections.", "max_first_trusted_uncached_bytes": 142343, "first_trusted_absolu |
| 3 | `evidence_present` | {"any_dynamic_pruning": true, "total_postings_pruned": 0} |
| 4 | `evidence_present` | Measured queries report proof ledger complete with zero pending/failed shards; runtime tests cover no-match proof, failed shard refusal, and cancelled pending-ledger refusal. |
| 5 | `partial` | {"artifact_total_bytes_current": 102844383, "artifact_total_bytes_baseline": 101097287, "runtime_parse_decode_summary": {"baseline_local_index_runtime_bytes": 0, "current_local_index_runtime_bytes": 38087942, "bytes_delta": 38087942, "bytes |
| 6 | `evidence_present` | {"light_json_bytes": 0, "light_split_runtime_bytes": 21222134, "body_json_bytes": 0, "body_packed_runtime_bytes": 16865808, "note": "Packed binary light terms plus metadata JSON are used for query planning; packed binary light/body indexes  |
| 7 | `evidence_present` | {"artifact_count": 246, "benchmark": "packed-impact-retrieval-wasm-vs-typescript-v2", "collection": "apps/web/public/generated/collections/njupt-public", "decision": {"reason": "The browser runtime can consume Rust/WASM stateful score entri |
| 8 | `evidence_present` | {"query_count": 8, "max_cold_uncached_bytes": 1114915, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 6628831, "max_warm_ms": 23.335, "passed": true, "failure_count": 0, "cache_invalidation_test": "Changed content-hash artifact pa |
| 9 | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "t |
| 10 | `evidence_present` | Smoke queries, task queries, measured cold queries, warm cache queries, and a negative query are represented when full report mode is used. |
| 11 | `evidence_present` | {"report": "njupt-search-browser-verification-v17-static-lower-bound", "generated_at": "2026-06-04T09:12:13.257Z", "base_url": "http://127.0.0.1:5194/", "summary": {"passed": true, "scenario_count": 9, "failed": [], "persistent_cache_passed |
| 12 | `external_ci_deploy_required` | Local validators/tests/builds can be recorded separately; CI/deployment status is outside this local report. |
| 13 | `evidence_present` | This report includes byte, time, quality, cache, pruning, parse/decode, and coverage sections. |
| 14 | `unmet` | Commit, push, CI, and deployment checks are intentionally not claimed by this report. |
| 15 | `evidence_present` | {"required_layers": ["startup_entry_gap", "route_planning_gap", "first_trusted_gap", "top_results_hydrated_gap", "proof_complete_certificate_gap", "full_shard_dependency_gap", "packed_index_decode_gap", "topk_pruning_gap", "persistent_cache |

## Reproduction

```powershell
uv run --python 3.13 python -m njupt_search_eval run-lower-bound-report --baseline-ref origin/main --collection apps\web\public\generated\collections\njupt-public --output tools\search-eval\reports\njupt-search-lower-bound-report.json --markdown tools\search-eval\reports\njupt-search-lower-bound-report.md
```

This report is evidence for the active lower-bound goal. It does not claim final completion while DoD items remain unmet.
