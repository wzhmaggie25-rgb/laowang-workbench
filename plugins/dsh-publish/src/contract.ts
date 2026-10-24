/** Plugin-owned RPC messages; no credentials are returned to the browser. */
import { z } from 'zod'
export const requestSchema = z.object({
  platform: z.string().min(1), account: z.string().min(1), kind: z.enum(['note','video','article']),
  title: z.string().min(1), body: z.string().optional(), tags: z.array(z.string()).optional(),
  media: z.array(z.string().min(1)).min(1), scheduleAt: z.string().optional(),
  visibility: z.string().optional(), isOriginal: z.boolean().optional(),
})
export const submitSchema = z.object({ prepareId: z.string(), token: z.string(), confirmed: z.literal(true) })
export const prepareIdSchema = z.object({ prepareId: z.string().min(1) })
export const bindSchema = z.object({ prepareId: z.string().min(1), noteId: z.string().min(1) })

/** ===== 智能发布助手（v0.4） ===== */
export const materialInputSchema = z.object({
  kind: z.enum(['paste', 'markdown', 'srt']),
  text: z.string().min(1),
  origin: z.string().max(200).default('粘贴'),
})
export const draftIdSchema = z.object({ draftId: z.string().min(1) })
export const saveFieldSchema = z.object({
  draftId: z.string().min(1), platform: z.string().min(1), form: z.string().min(1),
  field: z.string().min(1), text: z.string(), expectedRevision: z.number().int().min(0),
})
export const understandSchema = z.object({ draftId: z.string().min(1) })
export const adaptSchema = z.object({
  draftId: z.string().min(1), platform: z.string().min(1), form: z.string().min(1),
  /** 定向修改指令（如「只改开头」）；缺省为整版生成。 */
  instruction: z.string().max(500).optional(),
})
export const markSchema = z.object({
  draftId: z.string().min(1), platform: z.string().min(1),
  link: z.string().max(500).optional(), note: z.string().max(500).optional(),
})
export const unmarkSchema = z.object({ draftId: z.string().min(1), platform: z.string().min(1) })

/** AI 输出契约 */
export const understandOutputSchema = z.object({
  summary: z.string().min(1),
  audience: z.string(),
  facts: z.array(z.object({ claim: z.string(), quote: z.string() })).default([]),
  suggestions: z.array(z.object({
    platform: z.enum(['xiaohongshu', 'gongzhonghao']),
    form: z.string(),
    reason: z.string(),
  })).min(1),
  question: z.object({ question: z.string(), why: z.string() }).optional(),
})
export const adaptOutputSchema = z.object({
  fields: z.record(z.string(), z.string()),
  changes: z.array(z.object({ field: z.string(), what: z.string(), why: z.string() })).default([]),
  warnings: z.array(z.object({ field: z.string(), issue: z.string(), quote: z.string().optional() })).default([]),
})
