# 架构与目录规划

## 产品原则

这是一个本地优先的财经内容生产应用：收集获授权信息，生成可溯源草稿，先审核后发布。桌面端不承担无头爬虫或绕过平台限制的职责。

## 运行时边界

```text
React UI (src/) -- Tauri invoke --> Rust desktop core (src-tauri/)
                                       |             |
                                  encrypted store  worker protocol
                                                     |
                                              Python workers (workers/)
                                                     |
                                      authorized APIs / market data providers
```

- **UI**：展示信息、编辑草稿、请求用户授权；不保存敏感凭据，也不直接访问外部财经网站。
- **Rust 桌面核心**：管理凭据、定时任务、审计日志、发布审批与 worker 生命周期。
- **Python worker（第二阶段）**：清洗、去重、事件聚类、制图和模型调用。以版本化 JSON 合约与 Rust 通信。
- **外部服务**：只允许官方 API、商业许可数据或取得书面授权的内容源。

## 目标目录

```text
src/
  app/              # 应用壳、路由、全局组合
  features/         # dashboard, topics, composer, publishing, settings
  components/       # 可复用展示组件
  lib/              # Tauri adapter、纯函数、共享类型
  styles/
src-tauri/
  src/commands/     # 按业务域的 Tauri command（后续拆分）
  src/services/     # credentials, scheduler, audit, publisher
  capabilities/     # 最小权限声明
workers/
  collector/        # 合规数据连接器
  content/          # 摘要、风险检查、图表生成
contracts/          # UI/core/worker 间版本化 DTO 与 JSON Schema
docs/               # 架构、ADR、数据源授权记录
tests/              # integration 与 e2e 测试
```

当前仅创建了可启动的最小 UI 和 Rust command。按功能增长再创建 `features/`、`workers/` 和 `contracts/`，避免空目录和伪实现。

## 交付阶段

1. **本地草稿台**：设置、选题、内容编辑、引用和人工发布。
2. **受控连接器**：接入获授权的行情/X/发布 API，加入速率限制和审计。
3. **Worker 管线**：独立打包 Python worker，加入队列、重试和可观测性。
4. **条件自动化**：只允许经验证的低风险模板自动发布，保留全局暂停与人工接管。
