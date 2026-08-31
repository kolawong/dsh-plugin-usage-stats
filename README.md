# dsh-plugin-usage-stats

English | [简体中文](README_CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Plugin-blueviolet.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Version: 0.2.0](https://img.shields.io/badge/Version-0.2.0-brightgreen.svg)]()
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen.svg)]()
[![Platform: Web](https://img.shields.io/badge/Platform-Web-orange.svg)]()

An enterprise-grade AI Usage & Cost Intelligence plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Adds a native analytics and cost dashboard to the Web settings: monetary cost estimation ($/¥), prompt cache savings, 5-way token composition breakdown, 365-day activity heatmap, 30-day dual-trend curves, multi-dimensional distribution donut (Provider/Model/Cost), top sessions leaderboard, and high-frequency tool analytics — aggregated live from your local session logs.

![preview](preview.png)

---

## ✨ Features

- **💰 Cost & Savings Intelligence**
  - **Monetary Cost Estimator**: Calculates real costs in both **$ USD** and **¥ CNY** using built-in model pricing tables (DeepSeek, Claude, GPT, MiniMax, Kimi, Qwen, etc.).
  - **Prompt Cache Savings**: Computes exact monetary savings and discount percentages achieved through prompt cache hits.
  - **Speed & Throughput**: Displays average generation throughput (**Tokens/s**) and average conversation turn latency.
- **🧱 5-Way Token Composition Breakdown**
  - Segmented stacked visual bar analyzing where tokens actually went:
    - 🔵 **Cache Read**: Tokens loaded from prompt cache
    - 🟢 **User Input**: Direct human prompts
    - 🟣 **Assistant Output**: Normal model response text
    - 🟡 **Reasoning (CoT)**: Deep thinking & reasoning tokens
    - 🌸 **Tool Results**: Payload returned by tool executions
- **🏆 Top 10 Sessions Leaderboard**
  - Ranks sessions by total token consumption, displaying session title, workspace badge, turn count, token volume, estimated cost, and 1-click navigation to jump straight into the session.
- **🛠️ High-Frequency Tool Analytics**
  - Tracks and visualizes top invoked tools (`view_file`, `run_command`, `replace_file_content`, etc.) with invocation counts and percentage shares.
- **🟩 365-Day Activity Heatmap**
  - GitHub-style contribution heatmap visualizing daily token intensity and usage frequency across the entire year.
- **📈 30-Day Daily Token Trend Curve**
  - Smooth Catmull-Rom dual-curve chart with soft area gradients comparing Input vs. Output token dynamics over the past month.
- **🍩 Multi-Dimensional Distribution Donut**
  - Interactive SVG Donut chart with a 3-way dimension switcher: **By Provider** / **By Model** / **By Cost**.
- **⚡ Zero External Dependencies**
  - 100% hand-crafted inline SVG graphics. No heavy charting libraries (ECharts / Chart.js / D3), zero runtime baggage.
- **🔒 100% Local & Privacy-First**
  - Data is aggregated purely from your local SQLite / JSONL session files. Zero telemetry, zero external network calls.

---

## 🏗️ Architecture & How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    DSH Web Client (Browser)                 │
│  - Settings Section: "Usage & Cost Intelligence"            │
│  - Hand-rolled Pure Inline SVG (Heatmap / Trend / Donut)    │
│  - Currency Switcher (¥ CNY / $ USD) & Dimension Switchers  │
└──────────────────────────────▲──────────────────────────────┘
                               │ GET /api/usage-stats/summary
┌──────────────────────────────▼──────────────────────────────┐
│                    DSH Server Plugin Layer                  │
│  - Model Pricing Engine (pricing.js: DeepSeek/Claude/GPT)   │
│  - Token Classifier (User / Output / Thinking / Tool Result)│
│  - Lazy Background Seed Worker & Incremental Live Event Tap │
│  - In-Memory State Cache (Sub-millisecond API response)     │
└──────────────────────────────▲──────────────────────────────┘
                               │ Reads
┌──────────────────────────────┴──────────────────────────────┐
│               Local Session Storage (~/.dsh/)               │
│               - session-persistence-jsonl / sqlite          │
└─────────────────────────────────────────────────────────────┘
```

1. **Lazy & Non-blocking Initialization**:
   The initial historical log scan is triggered lazily upon the first request via a bounded-concurrency background task. DSH startup is never blocked or slowed down.
2. **Real-time Incremental Folding**:
   As new conversation turns occur, live `session/event` streams are incrementally folded into the in-memory aggregated totals. No full rescans ever run again.
3. **Sub-millisecond API Response**:
   The `/api/usage-stats/summary` endpoint responds instantly from the cached aggregator.

---

## 📋 Requirements

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) with the `web` profile.
- [pnpm](https://pnpm.io) (used by `dsh plugin` to link profile dependencies).

---

## 🚀 Installation

### Option 1: Install from GitHub (Recommended)

```sh
# Add plugin to the web profile
dsh plugin --profile web add github:kolawong/dsh-plugin-usage-stats

# Start DSH Web service
dsh web
```

### Option 2: Install from a local directory

```sh
git clone https://github.com/kolawong/dsh-plugin-usage-stats.git
dsh plugin --profile web add ./dsh-plugin-usage-stats
dsh web
```

### Verification & Access

After starting, open your browser and navigate to:
👉 **Settings (`设置`) → Usage Statistics (`使用统计`)**

To check that the plugin layer is properly registered:
```sh
dsh --profile web --dump-config | grep usage-stats
```

### Uninstall

```sh
dsh plugin --profile web remove dsh-plugin-usage-stats
```

---

## 📡 HTTP API Reference

### `GET /api/usage-stats/summary`

Fetches aggregated session token usage, costs, composition, and rankings.

#### Example Response:

```jsonc
{
  "totals": {
    "inputTokens": 22122000,
    "outputTokens": 2583000,
    "cacheReadTokens": 740000000,
    "reasoningTokens": 950000,
    "userInputTokens": 320000,
    "toolResultTokens": 1850000,
    "totalTokens": 764705000,
    "costUsd": 14.85,
    "costCny": 105.40,
    "savedUsd": 88.50,
    "savedCny": 628.00,
    "sessions": 54,
    "turns": 244,
    "steps": 1900,
    "llmMs": 5400000,
    "tokensPerSecond": 142.5,
    "avgTurnMs": 22131,
    "totalToolCalls": 485
  },
  "tokenComposition": [
    { "category": "cacheRead", "tokens": 740000000, "percent": 96.8, "color": "#3b82f6" },
    { "category": "userInput", "tokens": 320000, "percent": 0.04, "color": "#10b981" },
    { "category": "assistantOutput", "tokens": 1633000, "percent": 0.21, "color": "#8b5cf6" },
    { "category": "reasoning", "tokens": 950000, "percent": 0.12, "color": "#f59e0b" },
    { "category": "toolResult", "tokens": 1850000, "percent": 0.24, "color": "#ec4899" }
  ],
  "topSessions": [
    {
      "id": "s-12345",
      "title": "Build quota badge plugin",
      "workspace": "/root/dsh-plugin-quota-badges",
      "totalTokens": 24500000,
      "turns": 38,
      "costUsd": 1.25,
      "costCny": 8.80,
      "lastActiveTime": 1788100000000
    }
  ],
  "topTools": [
    { "name": "view_file", "count": 162, "percent": 33.4 },
    { "name": "run_command", "count": 128, "percent": 26.4 }
  ],
  "byDay": {
    "2026-08-30": { "inputTokens": 3435000, "outputTokens": 450000, "totalTokens": 3885000, "costUsd": 0.45, "costCny": 3.20 }
  },
  "byModel": {
    "deepseek/deepseek-v3": { "inputTokens": 20000000, "outputTokens": 2000000, "totalTokens": 22000000, "costUsd": 7.60, "costCny": 54.00 }
  },
  "longestTurnMs": 75240000,
  "streak": { "current": 12, "longest": 12 }
}
```

---

## 🛠️ Development & Testing

```sh
# Run both server & client unit tests
npm test
```

---

## 📄 License

[MIT](LICENSE) © [kola](https://github.com/kolawong)
