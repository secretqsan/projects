# Projects

本地优先的项目管理桌面应用。基于 Tauri 2 与 Vue 3，提供甘特图、看板、资源管理和可编辑任务表格，项目数据以 JSON 文件保存在本机。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)
![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

## ✨ 功能特性

- 📊 **甘特图** — 时间线浏览、任务条拖拽调整、依赖连线、今日高亮、缩放与时间跨度调节
- 📋 **任务表格** — 行内编辑、层级缩进、折叠、拖拽排序、多选与批量操作，含备注列
- 🗂️ **看板** — 按待办 / 进行中 / 逾期 / 已完成分组，支持拖拽改状态与进度操作
- 👥 **资源管理** — 资源组与资源维护，可分配到任务
- 💾 **本地存储** — 打开 / 新建 / 拖放 JSON 项目文件，保存时自动校验与修复
- 🎨 **外观与语言** — 浅色 / 深色模式、主题色、中英界面

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 🖥️ 桌面 | Tauri 2 |
| ⚡ 前端 | Vue 3、Vite 8、Pinia、Vue I18n |
| 🎨 样式 | Tailwind CSS 4、PrimeIcons |
| 🦀 后端 | Rust（文件读写与系统对话框） |

## 📦 环境要求

- [Bun](https://bun.sh/)（或 Node.js 18+）
- [Rust](https://www.rust-lang.org/)（Tauri 构建需要）

## 🚀 开发与构建

```bash
# 安装依赖
bun install

# 开发模式
bun run tauri dev

# 生产构建
bun run tauri build
```

安装包输出目录：`src-tauri/target/release/bundle/`

仅前端预览（无桌面壳）：

```bash
bun run dev
```

## 📁 项目结构

```
projects/
├── src/                      # 前端
│   ├── components/
│   │   ├── gantt/            # 甘特图
│   │   ├── settings/         # 设置 / 关于
│   │   └── ui/               # 通用组件
│   ├── stores/               # Pinia 状态
│   ├── i18n/                 # 中英国际化
│   ├── utils/                # 日期、文件等工具
│   ├── App.vue
│   └── main.js
├── src-tauri/                # Tauri / Rust
├── demo/
│   └── example_project.json  # 示例项目
├── public/
└── dist/
```

## 🎯 使用说明

### 📂 打开或新建项目

1. 左侧导航点击 **打开项目**，或将 `.json` 文件拖入侧边栏
2. 点击 **+** 选择保存路径以新建空项目
3. 双击项目名可重命名；右键菜单可复制或从列表中移除

### ✅ 任务管理

- 📊 **甘特图**：拖动任务条改日期，端点连线建立依赖；工具栏可开始任务、设置进度或完成
- 📋 **表格**：双击单元格编辑；拖动手柄排序；左右箭头调整层级；支持复制 / 粘贴 / 删除
- 🗂️ **看板**：拖拽卡片切换状态；进行中可调进度并单独完成；逾期可延期

### 👥 资源

在「资源」页创建资源组与资源，再在表格或看板中为任务分配资源组。

示例数据见 [`demo/example_project.json`](demo/example_project.json)。

## 🗺️ 开发计划

- [ ] 项目导入 / 导出增强
- [ ] 报表与数据分析
- [ ] 协作与同步

## 🤝 贡献

欢迎 Issue 与 Pull Request。

## 📄 许可证

本项目基于 [MIT](LICENSE) 许可证开源。

Copyright (c) 2026 secretqsan

## 📧 联系

- GitHub: [@secretqsan](https://github.com/secretqsan)
