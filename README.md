# 📅 NJUPT Exam Sync (南邮考试日程助手)

<div align="center">

<img src="public/assets/icon-192.png" width="100" height="100" alt="Logo" />

### ✨ 为南邮学子打造的极简考试日程同步工具

[**在线使用**](https://njupt.hicancan.top) · [报告Bug](https://github.com/hicancan/njupt-exam-sync/issues) · [请求功能](https://github.com/hicancan/njupt-exam-sync/issues)

![GitHub stars](https://img.shields.io/github/stars/hicancan/njupt-exam-sync?style=flat-square)
![GitHub forks](https://img.shields.io/github/forks/hicancan/njupt-exam-sync?style=flat-square)
![GitHub license](https://img.shields.io/github/license/hicancan/njupt-exam-sync?style=flat-square)
![Python Version](https://img.shields.io/badge/python-3.8+-blue.svg?style=flat-square)
![React Version](https://img.shields.io/badge/react-19.x-61dafb.svg?style=flat-square)
![TailwindCSS Version](https://img.shields.io/badge/tailwindcss-v4.0+-38bdf8.svg?style=flat-square)

</div>

---

## 📖 项目简介 (Introduction)

**NJUPT Exam Sync** 是一个轻量级、无需登录的纯前端工具，旨在解决教务处 Excel 考表查询繁琐、难以保存的问题。

只需输入班级号，即可快速筛选出你的期末考试安排。不仅支持**模糊搜索**，还支持**自主勾选**需要参加的考试（完美解决重修/免修的个性化需求），并一键导出 `.ics` 日历文件。

导出的日历完美适配 iOS/Android/鸿蒙/Outlook/Google Calendar 等主流系统日历，彻底告别“看错行”和“记错时间”。

## ✨ 核心亮点 (Features)

- ⚡ **极速体验**：基于 React 19 + Vite 构建，秒开无白屏。
- 🌗 **深色模式**：自动跟随系统切换深色模式，深夜查分不刺眼。
- 🔍 **智能搜索**：输入班级号（支持模糊匹配）自动联想，毫秒级响应。
- 📅 **按需导出**：支持**手动勾选/反选**考试科目，一键生成标准 iCalendar (.ics) 文件，包含**时区修正**。
- 🔗 **社交分享**：支持生成带有班级参数的链接，复制发给同学，点开即看。
- 📱 **PWA 支持**：支持“添加到主屏幕”，像原生 App 一样全屏运行，体验更佳。
- 🔔 **定制提醒**：内置考前 1小时、30分钟等多重提醒选项，绝不缺考。
- 🛡️ **隐私安全**：纯静态站点，无后台数据库，所有查询逻辑在浏览器本地完成。
- ⏱️ **实时监控**：首页集成安全运行时间与访客统计，数据更新状态一目了然。

## 📸 预览 (Screenshots)

<div align="center">

| **桌面端搜索页** | **移动端详情页** |
|:---:|:---:|
| <img src="public/assets/desktop_demo.png" alt="Desktop Demo" width="400"/> | <img src="public/assets/mobile_demo.png" alt="Mobile Demo" width="200"/> |
| *输入班级号即可自动匹配* | *支持反选科目与一键导出* |

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

2. **启动本地服务**

    - **Windows**: 直接双击运行根目录下的 `scripts/run_locally.bat`。
    - **Mac/Linux**:

        ```bash
        npm install
        npm run dev
        # 然后浏览器访问 http://localhost:5173
        ```

## 🛠️ 项目结构与数据流 (Architecture)

本项目采用 **"Excel in, JSON out"** 的 Severless 数据处理流。后端 Python 脚本负责清洗教务处的复杂 Excel 数据，前端 React 负责展示和交互。

```text
NJUPT-Exam-Sync/
├── public/                # 🌐 公共静态资源
│   ├── data/              # 🗄️ 数据产物 (自动生成)
│   ├── CNAME              # 🌐 自定义域名
│   ├── manifest.json      # 📝 数据版本记录
│   └── ...
├── src/                   # ⚛️ React 源码
│   ├── components/        # 🧩 UI 组件
│   │   ├── ThemeToggle.jsx       # 🌗 深色模式切换
│   │   ├── ExamCard.jsx          # 考试卡片
│   │   ├── ReminderSettings.jsx  # 提醒设置
│   │   └── UptimeDisplay.jsx     # 运行监控
│   ├── utils/             # 🛠️ 工具函数
│   │   └── icsGenerator.js       # ICS 生成算法
│   ├── App.jsx            # 📱 主应用逻辑
│   ├── index.css          # 🎨 全局样式 (含 Tailwind v4配置)
│   └── ...
├── scripts/               # ⚙️ 工具脚本
│   ├── analyze_and_update.py  # Python ETL (基于 Pydantic 清洗数据)
│   └── run_locally.bat        # Windows 一键启动
├── .github/workflows/     # 🤖 CI/CD
│   └── deploy.yml         # 自动部署到 GitHub Pages
├── package.json           # 📦 依赖管理
├── vite.config.js         # ⚡ Vite 配置
├── tailwind.config.js     # 🎨 Tailwind 配置 (被 index.css 引用)
└── README.md              # 📄 项目说明文档
```

## 🔄 如何更新考试数据？

当教务处发布新的 Excel 考表时，管理员只需执行以下步骤：

1. 将新的 `.xlsx` 文件放入 `data/` 目录（建议删除旧文件以防混淆，或按学期归档）。

2. 安装依赖（仅首次需要）：

   ```bash
   pip install pandas openpyxl pydantic
   ```

3. 运行数据处理脚本：

   ```bash
   python scripts/analyze_and_update.py
   ```

4. 脚本会自动：
   - ✅ 识别并清洗不同格式的 Excel 列（兼容多种教务系统导出格式）。
   - ✅ 解析复杂的时间格式（如 "第11周周二 1-2节" 或 ISO 日期）。
   - ✅ 校验数据完整性，并生成 `DATA_INVENTORY.md` 数据质量报告。
   - ✅ 合并生成 `public/data/all_exams.json`。

5. 提交更改到 GitHub，GitHub Pages 会自动构建并部署更新。

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
