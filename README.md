# njupt-search

南京邮电大学校园语料全文检索、考试、教室与日历产品。本仓库消费显式的
`NjuptCorpusSnapshot`，不负责爬取、站点解析或上游事实修补。

## Architecture

一级目录由三个生产本体和三个外围支撑组成：

```text
apps/         Web 与 Android 产品交付
search/       CorpusSnapshot -> SearchBundle -> Query -> SearchResponse
academics/    ExamSource -> ExamSnapshot -> RoomOccupancy / ICS
benchmarks/   从外部测量生产入口
ops/          显式路径、命令顺序与 artifact 组装
docs/         对真实代码的说明
```

二级边界按能力和对象所有权形成：

```text
apps/
  web/src/{app,home,search,exams,rooms,shared}
  android/
search/
  core/       唯一规范化、分词、索引、召回、排名和摘要语义
  native/     CorpusSnapshot、文件系统和 CLI 适配
  wasm/       core 的浏览器导出
  browser/    artifact、预算缓存、Worker、SearchClient
academics/
  exam/{source,records,snapshot,query} + calendar.ts
  room/{catalog,occupancy,query}
benchmarks/search/
ops/
docs/
```

完整依赖和 artifact 契约见
[docs/architecture.md](docs/architecture.md)。

## Local development

需要 Node.js 24、Rust stable、`wasm32-unknown-unknown`、`wasm-pack`、
Python 3.12 与 `uv`。

```powershell
npm ci
uv sync --extra test
.\ops\test.ps1 -Mode quick
```

从显式语料构建外部 SearchBundle：

```powershell
.\ops\build-search-bundle.ps1 `
  -CorpusPath D:\Data\njupt-refactor\corpus-current `
  -BundlePath D:\Data\njupt-refactor\njupt-search-current\search-bundle
```

考试源描述必须写到源码树外。发现、物化和编译分别执行：

```powershell
uv run python -m academics.exam discover `
  --output D:\Data\njupt-refactor\njupt-search-current\exam-source.json

.\ops\build-academics.ps1 `
  -SourcePath D:\Data\njupt-refactor\njupt-search-current\exam-source.json `
  -MaterializedPath D:\Data\njupt-refactor\njupt-search-current\exam-materialized `
  -CachePath D:\Cache\njupt-search\exam-source `
  -ExamOutputPath D:\Data\njupt-refactor\njupt-search-current\exam-snapshot `
  -RoomOutputPath D:\Data\njupt-refactor\njupt-search-current\room-occupancy `
  -RoomCatalogPath .\academics\room\catalog\njupt-room-catalog.json
```

只有组装阶段把三个独立 artifact 放入一次性 Web staging：

```powershell
.\ops\assemble-web.ps1 `
  -SearchBundlePath D:\Data\njupt-refactor\njupt-search-current\search-bundle `
  -ExamSnapshotPath D:\Data\njupt-refactor\njupt-search-current\exam-snapshot `
  -RoomOccupancyPath D:\Data\njupt-refactor\njupt-search-current\room-occupancy `
  -StagePath D:\Temp\codex\njupt-search-final\web-stage `
  -DistPath D:\Temp\codex\njupt-search-final\dist
```

完整 156 条查询质量测量：

```powershell
node benchmarks\search\quality.mjs `
  --bundle D:\Data\njupt-refactor\njupt-search-current\search-bundle
```

所有生产 reader 只读取唯一当前契约。源码树不保存语料、索引、考试输出、
可复用缓存、staging 或 dist。

## Cloud update loop

两条 artifact 生产链独立运行：

```text
NjuptCorpusSnapshot -> SearchBundle release
ExamSourceDescriptor -> ExamSnapshot + RoomOccupancy release
```

每条生产链成功后只更新对应的显式 immutable artifact URL 和 SHA-256。
当另外两个产品 artifact 已存在时，工作流才组装完整 Web dist。成功的
`Build Corpus Release` 或 `Build Exam Snapshot` 会触发 EdgeOne 部署；
缺少完整组装产物的 bootstrap 运行只发布自己的领域 artifact，不会部署
半成品。语料更新由 `njupt-site-graph` 的发布工作流通过
`repository_dispatch` 触发，考试更新每六小时运行一次。

## License

[AGPL-3.0](LICENSE)
