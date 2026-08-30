# dsh-plugin-usage-stats

[English](README.md) | 简体中文

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Plugin-blueviolet.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen.svg)]()
[![Platform: Web](https://img.shields.io/badge/Platform-Web-orange.svg)]()

一个高性能的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 官方架构扩展插件：在 Web 设置侧边栏中新增原生**使用统计**（Usage Statistics）看板 —— 汇总累计/输入/输出/缓存命中 Token、365 天活动热力图、近 30 天每日 Token 双曲线趋势、以及供应商/模型占比分布，全部由本地会话日志实时聚合而来。

![preview](preview.png)

---

## ✨ 功能特性

- **📊 全维度关键指标一览**
  - **核心概览**：累计 Token、峰值日 Token、最长单回合时长、当前连续活跃天数、历史最长连续天数。
  - **用量细分**：输入 Token、输出 Token、缓存命中 Token、总会话数、总对话回合数。
- **🟩 365 天活动热力图**
  - GitHub 风格贡献方格图，直观展现全年每日的 Token 消耗强度与活跃频次。
- **📈 近 30 天每日 Token 趋势图**
  - 平滑的双贝塞尔曲线（输入 vs. 输出）配合柔和面积渐变，动态捕捉近一月的 Token 峰值与日常波动。
- **🍩 交互式模型用量分布图**
  - 多彩 SVG 环形图，支持一键切换维度（「按供应商」/「按模型」），清晰显示各模型 Token 用量与百分比占比。
- **⚡ 零外部前端依赖**
  - 所有统计图表、热力图、双曲线与 Tooltip 均为原生内联 SVG 手写渲染，不引入任何笨重图表库（ECharts/Chart.js/D3），零跨包运行时负担。
- **🔒 100% 本地隐私安全**
  - 数据全部从本地 SQLite / JSONL 会话日志解析，由本地 Web 进程提供 API。绝无外部遥测、无数据上报。
- **🌐 完善的中英双语适配**
  - 深度适配 DeepSeek Harness 原生多语言系统，语言随 Web GUI 自动无缝切换。

---

## 🏗️ 工作原理与架构

```
┌─────────────────────────────────────────────────────────────┐
│                    DSH Web 前端 (浏览器)                     │
│  - 设置侧边栏子项: "使用统计"                                  │
│  - 原生手绘内联 SVG 图表 (热力图 / 趋势线 / 环形图)            │
└──────────────────────────────▲──────────────────────────────┘
                               │ GET /api/usage-stats/summary
┌──────────────────────────────▼──────────────────────────────┐
│                    DSH 服务端插件层                          │
│  - 惰性首次扫描 (有界并发后台聚合 Worker)                       │
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

## ⚙️ 配置选项

插件默认已开启。如需自定义配置，可在 profile 补丁文件（`$DSH_HOME/profiles/web/cordis.patch.yml`）中配置：

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

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enabled` | `boolean` | `true` | 使用统计面板与 HTTP API 接口的总开关。 |

---

## 📡 接口定义 (API Reference)

### `GET /api/usage-stats/summary`

获取聚合后的统计用量与历史趋势数据。

#### 返回示例：

```jsonc
{
  "totals": {
    "inputTokens": 22122000,       // 累计输入 Token
    "outputTokens": 2583000,       // 累计输出 Token
    "cacheReadTokens": 740000000,  // 累计缓存命中 Token
    "totalTokens": 764705000,      // 累计总 Token
    "sessions": 54,                // 会话总数
    "turns": 244,                  // 对话回合总数
    "steps": 1900,                 // 工具调用步数
    "llmMs": 5400000               // 累计推理耗时
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
  "longestTurnMs": 75240000,       // 最长单回合耗时 (ms)
  "streak": {
    "current": 12,                 // 当前连续活跃天数
    "longest": 12                  // 历史最长连续天数
  }
}
```

---

## 🛠️ 本地开发与测试

本插件为纯标准原生 ES Modules，无需编译构建。

```sh
# 运行全部单测（服务端 + 客户端）
npm test

# 运行服务端聚合冒烟测试
npm run smoke

# 运行客户端内联 SVG 与模块加载模拟测试
npm run smoke:client
```

---

## 📄 开源许可证

[MIT](LICENSE) © [kola](https://github.com/kolawong)
