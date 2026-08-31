/**
 * Model Pricing Catalog and Cost Estimator
 *
 * Provides standardized per-1M-token pricing rates for mainstream AI models
 * in both USD ($) and CNY (¥), including cache-hit discounts.
 *
 * @license MIT
 */

/**
 * Rates per 1M tokens: input (cache-miss), output (including reasoning), cache-hit.
 * @type {Record<string, { usd: { input: number; output: number; cache: number }; cny: { input: number; output: number; cache: number } }>}
 */
export const MODEL_PRICING = {
  // DeepSeek Series
  "deepseek-chat": {
    usd: { input: 0.27, output: 1.10, cache: 0.07 },
    cny: { input: 2.0, output: 8.0, cache: 0.5 },
  },
  "deepseek-v3": {
    usd: { input: 0.27, output: 1.10, cache: 0.07 },
    cny: { input: 2.0, output: 8.0, cache: 0.5 },
  },
  "deepseek-reasoner": {
    usd: { input: 0.55, output: 2.19, cache: 0.14 },
    cny: { input: 4.0, output: 16.0, cache: 1.0 },
  },
  "deepseek-r1": {
    usd: { input: 0.55, output: 2.19, cache: 0.14 },
    cny: { input: 4.0, output: 16.0, cache: 1.0 },
  },
  "deepseek-v4-flash": {
    usd: { input: 0.44, output: 1.32, cache: 0.014 },
    cny: { input: 3.0, output: 9.0, cache: 0.10 },
  },
  "deepseek-v4-pro": {
    usd: { input: 1.32, output: 3.96, cache: 0.044 },
    cny: { input: 9.0, output: 27.0, cache: 0.30 },
  },

  // Anthropic Claude Series
  "claude-3-5-sonnet": {
    usd: { input: 3.0, output: 15.0, cache: 0.30 },
    cny: { input: 21.6, output: 108.0, cache: 2.16 },
  },
  "claude-3-7-sonnet": {
    usd: { input: 3.0, output: 15.0, cache: 0.30 },
    cny: { input: 21.6, output: 108.0, cache: 2.16 },
  },
  "claude-3-5-haiku": {
    usd: { input: 0.80, output: 4.0, cache: 0.08 },
    cny: { input: 5.76, output: 28.8, cache: 0.58 },
  },
  "claude-3-opus": {
    usd: { input: 15.0, output: 75.0, cache: 1.50 },
    cny: { input: 108.0, output: 540.0, cache: 10.8 },
  },

  // OpenAI Series
  "gpt-4o": {
    usd: { input: 2.50, output: 10.0, cache: 1.25 },
    cny: { input: 18.0, output: 72.0, cache: 9.0 },
  },
  "gpt-4o-mini": {
    usd: { input: 0.15, output: 0.60, cache: 0.075 },
    cny: { input: 1.08, output: 4.32, cache: 0.54 },
  },
  "o1": {
    usd: { input: 15.0, output: 60.0, cache: 7.50 },
    cny: { input: 108.0, output: 432.0, cache: 54.0 },
  },
  "o3-mini": {
    usd: { input: 1.10, output: 4.40, cache: 0.55 },
    cny: { input: 7.92, output: 31.68, cache: 3.96 },
  },

  // MiniMax Series
  "minimax-m3": {
    usd: { input: 0.14, output: 0.14, cache: 0.03 },
    cny: { input: 1.0, output: 1.0, cache: 0.2 },
  },
  "abab6.5s": {
    usd: { input: 0.14, output: 0.14, cache: 0.03 },
    cny: { input: 1.0, output: 1.0, cache: 0.2 },
  },

  // Moonshot / Kimi Series
  "moonshot-v1": {
    usd: { input: 1.67, output: 1.67, cache: 0.17 },
    cny: { input: 12.0, output: 12.0, cache: 1.2 },
  },
  "kimi": {
    usd: { input: 1.67, output: 1.67, cache: 0.17 },
    cny: { input: 12.0, output: 12.0, cache: 1.2 },
  },

  // Qwen Series
  "qwen-max": {
    usd: { input: 2.78, output: 8.33, cache: 0.56 },
    cny: { input: 20.0, output: 60.0, cache: 4.0 },
  },
  "qwen-plus": {
    usd: { input: 0.11, output: 0.28, cache: 0.03 },
    cny: { input: 0.80, output: 2.0, cache: 0.20 },
  },
  "qwen-turbo": {
    usd: { input: 0.04, output: 0.08, cache: 0.01 },
    cny: { input: 0.30, output: 0.60, cache: 0.05 },
  },
};

/** Default baseline rate when model is unknown. */
const DEFAULT_PRICE = {
  usd: { input: 0.50, output: 2.0, cache: 0.10 },
  cny: { input: 3.5, output: 14.0, cache: 0.70 },
};

/**
 * Match model pricing rates using exact or prefix/substring lookup.
 * @param {string} modelKey
 * @returns {{ usd: { input: number; output: number; cache: number }; cny: { input: number; output: number; cache: number } }}
 */
export function getModelPrice(modelKey) {
  if (!modelKey) return DEFAULT_PRICE;
  const key = String(modelKey).toLowerCase();

  // 1. Direct match
  for (const [name, price] of Object.entries(MODEL_PRICING)) {
    if (key === name || key.endsWith("/" + name)) return price;
  }

  // 2. Fuzzy match by keyword
  if (key.includes("reasoner") || key.includes("r1")) return MODEL_PRICING["deepseek-r1"];
  if (key.includes("deepseek") || key.includes("ox-alpha") || key.includes("stealth")) return MODEL_PRICING["deepseek-v3"];
  if (key.includes("3-7-sonnet") || key.includes("3.7-sonnet")) return MODEL_PRICING["claude-3-7-sonnet"];
  if (key.includes("sonnet")) return MODEL_PRICING["claude-3-5-sonnet"];
  if (key.includes("haiku")) return MODEL_PRICING["claude-3-5-haiku"];
  if (key.includes("opus")) return MODEL_PRICING["claude-3-opus"];
  if (key.includes("o3")) return MODEL_PRICING["o3-mini"];
  if (key.includes("o1")) return MODEL_PRICING["o1"];
  if (key.includes("gpt-4o-mini")) return MODEL_PRICING["gpt-4o-mini"];
  if (key.includes("gpt-4o") || key.includes("gpt-4")) return MODEL_PRICING["gpt-4o"];
  if (key.includes("minimax") || key.includes("abab")) return MODEL_PRICING["minimax-m3"];
  if (key.includes("kimi") || key.includes("moonshot")) return MODEL_PRICING["kimi"];
  if (key.includes("qwen-max")) return MODEL_PRICING["qwen-max"];
  if (key.includes("qwen-plus")) return MODEL_PRICING["qwen-plus"];
  if (key.includes("qwen")) return MODEL_PRICING["qwen-turbo"];

  return DEFAULT_PRICE;
}

/**
 * Calculate cost and cache savings for a given usage triplet.
 * @param {string} modelKey - Model identifier.
 * @param {number} inputTokens - Cache-miss input tokens.
 * @param {number} outputTokens - Output / reasoning tokens.
 * @param {number} cacheReadTokens - Cache-hit read tokens.
 * @returns {{ costUsd: number; costCny: number; savedUsd: number; savedCny: number }}
 */
export function calculateUsageCost(modelKey, inputTokens, outputTokens, cacheReadTokens) {
  const price = getModelPrice(modelKey);
  const input = Number(inputTokens) || 0;
  const output = Number(outputTokens) || 0;
  const cache = Number(cacheReadTokens) || 0;

  // Actual cost: input * inputRate + output * outputRate + cache * cacheRate
  const costUsd = (input * price.usd.input + output * price.usd.output + cache * price.usd.cache) / 1e6;
  const costCny = (input * price.cny.input + output * price.cny.output + cache * price.cny.cache) / 1e6;

  // Cache savings: what it WOULD have cost at normal input price minus actual cache price
  const savedUsd = (cache * (price.usd.input - price.usd.cache)) / 1e6;
  const savedCny = (cache * (price.cny.input - price.cny.cache)) / 1e6;

  return {
    costUsd: Math.max(0, costUsd),
    costCny: Math.max(0, costCny),
    savedUsd: Math.max(0, savedUsd),
    savedCny: Math.max(0, savedCny),
  };
}
