/** Plugin-owned RPC messages; no credentials are returned to the browser. */
import { z } from 'zod'
export const requestSchema = z.object({
  platform: z.string().min(1), account: z.string().min(1), kind: z.enum(['note','video','article']),
  title: z.string().min(1), body: z.string().optional(), tags: z.array(z.string()).optional(),
  media: z.array(z.string().min(1)).min(1), scheduleAt: z.string().optional(),
  visibility: z.string().optional(), isOriginal: z.boolean().optional(),
})
export const submitSchema = z.object({ prepareId: z.string(), token: z.string(), confirmed: z.literal(true) })
