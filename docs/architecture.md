# Architecture

`njupt-search` 维护一个持续演进的校园信息产品。`search`、`academics` 和
`apps` 是生产本体；`benchmarks`、`ops` 和 `docs` 只从系统边缘支撑它们。

## Dependency direction

```text
NjuptCorpusSnapshot
  -> search/native -> search/core -> SearchBundle

apps/web
  -> search/browser -> search/wasm -> search/core
  -> academics/exam
  -> academics/room -> academics/exam public model
  -> academics/timetable -> academics/room catalog

benchmarks -> production entry points
ops        -> production entry points + apps assembly
```

`search` 与 `academics` 不相互依赖；领域代码不依赖 App、benchmark 或
PowerShell。Android 只是 Web/TWA 交付外壳。

## Corpus boundary

`njupt-site-graph` 拥有 `njupt-corpus-snapshot`：

```text
manifest.json
documents.jsonl.zst
attachments.jsonl.zst
links.jsonl.zst
```

附件表是附件元数据唯一权威，document 只保存 `attachment_ids`。native
验证精确文件集、大小、SHA-256、snapshot identity、必需字段、唯一性与附件
引用，然后把 document 与所需附件显式 join 为 `IndexDocument`。它不重新
计算上游 ID、不重新规范化或去重事实。links 的文件身份受 manifest 保护；
搜索不消费 links，因此不解压、不解释该表。

## Search

```text
IndexDocument
  -> BundleCompiler
  -> SearchBundle

SearchBundle + Query
  -> QueryPreparation
  -> QueryPlan
  -> SearchResponse
```

`search/core` 是规范化、文档与查询分析、索引 codec、zstd、召回、排名和
snippet 原文位置映射的唯一实现。文档分析保留词频，查询分析产生去重 token。
native 与 WASM 调用同一 core；TypeScript 不实现搜索算法。

SearchBundle 的唯一当前格式是 `njupt-search-bundle`：

```text
manifest.json
documents.bin
lexicon.bin
postings-*.bin
content-*.bin
```

manifest 明确记录 documents、lexicon、postings 和 content 的路径、传输
字节、解码字节与压缩内容 SHA-256。`bundle_id` 只由这些输出 artifact
计算，`corpus_snapshot_id` 只表示来源。因此 links-only 变化可以改变
snapshot identity，但在搜索输出字节不变时不会改变 bundle identity。

每个 `.bin` 都先使用紧凑二进制布局，再使用 zstd。紧凑编码定义字段布局，
zstd 才减少传输字节。reader 验证 magic、哈希、声明大小和解压预算。

查询采用明确的可选筛选字段；无筛选就是字段缺失。日期使用绝对上下界和
`includeUndated`，产品层负责把“近一年”转换成日期。`SearchResponse` 只暴露
`totalCandidates` 与 results；benchmark 在调用入口外计时。

查询只分析和排名一次。`QueryPreparation` 保存规范化结果、召回词和概念别名；
postings 到齐后，core 生成稳定的 `QueryPlan`，其中只有排好序的文档编号、命中
词和分页位置。计划先生成不含正文的准确结果骨架，再为当前页生成 snippet。
骨架不是近似结果：它已经处理完本次查询需要的 postings，并使用最终排序；
hydration 只补充正文摘要，不会改变结果集合和顺序。

相关性按明确层级比较：标题完整短语优先，其次是标题全部核心词、正文全部核心
词、minimum-should-match，最后才是部分 n-gram 召回。常用简称在同一个 Rust
查询分析中展开为概念短语，只用最长覆盖词拉取候选，较短词用于候选覆盖判断。
候选准入只由未筛选的查询分析和匹配层级决定：完整正文匹配不会因标题匹配数量
而被删除；只有真正的部分匹配会在已有足够强候选时关闭 fallback。来源、类型、
日期和排序在准入之后作用，因此增加筛选只能缩小 canonical/presentation 集合，
`relevance` 与 `date_desc` 只改变同一集合的顺序，`totalCandidates` 始终表示折叠
转载后的完整候选数。
同一相关层级内再考虑产品意图对应的来源、发布时间、词频和稳定 ID；因此时效性
不会让新但无关的页面压过旧而准确的结果。结果选择折叠完全相同的 URL；对于
发布时间相同、只相差明确部门前缀且其余标题完全相同的转载，同一结果页也只
展示排序更高的一条。这只是展示多样性，不生成业务身份，也不修改或删除上游
corpus 事实。

浏览器在用户聚焦搜索框或开始输入时准备搜索；WASM 初始化和 manifest 请求
并行，随后并行加载 documents 与 lexicon。查询时加载所需 postings，准确
Top-K 骨架就绪后先交给 React，再按 10 条一页加载约 128 KiB 目标大小的正文
块并补齐 snippet。加载更多复用同一 QueryPlan，不为未展示结果预取正文。

`SearchClient` 拥有一个 Worker，生命周期为
idle → initializing → ready → disposed。Worker 严格串行执行查询，协议只有
`init/search/cancel` 与 `ready/results/error`。压缩 artifact 缓存采用实例
LRU 字节预算；WASM decoded working set 使用独立预算。取消、重初始化和
dispose 都会释放相应请求与运行时状态。postings 可以在预算内复用，content
只在当前页摘要生成期间解码，生成后立即释放，不会因正文累计而重建整个引擎。

manifest 使用稳定入口 `/generated/search/manifest.json`，要求重新验证；其余
artifact 放在 `/generated/search/<bundle_id>/...`，以内容身份寻址并使用长期
immutable 缓存。每个 artifact 仍由 manifest 中的大小与 SHA-256 校验，部署
新 bundle 不会把旧分块误配给新 manifest。

Bundle 写出使用外部空 staging，全部写完后由当前 reader 自校验，再原子替换
目标目录。失败不会把半成品暴露成完整 bundle。

## Academics

```text
ExamSourceDescriptor
  -> materialized Excel
  -> ExamRecord[]
  -> ExamSnapshot
       |-> RoomCatalog -> RoomOccupancy
       |-> ExamHistoryCompiler
       |      + previous ExamHistory
       |      + previous trusted ExamSnapshot
       |      `-> ExamHistory
       `-> ICS

TeachingScheduleSource
  -> TeachingScheduleCompiler
       |-> TeachingScheduleSnapshot
       `-> RoomCatalog + ExamSnapshot -> TeachingRoomOccupancy
```

descriptor、原始 Excel、可复用缓存和输出 artifact 使用不同显式路径。
`ExamSnapshot` 的唯一当前格式是 `njupt-exam-snapshot`：

```text
manifest.json
exams.json
class-index.json
classes-*.json
```

manifest 拥有 `snapshot_id`、`source_id`、`records_id`、上游更新时间、
考试周期和全部 artifact 引用。class index 把班级映射到按目标字节形成的
class chunk；浏览器初始化一次 manifest/index，之后只加载目标班级所在块。
每条 `ExamRecord` 同时拥有行级 `stable_key` 和课程级 `history_key`。同班同课程
因教师、教室或人数拆成的多条记录共享一个 `history_key`；因此历史比较以明确的
课程考试身份聚合可变字段，不依赖行号，也不做模糊配对。

`ExamHistory` 的唯一当前格式是 `njupt-exam-history`：

```text
manifest.json
events.json
class-index.json
classes-*.json
```

第一次观察到一个考试周期时只建立可信基线，不伪造此前变化。后续构建必须同时
读取当前历史头及其声明的上一 `ExamSnapshot`；快照身份相同则逐字复用历史，身份
变化才追加观察事件。事件时间只使用来源更新时间。记录顺序和精确重复不会产生
变化；时间、地点、校区、人数、教师和备注按字段比较。不同考试周期重新建立基线，
不跨学期串联。

历史只保存全局事件、班级索引和发生变化的字段，不复制历次完整快照。manifest、
所有分块大小、SHA-256、快照链和 `history_id` 都由 Python reader 自校验；TypeScript
使用同一严格契约读取，不接受旧格式。

Web 交付不改变上述领域格式，但把稳定发现入口与不可变内容分开：

```text
/generated/exam/manifest.json
/generated/exam/<snapshot_id>/exams.json
/generated/exam/<snapshot_id>/class-index.json
/generated/exam/<snapshot_id>/classes-*.json
```

稳定 manifest 每次冷启动允许重新验证；它引用的 artifact 在部署层统一加入
`snapshot_id`，使用一年 immutable 缓存。浏览器仍按领域 manifest 的原始
`path`、`bytes` 和 `sha256` 严格校验，不存在旧稳定路径副本或 fallback。

ExamHistory 使用独立的稳定发现入口和内容身份：

```text
/generated/exam/history/manifest.json
/generated/exam/history/<history_id>/events.json
/generated/exam/history/<history_id>/class-index.json
/generated/exam/history/<history_id>/classes-*.json
```

稳定 manifest 重新验证；`history_id` 路径长期 immutable。组装器要求历史头的
`current_snapshot_id` 与同一站点中的 ExamSnapshot 完全一致，拒绝混合新考试与
旧历史。

`RoomCatalog` 是校区、楼宇、楼层、教室和必要 alias 的唯一事实源；源 JSON
不保存派生 key。Python 编译器稳定派生 room/floor key。TypeScript 只先识别
房间查询意图，最终目标必须用 RoomOccupancy 携带的 catalog 投影解析。

`RoomOccupancy` 的唯一当前格式是 `njupt-room-occupancy`。manifest 记录
`occupancy_id`、输入 `exam_snapshot_id`、`room_catalog_id`、rooms、floors、
dates，以及每个 date/floor 文件的路径、大小和哈希。普通无法解析地点只作为
CLI 诊断；已经解析为教室却不在 catalog 时构建失败。诊断不是生产 artifact。

RoomOccupancy 使用相同的稳定指针/不可变内容契约：

```text
/generated/rooms/manifest.json
/generated/rooms/<occupancy_id>/floors/*.json
```

manifest 重新验证当前 `occupancy_id`；floor artifact 只按当前日期和楼层加载，
不预取完整分片。组装器验证输入的精确文件集合，并且只写出稳定 manifest 与
identity 子目录。

`njupt-jwxt` 在用户已经登录的当前教务系统中读取 JSON 接口，并输出唯一的
`njupt-teaching-schedule-source`。源包显式包含目录、学期、节次和每个目录项的
终态；Cookie、Token、账号模型、电话和私有在线链接不会进入导出。源包以
`source_id` 内容寻址，目录顺序、分页状态和构建时间不影响 identity。

Python 是课表语义的唯一所有者。它严格读取 TeachingScheduleSource，规范化班级、
课程、周次、节次和地点，以教学班、课程、时间、地点和教师组成稳定业务身份；合班
课程只保留一个 `TeachingMeeting`，通过 `class_ids` 关联全部班级。输出的唯一当前
格式 `njupt-teaching-schedule` 包含 `term.json`、`periods.json`、班级索引、班级
分块和 meeting 分块。浏览器只加载目标班级对应的分块，不下载全校课表。

`TeachingRoomOccupancy` 的唯一当前格式是 `njupt-teaching-room-occupancy`。它从同一
TeachingScheduleSnapshot 派生，并引用当前 ExamSnapshot；每个周次/星期分片只保存
课程占用。空教室产品在客户端针对目标节次联合课程占用和考试占用，再从同一
RoomCatalog 中求候选差集。无法识别的线上、无地点和非实体场地只进入构建审计，
真实标准教室缺失则构建失败。

```text
/generated/timetable/manifest.json
/generated/timetable/<snapshot_id>/term.json
/generated/timetable/<snapshot_id>/periods.json
/generated/timetable/<snapshot_id>/class-index.json
/generated/timetable/<snapshot_id>/classes-*.json
/generated/timetable/<snapshot_id>/meetings-*.json

/generated/classrooms/manifest.json
/generated/classrooms/<occupancy_id>/*.json
```

日历能力位于 `academics/exam/calendar.ts`，只把公开 ExamRecord 转换为 ICS。
Python 拥有 ExamSnapshot 和 RoomOccupancy 写出；每种 artifact 在 TypeScript
中只有一个严格 decoder，并由真实 Python 产物做跨语言读取测试。

## Product and composition

`apps/web/src` 按产品能力组织：`app` 只做启动、路由和 shell；`home`、
`search`、`timetable`、`classrooms`、`exams`、`rooms` 各自拥有完整交互；
`shared` 只容纳至少两个能力
共同使用的 UI/HTTP 原语。

首页快捷入口使用判别联合表达 `timetable`、`classrooms`、`exam`、`rooms` 或
`search` 意图，而不是依靠
按钮文字触发隐藏分支。七个全文入口只提供查询意图，随后仍由 SearchClient →
Worker → WASM → Rust core 完成统一搜索；不存在热词结果、独立排名或 UI
fallback。

产品路由只读取 `pathname` 与标准 query string。`/timetable`、`/classrooms`、
`/exam`、`/rooms` 永远表示
可分享、可刷新且不含本地历史的 landing；`class`、`q`、`room`、
`week/weekday/period` 与 `campus/building/floor` 参数才表示详情。首页主按钮始终进入 landing，保存的班级
或教室只通过 landing 中的“继续查看”次级按钮暴露。`考试安排` 输入直接进入
`/exam`，不使用查询参数充当内部哨兵。站内导航使用 History API，返回、前进和
刷新都由同一套 URL 状态驱动。

Web 构建只生成当前六个产品路径：`/`、`/search`、`/timetable`、`/classrooms`、
`/exam`、`/rooms`。构建结束后复用现有 React landing 组件写出对应的静态
`index.html`；浏览器启动后接管相同 DOM。原始响应已经含有 H1、真实链接和页面
专属 metadata，不等待任何业务 artifact。根目录 `404.html` 由 EdgeOne 作为真实 404 返回，部署配置不
设置全站页面回退。

`app/seo/pageSeo.ts` 是 title、description、robots、canonical、Open Graph 与
WebSite JSON-LD 的唯一来源。只有 `/`、`/timetable`、`/classrooms`、`/exam`、
`/rooms` 允许索引；`/search` 以及带查询参数的课表、空教室、考试和教室状态使用
`noindex, follow`，不进入 sitemap，也不
复制学校文章生成本站内容页。`robots.txt` 只声明抓取与 sitemap 入口；sitemap
只列出五个稳定 canonical URL。

Timetable、Classrooms、Exam 与 Rooms landing 是初始 App bundle 中的小型静态产品壳，不等待页面详情
模块或业务 artifact；Rooms 在壳出现后才补充校区、楼栋、教室数和日期数。
详情页面继续 lazy load，首页按钮的 pointerenter、focus 和 pointerdown 会并行
预载详情模块与对应 manifest/index。

六个浏览器客户端都由 App 显式创建并在卸载时 dispose：

```text
App
├── SearchClient
├── ExamSnapshotClient
├── ExamHistoryClient
├── RoomOccupancyClient
├── TeachingScheduleClient
└── ClassroomAvailabilityClient
```

所有 Academics 客户端在同一 SPA 会话中复用 manifest、index 与已访问分片；
显式 refresh 发现 identity 改变时清除旧 identity 缓存。调用者
的 AbortSignal 只取消该次等待，最新详情/楼层请求会取消旧请求，初始化预热则由
App 生命周期拥有，避免页面切换破坏可复用状态。

`ExamHistoryClient` 先验证历史头与当前 ExamSnapshot，再并行读取全局事件和班级
索引；班级分块只在查看该班时加载。考试卡片仍优先显示，历史失败只影响更新记录
区域。服务端历史回答“学校发布的数据经历了哪些变化”；考试卡片的“新增/有更新”
继续只表示相对本浏览器上次导出的日历发生变化，两者不共用状态。

```text
CorpusSnapshot -> SearchBundle
ExamSourceDescriptor -> ExamSnapshot -> ExamHistory + RoomOccupancy
TeachingScheduleSource -> TeachingScheduleSnapshot -> TeachingRoomOccupancy

SearchBundle + ExamSnapshot + ExamHistory + RoomOccupancy
  + TeachingScheduleSnapshot + TeachingRoomOccupancy + static Web source
  -> external staging -> Web dist
```

搜索与教务 artifact 独立生产，只在 Web 组装阶段组合。`ops` 只接受显式
路径并排列生产入口；workflow 只负责云端下载、重试和调用相同入口。生成物
不写回源码树。benchmark 可以读取生产输出并判断质量，生产代码不知道
benchmark 期望。

EdgeOne Pages 对稳定 Academics manifest 使用 `no-cache, max-age=0,
must-revalidate`，对 identity 路径使用 `public, max-age=31536000, immutable`。
传输压缩采用 EdgeOne 对 `application/json` 的原生 Brotli/Gzip 智能压缩，浏览器
原生解压后再执行领域大小与 SHA-256 校验；仓库不生成无人消费的 `.br` 副本，
也不在业务代码中引入第二套压缩格式。边缘首次 Miss 可能先返回原文，缓存命中后
按客户端 `Accept-Encoding` 返回 Brotli/Gzip，这是 CDN 层而不是领域格式语义。

云端同样保持这两个生产事务独立。`Build Corpus Artifact` 把 SearchBundle
作为按内容寻址的 OCI artifact 发布；`Build Academics Artifact` 把
ExamSnapshot、ExamHistory、RoomOccupancy、TeachingScheduleSnapshot 与
TeachingRoomOccupancy 作为五个明确组件放进一个内容寻址的 Academics OCI
artifact。组合 identity 由五个组件 identity 共同确定。当前 corpus、
search 和 academics 分别使用一个完整 JSON 指针，引用 OCI manifest digest、
领域 identity、归档文件名与 SHA-256，不再把 URL/hash 拆成可能错配的多个
变量。

更新 Academics 时，workflow 先严格下载当前五组件 artifact，验证考试历史头与
上一快照一致，再构建新快照、增量历史、课表和课程占用。五个不可变归档都发布成功后才更新唯一的
`ACADEMICS_ARTIFACT` 指针；失败不会移动历史头。Actions 短期 artifact 只负责把
同一次构建交给 Web 组装，不承担历史保存。

两个 workflow 的 Web 组装 job 只读取 SearchBundle 和 Academics 五组件这六个
明确 artifact，不重新生产另一个领域的输出。只有六者全部通过身份校验，才会
生成 `njupt-search-dist` 并通过 `workflow_run` 交给 EdgeOne 部署。Git Tags 与
GitHub Releases 只表达软件版本及其 Android 安装包；滚动数据和编译产物不会
污染源码版本历史。
