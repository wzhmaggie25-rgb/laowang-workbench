import { homedir } from 'node:os'
import { join } from 'node:path'
import { stat } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { XhsAdapter } from './adapters/xhs'
import { SauAdapter } from './adapters/sau'
import { Ledger } from './ledger'
import { digestRequest, hashFile, idempotencyKey } from './digest'
import { platformById, type PlatformSpec } from './platforms'
import { POLICY, SAU, XHS } from './defaults'
import type { ContentKind, LedgerEntry, PrepareResult, PublishRequest, PublishStatus } from './types'

export const name = 'publish'
// jobs / approval 是 web profile 内置服务；inject 声明后才能在 apply 里访问。
// 发布必须走后台任务（上传耗时长，同步会超时）与人工门禁，因此两者都是必需依赖。
export const inject = ['tools', 'jobs', 'approval']

export interface AccountConfig {
  platform: string
  name: string
}

export interface Config {
  accounts: AccountConfig[]
  xhsBaseUrl: string
  xhsToken?: string
  sauBin: string
  sauCwd?: string
  ledgerPath?: string
  requireApproval: boolean
  approvalTimeoutSec: number
  dailyLimit: number
  allowedPlatforms: string[]
  allowedAccounts: string[]
  /** 显式要求有头浏览器；默认 false，沿用上游 headless 默认。 */
  headed: boolean
  httpTimeoutMs: number
  publishTimeoutMs: number
}

export const Config: Schema<Config> = Schema.object({
  accounts: Schema.array(Schema.object({
    platform: Schema.string().required(),
    name: Schema.string().required(),
  })).default([]),
  xhsBaseUrl: Schema.string().default(XHS.baseUrl),
  xhsToken: Schema.string(),
  sauBin: Schema.string().default(SAU.bin),
  sauCwd: Schema.string(),
  ledgerPath: Schema.string(),
  requireApproval: Schema.boolean().default(POLICY.requireApproval),
  approvalTimeoutSec: Schema.number().default(POLICY.approvalTimeoutSec),
  dailyLimit: Schema.number().default(POLICY.dailyLimit),
  allowedPlatforms: Schema.array(Schema.string()).default([]),
  allowedAccounts: Schema.array(Schema.string()).default([]),
  headed: Schema.boolean().default(false),
  httpTimeoutMs: Schema.number().default(180_000),
  publishTimeoutMs: Schema.number().default(900_000),
})

/** 只依赖文档化的服务形状，不 import 内部类型，pre-stable 升级面更小。 */
interface JobsLike {
  start(spec: {
    kind: string
    label: string
    owner?: string
    run: (job: unknown) => {
      done: Promise<{ status: 'completed' | 'killed' | 'failed'; detail?: string; result?: string }>
      cancel(reason?: string): void
    }
  }): string
}

type ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

interface ApprovalLike {
  request(req: {
    agent: unknown
    toolName: string
    callId?: string
    reason?: string
    signal?: AbortSignal
  }): Promise<ApprovalOutcome>
}

export function apply(ctx: Context, config: Config): void {
  const ledgerPath = config.ledgerPath ?? join(homedir(), '.dsh', 'publish', 'ledger.json')
  const ledger = new Ledger(ledgerPath)
  const xhs = new XhsAdapter({
    baseUrl: config.xhsBaseUrl,
    timeoutMs: config.httpTimeoutMs,
    ...(config.xhsToken === undefined ? {} : { token: config.xhsToken }),
  })
  const sau = new SauAdapter({
    bin: config.sauBin,
    timeoutMs: config.publishTimeoutMs,
    ...(config.sauCwd === undefined ? {} : { cwd: config.sauCwd }),
  })
  const jobs = (ctx as unknown as { jobs?: JobsLike }).jobs
  const approval = (ctx as unknown as { approval?: ApprovalLike }).approval

  void ledger.reconcileOnStart()

  ctx.tools.register(defineTool({
    name: 'publish_accounts',
    description: '列出已配置的发布账号，并可查上游登录态。只读，不会发布。',
    parameters: {
      platform: { type: 'string', description: '只查某个平台，省略则全部' },
    },
    timeoutMs: 60_000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          accounts: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                platform: { type: 'string', required: true },
                account: { type: 'string', required: true },
                adapter: { type: 'string', required: true },
                status: { type: 'string', required: true },
                detail: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const rows = config.accounts
        .filter(item => args.platform === undefined || item.platform === args.platform)
        .map(item => ({ ...item, spec: platformById(item.platform) }))
      const accounts = []
      for (const row of rows) {
        const spec = row.spec
        if (!spec) {
          accounts.push({ platform: row.platform, account: row.name, adapter: 'unknown', status: 'unknown', detail: '平台未登记' })
          continue
        }
        if (spec.adapter === 'xhs') {
          const status = await xhs.loginStatus()
          accounts.push({
            platform: row.platform,
            account: row.name,
            adapter: spec.adapter,
            status: status.loggedIn ? 'valid' : 'invalid',
            detail: status.detail,
          })
        } else {
          const state = spec.sauName ? await sau.check(spec.sauName, row.name) : 'unknown'
          accounts.push({
            platform: row.platform,
            account: row.name,
            adapter: spec.adapter,
            status: state,
            detail: state === 'valid' ? 'cookie 可用' : state === 'invalid' ? 'cookie 失效，需重新 login' : '无法判定',
          })
        }
      }
      return { accounts }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'publish_prepare',
    description: '发布预检：校验平台能力、标题长度、媒体文件、配额与定时窗口，返回 prepareId 与内容摘要。不发布。',
    parameters: {
      platform: { type: 'string', required: true, description: '平台 id，如 xiaohongshu / douyin' },
      account: { type: 'string', required: true, description: '账号名（sau 的 --account）' },
      kind: { type: 'string', required: true, description: 'video | note | article' },
      title: { type: 'string', required: true, description: '标题' },
      body: { type: 'string', description: '正文/简介' },
      tags: { type: 'array', items: { type: 'string' }, description: '话题标签' },
      media: { type: 'array', items: { type: 'string' }, required: true, description: '本地绝对路径' },
      scheduleAt: { type: 'string', description: '定时时间；省略=立即发布（上游默认）' },
      visibility: { type: 'string', description: '小红书可见范围；省略=公开可见（上游默认）' },
      isOriginal: { type: 'boolean', description: '小红书图文原创声明；省略=不声明（上游默认）' },
    },
    timeoutMs: 120_000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          prepareId: { type: 'string', required: true },
          digest: { type: 'string', required: true },
          key: { type: 'string', required: true },
          platform: { type: 'string', required: true },
          account: { type: 'string', required: true },
          kind: { type: 'string', required: true },
          title: { type: 'string', required: true },
          mediaCount: { type: 'number', required: true },
          scheduleAt: { type: 'string' },
          deviations: { type: 'array', items: { type: 'string' }, required: true },
          warnings: { type: 'array', items: { type: 'string' }, required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const request: PublishRequest = {
        platform: args.platform,
        account: args.account,
        kind: args.kind as ContentKind,
        title: args.title,
        media: args.media,
        ...(args.body === undefined ? {} : { body: args.body }),
        ...(args.tags === undefined ? {} : { tags: args.tags }),
        ...(args.scheduleAt === undefined ? {} : { scheduleAt: args.scheduleAt }),
        ...(args.visibility === undefined ? {} : { visibility: args.visibility }),
        ...(args.isOriginal === undefined ? {} : { isOriginal: args.isOriginal }),
      }
      const checked = await validate(request, config, ledger)
      const hashes: string[] = []
      for (const file of request.media) hashes.push((await hashFile(file)).hash)
      const digest = digestRequest(request, hashes)
      const key = idempotencyKey(request.platform, request.account, digest)
      const existing = await ledger.get(key)
      if (existing) {
        return toPrepare(existing)
      }
      const prepareId = `prep_${exec.callId}`
      const now = new Date().toISOString()
      const entry: LedgerEntry = {
        key,
        prepareId,
        digest,
        request,
        status: 'prepared',
        createdAt: now,
        updatedAt: now,
        deviations: checked.deviations,
      }
      await ledger.insert(entry)
      return { ...toPrepare(entry), warnings: checked.warnings }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'publish_submit',
    description: '按 prepareId 提交发布。必须先在当前会话过人工确认；同一内容重复提交不会重发。',
    parameters: {
      prepareId: { type: 'string', required: true, description: 'publish_prepare 返回的 id' },
    },
    timeoutMs: 60_000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          accepted: { type: 'boolean', required: true },
          status: { type: 'string', required: true },
          key: { type: 'string', required: true },
          jobId: { type: 'string' },
          detail: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const agent = exec.agent
      if (!agent) throw new Error('发布只能在会话内执行')
      const entry = await ledger.byPrepare(args.prepareId)
      if (!entry) throw new Error(`没有这个 prepareId：${args.prepareId}`)
      if (entry.status !== 'prepared') {
        return { accepted: false, status: entry.status, key: entry.key, detail: '该内容已提交过，不重复发布' }
      }
      const spec = platformById(entry.request.platform)
      if (!spec) throw new Error(`平台未登记：${entry.request.platform}`)

      // 批的是什么就发什么：重算摘要，内容变了直接拒。
      const hashes: string[] = []
      for (const file of entry.request.media) hashes.push((await hashFile(file)).hash)
      if (digestRequest(entry.request, hashes) !== entry.digest) {
        throw new Error('内容或媒体在准备之后发生了变化，请重新 prepare')
      }

      if (config.requireApproval) {
        if (!approval) throw new Error('审批服务不可用：按 fail-closed 拒绝发布')
        const outcome = await approval.request({
          agent,
          toolName: 'publish_submit',
          callId: exec.callId,
          reason: `发布 ${entry.request.platform}/${entry.request.account}：${entry.request.title}（摘要 ${entry.digest.slice(0, 12)}）`,
          signal: AbortSignal.timeout(config.approvalTimeoutSec * 1000),
        })
        if (outcome !== 'allowed-once') {
          return { accepted: false, status: entry.status, key: entry.key, detail: `人工确认未通过：${outcome}` }
        }
      }

      await ledger.update(entry.key, { status: 'submitting' })
      const publish = () => executePublish(entry, spec, xhs, sau, config, ledger)
      const label = `${entry.request.platform}/${entry.request.account} ${entry.request.title}`

      if (jobs) {
        const jobId = jobs.start({
          kind: 'publish',
          label,
          owner: agent.id,
          run: () => {
            const done = publish().then(result => ({
              status: result.status === 'failed' ? 'failed' as const : 'completed' as const,
              detail: result.detail,
              result: JSON.stringify(result),
            }))
            return {
              done,
              // 取消只停我们这一侧；上游可能已经点过发布，所以不能当失败处理。
              cancel: () => {
                void ledger.update(entry.key, {
                  status: 'unknown',
                  note: '任务被取消：提交结果未确认，先核对平台原记录，禁止直接重发',
                })
              },
            }
          },
        })
        await ledger.update(entry.key, { jobId })
        return { accepted: true, status: 'submitting', key: entry.key, jobId }
      }

      const result = await publish()
      return { accepted: result.ok, status: result.status, key: entry.key, detail: result.detail }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'publish_status',
    description: '查发布台账：按 prepareId 查一条，或列最近若干条。unknown 表示必须先人工核对，不要重发。',
    parameters: {
      prepareId: { type: 'string', description: '只看这一条' },
      limit: { type: 'number', description: '列表条数，默认 10' },
    },
    timeoutMs: 30_000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          entries: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                prepareId: { type: 'string', required: true },
                platform: { type: 'string', required: true },
                account: { type: 'string', required: true },
                title: { type: 'string', required: true },
                status: { type: 'string', required: true },
                updatedAt: { type: 'string', required: true },
                detail: { type: 'string' },
                note: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const rows = args.prepareId === undefined
        ? await ledger.list(args.limit ?? 10)
        : [await ledger.byPrepare(args.prepareId)].filter((row): row is LedgerEntry => row !== undefined)
      return {
        entries: rows.map(row => ({
          prepareId: row.prepareId,
          platform: row.request.platform,
          account: row.request.account,
          title: row.request.title,
          status: row.status,
          updatedAt: row.updatedAt,
          ...(row.detail === undefined ? {} : { detail: row.detail }),
          ...(row.note === undefined ? {} : { note: row.note }),
        })),
      }
    },
  }))
}

function toPrepare(entry: LedgerEntry): PrepareResult {
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
    const today = new Date().toISOString().slice(0, 10)
    const count = (await ledger.list(200)).filter(entry =>
      entry.createdAt.startsWith(today)
      && ['submitting', 'published', 'scheduled', 'processing'].includes(entry.status)).length
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
      })
      const status: PublishStatus = result.ok
        ? entry.request.scheduleAt === undefined ? 'published' : 'scheduled'
        : 'failed'
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
    })
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
    await ledger.update(entry.key, { status: 'failed', detail })
    return { ok: false, status: 'failed', detail }
  }
}
