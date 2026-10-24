/** 内容形态，与两个上游项目的命令/接口一一对应。 */
export type ContentKind = 'video' | 'note' | 'article'

/**
 * 发布状态。
 * `unknown` 沿用 social-auto-upload 的 `submission_unknown` 语义：
 * 提交了但拿不到确认证据，必须先查原记录，禁止直接重发。
 */
export type PublishStatus =
  | 'submitted'
  | 'prepared'
  | 'approved'
  | 'submitting'
  | 'published'
  | 'scheduled'
  | 'processing'
  | 'unknown'
  | 'failed'

/** 一次发布请求（用户/模型给的东西）。 */
export interface PublishRequest {
  platform: string
  account: string
  kind: ContentKind
  title: string
  body?: string
  tags?: string[]
  /** 本地绝对路径：视频一个文件，图文多张图片。 */
  media: string[]
  /** 显式传才定时；格式由平台适配器决定。不传 = 立即发布（上游默认）。 */
  scheduleAt?: string
  /** 小红书专用；不传 = 公开可见（上游默认）。 */
  visibility?: string
  /** 小红书图文专用；不传 = 不声明原创（上游默认）。 */
  isOriginal?: boolean
}

/** 台账里的一行。 */
export interface LedgerEntry {
  /** 幂等键：platform|account|digest。 */
  key: string
  prepareId: string
  digest: string
  request: PublishRequest
  status: PublishStatus
  createdAt: string
  updatedAt: string
  /** 上游回执：平台返回的原始状态文本或结果 JSON 片段。 */
  detail?: string
  /** 回执证据文件（结果 JSON、截图）路径。 */
  evidence?: string
  jobId?: string
  /** 与上游默认值不同的地方，显式记录，便于事后追溯。 */
  deviations: string[]
  /** 失败或未知态的说明。 */
  note?: string
  /** Explicit confirmation surface for this attempt. */
  approvalSource?: 'tool' | 'page'
  /** Accepted submission time, used for the configured local-day quota. */
  submittedAt?: string
}

/** 预检结果。 */
export interface PrepareResult {
  prepareId: string
  digest: string
  key: string
  platform: string
  account: string
  kind: ContentKind
  title: string
  mediaCount: number
  scheduleAt?: string
  deviations: string[]
  warnings: string[]
}
