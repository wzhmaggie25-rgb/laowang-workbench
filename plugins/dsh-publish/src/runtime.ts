/** Shared owner of preparation, approval, execution and task records. */
import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-jobs'
import type {} from '@deepseek-ai/dsh-user-approval'
import { Ledger } from './ledger.ts'
import { hashFile, digestRequest, idempotencyKey } from './digest.ts'
import { platformById, type PlatformSpec } from './platforms.ts'
import { XhsAdapter } from './adapters/xhs.ts'
import { SauAdapter } from './adapters/sau.ts'
import { SAU, XHS } from './defaults.ts'
import type { Config } from './config.ts'
import type { PublishRequest, LedgerEntry, PrepareResult, PublishStatus } from './types.ts'
declare module '@deepseek-ai/dsh-jobs/view' { interface JobKindMap { publish: 'publish' } }

interface SubmitOptions {
  signal: AbortSignal; agent?: Agent; callId?: ToolCallId
  approve: () => Promise<boolean>; source: 'page' | 'tool'
}
/** Resources and task admission live with this plugin instance. */
export class PublishRuntime {
  private readonly claims = new Set<string>()
  private readonly running = new Set<Promise<PublishOutcome>>()
  private readonly accountQueues = new Map<string, Promise<unknown>>()
  private readonly lifetime = new AbortController()
  private admission: Promise<void> = Promise.resolve()
  constructor(private readonly ctx: Context, readonly ledger: Ledger, private readonly config: () => Config) {}
  async accounts(platform?: string) {
    const config = this.config()
    const xhs = new XhsAdapter({ baseUrl: config.xhsBaseUrl, timeoutMs: config.httpTimeoutMs, token: config.xhsToken })
    const sau = new SauAdapter({ bin: config.sauBin, cwd: config.sauCwd, timeoutMs: config.publishTimeoutMs })
    return { accounts: await Promise.all(config.accounts.filter(row => !platform || row.platform === platform).map(async row => {
      const spec = platformById(row.platform)
      if (!spec || spec.blocked) return { platform: row.platform, account: row.name, adapter: spec?.adapter ?? 'unknown', status: 'unknown', detail: spec?.blocked ?? '平台未登记' }
      if (spec.adapter === 'xhs') {
        const state = await xhs.loginStatus()
        return { platform: row.platform, account: row.name, adapter: 'xhs', status: state.loggedIn ? 'valid' : 'invalid', detail: state.detail }
      }
      return { platform: row.platform, account: row.name, adapter: 'sau', status: await sau.check(spec.sauName!, row.name) }
    })) }
  }
  async prepare(request: PublishRequest, prepareId = 'prep_' + randomUUID()): Promise<PrepareResult> {
    this.lifetime.signal.throwIfAborted()
    for (const file of request.media) if (!isAbsolute(file)) throw new Error('媒体文件必须使用本地绝对路径')
    const checked = await validate(request, this.config(), this.ledger)
    const hashes = await Promise.all(request.media.map(async path => (await hashFile(path)).hash))
    const digest = digestRequest(request, hashes)
    const key = idempotencyKey(request.platform, request.account, digest)
    const now = new Date().toISOString()
    const entry = await this.ledger.insert({ key, prepareId, digest, request, status: 'prepared', createdAt: now, updatedAt: now, deviations: checked.deviations })
    return { ...toPrepare(entry), warnings: checked.warnings }
  }
  async submit(prepareId: string, options: SubmitOptions) {
    const signal = AbortSignal.any([options.signal, this.lifetime.signal])
    signal.throwIfAborted()
    const entry = await this.ledger.byPrepare(prepareId)
    if (!entry) throw new Error('没有这个待发记录')
    if (entry.status !== 'prepared' || this.claims.has(entry.key)) return { accepted: false, status: entry.status, key: entry.key, detail: '该任务正在确认或已经提交' }
    this.claims.add(entry.key)
    try {
      const config = this.config()
      const spec = platformById(entry.request.platform)
      await validate(entry.request, config, this.ledger)
      if (!spec) throw new Error('平台未登记')
      if (!(await options.approve())) return { accepted: false, status: entry.status, key: entry.key, detail: '人工确认未通过' }
      signal.throwIfAborted()
      const hashes = await Promise.all(entry.request.media.map(async file => (await hashFile(file)).hash))
      if (digestRequest(entry.request, hashes) !== entry.digest) throw new Error('内容或媒体在确认期间发生变化，请重新预检')
      const admit = this.admission.then(async () => {
        signal.throwIfAborted()
        await validate(entry.request, config, this.ledger)
        await this.ledger.update(entry.key, { status: 'submitting', approvalSource: options.source, submittedAt: new Date().toISOString() })
      })
      this.admission = admit.then(()=>{},()=>{})
      await admit
      const xhs = new XhsAdapter({ baseUrl: config.xhsBaseUrl, timeoutMs: config.httpTimeoutMs, token: config.xhsToken })
      const sau = new SauAdapter({ bin: config.sauBin, cwd: config.sauCwd, timeoutMs: config.publishTimeoutMs })
      const abort = new AbortController()
      const accountKey = entry.request.platform + '/' + entry.request.account
      const prior = this.accountQueues.get(accountKey) ?? Promise.resolve()
      const perform = async (): Promise<PublishOutcome> => {
        await prior.catch(() => { /* A previous target failure does not invalidate this approved request. */ })
        this.lifetime.signal.throwIfAborted()
        abort.signal.throwIfAborted()
        const finalHashes = await Promise.all(entry.request.media.map(async file => (await hashFile(file)).hash))
        if (digestRequest(entry.request, finalHashes) !== entry.digest) throw new Error('排队期间媒体已变化，未提交')
        return executePublish(entry, spec, xhs, sau, config, this.ledger, AbortSignal.any([this.lifetime.signal, abort.signal]))
      }
      let task: Promise<PublishOutcome> | undefined
      try {
        const jobId = this.ctx.jobs.start({
          kind: 'publish', label: accountKey + ' ' + entry.request.title, owner: options.agent?.id,
          run: () => {
            task = perform().catch(async (error: unknown): Promise<PublishOutcome> => {
              const detail = error instanceof Error ? error.message : String(error)
              await this.ledger.update(entry.key, { status: 'unknown', detail })
              return { ok: false, status: 'unknown', detail }
            })
            this.running.add(task)
            this.accountQueues.set(accountKey, task)
            void task.then(() => { this.running.delete(task!); if (this.accountQueues.get(accountKey) === task) this.accountQueues.delete(accountKey) })
            return { done: task.then(result => ({ status: result.ok ? 'completed' as const : 'failed' as const, detail: result.detail, result: JSON.stringify(result) })), cancel: () => { abort.abort() } }
          },
        })
        await this.ledger.update(entry.key, { jobId })
        return { accepted: true, status: 'submitting', key: entry.key, jobId }
      } catch (error) {
        if (!task) await this.ledger.update(entry.key, { status: 'prepared', note: '任务未启动，可重新确认' })
        throw error
      }
    } finally { this.claims.delete(entry.key) }
  }
  async status(prepareId?: string, limit = 50) {
    return { entries: prepareId ? [await this.ledger.byPrepare(prepareId)].filter((row): row is LedgerEntry => row !== undefined) : await this.ledger.list(Math.max(1, Math.min(200, limit))) }
  }
  async dispose(): Promise<void> {
    this.lifetime.abort()
    await Promise.allSettled([...this.running])
  }
}
export function toPrepare(entry: LedgerEntry): PrepareResult {
  return {
    prepareId: entry.prepareId,
    digest: entry.digest,
    key: entry.key,
    platform: entry.request.platform,
    account: entry.request.account,
    kind: entry.request.kind,
    title: entry.request.title,
    mediaCount: entry.request.media.length,
    ...(entry.request.scheduleAt === undefined ? {} : { scheduleAt: entry.request.scheduleAt }),
    deviations: entry.deviations,
    warnings: [],
  }
}

interface Checked {
  warnings: string[]
  deviations: string[]
}

async function validate(request: PublishRequest, config: Config, ledger: Ledger): Promise<Checked> {
  if (!config.publishingEnabled) throw new Error('发布已在设置中停用')
  const spec = platformById(request.platform)
  if (!spec) throw new Error(`平台未登记：${request.platform}`)
  if (spec.blocked) throw new Error(`${request.platform} v0.1 不可用：${spec.blocked}`)
  if (!spec.kinds.includes(request.kind)) throw new Error(`${request.platform} 不支持 ${request.kind}`)

  const account = config.accounts.find(item => item.platform === request.platform && item.name === request.account)
  if (!account) throw new Error(`账号未配置：${request.platform}/${request.account}`)
  if (config.allowedAccounts.length > 0 && !config.allowedAccounts.includes(request.account)) {
    throw new Error(`账号不在白名单：${request.account}`)
  }
  if (config.allowedPlatforms.length > 0 && !config.allowedPlatforms.includes(request.platform)) {
    throw new Error(`平台不在白名单：${request.platform}`)
  }

  const titleLength = [...request.title].length
  if (spec.titleMinChars !== undefined && titleLength < spec.titleMinChars) {
    throw new Error(`${request.platform} 标题至少 ${spec.titleMinChars} 字`)
  }
  if (spec.titleMaxChars !== undefined && titleLength > spec.titleMaxChars) {
    throw new Error(`${request.platform} 标题最多 ${spec.titleMaxChars} 字，当前 ${titleLength}`)
  }

  if (request.media.length === 0) throw new Error('至少要一个媒体文件')
  if (request.kind !== 'note' && request.media.length !== 1) throw new Error(`${request.kind} 只接受一个文件`)
  for (const file of request.media) {
    const info = await stat(file).catch(() => undefined)
    if (!info?.isFile()) throw new Error(`媒体文件不存在：${file}`)
  }

  const deviations: string[] = []
  const warnings: string[] = []

  if (request.scheduleAt !== undefined) {
    if (spec.scheduling === 'none') throw new Error(`${request.platform} 上游未提供定时发布`)
    if (spec.scheduling === 'sau' && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(request.scheduleAt)) {
      throw new Error(`sau 定时格式为 ${SAU.scheduleFormat}`)
    }
    if (spec.scheduling === 'xhs') {
      const when = Date.parse(request.scheduleAt)
      if (Number.isNaN(when)) throw new Error('小红书定时必须是 ISO8601 时间')
      const hours = (when - Date.now()) / 3_600_000
      if (hours < XHS.scheduleMinHours || hours > XHS.scheduleMaxDays * 24) {
        throw new Error(`小红书定时窗口为 ${XHS.scheduleMinHours} 小时到 ${XHS.scheduleMaxDays} 天`)
      }
      deviations.push('显式传了 schedule_at（上游默认立即发布）')
    }
  }
  if (request.visibility !== undefined) deviations.push(`显式可见范围：${request.visibility}（上游默认公开可见）`)
  if (request.isOriginal !== undefined) deviations.push(`显式原创声明：${request.isOriginal}（上游默认不声明）`)
  if (config.headed) deviations.push('有头模式（上游默认 headless）')

  if (spec.adapter === 'xhs' && [...(request.body ?? '')].length > XHS.bodyLimitChars) {
    warnings.push(`小红书正文超过 ${XHS.bodyLimitChars} 字，可能被截断`)
  }
  if (config.dailyLimit > 0) {
   // Transform schemas cannot cross the settings wire, so the time zone is validated here.
   let day:(date:Date)=>string
   try {
    const formatter = new Intl.DateTimeFormat('sv-SE',{timeZone:config.dailyTimeZone,year:'numeric',month:'2-digit',day:'2-digit'})
    day = (date:Date)=>formatter.format(date)
   } catch {
    throw new Error(`每日配额时区无效：${config.dailyTimeZone}`)
   }
   const today = day(new Date())
    const count = (await ledger.list(Number.MAX_SAFE_INTEGER)).filter(entry =>
      day(new Date(entry.submittedAt ?? entry.createdAt)) === today
      && ['submitting', 'submitted', 'published', 'scheduled', 'processing', 'unknown'].includes(entry.status)).length
    if (count >= config.dailyLimit) throw new Error(`已达当日发布上限 ${config.dailyLimit}`)
  }
  return { warnings, deviations }
}

interface PublishOutcome {
  ok: boolean
  status: PublishStatus
  detail: string
}

async function executePublish(
  entry: LedgerEntry,
  spec: PlatformSpec,
  xhs: XhsAdapter,
  sau: SauAdapter,
  config: Config,
  ledger: Ledger,
  signal: AbortSignal,
): Promise<PublishOutcome> {
  try {
    if (spec.adapter === 'xhs') {
      const result = await xhs.publish({
        kind: entry.request.kind === 'video' ? 'video' : 'note',
        title: entry.request.title,
        media: entry.request.media,
        ...(entry.request.body === undefined ? {} : { body: entry.request.body }),
        ...(entry.request.tags === undefined ? {} : { tags: entry.request.tags }),
        ...(entry.request.scheduleAt === undefined ? {} : { scheduleAt: entry.request.scheduleAt }),
        ...(entry.request.visibility === undefined ? {} : { visibility: entry.request.visibility }),
        ...(entry.request.isOriginal === undefined ? {} : { isOriginal: entry.request.isOriginal }),
      }, signal)
      const status: PublishStatus = result.ok
        ? entry.request.scheduleAt === undefined ? 'submitted' : 'scheduled'
        : 'unknown'
      await ledger.update(entry.key, { status, detail: result.detail })
      return { ok: result.ok, status, detail: result.detail }
    }
    if (!spec.sauName) throw new Error('该平台没有 sau 子命令')
    const result = await sau.upload({
      sauName: spec.sauName,
      account: entry.request.account,
      kind: entry.request.kind,
      title: entry.request.title,
      media: entry.request.media,
      headed: config.headed,
      ...(entry.request.body === undefined ? {} : { body: entry.request.body }),
      ...(entry.request.tags === undefined ? {} : { tags: entry.request.tags }),
      ...(entry.request.scheduleAt === undefined ? {} : { scheduleAt: entry.request.scheduleAt }),
    }, signal)
    await ledger.update(entry.key, {
      status: result.status,
      detail: result.detail,
      ...(result.status === 'unknown'
        ? { note: '提交结果未确认，先核对平台原记录，禁止直接重发' }
        : {}),
    })
    return { ok: result.ok, status: result.status, detail: result.detail }
  } catch (error) {
    const detail = (error as Error).message
    await ledger.update(entry.key, { status: 'unknown', detail, note: '提交结果未确认，请先核对平台记录' })
    return { ok: false, status: 'unknown', detail }
  }
}
