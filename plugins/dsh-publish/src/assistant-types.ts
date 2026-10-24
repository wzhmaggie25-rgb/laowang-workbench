/** 智能发布助手的共享类型；零依赖，Host 与 Client 两侧都能引。 */

export interface Material {
  /** 草稿 id。 */
  draftId: string
  kind: 'paste' | 'markdown' | 'srt'
  /** 解析后的正文（SRT 已去时间轴；MD 保留原文）。 */
  text: string
  /** 素材内容哈希；变化即新版本。 */
  contentHash: string
  /** 来源描述（粘贴 / 文件名），不含凭据。 */
  origin: string
  createdAt: string
  updatedAt: string
  /** 附件（图片/视频）路径与大小；只作附件，不代表已理解内容。 */
  attachments: { path: string; bytes: number; type: string }[]
}

export interface PlatformDraftField {
  text: string
  /** 用户改过生成结果的字段；AI 不得静默覆盖。 */
  edited: boolean
}

export interface PlatformDraft {
  platform: string
  form: string
  revision: number
  fields: Record<string, PlatformDraftField>
  /** 最近一次生成任务的引用（generations.jsonl 里的 id）。 */
  lastGeneration?: string
  updatedAt: string
}

export interface GenerationRecord {
  id: string
  draftId: string
  task: 'understand' | 'adapt' | 'revise' | 'check'
  platform?: string
  materialHash: string
  prompt: string
  provider: string
  model: string
  /** 请求参数摘要（无凭据）。 */
  request: unknown
  /** 模型原始输出（截断存储，防异常超大）。 */
  output: string
  ok: boolean
  error?: string
  at: string
}

export interface ManualRecord {
  draftId: string
  platform: string
  /** 确认已发时绑定的字段快照。 */
  snapshot: Record<string, string>
  materialHash: string
  markedAt: string
  unmarkedAt?: string
  /** 作品链接（选填，人工标记未核验）。 */
  link?: string
  note?: string
}
