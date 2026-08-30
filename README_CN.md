# dsh-plugin-usage-stats

[English](README.md) | 简体中文

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一个 [DeepSeek Harness](https://github.com/deepseek-harness) 插件：在 Web 设置侧边栏中新增**使用统计**页面 —— Token 总量、365 天活动热力图、近 30 天输入/输出趋势、模型用量占比，全部由本地会话日志聚合而来。

![preview](preview.png)

## 功能特性

- **关键指标一览** —— 总计 / 输入 / 输出 / 缓存命中 Token、会话数、回合数、峰值日 Token、最长回合时长、当前与最长连续活跃天数。
- **365 天活动热力图** —— 贡献图风格，展示每日 Token 用量。
- **近 30 天每日 Token 趋势** —— 平滑的输入/输出双曲线，配柔和面积填充。
- **模型用量** —— 环形图 + 模型列表，支持「按供应商 / 按模型」两种维度切换。
- **中英双语界面** —— 跟随 Web GUI 的语言设置。
- **零依赖** —— 所有图表均为手写内联 SVG，不引入图表库，也没有跨包引用。
- **纯本地** —— 统计数据全部由本地会话日志计算、由本地 Web 服务提供，无遥测、无外部网络请求。

## 工作原理

插件分为两半：

- **服务端（`index.js`）**：聚合所有持久化的会话日志，得到总量、按日、按模型三组数据，通过 `GET /api/usage-stats/summary` 提供服务。聚合在首次请求时才惰性启动（有界并发的后台扫描），此后每条实时 `session/event` 增量合并进来 —— 启动零开销、接口即时响应、且永不再做全量扫描。
- **客户端（`client.js`）**：注册 `settings.section` 设置分区并渲染页面 —— 汇总卡片、热力图、趋势线与环形图，全部为内联 SVG。

## 环境要求

- 带有 Web profile 的 `dsh` 命令行工具（DeepSeek Harness）。
- [pnpm](https://pnpm.io) —— `dsh plugin` 会转发给 pnpm 管理插件依赖。

## 安装

从 GitHub 直接安装到 `web` profile：

```sh
dsh plugin --profile web add github:kolawong/dsh-plugin-usage-stats
dsh web
```

然后打开 Web GUI，进入 **设置 → 使用统计**。

本插件是纯 JavaScript、无需构建，因此 git 安装开箱即用 —— 不需要在 `pnpm-workspace.yaml` 里添加 `allowBuilds`。从本地目录安装：

```sh
dsh plugin --profile web add ./dsh-plugin-usage-stats
```

安装后可验证层是否生效，再启动：

```sh
dsh --profile web --dump-config   # 应出现 "# == dsh-plugin-usage-stats" 层
dsh web
```

卸载：

```sh
dsh plugin --profile web remove dsh-plugin-usage-stats
```

## 配置

| 选项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enabled` | 布尔 | `true` | 统计分区与接口的总开关。 |

可在 profile 自己的补丁层（`$DSH_HOME/profiles/web/cordis.patch.yml`，默认 `~/.dsh/profiles/web/cordis.patch.yml`）覆盖插件行。后层会整行替换，请把所有字段补全：

```yaml
- insert:
    - id: usage-stats
      name: 'dsh-plugin-usage-stats'
      inject:
        - webServer
        - sessionQuery
      config:
        enabled: false
```

## 接口

`GET /api/usage-stats/summary` 返回聚合结果：

```jsonc
{
  "totals": {
    "inputTokens": 12000000, "outputTokens": 3400000, "totalTokens": 15900000,
    "cacheReadTokens": 500000, "sessions": 42, "turns": 318, "steps": 1900, "llmMs": 5400000
  },
  "byDay": { "2025-08-29": { "inputTokens": 1000, "outputTokens": 500, "totalTokens": 1500 } },
  "byModel": { "ark/deepseek-v4-flash": { "inputTokens": 800, "outputTokens": 400, "totalTokens": 1200 } },
  "longestTurnMs": 90000,
  "streak": { "current": 3, "longest": 17 }
}
```

首次聚合尚未完成时，接口返回 `{"computing":true}`，页面会轮询直到结果就绪。

## 开发

无需构建 —— 纯 ESM JavaScript。目录结构：

| 文件 | 职责 |
|---|---|
| `index.js` | 服务端：聚合 + HTTP 接口。 |
| `client.js` | 客户端：设置分区 UI（内联 SVG 图表）。 |
| `index.d.ts` | 服务端的公共类型声明。 |
| `cordis.patch.yml` | 插入插件的 bundle 补丁层。 |
| `scripts/smoke.mjs` | 服务端离线冒烟测试。 |
| `scripts/client-smoke.mjs` | 客户端离线冒烟测试（模拟 React 与模块表）。 |

运行测试：

```sh
npm test              # 两个测试都跑
npm run smoke         # 仅服务端
npm run smoke:client  # 仅客户端
```

## 许可证

[MIT](LICENSE) © kola
