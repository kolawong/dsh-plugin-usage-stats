/**
 * Offline smoke for dsh-plugin-usage-stats server half: apply() registers the
 * endpoint + a session/event listener; the cold endpoint returns
 * `{computing:true}`, then after the background seed + live events the endpoint
 * returns a real summary. Run: node scripts/smoke.mjs
 */
import { equal, ok } from "node:assert/strict";

const mkEvent = (seq, type, time, data) => ({ seq, type, time, data });
const mkAssistant = (seq, time, model, input, output, cacheRead = 0) => mkEvent(seq, "assistant/message", time, {
  turn: 1, step: 1,
  message: { id: `m${seq}`, role: "assistant", source: { kind: "model", provider: "ark", model }, content: [] },
  usage: { inputTokens: input, outputTokens: output, cacheReadTokens: cacheRead },
});
const DAY = 86400000;
const now = Date.now();
const sessionEvents = [
  mkEvent(0, "turn/start", now - 2 * DAY, { turn: 1 }),
  mkEvent(1, "step/start", now - 2 * DAY, { turn: 1, step: 1 }),
  mkAssistant(2, now - 2 * DAY, "deepseek-v4-flash", 1000, 500, 200),
  mkEvent(3, "step/end", now - 2 * DAY + 5000, { turn: 1, step: 1 }),
  mkEvent(4, "turn/end", now - 2 * DAY + 6000, { turn: 1, reason: { kind: "completed" } }),
];
const fakeSessionQuery = {
  listSessions: async () => [{ header: { id: "s1" } }, { header: { id: "s2" } }],
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
mod.apply(ctx, { enabled: true });

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

// A live event folds incrementally into the cache (no re-scan).
const before = summary.totals.totalTokens;
const live = mkAssistant(5, Date.now(), "deepseek-v4-flash", 100, 50, 0);
listeners.find((l) => l.name === "session/event").fn({ id: "s1" }, live);
const after = await call();
equal(after.totals.totalTokens, before + 150, "live event folded incrementally");

// A live event from a session born after the seed counts that session.
const liveNew = mkAssistant(6, Date.now(), "deepseek-v4-flash", 10, 5, 0);
listeners.find((l) => l.name === "session/event").fn({ id: "s3" }, liveNew);
const afterNew = await call();
equal(afterNew.totals.sessions, 3, "a new session's first live event counts it");
equal(afterNew.totals.totalTokens, before + 150 + 15, "new session tokens folded");
equal(afterNew.totals.steps, 2, "live messages add no step/end, steps unchanged");

console.log("usage-stats server smoke: OK");
