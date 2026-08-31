# dsh-plugin-usage-stats

[English](README.md) | 简体中文

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Plugin-blueviolet.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Version: 0.2.0](https://img.shields.io/badge/Version-0.2.0-brightgreen.svg)]()
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen.svg)]()
[![Platform: Web](https://img.shields.io/badge/Platform-Web-orange.svg)]()

一个企业级 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 官方架构扩展插件：在 Web 设置侧边栏中新增原生的 **AI 使用统计与成本洞察看板** —— 涵盖中美双币金额估算（$/¥）、提示词缓存节省金额核算、5 维 Token 构成深度剖析、365 天活动热力图、近 30 天每日 Token 双曲线趋势、多维分布环形图（按供应商/按模型/按费用）、高消耗会话排行榜 Top 10 及高频工具调用分析，全部由本地会话日志实时聚合而来。

![preview](preview.png)

---

## ✨ 功能特性

- **💰 成本核算与效率洞察**
  - **精准金额估算**：内置 DeepSeek、Claude、GPT、MiniMax、Kimi、通义千问等主流模型定价表，支持一键切换 **$ 美元** 与 **¥ 人民币** 计价；
  - **缓存命中节省核算**：精准计算 Prompt 缓存命中为用户省下了多少真实金额及成本折扣百分比；
  - **速率与延迟分析**：展示平均生成吞吐速率（**Tokens/s**）与平均单回合耗时。
- **🧱 5 维 Token 构成深度剖析**
  - 采用分段堆叠横向色彩条，透视 Token 到底被谁消耗：
    - 🔵 **缓存命中 (Cache Read)**：从上下文缓存中复用的 Token
    - 🟢 **用户输入 (User Input)**：人类直接发送的指令
    - 🟣 **模型回复 (Assistant Output)**：模型的普通文本回复
    - 🟡 **深度思考 (Reasoning / CoT)**：模型的思考推导链
    - 🌸 **工具返回 (Tool Results)**：工具执行返回的 Payload 数据
- **🏆 高消耗会话排行榜 Top 10**
  - 自动归纳出历史上 Token 消耗最高的前 10 个会话，展示标题、所属工作区、总 Token、回合数、预估费用及最后活跃时间，支持一键点击直接打开对应会话。
- **🛠️ 高频工具调用分析**
  - 统计 Agent 最常调用的工具（如 `view_file`、`run_command`、`replace_file_content` 等），直观展示调用次数与占比。
- **🟩 365 天活动热力图**
  - GitHub 风格贡献方格图，直观展现全年每日的 Token 消耗强度与活跃频次。
- **📈 近 30 天每日 Token 趋势图**
  - 平滑的双贝塞尔曲线（输入 vs. 输出）配合柔和面积渐变，动态捕捉近一月的 Token 峰值与日常波动。
- **🍩 多维度用量与费用环形图**
  - 多彩 SVG 环形图，支持三维一键切换：**「按供应商」** / **「按模型」** / **「按费用」**。
- **⚡ 零外部前端依赖**
  - 所有统计图表、热力图、双曲线、堆叠条与 Tooltip 均为原生内联 SVG 手写渲染，不引入任何笨重图表库（ECharts/Chart.js/D3），零跨包运行时负担。
- **🔒 100% 本地隐私安全**
  - 数据全部从本地 SQLite / JSONL 会话日志解析，由本地 Web 进程提供 API。绝无外部遥测、无数据上报。
- **🌐 完善的中英双语适配**
  - 深度适配 DeepSeek Harness 原生多语言系统，随 Web GUI 自动无缝切换。

---

## 🏗️ 工作原理与架构

```
┌─────────────────────────────────────────────────────────────┐
│                    DSH Web 前端 (浏览器)                     │
│  - 设置侧边栏子项: "使用统计与成本看板"                         │
│  - 原生手绘内联 SVG 图表 (构成条 / 热力图 / 趋势线 / 环形图)   │
│  - 币种切换 ($ USD / ¥ CNY) 与维度切换 (供应商 / 模型 / 费用) │
└──────────────────────────────▲──────────────────────────────┘
                               │ GET /api/usage-stats/summary
┌──────────────────────────────▼──────────────────────────────┐
│                    DSH 服务端插件层                          │
│  - 定价计算引擎 (pricing.js: DeepSeek/Claude/GPT 费率)      │
│  - Token 分类器 (用户输入 / 模型输出 / 思考链 / 工具结果)     │
│  - 惰性首次扫描 (有界并发后台 Worker)                         │
│  - 实时增量合并 (监听 session/event 会话事件流)               │
│  - 内存态缓存 (亚毫秒级瞬间响应)                               │
└──────────────────────────────▲──────────────────────────────┘
                               │ 读取
┌──────────────────────────────┴──────────────────────────────┐
│               本地会话存储目录 (~/.dsh/)                      │
│               - session-persistence-jsonl / sqlite          │
└─────────────────────────────────────────────────────────────┘
```

1. **惰性非阻塞启动**：
   首次启动时不会拖慢 DSH 服务，仅在首次发起请求时通过有界并发后台 Worker 异步扫描历史日志。
2. **实时增量折叠**：
   在后续对话过程中，直接通过 `session/event` 实时事件增量折叠更新，永不需要进行二次全量磁盘重扫。
3. **极速接口响应**：
   `/api/usage-stats/summary` 接口直接读取内存聚合状态，响应时间在 1ms 以内。

---

## 📋 环境要求

- 带有 Web profile 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`)。
- [pnpm](https://pnpm.io)（用于 DSH 插件依赖链接管理）。

---

## 🚀 安装步骤

### 方式 1：直接从 GitHub 安装（推荐）

```sh
# 安装插件至 web profile
dsh plugin --profile web add github:kolawong/dsh-plugin-usage-stats

# 启动 DSH Web 服务
dsh web
```

### 方式 2：从本地工作区目录安装

```sh
git clone https://github.com/kolawong/dsh-plugin-usage-stats.git
dsh plugin --profile web add ./dsh-plugin-usage-stats
dsh web
```

### 访问与验证

服务启动后，打开浏览器访问 DSH Web，在左侧导航进入：
👉 **「设置」 → 「使用统计」**

检查插件是否生效：
```sh
dsh --profile web --dump-config | grep usage-stats
```

### 卸载

```sh
dsh plugin --profile web remove dsh-plugin-usage-stats
```

---

## 📡 接口定义 (API Reference)

### `GET /api/usage-stats/summary`

获取聚合后的统计用量、费用、分类构成及排行榜数据。

#### 返回示例：

```jsonc
{
  "totals": {
    "inputTokens": 22122000,       // 累计输入 Token
    "outputTokens": 2583000,       // 累计输出 Token
    "cacheReadTokens": 740000000,  // 累计缓存命中 Token
    "reasoningTokens": 950000,     // 累计思考链 Token
    "userInputTokens": 320000,     // 累计用户指令 Token
    "toolResultTokens": 1850000,   // 累计工具返回 Token
    "totalTokens": 764705000,      // 累计总 Token
    "costUsd": 14.85,              // 预估美元费用
    "costCny": 105.40,             // 预估人民币费用
    "savedUsd": 88.50,             // 缓存节省美元
    "savedCny": 628.00,            // 缓存节省人民币
    "sessions": 54,                // 会话总数
    "turns": 244,                  // 对话回合总数
    "steps": 1900,                 // 工具调用步数
    "llmMs": 5400000,              // 累计推理耗时 (ms)
    "tokensPerSecond": 142.5,      // 平均生成速率 (t/s)
    "avgTurnMs": 22131,            // 平均单回合耗时 (ms)
    "totalToolCalls": 485          // 工具调用总次数
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
      "title": "开发订阅额度徽章插件",
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

## 🛠️ 本地开发与测试

```sh
# 运行单元测试
npm test
```

---

## 📄 开源许可证

[MIT](LICENSE) © [kola](https://github.com/kolawong)
