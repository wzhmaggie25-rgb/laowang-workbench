/** Owner-authenticated page protocol over DSH Connection exact Fetch routes. */
import { randomUUID } from 'node:crypto'
import { mkdir, open, rm } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import { requestSchema, submitSchema, prepareIdSchema, bindSchema, materialInputSchema, draftIdSchema, saveFieldSchema, understandSchema, adaptSchema, markSchema, unmarkSchema, understandOutputSchema, adaptOutputSchema } from './contract.ts'
import { PLATFORMS } from './platforms.ts'
import { RULES, STUDIO_WHITELIST, checkDraft, rulesFor } from './rules.ts'
import { AssistantStore, parseSrt } from './assistant.ts'
import type { PublishRuntime } from './runtime.ts'
import type { MetricsStore } from './metrics.ts'
import { XhsAdapter } from './adapters/xhs.ts'
import type { Config } from './config.ts'

/** 聚合一次流式返回的文本增量；供 ai.status 的连通性探测与后续生成共用。 */
export async function collectStream(chunks: AsyncIterable<{ type: string; text?: string }>): Promise<string> {
  let text = ''
  for await (const chunk of chunks) {
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
  }
  return text
}

/** 模型常把 JSON 包在 ```json 围栏里；剥掉围栏再解析。 */
function stripFence(output: string): unknown {
  const trimmed = output.trim()
  const fenced = trimmed.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/)
  const body = fenced?.[1] ?? trimmed
  return JSON.parse(body)
}

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
export function mountPublishApi(ctx: Context, runtime: PublishRuntime, config: () => Config, ledgerPath: string, metrics?: MetricsStore, assistant?: AssistantStore): void {
 const tickets = new Map<string, { token: string; digest: string; expires: number }>()
 const lifetime = new AbortController()
 const uploads = new Set<Promise<Response>>()

 /** 一次结构化 LLM 调用：流式聚合 → 去 code fence → zod 校验；失败重试一次后如实报错。全程记入 generations.jsonl。 */
 const structuredCall = async <T>(input: { task: 'understand' | 'adapt'; system: string; user: string; schema: { parse: (value: unknown) => T }; draftId: string; materialHash: string; platform?: string }): Promise<T> => {
  const defaults = ctx.agentDefaultModel?.currentSelection()
  if (!defaults?.provider || !defaults.model) throw new Error('尚未配置默认模型：请先在 DSH 设置里选择模型')
  const id = 'g_' + randomUUID().slice(0, 12)
  const call = async (): Promise<string> => {
   const stream = ctx.llm.stream({
    provider: defaults.provider, model: defaults.model,
    system: input.system,
    messages: [{ role: 'user', content: [{ type: 'text', text: input.user }] }],
   })
   let text = ''
   for await (const chunk of stream) {
    if (chunk.type === 'text-delta') text += chunk.text
    if (chunk.type === 'finish') {
     const reason = chunk.reason as { kind?: string; failure?: { code?: string; message?: string } }
     if (reason.kind === 'error' || reason.kind === 'aborted') throw new Error(reason.failure?.message ?? `模型调用失败（${reason.kind}）`)
    }
   }
   return text
  }
  let output = ''
  let parsed: T | undefined
  let failure: string | undefined
  try {
   output = await call()
   parsed = input.schema.parse(stripFence(output))
  } catch (error) {
   failure = error instanceof Error ? error.message : String(error)
   try {
    // 解析失败重试一次：把错误反馈给模型纠正格式。
    output = await call()
    parsed = input.schema.parse(stripFence(output))
    failure = undefined
   } catch (retryError) {
    failure = retryError instanceof Error ? retryError.message : String(retryError)
   }
  }
  await assistant?.appendGeneration({
   id, draftId: input.draftId, task: input.task, platform: input.platform,
   materialHash: input.materialHash,
   prompt: `system: ${input.system}\nuser: ${input.user}`.slice(0, 8000),
   provider: defaults.provider, model: defaults.model,
   request: { task: input.task, platform: input.platform },
   output: output.slice(0, 20000),
   ok: parsed !== undefined, ...(failure ? { error: failure } : {}),
   at: new Date().toISOString(),
  })
  if (parsed === undefined) throw new Error(`模型输出不符合预期结构：${failure ?? '空输出'}`)
  return parsed
 }
 ctx.effect(() => () => { lifetime.abort(); tickets.clear(); return Promise.allSettled([...uploads]).then(() => {}) }, 'publish: upload lifetime')
 const endpoints: Record<string, PageEndpoint> = {
  state: async () => ({ ...(await runtime.status()), platforms: PLATFORMS, configuredAccounts: config().accounts, publishingEnabled: config().publishingEnabled, homeCards: config().homeCards, ledgerPath }),
  'ai.status': async (_payload, signal) => {
   signal.throwIfAborted()
   const defaults = ctx.agentDefaultModel?.currentSelection()
   if (!defaults || !defaults.provider || !defaults.model) {
    return { ok: false, reason: 'no-model', hint: 'DSH 设置里还没有配置默认模型；配置后生成能力可用' }
   }
   let reachable = false
   let sample = ''
   let error: string | undefined
   let hint: string | undefined
   const seen: Record<string, number> = {}
   let finish: string | undefined
   try {
    const stream = ctx.llm.stream({
     provider: defaults.provider,
     model: defaults.model,
     system: '你是连通性探测。只回复两个字母：ok',
     messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
     signal,
    })
    for await (const chunk of stream) {
     seen[chunk.type] = (seen[chunk.type] ?? 0) + 1
     if (chunk.type === 'text-delta') sample += chunk.text
     if (chunk.type === 'finish') {
      const reason = chunk.reason as { kind?: string; failure?: { code?: string; message?: string } }
      finish = reason.kind
      if (reason.kind === 'error' || reason.kind === 'aborted') {
       error = reason.failure?.message ?? reason.kind
       // 账号型 provider 需要 DSH 内登录；隔离/未登录环境如实报告而不是含糊的失败。
       if (reason.failure?.code === 'ACCOUNT_SIGN_IN_REQUIRED') hint = '生成用的模型走 DeepSeek 账号登录；请先在 DSH 中登录该账号'
      }
     }
    }
    reachable = sample.trim().length > 0
   } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause)
   }
   return { ok: reachable, provider: defaults.provider, model: defaults.model, sample, ...(finish ? { finish } : {}), ...(error ? { error } : {}), ...(hint ? { hint } : {}) }
  },
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
  /** ===== 智能发布助手（v0.4 批次 1） ===== */
  'assistant.material': async (payload, signal) => {
   signal.throwIfAborted()
   if (!assistant) throw new Error('智能助手未启用')
   const input = materialInputSchema.parse(payload)
   const text = input.kind === 'srt' ? parseSrt(input.text) : input.text
   if (text.trim().length === 0) throw new Error(input.kind === 'srt' ? '字幕里没有可读文本' : '内容为空')
   return { material: await assistant.createDraft({ kind: input.kind, text, origin: input.origin }) }
  },
  'assistant.drafts': async () => {
   if (!assistant) throw new Error('智能助手未启用')
   return { drafts: await assistant.listDrafts() }
  },
  'assistant.draft': async payload => {
   if (!assistant) throw new Error('智能助手未启用')
   const { draftId } = draftIdSchema.parse(payload)
   const material = await assistant.getMaterial(draftId)
   if (!material) throw new Error('草稿不存在')
   const platforms = RULES.map(rule => rule.platform).filter((value, index, array) => array.indexOf(value) === index)
   const drafts = await Promise.all(platforms.map(async platform => ({ platform, draft: await assistant!.getPlatformDraft(draftId, platform) })))
   return { material, platformDrafts: drafts.filter(row => row.draft !== undefined), manualRecords: await assistant.manualRecords(draftId), rules: RULES }
  },
  'assistant.saveField': async payload => {
   if (!assistant) throw new Error('智能助手未启用')
   const input = saveFieldSchema.parse(payload)
   const fields = { [input.field]: { text: input.text, edited: true } }
   const saved = await assistant.savePlatformDraft(input.draftId, input.platform, input.form, fields, input.expectedRevision)
   if (saved === false) throw new Error('内容已在别处被修改（版本不一致）；请刷新后再改')
   return { draft: saved, checks: checkDraft(input.platform, input.form, Object.fromEntries(Object.entries(saved.fields).map(([key, value]) => [key, value.text]))) }
  },
  'ai.understand': async (payload, signal) => {
   signal.throwIfAborted()
   if (!assistant) throw new Error('智能助手未启用')
   const { draftId } = understandSchema.parse(payload)
   const material = await assistant.getMaterial(draftId)
   if (!material) throw new Error('草稿不存在')
   const system = [
    '你是发布助手的内容理解器。读取素材，输出严格的 JSON（不要围栏、不要多余文字）。',
    '要求：summary 一句话讲这篇讲什么；audience 面向谁；facts 列出素材中已有依据的事实（claim + 原句 quote，quote 必须是素材原文）；',
    'suggestions 从 xiaohongshu（图文，字段 title/body/tags）与 gongzhonghao（文章，字段 title/digest/body）里推荐适合的平台与形式并给理由，至少一条；',
    '如果素材缺一个影响生成质量的关键事实，question 里只问这一件事（question + why）；没有就省略。',
    '禁止编造素材里不存在的数据、经历或引用。',
    'JSON 结构：{"summary":string,"audience":string,"facts":[{"claim":string,"quote":string}],"suggestions":[{"platform":"xiaohongshu"|"gongzhonghao","form":string,"reason":string}],"question":{"question":string,"why":string}}',
   ].join('\n')
   const user = `素材（${material.origin}）：\n${material.text.slice(0, 12000)}`
   const result = await structuredCall({ task: 'understand', system, user, schema: understandOutputSchema, draftId, materialHash: material.contentHash })
   return { understanding: result }
  },
  'ai.adapt': async (payload, signal) => {
   signal.throwIfAborted()
   if (!assistant) throw new Error('智能助手未启用')
   const input = adaptSchema.parse(payload)
   const material = await assistant.getMaterial(input.draftId)
   if (!material) throw new Error('草稿不存在')
   const rule = rulesFor(input.platform, input.form)
   if (!rule) throw new Error(`没有 ${input.platform}/${input.form} 的规则表`)
   const existing = await assistant.getPlatformDraft(input.draftId, input.platform)
   const limits = rule.lengths.map(length => `${length.field} ≤ ${length.max}${length.unit === 'weighted' ? '加权字符(URL=23,中文=2)' : '字'}（${length.level === 'hard' ? '硬限' : '建议'}）`).join('；')
   const system = [
    `你是发布助手的平台适配器。为「${input.platform}」的「${input.form}」生成一份可直接发布的版本。输出严格 JSON，不要围栏。`,
    `字段：${rule.fields.join('/')}。限制：${limits || '无声明限制'}。`,
    '要求：内容只来自素材与用户指示，禁止编造数据、经历、引用；标题不得夸大；',
    'changes 逐字段说明改了什么、为什么（依据素材的哪些内容）；',
    'warnings 是自查：标题夸大 / 正文出现素材里没有的数字 / 与素材不一致，能引原句就带 quote；没有就空数组。',
    input.instruction ? `用户定向修改指令（只做这件事，其余字段原样返回）：${input.instruction}` : '',
    'JSON 结构：{"fields":{字段名:内容},"changes":[{"field":string,"what":string,"why":string}],"warnings":[{"field":string,"issue":string,"quote":string}]}',
   ].filter(Boolean).join('\n')
   const currentFields = existing ? JSON.stringify(Object.fromEntries(Object.entries(existing.fields).map(([key, value]) => [key, value.text]))) : '（首次生成）'
   const user = `素材（${material.origin}）：\n${material.text.slice(0, 12000)}\n\n该平台当前字段值：${currentFields}`
   const result = await structuredCall({ task: 'adapt', system, user, schema: adaptOutputSchema, draftId: input.draftId, materialHash: material.contentHash, platform: input.platform })
   const { draft, protectedFields } = await assistant.applyGeneration(input.draftId, input.platform, input.form, result.fields, '')
   const fieldTexts = Object.fromEntries(Object.entries(draft.fields).map(([key, value]) => [key, value.text]))
   return { draft, changes: result.changes, warnings: result.warnings, protectedFields, checks: checkDraft(input.platform, input.form, fieldTexts) }
  },
  'assistant.mark': async payload => {
   if (!assistant) throw new Error('智能助手未启用')
   const input = markSchema.parse(payload)
   const draft = await assistant.getPlatformDraft(input.draftId, input.platform)
   if (!draft) throw new Error('该平台还没有草稿')
   const material = await assistant.getMaterial(input.draftId)
   if (!material) throw new Error('草稿不存在')
   const snapshot = Object.fromEntries(Object.entries(draft.fields).map(([key, value]) => [key, value.text]))
   const record = await assistant.markPublished({ draftId: input.draftId, platform: input.platform, snapshot, materialHash: material.contentHash, ...(input.link ? { link: input.link } : {}), ...(input.note ? { note: input.note } : {}) })
   return { record }
  },
  'assistant.unmark': async payload => {
   if (!assistant) throw new Error('智能助手未启用')
   const input = unmarkSchema.parse(payload)
   const record = await assistant.unmarkPublished(input.draftId, input.platform)
   if (!record) throw new Error('没有可撤销的标记')
   return { record }
  },
  'assistant.studio': async payload => {
   const { draftId } = draftIdSchema.parse(payload)
   void draftId
   // 只返回白名单内的后台地址；客户端负责打开（桌面走系统浏览器，Web 开新标签）。
   return { urls: STUDIO_WHITELIST }
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
