/**
 * dsh-plugin-usage-stats — Server half
 *
 * Adds a Usage Statistics section to the Web settings sidebar. The server
 * aggregates token usage, costs, timing, and tool activity across every
 * persisted session and serves it at /api/usage-stats/summary for the client page.
 *
 * Data source: ctx.sessionQuery reads each session's complete durable log
 * (readSession), from which we fold assistant/message usage per model, per
 * day, and per category, plus turn/step counts, tools activity, and wall times.
 * A background full scan seeds the aggregate on first request; afterwards every
 * live session/event folds in incrementally, so the endpoint always answers instantly.
 *
 * @license MIT
 */

let z;
try {
  const mod = await import("@deepseek-ai/schemastery");
  z = mod.default || mod;
} catch {
  z = { object: () => ({ default: () => ({}) }), boolean: () => ({ default: () => true }) };
}
import { calculateUsageCost, getModelPrice } from "./pricing.js";

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
function addBucket(map, key, input, output, cacheRead, costUsd = 0, costCny = 0) {
  const bucket = map[key] ?? (map[key] = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    costCny: 0,
  });
  bucket.inputTokens += input;
  bucket.outputTokens += output;
  bucket.cacheReadTokens += cacheRead;
  bucket.totalTokens += input + output + cacheRead;
  bucket.costUsd += costUsd;
  bucket.costCny += costCny;
}

/** Fresh empty aggregate (the internal shape kept in memory). */
function createAggregate() {
  return {
    totals: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheReadTokens: 0,
      reasoningTokens: 0,
      userInputTokens: 0,
      toolResultTokens: 0,
      costUsd: 0,
      costCny: 0,
      savedUsd: 0,
      savedCny: 0,
      sessions: 0,
      turns: 0,
      steps: 0,
      llmMs: 0,
    },
    byDay: {},
    byModel: {},
    toolsUsage: {},
    sessionsMap: new Map(),
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

/** Approximate tokens from a text string (~4 characters ≈ 1 token). */
function estimateTextTokens(text) {
  if (typeof text !== "string" || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Fold one event into the aggregate. `step/start`→`step/end` pairing is tracked
 * per session so live incremental events pair correctly.
 * @param {any} acc - aggregate accumulator.
 * @param {any} event - one event.
 * @param {string} sessionId - session id.
 * @param {any} sessionHeader - optional session header metadata.
 */
function foldEvent(acc, event, sessionId, sessionHeader = null) {
  // Ensure session entry in sessionsMap
  let sessionRecord = acc.sessionsMap.get(sessionId);
  if (!sessionRecord && sessionId) {
    const rawCwd = sessionHeader?.cwd || sessionHeader?.workspace || "";
    let defaultTitle = sessionHeader?.title || sessionHeader?.name || "";
    if (!defaultTitle && rawCwd) {
      const parts = rawCwd.split(/[\/\\]/).filter(Boolean);
      defaultTitle = parts[parts.length - 1] || "";
    }
    if (!defaultTitle) {
      defaultTitle = sessionId.replace(/^session-/, "").slice(0, 8);
    }
    sessionRecord = {
      id: sessionId,
      title: defaultTitle,
      workspace: rawCwd,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      costUsd: 0,
      costCny: 0,
      turns: 0,
      lastActiveTime: event.time || Date.now(),
    };
    acc.sessionsMap.set(sessionId, sessionRecord);
  }
  if (sessionRecord && event.time && event.time > sessionRecord.lastActiveTime) {
    sessionRecord.lastActiveTime = event.time;
  }

  // Handle dynamic title and workspace events
  if (sessionRecord) {
    if ((event.type === "session/title" || event.type === "session/rename") && event.data?.title) {
      sessionRecord.title = event.data.title;
    }
    if ((event.type === "workspace/attach" || event.type === "session/header") && (event.data?.cwd || event.data?.workspace)) {
      sessionRecord.workspace = event.data.cwd || event.data.workspace;
    }
  }

  switch (event.type) {
    case "assistant/message": {
      const usage = event.data?.usage;
      const message = event.data?.message;
      const source = message?.source;
      const model = source?.model;
      const provider = source?.provider;
      const modelKey = model ? `${provider ? provider + "/" : ""}${model}` : "unknown";

      const input = toCount(usage?.inputTokens);
      const output = toCount(usage?.outputTokens);
      const cacheRead = toCount(usage?.cacheReadTokens);
      const total = input + output + cacheRead;

      // Extract reasoning tokens from usage or content blocks
      let reasoning = toCount(usage?.reasoningTokens || usage?.reasoning_tokens);
      if (reasoning === 0 && Array.isArray(message?.content)) {
        for (const block of message.content) {
          if (block?.type === "reasoning" && typeof block.text === "string") {
            reasoning += estimateTextTokens(block.text);
          }
          // Also record tool calls
          if (block?.type === "tool-call" && block.name) {
            acc.toolsUsage[block.name] = (acc.toolsUsage[block.name] || 0) + 1;
          }
        }
      }

      if (total > 0) {
        const { costUsd, costCny, savedUsd, savedCny } = calculateUsageCost(modelKey, input, output, cacheRead);

        acc.totals.inputTokens += input;
        acc.totals.outputTokens += output;
        acc.totals.cacheReadTokens += cacheRead;
        acc.totals.reasoningTokens += reasoning;
        acc.totals.totalTokens += total;
        acc.totals.costUsd += costUsd;
        acc.totals.costCny += costCny;
        acc.totals.savedUsd += savedUsd;
        acc.totals.savedCny += savedCny;

        addBucket(acc.byDay, dayKey(event.time), input, output, cacheRead, costUsd, costCny);
        addBucket(acc.byModel, modelKey, input, output, cacheRead, costUsd, costCny);

        if (sessionRecord) {
          sessionRecord.inputTokens += input;
          sessionRecord.outputTokens += output;
          sessionRecord.cacheReadTokens += cacheRead;
          sessionRecord.totalTokens += total;
          sessionRecord.costUsd += costUsd;
          sessionRecord.costCny += costCny;
        }
      }
      break;
    }
    case "user/message": {
      const content = event.data?.content;
      let textTokens = 0;
      let promptSnippet = "";
      if (typeof content === "string") {
        textTokens = estimateTextTokens(content);
        promptSnippet = content;
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "text" && typeof block.text === "string") {
            textTokens += estimateTextTokens(block.text);
            if (!promptSnippet && block.text.trim()) promptSnippet = block.text.trim();
          }
        }
      }
      acc.totals.userInputTokens += textTokens;

      // If session title is still fallback / default ID, adopt the first user prompt text
      if (sessionRecord && promptSnippet) {
        const isDefault = !sessionRecord.title || sessionRecord.title === "session-" || sessionRecord.title.startsWith("session-") || sessionRecord.title === sessionRecord.id.replace(/^session-/, "").slice(0, 8);
        if (isDefault) {
          const cleanPrompt = promptSnippet.replace(/[\r\n\t]+/g, " ").trim();
          sessionRecord.title = cleanPrompt.length > 40 ? cleanPrompt.slice(0, 40) + "…" : cleanPrompt;
        }
      }
      break;
    }
    case "tool/call": {
      const toolName = event.data?.name || event.data?.toolName;
      if (toolName) {
        acc.toolsUsage[toolName] = (acc.toolsUsage[toolName] || 0) + 1;
      }
      break;
    }
    case "tool/result": {
      const toolName = event.data?.name || event.data?.toolName;
      if (toolName) {
        acc.toolsUsage[toolName] = (acc.toolsUsage[toolName] || 0) + 1;
      }
      // Estimate tool result payload tokens
      const resContent = event.data?.content || event.data?.result;
      if (typeof resContent === "string") {
        acc.totals.toolResultTokens += estimateTextTokens(resContent);
      } else if (resContent) {
        try {
          acc.totals.toolResultTokens += estimateTextTokens(JSON.stringify(resContent));
        } catch {}
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
      if (sessionRecord) {
        sessionRecord.turns += 1;
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Fold one session's full event log into the aggregate.
 * @param {any} acc - aggregate accumulator.
 * @param {readonly any[]} events - session events.
 * @param {string} sessionId - the session's id.
 * @param {any} sessionHeader - session metadata header.
 */
function foldSession(acc, events, sessionId, sessionHeader = null) {
  for (const event of events) foldEvent(acc, event, sessionId, sessionHeader);
}

/** Build the public summary from the internal aggregate (drops pairing state). */
function buildSummary(acc) {
  const activeSeconds = Math.max(1, acc.totals.llmMs / 1000);
  const tokensPerSecond = Number((acc.totals.outputTokens / activeSeconds).toFixed(1));
  const avgTurnMs = acc.totals.turns > 0 ? Math.round(acc.totals.llmMs / acc.totals.turns) : 0;

  // Calculate token composition array
  const totalTokens = Math.max(1, acc.totals.totalTokens);
  const tokenComposition = [
    {
      category: "cacheRead",
      labelKey: "compCacheRead",
      tokens: acc.totals.cacheReadTokens,
      percent: Number(((acc.totals.cacheReadTokens / totalTokens) * 100).toFixed(1)),
      color: "#3b82f6",
    },
    {
      category: "userInput",
      labelKey: "compUserInput",
      tokens: acc.totals.userInputTokens,
      percent: Number(((acc.totals.userInputTokens / totalTokens) * 100).toFixed(1)),
      color: "#10b981",
    },
    {
      category: "assistantOutput",
      labelKey: "compAssistantOutput",
      tokens: Math.max(0, acc.totals.outputTokens - acc.totals.reasoningTokens),
      percent: Number(((Math.max(0, acc.totals.outputTokens - acc.totals.reasoningTokens) / totalTokens) * 100).toFixed(1)),
      color: "#8b5cf6",
    },
    {
      category: "reasoning",
      labelKey: "compReasoning",
      tokens: acc.totals.reasoningTokens,
      percent: Number(((acc.totals.reasoningTokens / totalTokens) * 100).toFixed(1)),
      color: "#f59e0b",
    },
    {
      category: "toolResult",
      labelKey: "compToolResult",
      tokens: acc.totals.toolResultTokens,
      percent: Number(((acc.totals.toolResultTokens / totalTokens) * 100).toFixed(1)),
      color: "#ec4899",
    },
  ];

  // Top 10 Sessions sorted by total tokens
  const topSessions = Array.from(acc.sessionsMap.values())
    .filter((s) => s.totalTokens > 0)
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 10);

  // Top 10 Tools sorted by usage count
  const totalToolCalls = Object.values(acc.toolsUsage).reduce((sum, n) => sum + n, 0);
  const topTools = Object.entries(acc.toolsUsage)
    .map(([name, count]) => ({
      name,
      count,
      percent: totalToolCalls > 0 ? Number(((count / totalToolCalls) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totals: {
      ...acc.totals,
      tokensPerSecond,
      avgTurnMs,
      totalToolCalls,
    },
    tokenComposition,
    topSessions,
    topTools,
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
 * the aggregate fresh incrementally.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {any} config - resolved config.
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
            foldSession(next, snapshot.events ?? [], id, record?.header);
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
    if (acc === null) return;
    const id = session?.id;
    try {
      if (id && !acc._seen.has(id)) {
        acc._seen.add(id);
        acc.totals.sessions += 1;
      }
      foldEvent(acc, event, id, session?.header);
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
