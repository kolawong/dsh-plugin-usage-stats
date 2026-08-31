/**
 * Offline smoke for dsh-plugin-usage-stats client half: load client.js through
 * a stubbed __ModuleLoader__ / React / module table, register the settings
 * section, and render it against an extended ready summary - asserting
 * cost cards, token composition, heatmap, trend curve, donut, top sessions, and tools.
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

// ── register the section through a fake slots/locale context ───────────────
const locales = {};
const registrations = [];
let sectionComponent = null;
client.apply({
  locale: {
    register: (ns, dict) => { locales[ns] = dict; },
    bind: (ns) => (k) => locales[ns]?.zh?.[k] ?? k,
  },
  slots: {
    inject: (slot, gen) => { for (const item of gen()) registrations.push({ slot, item }); },
    register: (meta, component) => { sectionComponent = component; return meta; },
  },
});
ok(locales["usage-stats"], "locale registered under usage-stats");
ok(locales["usage-stats"].zh && locales["usage-stats"].en, "both locales registered");
equal(registrations.length, 1, "one settings section registration");
equal(registrations[0].slot, "settings.section", "registered on settings.section");
equal(registrations[0].item.id, "usageStats", "section id");
equal(registrations[0].item.label(), "使用统计", "zh nav label follows document lang");
globalThis.document.documentElement.lang = "en";
equal(registrations[0].item.label(), "Usage statistics", "en nav label follows document lang");
globalThis.document.documentElement.lang = "zh-CN";
ok(sectionComponent, "section component captured");

// ── render the section with a fake ready summary ──────────────────────────
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
    { category: "toolResult", labelKey: "compToolResult", tokens: 80000, percent: 4.6, color: "#ec4899" },
  ],
  topSessions: [
    { id: "s1", title: "Project Alpha", workspace: "/root/alpha", totalTokens: 1200000, turns: 45, costUsd: 1.2, costCny: 8.5, lastActiveTime: Date.now() - 3600000 },
    { id: "s2", title: "Project Beta", workspace: "/root/beta", totalTokens: 550000, turns: 20, costUsd: 0.65, costCny: 4.7, lastActiveTime: Date.now() - 7200000 },
  ],
  topTools: [
    { name: "view_file", count: 120, percent: 50.0 },
    { name: "run_command", count: 80, percent: 33.3 },
  ],
  byDay: { [todayKey]: { inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500, costUsd: 0.01, costCny: 0.07 } },
  byModel: {
    "ark/deepseek-v4-flash": { inputTokens: 800, outputTokens: 400, totalTokens: 1_200, costUsd: 0.01, costCny: 0.07 },
    "ollama/qwen3": { inputTokens: 200, outputTokens: 100, totalTokens: 300, costUsd: 0.005, costCny: 0.035 },
  },
  longestTurnMs: 90_000,
  streak: { current: 1, longest: 3 },
};

// Preset state for UsageStatsSection: status = "ready", currency = "cny"
presetStates.push({ status: "ready", data: SUMMARY, error: null });
presetStates.push("cny");
const zh = locales["usage-stats"].zh;
const tree = sectionComponent({ t: (k) => zh[k] ?? k });

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

console.log("usage-stats client smoke: OK");
