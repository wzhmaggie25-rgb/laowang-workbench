---
name: deepseek-harness-source-install
description: 在 Windows x64 安装并验收固定版本的官方 DeepSeek Harness 源码桌面开发版；适用于作为自有工作台开发基础的新机部署或断点续做。
---

# 安装官方源码桌面开发版

目标：在目标机得到能双击打开、正常退出重开、真实模型与工具可用、审批有效且设置和历史保留的源码桌面开发版。只走官方源码路线；不开发业务插件、不制作发行安装包。该流程固定复现已经验收的版本，不能承诺任意新机没有网络、权限或硬件异常。

## 1. 确认目标与已有成果

- 仅支持原生 Windows x64。先核对 OS、架构、Git、Node、Corepack、目录、占用端口及已有同类安装；ARM64 或 WSL 不套用本流程。
- 默认总目录 `C:\AI\laowang-workbench`：`source` 放源码，`data\desktop` 放 Harness 数据，`data\electron-user-data` 放 Electron 数据，`data\smoke` 放测试，`logs` 放脱敏证据，`tools` 放本地工具。用户指定路径时统一替换；优先英文短路径，不使用同步盘、网络盘或混用 WSL 文件系统。
- 保护已有安装、数据与源码修改。目标目录已存在时先辨认身份、提交、差异、依赖和构建结果；有效成果断点续做，不先清空、重装或升级。
- 每条原生命令执行后立即核对 `$LASTEXITCODE`；非零则保存第一处错误和该条命令，停止依赖它的步骤。可分享的证据不保存 token、密钥或认证内容；必要的原始启动日志仅留本机，摘录与截图先脱敏。

在原生 PowerShell 中设本次变量，后续沿用同一组绝对路径：

```powershell
$taskRoot = 'C:\AI\laowang-workbench'
$sourceDir = Join-Path $taskRoot 'source'
$dataRoot = Join-Path $taskRoot 'data'
$nodeDir = Join-Path $taskRoot 'tools\node-v22.22.2-win-x64'
$fixedCommit = '687f282e8625c6b8d11ff58211a90524be2e4317'
```

## 2. 准备准确工具与源码

- 使用 Node **22.22.2 x64**、Corepack 调用的 **pnpm 11.28.5**、Git ≥2.26。已有准确工具可复用并更新 `$nodeDir`；不替换系统 Node、不写全局环境变量。
- 缺少 Node 时，从 `https://nodejs.org/dist/v22.22.2/` 获取 `node-v22.22.2-win-x64.zip`，按同目录官方 `SHASUMS256.txt` 验证后解压到 `tools`；不得使用 WorkBuddy 私有路径或第三方重打包。缺少 Git 才安装官方 Git for Windows。
- 确认 `$nodeDir\node.exe` 与 `$nodeDir\corepack.cmd` 实际存在，将 `$nodeDir` 仅加入当前进程 PATH；核对 Node 输出精确为22.22.2、`process.arch` 为x64、`process.features.typescript` 可用。
- 保留 `NODE_OPTIONS` 和宿主保护变量；不能整项清空来消除报错。只有明确阻塞的具体选项才按权限与证据处理；遇到保护冲突如实停报。

```powershell
$env:PATH = "$nodeDir;$env:PATH"
& "$nodeDir\node.exe" --version
& "$nodeDir\node.exe" -p 'JSON.stringify({arch:process.arch,typescript:process.features.typescript})'
git --version
```

新目录执行以下获取；已有目录则只核对，不能覆盖或强制回退用户差异：

```powershell
git clone https://github.com/deepseek-ai/deepseek-harness.git $sourceDir
Set-Location -LiteralPath $sourceDir
git checkout --detach $fixedCommit
git rev-parse HEAD
git status --short
```

阅读此提交的 `AGENTS.md`、`SAFETY.md`、`docs/development.md` 和 `apps/desktop/README.md`。确认根版本 `0.2.1-rc.2`、`packageManager: pnpm@11.28.5`。保持仓库锁文件和官方依赖脚本许可；不自动跟随最新版本。

## 3. 安装依赖、Electron 与构建

在源码根逐条执行并记录退出码；已有准确且有效的对应产物可跳过已通过步骤：

```powershell
& "$nodeDir\corepack.cmd" pnpm --version
& "$nodeDir\corepack.cmd" pnpm install --frozen-lockfile
& "$nodeDir\corepack.cmd" pnpm --filter @deepseek-ai/dsh-desktop exec install-electron
& "$nodeDir\corepack.cmd" pnpm run build
```

- 必须先确认 pnpm 输出11.28.5；不要使用全局浮动 pnpm 或 `npx` 改走 npm 发行版。Corepack、下载、脚本许可失败时定位原错误；确需更新Corepack时只处理当前本地工具目录并核官方来源，不关签名或完整性检查、不跳必需脚本。
- Electron 二进制需上述独立官方准备步骤；“依赖已装完”不能代替。代理确有需要时仅对其下载进程设置 `ELECTRON_GET_USE_PROXY=1`，不硬编码镜像或关闭证书验证。
- 保持该固定提交的官方依赖布局（isolated linker）；不默认添加 `nodeLinker: hoisted`、`verifyDepsBeforeRun: false` 或手工 junction。缺模块时核对真实链接目标及工作区依赖，不能以修复脚本退出0代替解析成功。
- `pnpm run build` 已含产物与构建检查，不重复叠加全套测试。若分阶段使用 `build:artifacts`，最新产物之后必须通过 `build:check`。
- 不预装 WSL、全套编译器或额外 Python。仅在具体原生编译错误明确需要时补对应工具；UTF-8 编译错误可按证据只在当前进程设置 `CL=/utf-8`，保留其他既有编译选项。

## 4. 沿官方入口启动

先为本次数据、测试和日志建立独立普通目录，核实固定根及祖先不是意外重解析点。启动仅设置当前进程：

```powershell
$env:DSH_HOME = Join-Path $dataRoot 'desktop'
$env:DSH_DESKTOP_USER_DATA_DIR = Join-Path $dataRoot 'electron-user-data'
$env:DSH_DESKTOP_OPEN_DEVTOOLS = '0'
Set-Location -LiteralPath $sourceDir
& "$nodeDir\corepack.cmd" pnpm run start:desktop
```

- 若当前进程继承了 `ELECTRON_RUN_AS_NODE`，只清除此 Electron 运行模式变量再启动；它不是删除保护，不能借此清除 `NODE_OPTIONS` 等其他变量。
- 不先装官网 EXE、npm 版或另起 Web 服务；桌面本身启动独立 Host，服务端口默认由 OS 分配。默认调试端口9229、9222、9230仅在真实冲突时通过 `DSH_DESKTOP_MAIN_INSPECT_PORT`、`DSH_DESKTOP_RENDERER_DEBUG_PORT`、`DSH_DESKTOP_HOST_INSPECT_PORT` 分别调整。
- `start:desktop` 跳过编译，但**每次仍重建工程和运行时**。不修改官方启动器，不手工直跑 Electron，也不漏设官方入口负责的运行时配置。
- 首次覆盖既有生成目录前，核实它们属于本实例的可重建产物；`git status`不能证明被忽略目录没有人工修改。发现用户文件、人工修改或归属不明时，先保全并停止启动，明确处置后再继续。
- 官方每次替换源码内 `.desktop-build/development/project`、`.desktop-build/targets/win-x64/runtime/primary-runtime`、同级 `office-skills`；完整前缀均在 `apps/desktop/` 下。
- 准备与自检还会创建并清理临时实例：`dsh-primary-`、`dsh-node-`、`dsh python venv `、`dsh-office-smoke-`。归属以该次创建返回的绝对路径为准；不是授权整个 TEMP 或通配符清理旧残留。
- 下载缓存按摘要复用；官方可删除校验失败的对应坏缓存单文件，并清理自身随机临时写入文件。不把缓存目录整体列为可删，也不承诺其内容永不删除。
- 只有目标 Agent 的保护要求审批时，才先只读核实际绝对范围、链接本身与目标、临时父目录及排除项，按其合法流程获取具体授权。数量重新清点，不照搬旧机数字；不自造永久或当次批准标记系统，不代答审批、不换终端或父进程绕保护。

## 5. 做出用户能打开的入口

在桌面创建“老王工作台（源码开发版）”入口，固定实际 Node/Corepack、源码与两处数据路径，调用同一官方 `pnpm run start:desktop`。不覆盖已有图标，不称为正式安装包。

- 使用 CMD 包装时，控制语句和注释全 ASCII、CRLF，路径正确加引号；启动先显示日志位置，保存输出和退出码，失败保留窗口。不要把密钥、自动 YES、永久批准或关闭沙箱参数写入入口。
- 保留保护变量；只按上一节处理 `ELECTRON_RUN_AS_NODE`。入口与首次验收必须使用同一数据根和工具环境。
- 实际双击验证。工具不能合法双击或拒绝调用 `cmd.exe` 时，明确留为待用户操作；不把静态审查写成实测，不换执行方式绕过限制。
- 窗口出现后再验收功能；有进程、HTTP200、构建产物或日志“ready”都不能代替用户界面。

## 6. 完成真实验收

请用户在新桌面本地登录或设置合法模型；不索取聊天明文密钥，不读取复制旧认证。确认主界面、模型设置、会话、插件管理和权限入口能操作；新数据根没有旧会话是正常现象。

1. 使用 `data\smoke\workspace` 作为本轮会话工作目录；全部测试只在 `data\smoke` 内。核对当前权限为“工作区内修改”、审批为询问，保持测试期间不切换到完全访问。
2. 选两个尚不存在、位于 `smoke` 内而在 `workspace` 外的独立文件。做两项独立短测试：先申请写允许文件并回读，再单独申请写拒绝文件；拒绝后立即停止，不重试、不换工具或路径。由用户或获用户明确委托的测试操作者在真实审批中分别允许一次、拒绝一次；不切换为永久允许或完全访问。
3. 允许必须有真实文件、预期内容及回读；拒绝必须有实际 `rejected` 记录、没有目标文件、没有拒绝后的工具调用。若拒绝项实际被允许，保留原产物和事件，将该项记为失败；先核权限与操作，再说明需要的补测，不偷偷重试或删产物伪造结果。
4. 刷新实际桌面页面，检查会话和设置仍在；通过“应用→退出”或托盘退出，核对本次所属 Electron 与 Host 真正结束，再用同一入口打开，检查登录/模型设置和原历史。
5. 右上角关闭可能只是隐藏窗口，不算退出。若原生选目录、登录或审批无法由当前工具合法操作，请用户仅完成必要操作，继续其他独立验收。

## 7. 回执与异常停止条件

- 逐项给“通过／失败／待用户操作”：源码/依赖/构建、双击桌面、数据隔离、模型工具、允许、拒绝、刷新、完整退出重开及设置历史。附脱敏日志、截图、真实产物或事件；未做的测试直说未做。
- 最终记录提交、实际工具路径/版本、依赖锁 `pnpm-lock.yaml` 与运行时锁 `scripts/primary-runtime/lock.json`、修改清单、启动入口、数据和日志位置、未完成原因与恢复方法。只确认该机固定版本的源码框架可用；不称跨机验证、业务完成或正式发行。
- 达标后保存可恢复基线：入口脚本、版本/锁文件哈希、必要配置差异和验收回执；不打包账号、凭据和私人运行数据。
- 网络、链接、编译或宿主保护失败只做与首错对应的最小处理；需要产品源码修复时先交定位与建议。桌面崩溃先核官方入口和真实日志/转储，不重复同条件实验，不猜参轮试 GPU，不关闭产品沙箱，也不拿别的实例的模型或历史证明本实例通过。
