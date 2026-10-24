/** Owner-authenticated page protocol over DSH Connection exact Fetch routes. */
import { randomUUID } from 'node:crypto'
import { mkdir, open, rm } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { requestSchema, submitSchema, prepareIdSchema, bindSchema } from './contract.ts'
import { PLATFORMS } from './platforms.ts'
import type { PublishRuntime } from './runtime.ts'
import type { MetricsStore } from './metrics.ts'
import { XhsAdapter } from './adapters/xhs.ts'
import type { Config } from './config.ts'

/** One page-RPC endpoint: buffered JSON in, one JSON envelope out. */
type PageEndpoint = (payload: unknown, signal: AbortSignal) => Promise<unknown>

interface PageEnvelope {
  ok: boolean
  value?: unknown
  error?: { code: string; message: string; details: Record<string, never> }
}

/**
 * Register page endpoints on the shared /api carrier as exact Fetch routes.
 * Exact routes compose with the Gateway (which owns the only /api interceptor)
 * and the shared-channel composer admits only the owner principal, so no
 * endpoint accepts an unauthenticated or non-owner caller.
 */
export function mountPublishApi(ctx: Context, runtime: PublishRuntime, config: () => Config, ledgerPath: string, metrics?: MetricsStore): void {
 const tickets = new Map<string, { token: string; digest: string; expires: number }>()
 const lifetime = new AbortController()
 const uploads = new Set<Promise<Response>>()
 ctx.effect(() => () => { lifetime.abort(); tickets.clear(); return Promise.allSettled([...uploads]).then(() => {}) }, 'publish: upload lifetime')
 const endpoints: Record<string, PageEndpoint> = {
  state: async () => ({ ...(await runtime.status()), platforms: PLATFORMS, configuredAccounts: config().accounts, publishingEnabled: config().publishingEnabled, homeCards: config().homeCards, ledgerPath }),
  accounts: async () => runtime.accounts(),
  prepare: async (payload, signal) => {
   signal.throwIfAborted()
   const request = requestSchema.parse(payload)
   const plan = await runtime.prepare(request)
   if ((await runtime.ledger.byPrepare(plan.prepareId))?.status !== 'prepared') throw new Error('已有相同内容的提交记录，请先查看任务')
   const token = randomUUID(), expires = Date.now() + config().approvalTimeoutSec * 1000
   for (const [key, ticket] of tickets) if (ticket.expires < Date.now()) tickets.delete(key)
   tickets.set(plan.prepareId, { token, digest: plan.digest, expires })
   return { plan, request, token, expiresAt: expires }
  },
  submit: async (payload, signal) => {
   signal.throwIfAborted()
   const input = submitSchema.parse(payload), ticket = tickets.get(input.prepareId)
   const entry = await runtime.ledger.byPrepare(input.prepareId)
   if (!ticket || ticket.token !== input.token || ticket.expires < Date.now() || ticket.digest !== entry?.digest) throw new Error('确认已失效，请重新预检')
   tickets.delete(input.prepareId)
   return runtime.submit(input.prepareId, { signal, source: 'page', approve: async () => true })
  },
  'metrics.list': async () => {
   if (!metrics) throw new Error('数据回采未启用')
   return { metrics: await metrics.all() }
  },
  'metrics.refresh': async (_payload, signal) => {
   signal.throwIfAborted()
   if (!metrics) throw new Error('数据回采未启用')
   const xhs = new XhsAdapter({ baseUrl: config().xhsBaseUrl, timeoutMs: config().httpTimeoutMs, token: config().xhsToken })
   const bound = Object.entries(await metrics.all())
   const failures: string[] = []
   for (const [key, note] of bound) {
    const detail = await xhs.noteDetail(note.noteRef.noteId, note.noteRef.xsecToken)
    if (detail.ok && detail.stats) await metrics.pushSnapshot(key, detail.stats)
    else failures.push(`${note.noteRef.title}：${detail.detail}`)
   }
   return { metrics: await metrics.all(), failures }
  },
  'notes.list': async (_payload, signal) => {
   signal.throwIfAborted()
   const xhs = new XhsAdapter({ baseUrl: config().xhsBaseUrl, timeoutMs: config().httpTimeoutMs, token: config().xhsToken })
   const listed = await xhs.userNotes()
   if (!listed.ok) throw new Error(listed.detail)
   return { notes: listed.notes.map(note => ({ noteId: note.noteId, title: note.title, type: note.type })) }
  },
  'metrics.bind': async (payload, signal) => {
   signal.throwIfAborted()
   if (!metrics) throw new Error('数据回采未启用')
   const input = bindSchema.parse(payload)
   const entry = await runtime.ledger.byPrepare(input.prepareId)
   if (!entry) throw new Error('没有这条发布记录')
   const xhs = new XhsAdapter({ baseUrl: config().xhsBaseUrl, timeoutMs: config().httpTimeoutMs, token: config().xhsToken })
   const listed = await xhs.userNotes()
   if (!listed.ok) throw new Error(listed.detail)
   const note = listed.notes.find(candidate => candidate.noteId === input.noteId)
   if (!note) throw new Error('该账号笔记列表里没有这篇笔记，请刷新后重试')
   await metrics.bind(entry.key, {
    noteId: note.noteId, xsecToken: note.xsecToken, title: note.title,
    boundAt: new Date().toISOString(), method: 'manual',
   })
   return { key: entry.key }
  },
  'metrics.unbind': async (payload, signal) => {
   signal.throwIfAborted()
   if (!metrics) throw new Error('数据回采未启用')
   const input = prepareIdSchema.parse(payload)
   const entry = await runtime.ledger.byPrepare(input.prepareId)
   if (!entry) throw new Error('没有这条发布记录')
   await metrics.unbind(entry.key)
   return { key: entry.key }
  },
 }
 for (const [endpoint, handle] of Object.entries(endpoints)) {
  ctx.effect(() => ctx.connection.fetch.register({
   path: '/api/publish/' + endpoint,
   methods: ['POST'],
   requestBody: 'buffered',
   fetch: async request => {
    try {
     const payload = await request.json()
     return Response.json({ ok: true, value: await handle(payload, request.signal) } satisfies PageEnvelope)
    } catch (error) {
     return Response.json({ ok: false, error: { code: 'publish/rejected', message: error instanceof Error ? error.message : '发布操作失败', details: {} } } satisfies PageEnvelope)
    }
   },
  }), 'publish: ' + endpoint + ' route')
 }
 ctx.effect(() => ctx.connection.fetch.register({
  path: '/api/publish.media', methods: ['POST'], requestBody: 'streaming',
  fetch: request => {
   const task = upload(request, config().maxMediaBytes, join(dirname(ledgerPath), 'media'), AbortSignal.any([request.signal, lifetime.signal]))
   uploads.add(task); void task.then(() => uploads.delete(task), () => uploads.delete(task)); return task
  },
 }), 'publish: media upload')
}

/** Remove incomplete files and keep each accepted upload at a unique path. */
async function upload(request: Request, limit: number, directory: string, signal: AbortSignal): Promise<Response> {
 let path: string | undefined
 let committed = false
 try {
  if (!request.body) throw new Error('没有收到媒体文件')
  const name = basename(decodeURIComponent(request.headers.get('x-publish-name') ?? 'media')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
  await mkdir(directory, { recursive: true })
  path = join(directory, randomUUID() + '-' + name)
  const file = await open(path, 'wx')
  let size = 0
  try {
   const reader = request.body.getReader()
   try { while (true) {
    signal.throwIfAborted()
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > limit) throw new Error('媒体文件超过设置中的大小上限')
    await file.writeFile(chunk.value)
   } } finally { await reader.cancel(); reader.releaseLock() }
  } finally { await file.close() }
  signal.throwIfAborted(); committed = true
  return Response.json({ path, name, size })
 } catch (error) { return Response.json({ error: error instanceof Error ? error.message : '媒体上传失败' }, { status: 400 }) }
 finally { if (path && !committed) await rm(path, { force: true }) }
}
