---
项目: 老王工作台
交接对象: Qoder
日期: 2026-10-24
状态: 页面与服务开发中；有阻塞，未通过端到端验收
代码位置: D:/AI/laowang-workbench-public/plugins/dsh-publish
分支: codex/publish-center-ui
基线提交: f1dec993bc1fc9394de63268ad27dc2778e19cd1
---

# 发布插件：方案、当前进度与 Qoder 后续任务

## 1. 本次目标与交接结论

老王的明确要求是：已有的发布插件继续作为唯一产品入口，补上**发布可视化页面、与真实参数对应的详细设置、侧边栏入口开关**。所有渠道仍在同一个插件中管理，上传动作继续复用 xiaohongshu-mcp 与 social-auto-upload。

目前有两份不同状态的产物：

- **已安装基线：** 桌面 profile 中的 `dsh-plugin-publish@0.1.0`，来源为 GitHub 提交 `f1dec993bc1fc9394de63268ad27dc2778e19cd1`。它只有 Host 工具，无发布页面；插件 README 明确尚未验证真实发布。
- **本轮候选代码：** 本地仓库分支 `codex/publish-center-ui` 上的未提交工作，manifest 暂写 `0.2.0`，已补页面、设置、服务与构建脚本。它**尚未提交 Git、推送 GitHub、创建 PR 或替换已安装插件**。

**交给 Qoder 的是需要继续开发和验证的候选实现。** Host/Client 类型检查、打包和 6 项离线行为测试已经通过；真实测试 Host 能启动、侧栏能出现入口，但浏览器流程未通过。第一优先级是修复页面 API 接线，之后完成验收与交付。

本次按老王最新要求转为交接，Codex不再继续推进功能开发。临时测试 Host 已停止，正式工作台和正式数据未替换。

## 2. 路径、版本与保留项

| 对象 | 位置 / 状态 |
|---|---|
| GitHub 仓库 | https://github.com/wzhmaggie25-rgb/laowang-workbench |
| 本地开发仓库 | `D:/AI/laowang-workbench-public` |
| 插件源码 | `D:/AI/laowang-workbench-public/plugins/dsh-publish` |
| 当前分支 | `codex/publish-center-ui`，有未提交及未跟踪文件，先核 `git status` |
| 本轮基线 | `f1dec993bc1fc9394de63268ad27dc2778e19cd1`，与已安装插件来源一致 |
| DSH 框架源码 | `D:/AI/老王工作台`，`0.2.1-rc.2`，提交 `687f282e8625c6b8d11ff58211a90524be2e4317` |
| 正式桌面 DSH_HOME | `D:/AI/kaigan-workbench-data/desktop` |
| 已安装插件 | `D:/AI/kaigan-workbench-data/desktop/profiles/desktop/node_modules/dsh-plugin-publish` |
| 正式桌面 profile | `D:/AI/kaigan-workbench-data/desktop/profiles/desktop/package.json` |
| 独立测试数据目录 | `C:/Users/46136/AppData/Local/Temp/dsh-publish-page-26eaaee58d20498ca9ce7681d868cb66` |
| 本机原始接入方案 | `C:/Users/46136/Obsidian/老王的知识/01 - Projects/老王工作台/发布端接入方案-20261024.md` |

保留正式桌面、正式 profile 配置、模型认证、已有账号登录态、旧台账与 DSH 本机适配。继续在公开仓库的插件目录开发，不去改安装目录中的 `node_modules` 充当源码。修改 DSH 框架需另有具体必要性，按该仓库的 AGENTS.md 和防御规则执行。

独立测试目录可能含该临时 Host 自建的认证文件，**不得打包或上传整个目录**。交接包只包含插件候选源码、文档和必要的框架参考代码，不包含该测试数据目录。

## 3. 发布中心产品方案

### 3.1 入口与布局

左侧现有主导航新增“发布中心”，复用 DSH 的主页面 Slot。页面包含四个标签：

1. **新建发布：** 选择平台、账号与内容类型，填写标题、正文、标签，选择媒体与可选排期，先预检，查看最终内容，再明确确认发布。
2. **发布记录：** 查看任务、平台、账号、更新时间、原始结果与待核实原因；按目标分别显示结果。
3. **账号：** 维护平台与本地账号别名，保存后可检查登录状态。首版登录继续通过上游本地工具完成，不显示不存在的扫码能力。
4. **设置：** 入口开关、发布启用、上传引擎连接、审批行为、限额、超时与媒体配置。

新建发布桌面布局：左侧编辑表单占剩余宽度，右侧预览宽 320px，间隔 24px。页面头部水平内边距 32px、顶部 28px；内容内边距 24px 32px；分区内边距 24px。小于 1000px 改成上下排布；小于 520px 将页面左右留白收至 16px。这些是候选实现参数，最终以真实 DSH 窗口验收为准。

隐藏侧栏入口只隐藏导航；插件设置页仍保留“发布中心”按钮与入口开关，能重新进入和恢复。整插件启停继续由 DSH 插件管理完成，与“显示侧栏入口”“启用发布”三个开关分别表达。

### 3.2 新建发布字段与动作

| 字段 / 动作 | 行为 |
|---|---|
| 平台 | 从插件已登记的能力表选择，未适配项显示原因 |
| 账号 | 只显示该平台已配置的别名；展示值与实际提交值一致 |
| 内容类型 | 仅显示平台支持的视频 / 图文 / 文章 |
| 标题、正文、标签 | 预检后冻结本次确认对应的内容，编辑后取消旧确认 |
| 媒体 | 支持从页面选文件并传到 Host 暂存目录；支持本机绝对路径；预览图片/视频 |
| 定时 | 小红书传 RFC3339，sau 传对应格式；明确时间所用时区 |
| 可见范围、原创声明 | 按平台能力显示；未显式选择时沿用上游默认 |
| 预检 | 验能力、账号、媒体、内容与发布策略，生成 prepareId、摘要和待确认快照 |
| 最终确认 | 展示最终平台、账号、标题、正文、媒体、声明与时间，显式确认后才提交 |
| 结果 | `submitted` 表示已提交待核实；不能因为退出码或成功文本就声称已公开 |

修改标题、正文、媒体、账号、平台或排期后，旧确认失效。页面确认与聊天工具审批必须进入同一个业务提交流程；页面的明确确认需留审计记录，聊天工具继续走原生 approval。页面不得发自然语言给模型后假定模型一定执行了指定操作。

### 3.3 详细设置与实际参数

| 页面字段 | 配置键 | 候选默认值 | 生效与验收 |
|---|---|---|---|
| 在侧栏显示发布中心 | `showSidebar` | true | 保存后立即隐藏/显示；刷新及重开保留；插件设置页能恢复 |
| 启用发布 | `publishingEnabled` | true | false 时前端禁提交，Host 同样拒绝；查看记录和设置仍可用 |
| 账号表 | `accounts` | bundle 中小红书/抖音 default | 平台+别名，可增删改；保存后选择框同步；UI 行身份用稳定 id |
| 小红书服务地址 | `xhsBaseUrl` | `http://127.0.0.1:18060` | 连接已有服务，不自动改变引擎启动方式 |
| 小红书鉴权 Token | `xhsToken` | 未配置 | 密码输入、原生 secret role，不回显已保存值，不进台账或日志 |
| sau 可执行文件 | `sauBin` | `sau` | 支持 Windows venv 中 sau.exe 绝对路径 |
| sau 工作目录 | `sauCwd` | 未配置 | 指向对应上游仓库；缺项或无效路径需给出可操作错误 |
| 有头浏览器 | `headed` | false | 沿用原插件行为，仅显式选择才给 sau 对应参数 |
| 聊天工具提交前审批 | `requireApproval` | true | 保留原有策略；页面仍始终要求最终确认 |
| 确认有效期 | `approvalTimeoutSec` | 300 | 过期/取消不能执行；需协调工具整体 timeout |
| 每日发布上限 | `dailyLimit` | 0，即不限 | 需统计提交中的、已提交和待核实任务，并发不能超限 |
| 每日配额时区 | `dailyTimeZone` | `Asia/Shanghai` | 保存时验证有效时区，跨日计算按该时区 |
| 平台白名单 | `allowedPlatforms` | 空，即不限 | Host 预检与提交均检查 |
| 账号白名单 | `allowedAccounts` | 空，即不限 | 明确当前按别名匹配，避免跨平台同名造成误解 |
| 小红书请求超时 | `httpTimeoutMs` | 180000 | 超时后结果待核实，不自动重发 |
| sau 上传超时 | `publishTimeoutMs` | 900000 | 同上，取消/进程退出不能等同撤销发布 |
| 单文件上限 | `maxMediaBytes` | 536870912 | Host 流式计数，超限删除未完成暂存文件 |
| 当前台账位置 | `ledgerPath` | 只读展示实际路径 | 更改存储位置另做迁移/重启设计，不做假热更新 |

配置由 DSH 原生 Config / volatile / ConfigForms 持久化，页面使用 SettingsForm。草稿和实际生效配置分开：保存失败保留编辑，服务端拒绝时不改正式配置；令牌不进入普通表单回显。

## 4. 本轮实际进度

| 工作 | 当前状态 | 证据 / 限制 |
|---|---|---|
| 确认已安装基线 | 已核实 | desktop profile 声明包；lock 指向基线提交；安装包有 Host 无 Client |
| 创建独立开发分支 | 已完成 | `codex/publish-center-ui`，基线仍可回查 |
| Client 声明与构建格式 | 已写、打包通过 | `dsh.client`、`./client`、lazy-CJS factory |
| 发布页四个标签与预览 | 已有候选实现 | `src/client/Page.tsx`，尚未通过完整交互验收 |
| 设置与侧栏开关 | 已接候选实现 | 原生 ConfigForms、独立插件设置入口，保存/重开仍待端到端证据 |
| 共享业务层 | 已写 | `src/runtime.ts` 为工具和页面复用准备/提交/记录逻辑 |
| 同内容并发防重 | 离线测试通过 | 两次并发只启动一次上传 |
| 确认后媒体变化/取消 | 离线测试通过 | 均不启动上传 |
| 登录态误判修正 | 离线测试通过 | 小红书 success=true、is_logged_in=false 不再判已登录 |
| 超时/断连结果 | 离线测试通过 | 模拟丢失响应记 unknown |
| 暂停发布 | 离线测试通过 | Host 拒绝新计划 |
| 页面任务全局 jobs controller | 已补代码 | 独立审核发现后补 `attachController`；实际 LocalJobRegistry 还需验证 |
| 每日上限的 submitted 统计与 admission 锁 | 已补代码 | 尚无针对该补丁的独立行为测试，不得称通过 |
| Host / Client 类型检查 | 已通过 | `node scripts/typecheck.mjs`，对当前 DSH 构建声明分别检查 |
| Host / Client 打包 | 已通过 | `node scripts/build.mjs` |
| 真实测试 Host 启动 | 已做到 | 独立 DSH_HOME，启动日志有监听地址，侧栏出现发布入口 |
| 浏览器端到端 | **未通过** | 见下一节；不能把侧栏出现当成页面/API可用 |
| GitHub 更新 / 新版安装 | **未执行** | 未 commit、push、PR、安装更新或替换正式桌面插件 |
| 账号扫码 / 真实发布 | **未执行** | 所有离线测试模拟 provider，无真实上传 |

未给“完成百分比”，因为页面可见、接口可用、发布闭环、可升级交付是不同验收项。

## 5. 已知阻塞与风险：Qoder 先处理这些

### P0：当前页面 API 抢占 DSH 的唯一共享 /api 拦截器

候选 `src/api.ts:17` 调用 `ctx.connection.rpc.intercept('/api', ...)`。DSH 的 Gateway 已经使用这个位置，`packages/client/connection/src/rpc-host.ts:279—300` 明确一个 channel 只能有一个 interceptor；重复注册会报错。普通业务插件不能抢这个位置。

**第一步先改 API 接入方式。** 优先核对 DSH 公开的 Remote 服务/生成注册能力；第三方插件若采用 Connection 自定义 RPC，应使用独立通道并验证 Web/Desktop 的路由、鉴权、Peer 与生命周期。不要改核心代码使 /api 可以被两个业务方抢占，也不要绕开鉴权新增裸 HTTP 发布接口。媒体二进制上传继续使用已有 authenticated Fetch registry。

这是源码已确认的接线缺陷。浏览器失败与该缺陷的具体对应日志尚未补齐；不要把猜测写成已完成运行诊断。

### P1：浏览器用例没有走通

已有 `tests/browser-smoke.mjs`。实际尝试中出现：

- 预览版说明弹层挡住侧栏点击；当前脚本只在固定等待后检查“继续”，会错过稍后出现的弹层。
- 一次进入页面后，账号选择框值为空，未达到预期 `page-test`。
- 新增的账号归一化与 accepted settings 刷新代码，仍需在 API 修复后重新验证。
- 侧栏开关保存/恢复、账号保存、刷新恢复与窄窗口的后续断言尚未全程跑完。

改为等待明确就绪状态，处理首启说明；出错保留页面错误和接口失败证据。去掉依赖固定延时的成功判断。先通过页面状态读取，再测设置，再测媒体预检，最后才在模拟引擎上测确认提交。

### P1：后台任务与配额补丁需要真实框架验证

Web bundle 禁用全局 tool-jobs，仅 Agent preset 中有 scoped controller。页面没有 Agent owner，原写法会因无全局 controller 被拒绝。本轮已在插件中补 `ctx.jobs.attachController('publish-center')`，但测试目前主要 mock jobs，需用实际 LocalJobRegistry 验证页面任务、完成、取消、卸载。

每日配额已补 `submitted`、`unknown`、`submittedAt`、时区与 admission 锁。补充测试：上限 1 时两条不同内容并发，只能有一条被接受；已提交待核实仍占量；跨日按设置时区；旧 prepared 记录按实际提交日计算。

### P1：旧台账默认位置改变，升级前必须设计迁移

v0.1 默认台账是 `~/.dsh/publish/ledger.json`；候选代码改为当前 `DSH_HOME/publish/ledger.json`。正式桌面的独立数据目录与用户默认 `~/.dsh` 不同。未经处理直接升级可能读到空台账，失去历史防重依据。

核对实际旧位置，提出明确的迁移/兼容读取方案，保留原件和可回退证据。未完成这项，不能安装覆盖正式基线。

### P1：审批有效期与工具整体超时不一致

配置默认确认有效期 300 秒，`publish_submit` 工具仍声明 60000ms timeout。工具可能提前取消。当前代码已合并 exec.signal 并检查取消，阻止迟到审批触发上传；还需要解决用户看到的有效期与实际可等待时间不一致，并覆盖取消后迟到批准的真实服务用例。

### P2：交付前的其他检查

- 源码 README 仍主要描述 v0.1，需按最终行为重写；新增状态与台账字段写清升级说明。
- 当前 `platforms.ts` 登记 14 项，其中 B站/TikTok 不可用；bundle 只预配小红书和抖音。尚未覆盖上游全部渠道，不能写“17平台均已接通”。
- 小红书当前仍共用一个服务登录态，本地别名不代表物理账号隔离。首版界面要如实提示；多账号 worker 后续另做。
- SAU 仍直接 Node spawn，子进程树退出、环境传递与 sandbox 策略需按 DSH 文档检查，不把“页面能取消”等同上游浏览器已停止。
- 台账还是单进程 JSON；多实例写入、原子失败后状态、旧记录校验与损坏恢复仍需审查。
- 页面上传文件目前只有暂存，没有保留期/清理界面。增加明确管理策略前不要自动清理正式素材或回执。
- 页面中文/英文、明暗主题、Windows/macOS 顶部留白、焦点和窄窗口需实际验收。
- 自定义账号行的稳定 id、Token 密码输入、设置失败提示、关闭入口后的恢复路径，需要浏览器行为测试，不以源码存在代替证据。
- 打包中内联了 zod，Host dist 增大；评估包大小与依赖声明，但不要为减包手写 JSON 校验器。

## 6. Qoder 后续实施顺序

### 第一批：修接线，拿到可信的只读页面

1. 先读取本交接、现有 diff、仓库约束和 DSH Connection/Remote/Client Modules/ConfigForms 文档。
2. 核对本地未提交文件，保留基线；继续当前分支，不用远端旧版本覆盖本地候选文件。
3. 修复 /api 拦截器冲突，确认页面状态和原生 DSH 设置/会话 API 同时可用。
4. 在独立 DSH_HOME 启动测试 Host，侧栏打开四个标签，读取正确账号、能力与台账。
5. 保存账号/启用状态/侧栏开关后，页面实际值立即同步；刷新后保留；入口隐藏后能从插件设置页恢复。

**出口：** 真实测试工作台中的只读页面和详细设置全部通过；没有连接真实账号或真实发布。

### 第二批：在模拟上传引擎中验收发布闭环

1. 本地独立模拟 xhs HTTP 引擎和 sau 进程，测试环境地址明确隔离，不使用正式 18060 或正式 sau 账号。
2. 页面选媒体 → Host 暂存 → 预检 → 最终预览 → 确认 → jobs → 台账。
3. 验证拒绝、过期、取消、文件变化、重复点击、配额竞争、响应丢失和重启后的 unknown。
4. 验真实 LocalJobRegistry 与卸载回收；保存图片/视频的测试证据。
5. 加必要的 keyless 工具/页面输出回归用例。

**出口：** 页面和聊天工具共用一套业务状态；未确认无上传调用；已提交与已公开有明确区分；模拟故障无自动重发。

### 第三批：升级与桌面交付

1. 补旧台账迁移、兼容性范围、README、版本及升级说明；固定最终受验的构建产物。
2. 按最终改动运行相关检查，保存真实命令与结果。
3. Git 提交/推送并交付可审核的版本。安装正式插件前确认目标是独立桌面 profile，而非默认用户目录的另一套 profile。
4. 通过官方插件管理更新，按运行时提示处理重启，保留 v0.1 回退条件。不能通过覆盖 node_modules 冒充已发布升级。
5. 在老王当前桌面验证入口、设置持久化、账号与旧台账读取，保留正式安装回执。

**出口：** 老王的实际桌面能使用新页面；GitHub 版本、安装版本、构建证据能对应起来。

### 第四批：受控真实发布与扩平台

真实发布需老王明确授权具体账号与内容，再做一条受控验收；登录有效、接口响应、公开可见和内容质量分别确认。其余平台按能力表逐个适配和验收，不把上游支持自动算作插件支持。复杂排期日历、统计、多账号 worker 等后续按实际需要加入。

## 7. 文件导航与接线说明

| 文件 | 作用 / 当前注意点 |
|---|---|
| `src/index.ts` | 4 个聊天工具接共享 runtime；注册页面侧 jobs controller |
| `src/config.ts` | 原生 Schema、volatile 字段与 operation snapshot；ledgerPath 非热更新 |
| `src/runtime.ts` | prepare、确认后提交、防重、按账号串行、台账更新与配额 |
| `src/api.ts` | 页面协议与流式媒体上传；**/api interceptor 必须修** |
| `src/contract.ts` | 页面输入校验与协议前缀 |
| `src/ledger.ts` | 原有 JSON 台账；尚未整体重构 |
| `src/adapters/xhs.ts` | 本地 REST 接口、结构化登录状态、取消 signal |
| `src/adapters/sau.ts` | 原有 CLI 参数数组，增加取消及谨慎结果状态 |
| `src/client/index.ts` | 主页面、插件设置页、侧栏与本地化注册 |
| `src/client/Page.tsx` | 四标签页面与配置表单 |
| `src/client/model.ts` | 页面数据、草稿、设置模型与 accepted config 同步 |
| `src/client/locales.ts` | 中文/英文界面字典 |
| `src/client/client.css` | DSH token 样式和响应式布局 |
| `scripts/build.mjs` | Host bundle 与 lazy-CJS Client bundle |
| `scripts/typecheck.mjs` | 基于准备好的 DSH 构建声明，分 Host/Client 检查 |
| `scripts/test.mjs` | 打包并运行离线行为测试 |
| `tests/runtime.test.mjs` | 当前 6 项已通过的隔离行为测试 |
| `tests/browser-smoke.mjs` | 真实 Host 页面测试，当前未通过 |
| `dist/index.js`、`dist/client.js` | 候选构建产物；最终需按修订源码重建 |

设计沿用现有 DSH token 和组件：主背景 `--dsw-alias-bg-base`，内容表面 `--dsw-alias-bg-layer-1`，正文 `--dsw-alias-label-primary`，次级正文 `--dsw-alias-label-secondary`，边线 `--dsw-alias-border-l3`。主标题 22px/30px、500；区标题 16px/500；正文 14px、行高 1.6；辅助文字 12px。中性边线 0.5px；圆角使用主题变量；不另造全局主题。字体沿用工作台。图标使用共享 `IconSendOutlineRegular`。

这是实际插件候选代码，尚未达到发布条件；不存在一份已验收的 HTML 高保真稿。交接包中的源码、CSS和设计参数用于继续实现与核验，不能把它们称为已经上线的设计。

## 8. 已执行的验证与重现命令

在插件目录，PowerShell：

```powershell
$env:DSH_SOURCE = 'D:/AI/老王工作台'
node scripts/typecheck.mjs
node scripts/build.mjs
node scripts/test.mjs
```

上述类型检查/构建通过，离线测试输出 6 passed / 0 failed。离线测试不启动 DSH 模型，也不访问平台账号。其 mock 无法替代真实 Controller、RPC、ConfigForms、Desktop 与浏览器测试。

测试 Host 的有效启动形式如下；必须使用**新的隔离数据目录和专用 profile**。该基线源码直接传 `web` 会报参数错误，因此采用显式 profile，不要照搬旧手册的混合写法：

```powershell
$env:DSH_HOME = '<本轮专用测试数据目录>'
node --import tsx/esm apps/cli/src/bin.ts --profile web --patch apps/web/tests/pin-browse-picker.overlay.yml --no-open --port 0
```

此命令从 `D:/AI/老王工作台` 执行；测试 profile 需声明发布 bundle 并能解析本地候选包，参考保留的测试 profile。当前测试 Host 已停止；重开前由 Qoder重新核配置和进程。启动日志会有临时授权 URL，不把 token 放进交接、Git、截图或公开输出。

浏览器脚本环境：

```powershell
$env:DSH_SOURCE = 'D:/AI/老王工作台'
$env:PUBLISH_TEST_DIR = '<专用测试数据目录>'
$env:PUBLISH_TEST_LOG = Join-Path $env:PUBLISH_TEST_DIR 'host.log'
node tests/browser-smoke.mjs
```

这条浏览器脚本当前失败，Qoder需先修 API 和首启说明处理，再跑后续断言。脚本内的 `page-test` 是隔离测试账号别名，不能对正式环境原样运行。

## 9. 完成标准与交付回执

交付时逐项给证据：

- GitHub 提交 / 版本、实际安装来源 / 版本与本地构建一致。
- 发布中心入口正常；显示入口、启用发布和整插件启停分别生效。
- 所有页面字段对应真实服务端值，保存失败不伪报成功，刷新/重开保留。
- 账号选择框展示值与提交账号一致；未适配渠道如实标注。
- 图片/视频/文章用例按已支持能力预检，最终内容可核对。
- 页面最终确认和聊天工具审批均经过同一业务层，取消、过期、媒体变化和重复点击不产生未授权/重复上传。
- 配额、后台执行、结果未知、重启恢复和旧台账迁移通过。
- Cookie/Token 不进入模型上下文、普通日志和公开仓库。
- 明暗主题、常用桌面宽度、420px 窄窗口、键盘焦点通过。
- 真实发布单独列验收，未获具体授权就保持未验证。

Qoder每批回执写：本批提交与改动、实际运行命令、通过项、失败项及证据、是否涉及正式配置/账号、下一步。不要将“能打开页面”写成“发布插件已可正式使用”。

## 10. 可以直接发给 Qoder 的开工指令

> 请接手发布插件的发布中心页面开发。先读 `D:/AI/laowang-workbench-public/plugins/dsh-publish/docs/QODER-HANDOFF-20261024.md`，再检查仓库分支 `codex/publish-center-ui` 的全部未提交和未跟踪文件。已安装基线是 v0.1.0，候选 v0.2.0 仍未发布。先修 `src/api.ts` 抢占 DSH 唯一 /api interceptor 的接线缺陷，恢复页面与原生 API 共存；然后用隔离 DSH_HOME 验证发布页、详细设置、侧栏隐藏/恢复、账号同步和模拟发布闭环。已有 Host/Client 类型检查、打包和 6 项离线测试通过，但浏览器验收未通过。保留现有代码和正式桌面数据，补旧台账迁移及剩余测试，按文档分批回执。未得到具体账号与内容的发布授权前，不进行真实发布。

---

## 附：2026-10-24 续作完成记录（接手方 ZCode）

交接文档第 6 节的第一、二批已完成，第三批的代码与文档部分已完成，桌面安装替换待老王在运行中的桌面版里操作。

### 本批实际修改

| 交接项 | 结果 |
|---|---|
| P0 `/api` 拦截器冲突 | 页面 RPC 改为 `/api/publish/<endpoint>` 精确 Fetch 路由（`ctx.connection.fetch.register`），与 Gateway 组合共存、Composer 强制 owner 鉴权；媒体上传维持同一机制。曾尝试 `rpc.handle('/publish')` 独立通道，确认在 rc.2 的 Cordis 服务代理语义下第三方插件无法完成物理路由注册（shadow 上下文从 connection 插件自身 fiber 起链，够不到 webServer），故弃用。 |
| `Schema.transform` 破坏设置页 | `dailyTimeZone` 的 transform 节点无法序列化，客户端 rehydrate 后校验抛 `callback is not a function`，设置页永远「暂时无法读取插件设置」。已改为普通字符串 + 运行时在配额计算前显式校验时区并给出可操作错误。 |
| 侧栏/内容层叠 | 窄窗口下 flex 压缩把标签栏压成 1px、内容面板盖住标签。`.publish-center` 改 `overflow:hidden`，内容区自身滚动，header 与标签 `flex-shrink:0`。 |
| 旧台账迁移 | `Ledger.adoptLegacy`：新位置文件不存在且 `~/.dsh/publish/ledger.json` 存在时一次性并入（按 key 去重、规范化 deviations），旧文件只读保留；损坏的旧文件按配置错误拒绝启动。本机两处均无 v0.1 台账文件，迁移路径由测试覆盖。 |
| 审批有效期与工具超时 | `publish_submit` 工具预算改为 3,660,000ms（覆盖 `approvalTimeoutSec` 上限 3600 秒加提交开销），实际等待仍由 execute 内 `AbortSignal.timeout(approvalTimeoutSec)` 收口。 |
| 每日配额 | 补 3 项测试：上限 1 时两条不同内容并发只放行一条、已提交与 unknown 仍占额、昨日 prepared 不计入今日。配额统计与 admission 锁沿用交接时的实现，现有测试全部通过。 |
| 浏览器验收 | `tests/browser-smoke.mjs` 重写：等待真实就绪状态替代固定延时、按当前构建处理首启弹层（关闭/继续）、捕获 `/api/publish` 非 2xx、失败时留截图与 `browser-result.json`。**隔离 DSH_HOME 真实 Host 端到端已 PASS**：页面激活、账号经页面通道读取、侧栏隐藏/恢复、设置保存后刷新保留、账号增改同步、420px 不溢出。 |

### 验证证据

```powershell
$env:DSH_SOURCE = 'D:/AI/老王工作台'
node scripts/typecheck.mjs   # 通过
node scripts/test.mjs        # 10 passed / 0 failed
node scripts/build.mjs       # Host + Client 打包通过
node tests/browser-smoke.mjs # PASS（隔离 DSH_HOME 真实 Host）
```

浏览器验收环境：独立 `DSH_HOME`（Temp 专用目录）、专用 profile（base + web-app + dsh-plugin-publish，`accounts` 预置隔离别名 `page-test`）、无真实账号、无真实发布。

### 仍未完成（沿交接文档）

- 第三批剩余：在老王桌面 profile 通过官方插件管理更新 v0.1.0 → v0.2.0 并重启验证（本批未触碰正式桌面数据）。
- 第四批：受控真实发布验收与剩余平台适配。
