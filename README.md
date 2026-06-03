<div align="center">

# njupt-search

南京邮电大学无服务端聚合检索与信息服务系统

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-WASM-DEA584.svg)](https://www.rust-lang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-FFD43B.svg)](https://www.python.org/)
[![PWA](https://img.shields.io/badge/PWA-Supported-orange.svg)](https://vite-pwa-org.netlify.app/)

[**在线访问**](https://njupt.hicancan.top) • [**设计初衷**](#-项目定位与初衷-the-vision) • [**核心特性**](#-核心特性矩阵-core-features) • [**底层技术剖析**](#️-底层硬核技术剖析-deep-dive) • [**代码库全景**](#️-monorepo-代码架构-project-structure) • [**本地开发**](#-本地开发与部署-quick-start)

</div>

---

## 📖 项目定位与初衷 (The Vision)

**痛点：严重的信息孤岛与获取门槛**  
南京邮电大学的各类教务通知、考试排期、竞赛奖助等信息，长期分散在不同的二级学院和管理部门站点中。更加棘手的是，大量关键信息以非结构化文档附件（PDF、DOCX、XLSX）的形式存在。师生在需要跨域检索特定政策或查询自己的考试安排时，面临着极高的“信息差”壁垒。

**破局方案：njupt-search**  
本项目旨在彻底打破这种信息屏障，构建一个**完全去服务端化、静态边缘分发的垂直聚合搜索引擎与教务日历服务**。我们通过离线数据管线（Data Pipeline）提前提取全校非结构化数据，并在用户侧浏览器内（依赖 Web Worker + WebAssembly）闭环完成极速检索。没有中心化数据库，没有高昂的服务器成本，以纯端侧计算重构检索引擎体验。

---

## ✨ 核心特性矩阵 (Core Features)

| ⚡️ 无服务端架构 (Serverless Edge) | 🦀 Next-Gen 检索引擎 (WASM) | 📅 幂等自动化教务管线 (ETL) | 📱 极致离线体验 (PWA) |
| :--- | :--- | :--- | :--- |
| 摒弃传统关系型数据库与 Elasticsearch。全量索引静态分发，依托 CDN 边缘节点实现无限并发与毫秒级 TTFB 响应，永不宕机。 | 基于 Rust 编译的 WebAssembly 算分模块，配合 Block-Max WAND 动态剪枝算法，在浏览器内实现海量倒排表的 Sub-ms 级竞争性打分。 | 基于 Python `pydantic` 与高阶正则的自动化爬虫与数据清洗工厂。智能容错教务处表格的“脏数据”，自动结构化生成 ICS 考试日历。 | 核心检索能力深度集成 Service Worker 缓存策略，离线状态下依然可进行全文检索与日历查阅。并支持 Android 端 TWA 原生打包。 |

---

## 🛠️ 核心架构剖析 (Architecture)

本项目绝非简单的聚合页面，其背后蕴含着高度定制化的数据结构与编译级优化策略。

### 1. `SGIXB002` 极致压缩二进制倒排协议
传统的 JSON 倒排索引在网络传输时极其臃肿。本项目在离线阶段 (`tools/collection-indexer`) 彻底舍弃了文本结构，独创了 `SGIXB002` 紧凑二进制格式：
*   **Delta-Encoding (差值编码)**：将倒排表中的绝对文档 ID ($D_i$) 替换为相邻文档的差值 ($D_i - D_{i-1}$)，从而将大整数降维成极小的正整数。
*   **VarInt (7-bit 变长整数压缩)**：针对降维后的差值，采用可变长度编码（最高位作为延续标志位）。对于小型差值，仅需 1 个字节即可存储。
*   **成果**：网络体积较原始 JSON 数据缩减达 **82%** 以上，显著降低了首屏拉取（Hydration）的字节预算。

### 2. Rust WASM 的 O(1) 块级剪枝算法 (Block-Max WAND)
在数以万计的文档倒排表合并时，普通的前端 JS 循环会导致主线程严重掉帧。我们在 `tools/wasm/packed-impact-decoder` 中，使用 Rust 实现了一种激进的提前跳跃算法：
```rust
// 计算当前词项块及后续未评估词项块的最大可能算分上限
let max_possible_for_unseen_doc = block.impact + suffix.get(index + 1).unwrap_or(0.0);

// 如果理论最高分依然低于已评估的 Top-K 候选门槛 (competitive_threshold)
// 引擎将直接整块剪枝 (O(1) Early-Exit)，跳过该块的 VarInt 解压与循环打分！
if !has_known_candidate && scores.len() >= target && max_possible_for_unseen_doc <= threshold {
    impact_blocks_pruned += 1;
    continue; 
}
```

### 3. Web Worker 编排与多阶段证明检索
为保证 React UI 绝对流畅，所有的网络拉取、分片解包、正则比对全部隔离在独立的 Web Worker 中 (`collectionSearch.worker.ts`)：
*   **热路径前置 (Hot Query Bypass)**：针对高频短词，直接派发预计算的验证证书，免扫倒排直接返回。
*   **渐进式注水 (Progressive Hydration)**：优先拉取 `Light Index` 填充第一屏结果，用户向下滚动时按需拉取巨型 `Full Shards`。
*   **布隆过滤器哈希排误 (Bloom Filter Verification)**：加载分片前，计算哈希比对源文件的 Bloom Filter 签名，未命中的 Shard 直接被阻断拉取请求，避免无用带宽消耗。

### 4. 数据管道：确定性日历生成与 Zod 契约层
在 `tools/exam-pipeline` 中，Python 的 `pandas` 与双重正则处理了中国高校极为复杂的混合时间字符串（如 `2025年11月15日(10:25-12:15)`），并输出干净的 JSON 记录：
*   **防重复幽灵事件 (Deterministic UID)**：前端 `packages/exam-core` 在生成 `.ics` 订阅链接时，抛弃了随机 UUID，采用 `班级+课程+时间+地点` 联合计算确定性哈希。当教务处临时调整考场时，学生日历会自动覆盖更新，而不会出现两场考试的“幽灵叠加”。
*   **跨语言安全沙箱**：TypeScript 侧采用 `Zod` 定义严格 Schema (`packages/contracts`)。将 Python 爬虫产出的静态文件视为“不可信输入”，强制反序列化校验，形成真正的接口契约安全防护。

---

## 🏗️ Monorepo 代码架构 (Project Structure)

项目采用 NPM Workspaces 与 Python `uv` 混合构建，实现了严密的职责隔离。

```text
njupt-search/
├── apps/
│   └── web/                # React 19 + Tailwind v4 + Vite PWA 核心单页应用
├── packages/
│   ├── contracts/          # Zod 强类型契约层 (被前后端共同引用)
│   ├── exam-core/          # 考试解析、正则匹配与 ICS 标准日历生成引擎
│   └── search-core/        # 搜索引擎调度核心：Web Worker 状态机、算分器、分词器
├── tools/
│   ├── wasm/
│   │   └── packed-impact-decoder/ # Rust 编写的底层 Block-Max WAND WASM 算分器
│   ├── collection-indexer/ # Python 离线倒排构建核心 (生成 SGIXB002 二进制包)
│   ├── exam-pipeline/      # Python 自动化教务爬虫与 Pydantic 数据清洗
│   ├── quality-gates/      # 监控产物体积防劣化门禁脚本
│   └── search-eval/        # 搜索召回率与算分一致性基准测试
└── android/                # 基于 Bubblewrap 的 TWA 壳工程 (数字资产链接验证)
```

---

## 🚀 本地开发与部署 (Quick Start)

### 初始环境准备

1. **安装 Node.js 依赖**：
   ```bash
   npm ci
   ```
2. **构建 Python 虚拟环境并同步工具链依赖**（项目默认使用 `uv`，无需手动激活环境）：
   ```bash
   uv sync
   ```

### 本地启动

```bash
# 启动 Vite 本地热重载服务器 (端口 5173)
npm run dev
```

### 数据离线编译与测试

有关详细的源数据索引构建、教务日历爬虫更新以及回归测试跑交流程，您可以直接查阅对应模块的 Python 脚本。所有构建管线均内置了完备的 `--help` 参数供调试：

```powershell
# 例如，更新并抓取最新的考试安排：
uv run python tools/exam-pipeline/src/njupt_exam_pipeline/analyze_and_update.py

# 执行静态包体积监控与回归验证：
uv run python tools/quality-gates/scripts/check_public_artifact_sizes.py
```

---

## 📄 许可证 (License)

本项目开源协议基于 [AGPL-3.0 License](LICENSE)。南京邮电大学相关图标与基础数据源归属原著作权方，本项目仅作技术交流与非盈利性校园聚合服务。
