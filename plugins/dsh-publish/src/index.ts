/** Model tools and Publish Center share one runtime. */
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type {} from '@deepseek-ai/dsh-user-approval'
import { Config, resolveConfig, type LiveConfig } from './config.ts'
import { requestSchema } from './contract.ts'
import { Ledger } from './ledger.ts'
import { PublishRuntime } from './runtime.ts'
import { MetricsStore } from './metrics.ts'
import { AssistantStore } from './assistant.ts'
import { mountPublishApi } from './api.ts'
export { Config }
export const name = 'publish'
export const inject = ['tools', 'jobs', 'approval']
/** Recover records before admitting tools or page requests. */
export async function apply(ctx: Context, live: LiveConfig & { ledgerPath?: string }): Promise<void> {
 const resolved = () => resolveConfig(live)
 const ledgerPath = resolved().ledgerPath ?? join(resolveDshHome(), 'publish', 'ledger.json')
 const ledger = new Ledger(ledgerPath)
 await ledger.adoptLegacy(join(homedir(), '.dsh', 'publish', 'ledger.json'))
 await ledger.reconcileOnStart()
 const metrics = new MetricsStore(join(dirname(ledgerPath), 'metrics.json'))
 const assistant = new AssistantStore(join(dirname(ledgerPath), 'assistant'))
 const runtime = new PublishRuntime(ctx, ledger, resolved, metrics)
  ctx.jobs.attachController('publish-center')
 ctx.effect(() => () => runtime.dispose(), 'publish: execution lifetime')
 // 页面通道要注册物理路由并调用模型，此 fiber 需同时注入 webServer、llm 与默认模型路由。
 ctx.inject(['connection', 'webServer', 'llm', 'agentDefaultModel'], web => mountPublishApi(web, runtime, resolved, ledgerPath, metrics, assistant))
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
    async execute(args) { return runtime.accounts(args.platform) },
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
    async execute(args, exec) { return runtime.prepare(requestSchema.parse(args), 'prep_' + exec.callId) },
  }))

  ctx.tools.register(defineTool({
    name: 'publish_submit',
    description: '按 prepareId 提交发布。必须先在当前会话过人工确认；同一内容重复提交不会重发。',
    parameters: {
      prepareId: { type: 'string', required: true, description: 'publish_prepare 返回的 id' },
    },
    // 工具预算必须覆盖确认有效期上限（approvalTimeoutSec 最大 3600 秒）加提交开销；
    // 实际等待由 execute 里的 AbortSignal.timeout(approvalTimeoutSec) 收口。
    timeoutMs: 3_660_000,
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
 const current = resolved()
 const signal = AbortSignal.any([exec.signal, AbortSignal.timeout(current.approvalTimeoutSec * 1000)])
 return runtime.submit(args.prepareId, {
 agent, callId: exec.callId, signal, source: 'tool',
 approve: async () => {
 if (!current.requireApproval) return true
 const entry = await ledger.byPrepare(args.prepareId)
 return await ctx.approval.request({ agent, toolName: 'publish_submit', callId: exec.callId, signal,
 reason: JSON.stringify({ ...entry?.request, digest: entry?.digest }) }) === 'allowed-once'
 },
 })
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
 const { entries } = await runtime.status(args.prepareId, args.limit)
 return { entries: entries.map(row => ({ prepareId: row.prepareId, platform: row.request.platform, account: row.request.account,
 title: row.request.title, status: row.status, updatedAt: row.updatedAt,
 ...(row.detail === undefined ? {} : { detail: row.detail }), ...(row.note === undefined ? {} : { note: row.note }) })) }
},
  }))
}
