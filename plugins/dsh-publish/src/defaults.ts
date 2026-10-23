/**
 * 上游默认值表 —— 只记录事实，不在这里改写行为。
 *
 * 来源（2026-10-24 核对）：
 * - xiaohongshu-mcp docs/API.md（HTTP 接口与参数默认值）
 * - xiaohongshu-mcp README（端口、cookie 路径、标题/正文字数）
 * - social-auto-upload docs/CLI.md（--headless/--headed/--debug，默认 headless=True）
 * - social-auto-upload docs/install.md（uv 安装、conf.py、patchright）
 * - social-auto-upload skills/xiaohongshu-upload/references/cli-contract.md（--schedule 不传即立即发布）
 *
 * 规则：插件不覆盖上游默认值。要偏离默认，必须由用户在配置里显式写，
 * 并在台账里记录偏离项（见 LedgerEntry.deviations）。
 */

/** 小红书发布通道：xiaohongshu-mcp */
export const XHS = {
  /** 服务默认监听地址；端口由上游固定为 18060。 */
  baseUrl: 'http://127.0.0.1:18060',
  healthPath: '/health',
  loginStatusPath: '/api/v1/login/status',
  loginQrcodePath: '/api/v1/login/qrcode',
  publishPath: '/api/v1/publish',
  publishVideoPath: '/api/v1/publish_video',
  /**
   * 以下三项默认「不传」：
   * - visibility 不填 → 公开可见
   * - is_original 不填 → 不声明原创（仅图文接口有此参数）
   * - schedule_at 不填 → 立即发布
   */
  visibility: undefined,
  isOriginal: undefined,
  scheduleAt: undefined,
  /** 定时窗口：1 小时 ~ 14 天。 */
  scheduleMinHours: 1,
  scheduleMaxDays: 14,
  /** README 运营约束（非接口强校验）：标题 ≤ 20 字，正文 ≤ 1000 字。 */
  titleLimitChars: 20,
  bodyLimitChars: 1000,
  /** 登录态存放（服务自己管，插件只读状态不碰 cookie）。 */
  cookiePath: '~/.xiaohongshu/cookies.json',
} as const

/** 多平台发布通道：social-auto-upload 的 sau CLI */
export const SAU = {
  bin: 'sau',
  /** 不传 --headless/--headed 时，上游默认 headless=True。 */
  headless: true,
  /** --account 必填，上游没有默认账号名。 */
  account: undefined,
  /** 定时发布参数格式；不传 --schedule 即立即发布。 */
  scheduleFormat: 'YYYY-MM-DD HH:MM',
  /** agent 主线文档明确列出的平台（其余平台 CLI 在，但不在主线承诺内）。 */
  mainlinePlatforms: ['bilibili', 'douyin', 'kuaishou', 'xiaohongshu', 'dayu'],
  /** 抖音短信二次验证：读项目根目录的 verify_code.txt。 */
  verifyCodeFile: 'verify_code.txt',
  /** 结果 JSON 目前只在这些平台有明确约定。 */
  resultJsonPlatforms: ['facebook', 'facebook-page', 'instagram', 'dayu', 'zhihu'],
} as const

/**
 * 插件自身策略的默认值。
 * 这些不是上游默认值，属于本插件的产品策略；默认取「不额外限制」，
 * 由用户在配置里开，避免插件擅自改变发布行为。
 */
export const POLICY = {
  /** 0 = 不限。 */
  dailyLimit: 0,
  /** 空数组 = 不限制平台。 */
  allowedPlatforms: [] as readonly string[],
  /** 空数组 = 不限制账号。 */
  allowedAccounts: [] as readonly string[],
  /** 发布前是否必须人工确认。默认必须。 */
  requireApproval: true,
  /** 发布权限超时（秒）；超时按拒绝处理。 */
  approvalTimeoutSec: 300,
} as const
