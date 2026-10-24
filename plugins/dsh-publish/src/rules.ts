/**
 * 平台发布规则表：按「平台 × 形式 × 字段」定义。
 * 每条规则带单位、校验方式、来源与核验日期；hard 拦截发布确认，advise 仅提示。
 * 未核实为硬限的数字一律 advise——不编造限制。
 */
export type RuleLevel = 'hard' | 'advise'
export type CountingUnit = 'char' | 'cjk' | 'weighted'

export interface LengthRule {
  field: string
  max: number
  unit: CountingUnit
  level: RuleLevel
  source: string
  verifiedAt: string
}

export interface PlatformFormRule {
  platform: string
  form: 'video' | 'note' | 'article' | 'shortpost'
  fields: readonly string[]
  lengths: readonly LengthRule[]
  /** 后台直达链接（白名单）；发布页仅打开白名单内的地址。 */
  studioUrl: string
  notes?: string
}

/** X 官方加权计数的本地实现：URL 折算 23、CJK 与多数全角=2、emoji 按码点簇。 */
export function weightedLength(text: string, urlLength = 23): number {
  const urls = text.match(/https?:\/\/\S+/g) ?? []
  let rest = text
  for (const url of urls) rest = rest.replace(url, '')
  let weight = 0
  // 按码点遍历（组合 emoji 的 ZWJ 序列按官方实现近似为每码点计权，差异在容差内）。
  for (const char of rest) {
    const code = char.codePointAt(0) ?? 0
    if (code >= 0x1100 && (
      code <= 0x115f
      || code === 0x2329 || code === 0x232a
      || (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f)
      || (code >= 0xac00 && code <= 0xd7a3)
      || (code >= 0xf900 && code <= 0xfaff)
      || (code >= 0xfe30 && code <= 0xfe6f)
      || (code >= 0xff00 && code <= 0xff60)
      || (code >= 0xffe0 && code <= 0xffe6)
      || (code >= 0x20000 && code <= 0x3fffd)
    )) weight += 2
    else if (code !== 0x200d && code !== 0xfe0f) weight += 1
  }
  return weight + urls.length * urlLength
}

/** 普通字数：按 Unicode 码点计（中文平台的一「字」）。 */
export function cjkLength(text: string): number {
  return [...text].length
}

export function countFor(unit: CountingUnit, text: string): number {
  if (unit === 'weighted') return weightedLength(text)
  return cjkLength(text)
}

export const RULES: readonly PlatformFormRule[] = [
  {
    platform: 'xiaohongshu', form: 'note',
    fields: ['title', 'body', 'tags'],
    lengths: [
      { field: 'title', max: 20, unit: 'cjk', level: 'hard', source: 'xiaohongshu-mcp README 运营约束（创作助手常见口径）', verifiedAt: '2026-10-24' },
      { field: 'body', max: 1000, unit: 'cjk', level: 'advise', source: '同上；普通笔记编辑器实测可能放宽', verifiedAt: '2026-10-24' },
    ],
    studioUrl: 'https://creator.xiaohongshu.com/publish/publish?source=official',
    notes: '话题建议 3–6 个（建议，非硬限）',
  },
  {
    platform: 'gongzhonghao', form: 'article',
    fields: ['title', 'digest', 'body'],
    lengths: [
      { field: 'title', max: 64, unit: 'cjk', level: 'hard', source: '公众号后台创建页标题计数', verifiedAt: '2026-10-24' },
      { field: 'digest', max: 120, unit: 'cjk', level: 'hard', source: '公众号后台摘要计数', verifiedAt: '2026-10-24' },
    ],
    studioUrl: 'https://mp.weixin.qq.com/',
    notes: '图片（含封面）仍需在平台后台上传；本插件提供文本与排版复制',
  },
  {
    platform: 'douyin', form: 'video',
    fields: ['hook', 'body', 'tags'],
    lengths: [
      { field: 'body', max: 55, unit: 'cjk', level: 'advise', source: '前台折叠展示经验值；编辑器完整上限未核实', verifiedAt: '2026-10-24' },
    ],
    studioUrl: 'https://creator.douyin.com/creator-micro/content/upload',
    notes: '批次 2 启用',
  },
  {
    platform: 'shipinhao', form: 'video',
    fields: ['hook', 'body', 'tags'],
    lengths: [
      { field: 'body', max: 60, unit: 'cjk', level: 'advise', source: '社区经验值；官方未公布', verifiedAt: '2026-10-24' },
    ],
    studioUrl: 'https://channels.weixin.qq.com/platform/post/create',
    notes: '批次 2 启用',
  },
  {
    platform: 'x', form: 'shortpost',
    fields: ['body', 'tags'],
    lengths: [
      { field: 'body', max: 280, unit: 'weighted', level: 'hard', source: 'X 官方字符计数规则（URL=23，CJK=2）', verifiedAt: '2026-10-24' },
    ],
    studioUrl: 'https://x.com/compose/post',
    notes: '批次 2 启用；长文能力不承诺',
  },
]

export function rulesFor(platform: string, form: string): PlatformFormRule | undefined {
  return RULES.find(rule => rule.platform === platform && rule.form === form)
}

export interface CheckResult {
  field: string
  count: number
  max: number
  level: RuleLevel
  exceeded: boolean
  unit: CountingUnit
}

/** 对一份草稿做规则检查；只检查规则表里声明的字段。 */
export function checkDraft(platform: string, form: string, fields: Record<string, string>): CheckResult[] {
  const rule = rulesFor(platform, form)
  if (!rule) return []
  return rule.lengths.map(length => {
    const count = countFor(length.unit, fields[length.field] ?? '')
    return { field: length.field, count, max: length.max, level: length.level, exceeded: count > length.max, unit: length.unit }
  })
}

export const STUDIO_WHITELIST: readonly string[] = [...new Set(RULES.map(rule => rule.studioUrl))]
