/**
 * 发布端只读诊断器。不发布、不写台账、不启动任何上游进程。
 *
 * 用法（在 DSH 源码仓库根目录执行）：
 *   tsx <本插件目录>/scripts/doctor.ts
 * 需要时先设环境变量：
 *   PUBLISH_SAU_CWD   social-auto-upload 仓库绝对路径
 *   PUBLISH_SAU_BIN   sau 可执行文件绝对路径（不设则用 $PUBLISH_SAU_CWD/.venv/Scripts/sau.exe）
 *   PUBLISH_XHS_DIR   xiaohongshu-mcp 所在目录
 *   PUBLISH_XHS_BASE_URL  默认 http://127.0.0.1:18060
 * 退出码：0 全绿 / 1 有阻断项 / 2 仅有警告
 */
import { existsSync, accessSync, constants } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { SAU, XHS } from '../src/defaults'

const run = promisify(execFile)

type Level = 'ok' | 'warn' | 'fail'
interface Check {
  name: string
  level: Level
  detail: string
  hint?: string
}

const checks: Check[] = []
const add = (name: string, level: Level, detail: string, hint?: string) =>
  checks.push({ name, level, detail, ...(hint === undefined ? {} : { hint }) })

const XHS_BASE = process.env.PUBLISH_XHS_BASE_URL ?? XHS.baseUrl
const XHS_DIR = process.env.PUBLISH_XHS_DIR ?? ''
const SAU_REPO = process.env.PUBLISH_SAU_CWD ?? ''
const HOME = homedir()
const PATCH = join(HOME, '.dsh', 'profiles', 'web', 'cordis.patch.yml')
const LEDGER_DIR = join(HOME, '.dsh', 'publish')

/** 把「目录 + 文件名」拼成可执行提示；目录没配就退回通用写法。 */
function where(dir: string, file: string, fallback: string): string {
  return dir ? join(dir, file) : fallback
}

async function probeHttp(url: string, timeoutMs = 3000): Promise<{ ok: boolean; detail: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    return { ok: true, detail: `HTTP ${res.status}` }
  } catch (error) {
    const e = error as Error & { cause?: { code?: string } }
    const code = e.cause?.code ?? e.name
    return { ok: false, detail: code === 'ECONNREFUSED' ? '连接被拒（端口无进程）' : `${e.name}: ${e.message}` }
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  // 1. 小红书 MCP
  const xhs = await probeHttp(`${XHS_BASE}${XHS.healthPath}`)
  add(
    'xiaohongshu-mcp 服务',
    xhs.ok ? 'ok' : 'fail',
    `${XHS_BASE} → ${xhs.detail}`,
    xhs.ok ? undefined : `先起服务：${where(XHS_DIR, 'xiaohongshu-mcp.exe', 'xiaohongshu-mcp.exe')}（须先扫码登录）`,
  )
  const cookieFile = join(HOME, '.xiaohongshu', 'cookies.json')
  add(
    '小红书登录态文件',
    existsSync(cookieFile) ? 'ok' : 'fail',
    existsSync(cookieFile) ? cookieFile : '未找到 ~/.xiaohongshu/cookies.json',
    existsSync(cookieFile) ? undefined : `运行 ${where(XHS_DIR, 'xiaohongshu-login.exe', 'xiaohongshu-login.exe')} 扫码登录`,
  )

  // 2. social-auto-upload
  // 优先用仓库内 venv 的绝对路径：sau 未加入 PATH 时，绝对路径同样可用
  // （editable 安装已把仓库根目录挂进 sys.path，所以 conf.py 能跨 cwd 解析）。
  const SAU_BIN =
    process.env.PUBLISH_SAU_BIN ?? (SAU_REPO ? join(SAU_REPO, '.venv', 'Scripts', 'sau.exe') : SAU.bin)
  const sauCmd = existsSync(SAU_BIN) || !SAU_REPO ? SAU_BIN : SAU.bin
  try {
    const out = await run(sauCmd, ['--help'], { timeout: 20000, windowsHide: true })
    const platforms = (out.stdout.match(/\{([a-z-]+(?:,[a-z-]+)+)\}/)?.[1] ?? '').split(',').filter(Boolean)
    add('sau CLI', 'ok', `${sauCmd}，${platforms.length} 个平台子命令`)
  } catch (error) {
    const e = error as Error & { code?: string }
    add(
      'sau CLI',
      'fail',
      e.code === 'ENOENT' ? `命令不存在：${sauCmd}` : e.message,
      '在 social-auto-upload 仓库内：uv venv --python 3.12 && uv pip install -e .',
    )
  }
  add(
    'sau 仓库目录',
    SAU_REPO ? (existsSync(SAU_REPO) ? 'ok' : 'fail') : 'warn',
    SAU_REPO || '未设置 PUBLISH_SAU_CWD',
    SAU_REPO ? 'git clone https://github.com/dreammis/social-auto-upload' : '设置 PUBLISH_SAU_CWD 为仓库绝对路径',
  )

  // 3. 台账可写
  try {
    accessSync(LEDGER_DIR, constants.W_OK)
    add('台账目录', 'ok', LEDGER_DIR)
  } catch {
    add('台账目录', existsSync(LEDGER_DIR) ? 'fail' : 'warn', existsSync(LEDGER_DIR) ? '不可写' : '尚不存在（首次写入时自动创建）')
  }

  // 4. profile patch 是否已合并
  if (existsSync(PATCH)) {
    const { readFileSync } = await import('node:fs')
    const text = readFileSync(PATCH, 'utf8')
    const merged = /(^|\n)\s*-?\s*id:\s*publish\b/.test(text)
    add(
      'profile patch 已挂载插件',
      merged ? 'ok' : 'warn',
      merged ? PATCH : 'patch 里没有 id: publish 条目',
      merged ? undefined : '把 cordis.patch.yml 里的 insert 合并进该文件（不要覆盖已有内容）',
    )
  } else {
    add('profile patch', 'warn', `未找到 ${PATCH}`)
  }

  // 5. 插件模块可加载
  try {
    const mod = (await import('../src/index')) as { name?: string; apply?: unknown; inject?: unknown }
    add('插件模块', typeof mod.apply === 'function' ? 'ok' : 'fail', `name=${mod.name ?? '?'} apply=${typeof mod.apply} inject=${JSON.stringify(mod.inject ?? [])}`)
  } catch (error) {
    add('插件模块', 'fail', (error as Error).message)
  }

  // 输出
  const icon: Record<Level, string> = { ok: 'PASS', warn: 'WARN', fail: 'FAIL' }
  let line = ''
  for (const c of checks) {
    line += `[${icon[c.level]}] ${c.name}: ${c.detail}\n`
    if (c.hint) line += `       → ${c.hint}\n`
  }
  const fails = checks.filter(c => c.level === 'fail').length
  const warns = checks.filter(c => c.level === 'warn').length
  line += `\n合计：${checks.length} 项，FAIL ${fails}，WARN ${warns}`
  console.log(line)
  process.exit(fails > 0 ? 1 : warns > 0 ? 2 : 0)
}

void main()
