# Financial Blogger Agent

> **信息整理，不构成投资建议。**

一个以"可追溯、先审核、合规接入"为核心的 **Tauri 2** 桌面应用，用于构建财经内容生产与发布工作流。

A **Tauri 2** desktop application for compliant financial content production and publishing workflows — with full traceability, mandatory review, and authorized data access.

---

## 功能特性

| 模块 | 说明 |
|------|------|
| **仪表盘** | 总览待核验选题、可生成草稿、待发布条目等关键指标 |
| **选题池** | 管理新闻选题，支持批量核验、一键进入工作流 |
| **新闻源** | 通过 RSS 聚合获授权的财经新闻源，支持自定义增删 |
| **流水线** | 可视化编辑内容处理管线（新闻源 → LLM 加工），支持多流水线管理 |
| **内容工坊** | 草稿编辑、币种标记、视频源配置、目标平台选择 |
| **发布队列** | 人工审核 → 手动/定时发布，保留完整审计日志 |
| **自动发布** | 全流程自动化：抓取 → 加工 → 入队 → 轮询发送，支持来源优先级和全局暂停 |
| **设置** | Binance Square API 密钥管理、代理配置、X/Twitter 凭证 |

### 核心设计原则

- **可追溯** — 每条内容附带来源、原始时间、采集时间、许可状态和置信等级
- **先审核** — 发布默认进入审核队列，仅低风险内容可自动发布
- **合规接入** — 仅通过获授权的 API 或书面许可的数据源接入，不绕过任何平台风控
- **本地优先** — 凭据由 Rust 侧安全存储，UI 不保存敏感信息

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript (strict) |
| 构建 | Vite 6 |
| 桌面框架 | Tauri 2 |
| 后端核心 | Rust (edition 2021) |
| 可视化流水线 | @xyflow/react |
| HTTP | reqwest (rustls-tls) |
| RSS 解析 | feed-rs |

## 架构概览

```text
React UI (src/)  ── Tauri invoke ──>  Rust 桌面核心 (src-tauri/)
                                          │                │
                                     本地加密存储      Worker 协议
                                                       (第二阶段)
                                                            │
                                                    Python Workers
                                                            │
                                              获授权 API / 行情数据源
```

- **UI 层**：展示信息、编辑草稿、请求用户授权；不保存敏感凭据
- **Rust 核心**：管理凭据、定时任务、审计日志、发布审批与 Worker 生命周期
- **Python Worker（规划中）**：清洗、去重、事件聚类、制图和模型调用

详细架构请阅读 [`docs/architecture.md`](docs/architecture.md)。

## 环境要求

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | 18+ | 前端构建 |
| npm | 9+ | 包管理 |
| Rust | 1.75+ | Tauri 后端编译 |
| WebView2 | — | Windows 运行时依赖（通常已预装） |

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/<your-org>/financial-blogger-agent.git
cd financial-blogger-agent
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发模式

```bash
npm run tauri:dev
```

这将同时启动 Vite 前端开发服务器和 Tauri Rust 后端。

### 4. 仅验证前端

```bash
npm run check
```

### 5. 构建 Windows 安装包

```bash
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/`。

## 项目结构

```text
src/
  app/              # 应用壳、路由、全局组合
  features/         # 按业务域拆分的 UI、状态和用例适配层
    workbench/
      components/   # 面板组件（仪表盘、选题、流水线、编辑器等）
      hooks/        # 业务逻辑 hooks
      types.ts      # 前端类型定义
      constants.ts  # 常量
      utils.ts      # 纯工具函数
  lib/              # Tauri 调用封装、共享类型
  styles/           # 全局样式

src-tauri/
  src/              # Rust 命令、服务和本地持久化
  capabilities/     # Tauri 最小权限声明
  resources/        # 打包资源（平台脚本等）

docs/               # 架构与决策记录
```

## 开发规范

本项目遵循严格的编码规范，详见 [`AGENTS.md`](AGENTS.md)：

- TypeScript 开启 strict，禁止使用 `any`
- Rust 命令按领域模块组织，所有外部输入先校验
- 一个提交只解决一个意图
- API 密钥、OAuth token、Cookie 等不得进入源码或 Git
- 新功能至少覆盖正常路径、授权拒绝、网络失败三类场景

## 参与贡献

欢迎贡献！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发流程、提交规范和行为准则。

## 许可证

本项目基于 [GNU General Public License v3.0](LICENSE) 开源。

## 免责声明

本工具提供的所有内容仅供信息参考，**不构成任何投资建议**。使用本工具发布的内容由发布者自行负责。

---

<p align="center">
  <sub>如果这个项目对你有帮助，欢迎 Star ⭐ 支持！</sub>
</p>
