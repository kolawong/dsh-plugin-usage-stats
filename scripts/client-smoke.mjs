/**
 * Offline smoke for dsh-plugin-usage-stats client half: load client.js through
 * a stubbed __ModuleLoader__ / React / module table, register the left-sidebar
 * panellist row + main panel, and render the panel against an extended ready
 * summary - asserting cost cards, token composition, heatmap, trend curve,
 * donut, top sessions, and tools.
 * Run: node scripts/client-smoke.mjs
 */
import { deepEqual, equal, ok } from "node:assert/strict";

// ── stub browser + React environment (single render pass) ─────────────────
const presetStates = [];
const React = {
  Fragment: Symbol("Fragment"),
  useState: (init) => [presetStates.shift() ?? (typeof init === "function" ? init() : init), () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useRef: (init) => ({ current: init }),
};
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const jsxs = jsx;
const requireStub = (id) => {
  if (id === "react") return React;
  if (id === "react/jsx-runtime") return { jsx, jsxs };
  if (id === "@deepseek-ai/dsh-client-ui-primitives") return { IconRefreshOutline16: () => null };
  throw new Error("unexpected require: " + id);
};
const loaded = {};
globalThis.window = { __ModuleLoader__: { load: (def) => { loaded[def.id] = def.factory(requireStub); } } };
globalThis.document = { documentElement: { lang: "zh-CN" } };

await import("../client.js");
const client = loaded["dsh-plugin-usage-stats"];
ok(client, "client module registered in the module table");
deepEqual(client.inject, ["locale", "slots"], "client inject list");

// ── register the panel + sidebar row through a fake slots/locale context ───
const locales = {};
const registrations = [];
const components = {};
client.apply({
  locale: {
    register: (ns, dict) => { locales[ns] = dict; },
    bind: (ns) => (k) => locales[ns]?.zh?.[k] ?? k,
  },
  slots: {
    inject: (slot, gen) => {
      const out = gen();
      if (out && typeof out[Symbol.iterator] === "function") {
        for (const item of out) registrations.push({ slot, item });
      } else {
        registrations.push({ slot, item: out });
      }
    },
    register: (meta, component) => { components[meta.name] = component; return meta; },
  },
});
ok(locales["usage-stats"], "locale registered under usage-stats");
ok(locales["usage-stats"].zh && locales["usage-stats"].en, "both locales registered");
equal(registrations.length, 2, "main panel + sidebar panellist registrations");
const mainReg = registrations.find((r) => r.slot === "main");
const panelReg = registrations.find((r) => r.slot === "sidebar.panellist");
ok(mainReg, "registered on the main keyed slot");
equal(mainReg.item.key, "usage-stats", "main panel key");
equal(mainReg.item.locale, "usage-stats", "main panel locale namespace");
ok(panelReg, "registered on the sidebar.panellist slot");
equal(panelReg.item.id, "usage-stats", "panellist id matches the main panel key");
equal(panelReg.item.order, 20, "panellist order after shipped rows");
equal(panelReg.item.label(), "使用统计", "zh nav label follows document lang");
globalThis.document.documentElement.lang = "en";
equal(panelReg.item.label(), "Usage statistics", "en nav label follows document lang");
globalThis.document.documentElement.lang = "zh-CN";
const pageComponent = components["main"];
ok(pageComponent, "main panel component captured");
const iconComponent = components["sidebar.panellist"];
ok(iconComponent, "panellist icon component captured");
const iconTree = iconComponent({ size: 16, active: false });
equal(iconTree.type, "svg", "panel icon renders a direct svg glyph");
ok(iconTree.props.children.some((c) => c.type === "path"), "panel icon glyph has paths");

// ── render the main panel page with a fake ready summary ───────────────────
const d = new Date();
const todayKey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const SUMMARY = {
  totals: {
    inputTokens: 1_000_000,
    outputTokens: 500_000,
    totalTokens: 1_750_000,
    cacheReadTokens: 250_000,
    reasoningTokens: 100_000,
    userInputTokens: 20_000,
    toolResultTokens: 80_000,
    costUsd: 1.85,
    costCny: 13.20,
    savedUsd: 0.50,
    savedCny: 3.60,
    sessions: 42,
    turns: 100,
    steps: 321,
    llmMs: 3_600_000,
    tokensPerSecond: 138.9,
    avgTurnMs: 36000,
    totalToolCalls: 240,
  },
  tokenComposition: [
    { category: "cacheRead", labelKey: "compCacheRead", tokens: 250000, percent: 14.3, color: "#3b82f6" },
    { category: "userInput", labelKey: "compUserInput", tokens: 20000, percent: 1.1, color: "#10b981" },
    { category: "assistantOutput", labelKey: "compAssistantOutput", tokens: 400000, percent: 22.9, color: "#8b5cf6" },
    { category: "reasoning", labelKey: "compReasoning", tokens: 100000, percent: 5.7, color: "#f59e0b" },
    // Non-zero share truncated to 0 by the server must render "<0.1%", not "0%".
    { category: "toolResult", labelKey: "compToolResult", tokens: 80000, percent: 0, color: "#ec4899" },
  ],
  topSessions: [
    { id: "s1", title: "Project Alpha", workspace: "/root/alpha", totalTokens: 1200000, turns: 45, costUsd: 1.2, costCny: 8.5, lastActiveTime: Date.now() - 3600000 },
    { id: "s2", title: "Project Beta", workspace: "/root/beta", totalTokens: 550000, turns: 20, costUsd: 0.65, costCny: 4.7, lastActiveTime: Date.now() - 7200000 },
  ],
  topTools: [
    { name: "view_file", count: 120, percent: 50.0 },
    { name: "run_command", count: 80, percent: 33.3 },
    { name: "bulk_tool", count: 12345, percent: 2.5 },
  ],
  byDay: { [todayKey]: { inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500, costUsd: 0.01, costCny: 0.07 } },
  byModel: {
    "ark/deepseek-v4-flash": { inputTokens: 800, outputTokens: 400, totalTokens: 1_200, costUsd: 0.01, costCny: 0.07 },
    "ollama/qwen3": { inputTokens: 200, outputTokens: 100, totalTokens: 300, costUsd: 0.005, costCny: 0.035 },
    // Ten entries force the top-8 + aggregated tail grouping path.
    "p1/m1": { inputTokens: 10, outputTokens: 10, totalTokens: 20, costUsd: 0.001, costCny: 0.01 },
    "p2/m2": { inputTokens: 10, outputTokens: 10, totalTokens: 21, costUsd: 0.001, costCny: 0.01 },
    "p3/m3": { inputTokens: 10, outputTokens: 10, totalTokens: 22, costUsd: 0.001, costCny: 0.01 },
    "p4/m4": { inputTokens: 10, outputTokens: 10, totalTokens: 23, costUsd: 0.001, costCny: 0.01 },
    "p5/m5": { inputTokens: 10, outputTokens: 10, totalTokens: 24, costUsd: 0.001, costCny: 0.01 },
    "p6/m6": { inputTokens: 10, outputTokens: 10, totalTokens: 25, costUsd: 0.001, costCny: 0.01 },
    "p7/m7": { inputTokens: 10, outputTokens: 10, totalTokens: 26, costUsd: 0.001, costCny: 0.01 },
    "p8/m8": { inputTokens: 10, outputTokens: 10, totalTokens: 27, costUsd: 0.001, costCny: 0.01 },
  },
  longestTurnMs: 90_000,
  streak: { current: 1, longest: 3 },
};

// Preset state for UsageStatsSection: state, refreshTick, currency
presetStates.push({ status: "ready", data: SUMMARY, error: null, isSyncing: false, updatedAt: null });
presetStates.push(0);
presetStates.push("cny");
const zh = locales["usage-stats"].zh;
const tree = pageComponent({ t: (k) => zh[k] ?? k });

function* walk(node) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) { for (const child of node) yield* walk(child); return; }
  if (typeof node === "string" || typeof node === "number") { yield String(node); return; }
  if (typeof node.type === "function") { yield* walk(node.type(node.props)); return; }
  yield node;
  if (node.props?.children !== undefined) yield* walk(node.props.children);
}
const nodes = [...walk(tree)];
const els = nodes.filter((n) => typeof n === "object");
const texts = nodes.filter((n) => typeof n === "string");

// Cost & Savings
ok(texts.some((t) => t.includes("¥13.20")), "estimated cost rendered in CNY");
ok(texts.some((t) => t.includes("¥3.60")), "cache saved amount rendered in CNY");
ok(texts.some((t) => t.includes("138.9 t/s")), "tokens/sec speed rendered");

// Hero strip values
ok(texts.includes("175.0 万"), "total tokens formatted as 175.0 万");
ok(texts.includes("2 分钟"), "longest turn formatted as 2 分钟 (90s rounds up)");
ok(texts.includes("1 天"), "current streak formatted as 1 天");

// Heatmap
const rects = els.filter((e) => e.type === "rect");
equal(rects.length, 53 * 7, "heatmap rect count (53 weeks x 7 days)");

// Trend: two area paths + two line paths
const paths = els.filter((e) => e.type === "path");
equal(paths.length, 4, "trend renders 4 paths");

// Top Sessions
ok(texts.includes("Project Alpha") && texts.includes("Project Beta"), "top session titles rendered");

// Top Tools
ok(texts.includes("view_file") && texts.includes("run_command"), "top tools rendered");
ok(texts.includes("12,345"), "tool counts use thousands separators");
ok(texts.some((x) => x.includes("工具调用总计")), "tool section header shows the call total");

// Polish behaviors
ok(texts.some((x) => x.includes("<0.1%")), "truncated non-zero shares render <0.1% instead of 0%");
ok(texts.includes("少") && texts.includes("多"), "heatmap legend renders the Less/More scale");
ok(texts.some((x) => x.includes("其他")), "tail models aggregate into an Others row");
const circles = els.filter((e) => e.type === "circle");
ok(circles.length <= 10, "donut segments stay bounded (top 8 + Others)");
const pills = els.filter((e) => typeof e.props.className === "string" && e.props.className.includes("dsh-us-pill"));
ok(pills.length >= 5, "currency + dimension switches share one pill component");
ok(els.some((e) => typeof e.props.className === "string" && e.props.className.includes("dsh-us-row")), "rows expose the hover state class");
ok(els.some((e) => e.type === "a" && String(e.props.className).includes("dsh-us-link")), "session links expose the hover state class");

// ── error state: failure message + retry affordance ────────────────────────
presetStates.push({ status: "error", data: null, error: "HTTP 500", isSyncing: false, updatedAt: null });
presetStates.push(0);
presetStates.push("cny");
const errTree = pageComponent({ t: (k) => zh[k] ?? k });
const errNodes = [...walk(errTree)];
const errTexts = errNodes.filter((n) => typeof n === "string");
const errEls = errNodes.filter((n) => typeof n === "object");
ok(errTexts.some((x) => x.includes("统计加载失败")), "error state renders the failure message");
ok(errTexts.some((x) => x.includes("重试")), "error state offers a retry action");
ok(errEls.some((e) => e.type === "button" && String(e.props.className).includes("dsh-us-btn")), "retry button exposes the hover state class");
equal(errEls.filter((e) => e.type === "rect").length, 0, "error state renders no charts");

console.log("usage-stats client smoke: OK");
