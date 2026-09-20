/**
 * Offline smoke for dsh-plugin-usage-stats server half: apply() registers the
 * endpoint + a session/event listener; the cold endpoint returns
 * `{computing:true}`, then after the background seed + live events the endpoint
 * returns a real summary with cost, composition, top sessions, and tools analytics.
 * Run: node scripts/smoke.mjs
 */
import { equal, ok } from "node:assert/strict";

const mkEvent = (seq, type, time, data) => ({ seq, type, time, data });
const mkAssistant = (seq, time, model, input, output, cacheRead = 0, toolName = null) => {
  const content = [];
  if (toolName) {
    content.push({ type: "tool-call", name: toolName, arguments: "{}" });
  }
  return mkEvent(seq, "assistant/message", time, {
    turn: 1, step: 1,
    message: { id: `m${seq}`, role: "assistant", source: { kind: "model", provider: "ark", model }, content },
    usage: { inputTokens: input, outputTokens: output, cacheReadTokens: cacheRead },
  });
};
const DAY = 86400000;
const now = Date.now();
const sessionEvents = [
  mkEvent(0, "turn/start", now - 2 * DAY, { turn: 1 }),
  mkEvent(1, "user/message", now - 2 * DAY, { content: "Please view file and run command" }),
  mkEvent(2, "step/start", now - 2 * DAY, { turn: 1, step: 1 }),
  mkAssistant(3, now - 2 * DAY, "deepseek-v4-flash", 1000, 500, 200, "view_file"),
  mkEvent(4, "tool/result", now - 2 * DAY + 1000, { name: "view_file", result: "file content sample" }),
  mkEvent(5, "step/end", now - 2 * DAY + 5000, { turn: 1, step: 1 }),
  mkEvent(6, "turn/end", now - 2 * DAY + 6000, { turn: 1, reason: { kind: "completed" } }),
];
const fakeSessionQuery = {
  listSessions: async () => [
    { header: { id: "s1", title: "Project Alpha", workspace: "/root/alpha" } },
    { header: { id: "s2", title: "Project Beta", workspace: "/root/beta" } },
  ],
  readSession: async (id) => ({ session: { id, version: 1, createdAt: now }, events: sessionEvents }),
};
const routes = [];
const listeners = [];
const fakeWebServer = { register: (route) => { routes.push(route); return () => {}; } };
const ctx = {
  logger: { warn: (m) => console.warn("warn:", m) },
  on: (name, fn) => { listeners.push({ name, fn }); return () => {}; },
  inject: (names, cb) => { cb(Object.assign({}, ctx, { sessionQuery: fakeSessionQuery, webServer: fakeWebServer })); },
};

const mod = await import("../index.js");
mod.apply(ctx, { enabled: true, cache: false });

ok(routes.some((r) => r.path === "/api/usage-stats/summary"), "summary endpoint registered");
ok(listeners.some((l) => l.name === "session/event"), "session/event listener registered");

const route = routes.find((r) => r.path === "/api/usage-stats/summary");
const call = async () => {
  const chunks = [];
  const res = { writeHead: () => {}, end: (b) => chunks.push(b) };
  await route.handler({}, res);
  return JSON.parse(chunks.join(""));
};

// Cold call seeds in the background and answers "computing".
const cold = await call();
equal(cold.computing, true, "cold call answers computing");

// After the seed completes, the endpoint returns a real summary.
await new Promise((resolve) => setTimeout(resolve, 300));
const summary = await call();
ok(!summary.computing, "after seed, the endpoint returns a summary");
ok(summary.totals.totalTokens > 0, "summary has nonzero tokens");
equal(summary.totals.sessions, 2, "session count");
equal(summary.totals.turns, 2, "turn count (2 sessions x 1 turn)");
equal(summary.totals.steps, 2, "step count (2 sessions x 1 step)");
equal(summary.streak.longest, 1, "longest streak counts the single active day");
equal(summary.byModel["ark/deepseek-v4-flash"].totalTokens, 3400, "model token total (2 sessions x 1700)");

// Check Phase 1 new intelligence fields
ok(summary.totals.costUsd > 0, "costUsd is computed");
ok(summary.totals.costCny > 0, "costCny is computed");
ok(summary.totals.savedCny >= 0, "savedCny is computed");
ok(Array.isArray(summary.tokenComposition), "tokenComposition is an array");
equal(summary.tokenComposition.length, 5, "5 token categories in composition");
ok(Array.isArray(summary.topSessions), "topSessions is an array");
equal(summary.topSessions.length, 2, "topSessions contains 2 sessions");
equal(summary.topSessions[0].title, "Project Alpha", "session title preserved");
ok(Array.isArray(summary.topTools), "topTools is an array");
ok(summary.topTools.some((t) => t.name === "view_file"), "view_file tracked in topTools");

// A live event folds incrementally into the cache (no re-scan).
const before = summary.totals.totalTokens;
const live = mkAssistant(7, Date.now(), "deepseek-v4-flash", 100, 50, 0);
listeners.find((l) => l.name === "session/event").fn({ id: "s1" }, live);
const after = await call();
equal(after.totals.totalTokens, before + 150, "live event folded incrementally");

// A live event from a session born after the seed counts that session.
const liveNew = mkAssistant(8, Date.now(), "deepseek-v4-flash", 10, 5, 0);
listeners.find((l) => l.name === "session/event").fn({ id: "s3" }, liveNew);
const afterNew = await call();
equal(afterNew.totals.sessions, 3, "a new session's first live event counts it");
equal(afterNew.totals.totalTokens, before + 150 + 15, "new session tokens folded");
equal(afterNew.totals.steps, 2, "live messages add no step/end, steps unchanged");

// Test disk cache persistence with isolated DSH_HOME
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const tmpHome = mkdtempSync(join(tmpdir(), "dsh-smoke-"));
process.env.DSH_HOME = tmpHome;
try {
  const routes2 = [];
  const fakeWebServer2 = { register: (r) => routes2.push(r) };
  const ctx2 = {
    logger: { warn: () => {} },
    on: () => () => {},
    inject: (names, cb) => cb({ sessionQuery: fakeSessionQuery, webServer: fakeWebServer2 }),
  };
  // 1st run with cache: true: cold call answers computing, background seed writes cache.json
  mod.apply(ctx2, { enabled: true, cache: true });
  const route2 = routes2.find((r) => r.path === "/api/usage-stats/summary");
  const call2 = async () => {
    const chunks = [];
    await route2.handler({ url: "/" }, { writeHead: () => {}, end: (b) => chunks.push(b) });
    return JSON.parse(chunks.join(""));
  };
  equal((await call2()).computing, true, "1st run cold call answers computing");
  await new Promise((r) => setTimeout(r, 200));
  const res2 = await call2();
  ok(!res2.computing && res2.totals.totalTokens > 0, "1st run finished and cached");

  // 2nd run with cache: true: instant warm load from cache.json on 0ms cold call!
  const routes3 = [];
  const fakeWebServer3 = { register: (r) => routes3.push(r) };
  const ctx3 = {
    logger: { warn: () => {} },
    on: () => () => {},
    inject: (names, cb) => cb({ sessionQuery: fakeSessionQuery, webServer: fakeWebServer3 }),
  };
  mod.apply(ctx3, { enabled: true, cache: true });
  const route3 = routes3.find((r) => r.path === "/api/usage-stats/summary");
  const call3 = async () => {
    const chunks = [];
    await route3.handler({ url: "/" }, { writeHead: () => {}, end: (b) => chunks.push(b) });
    return JSON.parse(chunks.join(""));
  };
  const warm = await call3();
  ok(!warm.computing, "2nd run loads immediately from disk cache (not computing)");
  equal(warm.totals.sessions, 2, "warm load preserved session total");
} finally {
  delete process.env.DSH_HOME;
  try { rmSync(tmpHome, { recursive: true, force: true }); } catch {}
}

console.log("usage-stats server smoke: OK");
