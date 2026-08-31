/**
 * Types for dsh-plugin-usage-stats.
 * @license MIT
 */

import type { Context } from "@deepseek-ai/cordis";

export interface UsageStatsConfig {
  /** Master switch for the usage-stats section. Defaults to true. */
  enabled?: boolean;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  reasoningTokens: number;
  userInputTokens: number;
  toolResultTokens: number;
  costUsd: number;
  costCny: number;
  savedUsd: number;
  savedCny: number;
  sessions: number;
  turns: number;
  steps: number;
  llmMs: number;
  tokensPerSecond: number;
  avgTurnMs: number;
  totalToolCalls: number;
}

export interface DayBucket {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUsd: number;
  costCny: number;
}

export interface ModelBucket {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUsd: number;
  costCny: number;
}

export interface TokenCompositionItem {
  category: "cacheRead" | "userInput" | "assistantOutput" | "reasoning" | "toolResult";
  labelKey: string;
  tokens: number;
  percent: number;
  color: string;
}

export interface TopSessionItem {
  id: string;
  title: string;
  workspace: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  costCny: number;
  turns: number;
  lastActiveTime: number;
}

export interface TopToolItem {
  name: string;
  count: number;
  percent: number;
}

export interface UsageStatsSummary {
  totals: UsageTotals;
  tokenComposition: TokenCompositionItem[];
  topSessions: TopSessionItem[];
  topTools: TopToolItem[];
  byDay: Record<string, DayBucket>;
  byModel: Record<string, ModelBucket>;
  longestTurnMs: number;
  streak: { current: number; longest: number };
  computing?: boolean;
  error?: string;
}

export declare const name: "usage-stats";
export declare const inject: readonly ["sessionQuery", "webServer"];
export declare const NS: "usage-stats";
export declare function apply(ctx: Context, config: UsageStatsConfig): void;
