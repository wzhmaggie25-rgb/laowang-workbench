window.__ModuleLoader__.load({id:"dsh-plugin-publish",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/model.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var textFields = ["xhsBaseUrl", "xhsToken", "sauBin", "sauCwd", "dailyTimeZone"];
var numberFields = ["approvalTimeoutSec", "dailyLimit", "httpTimeoutMs", "publishTimeoutMs", "maxMediaBytes"];
var boolFields = ["showSidebar", "publishingEnabled", "requireApproval", "headed"];
var listFields = ["allowedPlatforms", "allowedAccounts"];
var booleanSpec = (field) => ({ field, format: (value) => String(value ?? false), parse: (text) => text === "true" || text === "false" ? { kind: "set", value: text === "true" } : void 0 });
var listSpec = (field) => ({ field, format: (value) => Array.isArray(value) ? value.join(", ") : "", parse: (text) => ({ kind: "set", value: text.split(/[,，]/).map((x) => x.trim()).filter(Boolean) }) });
var accountsSpec = { field: "accounts", format: (value) => JSON.stringify(value ?? []), parse: (text) => {
  try {
    const value = JSON.parse(text);
    if (!Array.isArray(value) || !value.every((row) => typeof row === "object" && row !== null && typeof row.platform === "string" && typeof row.name === "string" && row.name.trim())) return;
    return { kind: "set", value };
  } catch (error) {
    return void 0;
  }
} };
var PublishController = class {
  form;
  settings;
  state = (0, import_dsh_client_store.createSnapshotStore)({ loading: true, busy: false, draft: { platform: "xiaohongshu", account: "default", kind: "note", title: "", body: "", media: [] }, attachments: [], tab: "compose" });
  abort = new AbortController();
  timer;
  generation = 0;
  constructor(scope) {
    this.form = new import_dsh_client_ui_primitives.SettingsFormModel(scope, [...textFields.map((x) => (0, import_dsh_client_ui_primitives.settingsTextField)(x)), ...numberFields.map((x) => (0, import_dsh_client_ui_primitives.settingsNumberField)(x)), ...boolFields.map(booleanSpec), ...listFields.map(listSpec), accountsSpec]);
    this.settings = this.form.bind(() => ({ ...this.form.shell(), fields: Object.fromEntries([...textFields, ...numberFields, ...boolFields, ...listFields, "accounts"].map((key) => [key, this.form.field(key)])) }));
  }
  async call(endpoint, payload = {}) {
    const response = await fetch("api/publish/" + endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: this.abort.signal, credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "\u53D1\u5E03\u63A5\u53E3\u8BF7\u6C42\u5931\u8D25");
    return result.value;
  }
  async refresh() {
    const generation = ++this.generation;
    try {
      const data = await this.call("state");
      if (generation !== this.generation || this.abort.signal.aborted) return;
      this.state.update((s) => {
        if (!s.data && !data.configuredAccounts.some((a) => a.platform === s.draft.platform) && data.configuredAccounts[0]) {
          const first = data.configuredAccounts[0];
          s.draft.platform = first.platform;
          s.draft.kind = data.platforms.find((p) => p.id === first.platform)?.kinds[0] ?? "video";
        }
        const accounts = data.configuredAccounts.filter((a) => a.platform === s.draft.platform);
        if (!accounts.some((a) => a.name === s.draft.account)) {
          s.draft.account = accounts[0]?.name ?? "";
          s.review = void 0;
        }
        s.data = data;
        s.loading = false;
        s.error = void 0;
      });
      if (this.timer) clearTimeout(this.timer);
      if (data.entries.some((x) => x.status === "submitting")) this.timer = setTimeout(() => {
        void this.refresh();
      }, 2500);
    } catch (error) {
      if (!this.abort.signal.aborted) this.state.update((s) => {
        s.loading = false;
        s.error = message(error);
      });
    }
  }
  edit(patch) {
    this.state.update((s) => {
      Object.assign(s.draft, patch);
      s.review = void 0;
      s.error = void 0;
    });
  }
  tab(tab) {
    this.state.update((s) => {
      s.tab = tab;
    });
  }
  async action(work) {
    if (this.state.getSnapshot().busy) return;
    this.state.update((s) => {
      s.busy = true;
      s.error = void 0;
    });
    try {
      await work();
    } catch (error) {
      if (!this.abort.signal.aborted) this.state.update((s) => {
        s.error = message(error);
      });
    } finally {
      if (!this.abort.signal.aborted) this.state.update((s) => {
        s.busy = false;
      });
    }
  }
  async prepare() {
    await this.action(async () => {
      const review = await this.call("prepare", this.state.getSnapshot().draft);
      this.state.update((s) => {
        s.review = review;
      });
    });
  }
  async submit() {
    await this.action(async () => {
      const review = this.state.getSnapshot().review;
      if (!review) throw new Error("\u8BF7\u5148\u9884\u68C0");
      const result = await this.call("submit", { prepareId: review.plan.prepareId, token: review.token, confirmed: true });
      if (!result.accepted) throw new Error(result.detail);
      this.state.update((s) => {
        s.review = void 0;
        s.tab = "tasks";
      });
      await this.refresh();
    });
  }
  async check() {
    await this.action(async () => {
      const result = await this.call("accounts");
      this.state.update((s) => {
        s.accounts = result.accounts;
      });
    });
  }
  async upload(files) {
    if (!files) return;
    await this.action(async () => {
      for (const file of Array.from(files)) {
        const response = await fetch("api/publish.media", { method: "POST", headers: { "x-publish-name": encodeURIComponent(file.name) }, body: file, signal: this.abort.signal, credentials: "same-origin" });
        const value = await response.json();
        if (!response.ok || !value.path) throw new Error(value.error);
        const attachment = { path: value.path, name: file.name, type: file.type, url: file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : void 0 };
        this.state.update((s) => {
          s.attachments.push(attachment);
          s.draft.media.push(attachment.path);
          s.review = void 0;
        });
      }
    });
  }
  remove(path) {
    const item = this.state.getSnapshot().attachments.find((x) => x.path === path);
    if (item?.url) URL.revokeObjectURL(item.url);
    this.state.update((s) => {
      s.attachments = s.attachments.filter((x) => x.path !== path);
      s.draft.media = s.draft.media.filter((x) => x !== path);
      s.review = void 0;
    });
  }
  face() {
    const { edit: editSettings, ...actions } = this.form.actions();
    return { hooks: { publishState: this.state, publishSettings: this.settings }, edit: (patch) => this.edit(patch), setTab: (tab) => this.tab(tab), refresh: () => {
      void this.refresh();
    }, check: () => {
      void this.check();
    }, prepare: () => {
      void this.prepare();
    }, submit: () => {
      void this.submit();
    }, upload: (files) => {
      void this.upload(files);
    }, remove: (path) => this.remove(path), ...actions, editSettings };
  }
  dispose() {
    this.abort.abort();
    if (this.timer) clearTimeout(this.timer);
    this.form.dispose();
    for (const item of this.state.getSnapshot().attachments) if (item.url) URL.revokeObjectURL(item.url);
  }
};
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/client/Page.tsx
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/locales.ts
var zh = {
  title: "\u53D1\u5E03\u4E2D\u5FC3",
  description: "\u7BA1\u7406\u591A\u5E73\u53F0\u5185\u5BB9\u3001\u8D26\u53F7\u4E0E\u53D1\u5E03\u8BB0\u5F55",
  compose: "\u65B0\u5EFA\u53D1\u5E03",
  tasks: "\u53D1\u5E03\u8BB0\u5F55",
  accounts: "\u8D26\u53F7",
  settings: "\u8BBE\u7F6E",
  refresh: "\u5237\u65B0",
  checkAccounts: "\u68C0\u67E5\u767B\u5F55\u72B6\u6001",
  checking: "\u6B63\u5728\u68C0\u67E5",
  retry: "\u91CD\u8BD5",
  loading: "\u6B63\u5728\u8BFB\u53D6\u53D1\u5E03\u8BB0\u5F55",
  empty: "\u8FD8\u6CA1\u6709\u53D1\u5E03\u8BB0\u5F55",
  noAccounts: "\u5C1A\u672A\u914D\u7F6E\u8FD9\u4E2A\u5E73\u53F0\u7684\u8D26\u53F7\uFF0C\u8BF7\u5148\u5728\u8D26\u53F7\u9875\u6DFB\u52A0",
  platform: "\u53D1\u5E03\u5E73\u53F0",
  account: "\u53D1\u5E03\u8D26\u53F7",
  kind: "\u5185\u5BB9\u7C7B\u578B",
  titleField: "\u6807\u9898",
  body: "\u6B63\u6587 / \u7B80\u4ECB",
  tags: "\u8BDD\u9898\u6807\u7B7E",
  tagsHint: "\u7528\u9017\u53F7\u5206\u9694\uFF0C\u4E0D\u542B #",
  media: "\u5A92\u4F53\u6587\u4EF6",
  chooseFiles: "\u9009\u62E9\u6587\u4EF6",
  uploadHint: "\u56FE\u6587\u53EF\u9009\u591A\u5F20\u56FE\u7247\uFF1B\u89C6\u9891\u6216\u6587\u7AE0\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6",
  paths: "\u4F7F\u7528\u672C\u5730\u7EDD\u5BF9\u8DEF\u5F84",
  pathsHint: "\u6BCF\u884C\u4E00\u4E2A\u6587\u4EF6\u8DEF\u5F84\uFF0C\u6587\u4EF6\u987B\u4F4D\u4E8E\u8FD0\u884C\u5DE5\u4F5C\u53F0\u7684\u7535\u8111\u4E0A",
  schedule: "\u5B9A\u65F6\u53D1\u5E03",
  scheduleHint: "\u4F7F\u7528\u5F53\u524D\u7535\u8111\u7684\u65F6\u533A\uFF0C\u5C0F\u7EA2\u4E66\u987B\u63D0\u524D 1 \u5C0F\u65F6\u81F3 14 \u5929",
  visibility: "\u53EF\u89C1\u8303\u56F4",
  public: "\u516C\u5F00\u53EF\u89C1",
  private: "\u4EC5\u81EA\u5DF1\u53EF\u89C1",
  mutual: "\u4EC5\u4E92\u5173\u597D\u53CB\u53EF\u89C1",
  original: "\u58F0\u660E\u539F\u521B",
  preview: "\u9884\u89C8",
  preflight: "\u9884\u68C0\u5E76\u67E5\u770B\u6700\u7EC8\u5185\u5BB9",
  preflighting: "\u6B63\u5728\u9884\u68C0",
  confirm: "\u786E\u8BA4\u53D1\u5E03",
  back: "\u8FD4\u56DE\u7F16\u8F91",
  confirming: "\u6B63\u5728\u63D0\u4EA4",
  confirmHint: "\u8BF7\u6838\u5BF9\u5E73\u53F0\u3001\u8D26\u53F7\u4E0E\u5185\u5BB9\u3002\u786E\u8BA4\u53EA\u9002\u7528\u4E8E\u4E0B\u65B9\u8FD9\u4EFD\u5185\u5BB9\uFF0C\u4FEE\u6539\u540E\u987B\u91CD\u65B0\u9884\u68C0",
  noBody: "\u5C1A\u672A\u586B\u5199\u6B63\u6587",
  noMedia: "\u6DFB\u52A0\u5A92\u4F53\u540E\u53EF\u5728\u6B64\u9884\u89C8",
  remove: "\u79FB\u9664",
  immediate: "\u7ACB\u5373\u53D1\u5E03",
  unknownHint: "\u7ED3\u679C\u5F85\u6838\u5B9E\u7684\u4EFB\u52A1\uFF0C\u8BF7\u5148\u67E5\u770B\u5E73\u53F0\u539F\u8BB0\u5F55\u3002\u4E0D\u8981\u76F4\u63A5\u91CD\u65B0\u53D1\u5E03",
  submittedHint: "\u5DF2\u63D0\u4EA4\u4E0D\u4EE3\u8868\u4F5C\u54C1\u5DF2\u516C\u5F00\uFF0C\u6700\u7EC8\u72B6\u6001\u8BF7\u4EE5\u5E73\u53F0\u8BB0\u5F55\u4E3A\u51C6",
  prepared: "\u5F85\u786E\u8BA4",
  approved: "\u5DF2\u786E\u8BA4",
  submitting: "\u6B63\u5728\u63D0\u4EA4",
  submitted: "\u5DF2\u63D0\u4EA4 \xB7 \u5F85\u6838\u5B9E",
  published: "\u5DF2\u6838\u5B9E\u53D1\u5E03",
  scheduled: "\u5E73\u53F0\u5DF2\u6392\u671F",
  processing: "\u5E73\u53F0\u5904\u7406\u4E2D",
  unknown: "\u7ED3\u679C\u5F85\u6838\u5B9E",
  failed: "\u6267\u884C\u5F02\u5E38",
  video: "\u89C6\u9891",
  note: "\u56FE\u6587",
  article: "\u6587\u7AE0",
  taskTitle: "\u5185\u5BB9",
  time: "\u66F4\u65B0\u65F6\u95F4",
  details: "\u8BE6\u60C5",
  close: "\u6536\u8D77",
  untested: "\u5C1A\u672A\u68C0\u67E5",
  valid: "\u5DF2\u767B\u5F55",
  invalid: "\u9700\u767B\u5F55",
  unavailable: "\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u63D2\u4EF6\u8BBE\u7F6E",
  readOnly: "\u672C\u90E8\u7F72\u7684\u8BBE\u7F6E\u4E3A\u53EA\u8BFB",
  save: "\u4FDD\u5B58\u8BBE\u7F6E",
  saving: "\u6B63\u5728\u4FDD\u5B58",
  saveFailed: "\u4FDD\u5B58\u672A\u6210\u529F\uFF0C\u5DF2\u4FDD\u7559\u4FEE\u6539",
  saved: "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58",
  discard: "\u653E\u5F03\u4FEE\u6539",
  overridden: "\u5DF2\u8986\u76D6",
  reset: "\u6062\u590D\u9ED8\u8BA4",
  invalidNumber: "\u8BF7\u8F93\u5165\u6709\u6548\u503C",
  runtime: "\u4E0A\u4F20\u5F15\u64CE",
  behavior: "\u53D1\u5E03\u89C4\u5219",
  appearance: "\u5165\u53E3\u4E0E\u72B6\u6001",
  limits: "\u8D85\u65F6\u4E0E\u5A92\u4F53",
  addAccount: "\u6DFB\u52A0\u8D26\u53F7",
  accountHint: "\u8D26\u53F7\u522B\u540D\u987B\u4E0E\u4E0A\u6E38\u767B\u5F55\u65F6\u4E00\u81F4\uFF0C\u5C0F\u7EA2\u4E66\u5F53\u524D\u5171\u7528\u4E00\u4E2A\u5F15\u64CE\u767B\u5F55\u6001",
  accountHelp: "\u65B0\u589E\u8D26\u53F7\u540E\u4FDD\u5B58\uFF0C\u518D\u70B9\u51FB\u68C0\u67E5\u767B\u5F55\u72B6\u6001\u3002\u626B\u7801\u767B\u5F55\u4ECD\u7531\u4E0A\u6E38\u672C\u5730\u5DE5\u5177\u5B8C\u6210",
  paused: "\u53D1\u5E03\u5DF2\u6682\u505C\uFF0C\u53EF\u5728\u8BBE\u7F6E\u4E2D\u6062\u590D",
  sidebarHelp: "\u4EC5\u63A7\u5236\u4FA7\u680F\u5165\u53E3\uFF0C\u63D2\u4EF6\u8BBE\u7F6E\u9875\u59CB\u7EC8\u4FDD\u7559\uFF1B\u5173\u95ED\u6574\u4E2A\u63D2\u4EF6\u8BF7\u4F7F\u7528\u63D2\u4EF6\u7BA1\u7406\u9875",
  ledger: "\u5F53\u524D\u53F0\u8D26\u4F4D\u7F6E",
  secretHint: "\u5DF2\u4FDD\u5B58\u7684 Token \u4E0D\u4F1A\u56DE\u663E\uFF0C\u8F93\u5165\u65B0\u503C\u540E\u4FDD\u5B58",
  listHint: "\u4F7F\u7528\u9017\u53F7\u5206\u9694\uFF0C\u7559\u7A7A\u8868\u793A\u4E0D\u9650\u5236",
  dailyTimeZone: "\u6BCF\u65E5\u914D\u989D\u65F6\u533A",
  showSidebar: "\u5728\u4FA7\u680F\u663E\u793A\u53D1\u5E03\u4E2D\u5FC3",
  publishingEnabled: "\u542F\u7528\u53D1\u5E03",
  requireApproval: "\u804A\u5929\u5DE5\u5177\u63D0\u4EA4\u524D\u4EBA\u5DE5\u5BA1\u6279",
  approvalTimeoutSec: "\u786E\u8BA4\u6709\u6548\u671F\uFF08\u79D2\uFF09",
  dailyLimit: "\u6BCF\u65E5\u53D1\u5E03\u4E0A\u9650\uFF080 \u8868\u793A\u4E0D\u9650\uFF09",
  xhsBaseUrl: "\u5C0F\u7EA2\u4E66\u670D\u52A1\u5730\u5740",
  xhsToken: "\u5C0F\u7EA2\u4E66\u9274\u6743 Token",
  sauBin: "sau \u53EF\u6267\u884C\u6587\u4EF6",
  sauCwd: "sau \u5DE5\u4F5C\u76EE\u5F55",
  headed: "sau \u4F7F\u7528\u6709\u5934\u6D4F\u89C8\u5668",
  httpTimeoutMs: "\u5C0F\u7EA2\u4E66\u8BF7\u6C42\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  publishTimeoutMs: "sau \u4E0A\u4F20\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  maxMediaBytes: "\u5355\u6587\u4EF6\u4E0A\u9650\uFF08\u5B57\u8282\uFF09",
  allowedPlatforms: "\u5141\u8BB8\u7684\u5E73\u53F0",
  allowedAccounts: "\u5141\u8BB8\u7684\u8D26\u53F7\u522B\u540D",
  xhsBaseUrlHint: "\u8FDE\u63A5\u73B0\u6709\u672C\u5730\u670D\u52A1\uFF0C\u63D2\u4EF6\u4E0D\u81EA\u52A8\u542F\u52A8\u5B83",
  sauBinHint: "\u53EF\u586B\u5199 sau \u6216\u865A\u62DF\u73AF\u5883\u4E2D sau.exe \u7684\u7EDD\u5BF9\u8DEF\u5F84",
  sauCwdHint: "social-auto-upload \u4ED3\u5E93\u6839\u76EE\u5F55",
  approvalHint: "\u9875\u9762\u59CB\u7EC8\u9700\u8981\u6700\u7EC8\u786E\u8BA4\uFF1B\u6B64\u5F00\u5173\u63A7\u5236\u804A\u5929\u5DE5\u5177\u7684\u539F\u6709\u5BA1\u6279\u884C\u4E3A",
  dailyHint: "\u6CBF\u7528\u5F53\u524D\u63D2\u4EF6\u7684\u6BCF\u65E5\u914D\u989D\u89C4\u5219\uFF0C0 \u8868\u793A\u4E0D\u9650",
  timeoutHint: "\u8BF7\u6C42\u8D85\u65F6\u540E\u987B\u5148\u6838\u5BF9\u5E73\u53F0\u8BB0\u5F55",
  uploadFailed: "\u6587\u4EF6\u4E0A\u4F20\u5931\u8D25",
  operationFailed: "\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5",
  notReady: "\u8BF7\u7B49\u5F85\u63D2\u4EF6\u8FDE\u63A5",
  blocked: "\u6682\u672A\u652F\u6301",
  summary: "\u53D1\u5E03\u3001\u8D26\u53F7\u3001\u4EFB\u52A1\u8BB0\u5F55\u4E0E\u4E0A\u4F20\u5F15\u64CE\u8BBE\u7F6E",
  "platform.xiaohongshu": "\u5C0F\u7EA2\u4E66",
  "platform.douyin": "\u6296\u97F3",
  "platform.kuaishou": "\u5FEB\u624B",
  "platform.tencent": "\u89C6\u9891\u53F7",
  "platform.dayu": "\u5927\u9C7C\u53F7",
  "platform.baijiahao": "\u767E\u5BB6\u53F7",
  "platform.alipay": "\u652F\u4ED8\u5B9D",
  "platform.weibo": "\u5FAE\u535A",
  "platform.hupu": "\u864E\u6251",
  "platform.zhihu": "\u77E5\u4E4E",
  "platform.xueqiu": "\u96EA\u7403",
  "platform.youtube": "YouTube",
  "platform.bilibili": "\u54D4\u54E9\u54D4\u54E9",
  "platform.tiktok": "TikTok"
};
var en = {
  title: "Publish Center",
  description: "Manage content, accounts and publication records",
  compose: "New post",
  tasks: "Records",
  accounts: "Accounts",
  settings: "Settings",
  refresh: "Refresh",
  checkAccounts: "Check sign-in",
  checking: "Checking",
  retry: "Retry",
  loading: "Loading publication records",
  empty: "No publication records yet",
  noAccounts: "Configure an account for this platform first",
  platform: "Platform",
  account: "Account",
  kind: "Content type",
  titleField: "Title",
  body: "Body / description",
  tags: "Tags",
  tagsHint: "Separate with commas, without #",
  media: "Media",
  chooseFiles: "Choose files",
  uploadHint: "Multiple images, one video, or one article file",
  paths: "Use local absolute paths",
  pathsHint: "One path per line on the computer running the Host",
  schedule: "Schedule",
  scheduleHint: "Uses this computer\u2019s time zone; Xiaohongshu requires 1 hour to 14 days ahead",
  visibility: "Visibility",
  public: "Public",
  private: "Only me",
  mutual: "Mutual followers",
  original: "Declare original",
  preview: "Preview",
  preflight: "Validate and review",
  preflighting: "Validating",
  confirm: "Confirm publication",
  back: "Back to editing",
  confirming: "Submitting",
  confirmHint: "Check the platform, account and final content. Any edit requires a new review",
  noBody: "No body yet",
  noMedia: "Add media to preview it here",
  remove: "Remove",
  immediate: "Publish now",
  unknownHint: "Verify uncertain outcomes on the platform before publishing again",
  submittedHint: "Submitted does not mean publicly available. Check the platform record",
  prepared: "Awaiting confirmation",
  approved: "Confirmed",
  submitting: "Submitting",
  submitted: "Submitted \xB7 unverified",
  published: "Verified published",
  scheduled: "Scheduled by platform",
  processing: "Platform processing",
  unknown: "Outcome unknown",
  failed: "Execution error",
  video: "Video",
  note: "Images",
  article: "Article",
  taskTitle: "Content",
  time: "Updated",
  details: "Details",
  close: "Collapse",
  untested: "Not checked",
  valid: "Signed in",
  invalid: "Sign-in required",
  unavailable: "Plugin settings are unavailable",
  readOnly: "Settings are read-only",
  save: "Save settings",
  saving: "Saving",
  saveFailed: "Save failed; your edits were retained",
  saved: "Settings saved",
  discard: "Discard changes",
  overridden: "Overridden",
  reset: "Reset",
  invalidNumber: "Enter a valid value",
  runtime: "Upload engines",
  behavior: "Publishing rules",
  appearance: "Navigation and availability",
  limits: "Timeouts and media",
  addAccount: "Add account",
  accountHint: "Use the same alias as the upstream sign-in. Xiaohongshu currently shares one engine session",
  accountHelp: "Save account changes, then check sign-in. Sign in through the upstream local tools",
  paused: "Publishing is paused. Enable it in Settings",
  sidebarHelp: "Hides only the navigation entry. Plugin settings remain available; disable the plugin in Plugin Manager",
  ledger: "Current ledger",
  secretHint: "Saved tokens are never displayed. Enter a new token to replace it",
  listHint: "Comma-separated; leave blank for unrestricted access",
  dailyTimeZone: "Daily quota time zone",
  showSidebar: "Show Publish Center in sidebar",
  publishingEnabled: "Enable publishing",
  requireApproval: "Require approval for chat tool submissions",
  approvalTimeoutSec: "Confirmation lifetime (seconds)",
  dailyLimit: "Daily limit (0 = unlimited)",
  xhsBaseUrl: "Xiaohongshu service URL",
  xhsToken: "Xiaohongshu auth token",
  sauBin: "sau executable",
  sauCwd: "sau working directory",
  headed: "Use a visible sau browser",
  httpTimeoutMs: "Xiaohongshu timeout (ms)",
  publishTimeoutMs: "sau upload timeout (ms)",
  maxMediaBytes: "Maximum file size (bytes)",
  allowedPlatforms: "Allowed platforms",
  allowedAccounts: "Allowed account aliases",
  xhsBaseUrlHint: "Connects to an existing local service; does not launch it",
  sauBinHint: "sau or an absolute path to sau.exe",
  sauCwdHint: "social-auto-upload repository root",
  approvalHint: "The page always asks for final confirmation; this controls the existing chat tool policy",
  dailyHint: "Uses the existing plugin quota rules; 0 is unlimited",
  timeoutHint: "Verify the platform record after a timeout",
  uploadFailed: "Media upload failed",
  operationFailed: "The operation could not finish. Retry",
  notReady: "Waiting for the plugin connection",
  blocked: "Unavailable",
  summary: "Publishing, accounts, records and engine settings",
  "platform.xiaohongshu": "Xiaohongshu",
  "platform.douyin": "Douyin",
  "platform.kuaishou": "Kuaishou",
  "platform.tencent": "WeChat Channels",
  "platform.dayu": "Dayu",
  "platform.baijiahao": "Baijiahao",
  "platform.alipay": "Alipay",
  "platform.weibo": "Weibo",
  "platform.hupu": "Hupu",
  "platform.zhihu": "Zhihu",
  "platform.xueqiu": "Xueqiu",
  "platform.youtube": "YouTube",
  "platform.bilibili": "Bilibili",
  "platform.tiktok": "TikTok"
};
function platformLabel(id, t) {
  const key = "platform." + id;
  return key in zh ? t(key) : id;
}

// src/client/Page.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function PublishIcon({ size }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.IconSendOutlineRegular, { size });
}
function statusLabel(status, t) {
  const keys = ["prepared", "approved", "submitting", "submitted", "published", "scheduled", "processing", "unknown", "failed", "valid", "invalid"];
  return keys.includes(status) ? t(status) : t("untested");
}
function PublishPage(props) {
  const { t } = props;
  const state = props.usePublishState((s) => s), settings = props.usePublishSettings((s) => s);
  const draft = state.draft, review = state.review;
  const configured = state.data?.configuredAccounts ?? [];
  const spec = state.data?.platforms.find((p) => p.id === draft.platform);
  const accounts = configured.filter((a) => a.platform === draft.platform);
  const disabled = state.busy || !state.data?.publishingEnabled;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-center", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "publish-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: t("title") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("description") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", onClick: props.refresh, disabled: state.busy, children: t("refresh") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", { className: "publish-tabs", role: "tablist", "aria-label": t("title"), children: ["compose", "tasks", "accounts", "settings"].map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", role: "tab", id: "publish-tab-" + tab, "aria-controls": "publish-panel-" + tab, "aria-selected": state.tab === tab, onClick: () => props.setTab(tab), children: t(tab) }, tab)) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-content", role: "tabpanel", id: "publish-panel-" + state.tab, "aria-labelledby": "publish-tab-" + state.tab, children: [
      state.error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-notice", role: "alert", children: [
        state.error,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Button, { onClick: props.refresh, children: t("retry") })
      ] }),
      state.data && !state.data.publishingEnabled && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "publish-notice", children: t("paused") }),
      state.tab === "compose" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-editor", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { className: "publish-section", children: review ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("confirm") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("confirmHint") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", { className: "publish-review", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("platform") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: platformLabel(review.request.platform, t) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("account") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: review.request.account }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("titleField") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: review.request.title }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("body") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { className: "publish-body", children: review.request.body }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("media") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: review.request.media.map((path) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: path.split(/[\\/]/).pop() }, path)) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("schedule") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: review.request.scheduleAt ?? t("immediate") }),
            review.request.visibility && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("visibility") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: review.request.visibility })
            ] }),
            review.request.isOriginal !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("original") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: review.request.isOriginal ? t("original") : "\u2014" })
            ] })
          ] }),
          review.plan.warnings.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "publish-notice", children: w }, w)),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Button, { onClick: () => props.edit({}), disabled: state.busy, children: t("back") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "primary", disabled, onClick: props.submit, children: state.busy ? t("confirming") : t("confirm") })
          ] })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
              t("platform"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: draft.platform, onChange: (e) => {
                const platform = e.target.value;
                const p = state.data?.platforms.find((x) => x.id === platform);
                props.edit({ platform, account: configured.find((a) => a.platform === platform)?.name ?? "", kind: p?.kinds[0] ?? "video", scheduleAt: void 0 });
              }, children: (state.data?.platforms ?? []).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: p.id, disabled: !!p.blocked, children: [
                platformLabel(p.id, t),
                p.blocked ? " \xB7 " + t("blocked") : ""
              ] }, p.id)) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
              t("account"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: draft.account, onChange: (e) => props.edit({ account: e.target.value }), children: accounts.length ? accounts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: a.name }, a.name)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: t("noAccounts") }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
              t("kind"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: draft.kind, onChange: (e) => props.edit({ kind: e.target.value, media: [] }), children: (spec?.kinds ?? ["note"]).map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: kind, children: t(kind) }, kind)) })
            ] })
          ] }),
          !accounts.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "publish-notice", children: t("noAccounts") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            t("titleField"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Input, { value: draft.title, onChange: (e) => props.edit({ title: e.target.value }), maxLength: spec?.titleMaxChars })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            t("body"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { value: draft.body ?? "", rows: 9, onChange: (e) => props.edit({ body: e.target.value }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            t("tags"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Input, { value: (draft.tags ?? []).join(", "), placeholder: t("tagsHint"), onChange: (e) => props.edit({ tags: e.target.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "publish-upload", children: [
              t("chooseFiles"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "file", multiple: draft.kind === "note", disabled: state.busy, accept: draft.kind === "note" ? "image/*" : draft.kind === "video" ? "video/*" : ".md,.txt,.html", onChange: (e) => {
                props.upload(e.target.files);
                e.target.value = "";
              } })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("uploadHint") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "publish-files", children: draft.media.map((path) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: state.attachments.find((x) => x.path === path)?.name ?? path }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Button, { size: "sm", onClick: () => props.remove(path), "aria-label": t("remove") + " " + path.split(/[\\/]/).pop(), children: t("remove") })
          ] }, path)) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("paths") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
              t("pathsHint"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { rows: 3, value: draft.media.join("\n"), onChange: (e) => props.edit({ media: e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) }) })
            ] })
          ] }),
          spec?.scheduling !== "none" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            t("schedule"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "datetime-local", value: scheduleInput(draft.scheduleAt), onChange: (e) => props.edit({ scheduleAt: !e.target.value ? void 0 : draft.platform === "xiaohongshu" ? new Date(e.target.value).toISOString() : e.target.value.replace("T", " ") }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: t("scheduleHint") })
          ] }),
          draft.platform === "xiaohongshu" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
              t("visibility"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { value: draft.visibility ?? "", onChange: (e) => props.edit({ visibility: e.target.value || void 0 }), children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: t("public") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "\u4EC5\u81EA\u5DF1\u53EF\u89C1", children: t("private") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "\u4EC5\u4E92\u5173\u597D\u53CB\u53EF\u89C1", children: t("mutual") })
              ] })
            ] }),
            draft.kind === "note" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "publish-switch", children: [
              t("original"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Switch, { checked: draft.isOriginal === true, label: t("original"), onChange: (value) => props.edit({ isOriginal: value }) })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "primary", onClick: props.prepare, disabled: disabled || !draft.title || !draft.media.length || !accounts.length, children: state.busy ? t("preflighting") : t("preflight") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", { className: "publish-section publish-preview", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("preview") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-preview-meta", children: [
            platformLabel(draft.platform, t),
            " \xB7 ",
            draft.account
          ] }),
          draft.media.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "publish-thumbnails", children: draft.media.map((path) => {
            const item = state.attachments.find((x) => x.path === path);
            return item?.url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: item.type.startsWith("video/") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", { src: item.url, controls: true }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", { src: item.url, alt: item.name }) }, path) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "publish-media-label", children: path.split(/[\\/]/).pop() }, path);
          }) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "publish-empty-media", children: t("noMedia") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: draft.title || t("titleField") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "publish-body", children: draft.body || t("noBody") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: draft.tags?.map((x) => "#" + x).join(" ") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: draft.scheduleAt ?? t("immediate") })
        ] })
      ] }),
      state.tab === "tasks" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "publish-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("submittedHint") }),
        state.data?.entries.some((x) => x.status === "unknown") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "publish-notice", children: t("unknownHint") }),
        state.loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: t("loading") }) : !state.data?.entries.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "publish-empty", children: t("empty") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "publish-table-scroll", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("taskTitle") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("account") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("time") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("details") })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: state.data.entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: entry.request.title }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
                platformLabel(entry.request.platform, t),
                " \xB7 ",
                t(entry.request.kind)
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: entry.request.account }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "publish-status publish-status-" + entry.status, children: statusLabel(entry.status, t) }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: new Date(entry.updatedAt).toLocaleString() })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("details") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: entry.detail ?? entry.note ?? t("prepared") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: entry.note }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: entry.prepareId })
            ] }) })
          ] }, entry.prepareId)) })
        ] }) })
      ] }),
      state.tab === "accounts" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "publish-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-section-heading", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("accounts") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", onClick: props.check, disabled: state.busy, children: state.busy ? t("checking") : t("checkAccounts") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("accountHelp") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "publish-account-status", children: configured.map((a) => {
          const status = state.accounts?.find((s) => s.platform === a.platform && s.account === a.name);
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
              platformLabel(a.platform, t),
              " \xB7 ",
              a.name
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: statusLabel(status?.status ?? "", t) }),
            status?.detail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: status.detail })
          ] }, a.platform + "/" + a.name);
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsContent, { state: settings, t, edit: props.editSettings, resetField: props.resetField, save: props.save, discard: props.discard, onlyAccounts: true })
      ] }),
      state.tab === "settings" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "publish-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsContent, { state: settings, t, edit: props.editSettings, resetField: props.resetField, save: props.save, discard: props.discard }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: t("ledger") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { className: "publish-ledger", children: state.data?.ledgerPath })
      ] })
    ] })
  ] });
}
function scheduleInput(value) {
  if (!value) return "";
  if (!value.includes("T")) return value.replace(" ", "T");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 6e4);
  return local.toISOString().slice(0, 16);
}
function SettingsContent({ state, t, edit, resetField, save, discard, onlyAccounts }) {
  const disabled = !state.writable || state.saving;
  const hints = { xhsBaseUrl: "xhsBaseUrlHint", sauBin: "sauBinHint", sauCwd: "sauCwdHint", xhsToken: "secretHint", requireApproval: "approvalHint", dailyLimit: "dailyHint", showSidebar: "sidebarHelp", httpTimeoutMs: "timeoutHint", publishTimeoutMs: "timeoutHint", allowedAccounts: "listHint", allowedPlatforms: "listHint" };
  const field = (key) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.SettingsValueField, { id: "publish-config-" + key, label: t(key), hint: hints[key] ? t(hints[key]) : void 0, overriddenLabel: t("overridden"), resetLabel: t("reset"), invalidLabel: t("invalidNumber"), numeric: numberFields.includes(key), disabled, ...state.fields[key], onEdit: (value) => edit(key, value), onReset: () => resetField(key) }, key);
  let accounts = [];
  try {
    accounts = JSON.parse(state.fields.accounts?.text ?? "[]");
  } catch (error) {
  }
  const update = (rows) => edit("accounts", JSON.stringify(rows));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.SettingsForm, { state, labels: { unavailable: t("unavailable"), readOnly: t("readOnly"), saveFailed: t("saveFailed"), save: t("save"), saving: t("saving") }, onSave: save, onDiscard: discard, children: onlyAccounts ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("accountHint") }),
    accounts.map((a, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-account-edit", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        t("platform"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: a.platform, disabled, onChange: (e) => update(accounts.map((x, i) => i === index ? { ...x, id: x.id ?? x.platform + "/" + x.name, platform: e.target.value } : x)), children: ["xiaohongshu", "douyin", "kuaishou", "tencent", "dayu", "baijiahao", "alipay", "weibo", "hupu", "zhihu", "xueqiu", "youtube"].map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: id, children: platformLabel(id, t) }, id)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        t("account"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Input, { value: a.name, disabled, onChange: (e) => update(accounts.map((x, i) => i === index ? { ...x, id: x.id ?? x.platform + "/" + x.name, name: e.target.value } : x)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Button, { disabled, onClick: () => update(accounts.filter((_, i) => i !== index)), children: t("remove") })
    ] }, a.id ?? a.platform + "/" + a.name)),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Button, { onClick: () => update([...accounts, { id: crypto.randomUUID(), platform: "douyin", name: "" }]), disabled, children: t("addAccount") })
  ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("appearance") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("sidebarHelp") }),
    boolFields.slice(0, 2).map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "publish-switch", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t(key) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Switch, { checked: state.fields[key]?.text === "true", label: t(key), disabled, onChange: (value) => edit(key, String(value)) })
    ] }, key)),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("runtime") }),
    textFields.filter((key) => key !== "xhsToken").map(field),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
      t("xhsToken"),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Input, { type: "password", autoComplete: "new-password", value: state.fields.xhsToken?.text ?? "", disabled, onChange: (e) => edit("xhsToken", e.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: t("secretHint") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "publish-switch", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("headed") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Switch, { checked: state.fields.headed?.text === "true", label: t("headed"), disabled, onChange: (value) => edit("headed", String(value)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("behavior") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "publish-switch", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        t("requireApproval"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: t("approvalHint") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Switch, { checked: state.fields.requireApproval?.text === "true", label: t("requireApproval"), disabled, onChange: (value) => edit("requireApproval", String(value)) })
    ] }),
    field("dailyLimit"),
    listFields.map(field),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("limits") }),
    numberFields.filter((key) => key !== "dailyLimit").map(field)
  ] }) });
}
function PublishSettings(props) {
  const state = props.usePublishSettings((s) => s);
  if (props.view === "summary") return props.t("summary");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-center publish-settings-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", onClick: props.openCenter, children: props.t("title") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsContent, { state, t: props.t, edit: props.editSettings, resetField: props.resetField, save: props.save, discard: props.discard })
  ] });
}

// src/client/client.css
var client_default = ".publish-center{display:flex;flex-direction:column;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6}\n.publish-center h1,.publish-center h2,.publish-center h3,.publish-center p{margin:0}\n.publish-center h1{font-size:22px;font-weight:500;line-height:30px}\n.publish-center h2{font-size:16px;font-weight:500}.publish-center h3,.publish-center strong{font-weight:500}\n.publish-center p,.publish-center small{color:var(--dsw-alias-label-secondary)}\n.publish-center small{display:block;font-size:12px}\n.publish-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:28px 32px 20px;flex-shrink:0}\n[data-platform=darwin] .publish-header{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}\n.publish-tabs{display:flex;gap:20px;padding:0 32px;border-bottom:.5px solid var(--dsw-alias-border-l3);flex-shrink:0}\n.publish-tabs button{background:transparent;border:0;border-bottom:2px solid transparent;padding:12px 0;cursor:pointer;font:inherit;color:var(--dsw-alias-label-secondary);white-space:nowrap}\n.publish-tabs button[aria-selected=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-label-primary)}\n.publish-content{padding:24px 32px;display:flex;flex-direction:column;gap:16px;max-width:1400px;width:100%;box-sizing:border-box;overflow:auto;flex:1;min-height:0}\n.publish-editor{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;align-items:start}\n.publish-section{display:flex;flex-direction:column;gap:18px;min-width:0;padding:24px;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md,12px)}\n.publish-section-heading,.publish-actions{display:flex;gap:12px;align-items:center;justify-content:space-between}\n.publish-center label{display:flex;flex-direction:column;gap:8px;font-size:13px;min-width:0}\n.publish-center textarea,.publish-center select,.publish-center input[type=datetime-local]{box-sizing:border-box;width:100%;min-width:0;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm,8px);font:inherit;line-height:1.6;color:inherit;background:var(--dsw-alias-bg-base)}\n.publish-center textarea{resize:vertical}.publish-center button:focus-visible,.publish-center input:focus-visible,.publish-center select:focus-visible,.publish-center textarea:focus-visible,.publish-center summary:focus-visible{outline:2px solid var(--dsw-alias-button-primary-bg,var(--dsw-alias-label-primary));outline-offset:3px}\n.publish-row{display:flex;gap:12px;flex-wrap:wrap}.publish-row>label{flex:1;min-width:130px}\n.publish-switch{flex-direction:row!important;align-items:center;justify-content:space-between;gap:20px;padding:10px 0}\n.publish-upload{padding:20px;border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-base);cursor:pointer}\n.publish-upload input{font-size:12px}.publish-files{padding:0;margin:0;list-style:none}.publish-files li{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:.5px solid var(--dsw-alias-border-l3);padding:6px 0}.publish-files span{overflow-wrap:anywhere;min-width:0}\n.publish-preview{position:sticky;top:0;gap:16px}.publish-preview-meta{font-size:12px;color:var(--dsw-alias-label-secondary)}\n.publish-body{white-space:pre-wrap;overflow-wrap:anywhere}.publish-thumbnails{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.publish-thumbnails>div:first-child{grid-column:1/-1}.publish-thumbnails img,.publish-thumbnails video{display:block;width:100%;max-height:320px;object-fit:contain;border-radius:var(--dsw-radius-sm,8px)}.publish-empty-media,.publish-media-label{padding:40px 14px;text-align:center;background:var(--dsw-alias-bg-base);border-radius:var(--dsw-radius-sm,8px);color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}\n.publish-notice{padding:12px 16px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-base);display:flex;gap:12px;align-items:center;justify-content:space-between}\n.publish-review{display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;font-size:13px;margin:0}.publish-review dt{color:var(--dsw-alias-label-secondary)}.publish-review dd{margin:0;overflow-wrap:anywhere}\n.publish-table-scroll{overflow:auto}.publish-center table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}.publish-center th{font-weight:500;color:var(--dsw-alias-label-secondary)}.publish-center td,.publish-center th{padding:14px 12px;border-bottom:.5px solid var(--dsw-alias-border-l3);vertical-align:top}.publish-center td{min-width:100px}.publish-center details p{max-width:360px;overflow-wrap:anywhere}.publish-center summary{cursor:pointer}.publish-status{display:inline-flex;padding:2px 8px;border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-base);white-space:nowrap}.publish-status-unknown,.publish-status-submitted{border:.5px solid var(--dsw-alias-border-l3)}\n.publish-empty{padding:64px 12px;text-align:center;color:var(--dsw-alias-label-secondary)}\n.publish-account-status{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.publish-account-status>div{display:flex;flex-direction:column;gap:8px;padding:16px;background:var(--dsw-alias-bg-base);border-radius:var(--dsw-radius-sm,8px)}\n.publish-account-edit{display:flex;gap:12px;align-items:end;margin-bottom:14px;flex-wrap:wrap}.publish-account-edit label{flex:1;min-width:140px}.publish-settings-card{padding:20px;box-sizing:border-box;gap:20px}.publish-ledger{overflow-wrap:anywhere;font-size:12px}\n@media(max-width:1000px){.publish-editor{grid-template-columns:minmax(0,1fr)}.publish-preview{position:static}.publish-thumbnails{grid-template-columns:repeat(3,minmax(0,1fr))}.publish-thumbnails>div:first-child{grid-column:auto}}\n@media(max-width:520px){.publish-header{padding:20px 16px 12px}.publish-tabs{padding:0 16px;gap:16px;overflow:auto}.publish-content{padding:16px}.publish-section{padding:16px}.publish-row{flex-direction:column}.publish-header h1{font-size:20px}}\n@media(prefers-reduced-motion:reduce){.publish-center *{scroll-behavior:auto!important;transition:none!important}}\n";

// src/client/index.ts
var panel = "publish-center";
var inject = ["slots", "locale", "layout", "configForms"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register("publish.center", { zh, en }), "publish: locale");
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-plugin-publish";
    style.textContent = client_default;
    document.head.appendChild(style);
    return () => style.remove();
  }, "publish: styles");
  const model = new PublishController(ctx.configForms.get("publish"));
  const t = ctx.locale.bind("publish.center");
  const face = () => ({ ...model.face(), openCenter: () => ctx.layout.selectPanel(panel) });
  ctx.effect(() => () => model.dispose(), "publish: page model");
  ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: panel, locale: "publish.center", inject: face }, PublishPage));
  ctx.effect(() => ctx.configForms.whileServed(["publish"], () => ctx.slots.inject("plugins.item", () => ctx.slots.register({ name: "plugins.item", id: "publish", order: 65, locale: "publish.center", label: () => t("title"), inject: face }, PublishSettings))), "publish: settings");
  ctx.effect(() => {
    const form = ctx.configForms.get("publish");
    let release, shown;
    const sync = () => {
      const next = form.getSnapshot().value?.showSidebar ?? true;
      if (next === shown) return;
      shown = next;
      release?.();
      release = void 0;
      if (next) release = ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: panel, order: 15, locale: "publish.center", label: () => t("title") }, PublishIcon));
    };
    sync();
    const unsubscribe = form.subscribe(sync);
    return () => {
      unsubscribe();
      release?.();
    };
  }, "publish: sidebar preference");
  ctx.on("connection/reset", () => {
    void model.refresh();
  });
  ctx.effect(() => ctx.configForms.get("publish").subscribe(() => {
    void model.refresh();
  }), "publish: accepted settings");
  void model.refresh();
}

return module.exports;}});
