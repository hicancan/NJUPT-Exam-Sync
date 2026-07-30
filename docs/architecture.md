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
  -> SearchEngine
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

浏览器先加载 manifest、documents 和 lexicon；查询时加载所需 postings，
确定 Top-K 后加载正文块。`SearchClient` 拥有一个 Worker，生命周期为
idle → initializing → ready → disposed。Worker 严格串行执行查询，协议只有
`init/search/cancel` 与 `ready/results/error`。压缩 artifact 缓存采用实例
LRU 字节预算；WASM decoded working set 使用独立预算。取消、重初始化和
dispose 都会释放相应请求与运行时状态。

Bundle 写出使用外部空 staging，全部写完后由当前 reader 自校验，再原子替换
目标目录。失败不会把半成品暴露成完整 bundle。

## Academics

```text
ExamSourceDescriptor
  -> materialized Excel
  -> ExamRecord[]
  -> ExamSnapshot
       |-> RoomCatalog -> RoomOccupancy
       `-> ICS
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
当前没有持久的多个快照输入，因此不生成历史 artifact 或历史 UI。

`RoomCatalog` 是校区、楼宇、楼层、教室和必要 alias 的唯一事实源；源 JSON
不保存派生 key。Python 编译器稳定派生 room/floor key。TypeScript 只先识别
房间查询意图，最终目标必须用 RoomOccupancy 携带的 catalog 投影解析。

`RoomOccupancy` 的唯一当前格式是 `njupt-room-occupancy`。manifest 记录
`occupancy_id`、输入 `exam_snapshot_id`、`room_catalog_id`、rooms、floors、
dates，以及每个 date/floor 文件的路径、大小和哈希。普通无法解析地点只作为
CLI 诊断；已经解析为教室却不在 catalog 时构建失败。诊断不是生产 artifact。

日历能力位于 `academics/exam/calendar.ts`，只把公开 ExamRecord 转换为 ICS。
Python 拥有 ExamSnapshot 和 RoomOccupancy 写出；每种 artifact 在 TypeScript
中只有一个严格 decoder，并由真实 Python 产物做跨语言读取测试。

## Product and composition

`apps/web/src` 按产品能力组织：`app` 只做启动、路由和 shell；`home`、
`search`、`exams`、`rooms` 各自拥有完整交互；`shared` 只容纳至少两个能力
共同使用的 UI/HTTP 原语。

```text
CorpusSnapshot -> SearchBundle
ExamSourceDescriptor -> ExamSnapshot -> RoomOccupancy

SearchBundle + ExamSnapshot + RoomOccupancy + static Web source
  -> external staging -> Web dist
```

搜索与教务 artifact 独立生产，只在 Web 组装阶段组合。`ops` 只接受显式
路径并排列生产入口；workflow 只负责云端下载、重试和调用相同入口。生成物
不写回源码树。benchmark 可以读取生产输出并判断质量，生产代码不知道
benchmark 期望。

云端同样保持这两个生产事务独立。`Build Corpus Release` 发布不可变
SearchBundle 并更新其当前 URL/hash；`Build Exam Snapshot` 发布不可变
ExamSnapshot 与 RoomOccupancy 并更新各自 URL/hash。两个 workflow 的 Web
组装 job 只读取三个明确指针，不重新生产另一个领域的 artifact。成功组装的
`njupt-search-dist` 通过 `workflow_run` 交给 EdgeOne 部署；没有完整三件套的
首次 bootstrap 运行可以发布自己的 artifact，但不会产生或部署半成品 dist。
