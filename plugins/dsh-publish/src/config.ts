/** Live configuration shared by the Host tools and Publish Center. */
import Schema from '@deepseek-ai/schemastery'
import type { Volatile } from '@deepseek-ai/cordis'
export interface AccountConfig { platform: string; name: string; id?: string }
export interface Config {
  accounts: AccountConfig[]; xhsBaseUrl: string; xhsToken?: string
  sauBin: string; sauCwd?: string; ledgerPath?: string
  requireApproval: boolean; approvalTimeoutSec: number; dailyLimit: number
  dailyTimeZone: string
  allowedPlatforms: string[]; allowedAccounts: string[]; headed: boolean
  httpTimeoutMs: number; publishTimeoutMs: number
  showSidebar: boolean; publishingEnabled: boolean; maxMediaBytes: number
  /** 主页平台卡片顺序；由发布中心主页拖拽与「更多平台」面板管理，设置页不出文本框。 */
  homeCards: string[]
}
export type LiveConfig = { [K in keyof Omit<Required<Config>, 'ledgerPath'>]: Volatile<Config[K]> }
/** Schema defaults retain v0.1 upload behavior; UI preferences are independent. */
export const Config = Schema.object({
  accounts: Schema.array(Schema.object({ platform: Schema.string().required(), name: Schema.string().required(), id: Schema.string() })).default([]).volatile(),
  xhsBaseUrl: Schema.string().pattern(/^https?:\/\//).default('http://127.0.0.1:18060').volatile(),
  xhsToken: Schema.string().role('secret').volatile(),
  sauBin: Schema.string().default('sau').volatile(), sauCwd: Schema.string().volatile(),
  ledgerPath: Schema.string(),
  requireApproval: Schema.boolean().default(true).volatile(),
  approvalTimeoutSec: Schema.number().min(1).max(3600).default(300).volatile(),
  dailyLimit: Schema.number().step(1).min(0).default(0).volatile(),
  dailyTimeZone: Schema.string().default('Asia/Shanghai').volatile(),
  allowedPlatforms: Schema.array(String).default([]).volatile(), allowedAccounts: Schema.array(String).default([]).volatile(),
  headed: Schema.boolean().default(false).volatile(),
  httpTimeoutMs: Schema.number().min(1000).default(180000).volatile(),
  publishTimeoutMs: Schema.number().min(1000).default(900000).volatile(),
  showSidebar: Schema.boolean().default(true).volatile(),
  publishingEnabled: Schema.boolean().default(true).volatile(),
  maxMediaBytes: Schema.number().step(1).min(1).default(536870912).volatile(),
  homeCards: Schema.array(String).default(['douyin', 'xiaohongshu', 'tencent']).volatile(),
})
/** Resolve one operation's configuration without retaining live references. */
export function resolveConfig(config: LiveConfig & { ledgerPath?: string }): Config {
  return {
    accounts: config.accounts.get().map(row=>({...row})), xhsBaseUrl: config.xhsBaseUrl.get(), xhsToken: config.xhsToken.get(),
    sauBin: config.sauBin.get(), sauCwd: config.sauCwd.get(), ledgerPath: config.ledgerPath,
    requireApproval: config.requireApproval.get(), approvalTimeoutSec: config.approvalTimeoutSec.get(),
    dailyLimit: config.dailyLimit.get(), dailyTimeZone: config.dailyTimeZone.get(), allowedPlatforms: [...config.allowedPlatforms.get()], allowedAccounts: [...config.allowedAccounts.get()],
    headed: config.headed.get(), httpTimeoutMs: config.httpTimeoutMs.get(), publishTimeoutMs: config.publishTimeoutMs.get(),
    showSidebar: config.showSidebar.get(), publishingEnabled: config.publishingEnabled.get(), maxMediaBytes: config.maxMediaBytes.get(),
    homeCards: [...config.homeCards.get()],
  }
}
