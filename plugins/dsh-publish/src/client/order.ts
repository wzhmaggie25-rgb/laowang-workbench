/** 主页卡片顺序、日历聚合与平台元数据的纯函数；零依赖，便于离线测试。 */
import type { PlatformSpec } from '../platforms.ts'
import type { LedgerEntry } from '../types.ts'

/** 平台在主页卡片、日历与「更多平台」面板用的视觉元数据。 */
export const PLATFORM_META: Record<string, { bg: string; letter: string }> = {
  xiaohongshu: { bg: '#ff2442', letter: '书' },
  douyin: { bg: '#161823', letter: '音' },
  tencent: { bg: '#fa9d3b', letter: '号' },
  kuaishou: { bg: '#ff6600', letter: '手' },
  zhihu: { bg: '#0084ff', letter: '知' },
  dayu: { bg: '#3a76c9', letter: '鱼' },
  xueqiu: { bg: '#2e68b5', letter: '雪' },
  bilibili: { bg: '#fb7299', letter: 'B' },
  weibo: { bg: '#e6162d', letter: '微' },
  hupu: { bg: '#c9151e', letter: '虎' },
  baijiahao: { bg: '#2932e1', letter: '百' },
  youtube: { bg: '#ff0000', letter: '▶' },
  alipay: { bg: '#1677ff', letter: '支' },
}
export const platformMeta = (id: string): { bg: string; letter: string } => PLATFORM_META[id] ?? { bg: '#646a73', letter: id.slice(0, 1).toUpperCase() }

/** 平台日历上状态点的颜色；与发布记录状态徽章同语义。 */
export const STATUS_COLOR: Record<string, string> = {
  published: '#0d8a55',
  scheduled: '#7a3db8',
  unknown: '#b25e09',
  failed: '#d92d20',
  submitting: '#2a5bd7',
  submitted: '#2a5bd7',
  processing: '#646a73',
  prepared: '#8f959e',
  approved: '#8f959e',
}
export const statusColor = (status: string): string => STATUS_COLOR[status] ?? '#8f959e'

/** 参与发布计数的形态；prepared（还没确认）与 failed（没有提交）不算。 */
export const ATTEMPTED: readonly string[] = ['submitting', 'submitted', 'published', 'scheduled', 'processing', 'unknown']

/** 本地时区的 YYYY-MM-DD。 */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 一条台账记录归属的日期：优先排期日，其次提交日，最后更新日。 */
export function entryDayKey(entry: LedgerEntry): string {
  const scheduled = entry.request.scheduleAt?.slice(0, 10)
  return scheduled ?? entry.submittedAt?.slice(0, 10) ?? entry.updatedAt.slice(0, 10)
}

/**
 * 把拖拽结果落成新顺序：被拖卡片落到目标卡片原来的槽位。
 * 向右拖时目标前移补位，向左拖时目标后移让位；顺序以 id 表达，
 * 未知 id（历史残留）保留在末尾，目标不在表里时原样返回。
 */
export function moveCard(order: readonly string[], dragId: string, targetId: string): string[] {
  const dragIndex = order.indexOf(dragId)
  const targetIndex = order.indexOf(targetId)
  if (dragIndex === -1 || targetIndex === -1 || dragIndex === targetIndex) return [...order]
  const known = order.filter(id => id !== dragId)
  const at = known.indexOf(targetId)
  const insertAt = dragIndex < targetIndex ? at + 1 : at
  return [...known.slice(0, insertAt), dragId, ...known.slice(insertAt)]
}

export interface CalendarCell {
  day: number | null
  key: string
}

/** 当前月份的周一起始网格；key 为 YYYY-MM-DD，前导空位 day 为 null。 */
export function buildMonth(now: Date): CalendarCell[] {
  const year = now.getFullYear(), month = now.getMonth()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const total = new Date(year, month + 1, 0).getDate()
  const cells: CalendarCell[] = []
  for (let i = 0; i < offset; i += 1) cells.push({ day: null, key: '' })
  for (let day = 1; day <= total; day += 1) {
    cells.push({ day, key: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` })
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, key: '' })
  return cells
}

/** 平台在「更多平台」面板的能力摘要：形态 + 定时 + 上游限制。 */
export function platformSummary(spec: PlatformSpec): string {
  const kinds = spec.kinds.join(' / ')
  const schedule = spec.scheduling === 'none' ? '不支持定时' : '支持定时'
  return spec.blocked ? `${kinds} · ${spec.blocked}` : `${kinds} · ${schedule}`
}
