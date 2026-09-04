# 贡献指南 / Contributing Guide

> **信息整理，不构成投资建议。**

感谢你对 Financial Blogger Agent 的关注！本文档将帮助你了解如何参与本项目的开发。

Thank you for your interest in contributing to Financial Blogger Agent! This document will help you get started.

---

## 行为准则 / Code of Conduct

本项目遵循 [Contributor Covenant](https://www.contributor-covenant.org/) 行为准则。参与本项目即表示你同意遵守该准则。如有违规行为，请向项目维护者报告。

## 如何贡献 / How to Contribute

### 报告 Bug / Reporting Bugs

1. 在 GitHub Issues 中搜索是否已有相同报告
2. 如果没有，创建新 Issue 并包含以下信息：
   - 清晰的问题描述
   - 复现步骤（操作系统、Node/Rust 版本）
   - 预期行为与实际行为
   - 相关日志或截图（**请勿包含 API 密钥、Cookie 等敏感信息**）

### 提出新功能 / Suggesting Features

1. 创建 Issue 并打上 `enhancement` 标签
2. 描述功能的使用场景和预期行为
3. 说明与现有功能的关系和可能的影响

### 提交代码 / Submitting Code

#### 开发环境搭建

```bash
# 1. Fork 并克隆仓库
git clone https://github.com/<your-username>/financial-blogger-agent.git
cd financial-blogger-agent

# 2. 安装依赖
npm install

# 3. 启动开发模式
npm run tauri:dev
```

#### 开发流程

1. 从 `main` 分支创建功能分支：
   ```bash
   git checkout -b feat/your-feature-name
   # 或修复 bug：
   git checkout -b fix/issue-description
   ```

2. 进行开发，确保：
   - TypeScript 开启 strict，不使用 `any`
   - Rust 代码通过 `cargo check --manifest-path src-tauri/Cargo.toml`
   - 前端通过 `npm run check`

3. 一个提交只解决一个问题，提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)：
   ```
   feat: 添加 RSS 新闻源自动去重功能
   fix: 修复发布队列定时任务未正确取消的问题
   docs: 更新架构文档中的 Worker 协议说明
   refactor: 重构流水线节点配置逻辑
   ```

4. 推送分支并创建 Pull Request：
   ```bash
   git push origin feat/your-feature-name
   ```

#### Pull Request 规范

- **标题**：简明描述变更内容
- **描述**：说明变更的目的、方法和影响
- **关联 Issue**：如适用，引用相关 Issue（`Closes #123`）
- **测试**：说明你进行了哪些测试验证
- **截图**：如涉及 UI 变更，请附截图

### 代码审查 / Code Review

所有提交必须经过代码审查。审查者将关注：

- 是否符合项目架构和编码规范（见 [`AGENTS.md`](AGENTS.md)）
- 是否包含适当的错误处理
- 是否泄漏敏感信息
- 是否有对应的测试覆盖

## 安全边界 / Security Boundaries

**以下行为严格禁止：**

- 实现绕过登录、验证码、反爬或平台风控的逻辑
- 将 API 密钥、OAuth token、Cookie 写入源码、日志、测试或 Git
- 提交包含真实用户内容或受版权保护原文的代码
- 实现未经人工审核的自动发布功能

**发布默认进入审核队列。** 只有策略显式允许、来源可追溯且风险检查通过的低风险内容可自动发布。

## 开发检查清单 / Development Checklist

提交前请确认：

- [ ] 无密钥、Cookie、真实用户内容进入仓库
- [ ] 前端通过 `npm run check`
- [ ] Rust 通过 `cargo check --manifest-path src-tauri/Cargo.toml`
- [ ] 新功能覆盖正常路径、授权拒绝、网络失败场景
- [ ] 涉及自动发布的改动保留人工暂停开关和审计记录
- [ ] 文案标注"信息整理，不构成投资建议"
- [ ] 提交信息符合 Conventional Commits 规范

## 架构与文档 / Architecture & Documentation

- 架构概览：[`docs/architecture.md`](docs/architecture.md)
- 编码规范：[`AGENTS.md`](AGENTS.md)
- 变更日志：[`CHANGELOG.md`](CHANGELOG.md)

修改架构边界时，请同步更新相关文档。

## 许可证 / License

本项目基于 [GNU General Public License v3.0](LICENSE) 开源。提交代码即表示你同意将贡献以相同许可证发布。

---

<p align="center">
  <sub>感谢你的贡献！每一份努力都让这个项目变得更好。</sub>
</p>
