# NJUPT Search Lower-Bound Evidence Report

- Generated at: `2026-06-05T04:49:05.693752+00:00`
- Collection: `apps/web/public/generated/collections/njupt-public`
- Baseline ref: `HEAD`
- Current artifact generation: `2026-06-05T04:44:05.629223+00:00`

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
| `routed_first_screen_total_bytes` | 230,177 | 230,138 | -39 | -0.017% |
| `bootstrap_manifest_bytes` | 16,566 | 16,538 | -28 | -0.169% |
| `source_registry_bytes` | 4,805 | 4,805 | 0 | 0.000% |
| `global_query_directory_bytes` | 205,953 | 205,942 | -11 | -0.005% |
| `query_aliases_bytes` | 2,853 | 2,853 | 0 | 0.000% |
| `source_manifest_total_bytes` | 716,754 | 716,716 | -38 | -0.005% |
| `local_impact_light_index_total_bytes` | 0 | 0 | 0 |  |
| `local_impact_light_index_meta_total_bytes` | 12,208,135 | 6,973,410 | -5,234,725 | -42.879% |
| `local_impact_light_index_packed_total_bytes` | 9,021,171 | 9,018,637 | -2,534 | -0.028% |
| `local_impact_body_index_total_bytes` | 0 | 0 | 0 |  |
| `local_impact_body_index_packed_total_bytes` | 16,869,509 | 16,865,808 | -3,701 | -0.022% |
| `light_index_runtime_bytes` | 21,229,306 | 15,992,047 | -5,237,259 | -24.670% |
| `body_index_bytes` | 0 | 0 | 0 |  |
| `body_index_runtime_bytes` | 16,869,509 | 16,865,808 | -3,701 | -0.022% |
| `local_index_runtime_bytes` | 38,098,815 | 32,857,855 | -5,240,960 | -13.756% |
| `proof_catalog_total_bytes` | 756,910 | 756,879 | -31 | -0.004% |
| `shard_filter_total_bytes` | 6,050,937 | 6,051,945 | 1,008 | 0.017% |
| `proof_certificate_total_bytes` | 6,807,847 | 6,808,824 | 977 | 0.014% |
| `hot_query_proof_directory_bytes` | 141,654 | 141,654 | 0 | 0.000% |
| `hot_query_topk_certificate_total_bytes` | 8,603,363 | 5,629,685 | -2,973,678 | -34.564% |
| `hot_query_complete_certificate_total_bytes` | 3,478,212 | 2,973,682 | -504,530 | -14.505% |
| `full_scan_total_bytes` | 45,731,899 | 45,717,182 | -14,717 | -0.032% |
| `artifact_total_bytes` | 95,411,182 | 85,944,941 | -9,466,241 | -9.922% |
| `binary_artifact_total_bytes` | 25,890,680 | 25,884,445 | -6,235 | -0.024% |
| `runtime_artifact_total_bytes` | 121,301,862 | 111,829,386 | -9,472,476 | -7.809% |
| `artifact_count` | 1,372 | 1,386 | 14 | 1.020% |
| `binary_artifact_count` | 492 | 492 | 0 | 0.000% |
| `local_index_count` | 246 | 246 | 0 | 0.000% |
| `full_shard_count` | 942 | 942 | 0 | 0.000% |
| `max_full_shard_bytes` | 499,697 | 499,697 | 0 | 0.000% |
| `avg_full_shard_bytes` | 48,547 | 48,532 | -15 | -0.032% |

## Parse And Decode

| Family | Baseline bytes | Current bytes | Baseline mean ms | Current mean ms |
| --- | ---: | ---: | ---: | ---: |
| `bootstrap_json` | 230,177 | 230,138 | 0.750 | 0.791 |
| `source_manifests` | 716,754 | 716,716 | 1.509 | 1.584 |
| `shard_filters_json_and_bitsets` | 6,047,886 | 6,048,108 | 7.868 | 7.408 |
| `local_light_json` | 0 | 0 | 0.000 | 0.000 |
| `local_light_meta_json` | 12,208,135 | 6,973,410 | 33.723 | 21.038 |
| `local_light_packed` | 9,021,171 | 9,018,637 | 745.433 | 734.231 |
| `local_light_packed_query_terms` | 9,021,171 | 9,018,637 | 207.418 | 214.191 |
| `local_body_json` | 0 | 0 | 0.000 | 0.000 |
| `local_body_packed` | 16,869,509 | 16,865,808 | 1437.888 | 1478.558 |
| `local_body_packed_query_terms` | 16,869,509 | 16,865,808 | 378.307 | 382.737 |

## Runtime Query-Term Decode Summary

- Baseline local-index runtime bytes: `38,098,815`
- Current local-index runtime bytes: `32,857,855`
- Runtime byte change: `-13.756%`
- Baseline local-index parse/decode mean: `619.448` ms
- Current query-term parse/decode mean: `617.966` ms
- Parse/decode change: `-0.239%`
- Light decode mode: `metadata_json_plus_packed_query_term_selective`
- Body decode mode: `packed_query_term_selective`

## Query Path Parse And Decode

| Phase | Mean baseline bytes | Mean current bytes | Byte change | Mean baseline ms | Mean current ms | Decode change | Byte gate | Decode within tolerance |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `first_trusted_results` | 530,582 | 382,857 | `-27.842%` | 4.369 | 3.942 | `-9.772%` | `True` | `True` |
| `top_results_hydrated` | 1,213,913 | 1,033,485 | `-14.863%` | 15.622 | 15.178 | `-2.845%` | `True` | `True` |
- Query-path byte gate passed: `True`. Decode timing is reported separately with tolerance `5.0%`.

## Rust/WASM Decision

- Decision: `rust_wasm_retrieval_runtime_selected`
- Winner for current runtime: `wasm_retrieval_session_typed_scores`
- TypeScript decode mean ms: `566.237`
- WASM materialized decode mean ms: `603.267`
- WASM stats-only decode mean ms: `37.808`
- TypeScript retrieval kernel mean ms: `3450.640`
- WASM stateless retrieval kernel mean ms: `297.703`
- WASM stateful retrieval session mean ms: `303.442`
- WASM stateful retrieval JSON score bridge mean ms: `307.848`
- WASM stateful retrieval typed score buffer mean ms: `303.747`
- Reason: The browser runtime consumes Rust/WASM stateful score entries through a typed buffer, without the JSON score bridge. On the full packed body workload, the typed score buffer path was 0.088x the TypeScript selective retrieval kernel for the same artifact format, query set, and global top-k pruning state.

## Query Measurements

| Query | Class | Serving path | ms | Results | Candidate shards | Loaded shards | Uncached bytes | Pruned postings | Bottleneck | Complete | Top result |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| `校历` | `hot` | `hot_certificate` | 16.893 | 12 | 0 | 0 | 433,170 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生选课通知 |
| `搜校历` | `hot_alias` | `hot_certificate` | 16.601 | 12 | 0 | 0 | 433,170 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生选课通知 |
| `慕课考试` | `hot` | `hot_certificate` | 19.745 | 12 | 0 | 0 | 484,313 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期在线开放课程（慕课）线下考试报名通知 |
| `期末考试` | `hot` | `hot_certificate` | 19.097 | 12 | 0 | 0 | 478,557 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期期末考试工作安排的通知 |
| `考试安排` | `hot` | `hot_certificate` | 18.749 | 12 | 0 | 0 | 483,716 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期考试安排表 |
| `选课` | `hot` | `hot_certificate` | 20.154 | 12 | 0 | 0 | 481,960 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期2022-2025级学生课程补改选及重修选课的通知 |
| `转专业` | `hot` | `hot_certificate` | 18.448 | 12 | 0 | 0 | 448,163 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于做好2025-2026学年第二学期全日制本科生转专业工作的通知 |
| `成绩` | `hot` | `hot_certificate` | 24.228 | 12 | 0 | 0 | 552,116 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `通知` | `cold_high_df` | `high_df_certificate` | 39.146 | 12 | 0 | 0 | 723,161 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于做好2027届毕业生图像信息采集工作的通知 |
| `学生` | `cold_high_df` | `high_df_certificate` | 67.317 | 12 | 0 | 0 | 791,580 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于2022级（大四）学生重修报名相关事宜的通知 |
| `南京邮电大学` | `cold_high_df` | `high_df_certificate` | 42.043 | 12 | 0 | 0 | 695,248 | 0 | `certificate_path` | `True` | 【教研科】南京邮电大学首批微专业启动招生 |
| `申请` | `cold_high_df` | `high_df_certificate` | 36.093 | 12 | 0 | 0 | 509,886 | 0 | `certificate_path` | `True` | 教材选用预订更换相关申请材料（凡选必审） |
| `考试` | `cold_high_df` | `high_df_certificate` | 27.145 | 12 | 0 | 0 | 529,296 | 0 | `certificate_path` | `True` | 【教务管理办公室】2025-2026学年第二学期考试安排表 |
| `图像采集码` | `cold_rare` | `dynamic_retrieval` | 393.516 | 4 | 8 | 35 | 22,854,025 | 0 | `proof_complete_bytes` | `True` | 【教务管理办公室】关于做好2027届毕业生图像信息采集工作的通知 |
| `授课计划表` | `cold_rare` | `dynamic_retrieval` | 626.156 | 12 | 18 | 91 | 29,807,004 | 0 | `proof_complete_bytes` | `True` | 南京邮电大学授课计划表 |
| `教材研究课题` | `cold_rare` | `dynamic_retrieval` | 314.313 | 1 | 18 | 35 | 20,846,258 | 3 | `proof_complete_bytes` | `True` | 【未来教师发展中心】关于开展2025年教材研究合作课题申报工作的通知 |
| `开机卡` | `cold_rare` | `dynamic_retrieval` | 588.287 | 12 | 0 | 83 | 29,155,022 | 0 | `proof_complete_bytes` | `True` | 【教务管理办公室】关于2025-2026学年第二学期本科教学工作安排的通知 |
| `休学复学` | `miss` | `dynamic_retrieval` | 415.715 | 0 | 3 | 35 | 23,432,950 | 0 | `proof_complete_bytes` | `True` |  |
| `课程替代` | `cold_rare` | `dynamic_retrieval` | 456.685 | 12 | 18 | 64 | 25,093,123 | 114 | `proof_complete_bytes` | `True` | 新版：课程替代申请表（重修） 2026-03-02 |
| `教学标兵奖` | `cold_rare` | `dynamic_retrieval` | 536.552 | 12 | 18 | 88 | 26,808,828 | 8 | `proof_complete_bytes` | `True` | 【教师教学发展中心】关于开展2018年南京邮电大学“教学标兵奖” 和“青年教师优秀教学奖”评选工作的通知 |
| `查成绩` | `hot_alias` | `hot_certificate` | 22.828 | 12 | 0 | 0 | 552,116 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩查询` | `hot_alias` | `hot_certificate` | 22.996 | 12 | 0 | 0 | 552,116 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `成绩复核申请表` | `hot` | `hot_certificate` | 22.259 | 12 | 0 | 0 | 565,491 | 0 | `certificate_path` | `True` | 南京邮电大学学生成绩复核申请表 2026-04-16 |
| `xlsx` | `hot` | `hot_certificate` | 20.614 | 12 | 0 | 0 | 552,389 | 0 | `certificate_path` | `True` | 关于举办第十二届全国大学生物理实验竞赛（创新）校内选拔赛的通知 |
| `大创` | `hot` | `hot_certificate` | 20.335 | 12 | 0 | 0 | 502,787 | 0 | `certificate_path` | `True` | 2024年度大学生创新创业训练计划项目结题验收成绩公示 |
| `学科竞赛` | `hot` | `hot_certificate` | 16.540 | 12 | 0 | 0 | 431,241 | 0 | `certificate_path` | `True` | 关于组织2026年全国大学生电子设计竞赛(TI杯)及电子信息类系列学科竞赛宣讲及选拔的通知 |
| `普通话考试` | `hot` | `hot_certificate` | 5.013 | 12 | 0 | 0 | 265,603 | 0 | `certificate_path` | `True` | 【教务管理办公室】关于2026年上半年普通话考试的通知 |
| `挑战杯` | `hot` | `hot_certificate` | 13.208 | 12 | 0 | 0 | 368,639 | 0 | `certificate_path` | `True` | 南邮获“挑战杯”国赛特等奖7项 再捧“优胜杯” |
| `推免` | `hot` | `hot_certificate` | 15.794 | 12 | 0 | 0 | 420,174 | 0 | `certificate_path` | `True` | 推荐免试研究生管理办法 |
| `助学金` | `hot` | `hot_certificate` | 15.721 | 12 | 0 | 0 | 428,204 | 0 | `certificate_path` | `True` | 南京邮电大学举行2024年 “瑞华春雨助学金”发放仪式 |
| `国家奖学金` | `hot` | `hot_certificate` | 16.430 | 12 | 0 | 0 | 434,739 | 0 | `certificate_path` | `True` | 本科学生国家奖学金评审办法 |
| `困难认定` | `hot` | `hot_certificate` | 11.657 | 12 | 0 | 0 | 348,373 | 0 | `certificate_path` | `True` | 家庭经济困难学生认定工作实施办法 |
| `心理健康` | `hot` | `hot_certificate` | 12.286 | 12 | 0 | 0 | 398,548 | 0 | `certificate_path` | `True` | 心理健康 |
| `学工` | `hot` | `hot_certificate` | 25.883 | 12 | 0 | 0 | 536,933 | 0 | `certificate_path` | `True` | 南邮召开2026年学生工作大会 |
| `竞赛报名` | `hot` | `hot_certificate` | 19.673 | 12 | 0 | 0 | 464,170 | 0 | `certificate_path` | `True` | 关于举办“2026年南京邮电大学集成电路创新创业校选拔赛”的通知 |
| `规章制度` | `hot` | `hot_certificate` | 16.468 | 12 | 0 | 0 | 452,525 | 0 | `certificate_path` | `True` | 南京邮电大学本科教材供应管理办法 2024-04-26 |
| `办事流程` | `hot` | `hot_certificate` | 18.952 | 12 | 0 | 0 | 465,563 | 0 | `certificate_path` | `True` | 服兵役学生国家教育资助申请流程 |
| `学生相关文件及表格` | `hot` | `hot_certificate` | 10.274 | 12 | 0 | 0 | 366,319 | 0 | `certificate_path` | `True` | 南京邮电大学学生缓考申请表 2026-04-16 |
| `教务管理系统` | `hot` | `hot_certificate` | 14.893 | 12 | 0 | 0 | 436,597 | 0 | `certificate_path` | `True` | 教务管理系统 |
| `信息门户` | `hot` | `hot_certificate` | 17.645 | 12 | 0 | 0 | 478,702 | 0 | `certificate_path` | `True` | 教务管理系统 |
| `附件1` | `hot` | `hot_certificate` | 21.297 | 12 | 0 | 0 | 549,031 | 0 | `certificate_path` | `True` | 【科创竞赛】关于举办“2026年南京邮电大学iCAN创新大赛”的通知 |
| `缓考申请表` | `hot` | `hot_certificate` | 2.159 | 3 | 0 | 0 | 211,982 | 0 | `certificate_path` | `True` | 南京邮电大学学生缓考申请表 2026-04-16 |
| `奖学金` | `hot` | `hot_certificate` | 15.718 | 12 | 0 | 0 | 432,398 | 0 | `certificate_path` | `True` | 南京邮电大学2024-2025学年“甘霖励志奖学金”拟推荐名单公示 |
| `辅导员` | `hot` | `hot_certificate` | 18.873 | 12 | 0 | 0 | 459,330 | 0 | `certificate_path` | `True` | 南邮风华八四载，红史铸魂启新程——第五届辅导员宣讲团走进数字媒体与设计艺术学院 |
| `双创` | `hot` | `hot_certificate` | 16.737 | 12 | 0 | 0 | 409,791 | 0 | `certificate_path` | `True` | 双创信息管理系统 |
| `互联网+` | `hot` | `hot_certificate` | 15.451 | 12 | 0 | 0 | 408,406 | 0 | `certificate_path` | `True` | 南京邮电大学第五届 “互联网+”大学生创新创业大赛成绩公示 |
| `不存在的查询词` | `miss` | `hot_certificate` | 1.783 | 0 | 0 | 0 | 203,083 | 0 | `certificate_path` | `True` |  |
| `a` | `degenerate` | `noop` | 0.018 | 0 | 0 | 0 | 0 | 0 | `certificate_path` | `True` |  |

## Query Class Summary

| Class | Queries | Max first bytes | Max top bytes | Max proof bytes | Max ms | Dominant bottlenecks |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `cold_high_df` | 5 | 107,562 | 437,904 | 791,580 | 67.317 | {"certificate_path": 5} |
| `cold_rare` | 6 | 4,666,601 | 10,209,421 | 29,807,004 | 626.156 | {"proof_complete_bytes": 6} |
| `degenerate` | 1 | 0 | 0 | 0 | 0.018 | {"certificate_path": 1} |
| `hot` | 31 | 112,044 | 446,912 | 565,491 | 25.883 | {"certificate_path": 31} |
| `hot_alias` | 3 | 107,278 | 419,191 | 552,116 | 22.996 | {"certificate_path": 3} |
| `miss` | 2 | 3,931,492 | 8,475,400 | 23,432,950 | 415.715 | {"proof_complete_bytes": 1, "certificate_path": 1} |

## Serving Path Summary

| Serving path | Queries | Max first bytes | Max top bytes | Max proof bytes | Postings visited | Postings pruned |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `dynamic_retrieval` | 7 | 4,666,601 | 10,209,421 | 29,807,004 | 4,905 | 125 |
| `high_df_certificate` | 5 | 107,562 | 437,904 | 791,580 | 0 | 0 |
| `hot_certificate` | 35 | 112,044 | 446,912 | 565,491 | 0 | 0 |
| `noop` | 1 | 0 | 0 | 0 | 0 | 0 |

## Proof Scan Pressure

| Query | Certificate | Certificate bytes | Avoided match-shard bytes | True-match shards | False-positive shards | True-match bytes | False-positive bytes | False-positive byte ratio | True-match docs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `校历` | `True` | 155,633 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `搜校历` | `True` | 155,633 | 8,376,075 | 78 | 0 | 0 | 0 | 0.000 | 96 |
| `慕课考试` | `True` | 179,055 | 16,376,270 | 153 | 0 | 0 | 0 | 0.000 | 433 |
| `期末考试` | `True` | 206,642 | 18,334,896 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `考试安排` | `True` | 206,642 | 18,334,896 | 148 | 0 | 0 | 0 | 0.000 | 1,022 |
| `选课` | `True` | 208,563 | 28,458,910 | 283 | 0 | 0 | 0 | 0.000 | 762 |
| `转专业` | `True` | 169,954 | 18,027,905 | 160 | 0 | 0 | 0 | 0.000 | 205 |
| `成绩` | `True` | 294,237 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `通知` | `True` | 443,830 | 39,192,844 | 612 | 0 | 0 | 0 | 0.000 | 5,281 |
| `学生` | `True` | 520,439 | 45,222,273 | 839 | 0 | 0 | 0 | 0.000 | 6,842 |
| `南京邮电大学` | `True` | 398,998 | 43,918,188 | 716 | 0 | 0 | 0 | 0.000 | 4,035 |
| `申请` | `True` | 244,784 | 26,552,943 | 316 | 0 | 0 | 0 | 0.000 | 1,551 |
| `考试` | `True` | 276,055 | 16,238,955 | 155 | 0 | 0 | 0 | 0.000 | 2,590 |
| `图像采集码` | `False` | 0 | 0 | 4 | 24 | 236,291 | 6,832,325 | 0.967 | 4 |
| `授课计划表` | `False` | 0 | 0 | 73 | 13 | 11,797,036 | 2,565,422 | 0.179 | 97 |
| `教材研究课题` | `False` | 0 | 0 | 1 | 17 | 128,113 | 4,563,293 | 0.973 | 1 |
| `开机卡` | `False` | 0 | 0 | 11 | 72 | 996,404 | 13,291,013 | 0.930 | 14 |
| `休学复学` | `False` | 0 | 0 | 0 | 32 | 0 | 8,148,726 | 1.000 | 0 |
| `课程替代` | `False` | 0 | 0 | 27 | 23 | 3,618,052 | 5,225,196 | 0.591 | 28 |
| `教学标兵奖` | `False` | 0 | 0 | 68 | 20 | 6,992,939 | 4,948,284 | 0.414 | 77 |
| `查成绩` | `True` | 294,237 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `成绩查询` | `True` | 294,237 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `成绩复核申请表` | `True` | 295,555 | 39,623,186 | 555 | 0 | 0 | 0 | 0.000 | 2,116 |
| `xlsx` | `True` | 277,025 | 30,979,612 | 393 | 0 | 0 | 0 | 0.000 | 2,053 |
| `大创` | `True` | 241,857 | 35,239,561 | 471 | 0 | 0 | 0 | 0.000 | 1,075 |
| `学科竞赛` | `True` | 195,452 | 21,490,019 | 287 | 0 | 0 | 0 | 0.000 | 509 |
| `普通话考试` | `True` | 145,258 | 1,731,223 | 14 | 0 | 0 | 0 | 0.000 | 23 |
| `挑战杯` | `True` | 152,056 | 6,627,562 | 60 | 0 | 0 | 0 | 0.000 | 67 |
| `推免` | `True` | 158,019 | 9,648,543 | 94 | 0 | 0 | 0 | 0.000 | 108 |
| `助学金` | `True` | 193,734 | 25,156,121 | 255 | 0 | 0 | 0 | 0.000 | 505 |
| `国家奖学金` | `True` | 193,148 | 25,121,730 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `困难认定` | `True` | 150,486 | 4,889,512 | 41 | 0 | 0 | 0 | 0.000 | 57 |
| `心理健康` | `True` | 160,758 | 9,997,202 | 92 | 0 | 0 | 0 | 0.000 | 167 |
| `学工` | `True` | 287,470 | 39,231,406 | 540 | 0 | 0 | 0 | 0.000 | 1,910 |
| `竞赛报名` | `True` | 178,535 | 12,765,068 | 196 | 0 | 0 | 0 | 0.000 | 303 |
| `规章制度` | `True` | 224,346 | 20,388,638 | 256 | 0 | 0 | 0 | 0.000 | 1,238 |
| `办事流程` | `True` | 200,451 | 22,304,814 | 230 | 0 | 0 | 0 | 0.000 | 757 |
| `学生相关文件及表格` | `True` | 153,904 | 1,480,594 | 53 | 0 | 0 | 0 | 0.000 | 107 |
| `教务管理系统` | `True` | 200,823 | 19,584,559 | 161 | 0 | 0 | 0 | 0.000 | 797 |
| `信息门户` | `True` | 197,859 | 19,188,935 | 151 | 0 | 0 | 0 | 0.000 | 756 |
| `附件1` | `True` | 246,226 | 28,259,257 | 330 | 0 | 0 | 0 | 0.000 | 1,536 |
| `缓考申请表` | `True` | 143,146 | 46,901 | 2 | 0 | 0 | 0 | 0.000 | 3 |
| `奖学金` | `True` | 192,861 | 25,121,730 | 254 | 0 | 0 | 0 | 0.000 | 498 |
| `辅导员` | `True` | 218,534 | 21,380,491 | 250 | 0 | 0 | 0 | 0.000 | 1,094 |
| `双创` | `True` | 154,924 | 3,781,225 | 72 | 0 | 0 | 0 | 0.000 | 93 |
| `互联网+` | `True` | 168,519 | 12,904,091 | 150 | 0 | 0 | 0 | 0.000 | 222 |
| `不存在的查询词` | `True` | 142,849 | 0 | 0 | 0 | 0 | 0 | 0.000 | 0 |
| `a` | `False` | 0 | 0 | 0 | 0 | 0 | 0 | 0.000 | 0 |

## Phase Gates

| Query | First trusted bytes | First trusted ms | Top hydrated bytes | Top hydrated ms | Proof bytes | Passed |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `校历` | 107,278 | 4.291 | 419,191 | 16.079 | 433,170 | `True` |
| `搜校历` | 107,278 | 4.083 | 419,191 | 15.778 | 433,170 | `True` |
| `慕课考试` | 112,044 | 4.252 | 446,912 | 17.895 | 484,313 | `True` |
| `期末考试` | 100,717 | 3.364 | 413,569 | 14.663 | 478,557 | `True` |
| `考试安排` | 103,912 | 3.370 | 418,728 | 14.872 | 483,716 | `True` |
| `选课` | 101,611 | 3.839 | 415,051 | 15.982 | 481,960 | `True` |
| `转专业` | 99,462 | 3.325 | 419,863 | 17.065 | 448,163 | `True` |
| `成绩` | 93,549 | 3.065 | 399,533 | 15.981 | 552,116 | `True` |
| `通知` | 105,835 | 4.052 | 420,985 | 16.759 | 723,161 | `True` |
| `学生` | 104,291 | 4.025 | 412,795 | 21.491 | 791,580 | `True` |
| `南京邮电大学` | 105,724 | 4.374 | 437,904 | 23.893 | 695,248 | `True` |
| `申请` | 107,562 | 4.313 | 406,756 | 30.497 | 509,886 | `True` |
| `考试` | 98,481 | 3.036 | 394,895 | 16.290 | 529,296 | `True` |
| `图像采集码` | 3,639,725 | 41.719 | 9,347,717 | 139.865 | 22,854,025 | `True` |
| `授课计划表` | 4,039,425 | 44.007 | 9,675,511 | 140.393 | 29,807,004 | `True` |
| `教材研究课题` | 4,266,950 | 47.791 | 9,474,141 | 145.150 | 20,846,258 | `True` |
| `开机卡` | 3,514,873 | 42.775 | 8,058,781 | 129.445 | 29,155,022 | `True` |
| `休学复学` | 3,931,492 | 46.335 | 8,475,400 | 138.345 | 23,432,950 | `True` |
| `课程替代` | 4,666,601 | 47.729 | 10,209,421 | 152.959 | 25,093,123 | `True` |
| `教学标兵奖` | 4,143,637 | 44.555 | 9,624,453 | 147.067 | 26,808,828 | `True` |
| `查成绩` | 93,549 | 2.999 | 399,533 | 14.714 | 552,116 | `True` |
| `成绩查询` | 93,549 | 3.051 | 399,533 | 14.832 | 552,116 | `True` |
| `成绩复核申请表` | 94,377 | 2.793 | 411,590 | 14.339 | 565,491 | `True` |
| `xlsx` | 103,876 | 3.242 | 417,018 | 13.613 | 552,389 | `True` |
| `大创` | 101,781 | 3.939 | 402,584 | 16.415 | 502,787 | `True` |
| `学科竞赛` | 94,855 | 3.480 | 377,443 | 14.575 | 431,241 | `True` |
| `普通话考试` | 86,323 | 2.086 | 261,999 | 4.674 | 265,603 | `True` |
| `挑战杯` | 93,503 | 3.282 | 358,237 | 12.676 | 368,639 | `True` |
| `推免` | 99,573 | 3.466 | 403,809 | 14.795 | 420,174 | `True` |
| `助学金` | 91,361 | 3.086 | 376,124 | 13.483 | 428,204 | `True` |
| `国家奖学金` | 93,097 | 3.102 | 383,245 | 14.094 | 434,739 | `True` |
| `困难认定` | 93,398 | 3.175 | 339,541 | 11.169 | 348,373 | `True` |
| `心理健康` | 95,607 | 2.763 | 379,444 | 11.444 | 398,548 | `True` |
| `学工` | 98,002 | 3.548 | 391,117 | 15.146 | 536,933 | `True` |
| `竞赛报名` | 106,579 | 4.276 | 427,289 | 18.217 | 464,170 | `True` |
| `规章制度` | 91,413 | 2.801 | 369,833 | 12.221 | 452,525 | `True` |
| `办事流程` | 97,310 | 3.437 | 406,766 | 16.159 | 465,563 | `True` |
| `学生相关文件及表格` | 90,629 | 2.402 | 354,069 | 9.571 | 366,319 | `True` |
| `教务管理系统` | 88,059 | 2.383 | 377,428 | 11.563 | 436,597 | `True` |
| `信息门户` | 96,870 | 2.876 | 422,497 | 14.525 | 478,702 | `True` |
| `附件1` | 107,954 | 3.597 | 444,459 | 15.947 | 549,031 | `True` |
| `缓考申请表` | 63,556 | 0.942 | 210,490 | 1.937 | 211,982 | `True` |
| `奖学金` | 90,990 | 2.799 | 381,191 | 13.836 | 432,398 | `True` |
| `辅导员` | 97,159 | 3.458 | 382,450 | 14.656 | 459,330 | `True` |
| `双创` | 93,517 | 3.475 | 396,521 | 16.055 | 409,791 | `True` |
| `互联网+` | 91,484 | 3.049 | 381,541 | 14.144 | 408,406 | `True` |
| `不存在的查询词` | 59,255 | 0.742 | 201,888 | 1.599 | 203,083 | `True` |
| `a` | 0 | 0.000 | 0 | 0.000 | 0 | `True` |

- First trusted hard gate: `<=5,242,880` bytes or `<=10%` of proof bytes.
- Top hydrated hard gate: `<=10,485,760` bytes or `<=25%` of proof bytes.
- Phase gates passed: `True`
- High-DF gates passed: `False` (first `<=131,072`, top `<=524,288`, proof `<=786,432` bytes).
- High-DF gate failures: `[{"query": "学生", "first_trusted_uncached_bytes": 104291, "top_results_uncached_bytes": 412795, "proof_complete_uncached_bytes": 791580, "hot_query_complete_certificate_used": true}]`

## Cache Benchmark

- Query count: `8`
- Max cold uncached bytes: `502,787`
- Max warm uncached bytes: `0`
- Total warm cached bytes: `4,440,062`
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
| `startup_entry_gap` | `engineering_gate_passed_not_absolute` | {"routed_first_screen_total_bytes": 230138, "bootstrap_manifest_bytes": 16538, "source_registry_bytes": 4805, "global_query_directory_bytes": 205942, "query_aliases_bytes": 2853, "startup_loads_local_indexes": false, "startup_loads_full_shards": false} | Metadata is already separated from local indexes and full shards, but the routed entry payload is still a practical JSON contract rather than an entropy-coded minimal decision table. | Delta-code source/query routing tables and measure whether a compact finite-state router beats the current manifest plus directory bytes without hurting debuggability. |
| `route_planning_gap` | `phase_gate_passed` | {"query_count": 48, "max_candidate_shard_count": 18, "max_loaded_shard_count": 91, "max_uncached_loaded_bytes": 29807004, "phase_gates_passed": true} | The planner emits expected byte costs and phase-local selections, but the route policy is still hand-calibrated rather than learned from an optimal decision rule. | Fit an offline decision policy on the evaluation corpus with byte cost as the Lagrange multiplier, then keep only policies that preserve task quality. |
| `first_trusted_gap` | `phase_gate_passed` | {"max_first_trusted_uncached_bytes": 4666601, "absolute_limit_bytes": 5242880, "max_first_trusted_elapsed_ms": 47.791, "query_path_mean_current_bytes": 382857, "query_path_bytes_percent_change": -27.842, "query_path_passed": true} | The phase is byte-gated and query-path decode improved versus baseline, but the remaining gap is proving that no loaded local-index byte is irrelevant to the first trusted result. | Add per-term contribution accounting for first-result eligibility and drop zero-contribution term blocks. |
| `top_results_hydrated_gap` | `phase_gate_passed` | {"max_top_results_uncached_bytes": 10209421, "absolute_limit_bytes": 10485760, "max_top_results_elapsed_ms": 152.959, "query_path_mean_current_bytes": 1033485, "query_path_bytes_percent_change": -14.863, "query_path_passed": true} | Top results are separated from proof completion, but candidate upper bounds are not yet serialized as a formal certificate that every skipped block is dominated. | Persist block-level score upper bounds and emit a top-k dominance certificate for skipped blocks. |
| `proof_complete_certificate_gap` | `largest_remaining_theoretical_gap` | {"max_proof_complete_uncached_bytes": 29807004, "max_proof_complete_elapsed_ms": 625.749, "proof_catalog_total_bytes": 756879, "shard_filter_total_bytes": 6051945, "proof_certificate_total_bytes": 6808824, "hot_query_proof_directory_bytes": 141654, "hot_que... | Correctness is complete, but proof completion can still approach a full-shard read. The mathematical lower bound is a certificate stream, not full document hydration. | Separate false-positive filter pressure from true-match shard pressure, then generate doc/postings or hot-query certificates for true-match-heavy broad queries. |
| `full_shard_dependency_gap` | `known_remaining_dependency` | {"full_scan_total_bytes": 45717182, "proof_certificate_total_bytes": 6808824, "max_full_shard_bytes": 499697, "full_shard_count": 942, "max_proof_complete_uncached_bytes": 29807004} | The serving path no longer depends on full shards for startup or early results, but exhaustive proof still has a full-shard fallback. | Split proof certificates from full document bodies and make full bodies lazy even during proof completion. |
| `packed_index_decode_gap` | `query_path_gate_passed` | {"local_index_runtime_bytes": 32857855, "binary_artifact_total_bytes": 25884445, "runtime_byte_change_percent": -13.756, "runtime_decode_change_percent": -0.239, "query_path_passed": true, "body_decode_mode": "packed_query_term_selective", "light_decode_mod... | Packed selective decode is active on the hot query path, but block metadata is still decoded at artifact granularity rather than at the exact surviving term/block frontier. | Move to block directory offsets with direct term/block seeks and SIMD/WASM-friendly score scans. |
| `topk_pruning_gap` | `evidence_present` | {"any_dynamic_pruning": true, "total_postings_pruned": 125, "wasm_decision_status": "rust_wasm_retrieval_runtime_selected"} | Dynamic pruning is present, but the report does not yet prove that the pruning order is optimal for every query under the scoring function. | Record WAND/BMW-style upper-bound ledgers per query and compare visited postings against an oracle ordering. |
| `persistent_cache_gap` | `warm_cache_gate_passed` | {"cache_query_count": 8, "max_cold_uncached_bytes": 502787, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 4440062, "browser_persistent_cache_passed": true} | Warm network bytes are gated locally; remaining lower-bound work is CPU decode reuse and browser-level confirmation when a browser report is missing. | Persist decoded packed-index pages and reuse score-session state across repeated same-version queries. |
| `attachment_semantics_gap` | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "text_extracted": 0... | Attachment evidence is summarized, but there is no per-query proof that the summary is the minimal sufficient statistic for attachment relevance. | Add query-term-to-attachment-evidence attribution and measure dropped attachment fields against task quality. |
| `ranking_calibration_gap` | `task_quality_gate_present` | {"quality_eval_skipped": null, "task_eval_skipped": null, "task_eval_passed": 29, "expectation_count": 29, "max_elapsed_ms": 626.156} | Quality gates exist, but ranking weights are still an engineered policy rather than a Pareto-optimal model over relevance, trust, recency, and byte cost. | Run ablations over ranking features and fit byte-aware weights that stay on the quality Pareto frontier. |
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
| 2 | `evidence_present` | {"planner": "Planner telemetry includes route expected_cost_bytes, selected expected_uncached bytes, cache state per local index, and phase-specific local index selections.", "max_first_trusted_uncached_bytes": 4666601, "first_trusted_absol |
| 3 | `evidence_present` | {"any_dynamic_pruning": true, "total_postings_pruned": 125} |
| 4 | `evidence_present` | Measured queries report proof ledger complete with zero pending/failed shards; runtime tests cover no-match proof, failed shard refusal, and cancelled pending-ledger refusal. |
| 5 | `evidence_present` | {"artifact_total_bytes_current": 85944941, "artifact_total_bytes_baseline": 95411182, "runtime_parse_decode_summary": {"baseline_local_index_runtime_bytes": 38098815, "current_local_index_runtime_bytes": 32857855, "bytes_delta": -5240960, " |
| 6 | `evidence_present` | {"light_json_bytes": 0, "light_split_runtime_bytes": 15992047, "body_json_bytes": 0, "body_packed_runtime_bytes": 16865808, "note": "Packed binary light terms plus metadata JSON are used for query planning; packed binary light/body indexes  |
| 7 | `evidence_present` | {"artifact_count": 246, "benchmark": "packed-impact-retrieval-wasm-vs-typescript-v2", "collection": "apps/web/public/generated/collections/njupt-public", "decision": {"reason": "The browser runtime consumes Rust/WASM stateful score entries  |
| 8 | `evidence_present` | {"query_count": 8, "max_cold_uncached_bytes": 502787, "max_warm_uncached_bytes": 0, "total_warm_cached_bytes": 4440062, "max_warm_ms": 14.523, "passed": true, "failure_count": 0, "cache_invalidation_test": "Changed content-hash artifact pat |
| 9 | `evidence_present` | {"policy": "metadata_and_filename_only_no_extracted_attachment_content", "levels": ["metadata_only", "filename_only", "text_extracted", "snippet", "full_content"], "coverage": {"total": 8100, "metadata_only": 8100, "filename_only": 8100, "t |
| 10 | `evidence_present` | Smoke queries, task queries, measured cold queries, warm cache queries, and a negative query are represented when full report mode is used. |
| 11 | `evidence_present` | {"report": "njupt-search-browser-verification-v21-compact-proof", "generated_at": "2026-06-05T04:47:29.418528+00:00", "base_url": "http://127.0.0.1:51352/", "summary": {"passed": true, "scenario_count": 11, "failed": [], "persistent_cache_p |
| 12 | `external_ci_deploy_required` | Local validators/tests/builds can be recorded separately; CI/deployment status is outside this local report. |
| 13 | `evidence_present` | This report includes byte, time, quality, cache, pruning, parse/decode, and coverage sections. |
| 14 | `unmet` | Commit, push, CI, and deployment checks are intentionally not claimed by this report. |
| 15 | `evidence_present` | {"required_layers": ["startup_entry_gap", "route_planning_gap", "first_trusted_gap", "top_results_hydrated_gap", "proof_complete_certificate_gap", "full_shard_dependency_gap", "packed_index_decode_gap", "topk_pruning_gap", "persistent_cache |

## Reproduction

```powershell
uv run --python 3.13 python -m njupt_search_eval run-lower-bound-report --baseline-ref HEAD --collection apps\web\public\generated\collections\njupt-public --output tools\search-eval\reports\njupt-search-lower-bound-report.json --markdown tools\search-eval\reports\njupt-search-lower-bound-report.md
```

This report is evidence for the active lower-bound goal. It does not claim final completion while DoD items remain unmet.
