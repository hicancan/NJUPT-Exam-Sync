# njupt-search

南京邮电大学校园语料全文检索、考试、教室与日历产品。仓库从显式的
`NjuptCorpusSnapshot` 和考试源开始，不负责爬取。

## Architecture

一级目录包含三个生产本体和三个外围支撑：

```text
apps/         Web 与 Android 产品交付
search/       CorpusSnapshot -> SearchBundle -> Query -> SearchResult
academics/    ExamSource -> ExamSnapshot -> RoomOccupancy / ExamSchedule
benchmarks/   从外部测量真实生产入口
ops/          显式路径与命令顺序
docs/         对真实代码的说明
```

二级边界由语义和对象所有权形成：

```text
apps/
  web/src/{app,home,search,exams,rooms,shared}
  android/
search/
  core/       唯一规范化、分词、索引、召回、排名和摘要语义
  native/     build-index、query、benchmark CLI
  wasm/       core 的浏览器导出
  browser/    artifact、预算缓存、Worker、SearchClient
academics/
  exam/{source,records,snapshot,history,query}
  room/{catalog,occupancy,query}
  calendar/   ICS
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
  -CorpusPath D:\Data\njupt-refactor\corpus-final-v2 `
  -BundlePath D:\Data\njupt-refactor\njupt-search-final-v2\search-bundle
```

从显式考试输入构建相互独立的 ExamSnapshot 与 RoomOccupancy：

```powershell
.\ops\build-academics.ps1 `
  -SourcePath .\academics\exam\source\current.json `
  -MaterializedPath D:\Data\njupt-refactor\njupt-search-final-v2\exam-materialized `
  -CachePath D:\Cache\njupt-search\exam-source `
  -ExamOutputPath D:\Data\njupt-refactor\njupt-search-final-v2\exam-snapshot `
  -RoomOutputPath D:\Data\njupt-refactor\njupt-search-final-v2\room-occupancy `
  -RoomCatalogPath .\academics\room\catalog\njupt-room-catalog.json
```

只有组装阶段把三个 artifact 放入一次性 Web staging：

```powershell
.\ops\assemble-web.ps1 `
  -SearchBundlePath D:\Data\njupt-refactor\njupt-search-final-v2\search-bundle `
  -ExamSnapshotPath D:\Data\njupt-refactor\njupt-search-final-v2\exam-snapshot `
  -RoomOccupancyPath D:\Data\njupt-refactor\njupt-search-final-v2\room-occupancy `
  -StagePath D:\Temp\codex\njupt-three-repo-final\web-stage `
  -DistPath D:\Temp\codex\njupt-three-repo-final\dist
```

完整 156 条查询质量验证：

```powershell
node benchmarks\search\quality.mjs `
  --bundle D:\Data\njupt-refactor\njupt-search-final-v2\search-bundle
```

当前 reader 只接受 `njupt-search-bundle-v2`。历史 v1 bundle 只可由迁移前的
基线结果报告用于离线比较，不能作为当前生产输入。

三仓真实爬取闭环由 `ops/local.ps1` 接受三个仓库、外部 SitePackage 根目录
和全部 artifact 路径显式编排。
源码树不保存语料、索引、考试输出、缓存、staging 或 dist。

## License

[AGPL-3.0](LICENSE)
