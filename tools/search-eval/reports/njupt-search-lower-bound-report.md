# NJUPT Search Lower-Bound Evidence Report

- Generated at: `2026-06-04T13:49:50.399379+00:00`
- Collection: `apps/web/public/generated/collections/njupt-public`
- Baseline ref: `HEAD`
- Current artifact generation: `2026-06-04T13:34:02.509456+00:00`

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
| `routed_first_screen_total_bytes` | 230,178 | 230,155 | -23 | -0.010% |
| `bootstrap_manifest_bytes` | 16,566 | 16,538 | -28 | -0.169% |
| `source_registry_bytes` | 4,805 | 4,805 | 0 | 0.000% |
| `global_query_directory_bytes` | 205,954 | 205,959 | 5 | 0.002% |
| `query_aliases_bytes` | 2,853 | 2,853 | 0 | 0.000% |
| `source_manifest_total_bytes` | 716,754 | 716,754 | 0 | 0.000% |
| `local_impact_light_index_total_bytes` | 0 | 0 | 0 |  |
| `local_impact_light_index_meta_total_bytes` | 12,205,713 | 12,203,497 | -2,216 | -0.018% |
| `local_impact_light_index_packed_total_bytes` | 9,018,953 | 9,018,637 | -316 | -0.004% |
| `local_impact_body_index_total_bytes` | 0 | 0 | 0 |  |
| `local_impact_body_index_packed_total_bytes` | 16,866,150 | 16,865,808 | -342 | -0.002% |
| `light_index_runtime_bytes` | 21,224,666 | 21,222,134 | -2,532 | -0.012% |
| `body_index_bytes` | 0 | 0 | 0 |  |
| `body_index_runtime_bytes` | 16,866,150 | 16,865,808 | -342 | -0.002% |
| `local_index_runtime_bytes` | 38,090,816 | 38,087,942 | -2,874 | -0.008% |
| `proof_catalog_total_bytes` | 756,879 | 756,879 | 0 | 0.000% |
| `shard_filter_total_bytes` | 6,050,937 | 6,050,937 | 0 | 0.000% |
| `proof_certificate_total_bytes` | 6,807,816 | 6,807,816 | 0 | 0.000% |
| `hot_query_proof_directory_bytes` | 137,986 | 137,986 | 0 | 0.000% |
| `hot_query_topk_certificate_total_bytes` | 7,702,333 | 7,696,245 | -6,088 | -0.079% |
| `hot_query_complete_certificate_total_bytes` | 11,879,570 | 11,876,218 | -3,352 | -0.028% |
| `full_scan_total_bytes` | 45,725,582 | 45,717,182 | -8,400 | -0.018% |
| `artifact_total_bytes` | 102,879,496 | 102,844,384 | -35,112 | -0.034% |
| `binary_artifact_total_bytes` | 25,885,103 | 25,884,445 | -658 | -0.003% |
| `runtime_artifact_total_bytes` | 128,764,599 | 128,728,829 | -35,770 | -0.028% |
| `artifact_count` | 1,366 | 1,366 | 0 | 0.000% |
| `binary_artifact_count` | 492 | 492 | 0 | 0.000% |
| `local_index_count` | 246 | 246 | 0 | 0.000% |
| `full_shard_count` | 942 | 942 | 0 | 0.000% |
| `max_full_shard_bytes` | 499,697 | 499,697 | 0 | 0.000% |
| `avg_full_shard_bytes` | 48,540 | 48,532 | -8 | -0.018% |

## Parse And Decode

| Family | Baseline bytes | Current bytes | Baseline mean ms | Current mean ms |
| --- | ---: | ---: | ---: | ---: |
| `bootstrap_json` | 230,178 | 230,155 | 1.500 | 0.952 |
| `source_manifests` | 716,754 | 716,754 | 1.944 | 1.958 |
| `shard_filters_json_and_bitsets` | 6,047,886 | 6,047,886 | 7.568 | 10.889 |
| `local_light_json` | 0 | 0 | 0.000 | 0.000 |
| `local_light_meta_json` | 12,205,713 | 12,203,497 | 41.110 | 41.789 |
| `local_light_packed` | 9,018,953 | 9,018,637 | 840.315 | 828.345 |
| `local_light_packed_query_terms` | 9,018,953 | 9,018,637 | 236.446 | 222.012 |
| `local_body_json` | 0 | 0 | 0.000 | 0.000 |
| `local_body_packed` | 16,866,150 | 16,865,808 | 1737.632 | 1744.411 |
| `local_body_packed_query_terms` | 16,866,150 | 16,865,808 | 415.215 | 404.350 |

## Runtime Query-Term Decode Summary

- Baseline local-index runtime bytes: `38,090,816`
- Current local-index runtime bytes: `38,087,942`
- Runtime byte change: `-0.008%`
- Baseline local-index parse/decode mean: `692.771` ms
- Current query-term parse/decode mean: `668.151` ms
- Parse/decode change: `-3.554%`
- Light decode mode: `metadata_json_plus_packed_query_term_selective`
- Body decode mode: `packed_query_term_selective`

## Query Path Parse And Decode

| Phase | Mean baseline bytes | Mean current bytes | Byte change | Mean baseline ms | Mean current ms | Decode change | Byte gate | Decode within tolerance |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `first_trusted_results` | 0 | 0 | `None%` | 0.000 | 0.000 | `None%` | `True` | `True` |
| `top_results_hydrated` | 83,085 | 83,085 | `0.0%` | 1.327 | 1.400 | `5.508%` | `True` | `False` |
- Query-path byte gate passed: `True`. Decode timing is reported separately with tolerance `5.0%`.

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
| `校历` | 22.100 | 12 | 0 | 0 | 601,877 | 0 | `True` | 2025-2026学年校历 |
| `搜校历` | 23.440 | 12 | 0 | 0 | 601,877 | 0 | `True` | 2025-2026学年校历 |
| `慕课考试` | 22.573 | 12 | 0 | 0 | 794,506 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期在线开放课程（慕课）线下考试报名通知 |
| `期末考试` | 19.087 | 12 | 0 | 0 | 997,010 | 0 | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期期末考试工作安排的通知 |
| `考试安排` | 21.096 | 12 | 0 | 0 | 1,012,862 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期考试安排表 |
| `选课` | 21.051 | 12 | 0 | 0 | 853,850 | 0 | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生课程补改选及重修选课的通知 |
| `转专业` | 19.603 | 12 | 0 | 0 | 639,933 | 0 | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期全日制本科生转专业工作的通知 |
| `成绩` | 24.516 | 12 | 0 | 0 | 1,310,681 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `通知` | 2163.345 | 12 | 18 | 674 | 51,311,066 | 0 | `True` | 【教务管理办公室】关于做好2027届毕业生图像信息采集工作的通知 |
| `学生` | 3099.565 | 12 | 18 | 844 | 54,616,083 | 0 | `True` | 省教育厅关于印发《江苏省高等学校学生企业实习管理规定》的通知 2025-04-08 |
| `查成绩` | 30.613 | 12 | 0 | 0 | 1,310,681 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩查询` | 29.937 | 12 | 0 | 0 | 1,310,681 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩复核申请表` | 29.367 | 12 | 0 | 0 | 1,339,974 | 0 | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `xlsx` | 26.423 | 12 | 0 | 0 | 1,333,112 | 0 | `True` | 关于举办第十二届全国大学生物理实验竞赛（创新）校内选拔赛的通知 |
| `大创` | 31.536 | 12 | 0 | 0 | 1,114,915 | 0 | `True` | 2024年度大学生创新创业训练计划项目结题验收成绩公示 |
| `学科竞赛` | 25.463 | 12 | 0 | 0 | 699,280 | 0 | `True` | 关于组织2026年全国大学生电子设计竞赛(TI杯)及电子信息类系列学科竞赛宣讲及选拔的通知 |
| `普通话考试` | 5.548 | 12 | 0 | 0 | 294,856 | 0 | `True` | 【教务管理办公室】关于2026年上半年普通话考试的通知 |
| `挑战杯` | 21.542 | 12 | 0 | 0 | 438,315 | 0 | `True` | 南邮获“挑战杯”国赛特等奖7项 再捧“优胜杯” |
| `推免` | 27.076 | 12 | 0 | 0 | 543,465 | 0 | `True` | 2026年各学院推荐优秀应届本科毕业生免试攻读研究生工作方案 |
| `助学金` | 25.285 | 12 | 0 | 0 | 678,764 | 0 | `True` | 校学发〔2024〕7号南京邮电大学“鼓楼区绿色低碳奖助学金”实施细则（试行） |
| `国家奖学金` | 24.786 | 12 | 0 | 0 | 670,015 | 0 | `True` | 本科学生国家奖学金评审办法 |
| `困难认定` | 19.138 | 12 | 0 | 0 | 437,775 | 0 | `True` | 家庭经济困难学生认定工作实施办法 |
| `心理健康` | 19.887 | 12 | 0 | 0 | 508,715 | 0 | `True` | 心理健康 |
| `学工` | 30.422 | 12 | 0 | 0 | 1,278,060 | 0 | `True` | 南京工业大学浦江学院学工处来校调研 |
| `竞赛报名` | 35.443 | 12 | 0 | 0 | 727,379 | 0 | `True` | 关于举办“2026年南京邮电大学集成电路创新创业校选拔赛”的通知 |
| `规章制度` | 29.074 | 12 | 0 | 0 | 1,051,313 | 0 | `True` | 南京邮电大学本科教材供应管理办法 2024-04-26 |
| `办事流程` | 29.982 | 12 | 0 | 0 | 820,768 | 0 | `True` | 服兵役学生国家教育资助申请流程 |
| `学生相关文件及表格` | 14.000 | 12 | 0 | 0 | 494,257 | 0 | `True` | 南京邮电大学学生毕业申请表 2026-04-16 |
| `教务管理系统` | 23.155 | 12 | 0 | 0 | 1,023,605 | 0 | `True` | 教务管理系统 |
| `信息门户` | 24.078 | 12 | 0 | 0 | 1,023,611 | 0 | `True` | 教务管理系统 |
| `附件1` | 33.288 | 12 | 0 | 0 | 1,211,289 | 0 | `True` | 【科创竞赛】第九届“外教社杯”全国高校学生跨文化能力大赛南京邮电大学校园赛通知 |
| `缓考申请表` | 3.146 | 3 | 0 | 0 | 212,531 | 0 | `True` | 南京邮电大学学生缓考申请表 2026-04-16 |
| `奖学金` | 23.100 | 12 | 0 | 0 | 656,659 | 0 | `True` | 南京邮电大学2024-2025学年“甘霖励志奖学金”拟推荐名单公示 |
| `辅导员` | 27.073 | 12 | 0 | 0 | 953,696 | 0 | `True` | 红色校史润心田，南邮精神永相传 —— 第四届辅导员宣讲团 走进教育科学与技术学院 |
| `双创` | 27.262 | 12 | 0 | 0 | 523,047 | 0 | `True` | 双创信息管理系统 |
| `互联网+` | 22.691 | 12 | 0 | 0 | 545,107 | 0 | `True` | 南京邮电大学第五届 “互联网+”大学生创新创业大赛成绩公示 |
| `不存在的查询词` | 2.640 | 0 | 0 | 0 | 199,195 | 0 | `True` |  |
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
| `校历` | 142,345 | 5.185 | 558,330 | 21.342 | 601,877 | `True` |
| `搜校历` | 142,345 | 5.083 | 558,330 | 22.616 | 601,877 | `True` |
| `慕课考试` | 137,013 | 4.799 | 571,248 | 20.872 | 794,506 | `True` |
| `期末考试` | 123,953 | 3.561 | 526,813 | 15.805 | 997,010 | `True` |
| `考试安排` | 131,576 | 3.596 | 542,665 | 17.059 | 1,012,862 | `True` |
| `选课` | 132,491 | 4.061 | 549,093 | 18.638 | 853,850 | `True` |
| `转专业` | 128,749 | 4.123 | 541,314 | 18.511 | 639,933 | `True` |
| `成绩` | 105,723 | 3.506 | 489,982 | 17.191 | 1,310,681 | `True` |
| `通知` | 135,716 | 4.788 | 3,989,727 | 85.433 | 51,311,066 | `True` |
| `学生` | 132,713 | 4.436 | 3,968,896 | 84.056 | 54,616,083 | `True` |
| `查成绩` | 105,723 | 4.265 | 489,982 | 22.779 | 1,310,681 | `True` |
| `成绩查询` | 105,723 | 3.990 | 489,982 | 22.159 | 1,310,681 | `True` |
| `成绩复核申请表` | 105,079 | 3.644 | 491,667 | 21.122 | 1,339,974 | `True` |
| `xlsx` | 128,075 | 4.901 | 525,729 | 20.799 | 1,333,112 | `True` |
| `大创` | 120,652 | 5.916 | 502,819 | 27.006 | 1,114,915 | `True` |
| `学科竞赛` | 113,419 | 5.456 | 463,328 | 23.270 | 699,280 | `True` |
| `普通话考试` | 97,034 | 2.123 | 281,845 | 5.068 | 294,856 | `True` |
| `挑战杯` | 104,593 | 5.468 | 408,292 | 20.736 | 438,315 | `True` |
| `推免` | 113,955 | 5.385 | 486,632 | 26.152 | 543,465 | `True` |
| `助学金` | 104,019 | 4.678 | 453,369 | 23.109 | 678,764 | `True` |
| `国家奖学金` | 101,509 | 4.424 | 454,680 | 22.664 | 670,015 | `True` |
| `困难认定` | 105,969 | 4.961 | 396,029 | 18.194 | 437,775 | `True` |
| `心理健康` | 105,533 | 4.337 | 426,391 | 18.695 | 508,715 | `True` |
| `学工` | 110,221 | 6.041 | 460,053 | 24.335 | 1,278,060 | `True` |
| `竞赛报名` | 140,005 | 7.667 | 566,721 | 33.337 | 727,379 | `True` |
| `规章制度` | 124,069 | 5.464 | 516,534 | 24.288 | 1,051,313 | `True` |
| `办事流程` | 120,511 | 5.803 | 525,519 | 26.750 | 820,768 | `True` |
| `学生相关文件及表格` | 101,796 | 3.208 | 406,643 | 12.985 | 494,257 | `True` |
| `教务管理系统` | 103,365 | 3.349 | 465,771 | 18.648 | 1,023,605 | `True` |
| `信息门户` | 112,267 | 3.144 | 493,265 | 19.258 | 1,023,611 | `True` |
| `附件1` | 136,177 | 6.177 | 594,950 | 27.907 | 1,211,289 | `True` |
| `缓考申请表` | 65,173 | 1.316 | 210,056 | 2.855 | 212,531 | `True` |
| `奖学金` | 97,425 | 3.952 | 447,667 | 21.162 | 656,659 | `True` |
| `辅导员` | 113,755 | 5.915 | 463,542 | 22.349 | 953,696 | `True` |
| `双创` | 108,443 | 5.295 | 481,324 | 26.412 | 523,047 | `True` |
| `互联网+` | 101,838 | 4.328 | 447,385 | 21.528 | 545,107 | `True` |
| `不存在的查询词` | 59,255 | 1.138 | 198,220 | 2.365 | 199,195 | `True` |
| `a` | 0 | 0.000 | 0 | 0.000 | 0 | `True` |

- First trusted hard gate: `<=5,242,880` bytes or `<=10%` of proof bytes.
- Top hydrated hard gate: `<=10,485,760` bytes or `<=25%` of proof bytes.
- Phase gates passed: `True`

## Cache Benchmark

- Query count: `8`
- Max cold uncached bytes: `1,114,915`
- Max warm uncached bytes: `0`
- Total warm cached bytes: `6,628,835`
- Passed: `True`

## Browser Verification

- Passed: `True`
- Persistent cache passed: `True`
- Viewports: `["1280x720", "390x844"]`
- Scenario count: `11`
- Max warm uncached immutable bytes: `0`

## Lower Bound Gap Report

- Objective: Minimize query-dependent bytes and decode work while preserving trusted top-k answers and exhaustive proof semantics.
- Claim boundary: Engineering gates can be passed without proving the mathematical lower bound; the gap entries identify what proof or algorithm is still missing.

| Layer | Status | Current measurement | Gap | Next algorithmic step |
| --- | --- | --- | --- | --- |
| `startup_entry_gap` | `engineering_gate_passed_not_absolute` | {"routed_first_screen_total_bytes": 230155, "bootstrap_manifest_bytes": 16538, "source_registry_bytes": 4805, "global_query_directory_bytes": 205959, "query_aliases_bytes": 2853, "startup_loads_local_indexes": false, "startup_loads_full_shards": false} | Metadata is already separated from local indexes and full shards, but the routed entry payload is still a practical JSON contract rather than an entropy-coded minimal decision table. | Delta-code source/query routing tables and measure whether a compact finite-state router beats the current manifest plus directory bytes without hurting debuggability. |
| `route_planning_gap` | `phase_gate_passed` | {"query_count": 38, "max_candidate_shard_count": 18, "max_loaded_shard_count": 844, "max_uncached_loaded_bytes": 54616083, "phase_gates_passed": true} | The planner emits expected byte costs and phase-local selections, but the route policy is still hand-calibrated rather than learned from an optimal decision rule. | Fit an offline decision policy on the evaluation corpus with byte cost as the Lagrange multiplier, then keep only policies that preserve task quality. |
| `first_trusted_gap` | `phase_gate_passed` | {"max_first_trusted_uncached_bytes": 142345, "absolute_limit_bytes": 5242880, "max_first_trusted_elapsed_ms": 7.667, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | The phase is byte-gated and query-path decode improved versus baseline, but the remaining gap is proving that no loaded local-index byte is irrelevant to the first trusted result. | Add per-term contribution accounting for first-result eligibility and drop zero-contribution term blocks. |
| `top_results_hydrated_gap` | `phase_gate_passed` | {"max_top_results_uncached_bytes": 3989727, "absolute_limit_bytes": 10485760, "max_top_results_elapsed_ms": 85.433, "query_path_mean_current_bytes": 83085, "query_path_bytes_percent_change": 0.0, "query_path_passed": true} | Top results are separated from proof completion, but candidate upper bounds are not yet serialized as a formal certificate that every skipped block is dominated. | Persist block-level score upper bounds and emit a top-k dominance certificate for skipped blocks. |
| `proof_complete_certificate_gap` | `largest_remaining_theoretical_gap` | {"max_proof_complete_uncached_bytes": 54616083, "max_proof_complete_elapsed_ms": 3095.404, "proof_catalog_total_bytes": 756879, "shard_filter_total_bytes": 6050937, "proof_certificate_total_bytes": 6807816, "hot_query_proof_directory_bytes": 137986, "hot_qu... | Correctness is complete, but proof completion can still approach a full-shard read. The mathematical lower bound is a certificate stream, not full document hydration. | Separate false-positive filter pressure from true-match shard pressure, then generate doc/postings or hot-query certificates for true-match-heavy broad queries. |
| `full_shard_dependency_gap` | `known_remaining_dependency` | {"full_scan_total_bytes": 45717182, "proof_certificate_total_bytes": 6807816, "max_full_shard_bytes": 499697, "full_shard_count": 942, "max_proof_complete_uncached_bytes": 54616083} | The serving path no longer depends on full shards for startup or early results, but exhaustive proof still has a full-shard fallback. | Split proof certificates from full document bodies and make full bodies lazy even during proof completion. |
| `packed_index_decode_gap` | `query_path_gate_passed` | {"local_index_runtime_bytes": 38087942, "binary_artifact_total_bytes": 25884445, "runtime_byte_change_percent": -0.008, "runtime_decode_change_percent": -3.554, "query_path_passed": true, "body_decode_mode": "packed_query_term_selective", "light_decode_mode... | Packed selective decode is active on the hot query path, but block metadata is still decoded at artifact granularity rather than at the exact surviving term/block frontier. | Move to block directory offsets with direct term/block seeks and SIMD/WASM-friendly score scans. |
| `topk_pruning_gap` | `evidence_present` | {"any_dynamic_pruning": true, "total_postings_pruned": 0, "wasm_decision_status": "rust_wasm_retrieval_runtime_selected"} | Dynamic pruning is present, but the report does not yet prove that the pruning order is optimal for every query under the scoring function. | Record WAND/BMW-style upper-bound ledgers per query and compare visited postings against an oracle ordering. |
| `persistent_cache_gap` | `warm_cache_gate_passed` | {"cache_query_count": 8, "max_cold_uncached_bytes": 1114915, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 6628835, "browser_persistent_cache_passed": true} | Warm network bytes are gated locally; remaining lower-bound work is CPU decode reuse and browser-level confirmation when a browser report is missing. | Persist decoded packed-index pages and reuse score-session state across repeated same-version queries. |
| `attachment_semantics_gap` | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "text_extracted": 0... | Attachment evidence is summarized, but there is no per-query proof that the summary is the minimal sufficient statistic for attachment relevance. | Add query-term-to-attachment-evidence attribution and measure dropped attachment fields against task quality. |
| `ranking_calibration_gap` | `task_quality_gate_present` | {"quality_eval_skipped": null, "task_eval_skipped": null, "task_eval_passed": 29, "expectation_count": 29, "max_elapsed_ms": 3099.565} | Quality gates exist, but ranking weights are still an engineered policy rather than a Pareto-optimal model over relevance, trust, recency, and byte cost. | Run ablations over ranking features and fit byte-aware weights that stay on the quality Pareto frontier. |
| `browser_resource_gap` | `browser_verified` | {"browser_report_missing": false, "passed": true, "persistent_cache_passed": true, "viewports": ["1280x720", "390x844"], "scenario_count": 11, "max_warm_uncached_immutable_bytes": 0} | Browser verification is recorded only when the external browser report is present; the CLI report must not claim final browser lower-bound evidence without it. | Keep browser automation as a mandatory artifact and compare network/resource traces per phase. |

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
| 2 | `evidence_present` | {"planner": "Planner telemetry includes route expected_cost_bytes, selected expected_uncached bytes, cache state per local index, and phase-specific local index selections.", "max_first_trusted_uncached_bytes": 142345, "first_trusted_absolu |
| 3 | `evidence_present` | {"any_dynamic_pruning": true, "total_postings_pruned": 0} |
| 4 | `evidence_present` | Measured queries report proof ledger complete with zero pending/failed shards; runtime tests cover no-match proof, failed shard refusal, and cancelled pending-ledger refusal. |
| 5 | `evidence_present` | {"artifact_total_bytes_current": 102844384, "artifact_total_bytes_baseline": 102879496, "runtime_parse_decode_summary": {"baseline_local_index_runtime_bytes": 38090816, "current_local_index_runtime_bytes": 38087942, "bytes_delta": -2874, "b |
| 6 | `evidence_present` | {"light_json_bytes": 0, "light_split_runtime_bytes": 21222134, "body_json_bytes": 0, "body_packed_runtime_bytes": 16865808, "note": "Packed binary light terms plus metadata JSON are used for query planning; packed binary light/body indexes  |
| 7 | `evidence_present` | {"artifact_count": 246, "benchmark": "packed-impact-retrieval-wasm-vs-typescript-v2", "collection": "apps/web/public/generated/collections/njupt-public", "decision": {"reason": "The browser runtime can consume Rust/WASM stateful score entri |
| 8 | `evidence_present` | {"query_count": 8, "max_cold_uncached_bytes": 1114915, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 6628835, "max_warm_ms": 24.199, "passed": true, "failure_count": 0, "cache_invalidation_test": "Changed content-hash artifact pa |
| 9 | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "t |
| 10 | `evidence_present` | Smoke queries, task queries, measured cold queries, warm cache queries, and a negative query are represented when full report mode is used. |
| 11 | `evidence_present` | {"report": "njupt-search-browser-verification-v20-local-architecture-final", "generated_at": "2026-06-04T13:43:58.940Z", "base_url": "http://127.0.0.1:4177/", "summary": {"passed": true, "scenario_count": 11, "failed": [], "persistent_cache |
| 12 | `external_ci_deploy_required` | Local validators/tests/builds can be recorded separately; CI/deployment status is outside this local report. |
| 13 | `evidence_present` | This report includes byte, time, quality, cache, pruning, parse/decode, and coverage sections. |
| 14 | `unmet` | Commit, push, CI, and deployment checks are intentionally not claimed by this report. |
| 15 | `evidence_present` | {"required_layers": ["startup_entry_gap", "route_planning_gap", "first_trusted_gap", "top_results_hydrated_gap", "proof_complete_certificate_gap", "full_shard_dependency_gap", "packed_index_decode_gap", "topk_pruning_gap", "persistent_cache |

## Reproduction

```powershell
uv run --python 3.13 python -m njupt_search_eval run-lower-bound-report --baseline-ref HEAD --collection apps\web\public\generated\collections\njupt-public --output tools\search-eval\reports\njupt-search-lower-bound-report.json --markdown tools\search-eval\reports\njupt-search-lower-bound-report.md
```

This report is evidence for the active lower-bound goal. It does not claim final completion while DoD items remain unmet.
