# Architecture

`njupt-search` 维护一个持续演进的校园信息产品。一级目录不是六个平级业务层：
`search`、`academics` 和 `apps` 是生产本体；`benchmarks`、`ops` 和 `docs`
从系统边缘支撑它们。

## Search

```text
NjuptCorpusSnapshot
  -> search/native build-index
  -> search/core
  -> SearchBundle

apps/web
  -> search/browser SearchClient
  -> Web Worker
  -> search/wasm
  -> search/core
  -> Query / SearchResult
```

`search/core` 是规范化、分词、索引编码与解码、召回、排名和 snippet
位置的唯一生产实现。native 与 WASM 只是适配器。浏览器先读取
`manifest.json`、`documents.bin` 和 `lexicon.bin`，查询时按需读取
`postings-*.bin`，确定 Top-K 后才读取 `content-*.bin`。

当前唯一格式是 `njupt-search-bundle-v2`。上述五类 `.bin` 都是在紧凑
二进制编码之后再进行 zstd 压缩；manifest 同时记录传输字节数
`bytes`、解压字节数 `decoded_bytes` 和压缩内容哈希。native 与 WASM
都调用 `search/core` 的同一个有界解压实现，解压尺寸不匹配或超出预算
直接失败。“紧凑编码”表示字段的二进制布局，“zstd 压缩”才表示可逆地
减少传输字节，两者不是同一件事。

`SearchClient` 显式接收 artifact base URL，并拥有 Worker 与 pending
请求。Worker 协议只有 `init/search/cancel` 与 `ready/results/error`。
artifact 缓存和 engine chunk working set 都属于实例，有字节预算和淘汰；
输入缺失、损坏、不兼容或单次 working set 超预算时直接失败。

native 构建器只接受 `njupt-corpus-snapshot-v2`。它验证快照的四个精确
文件、三项 artifact 大小与哈希、snapshot identity、source 计数、
document/attachment/link 唯一身份以及 attachment 的父子投影完整性。
搜索只把 documents 映射进索引；attachments 表由上游拥有，并与 document
内的最小附件投影严格对应；links 表参与快照身份和引用校验，但不被第二次
解释为搜索语义。带明确 label 的外部链接已由语料生产者物化为
`kind=external` document。

## Academics

```text
ExamSource
  -> academics/exam/source
  -> materialized Excel
  -> academics/exam/records
  -> academics/exam/snapshot
  -> ExamSnapshot
       |-> academics/exam/history
       |-> academics/room/occupancy + RoomCatalog -> RoomOccupancy
       `-> academics/calendar -> ExamSchedule / ICS
```

`exam` 不依赖 `room`。`room` 只通过 exam 的公开 `ExamSnapshot` 与
`ExamRecord` 消费考试数据。Python 生产唯一当前格式；TypeScript 只有一个
严格 decoder。所有 manifest 中的路径相对于自己的 artifact 根目录。

`ExamSnapshot`：

```text
manifest.json                         njupt-exam-snapshot-v2
exams.json                            canonical ExamRecord[]
class-index.json                      exam-class-index-v2
classes/*.json                        exam-class-data-v1
history/manifest.json                 exam-history-manifest-v2
history/classes/*.json                exam-class-history-v3
```

manifest 的 `snapshot_id` 由当前格式、考试源内容身份和三项顶层 artifact
引用计算。顶层引用、每个班级分片和每个历史分片都记录相对路径、字节数与
SHA-256；Python 消费者和浏览器消费者均先验证引用，再解析内容。没有旧快照
输入时仍生成一个合法的单节点历史。产物时间取自显式 materialized source
的 `updated_at`，不读取编译时钟；因此相同输入从空目录构建会得到相同字节
和相同 identity。

`RoomOccupancy`：

```text
manifest.json                         njupt-room-occupancy-v3
by-floor/<date>/<floor>.json          njupt-room-occupancy-floor-v2
diagnostics.json                      njupt-room-occupancy-diagnostics-v2
```

`RoomOccupancy` 明确记录输入 ExamSnapshot 的 `data_version`、RoomCatalog
的 `catalog_id`，以及所有楼层/日期分片和诊断文件的相对路径、字节数与
SHA-256。其 `occupancy_id` 由这些真实输入和输出引用计算。未知目录房间直接
导致构建失败；无法解析为教室的普通地点只进入可见诊断。

## Product and composition

`apps/web/src` 按产品能力组织：`app` 只做启动、路由和 shell；`home`、
`search`、`exams`、`rooms` 各自拥有完整交互；`shared` 仅容纳至少两个
能力共同使用的 UI/HTTP 原语。Android 是 Web/TWA 交付外壳。

`ops` 只接受显式路径并排列生产入口：

```text
CorpusSnapshot -> SearchBundle
ExamSource -> ExamSnapshot -> RoomOccupancy
SearchBundle + ExamSnapshot + RoomOccupancy + static Web source
  -> external staging -> Web dist
```

生成物不写回源码树。`benchmarks/search` 可以解析生产输出并判定质量，
但生产代码不知道查询期望或 benchmark 通过规则。
