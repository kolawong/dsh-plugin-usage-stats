/**
 * dsh-plugin-usage-stats — Client half (Web Settings & In-Session Overlay).
 *
 * Registers:
 * 1. A `settings.section` entry ("使用统计" / "Usage Statistics") with:
 *    - Cost & Savings Intelligence (USD/CNY currency switcher)
 *    - 5-Way Token Composition Breakdown Bar
 *    - 365-Day Activity Heatmap
 *    - 30-Day Daily Token Trend Curve
 *    - Model Distribution Donut & Ranking (By Provider / By Model / By Cost)
 *    - Top 10 High-Volume Sessions Leaderboard (with 1-click navigation)
 *    - Top 10 Tool Invocations Analytics
 * 2. An in-session slash command overlay (`/stats` & `/usage`).
 *
 * Hand-rolled pure inline SVG — zero external charting dependencies.
 *
 * @license MIT
 */

window.__ModuleLoader__.load({
  id: "dsh-plugin-usage-stats",
  factory: (require) => {
    const exports = {};
    const React = require("react");
    const { useState, useEffect, useCallback, useMemo } = React;
    const { jsx, jsxs } = require("react/jsx-runtime");
    const { IconRefreshOutline16 } = require("@deepseek-ai/dsh-client-ui-primitives");

    const NS = "usage-stats";

    const zh = {
      nav: "使用统计",
      title: "使用统计与成本看板",
      intro: "聚合所有会话的 Token 用量、费用估算、上下文构成及工具活动。",
      loading: "统计加载中…",
      empty: "还没有会话用量数据",
      error: "统计加载失败",
      refresh: "刷新",
      refreshHint: "重新统计所有会话",
      totalTokens: "累计 Token",
      inputTokens: "输入 Token",
      outputTokens: "输出 Token",
      cacheRead: "缓存命中 Token",
      sessions: "会话数",
      turns: "回合数",
      peakDay: "峰值日 Token",
      longestTurn: "最长回合时长",
      streakCurrent: "当前连续天数",
      streakLongest: "最长连续天数",
      activity: "Token 活动热力图",
      trend: "近 30 天每日 Token 趋势",
      byModel: "模型与费用占比",
      dimProvider: "按供应商",
      dimModel: "按模型",
      dimCost: "按费用",
      legendInput: "输入 Token",
      legendOutput: "输出 Token",
      dayUnit: "天",

      // Cost & Savings
      costSection: "成本与效率概览",
      costEstimated: "预估总费用",
      cacheSaved: "缓存已节省",
      savedPercent: "已节省",
      speed: "平均生成速率",
      avgTurn: "平均单回合耗时",
      totalToolCalls: "工具调用总计",
      currencyCny: "¥ 人民币",
      currencyUsd: "$ 美元",

      // Token Composition
      composition: "Token 构成深度剖析",
      compCacheRead: "缓存命中",
      compUserInput: "用户输入",
      compAssistantOutput: "模型回复",
      compReasoning: "深度思考 (CoT)",
      compToolResult: "工具返回结果",

      // Top Sessions & Tools
      topSessions: "高消耗会话排行榜 Top 10",
      topTools: "高频工具调用 Top 10",
      sessionTitle: "会话标题",
      sessionWorkspace: "工作区",
      sessionTokens: "总 Token",
      sessionTurns: "回合",
      sessionCost: "预估费用",
      sessionActive: "最后活跃",
      toolCalls: "次调用",
      openSession: "打开会话",

      // Modal & Slash Command
      modalTitle: "会话用量速览",
      close: "关闭",
    };

    const en = {
      nav: "Usage statistics",
      title: "Usage & Cost Intelligence",
      intro: "Token usage, cost estimations, composition, and tool analytics across all sessions.",
      loading: "Loading statistics…",
      empty: "No usage data yet",
      error: "Failed to load statistics",
      refresh: "Refresh",
      refreshHint: "Recompute all session statistics",
      totalTokens: "Total Tokens",
      inputTokens: "Input Tokens",
      outputTokens: "Output Tokens",
      cacheRead: "Cache-hit Tokens",
      sessions: "Sessions",
      turns: "Turns",
      peakDay: "Peak-day Tokens",
      longestTurn: "Longest Turn",
      streakCurrent: "Current Streak",
      streakLongest: "Longest Streak",
      activity: "Token Activity Heatmap",
      trend: "30-Day Token Trend",
      byModel: "Model & Cost Distribution",
      dimProvider: "By Provider",
      dimModel: "By Model",
      dimCost: "By Cost",
      legendInput: "Input",
      legendOutput: "Output",
      dayUnit: "d",

      // Cost & Savings
      costSection: "Cost & Efficiency Overview",
      costEstimated: "Estimated Cost",
      cacheSaved: "Cache Savings",
      savedPercent: "Saved",
      speed: "Avg Speed",
      avgTurn: "Avg Turn Time",
      totalToolCalls: "Total Tool Calls",
      currencyCny: "¥ CNY",
      currencyUsd: "$ USD",

      // Token Composition
      composition: "Token Composition Breakdown",
      compCacheRead: "Cache Read",
      compUserInput: "User Input",
      compAssistantOutput: "Assistant Output",
      compReasoning: "Reasoning (CoT)",
      compToolResult: "Tool Results",

      // Top Sessions & Tools
      topSessions: "Top 10 Sessions by Token Volume",
      topTools: "Top 10 Tool Invocations",
      sessionTitle: "Session Title",
      sessionWorkspace: "Workspace",
      sessionTokens: "Total Tokens",
      sessionTurns: "Turns",
      sessionCost: "Estimated Cost",
      sessionActive: "Last Active",
      toolCalls: "calls",
      openSession: "Open Session",

      // Modal & Slash Command
      modalTitle: "Usage Statistics Snapshot",
      close: "Close",
    };

    // ── Formatting Helpers ───────────────────────────────────────────────────

    function isZh() {
      const lang = document.documentElement.lang;
      return lang === "zh-CN" || lang === "zh";
    }

    function formatTokens(n) {
      if (typeof n !== "number" || !isFinite(n)) return "0";
      if (isZh()) {
        if (n >= 1e8) return `${(n / 1e8).toFixed(1)} 亿`;
        if (n >= 1e4) return `${(n / 1e4).toFixed(1)} 万`;
        return String(Math.round(n));
      }
      if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
      if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
      if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
      return String(Math.round(n));
    }

    function formatMoney(amount, currency = "cny") {
      const n = Number(amount) || 0;
      const symbol = currency === "cny" ? "¥" : "$";
      if (n === 0) return `${symbol}0.00`;
      if (n >= 100) return `${symbol}${n.toFixed(1)}`;
      if (n >= 1) return `${symbol}${n.toFixed(2)}`;
      return `${symbol}${n.toFixed(3)}`;
    }

    function formatMs(ms) {
      if (!ms || ms <= 0) return "0";
      const zhLocale = isZh();
      const sec = Math.round(ms / 1000);
      const h = sec / 3600;
      if (h >= 1) return zhLocale ? `${h.toFixed(1)} 小时` : `${h.toFixed(1)}h`;
      const m = Math.round(sec / 60);
      if (m >= 1) return zhLocale ? `${m} 分钟` : `${m}m`;
      return zhLocale ? `${sec} 秒` : `${sec}s`;
    }

    function dayKeyOf(time) {
      const d = time instanceof Date ? time : new Date(time);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }

    function formatRelativeTime(ts) {
      if (!ts) return "";
      const diff = Date.now() - ts;
      const sec = Math.floor(diff / 1000);
      const zhLocale = isZh();
      if (sec < 60) return zhLocale ? "刚刚" : "just now";
      const min = Math.floor(sec / 60);
      if (min < 60) return zhLocale ? `${min}分钟前` : `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return zhLocale ? `${hr}小时前` : `${hr}h ago`;
      const day = Math.floor(hr / 24);
      return zhLocale ? `${day}天前` : `${day}d ago`;
    }

    // ── Reusable UI Primitives ───────────────────────────────────────────────

    function SectionTitle({ children, right }) {
      return jsxs("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 10px" },
        children: [
          jsx("span", { style: { fontSize: "14px", fontWeight: 600, color: "var(--dsw-alias-label-primary, #f3f4f6)" }, children }),
          right ?? null,
        ],
      });
    }

    function Card({ children, style = {} }) {
      return jsx("div", {
        style: {
          borderRadius: "12px",
          border: "1px solid var(--dsw-alias-border-l2, #333)",
          background: "var(--dsw-alias-bg-layer-2, #1e1e1e)",
          padding: "16px",
          ...style,
        },
        children,
      });
    }

    function StatCell({ label, value, sub, color }) {
      return jsxs("div", {
        style: {
          flex: "1 1 0", minWidth: 0, textAlign: "center",
          display: "flex", flexDirection: "column", gap: "2px",
        },
        children: [
          jsx("span", {
            style: {
              fontSize: "18px", fontWeight: 600, lineHeight: 1.2,
              color: color || "var(--dsw-alias-label-primary, #f3f4f6)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            },
            children: value,
          }),
          jsx("span", {
            style: {
              fontSize: "11.5px", color: "var(--dsw-alias-label-tertiary, #9ca3af)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            },
            children: label,
          }),
          sub ? jsx("span", {
            style: { fontSize: "10.5px", color: "var(--dsw-alias-state-success-primary, #16a34a)", marginTop: "1px" },
            children: sub,
          }) : null,
        ],
      });
    }

    function StatStrip({ cells }) {
      return jsxs("div", {
        style: {
          display: "flex", alignItems: "stretch",
          borderRadius: "12px",
          border: "1px solid var(--dsw-alias-border-l2, #333)",
          background: "var(--dsw-alias-bg-layer-2, #1e1e1e)",
          padding: "14px 8px",
        },
        children: cells.map((cell, i) => jsxs(React.Fragment, {
          children: [
            jsx(StatCell, { label: cell.label, value: cell.value, sub: cell.sub, color: cell.color }),
            i < cells.length - 1 ? jsx("div", {
              style: { width: "1px", background: "var(--dsw-alias-border-l2, #333)", margin: "2px 0", flexShrink: 0 },
            }) : null,
          ],
        }, cell.label)),
      });
    }

    // ── Cost & Intelligence Card ─────────────────────────────────────────────

    function CostAndSavingsCard({ totals, currency, setCurrency, t }) {
      const cost = currency === "cny" ? totals?.costCny : totals?.costUsd;
      const saved = currency === "cny" ? totals?.savedCny : totals?.savedUsd;
      const rawCost = (cost || 0) + (saved || 0);
      const savedPercent = rawCost > 0 ? ((saved / rawCost) * 100).toFixed(0) : 0;

      const togglePill = (val, label) => jsx("button", {
        type: "button",
        onClick: () => setCurrency(val),
        style: {
          height: "22px", padding: "0 8px", borderRadius: "11px", fontSize: "11px",
          font: "inherit", cursor: "pointer",
          color: currency === val ? "var(--dsw-alias-label-primary, #f3f4f6)" : "var(--dsw-alias-label-tertiary, #9ca3af)",
          background: currency === val ? "var(--dsw-alias-bg-layer-3, #242424)" : "transparent",
          border: currency === val ? "1px solid var(--dsw-alias-border-l2, #333)" : "1px solid transparent",
        },
        children: label,
      });

      return jsxs(Card, {
        style: { marginBottom: "12px", background: "linear-gradient(180deg, rgba(37,99,235,0.06) 0%, var(--dsw-alias-bg-layer-2, #1e1e1e) 100%)" },
        children: [
          jsxs("div", {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" },
            children: [
              jsx("span", { style: { fontSize: "13.5px", fontWeight: 600, color: "var(--dsw-alias-label-primary, #f3f4f6)" }, children: t("costSection") }),
              jsxs("div", { style: { display: "flex", gap: "4px" }, children: [togglePill("cny", t("currencyCny")), togglePill("usd", t("currencyUsd"))] }),
            ],
          }),
          jsxs("div", {
            style: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" },
            children: [
              jsxs("div", {
                style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
                children: [
                  jsx("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #9ca3af)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: t("costEstimated") }),
                  jsx("span", { style: { fontSize: "17px", fontWeight: 600, color: "#38bdf8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: formatMoney(cost, currency) }),
                ],
              }),
              jsxs("div", {
                style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
                children: [
                  jsx("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #9ca3af)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: t("cacheSaved") }),
                  jsxs("div", {
                    style: { display: "flex", alignItems: "baseline", gap: "4px", flexWrap: "nowrap", overflow: "hidden" },
                    children: [
                      jsx("span", { style: { fontSize: "17px", fontWeight: 600, color: "#4ade80", whiteSpace: "nowrap" }, children: formatMoney(saved, currency) }),
                      savedPercent > 0 ? jsx("span", {
                        style: { fontSize: "9.5px", padding: "1px 4px", borderRadius: "6px", background: "rgba(74, 222, 128, 0.15)", color: "#4ade80", whiteSpace: "nowrap", flexShrink: 0 },
                        children: `${savedPercent}%`,
                      }) : null,
                    ],
                  }),
                ],
              }),
              jsxs("div", {
                style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
                children: [
                  jsx("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #9ca3af)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: t("speed") }),
                  jsx("span", { style: { fontSize: "17px", fontWeight: 600, color: "var(--dsw-alias-label-primary, #f3f4f6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: `${totals?.tokensPerSecond || 0} t/s` }),
                ],
              }),
              jsxs("div", {
                style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
                children: [
                  jsx("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #9ca3af)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: t("avgTurn") }),
                  jsx("span", { style: { fontSize: "17px", fontWeight: 600, color: "var(--dsw-alias-label-primary, #f3f4f6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: formatMs(totals?.avgTurnMs) }),
                ],
              }),
            ],
          }),
        ],
      });
    }

    // ── Token Composition Breakdown Bar ─────────────────────────────────────

    function TokenCompositionBar({ composition, totalTokens, t }) {
      if (!Array.isArray(composition) || composition.length === 0) return null;
      return jsxs(Card, {
        children: [
          // Segmented horizontal stacked bar
          jsxs("div", {
            style: {
              height: "14px", width: "100%", borderRadius: "7px", overflow: "hidden",
              display: "flex", background: "var(--dsw-alias-bg-layer-3, #242424)", marginBottom: "12px",
            },
            children: composition.map((c) => {
              if (c.percent <= 0) return null;
              return jsx("div", {
                style: { width: `${c.percent}%`, height: "100%", background: c.color, transition: "width 0.6s ease" },
                title: `${t(c.labelKey)}: ${formatTokens(c.tokens)} (${c.percent}%)`,
              }, c.category);
            }),
          }),
          // Legend grid
          jsxs("div", {
            style: { display: "flex", flexWrap: "wrap", gap: "10px 20px" },
            children: composition.map((c) => jsxs("div", {
              style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" },
              children: [
                jsx("span", { style: { width: "9px", height: "9px", borderRadius: "50%", background: c.color, flexShrink: 0 } }),
                jsx("span", { style: { color: "var(--dsw-alias-label-secondary, #d1d5db)" }, children: t(c.labelKey) }),
                jsx("span", { style: { fontWeight: 600, color: "var(--dsw-alias-label-primary, #f3f4f6)" }, children: formatTokens(c.tokens) }),
                jsx("span", { style: { color: "var(--dsw-alias-label-tertiary, #9ca3af)", fontSize: "11px" }, children: `(${c.percent}%)` }),
              ],
            }, c.category)),
          }),
        ],
      });
    }

    // ── Heatmap (Contribution Graph Style) ───────────────────────────────────

    const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    function Heatmap({ byDay }) {
      const WEEKS = 53;
      const DAYS = 7;
      const cell = 11;
      const gap = 3;
      const labelH = 14;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - today.getDay());
      const start = new Date(lastWeekStart);
      start.setDate(lastWeekStart.getDate() - (WEEKS - 1) * DAYS);

      const max = Math.max(1, ...Object.values(byDay ?? {}).map((b) => b.totalTokens));
      const levelColor = (ratio) => {
        if (ratio <= 0) return "var(--dsw-alias-bg-layer-3, #242424)";
        if (ratio < 0.25) return "rgba(37, 99, 235, 0.25)";
        if (ratio < 0.5) return "rgba(37, 99, 235, 0.45)";
        if (ratio < 0.75) return "rgba(37, 99, 235, 0.7)";
        return "var(--dsw-alias-state-business-primary, #2563eb)";
      };

      const cells = [];
      const monthLabels = [];
      let prevMonth = -1;
      const cursor = new Date(start);
      for (let w = 0; w < WEEKS; w += 1) {
        for (let d = 0; d < DAYS; d += 1) {
          const key = dayKeyOf(cursor);
          cells.push({ key, total: byDay?.[key]?.totalTokens ?? 0, col: w, row: d });
          if (d === 0 && cursor.getMonth() !== prevMonth) {
            const month = cursor.getMonth();
            monthLabels.push({ text: isZh() ? `${month + 1}月` : MONTHS_EN[month], col: w });
            prevMonth = month;
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      const gridW = WEEKS * (cell + gap) - gap;
      const gridH = DAYS * (cell + gap) - gap;
      const totalW = gridW;
      const totalH = gridH + labelH + 4;

      return jsx("svg", {
        width: "100%",
        viewBox: `0 0 ${totalW} ${totalH}`,
        style: { display: "block" },
        children: [
          ...cells.map((c) => jsx("rect", {
            key: c.key,
            x: c.col * (cell + gap),
            y: c.row * (cell + gap),
            width: cell,
            height: cell,
            rx: 2,
            fill: levelColor(c.total / max),
            children: jsx("title", { children: `${c.key}：${formatTokens(c.total)} tokens` }),
          })),
          ...monthLabels.map((m) => jsx("text", {
            key: `${m.col}-${m.text}`,
            x: m.col * (cell + gap),
            y: gridH + labelH,
            fontSize: 10,
            fill: "var(--dsw-alias-label-tertiary, #9ca3af)",
            children: m.text,
          })),
        ],
      });
    }

    // ── Trend Line (Dual-Curve Smooth Path) ──────────────────────────────────

    function smoothPath(points) {
      if (points.length < 3) {
        return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      }
      let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
      for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
      }
      return d;
    }

    function TrendLine({ byDay, t }) {
      const W = 560;
      const H = 180;
      const PAD = { top: 18, right: 12, bottom: 26, left: 44 };
      const [revealed, setRevealed] = useState(false);

      const chart = useMemo(() => {
        const values = [];
        const cursor = new Date();
        cursor.setHours(0, 0, 0, 0);
        cursor.setDate(cursor.getDate() - 29);
        for (let i = 0; i < 30; i += 1) {
          const key = dayKeyOf(cursor);
          values.push({
            key,
            input: byDay?.[key]?.inputTokens ?? 0,
            output: byDay?.[key]?.outputTokens ?? 0,
          });
          cursor.setDate(cursor.getDate() + 1);
        }
        const max = Math.max(1, ...values.map((v) => Math.max(v.input, v.output)));
        const x = (i) => PAD.left + (i / (values.length - 1)) * (W - PAD.left - PAD.right);
        const y = (v) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
        const baseline = H - PAD.bottom;
        const inputLine = smoothPath(values.map((v, i) => ({ x: x(i), y: y(v.input) })));
        const outputLine = smoothPath(values.map((v, i) => ({ x: x(i), y: y(v.output) })));
        const closeArea = (line) => `${line} L${x(values.length - 1).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`;
        return { values, max, x, inputLine, outputLine, inputArea: closeArea(inputLine), outputArea: closeArea(outputLine) };
      }, [byDay]);

      const { values, max, x, inputLine, outputLine, inputArea, outputArea } = chart;

      useEffect(() => {
        setRevealed(false);
        const id = requestAnimationFrame(() => { setRevealed(true); });
        return () => { cancelAnimationFrame(id); };
      }, [byDay]);

      const gridLines = [0.25, 0.5, 0.75, 1].map((f) => PAD.top + (1 - f) * (H - PAD.top - PAD.bottom));

      const lineProps = (stroke) => ({
        fill: "none", stroke, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round",
        pathLength: 100, strokeDasharray: 100, strokeDashoffset: revealed ? 0 : 100,
        style: { transition: "stroke-dashoffset 0.9s ease" },
      });
      const areaProps = (fill) => ({
        fill, fillOpacity: 0.12, stroke: "none",
        style: { opacity: revealed ? 1 : 0, transition: "opacity 0.9s ease" },
      });

      return jsxs("div", {
        children: [
          jsxs("svg", {
            width: "100%", viewBox: `0 0 ${W} ${H}`, style: { display: "block" },
            children: [
              ...gridLines.map((gy, i) => jsxs(React.Fragment, {
                key: i,
                children: [
                  jsx("line", {
                    x1: PAD.left, x2: W - PAD.right, y1: gy, y2: gy,
                    stroke: "var(--dsw-alias-border-l2, #333)", strokeDasharray: "2 4", strokeWidth: 1,
                  }),
                  jsx("text", {
                    x: PAD.left - 6, y: gy + 3, textAnchor: "end",
                    fontSize: 9.5, fill: "var(--dsw-alias-label-tertiary, #9ca3af)",
                    children: formatTokens([0.25, 0.5, 0.75, 1][i] * max),
                  }),
                ],
              })),
              jsx("path", { d: inputArea, ...areaProps("var(--dsw-alias-state-business-primary, #2563eb)") }),
              jsx("path", { d: outputArea, ...areaProps("var(--dsw-alias-state-success-primary, #16a34a)") }),
              jsx("path", { d: inputLine, ...lineProps("var(--dsw-alias-state-business-primary, #2563eb)") }),
              jsx("path", { d: outputLine, ...lineProps("var(--dsw-alias-state-success-primary, #16a34a)") }),
              ...[0, 9, 19, 29].map((i) => {
                const p = values[i];
                if (!p) return null;
                return jsx("text", {
                  key: p.key, x: x(i), y: H - 8, textAnchor: "middle",
                  fontSize: 10, fill: "var(--dsw-alias-label-tertiary, #9ca3af)",
                  children: p.key.slice(5),
                });
              }),
            ],
          }),
          jsxs("div", {
            style: { display: "flex", gap: "14px", fontSize: "11.5px", color: "var(--dsw-alias-label-tertiary, #9ca3af)", marginTop: "4px" },
            children: [
              jsxs("span", {
                style: { display: "inline-flex", alignItems: "center", gap: "5px" },
                children: [
                  jsx("span", { style: { width: 8, height: 8, borderRadius: 2, background: "var(--dsw-alias-state-business-primary, #2563eb)", display: "inline-block" } }),
                  jsx("span", { children: t("legendInput") }),
                ],
              }),
              jsxs("span", {
                style: { display: "inline-flex", alignItems: "center", gap: "5px" },
                children: [
                  jsx("span", { style: { width: 8, height: 8, borderRadius: 2, background: "var(--dsw-alias-state-success-primary, #16a34a)", display: "inline-block" } }),
                  jsx("span", { children: t("legendOutput") }),
                ],
              }),
            ],
          }),
        ],
      });
    }

    // ── Model & Provider Share (Donut Chart) ─────────────────────────────────

    const MODEL_PALETTE = [
      "var(--dsw-alias-state-business-primary, #2563eb)",
      "var(--dsw-alias-state-success-primary, #16a34a)",
      "var(--dsw-alias-state-warning-primary, #f59e0b)",
      "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316",
    ];

    function Donut({ entries, total, isCost, currency }) {
      const R = 56;
      const SW = 20;
      const C = 2 * Math.PI * R;
      let acc = 0;
      const segs = entries.map((e) => {
        const frac = total > 0 ? e.value / total : 0;
        const seg = { ...e, offset: acc, frac };
        acc += frac;
        return seg;
      });
      return jsxs("svg", {
        width: 150, height: 150, viewBox: "0 0 150 150",
        style: { flexShrink: 0 },
        children: [
          jsx("circle", { cx: 75, cy: 75, r: R, fill: "none", stroke: "var(--dsw-alias-bg-layer-3, #242424)", strokeWidth: SW }),
          ...segs.map((s) => jsx("circle", {
            key: s.name, cx: 75, cy: 75, r: R, fill: "none",
            stroke: s.color, strokeWidth: SW,
            strokeDasharray: `${(s.frac * C).toFixed(2)} ${C.toFixed(2)}`,
            strokeDashoffset: `${(-s.offset * C).toFixed(2)}`,
            transform: "rotate(-90 75 75)",
            children: jsx("title", { children: `${s.name}: ${isCost ? formatMoney(s.value, currency) : formatTokens(s.value)}` }),
          })),
          jsxs("text", {
            x: 75, y: 72, textAnchor: "middle", fontSize: 14, fontWeight: 600,
            fill: "var(--dsw-alias-label-primary, #f3f4f6)",
            children: [isCost ? formatMoney(total, currency) : formatTokens(total)],
          }),
          jsxs("text", {
            x: 75, y: 88, textAnchor: "middle", fontSize: 10,
            fill: "var(--dsw-alias-label-tertiary, #9ca3af)",
            children: [isCost ? currency.toUpperCase() : "tokens"],
          }),
        ],
      });
    }

    function ModelListRows({ entries, total, isCost, currency }) {
      const fmtPct = (p) => (p < 10 ? p.toFixed(1) : String(Math.round(p)));
      return jsxs("div", {
        style: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
        children: entries.map((e, i) => {
          const pct = total > 0 ? (e.value / total) * 100 : 0;
          return jsxs(React.Fragment, {
            key: e.name,
            children: [
              i > 0 ? jsx("div", { style: { height: "1px", background: "var(--dsw-alias-border-l2, #333)", margin: "10px 0" } }) : null,
              jsxs("div", {
                style: { display: "flex", alignItems: "center", gap: "10px" },
                children: [
                  jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0 } }),
                  jsx("span", {
                    style: { flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 500, color: "var(--dsw-alias-label-primary, #f3f4f6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                    children: e.name,
                  }),
                  jsx("span", { style: { flexShrink: 0, fontSize: "13px", color: "var(--dsw-alias-label-secondary, #d1d5db)" }, children: `${fmtPct(pct)}%` }),
                ],
              }),
              jsx("div", {
                style: { marginTop: "2px", paddingLeft: "18px", fontSize: "12px", color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
                children: isCost ? `${formatMoney(e.value, currency)} · ${formatTokens(e.tokens)} tokens` : `${formatTokens(e.value)} tokens · ${formatMoney(e.cost, currency)}`,
              }),
            ],
          });
        }),
      });
    }

    function ModelShare({ byModel, currency, t }) {
      const [dim, setDim] = useState("provider");
      const isCost = dim === "cost";

      const entries = useMemo(() => {
        const list = Object.entries(byModel ?? {}).map(([key, v]) => ({
          key,
          tokens: v.totalTokens,
          cost: currency === "cny" ? v.costCny : v.costUsd,
        })).filter((e) => e.tokens > 0);

        let view;
        if (dim === "provider") {
          view = list.map((e) => ({ name: e.key, value: e.tokens, tokens: e.tokens, cost: e.cost }));
        } else if (dim === "model") {
          const byName = {};
          for (const e of list) {
            const name = e.key.includes("/") ? e.key.split("/").pop() : e.key;
            const cur = byName[name] ?? (byName[name] = { tokens: 0, cost: 0 });
            cur.tokens += e.tokens;
            cur.cost += e.cost;
          }
          view = Object.entries(byName).map(([name, val]) => ({ name, value: val.tokens, tokens: val.tokens, cost: val.cost }));
        } else {
          // By Cost
          view = list.map((e) => ({ name: e.key, value: e.cost, tokens: e.tokens, cost: e.cost }));
        }

        view.sort((a, b) => b.value - a.value);
        view.forEach((e, i) => { e.color = MODEL_PALETTE[i % MODEL_PALETTE.length]; });
        return view;
      }, [byModel, dim, currency]);

      const total = entries.reduce((s, e) => s + e.value, 0);

      const toggle = (value, label) => jsx("button", {
        type: "button",
        onClick: () => setDim(value),
        style: {
          height: "24px", padding: "0 10px", borderRadius: "12px", fontSize: "11.5px",
          font: "inherit", cursor: "pointer",
          color: dim === value ? "var(--dsw-alias-label-primary, #f3f4f6)" : "var(--dsw-alias-label-tertiary, #9ca3af)",
          background: dim === value ? "var(--dsw-alias-bg-layer-3, #242424)" : "transparent",
          border: dim === value ? "1px solid var(--dsw-alias-border-l2, #333)" : "1px solid transparent",
        },
        children: label,
      });

      return jsxs("div", {
        children: [
          jsxs("div", {
            style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" },
            children: [toggle("provider", t("dimProvider")), toggle("model", t("dimModel")), toggle("cost", t("dimCost"))],
          }),
          jsxs("div", {
            style: { display: "flex", alignItems: "flex-start", gap: "20px", flexWrap: "wrap" },
            children: [
              jsx(Donut, { entries, total, isCost, currency }),
              jsx(ModelListRows, { entries, total, isCost, currency }),
            ],
          }),
        ],
      });
    }

    // ── Top 10 Sessions Leaderboard ──────────────────────────────────────────

    function TopSessionsTable({ sessions, currency, t }) {
      if (!Array.isArray(sessions) || sessions.length === 0) return null;
      return jsxs(Card, {
        style: { padding: "0px", overflow: "hidden" },
        children: [
          jsxs("div", {
            style: {
              display: "grid", gridTemplateColumns: "minmax(180px, 2fr) 90px 100px 90px",
              padding: "10px 16px", background: "var(--dsw-alias-bg-layer-3, #242424)",
              fontSize: "11.5px", fontWeight: 600, color: "var(--dsw-alias-label-tertiary, #9ca3af)",
            },
            children: [
              jsx("span", { children: t("sessionTitle") }),
              jsx("span", { style: { textAlign: "right" }, children: t("sessionTurns") }),
              jsx("span", { style: { textAlign: "right" }, children: t("sessionTokens") }),
              jsx("span", { style: { textAlign: "right" }, children: t("sessionCost") }),
            ],
          }),
          sessions.map((s, i) => {
            const cost = currency === "cny" ? s.costCny : s.costUsd;
            let displayTitle = s.title;
            if (!displayTitle || displayTitle === "session-" || displayTitle.startsWith("session-")) {
              if (s.workspace) {
                const wparts = s.workspace.split(/[\/\\]/).filter(Boolean);
                displayTitle = wparts[wparts.length - 1] || s.id.replace(/^session-/, "").slice(0, 8);
              } else {
                displayTitle = s.id.replace(/^session-/, "").slice(0, 8);
              }
            }
            const wsName = s.workspace ? s.workspace.split(/[\/\\]/).filter(Boolean).pop() : "";

            return jsxs("div", {
              style: {
                display: "grid", gridTemplateColumns: "minmax(180px, 2fr) 70px 100px 80px",
                padding: "12px 16px", alignItems: "center",
                borderTop: i > 0 ? "1px solid var(--dsw-alias-border-l2, #333)" : "none",
                fontSize: "12.5px",
              },
              children: [
                jsxs("div", {
                  style: { display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, paddingRight: "8px" },
                  children: [
                    jsxs("a", {
                      href: `#/sessions/${s.id}`,
                      title: `${displayTitle} (${s.id})`,
                      style: {
                        color: "var(--dsw-alias-label-primary, #f3f4f6)", textDecoration: "none", fontWeight: 500,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
                      },
                      children: [displayTitle],
                    }),
                    jsxs("div", {
                      style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
                      children: [
                        wsName && wsName !== displayTitle ? jsx("span", {
                          style: { maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "1px 5px", borderRadius: "4px", background: "var(--dsw-alias-bg-layer-3, #242424)", color: "var(--dsw-alias-label-secondary, #d1d5db)" },
                          children: wsName,
                        }) : null,
                        jsx("span", { children: formatRelativeTime(s.lastActiveTime) }),
                      ],
                    }),
                  ],
                }),
                jsx("span", { style: { textAlign: "right", color: "var(--dsw-alias-label-secondary, #d1d5db)" }, children: s.turns }),
                jsx("span", { style: { textAlign: "right", fontWeight: 500, color: "var(--dsw-alias-state-business-primary, #60a5fa)" }, children: formatTokens(s.totalTokens) }),
                jsx("span", { style: { textAlign: "right", color: "#38bdf8", fontWeight: 500 }, children: formatMoney(cost, currency) }),
              ],
            }, s.id);
          }),
        ],
      });
    }

    // ── Top 10 Tools Analytics ───────────────────────────────────────────────

    function TopToolsChart({ tools, t }) {
      if (!Array.isArray(tools) || tools.length === 0) return null;
      return jsxs(Card, {
        children: tools.map((tool, i) => jsxs("div", {
          style: { display: "flex", flexDirection: "column", gap: "4px", marginBottom: i < tools.length - 1 ? "10px" : "0" },
          children: [
            jsxs("div", {
              style: { display: "flex", justifyContent: "space-between", fontSize: "12px" },
              children: [
                jsx("span", { style: { fontWeight: 500, color: "var(--dsw-alias-label-primary, #f3f4f6)", fontFamily: "monospace" }, children: tool.name }),
                jsxs("span", { style: { color: "var(--dsw-alias-label-tertiary, #9ca3af)" }, children: [`${tool.count} ${t("toolCalls")}`, ` (${tool.percent}%)`] }),
              ],
            }),
            jsx("div", {
              style: { height: "6px", width: "100%", borderRadius: "3px", background: "var(--dsw-alias-bg-layer-3, #242424)", overflow: "hidden" },
              children: jsx("div", {
                style: { width: `${tool.percent}%`, height: "100%", borderRadius: "3px", background: "var(--dsw-alias-state-business-primary, #2563eb)" },
              }),
            }),
          ],
        }, tool.name)),
      });
    }

    // ── Client Caching & Fast Initialization ─────────────────────────────────

    let memorySummaryCache = null;
    const LOCAL_STORAGE_KEY = "dsh_usage_stats_cache_v1";

    function getStoredCache() {
      if (memorySummaryCache && memorySummaryCache.totals) return memorySummaryCache;
      try {
        if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.totals && typeof parsed.totals.totalTokens === "number") {
              memorySummaryCache = parsed;
              return parsed;
            }
          }
        }
      } catch {}
      return null;
    }

    function setStoredCache(data) {
      if (!data || data.computing || !data.totals) return;
      memorySummaryCache = data;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        }
      } catch {}
    }

    function ensureStyles() {
      if (
        typeof document === "undefined" ||
        typeof document.getElementById !== "function" ||
        typeof document.createElement !== "function" ||
        !document.head
      ) return;
      const ID = "dsh-usage-stats-styles";
      if (document.getElementById(ID)) return;
      const style = document.createElement("style");
      style.id = ID;
      style.textContent = `
        @keyframes dshUsageStatsSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    // ── Section Page (Main Dashboard) ────────────────────────────────────────

    function UsageStatsSection({ t }) {
      const initialCache = useMemo(() => getStoredCache(), []);
      const [state, setState] = useState(() => ({
        status: initialCache ? "ready" : "loading",
        data: initialCache,
        error: null,
        isSyncing: false,
      }));
      const [refreshTick, setRefreshTick] = useState(0);
      const [currency, setCurrency] = useState("cny");

      useEffect(() => {
        let cancelled = false;
        let timer = undefined;
        setState((s) => ({
          ...s,
          status: s.data ? "ready" : "loading",
          isSyncing: true,
        }));

        const poll = () => {
          fetch("/api/usage-stats/summary")
            .then(async (res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = await res.json();
              if (cancelled) return;
              if (data?.computing) {
                timer = setTimeout(poll, 1200);
                return;
              }
              setStoredCache(data);
              setState({ status: "ready", data, error: null, isSyncing: false });
            })
            .catch((error) => {
              if (!cancelled) {
                setState((s) => ({
                  ...s,
                  status: s.data ? "ready" : "error",
                  error: s.data ? null : String(error),
                  isSyncing: false,
                }));
              }
            });
        };
        poll();
        return () => { cancelled = true; if (timer !== undefined) clearTimeout(timer); };
      }, [refreshTick]);

      const refresh = useCallback(() => {
        setRefreshTick((n) => n + 1);
      }, []);

      const data = state.data;
      const totals = data?.totals;
      const byDay = data?.byDay ?? {};
      const byModel = data?.byModel ?? {};
      const peakDay = Math.max(0, ...Object.values(byDay).map((b) => b.totalTokens));

      return jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: "0", paddingBottom: "24px" },
        children: [
          jsxs("div", {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" },
            children: [
              jsx("h2", { style: { margin: 0, fontSize: "18px", fontWeight: 600, color: "var(--dsw-alias-label-primary, #f3f4f6)" }, children: t("title") }),
              jsxs("button", {
                type: "button",
                onClick: refresh,
                disabled: state.isSyncing,
                title: t("refreshHint"),
                style: {
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  height: "28px", padding: "0 12px", borderRadius: "14px",
                  fontSize: "12px", lineHeight: "18px", font: "inherit", cursor: state.isSyncing ? "default" : "pointer",
                  color: "var(--dsw-alias-label-secondary, #d1d5db)",
                  background: "transparent",
                  border: "1px solid var(--dsw-alias-border-l2, #333)",
                  opacity: state.isSyncing ? 0.8 : 1,
                },
                children: [
                  jsx(IconRefreshOutline16, {
                    size: 14,
                    style: state.isSyncing ? { animation: "dshUsageStatsSpin 1s linear infinite" } : undefined,
                  }),
                  jsx("span", { children: state.isSyncing ? (isZh() ? "同步中…" : "Syncing…") : t("refresh") }),
                ],
              }),
            ],
          }),
          jsx("p", {
            style: { margin: "0 0 12px", fontSize: "12.5px", color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
            children: t("intro"),
          }),

          !totals && state.status === "loading" ? jsx("div", {
            style: {
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.03))",
              borderRadius: "12px",
              border: "1px dashed var(--dsw-alias-border-l2, #333)",
              margin: "16px 0",
            },
            children: jsxs("div", {
              style: { display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "12px" },
              children: [
                jsx(IconRefreshOutline16, {
                  size: 24,
                  style: { animation: "dshUsageStatsSpin 1.2s linear infinite", color: "var(--dsw-alias-label-secondary, #9ca3af)" },
                }),
                jsx("div", {
                  style: { fontSize: "14px", fontWeight: 500, color: "var(--dsw-alias-label-primary, #f3f4f6)" },
                  children: t("loading"),
                }),
                jsx("div", {
                  style: { fontSize: "12px", color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
                  children: isZh() ? "正在分析所有历史会话的用量与成本，首次加载需扫描存储，请稍候…" : "Aggregating historical session token usage and costs, please wait…",
                }),
              ],
            }),
          }) : null,
          !totals && state.status === "error" ? jsx("p", { style: { color: "var(--dsw-alias-state-error-primary, #ef4444)", fontSize: "13px" }, children: `${t("error")}: ${state.error}` }) : null,
          state.status === "ready" && totals && totals.sessions === 0 ? jsx("p", { style: { color: "var(--dsw-alias-label-tertiary, #9ca3af)", fontSize: "13px" }, children: t("empty") }) : null,

          state.status === "ready" && totals ? jsxs(React.Fragment, {
            children: [
              jsx(CostAndSavingsCard, { totals, currency, setCurrency, t }),

              jsx(StatStrip, {
                cells: [
                  { label: t("totalTokens"), value: formatTokens(totals.totalTokens) },
                  { label: t("peakDay"), value: formatTokens(peakDay) },
                  { label: t("longestTurn"), value: formatMs(data.longestTurnMs) },
                  { label: t("streakCurrent"), value: `${data.streak.current} ${t("dayUnit")}` },
                  { label: t("streakLongest"), value: `${data.streak.longest} ${t("dayUnit")}` },
                ],
              }),

              jsx(SectionTitle, { children: t("composition") }),
              jsx(TokenCompositionBar, { composition: data.tokenComposition, totalTokens: totals.totalTokens, t }),

              jsx(SectionTitle, { children: t("activity") }),
              jsx(Card, { children: jsx(Heatmap, { byDay }) }),

              jsx(SectionTitle, { children: t("trend") }),
              jsx(Card, { children: jsx(TrendLine, { byDay, t }) }),

              jsx(SectionTitle, { children: t("byModel") }),
              jsx(Card, { children: jsx(ModelShare, { byModel, currency, t }) }),

              data.topSessions && data.topSessions.length > 0 ? jsxs(React.Fragment, {
                children: [
                  jsx(SectionTitle, { children: t("topSessions") }),
                  jsx(TopSessionsTable, { sessions: data.topSessions, currency, t }),
                ],
              }) : null,

              data.topTools && data.topTools.length > 0 ? jsxs(React.Fragment, {
                children: [
                  jsx(SectionTitle, { children: t("topTools") }),
                  jsx(TopToolsChart, { tools: data.topTools, t }),
                ],
              }) : null,
            ],
          }) : null,
        ],
      });
    }

    // ── In-Session Modal (For Slash Command / Quick Jump) ─────────────────────

    function UsageStatsModal({ isOpen, onClose, t }) {
      if (!isOpen) return null;
      return jsx("div", {
        style: {
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        },
        onClick: onClose,
        children: jsx("div", {
          style: {
            width: "100%", maxWidth: "780px", maxHeight: "85vh", overflowY: "auto",
            borderRadius: "16px", border: "1px solid var(--dsw-alias-border-l2, #333)",
            background: "var(--dsw-alias-bg-layer-1, #121212)", padding: "24px",
          },
          onClick: (e) => e.stopPropagation(),
          children: jsxs("div", {
            style: { display: "flex", flexDirection: "column" },
            children: [
              jsxs("div", {
                style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
                children: [
                  jsx("h3", { style: { margin: 0, fontSize: "16px", color: "var(--dsw-alias-label-primary, #f3f4f6)" }, children: t("modalTitle") }),
                  jsx("button", {
                    type: "button",
                    onClick: onClose,
                    style: {
                      background: "transparent", border: "none", color: "var(--dsw-alias-label-tertiary, #9ca3af)",
                      fontSize: "14px", cursor: "pointer", padding: "4px 8px", borderRadius: "4px",
                    },
                    children: t("close"),
                  }),
                ],
              }),
              jsx(UsageStatsSection, { t }),
            ],
          }),
        }),
      });
    }

    // ── Module Exports & Plugin Registration ─────────────────────────────────

    exports.inject = ["locale", "slots"];
    exports.apply = function apply(ctx) {
      ensureStyles();
      ctx.locale.register(NS, { zh, en });
      const t = ctx.locale.bind(NS);

      // Register Settings Section
      ctx.slots.inject("settings.section", function* () {
        yield ctx.slots.register(
          {
            name: "settings.section",
            id: "usageStats",
            order: 40,
            label: () => (isZh() ? zh.nav : en.nav),
            locale: NS,
            registrant: "dsh-plugin-usage-stats",
          },
          UsageStatsSection,
        );
      });
    };

    return exports;
  },
});
