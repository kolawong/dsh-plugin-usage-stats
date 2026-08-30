/**
 * Offline smoke for dsh-plugin-usage-stats client half: load client.js through
 * a stubbed __ModuleLoader__ / React / module table, register the settings
 * section, and render it against a fake summary - asserting the section
 * metadata, both locales, and the rendered chart shapes (heatmap cells, trend
 * paths, donut circles, model rows). Run: node scripts/client-smoke.mjs
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
const jsx = (type, props) => ({ type, props: props ?? {} });
const requireStub = (id) => {
  if (id === "react") return React;
  if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
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
  locale: { register: (ns, dict) => { locales[ns] = dict; } },
  slots: {
    inject: (slot, gen) => { for (const item of gen()) registrations.push({ slot, item }); },
    register: (meta, component) => { sectionComponent = component; return meta; },
  },
});
ok(locales["usage-stats"], "locale registered under usage-stats");
ok(locales["usage-stats"].zh && locales["usage-stats"].en, "both locales registered");
ok(!("daily" in locales["usage-stats"].zh) && !("daily" in locales["usage-stats"].en), "no dead locale keys");
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
  totals: { inputTokens: 1_000_000, outputTokens: 500_000, totalTokens: 1_500_000, cacheReadTokens: 250_000, sessions: 42, turns: 100, steps: 321, llmMs: 3_600_000 },
  byDay: { [todayKey]: { inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500 } },
  byModel: {
    "ark/deepseek-v4-flash": { inputTokens: 800, outputTokens: 400, totalTokens: 1_200 },
    "ollama/qwen3": { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
  },
  longestTurnMs: 90_000,
  streak: { current: 1, longest: 3 },
};
presetStates.push({ status: "ready", data: SUMMARY, error: null });
const zh = locales["usage-stats"].zh;
const tree = sectionComponent({ t: (k) => zh[k] ?? k });

// Render-walk: like React, function components are invoked with their props
// so nested presentational components (StatCell, Heatmap, TrendLine, Donut...)
// actually execute; host tags and fragments are yielded as elements.
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

// Hero strip values (zh formatting: 万 / 分钟 / 天).
ok(texts.includes("150.0 万"), "total tokens formatted as 150.0 万, got: " + texts.filter((t) => t.includes("万")));
ok(texts.includes("2 分钟"), "longest turn formatted as 2 分钟 (90s rounds up)");
ok(texts.includes("1 天"), "current streak formatted as 1 天");
ok(texts.includes("42"), "session count rendered");

// Heatmap: 53 weeks x 7 days of rects, today filled at the top level.
const rects = els.filter((e) => e.type === "rect");
equal(rects.length, 53 * 7, "heatmap rect count (53 weeks x 7 days)");
ok(rects.some((r) => r.props.fill === "var(--dsw-alias-state-business-primary, #2563eb)"), "today's cell uses the peak fill");
ok(els.some((e) => e.type === "title" && typeof e.props.children === "string" && e.props.children.startsWith(todayKey + "：")), "heatmap cell tooltip keyed by date");

// Trend: two area paths + two line paths.
const paths = els.filter((e) => e.type === "path");
equal(paths.length, 4, "trend renders 4 paths (2 areas + 2 lines)");
ok(paths.every((p) => typeof p.props.d === "string" && p.props.d.includes("M")), "every trend path has a d attribute");

// Model share: donut track + one circle per model, list rows with colors.
const circles = els.filter((e) => e.type === "circle");
equal(circles.length, 1 + 2, "donut track + 2 model segments");
ok(texts.includes("ark/deepseek-v4-flash") && texts.includes("ollama/qwen3"), "model names rendered");
ok(texts.some((t) => t.endsWith("%")), "model percentages rendered");

// Heatmap month labels are localized.
ok(texts.some((t) => /^[0-9]{1,2}月$/.test(t)), "zh month labels on the heatmap");

console.log("usage-stats client smoke: OK");
