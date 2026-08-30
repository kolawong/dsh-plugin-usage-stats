# dsh-plugin-usage-stats

English | [简体中文](README_CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Plugin-blueviolet.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen.svg)]()
[![Platform: Web](https://img.shields.io/badge/Platform-Web-orange.svg)]()

A high-performance [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds a native **Usage Statistics** dashboard to the Web settings: total / input / output / cache tokens, a 365-day activity heatmap, a 30-day daily token trend curve, and a provider/model share breakdown — aggregated directly from your local session logs.

![preview](preview.png)

---

## ✨ Features

- **📊 Comprehensive Metrics Overview**
  - **Macro Metrics**: Total Tokens, Peak Daily Tokens, Longest Turn Duration, Current & Longest Activity Streaks.
  - **Granular Details**: Input Tokens, Output Tokens, Cache-Read Tokens, Total Sessions, Total Conversation Turns.
- **🟩 365-Day Activity Heatmap**
  - GitHub-style contribution heatmap visualizing daily token intensity and usage frequency throughout the year.
- **📈 30-Day Daily Token Trend**
  - Smooth Bézier dual-curve chart with soft area gradients comparing Input vs. Output token dynamics over time.
- **🍩 Interactive Model & Provider Breakdown**
  - Multi-colored SVG Donut chart with a one-click dimension switcher (`By Provider` / `By Model`), showing token volumes and percentage distributions.
- **⚡ Zero External Dependencies**
  - All charts, heatmaps, curves, and tooltips are hand-crafted inline SVGs. No heavy charting libraries (ECharts / Chart.js / D3) and no cross-package runtime baggage.
- **🔒 100% Local & Privacy-First**
  - All data is parsed from your local SQLite / JSONL session files and served by the internal Web server. Zero telemetry, zero external network requests.
- **🌐 Seamless Bilingual Localization**
  - Full native support for English and 简体中文, automatically synced with DSH's active UI locale.

---

## 🏗️ Architecture & How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    DSH Web Client (Browser)                 │
│  - Settings Section: "Usage Statistics"                     │
│  - Handcrafted Inline SVG (Heatmap / Trend / Donut)         │
└──────────────────────────────▲──────────────────────────────┘
                               │ GET /api/usage-stats/summary
┌──────────────────────────────▼──────────────────────────────┐
│                    DSH Server Plugin Layer                  │
│  - Lazy Initial Scan (Bounded concurrency background worker)│
│  - Real-time Event Incremental Tap (session/event stream)   │
│  - In-Memory Cached State (Instant sub-millisecond response)│
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
3. **Instant UI Response**:
   The `/api/usage-stats/summary` endpoint responds instantly from the cached aggregator. If the initial background indexing is still computing, it provides an atomic status response for smooth polling.

---

## 📋 Requirements

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) with the `web` profile.
- [pnpm](https://pnpm.io) (used by `dsh plugin` to link profile dependencies).

---

## 🚀 Installation

### Option 1: Install directly from GitHub (Recommended)

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

## ⚙️ Configuration

The plugin is enabled by default. You can customize its options in your profile patch file (`$DSH_HOME/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: usage-stats
      name: 'dsh-plugin-usage-stats'
      inject:
        - webServer
        - sessionQuery
      config:
        enabled: true
```

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Master toggle for the statistics dashboard and HTTP API endpoint. |

---

## 📡 HTTP API Reference

### `GET /api/usage-stats/summary`

Fetches aggregated session token usage and analytics.

#### Example Response:

```jsonc
{
  "totals": {
    "inputTokens": 22122000,
    "outputTokens": 2583000,
    "cacheReadTokens": 740000000,
    "totalTokens": 764705000,
    "sessions": 54,
    "turns": 244,
    "steps": 1900,
    "llmMs": 5400000
  },
  "byDay": {
    "2026-08-20": { "inputTokens": 850000, "outputTokens": 120000, "totalTokens": 970000 },
    "2026-08-28": { "inputTokens": 3435000, "outputTokens": 450000, "totalTokens": 3885000 }
  },
  "byModel": {
    "openrouter/stealth/ox-alpha": {
      "inputTokens": 200000000,
      "outputTokens": 20000000,
      "totalTokens": 220000000
    }
  },
  "longestTurnMs": 75240000,
  "streak": {
    "current": 12,
    "longest": 12
  }
}
```

---

## 🛠️ Development & Testing

This project is written in standard ES Modules with no compilation/build step required.

```sh
# Run both server & client unit tests
npm test

# Run server aggregation smoke test
npm run smoke

# Run client SVG & module table mock test
npm run smoke:client
```

---

## 📄 License

[MIT](LICENSE) © [kola](https://github.com/kolawong)
