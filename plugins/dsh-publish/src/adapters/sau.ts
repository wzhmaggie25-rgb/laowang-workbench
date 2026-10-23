import { spawn } from 'node:child_process'
import type { ContentKind } from '../types'

export interface SauOptions {
  /** 默认 `sau`（uv pip install -e . 后注册）。 */
  bin: string
  /** social-auto-upload 仓库根目录；上游假设根目录就是工作目录。 */
  cwd?: string
  timeoutMs: number
}

export interface SauUploadInput {
  sauName: string
  account: string
  kind: ContentKind
  title: string
  body?: string
  tags?: string[]
  media: string[]
  /** 格式 YYYY-MM-DD HH:MM；不传 = 立即发布（上游默认）。 */
  scheduleAt?: string
  /** 默认 false：不传 --headed，沿用上游 headless=True 的默认。 */
  headed?: boolean
}

export interface SauUploadResult {
  ok: boolean
  status: 'published' | 'scheduled' | 'unknown' | 'failed'
  detail: string
  stdoutTail: string
}

interface RunResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

const MAX_CAPTURE = 20_000

function run(bin: string, args: readonly string[], options: SauOptions): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, [...args], {
      cwd: options.cwd ?? process.cwd(),
      shell: false,
      windowsHide: true,
      env: process.env,
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, options.timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_CAPTURE) stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_CAPTURE) stderr += chunk.toString('utf8')
    })
    child.on('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', code => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}

/**
 * social-auto-upload 的 sau CLI 封装。
 * 契约来自 skills/<platform>-upload/references/cli-contract.md：
 * - `check` 输出 `valid` / `invalid`
 * - `upload-*` 不传 `--schedule` 即立即发布
 * - 不传 `--headless/--headed` 时上游默认 headless
 *
 * 上游没有 `--json`，也没有退出码文档，所以这里只做保守判定：
 * 退出码非 0 = failed；退出码 0 但拿不到成功证据 = unknown（禁止重发，先人工核）。
 */
export class SauAdapter {
  constructor(private readonly options: SauOptions) {}

  private base(sauName: string, sub: string, account: string): string[] {
    // 上游形态：sau <平台> <子命令> --account <name>
    return [sauName, sub, '--account', account]
  }

  async check(sauName: string, account: string): Promise<'valid' | 'invalid' | 'unknown'> {
    try {
      const result = await run(this.options.bin, this.base(sauName, 'check', account), this.options)
      const text = `${result.stdout}\n${result.stderr}`.toLowerCase()
      if (result.timedOut) return 'unknown'
      if (/\binvalid\b|失效|未登录|过期/.test(text)) return 'invalid'
      if (/\bvalid\b|有效|已登录/.test(text)) return 'valid'
      return 'unknown'
    } catch {
      return 'unknown'
    }
  }

  async upload(input: SauUploadInput): Promise<SauUploadResult> {
    const args = this.base(input.sauName, subcommand(input.kind), input.account)
    if (input.kind === 'article') {
      args.push('--title', input.title)
      const file = input.media[0]
      if (!file) throw new Error('文章发布需要一个正文文件')
      args.push('--content-file', file)
    } else if (input.kind === 'video') {
      const file = input.media[0]
      if (!file) throw new Error('视频发布需要一个视频文件')
      args.push('--file', file, '--title', input.title)
      if (input.body !== undefined) args.push('--desc', input.body)
    } else {
      args.push('--images', ...input.media, '--title', input.title)
      if (input.body !== undefined) args.push('--note', input.body)
    }
    if (input.tags && input.tags.length > 0) args.push('--tags', input.tags.join(','))
    if (input.scheduleAt !== undefined) args.push('--schedule', input.scheduleAt)
    // 只在显式要求有头时传 --headed；默认一律不传，交给上游 headless 默认。
    if (input.headed === true) args.push('--headed')

    const result = await run(this.options.bin, args, this.options)
    const tail = result.stdout.slice(-2000)
    const joined = `${result.stdout}\n${result.stderr}`

    if (result.timedOut) {
      return { ok: false, status: 'unknown', detail: '命令超时：提交结果未确认，先查平台原记录', stdoutTail: tail }
    }
    if (result.code !== 0) {
      return { ok: false, status: 'failed', detail: `退出码 ${result.code ?? 'null'}：${firstLine(result.stderr) || firstLine(result.stdout) || '无输出'}`, stdoutTail: tail }
    }
    if (input.scheduleAt !== undefined) {
      return { ok: true, status: 'scheduled', detail: '已提交定时发布（上游未提供机器可读回执，按命令成功判定）', stdoutTail: tail }
    }
    if (/成功|发布完成|已发布|published|success/i.test(joined)) {
      return { ok: true, status: 'published', detail: firstLine(result.stdout) || '已发布（按上游输出文本判定）', stdoutTail: tail }
    }
    return { ok: false, status: 'unknown', detail: '命令成功但无可核对的发布证据，先查平台原记录', stdoutTail: tail }
  }
}

function subcommand(kind: ContentKind): string {
  if (kind === 'video') return 'upload-video'
  if (kind === 'note') return 'upload-note'
  return 'upload-article'
}

function firstLine(text: string): string {
  return text.split(/\r?\n/).map(line => line.trim()).find(line => line.length > 0) ?? ''
}
