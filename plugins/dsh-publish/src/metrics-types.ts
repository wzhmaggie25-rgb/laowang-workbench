/** 数据回采的共享类型与纯函数；零依赖，Host 与 Client 两侧都能引。 */
import type { XhsUserNote } from './adapters/xhs.ts'

export interface NoteRef {
  noteId: string
  xsecToken: string
  title: string
  boundAt: string
  method: 'auto' | 'manual'
}

export interface MetricsSnapshot {
  at: string
  likes?: number
  collects?: number
  comments?: number
  shares?: number
}

export interface NoteMetrics {
  noteRef: NoteRef
  snapshots: MetricsSnapshot[]
}

export const SNAPSHOT_LIMIT = 30

/** 最新一份快照；没有则 undefined。 */
export function latestSnapshot(metrics: NoteMetrics | undefined): MetricsSnapshot | undefined {
  const snapshots = metrics?.snapshots ?? []
  return snapshots.at(-1)
}

/**
 * 自动匹配：标题完全一致才认；同题多篇宁缺不猜，留给人工绑定。
 * 台账里的标题就是发布时冻结的标题，与网页 displayTitle 同源。
 */
export function matchByTitle(notes: readonly XhsUserNote[], title: string): XhsUserNote | undefined {
  const hits = notes.filter(note => note.title.trim() === title.trim())
  return hits.length === 1 ? hits[0] : undefined
}
