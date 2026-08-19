<div align="center">

<img src="./apps/web/public/assets/logo.png" alt="njupt-search" width="120" />

# njupt-search

### 把散落在南邮各网站里的通知、附件、考试和教室信息，放进一个好用的入口。

[![在线使用](https://img.shields.io/badge/在线使用-njupt.hicancan.top-4f46e5?style=for-the-badge)](https://njupt.hicancan.top)
[![CI](https://img.shields.io/github/actions/workflow/status/hicancan/njupt-search/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/hicancan/njupt-search/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/hicancan/njupt-search?style=for-the-badge)](https://github.com/hicancan/njupt-search/releases/latest)
[![License](https://img.shields.io/github/license/hicancan/njupt-search?style=for-the-badge)](LICENSE)

[**在线使用**](https://njupt.hicancan.top) ·
[**Android 安装包**](https://github.com/hicancan/njupt-search/releases/latest/download/njupt-search-latest.apk) ·
[**架构文档**](docs/architecture.md) ·
[**参与项目**](#一起完善它)

</div>

---

## 不用先猜信息在哪个网站

南邮的信息很多，但通知、政策、办事流程和附件分散在学校主站、职能部门与各个
学院的网站里。想找一条信息，常常得先猜发布部门，再翻栏目、网页和附件。

不知道通知发在哪个网站，也没关系。输入关键词，njupt-search 会从已经整理好的
学校站点信息中找到相关内容，并保留原始来源和日期。班级考试安排、日历导出和
考试教室查询也在这里，不必在几个入口之间来回切换。

目前线上收录超过 **2.2 万条信息**，覆盖学校主站、学院和职能部门等 **15 个
来源**。项目持续更新，但每条结果仍以学校原始页面和正式发布的数据为准。

## 现在就用

| 想做什么 | 直接打开 |
| --- | --- |
| 搜索通知、政策、办事流程和附件 | [全校信息搜索](https://njupt.hicancan.top/) |
| 按班级查看考试时间、地点和考场 | [考试安排](https://njupt.hicancan.top/#/exam) |
| 按日期、校区、楼栋和楼层查看考试占用 | [考试教室查询](https://njupt.hicancan.top/#/rooms) |

网站支持桌面端和移动端，也可以安装
[Android 版本](https://github.com/hicancan/njupt-search/releases/latest/download/njupt-search-latest.apk)。
搜索、考试和教室页面都有明确链接，可以分享、刷新，也能正常前进和后退。

## 它能做什么

- 搜索南邮各网站的正文与附件，并按来源、类型和时间筛选；
- 输入班级号查看考试安排，选择课程后导出 ICS 日历；
- 输入楼栋或教室号，查看不同日期和楼层的考试占用；
- 在桌面浏览器、手机浏览器和 Android 中使用同一套功能；
- 从搜索结果回到学校原始页面，核对完整通知与附件。

## 数据从哪里来

校园搜索使用显式构建的学校站点语料。通用的网站发现与内容提取由
[`static-site-graph`](https://github.com/hicancan/static-site-graph) 完成，
[`njupt-site-graph`](https://github.com/hicancan/njupt-site-graph) 负责南邮站点配置
并产出统一语料，本仓库再把语料编译成浏览器可用的搜索数据。

考试安排来自当前考试数据快照；考试教室由同一份考试安排和经过校验的教室目录
生成。页面会展示真实来源和更新时间。教室页面只反映**考试占用**，不包含全部
课程、活动或临时借用，因此“没有考试占用记录”不等于教室在现实中一定空闲。

njupt-search 不是南京邮电大学官方服务，也不会把第三方搜索结果包装成学校官方
信息。涉及报名、考试和办事要求时，请回到结果指向的学校原始页面核对。

## 为速度和可靠性做的选择

全文检索在浏览器里的 Rust / WebAssembly 搜索引擎中完成，项目不设置接收搜索
关键词的在线查询接口。Native 与 Web 共用同一套搜索语义，避免两端结果漂移；
浏览器按需获取本次查询需要的数据，只为当前展示的结果补充摘要。

搜索、考试和教室数据均以可校验的静态文件发布，并使用内容寻址和浏览器缓存。
这样既能放在普通 CDN 上，也能在数据更新后明确切换版本。完整的检索流程、数据
格式、缓存边界和部署方式见 [架构文档](docs/architecture.md)。

## 项目组成

```text
南邮各网站
    │
    ├─ static-site-graph   发现网站并提取内容
    ├─ njupt-site-graph    整理南邮站点语料
    └─ njupt-search        构建索引，提供搜索、考试和教室页面
```

本仓库按产品职责组织：

```text
njupt-search/
├── apps/
│   ├── web/          # React Web 应用
│   └── android/      # Android TWA
├── search/
│   ├── core/         # Rust 搜索语义与 SearchBundle
│   ├── native/       # 索引构建、命令行查询和性能入口
│   ├── wasm/         # Rust core 的 WebAssembly 接口
│   └── browser/      # Worker、按需加载与缓存
├── academics/
│   ├── exam/         # 考试数据、班级查询与 ICS 导出
│   └── room/         # 教室目录与考试占用
├── benchmarks/       # 搜索质量、一致性和性能基准
├── ops/              # 构建、验证与 Web 组装脚本
└── docs/             # 架构与数据格式
```

搜索语义只存在于 `search/core`，Native 与 WASM 共用它；Web 负责页面、Worker、
缓存和数据编排。考试与教室数据由 `academics` 生成，不在 React 中硬编码。

## 本地开发

### 环境要求

- Node.js 24
- Rust stable、`wasm32-unknown-unknown` 和 `wasm-pack`
- Python 3.10+ 与 `uv`

安装依赖并运行快速检查：

```powershell
npm ci
uv sync --extra test
.\ops\test.ps1 -Mode quick
```

### 构建搜索数据

源码仓库不保存语料和生成后的索引。使用外部 `NjuptCorpusSnapshot` 构建：

```powershell
.\ops\build-search-bundle.ps1 `
  -CorpusPath D:\Data\njupt-refactor\corpus-current `
  -BundlePath D:\Data\njupt-refactor\njupt-search-current\search-bundle
```

### 构建考试与教室数据

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

### 正式组装 Web 页面

普通 `vite build` 不包含生产数据。正式页面通过组装脚本把三类数据放进同一份
静态站点：

```powershell
.\ops\assemble-web.ps1 `
  -SearchBundlePath D:\Data\njupt-refactor\njupt-search-current\search-bundle `
  -ExamSnapshotPath D:\Data\njupt-refactor\njupt-search-current\exam-snapshot `
  -RoomOccupancyPath D:\Data\njupt-refactor\njupt-search-current\room-occupancy `
  -StagePath D:\Temp\njupt-search\stage `
  -DistPath D:\Temp\njupt-search\dist
```

开发服务器也应使用组装目录中的静态文件：

```powershell
$env:NJUPT_SEARCH_WEB_PUBLIC_DIR = 'D:\Temp\njupt-search\stage\public'
$env:VITE_NJUPT_SEARCH_ARTIFACT_URL = '/generated/search'
$env:VITE_NJUPT_EXAM_ARTIFACT_URL = '/generated/exam'
$env:VITE_NJUPT_ROOM_ARTIFACT_URL = '/generated/rooms'
npm run dev -- --host 127.0.0.1
```

## 质量与验证

项目持续检查 Rust 搜索核心、Web、考试和教室数据之间的一致性。常用入口如下：

```powershell
npm test
npm run typecheck
npm run lint

node benchmarks\search\quality.mjs `
  --bundle D:\Data\njupt-refactor\njupt-search-current\search-bundle
node benchmarks\search\relevance.mjs `
  --bundle D:\Data\njupt-refactor\njupt-search-current\search-bundle
node benchmarks\search\consistency.mjs `
  --bundle D:\Data\njupt-refactor\njupt-search-current\search-bundle
node benchmarks\search\monotonicity.mjs `
  --bundle D:\Data\njupt-refactor\njupt-search-current\search-bundle
```

质量基准覆盖常用搜索入口、筛选前后结果一致性、Native / WASM 一致性和真实数据回归。
测试用于守住长期行为，不在 README 中保存某一次构建或部署的临时成绩。

## 自动更新

校园语料与考试数据分别构建，部署时再组合：

```text
NjuptCorpusSnapshot → SearchBundle
ExamSourceDescriptor → ExamSnapshot → RoomOccupancy
```

构建结果发布到 GHCR。数据更新后，GitHub Actions 会读取三份明确的数据产物，
重新组装网站并部署。Git Tags 和 GitHub Releases 用于软件版本与 Android 安装包，
不用于保存滚动更新的校园语料。

## 一起完善它

如果你发现搜索结果不准确、来源缺失、考试或教室数据异常，欢迎提交 Issue，并附上
查询词、页面链接和你预期看到的内容。代码改动请先运行与改动范围相符的测试；涉及
搜索语义、数据格式或部署边界时，也请同步阅读 [架构文档](docs/architecture.md)。

清楚的问题描述、可复现的例子和小而完整的改动，都很有价值。

## 说明与许可

- 本项目不是南京邮电大学官方服务，请以学校和各部门正式发布的信息为准；
- 校园网站与教务数据的相关权利归原发布方所有；
- 项目用于学习、研究和非商业的校园信息服务；
- 源代码采用 [AGPL-3.0](LICENSE) 许可。
