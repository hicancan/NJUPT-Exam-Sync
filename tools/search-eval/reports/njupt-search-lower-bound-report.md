# NJUPT Search Lower-Bound Evidence Report

- Generated at: `2026-06-05T02:24:51.753103+00:00`
- Collection: `apps/web/public/generated/collections/njupt-public`
- Baseline ref: `HEAD`
- Current artifact generation: `2026-06-05T02:22:36.051880+00:00`

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
| `hot_query_proof_directory_bytes` | 141,654 | 141,654 | 0 | 0.000% |
| `hot_query_topk_certificate_total_bytes` | 8,532,204 | 8,595,965 | 63,761 | 0.747% |
| `hot_query_complete_certificate_total_bytes` | 3,534,383 | 3,477,173 | -57,210 | -1.619% |
| `full_scan_total_bytes` | 45,726,825 | 45,717,182 | -9,643 | -0.021% |
| `artifact_total_bytes` | 95,370,402 | 95,363,419 | -6,983 | -0.007% |
| `binary_artifact_total_bytes` | 25,885,185 | 25,884,445 | -740 | -0.003% |
| `runtime_artifact_total_bytes` | 121,255,587 | 121,247,864 | -7,723 | -0.006% |
| `artifact_count` | 1,372 | 1,372 | 0 | 0.000% |
| `binary_artifact_count` | 492 | 492 | 0 | 0.000% |
| `local_index_count` | 246 | 246 | 0 | 0.000% |
| `full_shard_count` | 942 | 942 | 0 | 0.000% |
| `max_full_shard_bytes` | 499,697 | 499,697 | 0 | 0.000% |
| `avg_full_shard_bytes` | 48,542 | 48,532 | -10 | -0.021% |

## Parse And Decode

| Family | Baseline bytes | Current bytes | Baseline mean ms | Current mean ms |
| --- | ---: | ---: | ---: | ---: |
| `bootstrap_json` | 230,177 | 230,155 | 0.717 | 0.762 |
| `source_manifests` | 716,754 | 716,754 | 1.516 | 1.583 |
| `shard_filters_json_and_bitsets` | 6,047,886 | 6,047,886 | 7.756 | 7.792 |
| `local_light_json` | 0 | 0 | 0.000 | 0.000 |
| `local_light_meta_json` | 12,206,749 | 12,203,497 | 40.827 | 41.880 |
| `local_light_packed` | 9,019,023 | 9,018,637 | 854.230 | 881.593 |
| `local_light_packed_query_terms` | 9,019,023 | 9,018,637 | 237.119 | 231.793 |
| `local_body_json` | 0 | 0 | 0.000 | 0.000 |
| `local_body_packed` | 16,866,162 | 16,865,808 | 1715.794 | 1708.071 |
| `local_body_packed_query_terms` | 16,866,162 | 16,865,808 | 444.211 | 435.640 |

## Runtime Query-Term Decode Summary

- Baseline local-index runtime bytes: `38,091,934`
- Current local-index runtime bytes: `38,087,942`
- Runtime byte change: `-0.01%`
- Baseline local-index parse/decode mean: `722.157` ms
- Current query-term parse/decode mean: `709.313` ms
- Parse/decode change: `-1.779%`
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
- Winner for current runtime: `wasm_retrieval_session_typed_scores`
- TypeScript decode mean ms: `680.576`
- WASM materialized decode mean ms: `1159.932`
- WASM stats-only decode mean ms: `67.945`
- TypeScript retrieval kernel mean ms: `6421.168`
- WASM stateless retrieval kernel mean ms: `593.197`
- WASM stateful retrieval session mean ms: `822.471`
- WASM stateful retrieval JSON score bridge mean ms: `841.366`
- WASM stateful retrieval typed score buffer mean ms: `832.437`
- Reason: The browser runtime consumes Rust/WASM stateful score entries through a typed buffer, without the JSON score bridge. On the full packed body workload, the typed score buffer path was 0.130x the TypeScript selective retrieval kernel for the same artifact format, query set, and global top-k pruning state.

## Query Measurements

| Query | Class | ms | Results | Candidate shards | Loaded shards | Uncached bytes | Pruned postings | Bottleneck | Complete | Top result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| `校历` | `hot` | 22.462 | 12 | 0 | 0 | 576,339 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生选课通知 |
| `搜校历` | `hot_alias` | 22.166 | 12 | 0 | 0 | 576,339 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生选课通知 |
| `慕课考试` | `hot` | 23.374 | 12 | 0 | 0 | 615,109 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期在线开放课程（慕课）线下考试报名通知 |
| `期末考试` | `hot` | 19.755 | 12 | 0 | 0 | 598,768 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期期末考试工作安排的通知 |
| `考试安排` | `hot` | 19.964 | 12 | 0 | 0 | 613,584 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期考试安排表 |
| `选课` | `hot` | 20.979 | 12 | 0 | 0 | 627,697 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生课程补改选及重修选课的通知 |
| `转专业` | `hot` | 20.864 | 12 | 0 | 0 | 602,244 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期全日制本科生转专业工作的通知 |
| `成绩` | `hot` | 25.310 | 12 | 0 | 0 | 671,737 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `通知` | `hot` | 42.403 | 12 | 0 | 0 | 936,214 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于做好2027届毕业生图像信息采集工作的通知 |
| `学生` | `hot` | 42.531 | 12 | 0 | 0 | 990,985 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于2022级（大四）学生重修报名相关事宜的通知 |
| `南京邮电大学` | `hot` | 34.604 | 12 | 0 | 0 | 930,408 | 0 | `certificate_path` | `True` | 【教师教学发展中心】关于开展2020年南京邮电大学“教学标兵奖” 和“青年教师优秀教学奖”评选工作的通知 |
| `申请` | `hot` | 21.394 | 12 | 0 | 0 | 649,169 | 0 | `certificate_path` | `True` | 教材选用预订更换相关申请材料（凡选必审） |
| `考试` | `hot` | 24.430 | 12 | 0 | 0 | 675,030 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期考试安排表 |
| `查成绩` | `hot_alias` | 25.432 | 12 | 0 | 0 | 671,737 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩查询` | `hot_alias` | 24.808 | 12 | 0 | 0 | 671,737 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩复核申请表` | `hot` | 25.068 | 12 | 0 | 0 | 683,152 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `xlsx` | `hot` | 22.613 | 12 | 0 | 0 | 687,800 | 0 | `certificate_path` | `True` | 关于举办第十二届全国大学生物理实验竞赛（创新）校内选拔赛的通知 |
| `大创` | `hot` | 24.395 | 12 | 0 | 0 | 607,218 | 0 | `certificate_path` | `True` | 2024年度大学生创新创业训练计划项目结题验收成绩公示 |
| `学科竞赛` | `hot` | 20.792 | 12 | 0 | 0 | 520,880 | 0 | `certificate_path` | `True` | 关于组织2026年全国大学生电子设计竞赛(TI杯)及电子信息类系列学科竞赛宣讲及选拔的通知 |
| `普通话考试` | `hot` | 5.112 | 12 | 0 | 0 | 289,330 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于2026年上半年普通话考试的通知 |
| `挑战杯` | `hot` | 15.230 | 12 | 0 | 0 | 423,298 | 0 | `certificate_path` | `True` | 南邮获“挑战杯”国赛特等奖7项 再捧“优胜杯” |
| `推免` | `hot` | 18.506 | 12 | 0 | 0 | 509,356 | 0 | `certificate_path` | `True` | 推荐免试研究生管理办法 |
| `助学金` | `hot` | 18.420 | 12 | 0 | 0 | 508,257 | 0 | `certificate_path` | `True` | 南京邮电大学举行2024年 “瑞华春雨助学金”发放仪式 |
| `国家奖学金` | `hot` | 20.209 | 12 | 0 | 0 | 514,327 | 0 | `certificate_path` | `True` | 本科学生国家奖学金评审办法 |
| `困难认定` | `hot` | 14.500 | 12 | 0 | 0 | 409,721 | 0 | `certificate_path` | `True` | 家庭经济困难学生认定工作实施办法 |
| `心理健康` | `hot` | 14.647 | 12 | 0 | 0 | 459,722 | 0 | `certificate_path` | `True` | 心理健康 |
| `学工` | `hot` | 24.958 | 12 | 0 | 0 | 621,728 | 0 | `certificate_path` | `True` | 南邮召开2026年学生工作大会 |
| `竞赛报名` | `hot` | 26.972 | 12 | 0 | 0 | 619,581 | 0 | `certificate_path` | `True` | 关于举办“2026年南京邮电大学集成电路创新创业校选拔赛”的通知 |
| `规章制度` | `hot` | 19.314 | 12 | 0 | 0 | 549,095 | 0 | `certificate_path` | `True` | 南京邮电大学本科教材供应管理办法 2024-04-26 |
| `办事流程` | `hot` | 23.503 | 12 | 0 | 0 | 593,106 | 0 | `certificate_path` | `True` | 服兵役学生国家教育资助申请流程 |
| `学生相关文件及表格` | `hot` | 10.581 | 12 | 0 | 0 | 423,427 | 0 | `certificate_path` | `True` | 南京邮电大学学生缓考申请表 2026-04-16 |
| `教务管理系统` | `hot` | 17.374 | 12 | 0 | 0 | 534,874 | 0 | `certificate_path` | `True` | 教务管理系统 |
| `信息门户` | `hot` | 21.464 | 12 | 0 | 0 | 609,439 | 0 | `certificate_path` | `True` | 教务管理系统 |
| `附件1` | `hot` | 27.935 | 12 | 0 | 0 | 705,977 | 0 | `certificate_path` | `True` | 【科创竞赛】关于举办“2026年南京邮电大学iCAN创新大赛”的通知 |
| `缓考申请表` | `hot` | 2.470 | 3 | 0 | 0 | 215,240 | 0 | `certificate_path` | `True` | 南京邮电大学学生缓考申请表 2026-04-16 |
| `奖学金` | `hot` | 18.266 | 12 | 0 | 0 | 520,695 | 0 | `certificate_path` | `True` | 南京邮电大学2024-2025学年“甘霖励志奖学金”拟推荐名单公示 |
| `辅导员` | `hot` | 23.557 | 12 | 0 | 0 | 556,522 | 0 | `certificate_path` | `True` | 南邮风华八四载，红史铸魂启新程——第五届辅导员宣讲团走进数字媒体与设计艺术学院 |
| `双创` | `hot` | 22.844 | 12 | 0 | 0 | 500,476 | 0 | `certificate_path` | `True` | 双创信息管理系统 |
| `互联网+` | `hot` | 18.650 | 12 | 0 | 0 | 485,455 | 0 | `certificate_path` | `True` | 南京邮电大学第五届 “互联网+”大学生创新创业大赛成绩公示 |
| `不存在的查询词` | `hot` | 1.805 | 0 | 0 | 0 | 203,083 | 0 | `certificate_path` | `True` |  |
| `a` | `degenerate` | 0.018 | 0 | 0 | 0 | 0 | 0 | `certificate_path` | `True` |  |

## Query Class Summary

| Class | Queries | Max first bytes | Max top bytes | Max proof bytes | Max ms | Dominant bottlenecks |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `degenerate` | 1 | 0 | 0 | 0 | 0.018 | {"certificate_path": 1} |
| `hot` | 37 | 142,425 | 630,823 | 990,985 | 42.531 | {"certificate_path": 37} |
| `hot_alias` | 3 | 142,308 | 561,215 | 671,737 | 25.432 | {"certificate_path": 3} |

## Proof Scan Pressure

| Query | Certificate | Certificate bytes | Avoided match-shard bytes | True-match shards | False-positive shards | True-match bytes | False-positive bytes | False-positive byte ratio | True-match docs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `校历` | `True` | 156,778 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `搜校历` | `True` | 156,778 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `慕课考试` | `True` | 184,503 | 16,376,270 | 153 | 0 | 0 | 0 | 0.000 | 433 |
| `期末考试` | `True` | 219,468 | 18,334,896 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `考试安排` | `True` | 219,468 | 18,334,896 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `选课` | `True` | 216,728 | 28,458,910 | 283 | 0 | 0 | 0 | 0.000 | 762 |
| `转专业` | `True` | 172,264 | 18,027,905 | 160 | 0 | 0 | 0 | 0.000 | 205 |
| `成绩` | `True` | 317,265 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `通知` | `True` | 519,286 | 39,192,844 | 612 | 0 | 0 | 0 | 0.000 | 5,281 |
| `学生` | `True` | 599,093 | 45,222,273 | 839 | 0 | 0 | 0 | 0.000 | 6,842 |
| `南京邮电大学` | `True` | 441,239 | 43,918,188 | 716 | 0 | 0 | 0 | 0.000 | 4,035 |
| `申请` | `True` | 261,223 | 26,552,943 | 316 | 0 | 0 | 0 | 0.000 | 1,551 |
| `考试` | `True` | 304,489 | 16,238,955 | 155 | 0 | 0 | 0 | 0.000 | 2,590 |
| `查成绩` | `True` | 317,265 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `成绩查询` | `True` | 317,265 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `成绩复核申请表` | `True` | 318,583 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `xlsx` | `True` | 301,527 | 30,979,612 | 393 | 0 | 0 | 0 | 0.000 | 2,053 |
| `大创` | `True` | 256,925 | 35,239,561 | 471 | 0 | 0 | 0 | 0.000 | 1,075 |
| `学科竞赛` | `True` | 201,653 | 21,490,019 | 287 | 0 | 0 | 0 | 0.000 | 509 |
| `普通话考试` | `True` | 145,602 | 1,731,223 | 14 | 0 | 0 | 0 | 0.000 | 23 |
| `挑战杯` | `True` | 153,011 | 6,627,562 | 60 | 0 | 0 | 0 | 0.000 | 67 |
| `推免` | `True` | 159,370 | 9,648,543 | 94 | 0 | 0 | 0 | 0.000 | 108 |
| `助学金` | `True` | 199,106 | 25,156,121 | 255 | 0 | 0 | 0 | 0.000 | 505 |
| `国家奖学金` | `True` | 198,429 | 25,121,730 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `困难认定` | `True` | 151,169 | 4,889,512 | 41 | 0 | 0 | 0 | 0.000 | 57 |
| `心理健康` | `True` | 162,751 | 9,997,202 | 92 | 0 | 0 | 0 | 0.000 | 167 |
| `学工` | `True` | 311,633 | 39,231,406 | 540 | 0 | 0 | 0 | 0.000 | 1,910 |
| `竞赛报名` | `True` | 182,294 | 12,765,068 | 196 | 0 | 0 | 0 | 0.000 | 303 |
| `规章制度` | `True` | 238,629 | 20,388,638 | 256 | 0 | 0 | 0 | 0.000 | 1,238 |
| `办事流程` | `True` | 209,064 | 22,304,814 | 230 | 0 | 0 | 0 | 0.000 | 757 |
| `学生相关文件及表格` | `True` | 154,850 | 1,480,594 | 53 | 0 | 0 | 0 | 0.000 | 107 |
| `教务管理系统` | `True` | 209,394 | 19,584,559 | 161 | 0 | 0 | 0 | 0.000 | 797 |
| `信息门户` | `True` | 206,014 | 19,188,935 | 151 | 0 | 0 | 0 | 0.000 | 756 |
| `附件1` | `True` | 263,090 | 28,259,257 | 330 | 0 | 0 | 0 | 0.000 | 1,536 |
| `缓考申请表` | `True` | 143,188 | 46,901 | 2 | 0 | 0 | 0 | 0.000 | 3 |
| `奖学金` | `True` | 198,142 | 25,121,730 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `辅导员` | `True` | 230,862 | 21,380,491 | 250 | 0 | 0 | 0 | 0.000 | 1,094 |
| `双创` | `True` | 156,422 | 3,781,225 | 72 | 0 | 0 | 0 | 0.000 | 93 |
| `互联网+` | `True` | 171,215 | 12,904,091 | 150 | 0 | 0 | 0 | 0.000 | 222 |
| `不存在的查询词` | `True` | 142,849 | 0 | 0 | 0 | 0 | 0 | 0.000 | 0 |
| `a` | `False` | 0 | 0 | 0 | 0 | 0 | 0 | 0.000 | 0 |

## Phase Gates

| Query | First trusted bytes | First trusted ms | Top hydrated bytes | Top hydrated ms | Proof bytes | Passed |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `校历` | 142,308 | 5.492 | 561,215 | 21.719 | 576,339 | `True` |
| `搜校历` | 142,308 | 5.263 | 561,215 | 21.365 | 576,339 | `True` |
| `慕课考试` | 138,243 | 4.853 | 572,260 | 21.569 | 615,109 | `True` |
| `期末考试` | 122,519 | 3.272 | 520,954 | 15.380 | 598,768 | `True` |
| `考试安排` | 131,217 | 3.725 | 535,770 | 15.969 | 613,584 | `True` |
| `选课` | 132,453 | 3.817 | 552,623 | 18.137 | 627,697 | `True` |
| `转专业` | 125,518 | 3.781 | 571,634 | 19.424 | 602,244 | `True` |
| `成绩` | 104,918 | 2.824 | 496,126 | 16.702 | 671,737 | `True` |
| `通知` | 136,566 | 4.500 | 558,582 | 18.546 | 936,214 | `True` |
| `学生` | 132,673 | 4.294 | 533,546 | 18.007 | 990,985 | `True` |
| `南京邮电大学` | 142,425 | 4.278 | 630,823 | 20.471 | 930,408 | `True` |
| `申请` | 141,220 | 4.057 | 529,600 | 15.532 | 649,169 | `True` |
| `考试` | 123,919 | 3.838 | 512,195 | 14.631 | 675,030 | `True` |
| `查成绩` | 104,918 | 2.982 | 496,126 | 17.155 | 671,737 | `True` |
| `成绩查询` | 104,918 | 3.000 | 496,126 | 16.801 | 671,737 | `True` |
| `成绩复核申请表` | 106,250 | 2.885 | 506,223 | 16.763 | 683,152 | `True` |
| `xlsx` | 113,624 | 3.129 | 527,927 | 15.132 | 687,800 | `True` |
| `大创` | 121,792 | 4.715 | 491,947 | 19.652 | 607,218 | `True` |
| `学科竞赛` | 113,192 | 4.031 | 460,881 | 18.449 | 520,880 | `True` |
| `普通话考试` | 96,974 | 2.123 | 285,382 | 4.778 | 289,330 | `True` |
| `挑战杯` | 104,586 | 3.588 | 411,941 | 14.646 | 423,298 | `True` |
| `推免` | 115,623 | 3.929 | 491,640 | 17.757 | 509,356 | `True` |
| `助学金` | 103,352 | 3.563 | 450,805 | 16.385 | 508,257 | `True` |
| `国家奖学金` | 104,343 | 3.721 | 457,552 | 17.818 | 514,327 | `True` |
| `困难认定` | 106,545 | 3.735 | 400,206 | 14.003 | 409,721 | `True` |
| `心理健康` | 106,510 | 3.132 | 438,625 | 13.798 | 459,722 | `True` |
| `学工` | 108,669 | 3.880 | 451,749 | 17.723 | 621,728 | `True` |
| `竞赛报名` | 139,962 | 5.525 | 578,941 | 25.514 | 619,581 | `True` |
| `规章制度` | 105,870 | 3.151 | 452,120 | 14.804 | 549,095 | `True` |
| `办事流程` | 117,059 | 4.043 | 525,696 | 20.038 | 593,106 | `True` |
| `学生相关文件及表格` | 101,921 | 2.491 | 410,231 | 9.792 | 423,427 | `True` |
| `教务管理系统` | 102,694 | 2.650 | 467,134 | 13.644 | 534,874 | `True` |
| `信息门户` | 116,292 | 3.468 | 545,079 | 18.175 | 609,439 | `True` |
| `附件1` | 135,337 | 4.218 | 584,541 | 21.826 | 705,977 | `True` |
| `缓考申请表` | 65,164 | 1.021 | 213,706 | 2.236 | 215,240 | `True` |
| `奖学金` | 105,868 | 3.102 | 464,207 | 16.154 | 520,695 | `True` |
| `辅导员` | 115,707 | 4.265 | 467,314 | 18.658 | 556,522 | `True` |
| `双创` | 108,411 | 4.059 | 485,708 | 22.082 | 500,476 | `True` |
| `互联网+` | 103,367 | 3.379 | 455,894 | 17.156 | 485,455 | `True` |
| `不存在的查询词` | 59,255 | 0.766 | 201,888 | 1.627 | 203,083 | `True` |
| `a` | 0 | 0.000 | 0 | 0.000 | 0 | `True` |

- First trusted hard gate: `<=5,242,880` bytes or `<=10%` of proof bytes.
- Top hydrated hard gate: `<=10,485,760` bytes or `<=25%` of proof bytes.
- Phase gates passed: `True`
- High-DF gates passed: `True` (first `<=153,600`, top `<=1,572,864`, proof `<=16,777,216` bytes).

## Cache Benchmark

- Query count: `8`
- Max cold uncached bytes: `615,109`
- Max warm uncached bytes: `0`
- Total warm cached bytes: `5,216,221`
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
| `route_planning_gap` | `phase_gate_passed` | {"query_count": 41, "max_candidate_shard_count": 0, "max_loaded_shard_count": 0, "max_uncached_loaded_bytes": 990985, "phase_gates_passed": true} | The planner emits expected byte costs and phase-local selections, but the route policy is still hand-calibrated rather than learned from an optimal decision rule. | Fit an offline decision policy on the evaluation corpus with byte cost as the Lagrange multiplier, then keep only policies that preserve task quality. |
| `first_trusted_gap` | `phase_gate_passed` | {"max_first_trusted_uncached_bytes": 142425, "absolute_limit_bytes": 5242880, "max_first_trusted_elapsed_ms": 5.525, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | The phase is byte-gated and query-path decode improved versus baseline, but the remaining gap is proving that no loaded local-index byte is irrelevant to the first trusted result. | Add per-term contribution accounting for first-result eligibility and drop zero-contribution term blocks. |
| `top_results_hydrated_gap` | `phase_gate_passed` | {"max_top_results_uncached_bytes": 630823, "absolute_limit_bytes": 10485760, "max_top_results_elapsed_ms": 25.514, "query_path_mean_current_bytes": 0, "query_path_bytes_percent_change": null, "query_path_passed": true} | Top results are separated from proof completion, but candidate upper bounds are not yet serialized as a formal certificate that every skipped block is dominated. | Persist block-level score upper bounds and emit a top-k dominance certificate for skipped blocks. |
| `proof_complete_certificate_gap` | `largest_remaining_theoretical_gap` | {"max_proof_complete_uncached_bytes": 990985, "max_proof_complete_elapsed_ms": 42.483, "proof_catalog_total_bytes": 756879, "shard_filter_total_bytes": 6050937, "proof_certificate_total_bytes": 6807816, "hot_query_proof_directory_bytes": 141654, "hot_query_... | Correctness is complete, but proof completion can still approach a full-shard read. The mathematical lower bound is a certificate stream, not full document hydration. | Separate false-positive filter pressure from true-match shard pressure, then generate doc/postings or hot-query certificates for true-match-heavy broad queries. |
| `full_shard_dependency_gap` | `known_remaining_dependency` | {"full_scan_total_bytes": 45717182, "proof_certificate_total_bytes": 6807816, "max_full_shard_bytes": 499697, "full_shard_count": 942, "max_proof_complete_uncached_bytes": 990985} | The serving path no longer depends on full shards for startup or early results, but exhaustive proof still has a full-shard fallback. | Split proof certificates from full document bodies and make full bodies lazy even during proof completion. |
| `packed_index_decode_gap` | `query_path_gate_passed` | {"local_index_runtime_bytes": 38087942, "binary_artifact_total_bytes": 25884445, "runtime_byte_change_percent": -0.01, "runtime_decode_change_percent": -1.779, "query_path_passed": true, "body_decode_mode": "packed_query_term_selective", "light_decode_mode"... | Packed selective decode is active on the hot query path, but block metadata is still decoded at artifact granularity rather than at the exact surviving term/block frontier. | Move to block directory offsets with direct term/block seeks and SIMD/WASM-friendly score scans. |
| `topk_pruning_gap` | `needs_attention` | {"any_dynamic_pruning": false, "total_postings_pruned": 0, "wasm_decision_status": "rust_wasm_retrieval_runtime_selected"} | Dynamic pruning is present, but the report does not yet prove that the pruning order is optimal for every query under the scoring function. | Record WAND/BMW-style upper-bound ledgers per query and compare visited postings against an oracle ordering. |
| `persistent_cache_gap` | `warm_cache_gate_passed` | {"cache_query_count": 8, "max_cold_uncached_bytes": 615109, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 5216221, "browser_persistent_cache_passed": true} | Warm network bytes are gated locally; remaining lower-bound work is CPU decode reuse and browser-level confirmation when a browser report is missing. | Persist decoded packed-index pages and reuse score-session state across repeated same-version queries. |
| `attachment_semantics_gap` | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "text_extracted": 0... | Attachment evidence is summarized, but there is no per-query proof that the summary is the minimal sufficient statistic for attachment relevance. | Add query-term-to-attachment-evidence attribution and measure dropped attachment fields against task quality. |
| `ranking_calibration_gap` | `task_quality_gate_present` | {"quality_eval_skipped": null, "task_eval_skipped": null, "task_eval_passed": 29, "expectation_count": 29, "max_elapsed_ms": 42.531} | Quality gates exist, but ranking weights are still an engineered policy rather than a Pareto-optimal model over relevance, trust, recency, and byte cost. | Run ablations over ranking features and fit byte-aware weights that stay on the quality Pareto frontier. |
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
| 2 | `evidence_present` | {"planner": "Planner telemetry includes route expected_cost_bytes, selected expected_uncached bytes, cache state per local index, and phase-specific local index selections.", "max_first_trusted_uncached_bytes": 142425, "first_trusted_absolu |
| 3 | `needs_attention` | {"any_dynamic_pruning": false, "total_postings_pruned": 0} |
| 4 | `evidence_present` | Measured queries report proof ledger complete with zero pending/failed shards; runtime tests cover no-match proof, failed shard refusal, and cancelled pending-ledger refusal. |
| 5 | `evidence_present` | {"artifact_total_bytes_current": 95363419, "artifact_total_bytes_baseline": 95370402, "runtime_parse_decode_summary": {"baseline_local_index_runtime_bytes": 38091934, "current_local_index_runtime_bytes": 38087942, "bytes_delta": -3992, "byt |
| 6 | `evidence_present` | {"light_json_bytes": 0, "light_split_runtime_bytes": 21222134, "body_json_bytes": 0, "body_packed_runtime_bytes": 16865808, "note": "Packed binary light terms plus metadata JSON are used for query planning; packed binary light/body indexes  |
| 7 | `evidence_present` | {"artifact_count": 246, "benchmark": "packed-impact-retrieval-wasm-vs-typescript-v2", "collection": "apps/web/public/generated/collections/njupt-public", "decision": {"reason": "The browser runtime consumes Rust/WASM stateful score entries  |
| 8 | `evidence_present` | {"query_count": 8, "max_cold_uncached_bytes": 615109, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 5216221, "max_warm_ms": 24.923, "passed": true, "failure_count": 0, "cache_invalidation_test": "Changed content-hash artifact pat |
| 9 | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "t |
| 10 | `evidence_present` | Smoke queries, task queries, measured cold queries, warm cache queries, and a negative query are represented when full report mode is used. |
| 11 | `evidence_present` | {"report": "njupt-search-browser-verification-v21-compact-proof", "generated_at": "2026-06-05T02:23:42.301176+00:00", "base_url": "http://127.0.0.1:54075/", "summary": {"passed": true, "scenario_count": 11, "failed": [], "persistent_cache_p |
| 12 | `external_ci_deploy_required` | Local validators/tests/builds can be recorded separately; CI/deployment status is outside this local report. |
| 13 | `evidence_present` | This report includes byte, time, quality, cache, pruning, parse/decode, and coverage sections. |
| 14 | `unmet` | Commit, push, CI, and deployment checks are intentionally not claimed by this report. |
| 15 | `evidence_present` | {"required_layers": ["startup_entry_gap", "route_planning_gap", "first_trusted_gap", "top_results_hydrated_gap", "proof_complete_certificate_gap", "full_shard_dependency_gap", "packed_index_decode_gap", "topk_pruning_gap", "persistent_cache |

## Reproduction

```powershell
uv run --python 3.13 python -m njupt_search_eval run-lower-bound-report --baseline-ref HEAD --collection apps\web\public\generated\collections\njupt-public --output tools\search-eval\reports\njupt-search-lower-bound-report.json --markdown tools\search-eval\reports\njupt-search-lower-bound-report.md
```

This report is evidence for the active lower-bound goal. It does not claim final completion while DoD items remain unmet.
