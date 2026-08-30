/**
 * dsh-plugin-usage-stats - public type face of the server half.
 * The client half is plain browser JS loaded through the dsh module table.
 */

import type { Context } from '@deepseek-ai/cordis'

export declare const name: "usage-stats";
export declare const inject: string[];

/** Settings namespace name; the Web plugins page pairs the card by this key. */
export declare const NS: "usage-stats";

export interface UsageStatsConfig {
  /** Master switch for the usage-stats section (default true). */
  enabled: boolean;
}

/** Aggregated usage summary served at /api/usage-stats/summary. */
export interface UsageSummary {
  /** Totals across every session. */
  totals: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cacheReadTokens: number;
    sessions: number;
    turns: number;
    /** Total step count across every session. */
    steps: number;
    llmMs: number;
  };
  /** Per-day token totals keyed by YYYY-MM-DD (local), ascending. */
  byDay: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }>;
  /** Per-model token totals, descending. */
  byModel: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }>;
  /** Longest single-turn LLM wall time (ms). */
  longestTurnMs: number;
  /** Current / longest consecutive active days. */
  streak: { current: number; longest: number };
}

export declare function apply(ctx: Context, config: UsageStatsConfig): void;
