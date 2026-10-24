# dsh-plugin-publish · DeepSeek Harness 发布端插件

一个插件管住所有平台发布：**唯一发布入口 + 人工审批门禁 + 回执台账**。
上传动作不重写，交给两个成熟上游：

- 小红书 → [`xpzouying/xiaohongshu-mcp`](https://github.com/xpzouying/xiaohongshu-mcp)（HTTP，默认 `http://127.0.0.1:18060`）
- 其余平台 → [`dreammis/social-auto-upload`](https://github.com/dreammis/social-auto-upload)（`sau` CLI）

## 现在是什么状态

**v0.1 骨架，未跑过真实发布。** 已通过：`tsc` 类型检查、模块导入烟测、台账与摘要烟测、DSH web profile 实际加载（`.ts` 源码直引和 `dist/index.js` 打包产物两种形态都零 warning）、pnpm 从本仓库 GitHub 链接安装、裸包名经 `exports` 解析到 `dist/index.js`。

本包现已声明 `dsh.bundle.patch`。此前缺失该字段会让 `dsh plugin add` 判定 `not-bundle` 并回滚安装，即报错「这个包没有声明组合包，不能作为插件管理」。**这一项尚未在真实 dsh 插件管理器里端到端复验**，装成功与否以启动日志静默为准。

**没有验证过**：连真实 18060、跑真实 `sau upload-*`、审批弹窗与后台任务完成通知的实际表现。

先按这份文档自己装、自己测；不要把它当成"已经能发内容"的东西。

## 前置：两个上游先装好

插件只做编排，没有上游它什么也发不出去。

| 上游 | 装法 | 关键点 |
|---|---|---|
| xiaohongshu-mcp | 从 Releases 下 Windows amd64 的 `xiaohongshu-mcp.exe` 与 `xiaohongshu-login.exe`，放同一个目录 | 默认监听 `:18060`；用前先跑 login 扫码 |
| social-auto-upload | `git clone` 后 `uv venv --python 3.12` + `uv pip install -e .`，再 `cp conf.example.py conf.py` | **Python 必须 3.12**（项目要求 `>=3.10,<3.13`，3.13 会出兼容警告）；另需 `patchright install chromium` |

`sau` 可以跨目录调用（editable 安装会把仓库根挂进 `sys.path`），所以插件配置里直接写 venv 的 `sau.exe` 绝对路径，不必改 PATH。

## 安装

### 方式 A：GitHub 链接安装（推荐，一条命令装完即接线）

本包在 `package.json` 里声明了 `dsh.bundle.patch` 指向本文件，所以 **`dsh plugin add` 会自动加载这层 overlay 完成接线，不需要再手动往 profile 里写 `insert`**。

```sh
dsh plugin --profile <profile> add github:wzhmaggie25-rgb/laowang-workbench#path:/plugins/dsh-publish
```

`dsh plugin` 本身不装东西，它只把参数原样转发给 profile 目录里的 pnpm。命令行里给地址加引号无所谓（shell 会吃掉），但**在桌面版「添加插件」对话框里绝不能带引号** —— 那个框只接收 `dsh plugin add` 之后的那一段，多一个 `"` 会报 `Path "/plugins/dsh-publish"" is not a directory`。

对话框里的「安装源」保持默认或选 npm 官方源，**不要选「自定义地址」**：GitHub 地址和 `.tgz` 直链根本不经过安装源，选自定义只会多出一个必须填 `http(s)://` 的框。

profile 用哪个取决于你的入口：桌面版是 `desktop`，`dsh web` 是 `web`。

> 走 `--profile desktop` 前，桌面版必须已经启动过一次（初始化 profile），并且**运行时完全退出**再执行安装。

**机器专属配置怎么给**：本文件只带与机器无关的 `accounts`，其余字段全部走 `src/defaults.ts` 的上游默认值。要覆盖 `sauBin`、`sauCwd`、`xhsBaseUrl`，在你自己的 `~/.dsh/profiles/<profile>/cordis.patch.yml` 里追加同名条目 —— profile 那一层在所有组合包**之后**应用，同名 config 字段以它为准（**不要覆盖文件里已有的条目**，原文件通常只有注释和 `[]`）：

```yaml
- id: publish
  config:
    sauBin: 'D:/social-auto-upload/.venv/Scripts/sau.exe'
    sauCwd: 'D:/social-auto-upload'
```

实测情况（pnpm 10.34 / 11.28.5）：

- **已实测通过**：GitHub 链接拉包安装（3.6–5.2 秒）；`name` 写裸包名 `dsh-plugin-publish` 经 `exports` 解析到 `dist/index.js` 成功。
- 升级：`dsh plugin --profile <profile> update dsh-plugin-publish`（转发给 pnpm），或删掉重 add。

`dist/index.js` 是提交进仓库的 esbuild 打包产物（`@deepseek-ai/*` 保持外部导入，由 DSH 运行时供给），所以**装的时候不需要构建**。想自己重新打包：把插件目录放进 DSH 源码仓库里，`pnpm i && pnpm build`。

### 方式 B：源码直引（开发用，改完不用重新打包）

**插件目录放哪里都行**，不要求塞进 DSH 源码仓库（已实测仓库外路径正常加载）。
插件 import 的 `@deepseek-ai/cordis`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery` 由 DSH 运行时供给，不需要你在插件目录里装依赖。

只有一种情况会 `ERR_MODULE_NOT_FOUND`：**脱离 DSH 运行时**直接用 node/tsx 去 import `src/index.ts`（比如单独跑类型检查）。这不影响在 DSH 里加载。

注意本包的 `cordis.patch.yml` 是给方式 A 自动接线用的（`name` 写的是包名，解析到 `dist/index.js`）。源码直引要自己写一条 `insert`，把 `name` 指到 `.ts` 的**绝对路径**：

```yaml
- insert:
    - id: publish
      name: '<克隆目录>/plugins/dsh-publish/src/index.ts'
```

1. `git clone https://github.com/wzhmaggie25-rgb/laowang-workbench.git`，插件在 `plugins/dsh-publish/`。
2. 临时试用（`--patch` 是**全局参数**，必须放在子命令之前）：

```sh
# 在 DSH 源码仓库根目录执行（下面用 pnpm run dsh，等价于 node --import tsx/esm apps/cli/src/bin.ts）
pnpm run dsh --patch "<你自己的 patch 文件>" web
```

3. 长期生效：把那条 `insert` 合并进 `~/.dsh/profiles/<profile>/cordis.patch.yml`，**不要覆盖文件里已有的条目**。

**怎么判断装成功还是失败**：启动日志里

- 什么都不打印 → 插件已激活（成功是静默的）
- 打印 `dsh: warning: 1 entry did not activate` + 一段堆栈 → 加载失败，堆栈里会写明是路径不存在、模块找不到，还是 `inject` 的服务缺失

零副作用地先验一遍配置合成（不启动服务）：

```sh
pnpm run dsh --profile web --patch "<你自己的 patch 文件>" --dump-config | grep -A3 "id: publish"
```

> 方式 B 加载的是 `.ts`，靠的是 DSH 源码版自带的 tsx。npm 装的 dsh 没有 tsx，请用方式 A。


## 停用

接线是跟着包走的，所以停用就是卸载包 —— 那条 `insert` 在包自带的 `cordis.patch.yml` 里，包没了这层 overlay 自然消失：

```sh
dsh plugin --profile <profile> remove dsh-plugin-publish
```

方式 B（源码直引）没有装包，改回原来那样：把 profile patch 里那段 `- insert:` 整块注释掉或删掉即可，插件目录留着不影响。

两种都确认一下：

```sh
pnpm run dsh --profile <profile> --dump-config | grep -c "id: publish"   # 应为 0
```

> 如果你曾在 profile patch 里覆盖过 `publish` 的 config，那些条目本身不会报错，但插件已不在，留着没有作用，建议一并清掉。

## 配置

默认值全部来自 `src/defaults.ts`，本包 `cordis.patch.yml` 只带 `accounts`。要改任何一项，写到 `~/.dsh/profiles/<profile>/cordis.patch.yml`（组合包之后应用，同名以它为准），**不要改包里的文件** —— 一升级就被冲掉。

| 字段 | 默认 | 说明 |
|---|---|---|
| `accounts` | `[]` | `{ platform, name }`，`name` 即 sau 的 `--account`，登录时用同一个名字 |
| `xhsBaseUrl` | `http://127.0.0.1:18060` | 上游默认端口 |
| `xhsToken` | — | 上游启用 `AUTH_TOKEN` 才需要 |
| `sauBin` | `sau` | 不在 PATH 上就写 venv 里的绝对路径 |
| `sauCwd` | — | social-auto-upload 仓库根目录 |
| `ledgerPath` | `~/.dsh/publish/ledger.json` | 台账位置 |
| `requireApproval` | `true` | 发布前必须人工确认（fail-closed） |
| `approvalTimeoutSec` | `300` | 超时按拒绝处理 |
| `dailyLimit` | `0` | 0 = 不限 |
| `allowedPlatforms` / `allowedAccounts` | `[]` | 空 = 不限 |
| `headed` | `false` | true 才给 sau 传 `--headed` |
| `httpTimeoutMs` | `180000` | 小红书 HTTP 超时 |
| `publishTimeoutMs` | `900000` | sau 命令超时 |

## 工具面（固定 4 个，加平台不加工具）

| 工具 | 作用 |
|---|---|
| `publish_accounts` | 账号列表 + 上游登录态（只读） |
| `publish_prepare` | 预检、算内容摘要、建台账，返回 `prepareId` |
| `publish_submit` | 人工确认 → 入队 → 发布；同内容不重发 |
| `publish_status` | 查台账；`unknown` 必须人工核，禁止自动重发 |

## 默认值：一律按上游，插件不改

| 项目 | 默认 | 来源 |
|---|---|---|
| 小红书可见范围 | 不传 = 公开可见 | xiaohongshu-mcp `docs/API.md` |
| 小红书原创 | 不传 = 不声明 | 同上（仅图文接口有该参数） |
| 小红书定时 | 不传 = 立即发布；填则 1 小时~14 天 | 同上 |
| 小红书标题/正文 | ≤20 字 / ≤1000 字 | xiaohongshu-mcp README |
| sau 浏览器模式 | 不传 `--headless/--headed` = headless | `docs/CLI.md` |
| sau 定时 | 不传 `--schedule` = 立即发布；格式 `YYYY-MM-DD HH:MM` | `skills/xiaohongshu-upload/references/cli-contract.md` |
| sau 账号 | `--account` 必填，无默认账号 | `docs/install.md` |
| 抖音短信验证 | 读项目根 `verify_code.txt` | `docs/install.md` |

偏离默认只在用户显式传参时发生，并写进台账的 `deviations` 字段。
插件自己的配额 `dailyLimit` 默认 `0`（不限），不擅自改变发布行为。

## 三个设计约束

1. **审批绑内容摘要**：`publish_submit` 会重算媒体哈希，`prepare` 之后内容改了直接拒，不会出现"批准的是 A、发出去是 B"。
2. **未知态不自动重发**：进程崩溃或超时留下 `submitting`，启动时统一改判 `unknown`；`unknown` 只能人工核。这一点沿用 sau 自己的 `submission_unknown` 原义。
3. **发布走后台任务**：视频上传要几分钟，同步返回必然超时；`publish_submit` 立刻返回 jobId，实际执行交给 jobs。

## 已知边界（不要当成已实现）

- **小红书发布响应没有作品 id/链接**，所以台账不存作品 id；反查需另接 `feeds` 接口，v0.1 未接。
- **sau 没有 `--json`、没有退出码文档**：退出码 0 但拿不到成功文本时判 `unknown`，不猜成功。
- **bilibili 需要 `--tid`**，v0.1 标记不可用；tiktok 上游没有 CLI。
- **台账是单进程 JSON**：多实例并发前必须换 SQLite。
- **小红书单通道**：social-auto-upload 的浏览器版会和 xiaohongshu-mcp 抢同一个网页端登录态，会互踢且招风控。定死：小红书只走 xiaohongshu-mcp，sau 管其余平台。
- 插件不碰 cookie、浏览器和平台风控，这些都在各自上游进程里。

## 自检

```sh
# 在 DSH 源码仓库根目录执行
# 只读诊断：逐项过前置条件，不发任何内容
# 退出码 0 全绿 / 1 有阻断 / 2 仅警告
PUBLISH_SAU_CWD="<social-auto-upload>" PUBLISH_XHS_DIR="<xiaohongshu-mcp>" \
  tsx "plugins/dsh-publish/scripts/doctor.ts"

# 纯逻辑烟测（只依赖 Node 内置模块，不依赖 DSH 运行时）
tsx "plugins/dsh-publish/tests/smoke.ts"
```

扫码登录是唯一必须人做的环节，`scripts/login-all.bat` 把两个平台的登录命令串成一次，先设 `PUBLISH_XHS_DIR` / `PUBLISH_SAU_CWD` 再用。

## 目录

```text
plugins/dsh-publish/
├── dist/index.js         esbuild 打包产物（提交进仓库，链接安装的入口）
├── src/
│   ├── index.ts          插件入口：注册 4 个工具、审批门禁、任务入队
│   ├── platforms.ts      平台能力表（adapter / 命令名 / 能力等级）
│   ├── adapters/xhs.ts   小红书 HTTP 适配器
│   ├── adapters/sau.ts   sau CLI 适配器
│   ├── ledger.ts         回执台账
│   ├── digest.ts         内容摘要与幂等键
│   ├── defaults.ts       上游默认值事实表
│   └── types.ts
├── scripts/doctor.ts     只读诊断
├── scripts/login-all.bat 一键扫码
├── tests/smoke.ts        纯逻辑烟测
└── cordis.patch.yml      组合包自带 overlay（装完自动接线）
```
