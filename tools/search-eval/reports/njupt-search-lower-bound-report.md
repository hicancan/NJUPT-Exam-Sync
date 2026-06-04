# NJUPT Search Lower-Bound Evidence Report

- Generated at: `2026-06-04T16:44:17.449120+00:00`
- Collection: `apps/web/public/generated/collections/njupt-public`
- Baseline ref: `HEAD`
- Current artifact generation: `2026-06-04T16:27:01.186348+00:00`

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
| `bootstrap_manifest_bytes` | 16,566 | 16,538 | -28 | -0.169% |
| `source_registry_bytes` | 4,805 | 4,805 | 0 | 0.000% |
| `global_query_directory_bytes` | 205,953 | 205,959 | 6 | 0.003% |
| `query_aliases_bytes` | 2,853 | 2,853 | 0 | 0.000% |
| `source_manifest_total_bytes` | 716,754 | 716,754 | 0 | 0.000% |
| `local_impact_light_index_total_bytes` | 0 | 0 | 0 |  |
| `local_impact_light_index_meta_total_bytes` | 12,206,749 | 12,203,497 | -3,252 | -0.027% |
| `local_impact_light_index_packed_total_bytes` | 9,019,023 | 9,018,637 | -386 | -0.004% |
| `local_impact_body_index_total_bytes` | 0 | 0 | 0 |  |
| `local_impact_body_index_packed_total_bytes` | 16,866,162 | 16,865,808 | -354 | -0.002% |
| `light_index_runtime_bytes` | 21,225,772 | 21,222,134 | -3,638 | -0.017% |
| `body_index_bytes` | 0 | 0 | 0 |  |
| `body_index_runtime_bytes` | 16,866,162 | 16,865,808 | -354 | -0.002% |
| `local_index_runtime_bytes` | 38,091,934 | 38,087,942 | -3,992 | -0.010% |
| `proof_catalog_total_bytes` | 756,879 | 756,879 | 0 | 0.000% |
| `shard_filter_total_bytes` | 6,050,937 | 6,050,937 | 0 | 0.000% |
| `proof_certificate_total_bytes` | 6,807,816 | 6,807,816 | 0 | 0.000% |
| `hot_query_proof_directory_bytes` | 137,986 | 141,654 | 3,668 | 2.658% |
| `hot_query_topk_certificate_total_bytes` | 7,702,331 | 8,526,117 | 823,786 | 10.695% |
| `hot_query_complete_certificate_total_bytes` | 11,879,574 | 3,533,558 | -8,346,016 | -70.255% |
| `full_scan_total_bytes` | 45,726,825 | 45,717,182 | -9,643 | -0.021% |
| `artifact_total_bytes` | 102,881,910 | 95,335,412 | -7,546,498 | -7.335% |
| `binary_artifact_total_bytes` | 25,885,185 | 25,884,445 | -740 | -0.003% |
| `runtime_artifact_total_bytes` | 128,767,095 | 121,219,857 | -7,547,238 | -5.861% |
| `artifact_count` | 1,366 | 1,372 | 6 | 0.439% |
| `binary_artifact_count` | 492 | 492 | 0 | 0.000% |
| `local_index_count` | 246 | 246 | 0 | 0.000% |
| `full_shard_count` | 942 | 942 | 0 | 0.000% |
| `max_full_shard_bytes` | 499,697 | 499,697 | 0 | 0.000% |
| `avg_full_shard_bytes` | 48,542 | 48,532 | -10 | -0.021% |

## Parse And Decode

| Family | Baseline bytes | Current bytes | Baseline mean ms | Current mean ms |
| --- | ---: | ---: | ---: | ---: |
| `bootstrap_json` | 230,177 | 230,155 | 0.922 | 0.949 |
| `source_manifests` | 716,754 | 716,754 | 2.277 | 2.205 |
| `shard_filters_json_and_bitsets` | 6,047,886 | 6,047,886 | 10.050 | 11.090 |
| `local_light_json` | 0 | 0 | 0.000 | 0.000 |
| `local_light_meta_json` | 12,206,749 | 12,203,497 | 33.466 | 34.192 |
| `local_light_packed` | 9,019,023 | 9,018,637 | 876.228 | 756.914 |
| `local_light_packed_query_terms` | 9,019,023 | 9,018,637 | 205.843 | 203.593 |
| `local_body_json` | 0 | 0 | 0.000 | 0.000 |
| `local_body_packed` | 16,866,162 | 16,865,808 | 1568.003 | 1600.360 |
| `local_body_packed_query_terms` | 16,866,162 | 16,865,808 | 482.116 | 440.659 |

## Runtime Query-Term Decode Summary

- Baseline local-index runtime bytes: `38,091,934`
- Current local-index runtime bytes: `38,087,942`
- Runtime byte change: `-0.01%`
- Baseline local-index parse/decode mean: `721.425` ms
- Current query-term parse/decode mean: `678.444` ms
- Parse/decode change: `-5.958%`
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
- TypeScript decode mean ms: `680.869`
- WASM materialized decode mean ms: `741.618`
- WASM stats-only decode mean ms: `44.771`
- TypeScript retrieval kernel mean ms: `3941.645`
- WASM stateless retrieval kernel mean ms: `377.284`
- WASM stateful retrieval session mean ms: `511.046`
- WASM stateful retrieval score bridge mean ms: `523.395`
- Reason: The browser runtime can consume Rust/WASM stateful score entries directly. On the full packed body workload, the Rust/WASM session score bridge was 0.133x the TypeScript selective retrieval kernel for the same artifact format, query set, and global top-k pruning state.

## Query Measurements

| Query | Class | ms | Results | Candidate shards | Loaded shards | Uncached bytes | Pruned postings | Bottleneck | Complete | Top result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| `校历` | `hot` | 33.687 | 12 | 0 | 0 | 577,237 | 0 | `certificate_path` | `True` | 2025-2026学年校历 |
| `搜校历` | `hot_alias` | 28.434 | 12 | 0 | 0 | 577,237 | 0 | `certificate_path` | `True` | 2025-2026学年校历 |
| `慕课考试` | `hot` | 33.141 | 12 | 0 | 0 | 618,386 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期在线开放课程（慕课）线下考试报名通知 |
| `期末考试` | `hot` | 26.695 | 12 | 0 | 0 | 610,247 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期期末考试工作安排的通知 |
| `考试安排` | `hot` | 26.242 | 12 | 0 | 0 | 626,099 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期考试安排表 |
| `选课` | `hot` | 23.699 | 12 | 0 | 0 | 628,467 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生课程补改选及重修选课的通知 |
| `转专业` | `hot` | 18.946 | 12 | 0 | 0 | 575,860 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期全日制本科生转专业工作的通知 |
| `成绩` | `hot` | 24.939 | 12 | 0 | 0 | 670,152 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `通知` | `hot` | 44.556 | 12 | 0 | 0 | 949,142 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于做好2027届毕业生图像信息采集工作的通知 |
| `学生` | `hot` | 43.735 | 12 | 0 | 0 | 993,544 | 0 | `certificate_path` | `True` | 省教育厅关于印发《江苏省高等学校学生企业实习管理规定》的通知 2025-04-08 |
| `南京邮电大学` | `hot` | 33.603 | 12 | 0 | 0 | 855,684 | 0 | `certificate_path` | `True` | AI科技赋能数字展示 ——南京邮电大学举办 “企业家进高校”前沿大课堂 2026-05-29 |
| `申请` | `hot` | 20.921 | 12 | 0 | 0 | 638,958 | 0 | `certificate_path` | `True` | 教材选用预订更换相关申请材料（凡选必审） |
| `考试` | `hot` | 24.159 | 12 | 0 | 0 | 680,201 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期考试安排表 |
| `查成绩` | `hot_alias` | 24.353 | 12 | 0 | 0 | 670,152 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩查询` | `hot_alias` | 27.739 | 12 | 0 | 0 | 670,152 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩复核申请表` | `hot` | 24.754 | 12 | 0 | 0 | 673,588 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `xlsx` | `hot` | 22.673 | 12 | 0 | 0 | 689,939 | 0 | `certificate_path` | `True` | 关于举办第十二届全国大学生物理实验竞赛（创新）校内选拔赛的通知 |
| `大创` | `hot` | 23.596 | 12 | 0 | 0 | 623,864 | 0 | `certificate_path` | `True` | 2024年度大学生创新创业训练计划项目结题验收成绩公示 |
| `学科竞赛` | `hot` | 19.593 | 12 | 0 | 0 | 527,598 | 0 | `certificate_path` | `True` | 关于组织2026年全国大学生电子设计竞赛(TI杯)及电子信息类系列学科竞赛宣讲及选拔的通知 |
| `普通话考试` | `hot` | 5.449 | 12 | 0 | 0 | 289,530 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于2026年上半年普通话考试的通知 |
| `挑战杯` | `hot` | 15.754 | 12 | 0 | 0 | 423,332 | 0 | `certificate_path` | `True` | 南邮获“挑战杯”国赛特等奖7项 再捧“优胜杯” |
| `推免` | `hot` | 18.168 | 12 | 0 | 0 | 508,125 | 0 | `certificate_path` | `True` | 2026年各学院推荐优秀应届本科毕业生免试攻读研究生工作方案 |
| `助学金` | `hot` | 18.517 | 12 | 0 | 0 | 514,809 | 0 | `certificate_path` | `True` | 校学发〔2024〕7号南京邮电大学“鼓楼区绿色低碳奖助学金”实施细则（试行） |
| `国家奖学金` | `hot` | 18.538 | 12 | 0 | 0 | 515,480 | 0 | `certificate_path` | `True` | 本科学生国家奖学金评审办法 |
| `困难认定` | `hot` | 15.130 | 12 | 0 | 0 | 409,279 | 0 | `certificate_path` | `True` | 家庭经济困难学生认定工作实施办法 |
| `心理健康` | `hot` | 14.242 | 12 | 0 | 0 | 451,382 | 0 | `certificate_path` | `True` | 心理健康 |
| `学工` | `hot` | 25.903 | 12 | 0 | 0 | 636,520 | 0 | `certificate_path` | `True` | 南京工业大学浦江学院学工处来校调研 |
| `竞赛报名` | `hot` | 25.972 | 12 | 0 | 0 | 611,655 | 0 | `certificate_path` | `True` | 关于举办“2026年南京邮电大学集成电路创新创业校选拔赛”的通知 |
| `规章制度` | `hot` | 22.310 | 12 | 0 | 0 | 618,399 | 0 | `certificate_path` | `True` | 南京邮电大学本科教材供应管理办法 2024-04-26 |
| `办事流程` | `hot` | 24.087 | 12 | 0 | 0 | 596,912 | 0 | `certificate_path` | `True` | 服兵役学生国家教育资助申请流程 |
| `学生相关文件及表格` | `hot` | 10.554 | 12 | 0 | 0 | 423,807 | 0 | `certificate_path` | `True` | 南京邮电大学学生毕业申请表 2026-04-16 |
| `教务管理系统` | `hot` | 17.437 | 12 | 0 | 0 | 539,092 | 0 | `certificate_path` | `True` | 教务管理系统 |
| `信息门户` | `hot` | 21.133 | 12 | 0 | 0 | 563,134 | 0 | `certificate_path` | `True` | 教务管理系统 |
| `附件1` | `hot` | 28.169 | 12 | 0 | 0 | 721,658 | 0 | `certificate_path` | `True` | 【科创竞赛】第九届“外教社杯”全国高校学生跨文化能力大赛南京邮电大学校园赛通知 |
| `缓考申请表` | `hot` | 2.327 | 3 | 0 | 0 | 215,267 | 0 | `certificate_path` | `True` | 南京邮电大学学生缓考申请表 2026-04-16 |
| `奖学金` | `hot` | 17.072 | 12 | 0 | 0 | 508,114 | 0 | `certificate_path` | `True` | 南京邮电大学2024-2025学年“甘霖励志奖学金”拟推荐名单公示 |
| `辅导员` | `hot` | 22.324 | 12 | 0 | 0 | 557,586 | 0 | `certificate_path` | `True` | 红色校史润心田，南邮精神永相传 —— 第四届辅导员宣讲团 走进教育科学与技术学院 |
| `双创` | `hot` | 19.681 | 12 | 0 | 0 | 499,868 | 0 | `certificate_path` | `True` | 双创信息管理系统 |
| `互联网+` | `hot` | 16.716 | 12 | 0 | 0 | 480,741 | 0 | `certificate_path` | `True` | 南京邮电大学第五届 “互联网+”大学生创新创业大赛成绩公示 |
| `不存在的查询词` | `hot` | 1.642 | 0 | 0 | 0 | 203,083 | 0 | `certificate_path` | `True` |  |
| `a` | `degenerate` | 0.017 | 0 | 0 | 0 | 0 | 0 | `certificate_path` | `True` |  |

## Query Class Summary

| Class | Queries | Max first bytes | Max top bytes | Max proof bytes | Max ms | Dominant bottlenecks |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `degenerate` | 1 | 0 | 0 | 0 | 0.017 | {"certificate_path": 1} |
| `hot` | 37 | 142,345 | 598,618 | 993,544 | 44.556 | {"certificate_path": 37} |
| `hot_alias` | 3 | 142,345 | 561,998 | 670,152 | 28.434 | {"certificate_path": 3} |

## Proof Scan Pressure

| Query | Certificate | Certificate bytes | Avoided match-shard bytes | True-match shards | False-positive shards | True-match bytes | False-positive bytes | False-positive byte ratio | True-match docs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `校历` | `True` | 156,893 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `搜校历` | `True` | 156,893 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `慕课考试` | `True` | 185,124 | 16,376,270 | 153 | 0 | 0 | 0 | 0.000 | 433 |
| `期末考试` | `True` | 221,420 | 18,334,896 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `考试安排` | `True` | 221,420 | 18,334,896 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `选课` | `True` | 217,360 | 28,458,910 | 283 | 0 | 0 | 0 | 0.000 | 762 |
| `转专业` | `True` | 172,532 | 18,027,905 | 160 | 0 | 0 | 0 | 0.000 | 205 |
| `成绩` | `True` | 318,156 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `通知` | `True` | 529,417 | 39,192,844 | 612 | 0 | 0 | 0 | 0.000 | 5,281 |
| `学生` | `True` | 606,727 | 45,222,273 | 839 | 0 | 0 | 0 | 0.000 | 6,842 |
| `南京邮电大学` | `True` | 449,777 | 43,918,188 | 716 | 0 | 0 | 0 | 0.000 | 4,035 |
| `申请` | `True` | 262,339 | 26,552,943 | 316 | 0 | 0 | 0 | 0.000 | 1,551 |
| `考试` | `True` | 307,848 | 16,238,955 | 155 | 0 | 0 | 0 | 0.000 | 2,590 |
| `查成绩` | `True` | 318,156 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `成绩查询` | `True` | 318,156 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `成绩复核申请表` | `True` | 319,913 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `xlsx` | `True` | 302,197 | 30,979,612 | 393 | 0 | 0 | 0 | 0.000 | 2,053 |
| `大创` | `True` | 259,031 | 35,239,561 | 471 | 0 | 0 | 0 | 0.000 | 1,075 |
| `学科竞赛` | `True` | 202,256 | 21,490,019 | 287 | 0 | 0 | 0 | 0.000 | 509 |
| `普通话考试` | `True` | 145,671 | 1,731,223 | 14 | 0 | 0 | 0 | 0.000 | 23 |
| `挑战杯` | `True` | 153,023 | 6,627,562 | 60 | 0 | 0 | 0 | 0.000 | 67 |
| `推免` | `True` | 159,478 | 9,648,543 | 94 | 0 | 0 | 0 | 0.000 | 108 |
| `助学金` | `True` | 199,425 | 25,156,121 | 255 | 0 | 0 | 0 | 0.000 | 505 |
| `国家奖学金` | `True` | 198,787 | 25,121,730 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `困难认定` | `True` | 151,236 | 4,889,512 | 41 | 0 | 0 | 0 | 0.000 | 57 |
| `心理健康` | `True` | 162,977 | 9,997,202 | 92 | 0 | 0 | 0 | 0.000 | 167 |
| `学工` | `True` | 314,453 | 39,231,406 | 540 | 0 | 0 | 0 | 0.000 | 1,910 |
| `竞赛报名` | `True` | 182,920 | 12,765,068 | 196 | 0 | 0 | 0 | 0.000 | 303 |
| `规章制度` | `True` | 239,851 | 20,388,638 | 256 | 0 | 0 | 0 | 0.000 | 1,238 |
| `办事流程` | `True` | 209,379 | 22,304,814 | 230 | 0 | 0 | 0 | 0.000 | 757 |
| `学生相关文件及表格` | `True` | 155,148 | 1,480,594 | 53 | 0 | 0 | 0 | 0.000 | 107 |
| `教务管理系统` | `True` | 211,307 | 19,584,559 | 161 | 0 | 0 | 0 | 0.000 | 797 |
| `信息门户` | `True` | 207,855 | 19,188,935 | 151 | 0 | 0 | 0 | 0.000 | 756 |
| `附件1` | `True` | 264,694 | 28,259,257 | 330 | 0 | 0 | 0 | 0.000 | 1,536 |
| `缓考申请表` | `True` | 143,197 | 46,901 | 2 | 0 | 0 | 0 | 0.000 | 3 |
| `奖学金` | `True` | 198,433 | 25,121,730 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `辅导员` | `True` | 232,029 | 21,380,491 | 250 | 0 | 0 | 0 | 0.000 | 1,094 |
| `双创` | `True` | 156,529 | 3,781,225 | 72 | 0 | 0 | 0 | 0.000 | 93 |
| `互联网+` | `True` | 171,342 | 12,904,091 | 150 | 0 | 0 | 0 | 0.000 | 222 |
| `不存在的查询词` | `True` | 142,849 | 0 | 0 | 0 | 0 | 0 | 0.000 | 0 |
| `a` | `False` | 0 | 0 | 0 | 0 | 0 | 0 | 0.000 | 0 |

## Phase Gates

| Query | First trusted bytes | First trusted ms | Top hydrated bytes | Top hydrated ms | Proof bytes | Passed |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `校历` | 142,345 | 7.537 | 561,998 | 32.488 | 577,237 | `True` |
| `搜校历` | 142,345 | 7.254 | 561,998 | 27.454 | 577,237 | `True` |
| `慕课考试` | 137,013 | 6.415 | 574,916 | 30.607 | 618,386 | `True` |
| `期末考试` | 123,953 | 4.223 | 530,481 | 20.706 | 610,247 | `True` |
| `考试安排` | 131,576 | 5.014 | 546,333 | 21.316 | 626,099 | `True` |
| `选课` | 132,491 | 4.850 | 552,761 | 20.263 | 628,467 | `True` |
| `转专业` | 128,749 | 3.655 | 544,982 | 17.646 | 575,860 | `True` |
| `成绩` | 105,723 | 2.772 | 493,650 | 15.993 | 670,152 | `True` |
| `通知` | 135,717 | 4.466 | 561,379 | 18.714 | 949,142 | `True` |
| `学生` | 132,713 | 4.253 | 528,471 | 17.369 | 993,544 | `True` |
| `南京邮电大学` | 114,144 | 3.541 | 547,561 | 17.952 | 855,684 | `True` |
| `申请` | 138,452 | 4.106 | 518,273 | 14.921 | 638,958 | `True` |
| `考试` | 123,959 | 3.136 | 514,007 | 13.689 | 680,201 | `True` |
| `查成绩` | 105,723 | 3.100 | 493,650 | 16.379 | 670,152 | `True` |
| `成绩查询` | 105,723 | 2.943 | 493,650 | 15.996 | 670,152 | `True` |
| `成绩复核申请表` | 105,077 | 2.598 | 495,329 | 15.189 | 673,588 | `True` |
| `xlsx` | 128,074 | 3.668 | 529,396 | 15.348 | 689,939 | `True` |
| `大创` | 120,652 | 4.407 | 506,487 | 19.364 | 623,864 | `True` |
| `学科竞赛` | 113,419 | 3.903 | 466,996 | 17.402 | 527,598 | `True` |
| `普通话考试` | 97,034 | 2.351 | 285,513 | 5.114 | 289,530 | `True` |
| `挑战杯` | 104,596 | 3.580 | 411,963 | 15.019 | 423,332 | `True` |
| `推免` | 113,956 | 3.895 | 490,301 | 17.335 | 508,125 | `True` |
| `助学金` | 104,020 | 3.558 | 457,038 | 16.432 | 514,809 | `True` |
| `国家奖学金` | 101,509 | 3.204 | 458,347 | 16.243 | 515,480 | `True` |
| `困难认定` | 105,969 | 4.075 | 399,697 | 14.580 | 409,279 | `True` |
| `心理健康` | 105,533 | 3.036 | 430,059 | 13.343 | 451,382 | `True` |
| `学工` | 110,221 | 3.993 | 463,721 | 18.228 | 636,520 | `True` |
| `竞赛报名` | 140,005 | 5.505 | 570,389 | 24.323 | 611,655 | `True` |
| `规章制度` | 124,069 | 3.809 | 520,202 | 17.490 | 618,399 | `True` |
| `办事流程` | 120,512 | 4.439 | 529,187 | 20.836 | 596,912 | `True` |
| `学生相关文件及表格` | 101,798 | 2.230 | 410,313 | 9.689 | 423,807 | `True` |
| `教务管理系统` | 103,365 | 2.567 | 469,439 | 14.183 | 539,092 | `True` |
| `信息门户` | 112,267 | 3.030 | 496,933 | 15.119 | 563,134 | `True` |
| `附件1` | 136,177 | 5.297 | 598,618 | 22.128 | 721,658 | `True` |
| `缓考申请表` | 65,173 | 0.940 | 213,724 | 2.065 | 215,267 | `True` |
| `奖学金` | 97,425 | 2.944 | 451,335 | 15.161 | 508,114 | `True` |
| `辅导员` | 113,755 | 3.918 | 467,211 | 17.912 | 557,586 | `True` |
| `双创` | 108,444 | 3.811 | 484,993 | 19.055 | 499,868 | `True` |
| `互联网+` | 101,838 | 3.186 | 451,053 | 15.644 | 480,741 | `True` |
| `不存在的查询词` | 59,255 | 0.708 | 201,888 | 1.460 | 203,083 | `True` |
| `a` | 0 | 0.000 | 0 | 0.000 | 0 | `True` |

- First trusted hard gate: `<=5,242,880` bytes or `<=10%` of proof bytes.
- Top hydrated hard gate: `<=10,485,760` bytes or `<=25%` of proof bytes.
- Phase gates passed: `True`
- High-DF gates passed: `True` (first `<=153,600`, top `<=1,572,864`, proof `<=16,777,216` bytes).

## Cache Benchmark

- Query count: `8`
- Max cold uncached bytes: `623,864`
- Max warm uncached bytes: `0`
- Total warm cached bytes: `5,202,675`
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
| `route_planning_gap` | `phase_gate_passed` | {"query_count": 41, "max_candidate_shard_count": 0, "max_loaded_shard_count": 0, "max_uncached_loaded_bytes": 993544, "phase_gates_passed": true} | The planner emits expected byte costs and phase-local selections, but the route policy is still hand-calibrated rather than learned from an optimal decision rule. | Fit an offline decision policy on the evaluation corpus with byte cost as the Lagrange multiplier, then keep only policies that preserve task quality. |
| `first_trusted_gap` | `phase_gate_passed` | {"max_first_trusted_uncached_bytes": 142345, "absolute_limit_bytes": 5242880, "max_first_trusted_elapsed_ms": 7.537, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | The phase is byte-gated and query-path decode improved versus baseline, but the remaining gap is proving that no loaded local-index byte is irrelevant to the first trusted result. | Add per-term contribution accounting for first-result eligibility and drop zero-contribution term blocks. |
| `top_results_hydrated_gap` | `phase_gate_passed` | {"max_top_results_uncached_bytes": 598618, "absolute_limit_bytes": 10485760, "max_top_results_elapsed_ms": 32.488, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | Top results are separated from proof completion, but candidate upper bounds are not yet serialized as a formal certificate that every skipped block is dominated. | Persist block-level score upper bounds and emit a top-k dominance certificate for skipped blocks. |
| `proof_complete_certificate_gap` | `largest_remaining_theoretical_gap` | {"max_proof_complete_uncached_bytes": 993544, "max_proof_complete_elapsed_ms": 44.514, "proof_catalog_total_bytes": 756879, "shard_filter_total_bytes": 6050937, "proof_certificate_total_bytes": 6807816, "hot_query_proof_directory_bytes": 141654, "hot_query_... | Correctness is complete, but proof completion can still approach a full-shard read. The mathematical lower bound is a certificate stream, not full document hydration. | Separate false-positive filter pressure from true-match shard pressure, then generate doc/postings or hot-query certificates for true-match-heavy broad queries. |
| `full_shard_dependency_gap` | `known_remaining_dependency` | {"full_scan_total_bytes": 45717182, "proof_certificate_total_bytes": 6807816, "max_full_shard_bytes": 499697, "full_shard_count": 942, "max_proof_complete_uncached_bytes": 993544} | The serving path no longer depends on full shards for startup or early results, but exhaustive proof still has a full-shard fallback. | Split proof certificates from full document bodies and make full bodies lazy even during proof completion. |
| `packed_index_decode_gap` | `query_path_gate_passed` | {"local_index_runtime_bytes": 38087942, "binary_artifact_total_bytes": 25884445, "runtime_byte_change_percent": -0.01, "runtime_decode_change_percent": -5.958, "query_path_passed": true, "body_decode_mode": "packed_query_term_selective", "light_decode_mode"... | Packed selective decode is active on the hot query path, but block metadata is still decoded at artifact granularity rather than at the exact surviving term/block frontier. | Move to block directory offsets with direct term/block seeks and SIMD/WASM-friendly score scans. |
| `topk_pruning_gap` | `needs_attention` | {"any_dynamic_pruning": false, "total_postings_pruned": 0, "wasm_decision_status": "rust_wasm_retrieval_runtime_selected"} | Dynamic pruning is present, but the report does not yet prove that the pruning order is optimal for every query under the scoring function. | Record WAND/BMW-style upper-bound ledgers per query and compare visited postings against an oracle ordering. |
| `persistent_cache_gap` | `warm_cache_gate_passed` | {"cache_query_count": 8, "max_cold_uncached_bytes": 623864, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 5202675, "browser_persistent_cache_passed": true} | Warm network bytes are gated locally; remaining lower-bound work is CPU decode reuse and browser-level confirmation when a browser report is missing. | Persist decoded packed-index pages and reuse score-session state across repeated same-version queries. |
| `attachment_semantics_gap` | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "text_extracted": 0... | Attachment evidence is summarized, but there is no per-query proof that the summary is the minimal sufficient statistic for attachment relevance. | Add query-term-to-attachment-evidence attribution and measure dropped attachment fields against task quality. |
| `ranking_calibration_gap` | `task_quality_gate_present` | {"quality_eval_skipped": null, "task_eval_skipped": null, "task_eval_passed": 29, "expectation_count": 29, "max_elapsed_ms": 44.556} | Quality gates exist, but ranking weights are still an engineered policy rather than a Pareto-optimal model over relevance, trust, recency, and byte cost. | Run ablations over ranking features and fit byte-aware weights that stay on the quality Pareto frontier. |
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
| 3 | `needs_attention` | {"any_dynamic_pruning": false, "total_postings_pruned": 0} |
| 4 | `evidence_present` | Measured queries report proof ledger complete with zero pending/failed shards; runtime tests cover no-match proof, failed shard refusal, and cancelled pending-ledger refusal. |
| 5 | `evidence_present` | {"artifact_total_bytes_current": 95335412, "artifact_total_bytes_baseline": 102881910, "runtime_parse_decode_summary": {"baseline_local_index_runtime_bytes": 38091934, "current_local_index_runtime_bytes": 38087942, "bytes_delta": -3992, "by |
| 6 | `evidence_present` | {"light_json_bytes": 0, "light_split_runtime_bytes": 21222134, "body_json_bytes": 0, "body_packed_runtime_bytes": 16865808, "note": "Packed binary light terms plus metadata JSON are used for query planning; packed binary light/body indexes  |
| 7 | `evidence_present` | {"artifact_count": 246, "benchmark": "packed-impact-retrieval-wasm-vs-typescript-v2", "collection": "apps/web/public/generated/collections/njupt-public", "decision": {"reason": "The browser runtime can consume Rust/WASM stateful score entri |
| 8 | `evidence_present` | {"query_count": 8, "max_cold_uncached_bytes": 623864, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 5202675, "max_warm_ms": 18.799, "passed": true, "failure_count": 0, "cache_invalidation_test": "Changed content-hash artifact pat |
| 9 | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "t |
| 10 | `evidence_present` | Smoke queries, task queries, measured cold queries, warm cache queries, and a negative query are represented when full report mode is used. |
| 11 | `evidence_present` | {"report": "njupt-search-browser-verification-v21-compact-proof", "generated_at": "2026-06-04T16:43:15.265505+00:00", "base_url": "http://127.0.0.1:56120/", "summary": {"passed": true, "scenario_count": 11, "failed": [], "persistent_cache_p |
| 12 | `external_ci_deploy_required` | Local validators/tests/builds can be recorded separately; CI/deployment status is outside this local report. |
| 13 | `evidence_present` | This report includes byte, time, quality, cache, pruning, parse/decode, and coverage sections. |
| 14 | `unmet` | Commit, push, CI, and deployment checks are intentionally not claimed by this report. |
| 15 | `evidence_present` | {"required_layers": ["startup_entry_gap", "route_planning_gap", "first_trusted_gap", "top_results_hydrated_gap", "proof_complete_certificate_gap", "full_shard_dependency_gap", "packed_index_decode_gap", "topk_pruning_gap", "persistent_cache |

## Reproduction

```powershell
uv run --python 3.13 python -m njupt_search_eval run-lower-bound-report --baseline-ref HEAD --collection apps\web\public\generated\collections\njupt-public --output tools\search-eval\reports\njupt-search-lower-bound-report.json --markdown tools\search-eval\reports\njupt-search-lower-bound-report.md
```

This report is evidence for the active lower-bound goal. It does not claim final completion while DoD items remain unmet.
