# Projects - 现代化项目管理工具

一款基于 Tauri + Vue 3 构建的现代化项目管理桌面应用，提供直观的甘特图、任务看板、资源管理等功能，帮助团队高效管理项目进度。

![License](https://img.shields.io/badge/license-LGPL--2.1-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)
![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

## ✨ 功能特性

- 📊 **甘特图视图** - 直观展示项目时间线、任务依赖关系和进度
- 📋 **任务看板** - 支持拖拽的 Kanban 看板，灵活管理任务状态
- 👥 **资源管理** - 分配和跟踪团队成员的工作负载
- 📈 **数据表格** - 强大的任务列表编辑功能，支持批量操作
- 🌙 **深色模式** - 支持浅色/深色主题切换，保护眼睛
- 🌍 **多语言支持** - 支持中文和英文界面
- 💾 **本地存储** - 项目数据本地保存，保护隐私
- 🔄 **自动保存** - 自动保存项目历史，防止数据丢失

## 🚀 技术栈

- **前端框架**: Vue 3 + Composition API
- **桌面框架**: Tauri 2.0
- **构建工具**: Vite 6
- **状态管理**: Pinia + 持久化插件
- **UI 组件**: PrimeVue + Tailwind CSS 4
- **数据表格**: AG Grid + Handsontable
- **国际化**: Vue I18n
- **开发语言**: JavaScript / Rust

## 📦 安装与运行

### 环境要求

- [Node.js](https://nodejs.org/) (推荐 18+)
- [Bun](https://bun.sh/) 或 npm/yarn
- [Rust](https://www.rust-lang.org/) (用于 Tauri 后端)

### 开发环境

```bash
# 克隆项目
git clone <repository-url>
cd projects

# 安装依赖
bun install

# 启动开发服务器
bun run tauri dev
```

### 构建生产版本

```bash
# 构建桌面应用
bun run tauri build
```

构建完成后，安装包将位于 `src-tauri/target/release/bundle/` 目录下。

## 📁 项目结构

```
projects/
├── src/                    # 前端源代码
│   ├── components/         # Vue 组件
│   │   ├── gantt/         # 甘特图组件
│   │   ├── settings/      # 设置页面组件
│   │   └── ui/            # 通用 UI 组件
│   ├── stores/            # Pinia 状态管理
│   ├── i18n/              # 国际化配置
│   ├── utils/             # 工具函数
│   ├── App.vue            # 根组件
│   └── main.js            # 入口文件
├── src-tauri/             # Tauri 后端代码
│   ├── src/               # Rust 源代码
│   ├── icons/             # 应用图标
│   └── tauri.conf.json    # Tauri 配置
├── public/                # 静态资源
├── dist/                  # 构建输出
└── example_project.json   # 示例项目数据
```

## 🎯 使用指南

### 创建新项目

1. 点击菜单栏的"文件" -> "新建项目"
2. 输入项目名称和描述
3. 开始添加任务和设置时间线

### 管理任务

- 在甘特图中拖动任务条调整时间
- 在看板视图中拖拽任务卡片改变状态
- 使用数据表格批量编辑任务属性

### 资源分配

- 为每个任务分配负责人和资源组
- 在资源视图中查看团队成员的工作负载
- 避免资源冲突和过度分配

## 🛠️ 开发计划

- [ ] 项目导入/导出功能
- [ ] 团队协作和云同步
- [ ] 报表和数据分析
- [ ] 移动端适配
- [ ] 插件系统

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📄 许可证

本项目基于 [LGPL-2.1](LICENSE) 许可证开源。

## 🙏 赞助支持

如果你喜欢这个项目，可以考虑赞助支持开发者，让项目能够持续维护和改进。

## 📧 联系我们

- GitHub: [@secretqsan](https://github.com/secretqsan)

***

© 2024 Projects. All rights reserved.
