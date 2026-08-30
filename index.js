/**
 * dsh-plugin-usage-stats — Server half
 *
 * Adds a Usage Statistics section to the Web settings sidebar. The server
 * aggregates token usage across every persisted session and serves it at
 * /api/usage-stats/summary for the client page.
 *
 * Data source: ctx.sessionQuery reads each session's complete durable log
 * (readSession), from which we fold assistant/message usage per model and per
 * day, plus turn/step counts and wall times. A background full scan seeds the
 * aggregate on first request; afterwards every live session/event folds in
 * incrementally, so the endpoint always answers instantly.
 *
 * @license MIT
 */

import z from "@deepseek-ai/schemastery";

export const name = "usage-stats";
export const inject = ["sessionQuery", "webServer"];

/** Settings namespace name; the Web plugins page pairs the card by this key. */
export const NS = "usage-stats";

/**
 * Plugin configuration schema. Exported so Cordis validates the bundle-patch /
 * user-layer values at load time and fills these defaults.
 */
export const Config = z.object({
  /** Master switch for the usage-stats section. */
  enabled: z.boolean().default(true),
});

/** Local YYYY-MM-DD key for one epoch-ms timestamp (or a Date, reused as-is). */
function dayKey(time) {
  const d = time instanceof Date ? time : new Date(time);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add one usage record into a keyed bucket map (byDay / byModel), creating the bucket. */
function addBucket(map, key, input, output, cacheRead) {
  const bucket = map[key] ?? (map[key] = { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  bucket.inputTokens += input;
  bucket.outputTokens += output;
  bucket.totalTokens += input + output + cacheRead;
}

/** Fresh empty aggregate (the internal shape kept in memory). */
function createAggregate() {
  return {
    totals: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cacheReadTokens: 0, sessions: 0, turns: 0, steps: 0, llmMs: 0 },
    byDay: {},
    byModel: {},
    longestTurnMs: 0,
    /** Per-session last open step (turn/step/time) for pairing step/start→step/end. */
    _stepStart: {},
    /** Session ids already folded (by the seed scan or a first live event). */
    _seen: new Set(),
  };
}

/** Coerce a usage field to a finite number (0 for missing/invalid values). */
function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Fold one event into the aggregate. `step/start`→`step/end` pairing is tracked
 * per session so live incremental events pair correctly.
 * @param {any} acc - aggregate accumulator.
 * @param {import('@deepseek-ai/dsh-session').SessionEvent} event - one event.
 */
function foldEvent(acc, event, sessionId) {
  switch (event.type) {
    case "assistant/message": {
      const usage = event.data?.usage;
      const source = event.data?.message?.source;
      const model = source?.model;
      const provider = source?.provider;
      const modelKey = model ? `${provider ? provider + "/" : ""}${model}` : "unknown";
      const input = toCount(usage?.inputTokens);
      const output = toCount(usage?.outputTokens);
      const cacheRead = toCount(usage?.cacheReadTokens);
      const total = input + output + cacheRead;
      if (total > 0) {
        acc.totals.inputTokens += input;
        acc.totals.outputTokens += output;
        acc.totals.cacheReadTokens += cacheRead;
        acc.totals.totalTokens += total;
        addBucket(acc.byDay, dayKey(event.time), input, output, cacheRead);
        addBucket(acc.byModel, modelKey, input, output, cacheRead);
      }
      break;
    }
    case "step/start": {
      acc._stepStart[sessionId] = { turn: event.data.turn, step: event.data.step, time: event.time };
      break;
    }
    case "step/end": {
      acc.totals.steps += 1;
      const open = acc._stepStart[sessionId];
      if (open && open.turn === event.data.turn && open.step === event.data.step) {
        const elapsed = event.time - open.time;
        acc.totals.llmMs += elapsed;
        if (elapsed > acc.longestTurnMs) acc.longestTurnMs = elapsed;
        delete acc._stepStart[sessionId];
      }
      break;
    }
    case "turn/end": {
      acc.totals.turns += 1;
      break;
    }
    default:
      break;
  }
}

/**
 * Fold one session's full event log into the aggregate.
 * @param {any} acc - aggregate accumulator.
 * @param {readonly import('@deepseek-ai/dsh-session').SessionEvent[]} events - session events.
 * @param {string} sessionId - the session's id.
 */
function foldSession(acc, events, sessionId) {
  for (const event of events) foldEvent(acc, event, sessionId);
}

/** Build the public summary from the internal aggregate (drops pairing state). */
function buildSummary(acc) {
  return {
    totals: acc.totals,
    byDay: acc.byDay,
    byModel: acc.byModel,
    longestTurnMs: acc.longestTurnMs,
    streak: computeStreak(acc.byDay),
  };
}

/**
 * Compute consecutive active-day streaks from the per-day token keys.
 * @param {Record<string, any>} byDay - per-day buckets.
 * @returns {{ current: number; longest: number }}
 */
function computeStreak(byDay) {
  const days = new Set(Object.keys(byDay));
  if (days.size === 0) return { current: 0, longest: 0 };
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const key of sorted) {
    const t = Date.parse(key + "T00:00:00");
    if (prev !== null && Math.round((t - prev) / 86400000) === 1) run += 1;
    else run = 1;
    if (run > longest) longest = run;
    prev = t;
  }
  // Current streak: count back from today; when today has no usage yet,
  // start from yesterday so the streak does not read 0 before the day's
  // first message.
  let current = 0;
  const today = new Date();
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 400; i += 1) {
    const key = dayKey(cursor);
    if (days.has(key)) { current += 1; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return { current, longest };
}

/**
 * Plugin activation: register the /api/usage-stats/summary endpoint and keep
 * the aggregate fresh incrementally. A background full scan seeds the cache
 * (lazily, only when the page first asks); afterwards each live
 * `session/event` folds into the cache, so the endpoint always answers
 * instantly and no full re-scan ever runs again.
 *
 * No work happens at startup: the first page load triggers the seed, so a
 * restart is not slowed by the aggregation.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {import('./index.d.ts').UsageStatsConfig} config - resolved config.
 */
export function apply(ctx, config) {
  const logger = ctx.logger;
  const enabled = config?.enabled !== false;
  if (!enabled) return;

  /** The live, incrementally-maintained aggregate (null until seeded). */
  let acc = null;
  /** One in-flight background seed, shared so concurrent asks don't rescan. */
  let seeding = null;

  /** Seed the aggregate from a full scan (background, non-blocking). */
  function seed(sessionQuery) {
    if (seeding !== null) return seeding;
    seeding = (async () => {
      const next = createAggregate();
      let sessions = [];
      try { sessions = await sessionQuery.listSessions(); } catch { sessions = []; }
      next.totals.sessions = sessions.length;
      // Bounded pool: read a few logs at a time and fold each as it
      // arrives, so neither I/O concurrency nor peak memory grows with
      // the number of sessions.
      let head = 0;
      const worker = async () => {
        while (head < sessions.length) {
          const record = sessions[head];
          head += 1;
          const id = record?.header?.id;
          if (!id) continue;
          next._seen.add(id);
          try {
            const snapshot = await sessionQuery.readSession(id);
            foldSession(next, snapshot.events ?? [], id);
          } catch {
            // An unreadable session is skipped, not fatal.
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(8, sessions.length) }, worker));
      acc = next;
    })().finally(() => { seeding = null; });
    return seeding;
  }

  /** Fold one live event into the aggregate (incremental, cheap). */
  function onSessionEvent(session, event) {
    if (acc === null) return; // not seeded yet; the seed will include it
    const id = session?.id;
    try {
      if (id && !acc._seen.has(id)) {
        // First live event of a session created after the seed: count it.
        acc._seen.add(id);
        acc.totals.sessions += 1;
      }
      foldEvent(acc, event, id);
    } catch {
      // A malformed live event is skipped, not fatal.
    }
  }

  ctx.on("session/event", onSessionEvent);

  ctx.inject(["sessionQuery", "webServer"], (sctx) => {
    try {
      sctx.webServer.register({
        kind: "exact",
        path: "/api/usage-stats/summary",
        handler: async (req, res) => {
          try {
            if (acc === null) {
              // Cold: seed in the background, answer "computing" so the page
              // polls again shortly instead of hanging on the scan.
              void seed(sctx.sessionQuery).catch(() => {});
              res.writeHead(200, { "content-type": "application/json" });
              res.end(JSON.stringify({ computing: true }));
              return;
            }
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify(buildSummary(acc)));
          } catch (error) {
            logger?.warn?.(`[usage-stats] aggregation failed: ${String(error)}`);
            res.writeHead(500, { "content-type": "application/json" });
            res.end(JSON.stringify({ error: "aggregation failed" }));
          }
        },
      });
    } catch (error) {
      logger?.warn?.("[usage-stats] failed to register endpoint:", error);
    }
  });
}
