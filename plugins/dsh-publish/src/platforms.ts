import type { ContentKind } from './types'

export type AdapterKind = 'xhs' | 'sau'
export type Scheduling = 'xhs' | 'sau' | 'none'

/**
 * 平台能力描述符。
 * 数值与能力全部来自两个上游项目的 README 能力表 / CLI 契约，不自行加码。
 * 加一个平台 = 加一行描述符，不改工具面。
 */
export interface PlatformSpec {
  id: string
  /** sau 的子命令名；xhs 通道不用。 */
  sauName?: string
  adapter: AdapterKind
  kinds: readonly ContentKind[]
  scheduling: Scheduling
  /** 上游文档明确写出的限制；没写就不填。 */
  titleMaxChars?: number
  titleMinChars?: number
  /** 非空表示 v0.1 不让它进发布队列，理由照实写。 */
  blocked?: string
}

export const PLATFORMS: readonly PlatformSpec[] = [
  { id: 'xiaohongshu', adapter: 'xhs', kinds: ['video', 'note'], scheduling: 'xhs', titleMaxChars: 20 },
  { id: 'douyin', adapter: 'sau', sauName: 'douyin', kinds: ['video', 'note'], scheduling: 'sau' },
  { id: 'kuaishou', adapter: 'sau', sauName: 'kuaishou', kinds: ['video', 'note'], scheduling: 'sau' },
  { id: 'tencent', adapter: 'sau', sauName: 'tencent', kinds: ['video'], scheduling: 'sau' },
  { id: 'dayu', adapter: 'sau', sauName: 'dayu', kinds: ['video', 'article'], scheduling: 'sau' },
  { id: 'baijiahao', adapter: 'sau', sauName: 'baijiahao', kinds: ['video'], scheduling: 'none' },
  { id: 'alipay', adapter: 'sau', sauName: 'alipay', kinds: ['video'], scheduling: 'none' },
  { id: 'weibo', adapter: 'sau', sauName: 'weibo', kinds: ['video'], scheduling: 'none', titleMaxChars: 30 },
  { id: 'hupu', adapter: 'sau', sauName: 'hupu', kinds: ['video'], scheduling: 'none', titleMinChars: 4, titleMaxChars: 40 },
  { id: 'zhihu', adapter: 'sau', sauName: 'zhihu', kinds: ['video', 'article'], scheduling: 'none' },
  { id: 'xueqiu', adapter: 'sau', sauName: 'xueqiu', kinds: ['article'], scheduling: 'none' },
  { id: 'youtube', adapter: 'sau', sauName: 'youtube', kinds: ['video'], scheduling: 'none' },
  {
    id: 'bilibili',
    adapter: 'sau',
    sauName: 'bilibili',
    kinds: ['video'],
    scheduling: 'sau',
    blocked: '需要 --tid 分区参数，v0.1 未接；先按上游 CLI 手动发',
  },
  {
    id: 'tiktok',
    adapter: 'sau',
    kinds: ['video'],
    scheduling: 'none',
    blocked: '上游是 Chrome 版实现，没有 sau CLI',
  },
]

export const platformById = (id: string): PlatformSpec | undefined =>
  PLATFORMS.find(p => p.id === id)
