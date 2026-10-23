// ../laowang-workbench-public/plugins/dsh-publish/src/index.ts
import { homedir } from "node:os";
import { join } from "node:path";
import { stat as stat2 } from "node:fs/promises";
import Schema from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";

// ../laowang-workbench-public/plugins/dsh-publish/src/adapters/xhs.ts
var XhsAdapter = class {
  constructor(options) {
    this.options = options;
  }
  options;
  headers() {
    const headers = { "content-type": "application/json" };
    if (this.options.token) headers.authorization = `Bearer ${this.options.token}`;
    return headers;
  }
  url(path) {
    return `${this.options.baseUrl.replace(/\/+$/, "")}${path}`;
  }
  async call(path, init) {
    const response = await fetch(this.url(path), {
      ...init,
      headers: { ...this.headers(), ...init?.headers },
      signal: AbortSignal.timeout(this.options.timeoutMs)
    });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = void 0;
    }
    return { status: response.status, text, ...json === void 0 ? {} : { json } };
  }
  /** 服务在不在，决定「连接失败」和「发布失败」分得清。 */
  async health() {
    try {
      const result = await this.call("/health");
      return result.status >= 200 && result.status < 300;
    } catch {
      return false;
    }
  }
  async loginStatus() {
    try {
      const result = await this.call("/api/v1/login/status");
      const message = extractMessage(result.json) ?? result.text.slice(0, 200);
      return { loggedIn: result.status < 300 && /登录|logged|success|true/i.test(result.text), detail: message };
    } catch (error) {
      return { loggedIn: false, detail: `\u670D\u52A1\u4E0D\u53EF\u8FBE\uFF1A${error.message}` };
    }
  }
  async publish(input) {
    const path = input.kind === "video" ? "/api/v1/publish_video" : "/api/v1/publish";
    const payload = {
      title: input.title,
      ...input.body === void 0 ? {} : { content: input.body },
      ...input.kind === "video" ? { video: input.media[0] } : { images: input.media },
      ...input.tags && input.tags.length > 0 ? { tags: input.tags } : {},
      // 三个可选字段：不传就是上游默认（公开可见 / 不声明原创 / 立即发布）。
      ...input.visibility === void 0 ? {} : { visibility: input.visibility },
      ...input.isOriginal === void 0 ? {} : { is_original: input.isOriginal },
      ...input.scheduleAt === void 0 ? {} : { schedule_at: input.scheduleAt }
    };
    const result = await this.call(path, { method: "POST", body: JSON.stringify(payload) });
    const ok = result.status < 300 && readSuccess(result.json);
    return {
      ok,
      detail: extractMessage(result.json) ?? result.text.slice(0, 300),
      httpStatus: result.status
    };
  }
};
function readSuccess(json) {
  if (typeof json !== "object" || json === null) return false;
  const record = json;
  return record.success === true;
}
function extractMessage(json) {
  if (typeof json !== "object" || json === null) return void 0;
  const record = json;
  const message = record.message;
  if (typeof message === "string" && message.length > 0) return message;
  const data = record.data;
  if (typeof data === "object" && data !== null) {
    const status = data.status;
    if (typeof status === "string" && status.length > 0) return status;
  }
  return void 0;
}

// ../laowang-workbench-public/plugins/dsh-publish/src/adapters/sau.ts
import { spawn } from "node:child_process";
var MAX_CAPTURE = 2e4;
function run(bin, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, [...args], {
      cwd: options.cwd ?? process.cwd(),
      shell: false,
      windowsHide: true,
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs);
    child.stdout.on("data", (chunk) => {
      if (stdout.length < MAX_CAPTURE) stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < MAX_CAPTURE) stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}
var SauAdapter = class {
  constructor(options) {
    this.options = options;
  }
  options;
  base(sauName, sub, account) {
    return [sauName, sub, "--account", account];
  }
  async check(sauName, account) {
    try {
      const result = await run(this.options.bin, this.base(sauName, "check", account), this.options);
      const text = `${result.stdout}
${result.stderr}`.toLowerCase();
      if (result.timedOut) return "unknown";
      if (/\binvalid\b|失效|未登录|过期/.test(text)) return "invalid";
      if (/\bvalid\b|有效|已登录/.test(text)) return "valid";
      return "unknown";
    } catch {
      return "unknown";
    }
  }
  async upload(input) {
    const args = this.base(input.sauName, subcommand(input.kind), input.account);
    if (input.kind === "article") {
      args.push("--title", input.title);
      const file = input.media[0];
      if (!file) throw new Error("\u6587\u7AE0\u53D1\u5E03\u9700\u8981\u4E00\u4E2A\u6B63\u6587\u6587\u4EF6");
      args.push("--content-file", file);
    } else if (input.kind === "video") {
      const file = input.media[0];
      if (!file) throw new Error("\u89C6\u9891\u53D1\u5E03\u9700\u8981\u4E00\u4E2A\u89C6\u9891\u6587\u4EF6");
      args.push("--file", file, "--title", input.title);
      if (input.body !== void 0) args.push("--desc", input.body);
    } else {
      args.push("--images", ...input.media, "--title", input.title);
      if (input.body !== void 0) args.push("--note", input.body);
    }
    if (input.tags && input.tags.length > 0) args.push("--tags", input.tags.join(","));
    if (input.scheduleAt !== void 0) args.push("--schedule", input.scheduleAt);
    if (input.headed === true) args.push("--headed");
    const result = await run(this.options.bin, args, this.options);
    const tail = result.stdout.slice(-2e3);
    const joined = `${result.stdout}
${result.stderr}`;
    if (result.timedOut) {
      return { ok: false, status: "unknown", detail: "\u547D\u4EE4\u8D85\u65F6\uFF1A\u63D0\u4EA4\u7ED3\u679C\u672A\u786E\u8BA4\uFF0C\u5148\u67E5\u5E73\u53F0\u539F\u8BB0\u5F55", stdoutTail: tail };
    }
    if (result.code !== 0) {
      return { ok: false, status: "failed", detail: `\u9000\u51FA\u7801 ${result.code ?? "null"}\uFF1A${firstLine(result.stderr) || firstLine(result.stdout) || "\u65E0\u8F93\u51FA"}`, stdoutTail: tail };
    }
    if (input.scheduleAt !== void 0) {
      return { ok: true, status: "scheduled", detail: "\u5DF2\u63D0\u4EA4\u5B9A\u65F6\u53D1\u5E03\uFF08\u4E0A\u6E38\u672A\u63D0\u4F9B\u673A\u5668\u53EF\u8BFB\u56DE\u6267\uFF0C\u6309\u547D\u4EE4\u6210\u529F\u5224\u5B9A\uFF09", stdoutTail: tail };
    }
    if (/成功|发布完成|已发布|published|success/i.test(joined)) {
      return { ok: true, status: "published", detail: firstLine(result.stdout) || "\u5DF2\u53D1\u5E03\uFF08\u6309\u4E0A\u6E38\u8F93\u51FA\u6587\u672C\u5224\u5B9A\uFF09", stdoutTail: tail };
    }
    return { ok: false, status: "unknown", detail: "\u547D\u4EE4\u6210\u529F\u4F46\u65E0\u53EF\u6838\u5BF9\u7684\u53D1\u5E03\u8BC1\u636E\uFF0C\u5148\u67E5\u5E73\u53F0\u539F\u8BB0\u5F55", stdoutTail: tail };
  }
};
function subcommand(kind) {
  if (kind === "video") return "upload-video";
  if (kind === "note") return "upload-note";
  return "upload-article";
}
function firstLine(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0) ?? "";
}

// ../laowang-workbench-public/plugins/dsh-publish/src/ledger.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
var Ledger = class {
  constructor(file) {
    this.file = file;
  }
  file;
  data;
  queue = Promise.resolve();
  async load() {
    if (this.data) return this.data;
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !Array.isArray(parsed.entries)) throw new Error("\u53F0\u8D26\u683C\u5F0F\u4E0D\u8BA4");
      this.data = parsed;
    } catch (error) {
      if (error.code === "ENOENT") {
        this.data = { version: 1, entries: [] };
      } else {
        throw error;
      }
    }
    return this.data;
  }
  async persist() {
    const data = await this.load();
    const text = `${JSON.stringify(data, null, 2)}
`;
    this.queue = this.queue.then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, text, "utf8");
      await rename(tmp, this.file);
    });
    await this.queue;
  }
  async insert(entry) {
    const data = await this.load();
    const existing = data.entries.find((e) => e.key === entry.key);
    if (existing) return existing;
    data.entries.push(entry);
    await this.persist();
    return entry;
  }
  async get(key) {
    const data = await this.load();
    return data.entries.find((e) => e.key === key);
  }
  async byPrepare(prepareId) {
    const data = await this.load();
    return data.entries.find((e) => e.prepareId === prepareId);
  }
  async update(key, patch) {
    const data = await this.load();
    const entry = data.entries.find((e) => e.key === key);
    if (!entry) return void 0;
    Object.assign(entry, patch, { updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    await this.persist();
    return entry;
  }
  async list(limit = 20) {
    const data = await this.load();
    return [...data.entries].slice(-limit).reverse();
  }
  /**
   * 启动时把停在 submitting 的行改判 unknown。
   * 进程可能死在「已点发布」和「拿到回执」之间，此时只能人工核，不能重发。
   */
  async reconcileOnStart() {
    const data = await this.load();
    let changed = 0;
    for (const entry of data.entries) {
      if (entry.status === "submitting") {
        entry.status = "unknown";
        entry.note = "\u8FDB\u7A0B\u4E2D\u65AD\uFF1A\u63D0\u4EA4\u7ED3\u679C\u672A\u786E\u8BA4\uFF0C\u987B\u4EBA\u5DE5\u6838\u5BF9\u8BE5\u5E73\u53F0\u539F\u8BB0\u5F55\uFF0C\u7981\u6B62\u76F4\u63A5\u91CD\u53D1";
        entry.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        changed += 1;
      }
    }
    if (changed > 0) await this.persist();
    return changed;
  }
};

// ../laowang-workbench-public/plugins/dsh-publish/src/digest.ts
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
async function hashFile(path) {
  const info = await stat(path);
  if (!info.isFile()) throw new Error(`\u4E0D\u662F\u6587\u4EF6\uFF1A${path}`);
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return { hash: hash.digest("hex"), size: info.size };
}
function digestRequest(request, mediaHashes) {
  const canonical = JSON.stringify({
    platform: request.platform,
    account: request.account,
    kind: request.kind,
    title: request.title,
    body: request.body ?? "",
    tags: request.tags ?? [],
    media: mediaHashes,
    scheduleAt: request.scheduleAt ?? "",
    visibility: request.visibility ?? "",
    isOriginal: request.isOriginal ?? null
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
function idempotencyKey(platform, account, digest) {
  return `${platform}|${account}|${digest}`;
}

// ../laowang-workbench-public/plugins/dsh-publish/src/platforms.ts
var PLATFORMS = [
  { id: "xiaohongshu", adapter: "xhs", kinds: ["video", "note"], scheduling: "xhs", titleMaxChars: 20 },
  { id: "douyin", adapter: "sau", sauName: "douyin", kinds: ["video", "note"], scheduling: "sau" },
  { id: "kuaishou", adapter: "sau", sauName: "kuaishou", kinds: ["video", "note"], scheduling: "sau" },
  { id: "tencent", adapter: "sau", sauName: "tencent", kinds: ["video"], scheduling: "sau" },
  { id: "dayu", adapter: "sau", sauName: "dayu", kinds: ["video", "article"], scheduling: "sau" },
  { id: "baijiahao", adapter: "sau", sauName: "baijiahao", kinds: ["video"], scheduling: "none" },
  { id: "alipay", adapter: "sau", sauName: "alipay", kinds: ["video"], scheduling: "none" },
  { id: "weibo", adapter: "sau", sauName: "weibo", kinds: ["video"], scheduling: "none", titleMaxChars: 30 },
  { id: "hupu", adapter: "sau", sauName: "hupu", kinds: ["video"], scheduling: "none", titleMinChars: 4, titleMaxChars: 40 },
  { id: "zhihu", adapter: "sau", sauName: "zhihu", kinds: ["video", "article"], scheduling: "none" },
  { id: "xueqiu", adapter: "sau", sauName: "xueqiu", kinds: ["article"], scheduling: "none" },
  { id: "youtube", adapter: "sau", sauName: "youtube", kinds: ["video"], scheduling: "none" },
  {
    id: "bilibili",
    adapter: "sau",
    sauName: "bilibili",
    kinds: ["video"],
    scheduling: "sau",
    blocked: "\u9700\u8981 --tid \u5206\u533A\u53C2\u6570\uFF0Cv0.1 \u672A\u63A5\uFF1B\u5148\u6309\u4E0A\u6E38 CLI \u624B\u52A8\u53D1"
  },
  {
    id: "tiktok",
    adapter: "sau",
    kinds: ["video"],
    scheduling: "none",
    blocked: "\u4E0A\u6E38\u662F Chrome \u7248\u5B9E\u73B0\uFF0C\u6CA1\u6709 sau CLI"
  }
];
var platformById = (id) => PLATFORMS.find((p) => p.id === id);

// ../laowang-workbench-public/plugins/dsh-publish/src/defaults.ts
var XHS = {
  /** 服务默认监听地址；端口由上游固定为 18060。 */
  baseUrl: "http://127.0.0.1:18060",
  healthPath: "/health",
  loginStatusPath: "/api/v1/login/status",
  loginQrcodePath: "/api/v1/login/qrcode",
  publishPath: "/api/v1/publish",
  publishVideoPath: "/api/v1/publish_video",
  /**
   * 以下三项默认「不传」：
   * - visibility 不填 → 公开可见
   * - is_original 不填 → 不声明原创（仅图文接口有此参数）
   * - schedule_at 不填 → 立即发布
   */
  visibility: void 0,
  isOriginal: void 0,
  scheduleAt: void 0,
  /** 定时窗口：1 小时 ~ 14 天。 */
  scheduleMinHours: 1,
  scheduleMaxDays: 14,
  /** README 运营约束（非接口强校验）：标题 ≤ 20 字，正文 ≤ 1000 字。 */
  titleLimitChars: 20,
  bodyLimitChars: 1e3,
  /** 登录态存放（服务自己管，插件只读状态不碰 cookie）。 */
  cookiePath: "~/.xiaohongshu/cookies.json"
};
var SAU = {
  bin: "sau",
  /** 不传 --headless/--headed 时，上游默认 headless=True。 */
  headless: true,
  /** --account 必填，上游没有默认账号名。 */
  account: void 0,
  /** 定时发布参数格式；不传 --schedule 即立即发布。 */
  scheduleFormat: "YYYY-MM-DD HH:MM",
  /** agent 主线文档明确列出的平台（其余平台 CLI 在，但不在主线承诺内）。 */
  mainlinePlatforms: ["bilibili", "douyin", "kuaishou", "xiaohongshu", "dayu"],
  /** 抖音短信二次验证：读项目根目录的 verify_code.txt。 */
  verifyCodeFile: "verify_code.txt",
  /** 结果 JSON 目前只在这些平台有明确约定。 */
  resultJsonPlatforms: ["facebook", "facebook-page", "instagram", "dayu", "zhihu"]
};
var POLICY = {
  /** 0 = 不限。 */
  dailyLimit: 0,
  /** 空数组 = 不限制平台。 */
  allowedPlatforms: [],
  /** 空数组 = 不限制账号。 */
  allowedAccounts: [],
  /** 发布前是否必须人工确认。默认必须。 */
  requireApproval: true,
  /** 发布权限超时（秒）；超时按拒绝处理。 */
  approvalTimeoutSec: 300
};

// ../laowang-workbench-public/plugins/dsh-publish/src/index.ts
var name = "publish";
var inject = ["tools", "jobs", "approval"];
var Config = Schema.object({
  accounts: Schema.array(Schema.object({
    platform: Schema.string().required(),
    name: Schema.string().required()
  })).default([]),
  xhsBaseUrl: Schema.string().default(XHS.baseUrl),
  xhsToken: Schema.string(),
  sauBin: Schema.string().default(SAU.bin),
  sauCwd: Schema.string(),
  ledgerPath: Schema.string(),
  requireApproval: Schema.boolean().default(POLICY.requireApproval),
  approvalTimeoutSec: Schema.number().default(POLICY.approvalTimeoutSec),
  dailyLimit: Schema.number().default(POLICY.dailyLimit),
  allowedPlatforms: Schema.array(Schema.string()).default([]),
  allowedAccounts: Schema.array(Schema.string()).default([]),
  headed: Schema.boolean().default(false),
  httpTimeoutMs: Schema.number().default(18e4),
  publishTimeoutMs: Schema.number().default(9e5)
});
function apply(ctx, config) {
  const ledgerPath = config.ledgerPath ?? join(homedir(), ".dsh", "publish", "ledger.json");
  const ledger = new Ledger(ledgerPath);
  const xhs = new XhsAdapter({
    baseUrl: config.xhsBaseUrl,
    timeoutMs: config.httpTimeoutMs,
    ...config.xhsToken === void 0 ? {} : { token: config.xhsToken }
  });
  const sau = new SauAdapter({
    bin: config.sauBin,
    timeoutMs: config.publishTimeoutMs,
    ...config.sauCwd === void 0 ? {} : { cwd: config.sauCwd }
  });
  const jobs = ctx.jobs;
  const approval = ctx.approval;
  void ledger.reconcileOnStart();
  ctx.tools.register(defineTool({
    name: "publish_accounts",
    description: "\u5217\u51FA\u5DF2\u914D\u7F6E\u7684\u53D1\u5E03\u8D26\u53F7\uFF0C\u5E76\u53EF\u67E5\u4E0A\u6E38\u767B\u5F55\u6001\u3002\u53EA\u8BFB\uFF0C\u4E0D\u4F1A\u53D1\u5E03\u3002",
    parameters: {
      platform: { type: "string", description: "\u53EA\u67E5\u67D0\u4E2A\u5E73\u53F0\uFF0C\u7701\u7565\u5219\u5168\u90E8" }
    },
    timeoutMs: 6e4,
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          accounts: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                platform: { type: "string", required: true },
                account: { type: "string", required: true },
                adapter: { type: "string", required: true },
                status: { type: "string", required: true },
                detail: { type: "string" }
              }
            }
          }
        }
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }]
    },
    async execute(args) {
      const rows = config.accounts.filter((item) => args.platform === void 0 || item.platform === args.platform).map((item) => ({ ...item, spec: platformById(item.platform) }));
      const accounts = [];
      for (const row of rows) {
        const spec = row.spec;
        if (!spec) {
          accounts.push({ platform: row.platform, account: row.name, adapter: "unknown", status: "unknown", detail: "\u5E73\u53F0\u672A\u767B\u8BB0" });
          continue;
        }
        if (spec.adapter === "xhs") {
          const status = await xhs.loginStatus();
          accounts.push({
            platform: row.platform,
            account: row.name,
            adapter: spec.adapter,
            status: status.loggedIn ? "valid" : "invalid",
            detail: status.detail
          });
        } else {
          const state = spec.sauName ? await sau.check(spec.sauName, row.name) : "unknown";
          accounts.push({
            platform: row.platform,
            account: row.name,
            adapter: spec.adapter,
            status: state,
            detail: state === "valid" ? "cookie \u53EF\u7528" : state === "invalid" ? "cookie \u5931\u6548\uFF0C\u9700\u91CD\u65B0 login" : "\u65E0\u6CD5\u5224\u5B9A"
          });
        }
      }
      return { accounts };
    }
  }));
  ctx.tools.register(defineTool({
    name: "publish_prepare",
    description: "\u53D1\u5E03\u9884\u68C0\uFF1A\u6821\u9A8C\u5E73\u53F0\u80FD\u529B\u3001\u6807\u9898\u957F\u5EA6\u3001\u5A92\u4F53\u6587\u4EF6\u3001\u914D\u989D\u4E0E\u5B9A\u65F6\u7A97\u53E3\uFF0C\u8FD4\u56DE prepareId \u4E0E\u5185\u5BB9\u6458\u8981\u3002\u4E0D\u53D1\u5E03\u3002",
    parameters: {
      platform: { type: "string", required: true, description: "\u5E73\u53F0 id\uFF0C\u5982 xiaohongshu / douyin" },
      account: { type: "string", required: true, description: "\u8D26\u53F7\u540D\uFF08sau \u7684 --account\uFF09" },
      kind: { type: "string", required: true, description: "video | note | article" },
      title: { type: "string", required: true, description: "\u6807\u9898" },
      body: { type: "string", description: "\u6B63\u6587/\u7B80\u4ECB" },
      tags: { type: "array", items: { type: "string" }, description: "\u8BDD\u9898\u6807\u7B7E" },
      media: { type: "array", items: { type: "string" }, required: true, description: "\u672C\u5730\u7EDD\u5BF9\u8DEF\u5F84" },
      scheduleAt: { type: "string", description: "\u5B9A\u65F6\u65F6\u95F4\uFF1B\u7701\u7565=\u7ACB\u5373\u53D1\u5E03\uFF08\u4E0A\u6E38\u9ED8\u8BA4\uFF09" },
      visibility: { type: "string", description: "\u5C0F\u7EA2\u4E66\u53EF\u89C1\u8303\u56F4\uFF1B\u7701\u7565=\u516C\u5F00\u53EF\u89C1\uFF08\u4E0A\u6E38\u9ED8\u8BA4\uFF09" },
      isOriginal: { type: "boolean", description: "\u5C0F\u7EA2\u4E66\u56FE\u6587\u539F\u521B\u58F0\u660E\uFF1B\u7701\u7565=\u4E0D\u58F0\u660E\uFF08\u4E0A\u6E38\u9ED8\u8BA4\uFF09" }
    },
    timeoutMs: 12e4,
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          prepareId: { type: "string", required: true },
          digest: { type: "string", required: true },
          key: { type: "string", required: true },
          platform: { type: "string", required: true },
          account: { type: "string", required: true },
          kind: { type: "string", required: true },
          title: { type: "string", required: true },
          mediaCount: { type: "number", required: true },
          scheduleAt: { type: "string" },
          deviations: { type: "array", items: { type: "string" }, required: true },
          warnings: { type: "array", items: { type: "string" }, required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }]
    },
    async execute(args, exec) {
      const request = {
        platform: args.platform,
        account: args.account,
        kind: args.kind,
        title: args.title,
        media: args.media,
        ...args.body === void 0 ? {} : { body: args.body },
        ...args.tags === void 0 ? {} : { tags: args.tags },
        ...args.scheduleAt === void 0 ? {} : { scheduleAt: args.scheduleAt },
        ...args.visibility === void 0 ? {} : { visibility: args.visibility },
        ...args.isOriginal === void 0 ? {} : { isOriginal: args.isOriginal }
      };
      const checked = await validate(request, config, ledger);
      const hashes = [];
      for (const file of request.media) hashes.push((await hashFile(file)).hash);
      const digest = digestRequest(request, hashes);
      const key = idempotencyKey(request.platform, request.account, digest);
      const existing = await ledger.get(key);
      if (existing) {
        return toPrepare(existing);
      }
      const prepareId = `prep_${exec.callId}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const entry = {
        key,
        prepareId,
        digest,
        request,
        status: "prepared",
        createdAt: now,
        updatedAt: now,
        deviations: checked.deviations
      };
      await ledger.insert(entry);
      return { ...toPrepare(entry), warnings: checked.warnings };
    }
  }));
  ctx.tools.register(defineTool({
    name: "publish_submit",
    description: "\u6309 prepareId \u63D0\u4EA4\u53D1\u5E03\u3002\u5FC5\u987B\u5148\u5728\u5F53\u524D\u4F1A\u8BDD\u8FC7\u4EBA\u5DE5\u786E\u8BA4\uFF1B\u540C\u4E00\u5185\u5BB9\u91CD\u590D\u63D0\u4EA4\u4E0D\u4F1A\u91CD\u53D1\u3002",
    parameters: {
      prepareId: { type: "string", required: true, description: "publish_prepare \u8FD4\u56DE\u7684 id" }
    },
    timeoutMs: 6e4,
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          accepted: { type: "boolean", required: true },
          status: { type: "string", required: true },
          key: { type: "string", required: true },
          jobId: { type: "string" },
          detail: { type: "string" }
        }
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }]
    },
    async execute(args, exec) {
      const agent = exec.agent;
      if (!agent) throw new Error("\u53D1\u5E03\u53EA\u80FD\u5728\u4F1A\u8BDD\u5185\u6267\u884C");
      const entry = await ledger.byPrepare(args.prepareId);
      if (!entry) throw new Error(`\u6CA1\u6709\u8FD9\u4E2A prepareId\uFF1A${args.prepareId}`);
      if (entry.status !== "prepared") {
        return { accepted: false, status: entry.status, key: entry.key, detail: "\u8BE5\u5185\u5BB9\u5DF2\u63D0\u4EA4\u8FC7\uFF0C\u4E0D\u91CD\u590D\u53D1\u5E03" };
      }
      const spec = platformById(entry.request.platform);
      if (!spec) throw new Error(`\u5E73\u53F0\u672A\u767B\u8BB0\uFF1A${entry.request.platform}`);
      const hashes = [];
      for (const file of entry.request.media) hashes.push((await hashFile(file)).hash);
      if (digestRequest(entry.request, hashes) !== entry.digest) {
        throw new Error("\u5185\u5BB9\u6216\u5A92\u4F53\u5728\u51C6\u5907\u4E4B\u540E\u53D1\u751F\u4E86\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0 prepare");
      }
      if (config.requireApproval) {
        if (!approval) throw new Error("\u5BA1\u6279\u670D\u52A1\u4E0D\u53EF\u7528\uFF1A\u6309 fail-closed \u62D2\u7EDD\u53D1\u5E03");
        const outcome = await approval.request({
          agent,
          toolName: "publish_submit",
          callId: exec.callId,
          reason: `\u53D1\u5E03 ${entry.request.platform}/${entry.request.account}\uFF1A${entry.request.title}\uFF08\u6458\u8981 ${entry.digest.slice(0, 12)}\uFF09`,
          signal: AbortSignal.timeout(config.approvalTimeoutSec * 1e3)
        });
        if (outcome !== "allowed-once") {
          return { accepted: false, status: entry.status, key: entry.key, detail: `\u4EBA\u5DE5\u786E\u8BA4\u672A\u901A\u8FC7\uFF1A${outcome}` };
        }
      }
      await ledger.update(entry.key, { status: "submitting" });
      const publish = () => executePublish(entry, spec, xhs, sau, config, ledger);
      const label = `${entry.request.platform}/${entry.request.account} ${entry.request.title}`;
      if (jobs) {
        const jobId = jobs.start({
          kind: "publish",
          label,
          owner: agent.id,
          run: () => {
            const done = publish().then((result2) => ({
              status: result2.status === "failed" ? "failed" : "completed",
              detail: result2.detail,
              result: JSON.stringify(result2)
            }));
            return {
              done,
              // 取消只停我们这一侧；上游可能已经点过发布，所以不能当失败处理。
              cancel: () => {
                void ledger.update(entry.key, {
                  status: "unknown",
                  note: "\u4EFB\u52A1\u88AB\u53D6\u6D88\uFF1A\u63D0\u4EA4\u7ED3\u679C\u672A\u786E\u8BA4\uFF0C\u5148\u6838\u5BF9\u5E73\u53F0\u539F\u8BB0\u5F55\uFF0C\u7981\u6B62\u76F4\u63A5\u91CD\u53D1"
                });
              }
            };
          }
        });
        await ledger.update(entry.key, { jobId });
        return { accepted: true, status: "submitting", key: entry.key, jobId };
      }
      const result = await publish();
      return { accepted: result.ok, status: result.status, key: entry.key, detail: result.detail };
    }
  }));
  ctx.tools.register(defineTool({
    name: "publish_status",
    description: "\u67E5\u53D1\u5E03\u53F0\u8D26\uFF1A\u6309 prepareId \u67E5\u4E00\u6761\uFF0C\u6216\u5217\u6700\u8FD1\u82E5\u5E72\u6761\u3002unknown \u8868\u793A\u5FC5\u987B\u5148\u4EBA\u5DE5\u6838\u5BF9\uFF0C\u4E0D\u8981\u91CD\u53D1\u3002",
    parameters: {
      prepareId: { type: "string", description: "\u53EA\u770B\u8FD9\u4E00\u6761" },
      limit: { type: "number", description: "\u5217\u8868\u6761\u6570\uFF0C\u9ED8\u8BA4 10" }
    },
    timeoutMs: 3e4,
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          entries: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                prepareId: { type: "string", required: true },
                platform: { type: "string", required: true },
                account: { type: "string", required: true },
                title: { type: "string", required: true },
                status: { type: "string", required: true },
                updatedAt: { type: "string", required: true },
                detail: { type: "string" },
                note: { type: "string" }
              }
            }
          }
        }
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }]
    },
    async execute(args) {
      const rows = args.prepareId === void 0 ? await ledger.list(args.limit ?? 10) : [await ledger.byPrepare(args.prepareId)].filter((row) => row !== void 0);
      return {
        entries: rows.map((row) => ({
          prepareId: row.prepareId,
          platform: row.request.platform,
          account: row.request.account,
          title: row.request.title,
          status: row.status,
          updatedAt: row.updatedAt,
          ...row.detail === void 0 ? {} : { detail: row.detail },
          ...row.note === void 0 ? {} : { note: row.note }
        }))
      };
    }
  }));
}
function toPrepare(entry) {
  return {
    prepareId: entry.prepareId,
    digest: entry.digest,
    key: entry.key,
    platform: entry.request.platform,
    account: entry.request.account,
    kind: entry.request.kind,
    title: entry.request.title,
    mediaCount: entry.request.media.length,
    ...entry.request.scheduleAt === void 0 ? {} : { scheduleAt: entry.request.scheduleAt },
    deviations: entry.deviations,
    warnings: []
  };
}
async function validate(request, config, ledger) {
  const spec = platformById(request.platform);
  if (!spec) throw new Error(`\u5E73\u53F0\u672A\u767B\u8BB0\uFF1A${request.platform}`);
  if (spec.blocked) throw new Error(`${request.platform} v0.1 \u4E0D\u53EF\u7528\uFF1A${spec.blocked}`);
  if (!spec.kinds.includes(request.kind)) throw new Error(`${request.platform} \u4E0D\u652F\u6301 ${request.kind}`);
  const account = config.accounts.find((item) => item.platform === request.platform && item.name === request.account);
  if (!account) throw new Error(`\u8D26\u53F7\u672A\u914D\u7F6E\uFF1A${request.platform}/${request.account}`);
  if (config.allowedAccounts.length > 0 && !config.allowedAccounts.includes(request.account)) {
    throw new Error(`\u8D26\u53F7\u4E0D\u5728\u767D\u540D\u5355\uFF1A${request.account}`);
  }
  if (config.allowedPlatforms.length > 0 && !config.allowedPlatforms.includes(request.platform)) {
    throw new Error(`\u5E73\u53F0\u4E0D\u5728\u767D\u540D\u5355\uFF1A${request.platform}`);
  }
  const titleLength = [...request.title].length;
  if (spec.titleMinChars !== void 0 && titleLength < spec.titleMinChars) {
    throw new Error(`${request.platform} \u6807\u9898\u81F3\u5C11 ${spec.titleMinChars} \u5B57`);
  }
  if (spec.titleMaxChars !== void 0 && titleLength > spec.titleMaxChars) {
    throw new Error(`${request.platform} \u6807\u9898\u6700\u591A ${spec.titleMaxChars} \u5B57\uFF0C\u5F53\u524D ${titleLength}`);
  }
  if (request.media.length === 0) throw new Error("\u81F3\u5C11\u8981\u4E00\u4E2A\u5A92\u4F53\u6587\u4EF6");
  if (request.kind !== "note" && request.media.length !== 1) throw new Error(`${request.kind} \u53EA\u63A5\u53D7\u4E00\u4E2A\u6587\u4EF6`);
  for (const file of request.media) {
    const info = await stat2(file).catch(() => void 0);
    if (!info?.isFile()) throw new Error(`\u5A92\u4F53\u6587\u4EF6\u4E0D\u5B58\u5728\uFF1A${file}`);
  }
  const deviations = [];
  const warnings = [];
  if (request.scheduleAt !== void 0) {
    if (spec.scheduling === "none") throw new Error(`${request.platform} \u4E0A\u6E38\u672A\u63D0\u4F9B\u5B9A\u65F6\u53D1\u5E03`);
    if (spec.scheduling === "sau" && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(request.scheduleAt)) {
      throw new Error(`sau \u5B9A\u65F6\u683C\u5F0F\u4E3A ${SAU.scheduleFormat}`);
    }
    if (spec.scheduling === "xhs") {
      const when = Date.parse(request.scheduleAt);
      if (Number.isNaN(when)) throw new Error("\u5C0F\u7EA2\u4E66\u5B9A\u65F6\u5FC5\u987B\u662F ISO8601 \u65F6\u95F4");
      const hours = (when - Date.now()) / 36e5;
      if (hours < XHS.scheduleMinHours || hours > XHS.scheduleMaxDays * 24) {
        throw new Error(`\u5C0F\u7EA2\u4E66\u5B9A\u65F6\u7A97\u53E3\u4E3A ${XHS.scheduleMinHours} \u5C0F\u65F6\u5230 ${XHS.scheduleMaxDays} \u5929`);
      }
      deviations.push("\u663E\u5F0F\u4F20\u4E86 schedule_at\uFF08\u4E0A\u6E38\u9ED8\u8BA4\u7ACB\u5373\u53D1\u5E03\uFF09");
    }
  }
  if (request.visibility !== void 0) deviations.push(`\u663E\u5F0F\u53EF\u89C1\u8303\u56F4\uFF1A${request.visibility}\uFF08\u4E0A\u6E38\u9ED8\u8BA4\u516C\u5F00\u53EF\u89C1\uFF09`);
  if (request.isOriginal !== void 0) deviations.push(`\u663E\u5F0F\u539F\u521B\u58F0\u660E\uFF1A${request.isOriginal}\uFF08\u4E0A\u6E38\u9ED8\u8BA4\u4E0D\u58F0\u660E\uFF09`);
  if (config.headed) deviations.push("\u6709\u5934\u6A21\u5F0F\uFF08\u4E0A\u6E38\u9ED8\u8BA4 headless\uFF09");
  if (spec.adapter === "xhs" && [...request.body ?? ""].length > XHS.bodyLimitChars) {
    warnings.push(`\u5C0F\u7EA2\u4E66\u6B63\u6587\u8D85\u8FC7 ${XHS.bodyLimitChars} \u5B57\uFF0C\u53EF\u80FD\u88AB\u622A\u65AD`);
  }
  if (config.dailyLimit > 0) {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const count = (await ledger.list(200)).filter((entry) => entry.createdAt.startsWith(today) && ["submitting", "published", "scheduled", "processing"].includes(entry.status)).length;
    if (count >= config.dailyLimit) throw new Error(`\u5DF2\u8FBE\u5F53\u65E5\u53D1\u5E03\u4E0A\u9650 ${config.dailyLimit}`);
  }
  return { warnings, deviations };
}
async function executePublish(entry, spec, xhs, sau, config, ledger) {
  try {
    if (spec.adapter === "xhs") {
      const result2 = await xhs.publish({
        kind: entry.request.kind === "video" ? "video" : "note",
        title: entry.request.title,
        media: entry.request.media,
        ...entry.request.body === void 0 ? {} : { body: entry.request.body },
        ...entry.request.tags === void 0 ? {} : { tags: entry.request.tags },
        ...entry.request.scheduleAt === void 0 ? {} : { scheduleAt: entry.request.scheduleAt },
        ...entry.request.visibility === void 0 ? {} : { visibility: entry.request.visibility },
        ...entry.request.isOriginal === void 0 ? {} : { isOriginal: entry.request.isOriginal }
      });
      const status = result2.ok ? entry.request.scheduleAt === void 0 ? "published" : "scheduled" : "failed";
      await ledger.update(entry.key, { status, detail: result2.detail });
      return { ok: result2.ok, status, detail: result2.detail };
    }
    if (!spec.sauName) throw new Error("\u8BE5\u5E73\u53F0\u6CA1\u6709 sau \u5B50\u547D\u4EE4");
    const result = await sau.upload({
      sauName: spec.sauName,
      account: entry.request.account,
      kind: entry.request.kind,
      title: entry.request.title,
      media: entry.request.media,
      headed: config.headed,
      ...entry.request.body === void 0 ? {} : { body: entry.request.body },
      ...entry.request.tags === void 0 ? {} : { tags: entry.request.tags },
      ...entry.request.scheduleAt === void 0 ? {} : { scheduleAt: entry.request.scheduleAt }
    });
    await ledger.update(entry.key, {
      status: result.status,
      detail: result.detail,
      ...result.status === "unknown" ? { note: "\u63D0\u4EA4\u7ED3\u679C\u672A\u786E\u8BA4\uFF0C\u5148\u6838\u5BF9\u5E73\u53F0\u539F\u8BB0\u5F55\uFF0C\u7981\u6B62\u76F4\u63A5\u91CD\u53D1" } : {}
    });
    return { ok: result.ok, status: result.status, detail: result.detail };
  } catch (error) {
    const detail = error.message;
    await ledger.update(entry.key, { status: "failed", detail });
    return { ok: false, status: "failed", detail };
  }
}
export {
  Config,
  apply,
  inject,
  name
};
