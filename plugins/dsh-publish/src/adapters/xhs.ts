import type { ContentKind } from '../types'

export interface XhsOptions {
  /** 默认 http://127.0.0.1:18060（上游默认端口）。 */
  baseUrl: string
  timeoutMs: number
  /** 上游 AUTH_TOKEN 启用时才需要。 */
  token?: string
}

export interface XhsPublishInput {
  kind: Extract<ContentKind, 'video' | 'note'>
  title: string
  body?: string
  tags?: string[]
  /** 本地绝对路径。 */
  media: string[]
  scheduleAt?: string
  visibility?: string
  isOriginal?: boolean
}

export interface XhsPublishResult {
  ok: boolean
  /** 平台原话，原样留证，不翻译不美化。 */
  detail: string
  httpStatus: number
}

export interface XhsUserNote {
  noteId: string
  /** 详情接口必需；来自列表项，过期后需重新绑定。 */
  xsecToken: string
  title: string
  type: string
}

export interface XhsNoteStats {
  likes?: number
  collects?: number
  comments?: number
  shares?: number
}

export interface XhsUserNoteResult {
  ok: boolean
  notes: XhsUserNote[]
  detail: string
}

export interface XhsNoteDetailResult {
  ok: boolean
  stats?: XhsNoteStats
  title?: string
  postedAt?: string
  detail: string
}

/**
 * xiaohongshu-mcp 的 HTTP 接口封装。
 * 文档：docs/API.md（Base URL http://localhost:18060）。
 * 注意：发布接口的响应**不含作品 id 或链接**，只有 "发布完成" 之类的状态文本；
 * 数据回采走 /api/v1/user/me（自己的笔记列表）与 /api/v1/feeds/detail（互动数据）。
 * 上游没有播放量字段，统计只有点赞/收藏/评论/分享。
 */
export class XhsAdapter {
  constructor(private readonly options: XhsOptions) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (this.options.token) headers.authorization = `Bearer ${this.options.token}`
    return headers
  }

  private url(path: string): string {
    return `${this.options.baseUrl.replace(/\/+$/, '')}${path}`
  }

  private async call(path: string, init?: RequestInit, signal?: AbortSignal): Promise<{ status: number; text: string; json?: unknown }> {
    const response = await fetch(this.url(path), {
      ...init,
      headers: { ...this.headers(), ...(init?.headers as Record<string, string> | undefined) },
      signal: AbortSignal.any([AbortSignal.timeout(this.options.timeoutMs), ...(signal ? [signal] : [])]),
    })
    const text = await response.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      json = undefined
    }
    return { status: response.status, text, ...(json === undefined ? {} : { json }) }
  }

  /** 服务在不在，决定「连接失败」和「发布失败」分得清。 */
  async health(): Promise<boolean> {
    try {
      const result = await this.call('/health')
      return result.status >= 200 && result.status < 300
    } catch {
      return false
    }
  }

  async loginStatus(): Promise<{ loggedIn: boolean; detail: string }> {
    try {
      const result = await this.call('/api/v1/login/status')
      const message = extractMessage(result.json) ?? result.text.slice(0, 200)
      const record = typeof result.json === 'object' && result.json !== null ? result.json as Record<string, unknown> : {}
      const data = typeof record.data === 'object' && record.data !== null ? record.data as Record<string, unknown> : {}
      return { loggedIn: result.status < 300 && record.success === true && data.is_logged_in === true, detail: message }
    } catch (error) {
      return { loggedIn: false, detail: `服务不可达：${(error as Error).message}` }
    }
  }

  /** 当前登录用户自己的笔记列表（/api/v1/user/me 的 data.feeds）。 */
  async userNotes(): Promise<XhsUserNoteResult> {
    try {
      const result = await this.call('/api/v1/user/me')
      const record = typeof result.json === 'object' && result.json !== null ? result.json as Record<string, unknown> : {}
      const data = typeof record.data === 'object' && record.data !== null ? record.data as Record<string, unknown> : {}
      const feeds = Array.isArray(data.feeds) ? data.feeds : []
      const notes: XhsUserNote[] = []
      for (const feed of feeds) {
        if (typeof feed !== 'object' || feed === null) continue
        const row = feed as Record<string, unknown>
        const noteId = typeof row.id === 'string' ? row.id : undefined
        const xsecToken = typeof row.xsecToken === 'string' ? row.xsecToken : undefined
        const card = typeof row.noteCard === 'object' && row.noteCard !== null ? row.noteCard as Record<string, unknown> : {}
        const title = typeof card.displayTitle === 'string' ? card.displayTitle : ''
        const type = typeof card.type === 'string' ? card.type : ''
        if (noteId && xsecToken) notes.push({ noteId, xsecToken, title, type })
      }
      if (result.status >= 300 || record.success !== true) {
        return { ok: false, notes: [], detail: extractMessage(result.json) ?? result.text.slice(0, 200) }
      }
      return { ok: true, notes, detail: extractMessage(result.json) ?? 'ok' }
    } catch (error) {
      return { ok: false, notes: [], detail: `服务不可达：${(error as Error).message}` }
    }
  }

  /** 单篇笔记的互动数据（/api/v1/feeds/detail 的 note.interactInfo）。 */
  async noteDetail(noteId: string, xsecToken: string): Promise<XhsNoteDetailResult> {
    try {
      const result = await this.call('/api/v1/feeds/detail', {
        method: 'POST',
        body: JSON.stringify({ feed_id: noteId, xsec_token: xsecToken }),
      })
      const record = typeof result.json === 'object' && result.json !== null ? result.json as Record<string, unknown> : {}
      const data = typeof record.data === 'object' && record.data !== null ? record.data as Record<string, unknown> : {}
      const note = typeof data.note === 'object' && data.note !== null ? data.note as Record<string, unknown> : {}
      const interact = typeof note.interactInfo === 'object' && note.interactInfo !== null ? note.interactInfo as Record<string, unknown> : {}
      if (result.status >= 300 || record.success !== true) {
        return { ok: false, detail: extractMessage(result.json) ?? result.text.slice(0, 200) }
      }
      const stats: XhsNoteStats = {
        ...(parseCount(interact.likedCount) === undefined ? {} : { likes: parseCount(interact.likedCount) }),
        ...(parseCount(interact.collectedCount) === undefined ? {} : { collects: parseCount(interact.collectedCount) }),
        ...(parseCount(interact.commentCount) === undefined ? {} : { comments: parseCount(interact.commentCount) }),
        ...(parseCount(interact.sharedCount) === undefined ? {} : { shares: parseCount(interact.sharedCount) }),
      }
      const time = typeof note.time === 'number' ? new Date(note.time).toISOString() : undefined
      const title = typeof note.title === 'string' ? note.title : undefined
      return {
        ok: true,
        stats,
        ...(title === undefined ? {} : { title }),
        ...(time === undefined ? {} : { postedAt: time }),
        detail: extractMessage(result.json) ?? 'ok',
      }
    } catch (error) {
      return { ok: false, detail: `服务不可达：${(error as Error).message}` }
    }
  }

  async publish(input: XhsPublishInput, signal?: AbortSignal): Promise<XhsPublishResult> {
    const path = input.kind === 'video' ? '/api/v1/publish_video' : '/api/v1/publish'
    const payload: Record<string, unknown> = {
      title: input.title,
      ...(input.body === undefined ? {} : { content: input.body }),
      ...(input.kind === 'video' ? { video: input.media[0] } : { images: input.media }),
      ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
      // 三个可选字段：不传就是上游默认（公开可见 / 不声明原创 / 立即发布）。
      ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
      ...(input.isOriginal === undefined ? {} : { is_original: input.isOriginal }),
      ...(input.scheduleAt === undefined ? {} : { schedule_at: input.scheduleAt }),
    }
    const result = await this.call(path, { method: 'POST', body: JSON.stringify(payload) }, signal)
    const ok = result.status < 300 && readSuccess(result.json)
    return {
      ok,
      detail: extractMessage(result.json) ?? result.text.slice(0, 300),
      httpStatus: result.status,
    }
  }
}

function readSuccess(json: unknown): boolean {
  if (typeof json !== 'object' || json === null) return false
  const record = json as Record<string, unknown>
  return record.success === true
}

/** 上游数字可能是 12 / "1,234" / "1.2万" 这类网页格式；解析不了就保留 undefined。 */
function parseCount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return undefined
  const text = value.trim().replace(/,/g, '')
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text)
  const wan = text.match(/^(\d+(?:\.\d+)?)万$/)
  if (wan) return Math.round(Number(wan[1]) * 10_000)
  return undefined
}

function extractMessage(json: unknown): string | undefined {
  if (typeof json !== 'object' || json === null) return undefined
  const record = json as Record<string, unknown>
  const message = record.message
  if (typeof message === 'string' && message.length > 0) return message
  const data = record.data
  if (typeof data === 'object' && data !== null) {
    const status = (data as Record<string, unknown>).status
    if (typeof status === 'string' && status.length > 0) return status
  }
  return undefined
}
