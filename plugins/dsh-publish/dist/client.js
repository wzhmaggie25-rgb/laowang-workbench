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

// src/client/order.ts
var PLATFORM_META = {
  xiaohongshu: { bg: "#ff2442", letter: "\u4E66" },
  douyin: { bg: "#161823", letter: "\u97F3" },
  tencent: { bg: "#fa9d3b", letter: "\u53F7" },
  kuaishou: { bg: "#ff6600", letter: "\u624B" },
  zhihu: { bg: "#0084ff", letter: "\u77E5" },
  dayu: { bg: "#3a76c9", letter: "\u9C7C" },
  xueqiu: { bg: "#2e68b5", letter: "\u96EA" },
  bilibili: { bg: "#fb7299", letter: "B" },
  weibo: { bg: "#e6162d", letter: "\u5FAE" },
  hupu: { bg: "#c9151e", letter: "\u864E" },
  baijiahao: { bg: "#2932e1", letter: "\u767E" },
  youtube: { bg: "#ff0000", letter: "\u25B6" },
  alipay: { bg: "#1677ff", letter: "\u652F" }
};
var platformMeta = (id) => PLATFORM_META[id] ?? { bg: "#646a73", letter: id.slice(0, 1).toUpperCase() };
var STATUS_COLOR = {
  published: "#0d8a55",
  scheduled: "#7a3db8",
  unknown: "#b25e09",
  failed: "#d92d20",
  submitting: "#2a5bd7",
  submitted: "#2a5bd7",
  processing: "#646a73",
  prepared: "#8f959e",
  approved: "#8f959e"
};
var statusColor = (status) => STATUS_COLOR[status] ?? "#8f959e";
var ATTEMPTED = ["submitting", "submitted", "published", "scheduled", "processing", "unknown"];
function dayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
function entryDayKey(entry) {
  const scheduled = entry.request.scheduleAt?.slice(0, 10);
  return scheduled ?? entry.submittedAt?.slice(0, 10) ?? entry.updatedAt.slice(0, 10);
}
function moveCard(order, dragId, targetId) {
  const dragIndex = order.indexOf(dragId);
  const targetIndex = order.indexOf(targetId);
  if (dragIndex === -1 || targetIndex === -1 || dragIndex === targetIndex) return [...order];
  const known = order.filter((id) => id !== dragId);
  const at = known.indexOf(targetId);
  const insertAt = dragIndex < targetIndex ? at + 1 : at;
  return [...known.slice(0, insertAt), dragId, ...known.slice(insertAt)];
}
function buildMonth(now) {
  const year = now.getFullYear(), month = now.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push({ day: null, key: "" });
  for (let day = 1; day <= total; day += 1) {
    cells.push({ day, key: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, key: "" });
  return cells;
}
function platformSummary(spec) {
  const kinds = spec.kinds.join(" / ");
  const schedule = spec.scheduling === "none" ? "\u4E0D\u652F\u6301\u5B9A\u65F6" : "\u652F\u6301\u5B9A\u65F6";
  return spec.blocked ? `${kinds} \xB7 ${spec.blocked}` : `${kinds} \xB7 ${schedule}`;
}

// src/client/model.ts
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
  constructor(scope) {
    this.scope = scope;
    this.form = new import_dsh_client_ui_primitives.SettingsFormModel(scope, [...textFields.map((x) => (0, import_dsh_client_ui_primitives.settingsTextField)(x)), ...numberFields.map((x) => (0, import_dsh_client_ui_primitives.settingsNumberField)(x)), ...boolFields.map(booleanSpec), ...listFields.map(listSpec), accountsSpec]);
    this.settings = this.form.bind(() => ({ ...this.form.shell(), fields: Object.fromEntries([...textFields, ...numberFields, ...boolFields, ...listFields, "accounts"].map((key) => [key, this.form.field(key)])) }));
  }
  scope;
  form;
  settings;
  state = (0, import_dsh_client_store.createSnapshotStore)({ loading: true, busy: false, draft: { platform: "douyin", account: "", kind: "note", title: "", body: "", media: [] }, attachments: [], view: { view: "home" }, tab: "assist", moreOpen: false });
  abort = new AbortController();
  timer;
  generation = 0;
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
        if (s.view.view === "platform") {
          const platform = s.view.platform;
          if (!data.configuredAccounts.some((a) => a.platform === platform)) {
            s.view = { view: "home" };
            s.review = void 0;
          }
        }
        if (!s.data && !s.dragOrder) {
          const first = [...data.homeCards].find((id) => data.platforms.some((p) => p.id === id && !p.blocked && data.configuredAccounts.some((a) => a.platform === id)));
          const spec = data.platforms.find((p) => p.id === first);
          if (spec) {
            s.draft.platform = spec.id;
            s.draft.kind = spec.kinds[0];
            s.draft.account = data.configuredAccounts.find((a) => a.platform === spec.id)?.name ?? "";
          }
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
  openPlatform(platform) {
    this.state.update((s) => {
      const spec = s.data?.platforms.find((p) => p.id === platform);
      if (!spec) return;
      s.view = { view: "platform", platform };
      s.tab = "overview";
      s.detailAccount = void 0;
      s.review = void 0;
      s.error = void 0;
      s.draft = { platform, account: s.data?.configuredAccounts.find((a) => a.platform === platform)?.name ?? "", kind: spec.kinds[0], title: "", media: [], body: "", tags: [] };
    });
  }
  backHome() {
    this.state.update((s) => {
      s.view = { view: "home" };
      s.review = void 0;
    });
  }
  setTab(tab) {
    this.state.update((s) => {
      s.tab = tab;
    });
  }
  setDetailAccount(account) {
    this.state.update((s) => {
      s.detailAccount = account || void 0;
    });
  }
  toggleMore() {
    this.state.update((s) => {
      s.moreOpen = !s.moreOpen;
    });
  }
  selectDate(key) {
    this.state.update((s) => {
      s.selectedDate = s.selectedDate === key ? void 0 : key;
    });
  }
  /** 拖拽预览：只改本地顺序，放置时 commitOrder 才落库。 */
  reorder(dragId, targetId) {
    this.state.update((s) => {
      const base = s.dragOrder ?? s.data?.homeCards;
      if (!base) return;
      s.dragOrder = moveCard(base, dragId, targetId);
    });
  }
  cancelDrag() {
    this.state.update((s) => {
      s.dragOrder = void 0;
    });
  }
  /** 一次修订围栏写入；成功后本地 data 即刻对齐，失败返回 false 交给调用方报错。 */
  async writeHomeCards(order) {
    const accepted = await this.scope.mutate([{ op: "set", path: ["homeCards"], value: order }]);
    if (this.abort.signal.aborted) return false;
    if (accepted) this.state.update((s) => {
      if (s.data) s.data.homeCards = order;
      s.dragOrder = void 0;
      s.error = void 0;
    });
    return accepted;
  }
  /** 放置即保存；失败保留本地预览顺序并报错，刷新后以服务端为准。 */
  async commitOrder() {
    const snapshot = this.state.getSnapshot();
    const order = snapshot.dragOrder;
    if (!order || !snapshot.data) return;
    if (JSON.stringify(order) === JSON.stringify(snapshot.data.homeCards)) {
      this.state.update((s) => {
        s.dragOrder = void 0;
      });
      return;
    }
    const accepted = await this.writeHomeCards(order);
    if (!accepted && !this.abort.signal.aborted) this.state.update((s) => {
      s.error = "\u5361\u7247\u987A\u5E8F\u4FDD\u5B58\u672A\u6210\u529F\uFF0C\u5DF2\u4FDD\u7559\u672C\u6B21\u6392\u5217\uFF1B\u8BF7\u91CD\u8BD5";
    });
  }
  /** 「更多平台」面板：把平台加入主页末尾。 */
  async addMore(id) {
    const snapshot = this.state.getSnapshot();
    if (!snapshot.data || snapshot.data.homeCards.includes(id)) return;
    const accepted = await this.writeHomeCards([...snapshot.data.homeCards, id]);
    if (!accepted && !this.abort.signal.aborted) this.state.update((s) => {
      s.error = "\u5361\u7247\u987A\u5E8F\u4FDD\u5B58\u672A\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5";
    });
  }
  /** 「更多平台」面板：把平台从主页挪回面板，不动账号与台账。 */
  async removeMore(id) {
    const snapshot = this.state.getSnapshot();
    if (!snapshot.data) return;
    const accepted = await this.writeHomeCards(snapshot.data.homeCards.filter((card) => card !== id));
    if (!accepted && !this.abort.signal.aborted) this.state.update((s) => {
      s.error = "\u5361\u7247\u987A\u5E8F\u4FDD\u5B58\u672A\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5";
    });
  }
  async loadMetrics() {
    await this.action(() => this.runLoadMetrics());
  }
  async runLoadMetrics() {
    const result = await this.call("metrics.list");
    this.state.update((s) => {
      s.metrics = result.metrics;
    });
  }
  async refreshMetrics() {
    await this.action(async () => {
      const result = await this.call("metrics.refresh", {});
      this.state.update((s) => {
        s.metrics = result.metrics;
        s.error = result.failures.length ? result.failures.join("\uFF1B") : void 0;
      });
    });
  }
  async startBind(prepareId) {
    await this.action(async () => {
      const result = await this.call("notes.list", {});
      this.state.update((s) => {
        s.notes = result.notes;
        s.bindTarget = prepareId;
      });
    });
  }
  async bindNote(noteId) {
    await this.action(async () => {
      const target = this.state.getSnapshot().bindTarget;
      if (!target) throw new Error("\u6CA1\u6709\u5F85\u5173\u8054\u7684\u8BB0\u5F55");
      await this.call("metrics.bind", { prepareId: target, noteId });
      this.state.update((s) => {
        s.bindTarget = void 0;
        s.notes = void 0;
      });
      await this.runLoadMetrics();
    });
  }
  cancelBind() {
    this.state.update((s) => {
      s.bindTarget = void 0;
      s.notes = void 0;
    });
  }
  async unbindNote(prepareId) {
    await this.action(async () => {
      await this.call("metrics.unbind", { prepareId });
      await this.runLoadMetrics();
    });
  }
  /** ===== 智能发布助手 ===== */
  async loadDrafts() {
    await this.action(async () => {
      const result = await this.call("assistant.drafts");
      this.state.update((s) => {
        s.assist = { drafts: result.drafts, platformDrafts: {}, manualRecords: [], rules: s.assist?.rules ?? [], adaptResults: s.assist?.adaptResults ?? {}, instruction: s.assist?.instruction ?? "" };
      });
    });
  }
  async createMaterial(kind, text, origin) {
    await this.action(async () => {
      const result = await this.call("assistant.material", { kind, text, origin });
      await this.runLoadDraft(result.material.draftId);
    });
  }
  async runLoadDraft(draftId) {
    const result = await this.call("assistant.draft", { draftId });
    this.state.update((s) => {
      s.activeDraftId = draftId;
      s.tab = "assist";
      s.view = { view: "home" };
      s.assist = {
        drafts: s.assist?.drafts ?? [],
        material: result.material,
        platformDrafts: Object.fromEntries(result.platformDrafts.map((row) => [row.platform, row.draft])),
        manualRecords: result.manualRecords,
        rules: result.rules,
        adaptResults: s.assist?.adaptResults ?? {},
        instruction: s.assist?.instruction ?? ""
      };
    });
  }
  async loadDraft(draftId) {
    await this.action(() => this.runLoadDraft(draftId));
  }
  setInstruction(text) {
    this.state.update((s) => {
      if (s.assist) s.assist.instruction = text;
    });
  }
  async understand() {
    await this.action(async () => {
      const material = this.state.getSnapshot().assist?.material;
      if (!material) throw new Error("\u5148\u8F93\u5165\u7D20\u6750");
      const result = await this.call("ai.understand", { draftId: material.draftId });
      this.state.update((s) => {
        if (s.assist) s.assist.understanding = result.understanding;
      });
    });
  }
  async adapt(platform, form) {
    await this.action(async () => {
      const snapshot = this.state.getSnapshot();
      const material = snapshot.assist?.material;
      if (!material) throw new Error("\u5148\u8F93\u5165\u7D20\u6750");
      const instruction = snapshot.assist?.instruction.trim() || void 0;
      const result = await this.call("ai.adapt", { draftId: material.draftId, platform, form, ...instruction ? { instruction } : {} });
      this.state.update((s) => {
        if (s.assist) {
          s.assist.platformDrafts = { ...s.assist.platformDrafts, [platform]: result.draft };
          s.assist.adaptResults = { ...s.assist.adaptResults, [platform]: result };
          s.assist.instruction = "";
        }
      });
    });
  }
  async saveField(platform, form, field, text) {
    await this.action(async () => {
      const snapshot = this.state.getSnapshot();
      const draft = snapshot.assist?.platformDrafts[platform];
      if (!draft) throw new Error("\u8BE5\u5E73\u53F0\u8FD8\u6CA1\u6709\u8349\u7A3F");
      const result = await this.call("assistant.saveField", { draftId: snapshot.assist.material.draftId, platform, form, field, text, expectedRevision: draft.revision });
      this.state.update((s) => {
        if (s.assist) {
          s.assist.platformDrafts = { ...s.assist.platformDrafts, [platform]: result.draft };
          const prior = s.assist.adaptResults[platform];
          if (prior) s.assist.adaptResults = { ...s.assist.adaptResults, [platform]: { ...prior, checks: result.checks } };
        }
      });
    });
  }
  async markPublished(platform, link) {
    await this.action(async () => {
      const snapshot = this.state.getSnapshot();
      const material = snapshot.assist?.material;
      if (!material) throw new Error("\u5148\u8F93\u5165\u7D20\u6750");
      const result = await this.call("assistant.mark", { draftId: material.draftId, platform, ...link ? { link } : {} });
      this.state.update((s) => {
        if (s.assist) s.assist.manualRecords = [...s.assist.manualRecords.filter((row) => !(row.platform === platform && row.draftId === material.draftId)), result.record];
      });
    });
  }
  async unmarkPublished(platform) {
    await this.action(async () => {
      const material = this.state.getSnapshot().assist?.material;
      if (!material) throw new Error("\u5148\u8F93\u5165\u7D20\u6750");
      await this.call("assistant.unmark", { draftId: material.draftId, platform });
      await this.runLoadDraft(material.draftId);
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
    return { hooks: { publishState: this.state, publishSettings: this.settings }, edit: (patch) => this.edit(patch), openPlatform: (platform) => this.openPlatform(platform), backHome: () => this.backHome(), setTab: (tab) => this.setTab(tab), setDetailAccount: (account) => this.setDetailAccount(account), toggleMore: () => this.toggleMore(), selectDate: (key) => this.selectDate(key), reorder: (dragId, targetId) => this.reorder(dragId, targetId), commitOrder: () => {
      void this.commitOrder();
    }, cancelDrag: () => this.cancelDrag(), addMore: (id) => {
      void this.addMore(id);
    }, removeMore: (id) => {
      void this.removeMore(id);
    }, loadMetrics: () => {
      void this.loadMetrics();
    }, refreshMetrics: () => {
      void this.refreshMetrics();
    }, startBind: (prepareId) => {
      void this.startBind(prepareId);
    }, bindNote: (noteId) => {
      void this.bindNote(noteId);
    }, cancelBind: () => this.cancelBind(), unbindNote: (prepareId) => {
      void this.unbindNote(prepareId);
    }, loadDrafts: () => {
      void this.loadDrafts();
    }, createMaterial: (kind, text, origin) => {
      void this.createMaterial(kind, text, origin);
    }, loadDraft: (draftId) => {
      void this.loadDraft(draftId);
    }, setInstruction: (text) => this.setInstruction(text), understand: () => {
      void this.understand();
    }, adapt: (platform, form) => {
      void this.adapt(platform, form);
    }, saveField: (platform, form, field, text) => {
      void this.saveField(platform, form, field, text);
    }, markPublished: (platform, link) => {
      void this.markPublished(platform, link);
    }, unmarkPublished: (platform) => {
      void this.unmarkPublished(platform);
    }, refresh: () => {
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
var import_react3 = require("react");
var import_dsh_client_ui_primitives5 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/common.tsx
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
  overview: "\u603B\u89C8",
  backToOverview: "\u8FD4\u56DE\u603B\u89C8",
  viewPlatform: "\u67E5\u770B\u8BE5\u5E73\u53F0",
  newPost: "\u65B0\u5EFA\u53D1\u5E03",
  morePlatforms: "\u66F4\u591A\u5E73\u53F0",
  morePlatformsHint: "\u5DF2\u767B\u8BB0\u7684\u5E73\u53F0\u90FD\u4F1A\u5728\u8FD9\u91CC\uFF0C\u5E26\u5F15\u64CE\u80CC\u4E66\u4E0E\u9650\u5236\u8BF4\u660E",
  openMorePanel: "\u6253\u5F00\u9762\u677F",
  addToHome: "\u6DFB\u52A0\u5230\u4E3B\u9875",
  removeFromHome: "\u4ECE\u4E3B\u9875\u79FB\u9664",
  pendingAcceptance: "\u5F85\u53D7\u63A7\u9A8C\u6536",
  notChecked: "\u672A\u68C0\u67E5",
  notConfigured: "\u672A\u914D\u7F6E",
  todayPublished: "\u4ECA\u65E5\u5DF2\u53D1",
  monthPublished: "\u672C\u6708\u5DF2\u53D1",
  pendingCount: "\u5F85\u6838\u5B9E",
  scheduledCount: "\u5DF2\u6392\u671F",
  globalCalendar: "\u53D1\u5E03\u65E5\u5386\uFF08\u5168\u5C40 \xB7 \u70B9\u65E5\u671F\u8FC7\u6EE4\uFF09",
  dayRecords: "\u5F53\u65E5\u8BB0\u5F55",
  monthRhythm: "\u672C\u6708\u8282\u594F",
  platformOnly: "\u4EC5\u672C\u5E73\u53F0",
  allAccounts: "\u5168\u90E8\u8D26\u53F7",
  wd1: "\u4E00",
  wd2: "\u4E8C",
  wd3: "\u4E09",
  wd4: "\u56DB",
  wd5: "\u4E94",
  wd6: "\u516D",
  wd7: "\u65E5",
  dataCenter: "\u6570\u636E\u4E2D\u5FC3",
  xhsDataOnly: "\u4EC5\u5C0F\u7EA2\u4E66 \xB7 \u4E0A\u6E38\u65E0\u64AD\u653E\u91CF",
  likes: "\u70B9\u8D5E",
  collects: "\u6536\u85CF",
  comments: "\u8BC4\u8BBA",
  shares: "\u5206\u4EAB",
  autoMatched: "\u81EA\u52A8\u5339\u914D",
  manualMatched: "\u624B\u52A8\u7ED1\u5B9A",
  refreshData: "\u5237\u65B0\u6570\u636E",
  bindNote: "\u5173\u8054\u7B14\u8BB0",
  unbindNote: "\u89E3\u7ED1",
  noData: "\u8FD8\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u6570\u636E",
  assistTab: "\u667A\u80FD\u53D1\u5E03",
  draftsTab: "\u8349\u7A3F",
  draftsTitle: "\u8349\u7A3F",
  draftsEmpty: "\u8FD8\u6CA1\u6709\u8349\u7A3F\uFF1B\u53BB\u300C\u667A\u80FD\u53D1\u5E03\u300D\u8D34\u5165\u7B2C\u4E00\u4EFD\u7D20\u6750",
  assistTitle: "\u8FD9\u6B21\u8981\u53D1\u4EC0\u4E48\uFF1F",
  assistHint: "\u7C98\u8D34\u6210\u7A3F\uFF0C\u6216\u9009\u62E9 Markdown / TXT / SRT \u5B57\u5E55\u6587\u4EF6\u3002AI \u5148\u7406\u89E3\u5185\u5BB9\uFF0C\u518D\u6309\u5E73\u53F0\u751F\u6210\u53EF\u53D1\u5E03\u7684\u7248\u672C\uFF1B\u53D1\u5E03\u6C38\u8FDC\u7531\u4F60\u5B8C\u6210\u3002",
  assistPlaceholder: "\u628A\u8FD9\u6B21\u8981\u53D1\u7684\u5185\u5BB9\u7C98\u5230\u8FD9\u91CC\u2026\uFF08\u652F\u6301\u5B57\u5E55\u3001\u8BB2\u7A3F\u3001\u6587\u7AE0\u8349\u7A3F\uFF09",
  assistOrigin: "\u6765\u6E90\u5907\u6CE8",
  assistPickSrt: "\u9009\u62E9 MD/TXT/SRT \u6587\u4EF6",
  assistStart: "\u5F00\u59CB",
  assistNewMaterial: "\u6362\u4E00\u4EFD\u7D20\u6750",
  assistMaterial: "\u7D20\u6750",
  assistViewMaterial: "\u67E5\u770B\u7D20\u6750\u539F\u6587",
  assistAttachmentsNotRead: "\u9644\u4EF6\u672A\u8BFB\u53D6\u5185\u5BB9\uFF1A",
  assistUnderstand: "AI \u7406\u89E3\u4E0E\u63A8\u8350",
  assistThinking: "\u751F\u6210\u4E2D\u2026",
  assistUnderstanding: "AI \u7684\u7406\u89E3",
  assistAudience: "\u9762\u5411",
  assistQuestion: "\u7D20\u6750\u7F3A\u4E00\u4E2A\u5173\u952E\u4E8B\u5B9E\uFF1A",
  assistRetryUnderstand: "\u91CD\u8BD5\u7406\u89E3",
  assistSuggestions: "\u5EFA\u8BAE\u53D1\u5E03\u5230",
  assistTargeted: "\u5B9A\u5411\u4FEE\u6539\uFF08\u53EF\u9009\uFF09",
  assistInstructionHint: "\u4F8B\u5982\uFF1A\u53EA\u6539\u5C0F\u7EA2\u4E66\u5F00\u5934\uFF1B\u516C\u4F17\u53F7\u4FDD\u7559\u539F\u6587\u4E0D\u6269\u5199\uFF1B\u4E09\u4E2A\u5E73\u53F0\u90FD\u5C11\u4E00\u70B9\u63A8\u9500\u53E3\u543B",
  assistInstructionNote: "\u586B\u5199\u540E\u70B9\u4EFB\u610F\u5E73\u53F0\u7684\u300C\u91CD\u65B0\u751F\u6210\u300D\u5373\u6309\u6B64\u6307\u4EE4\u5B9A\u5411\u4FEE\u6539\uFF1B\u53EA\u4F5C\u7528\u4E8E\u672A\u88AB\u4F60\u6539\u8FC7\u7684\u5B57\u6BB5\u3002",
  assistChanges: "\u6539\u4E86\u4EC0\u4E48\u3001\u4E3A\u4EC0\u4E48",
  assistWarnings: "AI \u81EA\u67E5\u63D0\u9192\uFF1A",
  assistProtected: "\u4F60\u6539\u8FC7\u7684\u5B57\u6BB5\u4E0D\u4F1A\u88AB\u8986\u76D6\uFF08\u4FDD\u6301\u4F60\u7684\u7248\u672C\uFF09\uFF1A",
  assistRegenerate: "\u91CD\u65B0\u751F\u6210",
  assistEdited: "\u5DF2\u4EBA\u5DE5\u4FEE\u6539",
  assistCopy: "\u590D\u5236",
  assistCopied: "\u5DF2\u590D\u5236",
  assistCopyAll: "\u590D\u5236\u5168\u90E8",
  assistWeighted: "\u52A0\u6743\u5B57\u7B26",
  assistChars: "\u5B57",
  assistEmptyField: "\uFF08\u7A7A\uFF09\u70B9\u6B64\u586B\u5199",
  assistOpenStudio: "\u6253\u5F00\u53D1\u5E03\u9875",
  assistMark: "\u6807\u8BB0\u5DF2\u53D1",
  assistMarkConfirm: "\u786E\u8BA4\u5DF2\u53D1",
  assistUnmark: "\u64A4\u9500\u6807\u8BB0",
  assistLinkOptional: "\u4F5C\u54C1\u94FE\u63A5\uFF08\u9009\u586B\uFF09",
  assistMarked: "\u5DF2\u6807\u8BB0\u53D1\u5E03",
  assistMarkedNote: "\u4EBA\u5DE5\u6807\u8BB0\uFF0C\u672A\u6838\u9A8C \xB7 ",
  assistReady: "\u5DF2\u5C31\u7EEA",
  assistDraft: "\u8349\u7A3F",
  assistHardExceeded: "\u8D85\u51FA\u786C\u9650",
  "platform.gongzhonghao": "\u516C\u4F17\u53F7",
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
  overview: "Overview",
  backToOverview: "Back to overview",
  viewPlatform: "Open platform",
  newPost: "New post",
  morePlatforms: "More platforms",
  morePlatformsHint: "Every registered platform lives here, with engines and limitations stated",
  openMorePanel: "Open panel",
  addToHome: "Add to home",
  removeFromHome: "Remove from home",
  pendingAcceptance: "Pending acceptance",
  notChecked: "Not checked",
  notConfigured: "Not configured",
  todayPublished: "Today",
  monthPublished: "This month",
  pendingCount: "To verify",
  scheduledCount: "Scheduled",
  globalCalendar: "Calendar (global \xB7 click a date to filter)",
  dayRecords: "Records on this day",
  monthRhythm: "This month",
  platformOnly: "This platform only",
  allAccounts: "All accounts",
  wd1: "Mon",
  wd2: "Tue",
  wd3: "Wed",
  wd4: "Thu",
  wd5: "Fri",
  wd6: "Sat",
  wd7: "Sun",
  dataCenter: "Data center",
  xhsDataOnly: "Xiaohongshu only \xB7 upstream has no view counts",
  likes: "Likes",
  collects: "Collects",
  comments: "Comments",
  shares: "Shares",
  autoMatched: "Auto matched",
  manualMatched: "Manually linked",
  refreshData: "Refresh data",
  bindNote: "Link note",
  unbindNote: "Unlink",
  noData: "Nothing to show yet",
  assistTab: "Smart publish",
  draftsTab: "Drafts",
  draftsTitle: "Drafts",
  draftsEmpty: "No drafts yet; paste your first material in Smart publish",
  assistTitle: "What are you publishing this time?",
  assistHint: "Paste a finished draft, or pick a Markdown / TXT / SRT file. AI understands it first, then generates per-platform versions; publishing stays yours.",
  assistPlaceholder: "Paste the content to publish\u2026 (subtitles, script, article draft)",
  assistOrigin: "Origin note",
  assistPickSrt: "Pick MD/TXT/SRT file",
  assistStart: "Start",
  assistNewMaterial: "New material",
  assistMaterial: "Material",
  assistViewMaterial: "View original material",
  assistAttachmentsNotRead: "Attachments not read: ",
  assistUnderstand: "Understand & recommend",
  assistThinking: "Generating\u2026",
  assistUnderstanding: "AI understanding",
  assistAudience: "Audience",
  assistQuestion: "One key fact is missing: ",
  assistRetryUnderstand: "Retry understanding",
  assistSuggestions: "Suggested for",
  assistTargeted: "Targeted revision (optional)",
  assistInstructionHint: "e.g. only rewrite the Xiaohongshu opening; keep the article verbatim; soften the sales tone everywhere",
  assistInstructionNote: "Fill this, then click Regenerate on a platform to apply it; fields you edited are never overwritten.",
  assistChanges: "What changed and why",
  assistWarnings: "AI self-check: ",
  assistProtected: "Fields you edited are kept as yours: ",
  assistRegenerate: "Regenerate",
  assistEdited: "Edited by you",
  assistCopy: "Copy",
  assistCopied: "Copied",
  assistCopyAll: "Copy all",
  assistWeighted: "weighted chars",
  assistChars: " chars",
  assistEmptyField: "(empty) click to fill",
  assistOpenStudio: "Open studio",
  assistMark: "Mark published",
  assistMarkConfirm: "Confirm",
  assistUnmark: "Undo mark",
  assistLinkOptional: "Post link (optional)",
  assistMarked: "Marked published",
  assistMarkedNote: "Manually marked, unverified \xB7 ",
  assistReady: "Ready",
  assistDraft: "Draft",
  assistHardExceeded: "Over hard limit",
  "platform.gongzhonghao": "Official Account",
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

// src/client/common.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var STATUS_KEYS = ["prepared", "approved", "submitting", "submitted", "published", "scheduled", "processing", "unknown", "failed", "valid", "invalid"];
function statusLabel(status, t) {
  return STATUS_KEYS.includes(status) ? t(status) : t("untested");
}
function PlatformIcon({ id, size }) {
  const meta = platformMeta(id);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "publish-pico", style: { background: meta.bg, fontSize: Math.round(size * 0.45) }, "aria-hidden": true, children: meta.letter });
}
var recordDay = (entry) => entryDayKey(entry);
function Calendar({ entries, colorFor, selected, onSelect, month, title, legend, t, interactive = true }) {
  const cells = buildMonth(month);
  const byDay = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const key = recordDay(entry);
    byDay.set(key, [...byDay.get(key) ?? [], entry]);
  }
  const monthValue = String(month.getMonth() + 1).padStart(2, "0");
  const today = month.getFullYear() + "-" + monthValue + "-" + String((/* @__PURE__ */ new Date()).getDate()).padStart(2, "0");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-cal", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-cal-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "publish-cal-legend", children: legend.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "dot", style: { background: item.color } }),
        item.label
      ] }, item.label)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-calgrid", children: [
      [1, 2, 3, 4, 5, 6, 7].map((number) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "publish-wd", children: t("wd" + number) }, number)),
      cells.map((cell, index) => {
        if (cell.day === null) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "publish-cell off" }, "off" + index);
        const count = byDay.get(cell.key)?.length ?? 0;
        const className = "publish-cell" + (cell.key === today ? " today" : "") + (cell.key === selected ? " picked" : "") + (interactive ? "" : " static");
        return interactive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className, "aria-pressed": cell.key === selected, onClick: () => onSelect(cell.key), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CellBody, { day: cell.day, items: byDay.get(cell.key), colorFor }) }, cell.key) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CellBody, { day: cell.day, items: byDay.get(cell.key), colorFor }),
          count > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "publish-cnt", children: count })
        ] }, cell.key);
      })
    ] })
  ] });
}
function CellBody({ day, items, colorFor }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "publish-cell-day", children: day }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "publish-ev", children: (items ?? []).slice(0, 4).map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { background: colorFor(entry) } }, entry.prepareId)) })
  ] });
}
function RecordRow({ entry, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-rec", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-rec-l1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "publish-rec-t", children: entry.request.title }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "chip publish-status publish-status-" + entry.status, children: statusLabel(entry.status, t) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "publish-rec-l2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        platformLabel(entry.request.platform, t),
        " \xB7 ",
        entry.request.account,
        " \xB7 ",
        t(entry.request.kind)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        new Date(recordDay(entry)).toLocaleDateString(),
        " ",
        new Date(entry.updatedAt).toLocaleTimeString()
      ] })
    ] }),
    (entry.detail !== void 0 || entry.note !== void 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("details") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: entry.detail }),
      entry.note && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "publish-note-flag", children: entry.note }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: entry.prepareId })
    ] })
  ] });
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
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: a.platform, disabled, onChange: (e) => update(accounts.map((x, i) => i === index ? { ...x, id: x.id ?? x.platform + "/" + x.name, platform: e.target.value } : x)), children: ["xiaohongshu", "douyin", "kuaishou", "tencent", "dayu", "baijiahao", "weibo", "zhihu", "xueqiu"].map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: id, children: platformLabel(id, t) }, id)) })
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

// src/client/PlatformDetail.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime2 = require("react/jsx-runtime");
var BINDABLE = ["submitted", "published", "unknown"];
function PlatformDetail({ state, face, t, month, data }) {
  const platform = state.view.view === "platform" ? state.view.platform : void 0;
  if (!platform) return null;
  const spec = data.platforms.find((p) => p.id === platform);
  if (!spec) return null;
  const accounts = data.configuredAccounts.filter((a) => a.platform === platform);
  const records = data.entries.filter((e) => e.request.platform === platform && (!state.detailAccount || e.request.account === state.detailAccount));
  const accountStates = state.accounts?.filter((s) => s.platform === platform) ?? [];
  const loginChip = accounts.length === 0 ? null : accountStates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "chip c-muted", children: t("notChecked") }) : accountStates.some((s) => s.status === "invalid") ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "chip c-unknown", children: t("invalid") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "chip c-ok", children: t("valid") });
  const platformEntries = data.entries.filter((e) => e.request.platform === platform);
  const legend = [...new Set(platformEntries.map((e) => e.status))].map((status) => ({ color: statusColor(status), label: statusLabel(status, t) }));
  (0, import_react.useEffect)(() => {
    if (platform === "xiaohongshu" && !spec.blocked) face.loadMetrics();
  }, [platform, spec.blocked, face]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-detail", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-detail-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", onClick: face.backHome, children: t("backToOverview") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PlatformIcon, { id: platform, size: 34 }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-who", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: platformLabel(platform, t) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("select", { value: state.detailAccount ?? "", onChange: (e) => face.setDetailAccount(e.target.value), "aria-label": t("account"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: t("allAccounts") }),
          accounts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: a.name, children: a.name }, a.name))
        ] }),
        loginChip,
        spec.acceptance === "pending" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "chip c-warn", children: t("pendingAcceptance") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "publish-detail-acts", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", onClick: face.check, disabled: state.busy, children: state.busy ? t("checking") : t("checkAccounts") }) })
    ] }),
    spec.blocked ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("section", { className: "publish-section", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "publish-na", children: spec.blocked }) }) : accounts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "publish-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "publish-na", children: t("noAccounts") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { onClick: () => face.setTab("accounts"), children: t("addAccount") })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ComposeSection, { state, face, t, spec, data }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-detail-cols", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "publish-section publish-records", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h2", { children: [
          t("tasks"),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "chip c-muted", children: t("platformOnly") })
        ] }),
        records.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "publish-empty", children: t("empty") }) : records.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RecordRow, { entry, t }, entry.prepareId))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-side", children: [
        platform === "xiaohongshu" && !spec.blocked && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DataCenter, { state, face, t, data }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "publish-sidebox", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Calendar, { entries: platformEntries, colorFor: (e) => statusColor(e.status), onSelect: () => {
        }, interactive: false, month, title: t("monthRhythm"), legend, t }) })
      ] })
    ] })
  ] });
}
function DataCenter({ state, face, t, data }) {
  const eligible = data.entries.filter((entry) => entry.request.platform === "xiaohongshu" && BINDABLE.includes(entry.status));
  const metricsOf = (entry) => state.metrics?.[entry.key];
  const bound = eligible.filter((entry) => metricsOf(entry)?.noteRef);
  const unbound = eligible.filter((entry) => !metricsOf(entry)?.noteRef);
  const totals = { likes: 0, collects: 0, comments: 0, shares: 0 };
  for (const entry of bound) {
    const latest = metricsOf(entry)?.snapshots.at(-1);
    totals.likes += latest?.likes ?? 0;
    totals.collects += latest?.collects ?? 0;
    totals.comments += latest?.comments ?? 0;
    totals.shares += latest?.shares ?? 0;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-sidebox", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { children: [
      t("dataCenter"),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "chip c-muted", children: t("xhsDataOnly") })
    ] }),
    eligible.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "publish-na", children: t("noData") }),
    bound.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-tiles", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "tile", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: totals.likes }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("likes") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "tile", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: totals.collects }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("collects") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "tile", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: totals.comments }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("comments") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "tile", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: totals.shares }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("shares") })
      ] })
    ] }),
    bound.map((entry) => {
      const metrics = metricsOf(entry);
      const latest = metrics.snapshots.at(-1);
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-metric-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-metric-main", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: metrics.noteRef.title }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("small", { children: [
            metrics.noteRef.method === "auto" ? t("autoMatched") : t("manualMatched"),
            " \xB7 ",
            latest ? `${latest.likes ?? "\u2014"} / ${latest.collects ?? "\u2014"} / ${latest.comments ?? "\u2014"} / ${latest.shares ?? "\u2014"}` : t("noData")
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-metric-acts", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", onClick: face.refreshMetrics, disabled: state.busy, children: t("refreshData") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", onClick: () => face.unbindNote(entry.prepareId), disabled: state.busy, children: t("unbindNote") })
        ] })
      ] }, entry.prepareId);
    }),
    unbound.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-metric-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-metric-main", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: entry.request.title }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { children: statusLabel(entry.status, t) })
      ] }),
      state.bindTarget === entry.prepareId ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-notes-picker", children: [
        (state.notes ?? []).map((note) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-notes-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "t", children: note.title }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", onClick: () => face.bindNote(note.noteId), disabled: state.busy, children: t("bindNote") })
        ] }, note.noteId)),
        (state.notes?.length ?? 0) === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "publish-na", children: t("noData") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", onClick: face.cancelBind, disabled: state.busy, children: t("back") })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "publish-metric-acts", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", onClick: () => face.startBind(entry.prepareId), disabled: state.busy, children: t("bindNote") }) })
    ] }, entry.prepareId)),
    eligible.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "publish-refreshrow", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", onClick: face.refreshMetrics, disabled: state.busy, children: state.busy ? t("checking") : t("refreshData") }) })
  ] });
}
function ComposeSection({ state, face, t, spec, data }) {
  const draft = state.draft, review = state.review;
  const accounts = data.configuredAccounts.filter((a) => a.platform === draft.platform);
  const disabled = state.busy || !data.publishingEnabled;
  if (review) return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "publish-section", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("confirm") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("confirmHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("dl", { className: "publish-review", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("platform") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: platformLabel(review.request.platform, t) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("account") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: review.request.account }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("titleField") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: review.request.title }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("body") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { className: "publish-body", children: review.request.body }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("media") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: review.request.media.map((path) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: path.split(/[\\/]/).pop() }, path)) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("schedule") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: review.request.scheduleAt ?? t("immediate") }),
      review.request.visibility && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("visibility") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: review.request.visibility })
      ] }),
      review.request.isOriginal !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("original") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: review.request.isOriginal ? t("original") : "\u2014" })
      ] })
    ] }),
    review.plan.warnings.map((w) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "publish-notice", children: w }, w)),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { onClick: () => face.edit({}), disabled: state.busy, children: t("back") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "primary", disabled, onClick: face.submit, children: state.busy ? t("confirming") : t("confirm") })
    ] })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "publish-section", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("newPost") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "publish-kindtabs", role: "tablist", "aria-label": t("kind"), children: spec.kinds.map((kind) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", role: "tab", "aria-selected": draft.kind === kind, onClick: () => face.edit({ kind, media: [], scheduleAt: void 0 }), children: t(kind) }, kind)) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { children: [
        t("account"),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("select", { value: draft.account, onChange: (e) => face.edit({ account: e.target.value }), children: accounts.length ? accounts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { children: a.name }, a.name)) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: t("noAccounts") }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { children: [
        t("titleField"),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Input, { value: draft.title, onChange: (e) => face.edit({ title: e.target.value }), maxLength: spec.titleMaxChars })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { children: [
      t("body"),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("textarea", { value: draft.body ?? "", rows: 9, onChange: (e) => face.edit({ body: e.target.value }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { children: [
      t("tags"),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Input, { value: (draft.tags ?? []).join(", "), placeholder: t("tagsHint"), onChange: (e) => face.edit({ tags: e.target.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean) }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "publish-upload", children: [
        t("chooseFiles"),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "file", multiple: draft.kind === "note", disabled: state.busy, accept: draft.kind === "note" ? "image/*" : draft.kind === "video" ? "video/*" : ".md,.txt,.html", onChange: (e) => {
          face.upload(e.target.files);
          e.target.value = "";
        } })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("uploadHint") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "publish-files", children: draft.media.map((path) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: state.attachments.find((x) => x.path === path)?.name ?? path }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", onClick: () => face.remove(path), "aria-label": t("remove") + " " + path.split(/[\\/]/).pop(), children: t("remove") })
    ] }, path)) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("summary", { children: t("paths") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { children: [
        t("pathsHint"),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("textarea", { rows: 3, value: draft.media.join("\n"), onChange: (e) => face.edit({ media: e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) }) })
      ] })
    ] }),
    spec.scheduling !== "none" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { children: [
      t("schedule"),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "datetime-local", value: scheduleInput(draft.scheduleAt), onChange: (e) => face.edit({ scheduleAt: !e.target.value ? void 0 : draft.platform === "xiaohongshu" ? new Date(e.target.value).toISOString() : e.target.value.replace("T", " ") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { children: t("scheduleHint") })
    ] }),
    draft.platform === "xiaohongshu" && draft.kind === "note" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "publish-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { children: [
        t("visibility"),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("select", { value: draft.visibility ?? "", onChange: (e) => face.edit({ visibility: e.target.value || void 0 }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: t("public") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "\u4EC5\u81EA\u5DF1\u53EF\u89C1", children: t("private") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "\u4EC5\u4E92\u5173\u597D\u53CB\u53EF\u89C1", children: t("mutual") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "publish-switch", children: [
        t("original"),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Switch, { checked: draft.isOriginal === true, label: t("original"), onChange: (value) => face.edit({ isOriginal: value }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "primary", onClick: face.prepare, disabled: disabled || !draft.title || !draft.media.length || !draft.account, children: state.busy ? t("preflighting") : t("preflight") })
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

// src/client/Assistant.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime3 = require("react/jsx-runtime");
var FORM_LABEL = { note: "\u56FE\u6587", article: "\u6587\u7AE0", video: "\u89C6\u9891", shortpost: "\u77ED\u5E16" };
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
function Assistant({ state, face, t }) {
  const assist = state.assist;
  const material = assist?.material;
  const [paste, setPaste] = (0, import_react2.useState)("");
  const [pasteOrigin, setPasteOrigin] = (0, import_react2.useState)("\u7C98\u8D34");
  const [marking, setMarking] = (0, import_react2.useState)(null);
  const [markLink, setMarkLink] = (0, import_react2.useState)("");
  const [copied, setCopied] = (0, import_react2.useState)("");
  const doCopy = async (field, text) => {
    if (await copy(text)) setCopied(field + "-ok");
  };
  if (!material) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "publish-section publish-assist-entry", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { children: t("assistTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: t("assistHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("textarea", { className: "publish-assist-paste", rows: 10, placeholder: t("assistPlaceholder"), value: paste, onChange: (e) => setPaste(e.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "publish-assist-entryrow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Input, { value: pasteOrigin, "aria-label": t("assistOrigin"), onChange: (e) => setPasteOrigin(e.target.value), placeholder: t("assistOrigin") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: "publish-upload", children: [
          t("assistPickSrt"),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { type: "file", accept: ".srt,.md,.txt", onChange: (e) => {
            const file = e.target.files?.[0];
            if (file) {
              void file.text().then((text) => {
                const kind = file.name.endsWith(".srt") ? "srt" : file.name.endsWith(".md") ? "markdown" : "paste";
                face.createMaterial(kind, text, file.name);
              });
            }
            e.target.value = "";
          } })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "primary", disabled: state.busy || paste.trim().length === 0, onClick: () => face.createMaterial("paste", paste, pasteOrigin || "\u7C98\u8D34"), children: t("assistStart") })
      ] })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "publish-assist", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "publish-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "publish-section-heading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { children: t("assistMaterial") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "chip c-muted", children: [
          material.origin,
          " \xB7 ",
          material.kind.toUpperCase(),
          " \xB7 ",
          material.contentHash.slice(0, 8)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("details", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("summary", { children: t("assistViewMaterial") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("pre", { className: "publish-material-pre", children: material.text })
      ] }),
      material.attachments.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "publish-na", children: [
        t("assistAttachmentsNotRead"),
        material.attachments.map((a) => a.path.split(/[\\/]/).pop()).join("\u3001")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "publish-actions", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "primary", onClick: face.understand, disabled: state.busy, children: state.busy ? t("assistThinking") : t("assistUnderstand") }) })
    ] }),
    assist?.understanding && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "publish-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { children: t("assistUnderstanding") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: assist.understanding.summary }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "publish-assist-audience", children: [
        t("assistAudience"),
        "\uFF1A",
        assist.understanding.audience
      ] }),
      assist.understanding.facts.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "publish-facts", children: assist.understanding.facts.map((fact, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { children: [
        fact.claim,
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("blockquote", { children: fact.quote })
      ] }, index)) }),
      assist.understanding.question && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "publish-notice", children: [
        t("assistQuestion"),
        assist.understanding.question.question,
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("small", { children: assist.understanding.question.why }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "outline", onClick: face.understand, disabled: state.busy, children: t("assistRetryUnderstand") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { children: t("assistSuggestions") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "publish-suggest-row", children: assist.understanding.suggestions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { type: "button", className: "publish-suggest", onClick: () => face.adapt(s.platform, s.form), disabled: state.busy, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PlatformIcon, { id: s.platform === "gongzhonghao" ? "weixin" : s.platform, size: 24 }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
          platformLabel(s.platform, t),
          " \xB7 ",
          FORM_LABEL[s.form] ?? s.form
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("small", { children: s.reason })
      ] }, s.platform + s.form)) })
    ] }),
    assist && Object.keys(assist.platformDrafts).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "publish-section publish-instruction", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { children: t("assistTargeted") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Input, { value: assist.instruction, placeholder: t("assistInstructionHint"), onChange: (e) => face.setInstruction(e.target.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("small", { children: t("assistInstructionNote") })
      ] }),
      Object.entries(assist.platformDrafts).map(([platform, draft]) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        PlatformCard,
        {
          platform,
          draft,
          rule: assist.rules.find((r) => r.platform === platform && r.form === draft.form),
          result: assist.adaptResults[platform],
          state,
          face,
          t,
          marked: assist.manualRecords.find((row) => row.platform === platform && !row.unmarkedAt),
          marking: marking === platform,
          markLink,
          setMarkLink,
          onMarkRequest: () => {
            setMarking(platform);
            setMarkLink("");
          },
          onMarkConfirm: () => {
            face.markPublished(platform, markLink.trim() || void 0);
            setMarking(null);
          },
          onMarkCancel: () => setMarking(null),
          copied,
          doCopy
        },
        platform
      ))
    ] })
  ] });
}
function PlatformCard(props) {
  const { platform, draft, rule, result, state, face, t, marked, marking, markLink, setMarkLink, onMarkRequest, onMarkConfirm, onMarkCancel, copied, doCopy } = props;
  const [open, setOpen] = (0, import_react2.useState)(null);
  const [editText, setEditText] = (0, import_react2.useState)("");
  const iconId = platform === "gongzhonghao" ? "weixin" : platform;
  const copyAll = () => {
    void doCopy("all", Object.values(draft.fields).map((value) => value.text).filter((text) => text.length > 0).join("\n\n"));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "publish-section publish-platform-version", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "publish-section-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PlatformIcon, { id: iconId, size: 30 }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("h2", { children: [
        platformLabel(platform, t),
        " \xB7 ",
        FORM_LABEL[draft.form] ?? draft.form
      ] }),
      marked ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "chip c-ok", children: t("assistMarked") }) : result && result.checks.some((check) => check.exceeded && check.level === "hard") ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "chip c-fail", children: t("assistHardExceeded") }) : result ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "chip c-ok", children: t("assistReady") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "chip c-muted", children: t("assistDraft") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "outline", onClick: () => face.adapt(platform, draft.form), disabled: state.busy, children: state.busy ? t("assistThinking") : t("assistRegenerate") })
    ] }),
    result && result.protectedFields.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "publish-notice", children: [
      t("assistProtected"),
      result.protectedFields.join("\u3001")
    ] }),
    result && result.changes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("details", { className: "publish-changes", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("summary", { children: t("assistChanges") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { children: result.changes.map((change, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: change.field }),
        "\uFF1A",
        change.what,
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("small", { children: change.why })
      ] }, index)) })
    ] }),
    result && result.warnings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "publish-notice", children: [
      t("assistWarnings"),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { children: result.warnings.map((warning, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { children: [
        warning.field,
        "\uFF1A",
        warning.issue,
        warning.quote ? `\u300C${warning.quote}\u300D` : ""
      ] }, index)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "publish-fields", children: Object.entries(draft.fields).map(([field, value]) => {
      const length = rule?.lengths.find((item) => item.field === field);
      const check = result?.checks.find((item) => item.field === field);
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "publish-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "publish-field-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { children: [
            field,
            value.edited && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "chip c-warn", children: t("assistEdited") })
          ] }),
          length && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "publish-count" + (check?.exceeded ? check.level === "hard" ? " hard" : " warn" : ""), children: [
            check?.count ?? "\u2014",
            "/",
            length.max,
            length.unit === "weighted" ? t("assistWeighted") : t("assistChars")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Button, { size: "sm", variant: "outline", onClick: () => {
            void doCopy(field, value.text);
          }, children: copied === field + "-ok" ? t("assistCopied") : t("assistCopy") })
        ] }),
        open === field ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "textarea",
          {
            value: editText,
            rows: field === "body" || field === "digest" ? 10 : 3,
            autoFocus: true,
            onChange: (e) => setEditText(e.target.value),
            onBlur: (e) => {
              face.saveField(platform, draft.form, field, e.target.value);
              setOpen(null);
            }
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "publish-field-text", role: "button", tabIndex: 0, onClick: () => {
          setEditText(value.text);
          setOpen(field);
        }, onKeyDown: (e) => {
          if (e.key === "Enter") {
            setEditText(value.text);
            setOpen(field);
          }
        }, children: value.text || t("assistEmptyField") })
      ] }, field);
    }) }),
    rule && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "publish-platform-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("a", { className: "btn outline", href: rule.studioUrl, target: "_blank", rel: "noreferrer", children: [
        t("assistOpenStudio"),
        " \u2197"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "outline", onClick: copyAll, children: copied === "all-ok" ? t("assistCopied") : t("assistCopyAll") }),
      marked ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "outline", onClick: () => face.unmarkPublished(platform), disabled: state.busy, children: t("assistUnmark") }) : marking ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "publish-markrow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Input, { value: markLink, placeholder: t("assistLinkOptional"), onChange: (e) => setMarkLink(e.target.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "primary", onClick: onMarkConfirm, disabled: state.busy, children: t("assistMarkConfirm") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "outline", onClick: onMarkCancel, children: t("back") })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "primary", onClick: onMarkRequest, disabled: state.busy, children: t("assistMark") }),
      marked && !marking && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("small", { className: "publish-marked-note", children: [
        t("assistMarkedNote"),
        marked.markedAt.slice(0, 16).replace("T", " "),
        marked.link ? ` \xB7 ${marked.link}` : ""
      ] })
    ] }),
    rule?.notes && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("small", { className: "publish-rule-note", children: rule.notes })
  ] });
}
function DraftsList({ state, face, t }) {
  const drafts = state.assist?.drafts ?? [];
  const active = state.activeDraftId;
  (0, import_react2.useEffect)(() => {
    face.loadDrafts();
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "publish-section", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "publish-section-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { children: t("draftsTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "outline", onClick: face.loadDrafts, disabled: state.busy, children: t("refresh") })
    ] }),
    drafts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "publish-empty", children: t("draftsEmpty") }) : drafts.map((material) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        className: "publish-draft-row" + (material.draftId === active ? " picked" : ""),
        role: "button",
        tabIndex: 0,
        onClick: () => face.loadDraft(material.draftId),
        onKeyDown: (e) => {
          if (e.key === "Enter") face.loadDraft(material.draftId);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: material.text.slice(0, 60).replace(/\n/g, " ") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("small", { children: [
            material.origin,
            " \xB7 ",
            material.kind.toUpperCase(),
            " \xB7 ",
            material.updatedAt.slice(0, 16).replace("T", " ")
          ] })
        ]
      },
      material.draftId
    ))
  ] });
}

// src/client/Page.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function PublishIcon({ size }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives5.IconSendOutlineRegular, { size });
}
var TAB_KEYS = [{ key: "assist", label: "assistTab" }, { key: "drafts", label: "draftsTab" }, { key: "overview", label: "overview" }, { key: "accounts", label: "accounts" }, { key: "settings", label: "settings" }];
function PublishPage(props) {
  const { t } = props;
  const state = props.usePublishState((s) => s);
  const settingsState = props.usePublishSettings((s) => s);
  const month = /* @__PURE__ */ new Date();
  const inDetail = state.view.view === "platform";
  const activeTab = inDetail ? "overview" : state.tab;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-center", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("header", { className: "publish-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h1", { children: t("title") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("description") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives5.Button, { variant: "outline", onClick: props.refresh, disabled: state.busy, children: t("refresh") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("nav", { className: "publish-tabs", role: "tablist", "aria-label": t("title"), children: TAB_KEYS.map(({ key, label }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        type: "button",
        role: "tab",
        id: "publish-tab-" + key,
        "aria-controls": "publish-panel-" + key,
        "aria-selected": activeTab === key,
        onClick: () => {
          if (key === "overview" && inDetail) props.backHome();
          props.setTab(key);
        },
        children: t(label)
      },
      key
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-content", role: "tabpanel", id: "publish-panel-" + activeTab, "aria-labelledby": "publish-tab-" + activeTab, children: [
      state.error && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-notice", role: "alert", children: [
        state.error,
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives5.Button, { onClick: props.refresh, children: t("retry") })
      ] }),
      state.data && !state.data.publishingEnabled && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "publish-notice", children: t("paused") }),
      inDetail ? state.data && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PlatformDetail, { state, face: props, t, month, data: state.data }) : activeTab === "assist" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Assistant, { state, face: props, t }) : activeTab === "drafts" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(DraftsList, { state, face: props, t }) : activeTab === "overview" ? state.data && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Overview, { state, face: props, t, month, data: state.data }) : activeTab === "accounts" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AccountsSection, { state, settingsState, t, face: props }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SettingsSection, { settingsState, t, face: props, ledgerPath: state.data?.ledgerPath })
    ] })
  ] });
}
function Overview({ state, face, t, month, data }) {
  const order = (state.dragOrder ?? data.homeCards).filter((id) => data.platforms.some((p) => p.id === id));
  const seen = /* @__PURE__ */ new Set();
  const orderIds = order.filter((id) => seen.has(id) ? false : seen.add(id));
  const todayKey = dayKey(month);
  const monthPrefix = todayKey.slice(0, 7);
  const attempted = (status) => ATTEMPTED.includes(status);
  const todayCount = data.entries.filter((e) => recordDay(e) === todayKey && attempted(e.status)).length;
  const monthCount = data.entries.filter((e) => recordDay(e).startsWith(monthPrefix) && attempted(e.status)).length;
  const unknownCount = data.entries.filter((e) => e.status === "unknown").length;
  const scheduledCount = data.entries.filter((e) => e.status === "scheduled").length;
  const monthEntries = data.entries.filter((e) => recordDay(e).startsWith(monthPrefix));
  const legend = [...new Set(monthEntries.map((e) => e.request.platform))].map((id) => ({ color: platformMeta(id).bg, label: platformLabel(id, t) }));
  const dayEntries = state.selectedDate ? data.entries.filter((e) => recordDay(e) === state.selectedDate) : [];
  const drag = (0, import_react3.useRef)(null);
  const onDown = (id) => (event) => {
    drag.current = id;
    event.preventDefault();
    const onMove = (ev) => {
      const current = drag.current;
      if (!current) return;
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".publish-pcard[data-platform]");
      const targetId = target?.getAttribute("data-platform");
      if (targetId && targetId !== current) face.reorder(current, targetId);
    };
    const finish = (commit) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      const current = drag.current;
      drag.current = null;
      if (commit && current) face.commitOrder();
      if (!commit && current) face.cancelDrag();
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-statstrip", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: todayCount }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("todayPublished") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: monthCount }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("monthPublished") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: unknownCount }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("pendingCount") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: scheduledCount }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("scheduledCount") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-cards", children: [
      orderIds.map((id) => {
        const spec = data.platforms.find((p) => p.id === id);
        const accounts = data.configuredAccounts.filter((a) => a.platform === id);
        const checks = state.accounts?.filter((s) => s.platform === id) ?? [];
        const invalid = checks.some((s) => s.status === "invalid");
        const platformEntries = data.entries.filter((e) => e.request.platform === id);
        const platformMonth = platformEntries.filter((e) => recordDay(e).startsWith(monthPrefix) && attempted(e.status));
        const platformUnknown = platformEntries.filter((e) => e.status === "unknown").length;
        const platformScheduled = platformEntries.filter((e) => e.status === "scheduled").length;
        const badge = spec.blocked ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "chip c-muted", children: t("blocked") }) : spec.acceptance === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "chip c-warn", children: t("pendingAcceptance") }) : !accounts.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "chip c-muted", children: t("notConfigured") }) : invalid ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "chip c-unknown", children: t("invalid") }) : checks.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "chip c-ok", children: t("valid") }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "chip c-muted", children: t("notChecked") });
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-pcard", "data-platform": id, children: [
          !spec.blocked && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "publish-drag", "aria-hidden": true, onPointerDown: onDown(id), children: "\u283F" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-pcard-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PlatformIcon, { id, size: 34 }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "publish-pname", children: platformLabel(id, t) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "publish-pmeta", children: platformSummary(spec) })
            ] }),
            badge
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "publish-accs", children: accounts.map((a) => {
            const st = checks.find((s) => s.account === a.name);
            return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "publish-acc", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", { className: "dot", style: { background: st?.status === "invalid" ? "#d97917" : "#0d8a55" } }),
              a.name
            ] }, a.name);
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-nums", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: platformMonth.length }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("monthPublished") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: platformUnknown }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("pendingCount") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: platformScheduled }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("scheduledCount") })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "publish-minilist", children: platformEntries.slice(0, 3).map((entry) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-minilist-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "t", children: entry.request.title }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "chip publish-status publish-status-" + entry.status, children: statusLabel(entry.status, t) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "d", children: recordDay(entry).slice(5) })
          ] }, entry.prepareId)) }),
          spec.blocked && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "publish-na", children: spec.blocked }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-actions", children: [
            !spec.blocked && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives5.Button, { variant: "primary", onClick: () => face.openPlatform(id), children: t("newPost") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives5.Button, { variant: "outline", onClick: () => face.openPlatform(id), children: t("viewPlatform") }),
            invalid && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives5.Button, { variant: "outline", onClick: face.check, disabled: state.busy, children: t("checkAccounts") }),
            !accounts.length && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives5.Button, { variant: "outline", onClick: () => face.setTab("accounts"), children: t("addAccount") })
          ] })
        ] }, id);
      }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-pcard publish-more-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-pcard-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "publish-pico", style: { background: "#e3e5e8", color: "#646a73", fontSize: 16 }, children: "\uFF0B" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "publish-pname", children: t("morePlatforms") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "publish-pmeta", children: t("morePlatformsHint") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "publish-actions", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives5.Button, { variant: "outline", onClick: face.toggleMore, children: t("openMorePanel") }) })
      ] })
    ] }),
    state.moreOpen && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-morepanel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { children: t("morePlatforms") }),
      data.platforms.map((spec) => {
        const inHome = data.homeCards.includes(spec.id);
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-more-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PlatformIcon, { id: spec.id, size: 24 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "nm", children: platformLabel(spec.id, t) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "st", children: [
            platformSummary(spec),
            spec.acceptance === "pending" ? " \xB7 " + t("pendingAcceptance") : ""
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives5.Button, { size: "sm", variant: "outline", onClick: () => inHome ? face.removeMore(spec.id) : face.addMore(spec.id), children: inHome ? t("removeFromHome") : t("addToHome") })
        ] }, spec.id);
      })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Calendar, { entries: monthEntries, colorFor: (e) => platformMeta(e.request.platform).bg, selected: state.selectedDate, onSelect: face.selectDate, month, title: t("globalCalendar"), legend, t }),
    state.selectedDate && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "publish-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("h2", { children: [
        t("dayRecords"),
        " \xB7 ",
        state.selectedDate
      ] }),
      dayEntries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "publish-empty", children: t("empty") }) : dayEntries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RecordRow, { entry, t }, entry.prepareId))
    ] })
  ] });
}
function AccountsSection({ state, settingsState, t, face }) {
  const data = state.data;
  const configured = data?.configuredAccounts ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "publish-section", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-section-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: t("accounts") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives5.Button, { variant: "outline", onClick: face.check, disabled: state.busy, children: state.busy ? t("checking") : t("checkAccounts") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("accountHelp") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "publish-account-status", children: configured.map((a) => {
      const status = state.accounts?.find((s) => s.platform === a.platform && s.account === a.name);
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("strong", { children: [
          platformLabel(a.platform, t),
          " \xB7 ",
          a.name
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: statusLabel(status?.status ?? "", t) }),
        status?.detail && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("small", { children: status.detail })
      ] }, a.platform + "/" + a.name);
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SettingsContent, { state: settingsState, t, edit: face.editSettings, resetField: face.resetField, save: face.save, discard: face.discard, onlyAccounts: true })
  ] });
}
function SettingsSection({ settingsState, t, face, ledgerPath }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "publish-section", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SettingsContent, { state: settingsState, t, edit: face.editSettings, resetField: face.resetField, save: face.save, discard: face.discard }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("small", { children: t("ledger") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { className: "publish-ledger", children: ledgerPath })
  ] });
}
function PublishSettings(props) {
  const state = props.usePublishSettings((s) => s);
  if (props.view === "summary") return props.t("summary");
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "publish-center publish-settings-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives5.Button, { variant: "outline", onClick: props.openCenter, children: props.t("title") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SettingsContent, { state, t: props.t, edit: props.editSettings, resetField: props.resetField, save: props.save, discard: props.discard })
  ] });
}

// src/client/client.css
var client_default = ".publish-center{display:flex;flex-direction:column;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6}\r\n.publish-center h1,.publish-center h2,.publish-center h3,.publish-center p{margin:0}\r\n.publish-center h1{font-size:22px;font-weight:500;line-height:30px}\r\n.publish-center h2{font-size:16px;font-weight:500}.publish-center h3,.publish-center strong{font-weight:500}\r\n.publish-center p,.publish-center small{color:var(--dsw-alias-label-secondary)}\r\n.publish-center small{display:block;font-size:12px}\r\n.publish-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:28px 32px 20px;flex-shrink:0}\r\n[data-platform=darwin] .publish-header{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}\r\n.publish-tabs{display:flex;gap:20px;padding:0 32px;border-bottom:.5px solid var(--dsw-alias-border-l3);flex-shrink:0}\r\n.publish-tabs button{background:transparent;border:0;border-bottom:2px solid transparent;padding:12px 0;cursor:pointer;font:inherit;color:var(--dsw-alias-label-secondary);white-space:nowrap}\r\n.publish-tabs button[aria-selected=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-label-primary)}\r\n.publish-content{padding:24px 32px;display:flex;flex-direction:column;gap:16px;max-width:1400px;width:100%;box-sizing:border-box;overflow:auto;flex:1;min-height:0}\r\n.publish-editor{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;align-items:start}\r\n.publish-section{display:flex;flex-direction:column;gap:18px;min-width:0;padding:24px;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md,12px)}\r\n.publish-section-heading,.publish-actions{display:flex;gap:12px;align-items:center;justify-content:space-between}\r\n.publish-center label{display:flex;flex-direction:column;gap:8px;font-size:13px;min-width:0}\r\n.publish-center textarea,.publish-center select,.publish-center input[type=datetime-local]{box-sizing:border-box;width:100%;min-width:0;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm,8px);font:inherit;line-height:1.6;color:inherit;background:var(--dsw-alias-bg-base)}\r\n.publish-center textarea{resize:vertical}.publish-center button:focus-visible,.publish-center input:focus-visible,.publish-center select:focus-visible,.publish-center textarea:focus-visible,.publish-center summary:focus-visible{outline:2px solid var(--dsw-alias-button-primary-bg,var(--dsw-alias-label-primary));outline-offset:3px}\r\n.publish-row{display:flex;gap:12px;flex-wrap:wrap}.publish-row>label{flex:1;min-width:130px}\r\n.publish-switch{flex-direction:row!important;align-items:center;justify-content:space-between;gap:20px;padding:10px 0}\r\n.publish-upload{padding:20px;border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-base);cursor:pointer}\r\n.publish-upload input{font-size:12px}.publish-files{padding:0;margin:0;list-style:none}.publish-files li{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:.5px solid var(--dsw-alias-border-l3);padding:6px 0}.publish-files span{overflow-wrap:anywhere;min-width:0}\r\n.publish-preview{position:sticky;top:0;gap:16px}.publish-preview-meta{font-size:12px;color:var(--dsw-alias-label-secondary)}\r\n.publish-body{white-space:pre-wrap;overflow-wrap:anywhere}.publish-thumbnails{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.publish-thumbnails>div:first-child{grid-column:1/-1}.publish-thumbnails img,.publish-thumbnails video{display:block;width:100%;max-height:320px;object-fit:contain;border-radius:var(--dsw-radius-sm,8px)}.publish-empty-media,.publish-media-label{padding:40px 14px;text-align:center;background:var(--dsw-alias-bg-base);border-radius:var(--dsw-radius-sm,8px);color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}\r\n.publish-notice{padding:12px 16px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-base);display:flex;gap:12px;align-items:center;justify-content:space-between}\r\n.publish-review{display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;font-size:13px;margin:0}.publish-review dt{color:var(--dsw-alias-label-secondary)}.publish-review dd{margin:0;overflow-wrap:anywhere}\r\n.publish-table-scroll{overflow:auto}.publish-center table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}.publish-center th{font-weight:500;color:var(--dsw-alias-label-secondary)}.publish-center td,.publish-center th{padding:14px 12px;border-bottom:.5px solid var(--dsw-alias-border-l3);vertical-align:top}.publish-center td{min-width:100px}.publish-center details p{max-width:360px;overflow-wrap:anywhere}.publish-center summary{cursor:pointer}.publish-status{display:inline-flex;padding:2px 8px;border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-base);white-space:nowrap}.publish-status-unknown,.publish-status-submitted{border:.5px solid var(--dsw-alias-border-l3)}\r\n.publish-empty{padding:64px 12px;text-align:center;color:var(--dsw-alias-label-secondary)}\r\n.publish-account-status{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.publish-account-status>div{display:flex;flex-direction:column;gap:8px;padding:16px;background:var(--dsw-alias-bg-base);border-radius:var(--dsw-radius-sm,8px)}\r\n.publish-account-edit{display:flex;gap:12px;align-items:end;margin-bottom:14px;flex-wrap:wrap}.publish-account-edit label{flex:1;min-width:140px}.publish-settings-card{padding:20px;box-sizing:border-box;gap:20px}.publish-ledger{overflow-wrap:anywhere;font-size:12px}\r\n@media(max-width:1000px){.publish-editor{grid-template-columns:minmax(0,1fr)}.publish-preview{position:static}.publish-thumbnails{grid-template-columns:repeat(3,minmax(0,1fr))}.publish-thumbnails>div:first-child{grid-column:auto}}\r\n@media(max-width:520px){.publish-header{padding:20px 16px 12px}.publish-tabs{padding:0 16px;gap:16px;overflow:auto}.publish-content{padding:16px}.publish-section{padding:16px}.publish-row{flex-direction:column}.publish-header h1{font-size:20px}}\r\n@media(prefers-reduced-motion:reduce){.publish-center *{scroll-behavior:auto!important;transition:none!important}}\r\n/* ===== v0.3 \u5E73\u53F0\u4F18\u5148\uFF1A\u603B\u89C8\u5361\u7247\u3001\u66F4\u591A\u5E73\u53F0\u3001\u65E5\u5386\u3001\u5E73\u53F0\u8BE6\u60C5 ===== */\r\n.publish-center .chip{display:inline-flex;align-items:center;padding:2px 10px;border-radius:999px;font-size:12px;white-space:nowrap}\r\n.publish-center .c-ok{background:#e8f7ef;color:#0d8a55}.publish-center .c-sub{background:#e8efff;color:#2a5bd7}\r\n.publish-center .c-unknown{background:#fdf2e2;color:#b25e09}.publish-center .c-warn{background:#fdf2e2;color:#b25e09}\r\n.publish-center .c-sched{background:#f3ecfb;color:#7a3db8}.publish-center .c-fail{background:#feecea;color:#d92d20}\r\n.publish-center .c-muted{background:#f2f3f5;color:#646a73}\r\n.publish-statstrip{display:flex;gap:12px;margin-bottom:16px}\r\n.publish-stat{flex:1;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:10px;padding:12px 16px}\r\n.publish-stat b{display:block;font-size:22px;font-weight:600}.publish-stat span{font-size:12px;color:var(--dsw-alias-label-secondary)}\r\n.publish-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}\r\n.publish-pcard{background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:10px;position:relative}\r\n.publish-pcard-head{display:flex;align-items:center;gap:10px}\r\n.publish-pico{width:34px;height:34px;border-radius:9px;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;flex:none}\r\n.publish-pname{font-size:15px;font-weight:600}.publish-pmeta{font-size:11px;color:var(--dsw-alias-label-secondary)}\r\n.publish-pcard-head .chip{margin-left:auto}\r\n.publish-drag{position:absolute;top:10px;right:12px;color:var(--dsw-alias-label-secondary);opacity:.5;letter-spacing:2px;cursor:grab;touch-action:none}\r\n.publish-drag:active{cursor:grabbing;opacity:1}\r\n.publish-accs{display:flex;gap:8px;flex-wrap:wrap}\r\n.publish-acc{font-size:11px;padding:3px 10px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);display:inline-flex;align-items:center}\r\n.publish-acc .dot{margin-right:5px}\r\n.publish-nums{display:flex;gap:22px;font-size:12px;color:var(--dsw-alias-label-secondary)}\r\n.publish-nums b{display:block;font-size:16px;color:var(--dsw-alias-label-primary);font-weight:600}\r\n.publish-minilist{display:flex;flex-direction:column;gap:6px}\r\n.publish-minilist-row{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:6px 10px;background:var(--dsw-alias-bg-base);border-radius:8px}\r\n.publish-minilist-row .t{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n.publish-minilist-row .d{color:var(--dsw-alias-label-secondary);font-size:11px;flex:none}\r\n.publish-na{font-size:11.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);border-radius:8px;padding:8px 10px;border:.5px dashed var(--dsw-alias-border-l3)}\r\n.publish-actions{display:flex;gap:10px;flex-wrap:wrap}\r\n.publish-more-card{border-style:dashed}\r\n.publish-morepanel{background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;padding:14px 16px;margin-top:14px}\r\n.publish-morepanel h3{font-size:13.5px;font-weight:600;margin-bottom:10px}\r\n.publish-more-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;background:var(--dsw-alias-bg-base);margin-bottom:6px;font-size:12.5px}\r\n.publish-more-row .nm{width:76px;font-weight:500}\r\n.publish-more-row .st{flex:1;color:var(--dsw-alias-label-secondary);font-size:11.5px}\r\n.publish-more-row .publish-pico{width:24px;height:24px;border-radius:6px;font-size:11px}\r\n.publish-cal{background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;padding:14px 16px;margin-top:14px}\r\n.publish-cal-head{display:flex;align-items:center;gap:12px;font-size:13px;font-weight:600;margin-bottom:10px;flex-wrap:wrap}\r\n.publish-cal-legend{margin-left:auto;display:flex;gap:12px;font-size:11px;color:var(--dsw-alias-label-secondary);font-weight:400;flex-wrap:wrap}\r\n.publish-cal-legend .dot{margin-right:5px}\r\n.publish-calgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}\r\n.publish-wd{text-align:center;font-size:11px;color:var(--dsw-alias-label-secondary);padding:2px 0}\r\n.publish-cell{min-height:42px;background:var(--dsw-alias-bg-base);border:.5px solid transparent;border-radius:7px;padding:4px 6px;font-size:11px;position:relative;text-align:left;font:inherit;color:inherit;cursor:pointer}\r\n.publish-cell:hover{border-color:var(--dsw-alias-border-l3)}\r\n.publish-cell.static{cursor:default}\r\n.publish-cell.off{background:transparent}\r\n.publish-cell.today{border-color:#3370ff}\r\n.publish-cell.picked{background:#e8efff}\r\n.publish-cell-day{color:var(--dsw-alias-label-secondary)}\r\n.publish-cell.today .publish-cell-day{color:#3370ff;font-weight:600}\r\n.publish-ev{display:flex;gap:3px;margin-top:3px;min-height:7px}\r\n.publish-ev i{width:7px;height:7px;border-radius:2px;display:block}\r\n.publish-cnt{position:absolute;right:5px;bottom:3px;font-size:10px;color:var(--dsw-alias-label-secondary)}\r\n.publish-detail-head{background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}\r\n.publish-who{display:flex;align-items:center;gap:10px;font-size:15px}\r\n.publish-who select{width:auto;padding:6px 10px}\r\n.publish-detail-acts{margin-left:auto;display:flex;gap:10px}\r\n.publish-detail-cols{display:flex;gap:14px;align-items:flex-start;margin-top:14px}\r\n.publish-records{flex:1;min-width:0}\r\n.publish-side{width:380px;flex:none}\r\n.publish-side .publish-cal{margin-top:0}\r\n.publish-rec{display:flex;flex-direction:column;gap:3px;padding:9px 10px;border-radius:9px;background:var(--dsw-alias-bg-base);margin-bottom:7px}\r\n.publish-rec-l1{display:flex;align-items:center;gap:8px}\r\n.publish-rec-t{flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n.publish-rec-l2{font-size:11px;color:var(--dsw-alias-label-secondary);display:flex;gap:10px;flex-wrap:wrap}\r\n.publish-rec details{font-size:11.5px}.publish-rec details p{margin:4px 0;overflow-wrap:anywhere}\r\n.publish-note-flag{color:#b25e09;background:#fdf2e2;border-radius:6px;padding:1px 7px;display:inline-block}\r\n.publish-kindtabs{display:flex;gap:8px}\r\n.publish-kindtabs button{background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l3);border-radius:999px;padding:6px 16px;font:inherit;font-size:12.5px;color:var(--dsw-alias-label-secondary);cursor:pointer}\r\n.publish-kindtabs button[aria-selected=true]{background:#3370ff;border-color:#3370ff;color:#fff}\r\n.publish-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}\r\n@media(max-width:1000px){.publish-detail-cols{flex-direction:column}.publish-side{width:auto}}\r\n@media(max-width:520px){.publish-cards{grid-template-columns:1fr}.publish-statstrip{flex-wrap:wrap}.publish-stat{min-width:calc(50% - 6px)}}\r\n/* ===== v0.3 \u6279\u6B21 2\uFF1A\u6570\u636E\u4E2D\u5FC3 ===== */\r\n.publish-tiles{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}\r\n.publish-tiles .tile{background:var(--dsw-alias-bg-base);border-radius:9px;padding:10px 12px}\r\n.publish-tiles .tile b{display:block;font-size:19px;font-weight:600}\r\n.publish-tiles .tile span{font-size:11px;color:var(--dsw-alias-label-secondary)}\r\n.publish-metric-row{display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:9px;background:var(--dsw-alias-bg-base);margin-bottom:7px;flex-wrap:wrap}\r\n.publish-metric-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}\r\n.publish-metric-main strong{font-size:12.5px;font-weight:500;overflow-wrap:anywhere}\r\n.publish-metric-main small,.publish-metric-acts{font-size:11px;color:var(--dsw-alias-label-secondary)}\r\n.publish-metric-acts{display:flex;gap:6px;align-items:center}\r\n.publish-notes-picker{flex-basis:100%;display:flex;flex-direction:column;gap:6px;border:.5px solid var(--dsw-alias-border-l3);border-radius:9px;padding:8px}\r\n.publish-notes-row{display:flex;align-items:center;gap:8px;font-size:12px}\r\n.publish-notes-row .t{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n.publish-refreshrow{margin-top:10px;display:flex;justify-content:flex-end}\r\n.publish-side .publish-sidebox+.publish-sidebox,.publish-side .publish-sidebox+.publish-cal{margin-top:14px}\r\n/* ===== v0.4 \u667A\u80FD\u53D1\u5E03\u52A9\u624B ===== */\r\n.publish-assist-entry textarea{width:100%;box-sizing:border-box}\r\n.publish-assist-entryrow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}\r\n.publish-assist-entryrow input[type=text]{min-width:140px}\r\n.publish-material-pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:280px;overflow:auto;background:var(--dsw-alias-bg-base);border-radius:8px;padding:12px;font-size:12.5px}\r\n.publish-assist-audience{color:var(--dsw-alias-label-secondary)}\r\n.publish-facts{padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:12.5px}\r\n.publish-facts blockquote{margin:2px 0 0;padding:4px 10px;border-left:2px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary)}\r\n.publish-suggest-row{display:flex;gap:10px;flex-wrap:wrap}\r\n.publish-suggest{display:flex;align-items:center;gap:8px;background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l3);border-radius:10px;padding:10px 14px;cursor:pointer;font:inherit;text-align:left}\r\n.publish-suggest:hover{border-color:#3370ff}\r\n.publish-suggest small{color:var(--dsw-alias-label-secondary);font-size:11px}\r\n.publish-instruction input{width:100%}\r\n.publish-platform-version .publish-changes ul,.publish-notice ul{padding-left:16px;font-size:12px;margin:6px 0}\r\n.publish-changes li,.publish-notice li{margin-bottom:4px}\r\n.publish-changes small{display:block;color:var(--dsw-alias-label-secondary)}\r\n.publish-fields{display:flex;flex-direction:column;gap:12px}\r\n.publish-field-head{display:flex;align-items:center;gap:10px;margin-bottom:4px}\r\n.publish-field-head label{font-size:12.5px;font-weight:500;color:var(--dsw-alias-label-secondary)}\r\n.publish-count{font-size:11.5px;color:var(--dsw-alias-label-secondary)}\r\n.publish-count.warn{color:#b25e09}.publish-count.hard{color:#d92d20;font-weight:600}\r\n.publish-field-text{background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;padding:10px 12px;font-size:13.5px;white-space:pre-wrap;overflow-wrap:anywhere;min-height:40px;cursor:text}\r\n.publish-field-text:hover{border-color:#3370ff}\r\n.publish-field textarea{width:100%;box-sizing:border-box}\r\n.publish-platform-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}\r\n.publish-platform-actions .btn.outline{display:inline-flex;align-items:center;font-size:12.5px;padding:7px 14px;border-radius:8px;border:.5px solid #d0d3d9;color:inherit;text-decoration:none;background:var(--dsw-alias-bg-base)}\r\n.publish-markrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}\r\n.publish-marked-note{color:var(--dsw-alias-label-secondary)}\r\n.publish-rule-note{display:block;margin-top:8px;color:var(--dsw-alias-label-secondary)}\r\n.publish-draft-row{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:9px;background:var(--dsw-alias-bg-base);margin-bottom:7px;cursor:pointer}\r\n.publish-draft-row.picked{background:#e8efff}\r\n.publish-draft-row small{color:var(--dsw-alias-label-secondary);font-size:11px}\r\n";

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
