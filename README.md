# 📅 NJUPT Exam Sync (南邮考试日程助手)

<div align="center">

<img src="public/assets/icon-192.png" width="100" height="100" alt="Logo" />

### ✨ 为南邮学子打造的极简考试日程同步工具

[**在线使用**](https://njupt.hicancan.top) · [报告Bug](https://github.com/hicancan/njupt-exam-sync/issues) · [请求功能](https://github.com/hicancan/njupt-exam-sync/issues)

![GitHub stars](https://img.shields.io/github/stars/hicancan/njupt-exam-sync?style=flat-square)
![GitHub forks](https://img.shields.io/github/forks/hicancan/njupt-exam-sync?style=flat-square)
![GitHub license](https://img.shields.io/github/license/hicancan/njupt-exam-sync?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?style=flat-square)
![React Version](https://img.shields.io/badge/react-19.x-61dafb.svg?style=flat-square)
![TailwindCSS Version](https://img.shields.io/badge/tailwindcss-v4.0+-38bdf8.svg?style=flat-square)

</div>

---

## 📖 项目简介 (Introduction)

**NJUPT Exam Sync** 是一个轻量级、无需登录的纯前端工具，旨在解决教务处 Excel 考表查询繁琐、难以保存的问题。

只需输入班级号，即可快速筛选出你的期末考试安排。不仅支持**模糊搜索**，还支持**自主勾选**需要参加的考试（完美解决重修/免修的个性化需求），并一键导出 `.ics` 日历文件。

导出的日历完美适配 iOS/Android/鸿蒙/Outlook/Google Calendar 等主流系统日历，彻底告别“看错行”和“记错时间”。

## ✨ 核心亮点 (Features)

- ⚡ **极速体验**：基于 React 19 + TypeScript + Vite 构建，秒开无白屏。
- 🛡️ **类型安全**：全项目采用 TypeScript 开发，代码健壮，维护性强。
- 🎨 **现代化 UI**：使用 Tailwind CSS v4 打造的响应式设计，完美适配移动端。
- 🌗 **深色模式**：自动跟随系统切换深色模式，深夜查分不刺眼。
- 🔍 **智能搜索**：输入班级号（支持模糊匹配）自动联想，毫秒级响应。
- 📅 **按需导出**：支持**手动勾选/反选**考试科目，一键生成标准 iCalendar (.ics) 文件，包含**时区修正**。
- 🔗 **社交分享**：支持生成带有班级参数的链接（如 `?class=B240402`），复制发给同学，点开即看。
- 📱 **PWA 支持**：支持“添加到主屏幕”，可离线访问，像原生 App 一样全屏运行。
- 🔔 **定制提醒**：内置考前 1小时、30分钟等多重提醒选项，绝不缺考。
- 🛡️ **隐私安全**：纯静态站点，无后台数据库，所有查询逻辑在浏览器本地完成。

## 📸 预览 (Screenshots)

<div align="center">

| **桌面端搜索页** | **移动端详情页** |
|:---:|:---:|
| <img src="public/assets/desktop_demo.png" alt="Desktop Demo" width="400"/> | <img src="public/assets/mobile_demo.png" alt="Mobile Demo" width="200"/> |
| *适配 Tailwind v4 的简约设计* | *支持 PWA 离线访问与日历导出* |

</div>

## 🚀 快速开始 (Getting Started)

### 🌐 在线使用

直接访问部署好的地址（推荐）：**[https://njupt.hicancan.top](https://njupt.hicancan.top)**

### 💻 本地开发运行 (对于开发者)

> **注意**：本项目使用最新的 **React 19** 和 **Tailwind CSS v4**。请确保你的 Node.js 版本 >= 20。

1. **克隆仓库**

    ```bash
    git clone https://github.com/hicancan/njupt-exam-sync.git
    cd njupt-exam-sync
    ```

2. **安装依赖**

    ```bash
    npm install
    ```

3. **启动开发服务器**

    ```bash
    npm run dev
    # 然后浏览器访问 http://localhost:5173
    ```

4. **构建生产版本**

    ```bash
    npm run build
    # 构建产物位于 dist/ 目录
    ```

## 🛠️ 项目结构与数据流 (Architecture)

本项目采用 **"Excel in, JSON out"** 的 Serverless 数据处理流。后端 Python 脚本负责清洗教务处的复杂 Excel 数据，前端 React + TS 负责展示和交互。

```text
NJUPT-Exam-Sync/
├── public/                # 🌐 公共静态资源
│   ├── data/              # 🗄️ 数据产物 (自动生成)
│   └── assets/            # 🖼️ 图标与示例图片
├── src/                   # ⚛️ 源代码 (TypeScript)
│   ├── components/        # 🧩 UI 组件
│   │   ├── ExamCard.tsx          # 考试卡片
│   │   ├── ReminderSettings.tsx  # 提醒设置
│   │   ├── ThemeToggle.tsx       # 深色模式切换
│   │   └── UptimeDisplay.tsx     # 运行监控
│   ├── types/             # 🏷️ TypeScript 类型定义
│   │   └── index.ts              # 核心接口 (Exam, Manifest等)
│   ├── utils/             # 🛠️ 工具函数 (TS)
│   │   └── icsGenerator.ts       # ICS 生成算法
│   ├── App.tsx            # 📱 主应用逻辑
│   ├── main.tsx           # ⚡ 入口文件
│   └── index.css          # 🎨 全局样式 (原生 CSS + Tailwind v4)
├── scripts/               # ⚙️ 工具脚本
│   ├── analyze_and_update.py  # Python ETL (数据清洗)
│   └── run_locally.bat        # Windows 一键启动
├── dist/                  # 📦 构建产物
├── tsconfig.json          # 📐 TypeScript 配置 (Root)
├── tsconfig.app.json      # 📐 TypeScript 配置 (App)
├── vite.config.ts         # ⚡ Vite 配置
├── package.json           # 📦 依赖管理
└── README.md              # 📄 项目说明文档
```

## 🔄 如何更新考试数据？

当教务处发布新的 Excel 考表时，管理员只需执行以下步骤：

1. 将新的 `.xlsx` 文件放入 `public/data/` 目录（建议删除旧文件以防混淆，或按学期归档）。

2. 安装 Python 依赖（仅首次需要）：

   ```bash
   pip install pandas openpyxl pydantic
   ```

3. 运行数据处理脚本：

   ```bash
   python scripts/analyze_and_update.py
   ```

4. 脚本会自动：
   - ✅ 识别并清洗不同格式的 Excel 列。
   - ✅ 解析复杂的时间格式和地点。
   - ✅ 校验数据完整性，并生成 `DATA_INVENTORY.md` 报告。
   - ✅ 合并生成 `public/data/all_exams.json`。

5. 提交更改到 GitHub，GitHub Pages (Action) 会自动构建并部署更新。

## 🤝 贡献 (Contributing)

欢迎提交 Issue 或 Pull Request！

如果你发现了新的考表格式导致解析失败，请提交 Issue 并附上脱敏后的 Excel 样本的一两行数据。

## ⚠️ 免责声明 (Disclaimer)

- 本工具数据来源于教务处发布的 Excel 汇总表，经程序自动处理生成。
- 虽然我们使用了 Pydantic 进行严格的数据校验，但**无法保证 100% 无误**。
- **最终考试时间、地点请务必以学校教务系统及准考证为准！**
- 开发者不对因依赖本工具而导致的任何考试延误或缺考承担责任。

## 📄 开源协议 (License)

本项目遵循 [MIT License](LICENSE) 开源协议。

------

<div align="center">

Made with ❤️ by <a href="https://hicancan.top">hicancan</a>

</div>
