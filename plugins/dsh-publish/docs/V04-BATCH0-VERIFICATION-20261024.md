# v0.4 批次 0：接入验证记录

> 日期：2026-10-24
> 依据：《发布插件 v0.4 审核与智能发布助手方案》第 6.2 条（先验证模型接入）与批次 0 交付要求
> 环境：隔离 DSH_HOME（base + web-app + dsh-plugin-publish），凭据采用生产 `.credentials.yaml` 的单文件副本，验证后即删；全程未触碰正式桌面数据

## 1. 模型路由验证 ✅

- 路径：`ctx.agentDefaultModel.currentSelection()`（`@deepseek-ai/dsh-agent-default-model`，base bundle 加载）
- 结果：正确返回 `{ provider: 'deepseek-account', model: 'deepseek-flash', reasoningEffort: 'high' }`，与桌面 profile 的 agent-default-model 配置一致。
- 结论：设置表"默认模型：跟随已配置的 DSH 模型路由"可实现，不另存 API Key。

## 2. 流式调用与失败语义验证 ✅（含负面结果）

通过插件自有端点 `/api/publish/ai.status`（走插件 Host 上下文、owner 鉴权、`ctx.llm.stream()`）实测：

| 项 | 结果 |
|---|---|
| 协议 | `StreamChunk` 联合类型：`block-start / text-delta / reasoning-delta / tool-call-delta / block-end / usage / finish`；文本增量取 `text-delta`（首版误取 `text` 已修正） |
| 取消 | `GenerateOptions.signal` 透传，端到端可用 |
| 失败传递 | 结构化：`finish { kind: 'error', failure: { code, message } }`，不抛异常、不静默 |
| 实测调用 | 隔离环境返回 `ACCOUNT_SIGN_IN_REQUIRED`（"Sign in to DeepSeek to use the account provider"）——**真实、可复现** |

## 3. 关键事实发现：账号型 provider 的可用边界

- 桌面默认模型 provider 是 **`deepseek-account`（账号登录型）**：需要 DSH 内的 DeepSeek 账号登录态；把 `.credentials.yaml` 复制到隔离环境**不足以**携带该登录态（错误码明确）。
- 推论：**正式桌面（已登录账号）预期可用**；此预期属于批次 1 验收项（用户实机抽查），不在隔离环境断言。
- 对设计的约束（已落入方案）：
  1. `ai.status` 将 `ACCOUNT_SIGN_IN_REQUIRED` 翻译为可操作提示（"请先在 DSH 中登录该账号"），不显示含糊失败；
  2. E2E 用 **mock llm provider** 验证控制流；真实模型成稿质量按交接文档第 8 节由代表素材人工抽查；
  3. 插件的生成调用不带 sessionId（非 loop 辅助调用），**DSH 不自动记录**——按交接 6.3，插件自存完整生成依据（素材版本、提示词、平台规则版本、provider/model、请求与结果）。

## 4. 素材读取通路验证 ✅（复用既有能力）

- 浏览器文件选择器不暴露真实绝对路径（交接文档技术核验确认）→ 素材（Markdown/TXT/SRT）经**现有 `/api/publish.media` 暂存接口**上传到 DSH Host（流式、限 maxMediaBytes、失败不留残片），Host 侧读文本返回解析结果；媒体文件作为附件记录路径与大小。
- 与"上传到发布平台"严格区分：素材只进 DSH Host，不进任何平台。

## 5. 结论与开工条件

批次 0 的验证目标全部达成（含一项负面结果转化为设计约束）。**批次 1（智能最小闭环）开工条件成立**：模型路由可解析、流式协议与失败语义明确、素材通路复用现有接口、生成依据自存方案已定。
