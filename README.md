<div align="center">

<img src="./apps/web/public/assets/logo.png" alt="njupt-search" width="120" />

# njupt-search

南京邮电大学校园信息搜索

[![在线使用](https://img.shields.io/badge/在线使用-njupt.hicancan.top-4f46e5?style=for-the-badge)](https://njupt.hicancan.top)
[![CI](https://img.shields.io/github/actions/workflow/status/hicancan/njupt-search/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/hicancan/njupt-search/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/hicancan/njupt-search?style=for-the-badge)](https://github.com/hicancan/njupt-search/releases/latest)
[![License](https://img.shields.io/github/license/hicancan/njupt-search?style=for-the-badge)](LICENSE)

[在线使用](https://njupt.hicancan.top) ·
[Android 安装包](https://github.com/hicancan/njupt-search/releases/latest/download/njupt-search-latest.apk) ·
[架构文档](docs/architecture.md)

</div>

---

南邮的通知散落在学校主站以及各个学院、部门网站里，有些关键信息甚至藏在 PDF、Word 或 Excel 附件中。`njupt-search` 将这些内容汇总成了一个支持全文检索的入口，同时附带了班级考试安排和空闲教室查询功能。

## 功能

- **校园搜索**：检索各校区网页与附件，支持按来源、类型和时间过滤。
- **考试安排**：输入班级号即可查看考试时间、地点，支持导出 ICS 日历。
- **考试教室**：按日期、校区、楼栋和楼层，查询考场占用情况。
- **Web 与 Android**：直接在浏览器中使用，也提供 Android 安装包。

直接打开：

- [校园搜索](https://njupt.hicancan.top/)
- [考试安排](https://njupt.hicancan.top/#/exam)
- [考试教室](https://njupt.hicancan.top/#/rooms)

> 注：搜索结果会保留原始网页链接和发布日期。教室页面仅反映教务处的“考试占用”数据，不代表日常上课或临时借用的情况。

## 搜索如何工作

这个项目没有后端的搜索 API。在构建阶段，校园语料会被预编译为自定义的二进制切片（`SearchBundle`）。用户搜索时，浏览器会按需拉取对应的倒排表和正文，**搜索词永远留在本地，不会发给任何服务器**。

分词、召回、打分和摘要生成全部在 [`search/core`](search/core) 里用 Rust 实现。不仅本地的命令行工具调这套代码，网页端也通过 WebAssembly 原封不动地跑这套逻辑，确保了 Native 和 Web 两端搜索规则的绝对一致。至于 HTTP 请求、浏览器缓存和 Worker 调度，则交由 `search/browser` 处理。

为了兼顾速度，搜索结果会瞬间渲染出标题和来源，等对应的正文切片下载完毕后，再补上高亮摘要（补充摘要的过程不会导致列表重新排序，避免画面跳动）。具体的数据格式、缓存策略和部署方式，可以参考 [架构文档](docs/architecture.md)。

## 数据

网页抓取、站点配置和最终的搜索展示，被拆分在了三个仓库中：

```text
static-site-graph  爬虫，负责抓取和解析网页
        ↓ SitePackage
njupt-site-graph   南邮专属配置，清洗并导出统一语料
        ↓ NjuptCorpusSnapshot
njupt-search       构建 SearchBundle 索引，提供 Web / Android 页面
```

前两步爬虫和清洗工作分别由 [`static-site-graph`](https://github.com/hicancan/static-site-graph) 和 [`njupt-site-graph`](https://github.com/hicancan/njupt-site-graph) 负责。

考试编排数据会被单独编译为 `ExamSnapshot`，再由此派生出考试教室数据 `RoomOccupancy`。本仓库源码里不包含任何真实的校园语料或生成好的数据文件，部署时脚本会把这三类产物组装成一个纯静态站点。

## 目录

```text
njupt-search/
├── apps/
│   ├── web/          React 前端
│   └── android/      Android TWA 套壳
├── search/
│   ├── core/         Rust 搜索引擎核心与 SearchBundle 定义
│   ├── native/       命令行构建器、查询和 Benchmark
│   ├── wasm/         WebAssembly FFI 接口
│   └── browser/      浏览器端的 Worker、网络切片拉取与缓存
├── academics/
│   ├── exam/         考试数据清洗、班级查询与 ICS 导出
│   └── room/         教室目录和考试占用
├── benchmarks/       搜索质量与性能基准测试
├── ops/              各种构建、验证和 Web 组装脚本
└── docs/             架构与数据格式设计文档
```

## 本地开发

环境依赖：Node.js 24、Rust stable (`wasm32-unknown-unknown` target、`wasm-pack`) 以及 Python 3.12 (`uv`)。

```powershell
npm ci
uv venv
uv sync --extra test
.\ops\test.ps1 -Mode quick
```

### 构建数据

你需要先在本地指定外部语料和构建产物的存放路径：

```powershell
$corpusPath = 'D:\path\to\njupt-corpus'
$dataPath = 'D:\path\to\njupt-search-data'
$bundlePath = "$dataPath\search-bundle"
$examPath = "$dataPath\exam-snapshot"
$roomPath = "$dataPath\room-occupancy"
```

构建倒排索引：

```powershell
.\ops\build-search-bundle.ps1 `
  -CorpusPath $corpusPath `
  -BundlePath $bundlePath
```

构建考试和教室数据快照：

```powershell
uv run python -m academics.exam discover `
  --output "$dataPath\exam-source.json"

.\ops\build-academics.ps1 `
  -SourcePath "$dataPath\exam-source.json" `
  -MaterializedPath "$dataPath\exam-materialized" `
  -CachePath "$dataPath\exam-cache" `
  -ExamOutputPath $examPath `
  -RoomOutputPath $roomPath `
  -RoomCatalogPath .\academics\room\catalog\njupt-room-catalog.json
```

常规的 `vite build` 是不包含上面这些产物的。如果需要预览完整的 Web 页面，必须使用组装脚本：

```powershell
.\ops\assemble-web.ps1 `
  -SearchBundlePath $bundlePath `
  -ExamSnapshotPath $examPath `
  -RoomOccupancyPath $roomPath `
  -StagePath "$dataPath\web-stage" `
  -DistPath "$dataPath\web-dist"
```

### 测试

```powershell
npm test
npm run typecheck
npm run lint
```

如果你想跑搜索质量测试，需要提供一份已构建好的 `SearchBundle`：

```powershell
node benchmarks\search\quality.mjs --bundle $bundlePath
node benchmarks\search\relevance.mjs --bundle $bundlePath
node benchmarks\search\monotonicity.mjs --bundle $bundlePath
node benchmarks\search\consistency.mjs --bundle $bundlePath
```

## 参与开发

如果你搜不到某条通知、发现排序很怪，或者考试数据报错，欢迎提 Issue。提问时最好能带上搜索关键词、页面链接和你预期看到的结果，这样方便大家复现排查。如果你准备提交代码修改搜索规则或数据格式，请先花点时间过一遍 [架构文档](docs/architecture.md)，并在提交前跑通所有测试。

## 许可协议

本项目源码采用 [AGPL-3.0](LICENSE) 许可。`njupt-search` 并非南京邮电大学官方服务，所有涉及报名、考试等关键信息的办事要求，请一律以结果链接指向的学校原文为准。
