/**
 * dsh-plugin-usage-stats — Client half (Left-Sidebar Global Panel).
 *
 * Registers:
 * 1. A `sidebar.panellist` row ("使用统计" / "Usage Statistics") in the app's
 *    left sidebar — the sidebar owns the button, label, collapsed-rail tooltip
 *    and selected state; clicking it selects the matching `main` panel.
 * 2. A `main` global panel (key "usage-stats") hosting the full dashboard:
 *    - Cost & Savings Intelligence (USD/CNY currency switcher)
 *    - 5-Way Token Composition Breakdown Bar
 *    - 365-Day Activity Heatmap (month labels de-overlapped, Less/More legend)
 *    - 30-Day Daily Token Trend Curve (hover crosshair + tooltip)
 *    - Model Distribution Donut & Ranking (By Provider / By Model / By Cost,
 *      top 8 + aggregated "Others" tail)
 *    - Top 10 High-Volume Sessions Leaderboard (rank badges, 1-click navigation)
 *    - Top 10 Tool Invocations Analytics (rank badges, call totals)
 *
 * Pure plugin composition through dsh's official slot seats — no dsh source
 * changes. Hand-rolled pure inline SVG — zero external charting dependencies.
 * Charts measure their container and draw at natural pixel size so axis text
 * never scales with the viewport. Interactive states (hover/focus) live in the
 * injected `dsh-usage-stats-styles` stylesheet; layout stays inline.
 *
 * @license MIT
 */

window.__ModuleLoader__.load({
  id: "dsh-plugin-usage-stats",
  factory: (require) => {
    const exports = {};
    const React = require("react");
    const { useState, useEffect, useCallback, useMemo, useRef } = React;
    const { jsx, jsxs } = require("react/jsx-runtime");
    const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    if (primitives && typeof primitives === "object") {
      for (const key of Object.keys(primitives)) {
        if (key.startsWith("Icon") && key.endsWith("Regular")) {
          const base = key.slice(0, -7);
          for (const suffix of ["12", "14", "16", "18", "20", "24", ""]) {
            if (!primitives[base + suffix]) primitives[base + suffix] = primitives[key];
          }
        }
      }
    }
    const IconRefreshOutline16 = primitives.IconRefreshOutlineRegular || primitives.IconRefreshOutline16 || (() => null);

    const NS = "usage-stats";

    /** The id shared by the sidebar panellist row and the `main` panel it opens. */
    const PANEL_ID = "usage-stats";

    const zh = {
      nav: "使用统计",
      title: "使用统计与成本看板",
      intro: "聚合所有会话的 Token 用量、费用估算、上下文构成及工具活动。",
      loading: "统计加载中…",
      loadingHint: "正在分析所有历史会话的用量与成本，首次加载需扫描存储，请稍候…",
      empty: "还没有会话用量数据",
      emptyHint: "开始一个新会话后，这里会展示 Token 用量、费用与工具活动。",
      error: "统计加载失败",
      retry: "重试",
      refresh: "刷新",
      refreshHint: "重新统计所有会话",
      syncing: "同步中…",
      lastUpdated: "数据更新于",
      totalTokens: "累计 Token",
      peakDay: "峰值日 Token",
      longestTurn: "最长回合时长",
      streakCurrent: "当前连续天数",
      streakLongest: "最长连续天数",
      dayUnit: "天",
      activity: "Token 活动热力图",
      trend: "近 30 天每日 Token 趋势",
      byModel: "模型与费用占比",
      dimProvider: "按供应商",
      dimModel: "按模型",
      dimCost: "按费用",
      legendInput: "输入 Token",
      legendOutput: "输出 Token",
      less: "少",
      more: "多",
      others: "其他",
      unitTokens: "tokens",

      // Cost & Savings
      costSection: "成本与效率概览",
      costEstimated: "预估总费用",
      cacheSaved: "缓存已节省",
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
      sessionTokens: "总 Token",
      sessionTurns: "回合",
      sessionCost: "预估费用",
      toolCalls: "次调用",
    };

    const en = {
      nav: "Usage statistics",
      title: "Usage & Cost Intelligence",
      intro: "Token usage, cost estimations, composition, and tool analytics across all sessions.",
      loading: "Loading statistics…",
      loadingHint: "Aggregating historical session token usage and costs, please wait…",
      empty: "No usage data yet",
      emptyHint: "Start a new session and this dashboard will fill in.",
      error: "Failed to load statistics",
      retry: "Retry",
      refresh: "Refresh",
      refreshHint: "Recompute all session statistics",
      syncing: "Syncing…",
      lastUpdated: "Updated",
      totalTokens: "Total Tokens",
      peakDay: "Peak-day Tokens",
      longestTurn: "Longest Turn",
      streakCurrent: "Current Streak",
      streakLongest: "Longest Streak",
      dayUnit: "d",
      activity: "Token Activity Heatmap",
      trend: "30-Day Token Trend",
      byModel: "Model & Cost Distribution",
      dimProvider: "By Provider",
      dimModel: "By Model",
      dimCost: "By Cost",
      legendInput: "Input",
      legendOutput: "Output",
      less: "Less",
      more: "More",
      others: "Others",
      unitTokens: "tokens",

      // Cost & Savings
      costSection: "Cost & Efficiency Overview",
      costEstimated: "Estimated Cost",
      cacheSaved: "Cache Savings",
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
      sessionTokens: "Total Tokens",
      sessionTurns: "Turns",
      sessionCost: "Estimated Cost",
      toolCalls: "calls",
    };

    // ── Formatting Helpers ───────────────────────────────────────────────────

    function isZh() {
      const lang = document.documentElement.lang;
      return lang === "zh-CN" || lang === "zh";
    }

    /** Group an integer with thousands separators: 12345 -> "12,345". */
    function formatInt(n) {
      const v = Math.round(Number(n) || 0);
      return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function formatTokens(n) {
      if (typeof n !== "number" || !isFinite(n)) return "0";
      if (isZh()) {
        if (n >= 1e8) return `${(n / 1e8).toFixed(1)} 亿`;
        if (n >= 1e4) return `${(n / 1e4).toFixed(1)} 万`;
        return formatInt(n);
      }
      if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
      if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
      if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
      return formatInt(n);
    }

    function formatMoney(amount, currency = "cny") {
      const n = Number(amount) || 0;
      const symbol = currency === "cny" ? "¥" : "$";
      const fixed = n === 0 ? "0.00" : n >= 100 ? n.toFixed(1) : n >= 1 ? n.toFixed(2) : n.toFixed(3);
      const dot = fixed.indexOf(".");
      const int = dot === -1 ? fixed : fixed.slice(0, dot);
      const dec = dot === -1 ? "" : fixed.slice(dot);
      return `${symbol}${formatInt(int)}${dec}`;
    }

    /** Share of a whole in percent; non-zero parts render "<0.1%" instead of 0%. */
    function formatShare(percent, tokens) {
      const p = Number(percent) || 0;
      if (p <= 0 && (tokens === undefined || tokens > 0)) return "<0.1%";
      if (p > 0 && p < 0.1) return "<0.1%";
      return `${p}%`;
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
      if (min < 60) return zhLocale ? `${min} 分钟前` : `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return zhLocale ? `${hr} 小时前` : `${hr}h ago`;
      const day = Math.floor(hr / 24);
      return zhLocale ? `${day} 天前` : `${day}d ago`;
    }

    // ── Theme Tokens & Palettes ──────────────────────────────────────────────

    const T = {
      labelPrimary: "var(--dsw-alias-label-primary, #f3f4f6)",
      labelSecondary: "var(--dsw-alias-label-secondary, #d1d5db)",
      labelTertiary: "var(--dsw-alias-label-tertiary, #9ca3af)",
      border: "var(--dsw-alias-border-l2, #333)",
      bg2: "var(--dsw-alias-bg-layer-2, #1e1e1e)",
      bg3: "var(--dsw-alias-bg-layer-3, #242424)",
      accent: "var(--dsw-alias-state-business-primary, #2563eb)",
      success: "var(--dsw-alias-state-success-primary, #16a34a)",
      warning: "var(--dsw-alias-state-warning-primary, #f59e0b)",
      error: "var(--dsw-alias-state-error-primary, #ef4444)",
    };

    /** Exactly 8 hues — the model views cap at top 8 + an aggregated tail. */
    const MODEL_PALETTE = [T.accent, T.success, T.warning, "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316"];
    const OTHERS_COLOR = "var(--dsw-alias-label-tertiary, #9ca3af)";
    const MAX_MODEL_ROWS = 8;

    // ── Layout Hook ──────────────────────────────────────────────────────────

    /**
     * Measure the element width through a ResizeObserver so SVG charts can draw
     * at natural pixel size (fonts stay at their declared size instead of being
     * scaled by a viewBox). Falls back before the observer fires and in the
     * offline smoke environment.
     */
    function useMeasuredWidth(fallback) {
      const ref = useRef(null);
      const [width, setWidth] = useState(fallback);
      useEffect(() => {
        const el = ref ? ref.current : null;
        if (!el || typeof ResizeObserver === "undefined") return undefined;
        const ro = new ResizeObserver((entries) => {
          const w = entries && entries[0] && entries[0].contentRect ? entries[0].contentRect.width : 0;
          if (w > 0) setWidth((prev) => (Math.abs(prev - w) < 1 ? prev : Math.round(w)));
        });
        ro.observe(el);
        return () => ro.disconnect();
      }, []);
      return [ref, width];
    }

    // ── Reusable UI Primitives ───────────────────────────────────────────────

    function SectionTitle({ children, right }) {
      return jsxs("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 10px", gap: "12px" },
        children: [
          jsx("span", { style: { fontSize: "14px", fontWeight: 600, color: T.labelPrimary }, children }),
          right ?? null,
        ],
      });
    }

    function Card({ children, style = {} }) {
      return jsx("div", {
        style: {
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          background: T.bg2,
          padding: "16px",
          ...style,
        },
        children,
      });
    }

    function StatCell({ label, value, color }) {
      return jsxs("div", {
        style: {
          flex: "1 1 0", minWidth: 0, textAlign: "center",
          display: "flex", flexDirection: "column", gap: "2px",
        },
        children: [
          jsx("span", {
            style: {
              fontSize: "18px", fontWeight: 600, lineHeight: 1.2,
              color: color || T.labelPrimary,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            },
            children: value,
          }),
          jsx("span", {
            style: {
              fontSize: "11.5px", color: T.labelTertiary,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            },
            children: label,
          }),
        ],
      });
    }

    function StatStrip({ cells }) {
      return jsxs("div", {
        style: {
          display: "flex", alignItems: "stretch",
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          background: T.bg2,
          padding: "14px 8px",
        },
        children: cells.map((cell, i) => jsxs(React.Fragment, {
          children: [
            jsx(StatCell, { label: cell.label, value: cell.value, color: cell.color }),
            i < cells.length - 1 ? jsx("div", {
              style: { width: "1px", background: T.border, margin: "2px 0", flexShrink: 0 },
            }) : null,
          ],
        }, cell.label)),
      });
    }

    /** Shared segmented toggle (currency switch, dimension switch). */
    function PillToggle({ options, value, onChange, label }) {
      return jsx("div", {
        role: "group",
        "aria-label": label,
        style: { display: "inline-flex", gap: "4px" },
        children: options.map((o) => {
          const active = o.value === value;
          return jsx("button", {
            key: o.value,
            type: "button",
            "aria-pressed": active ? "true" : "false",
            className: `dsh-us-pill${active ? " is-active" : ""}`,
            onClick: () => onChange(o.value),
            style: {
              height: "24px", padding: "0 10px", borderRadius: "12px", fontSize: "11.5px",
              font: "inherit", cursor: "pointer",
              color: active ? T.labelPrimary : T.labelTertiary,
              background: active ? T.bg3 : "transparent",
              border: active ? `1px solid ${T.border}` : "1px solid transparent",
            },
            children: o.label,
          });
        }),
      });
    }

    // ── Cost & Intelligence Card ─────────────────────────────────────────────

    function CostAndSavingsCard({ totals, currency, setCurrency, t }) {
      const cost = currency === "cny" ? totals?.costCny : totals?.costUsd;
      const saved = currency === "cny" ? totals?.savedCny : totals?.savedUsd;
      const rawCost = (cost || 0) + (saved || 0);
      const savedPercent = rawCost > 0 ? ((saved / rawCost) * 100).toFixed(0) : 0;

      const metric = (label, value, color) => jsxs("div", {
        key: label,
        style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
        children: [
          jsx("span", {
            style: { fontSize: "11px", color: T.labelTertiary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
            children: label,
          }),
          jsx("span", {
            style: {
              fontSize: "17px", fontWeight: 600, color: color || T.labelPrimary,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            },
            children: value,
          }),
        ],
      });

      return jsxs(Card, {
        style: { marginBottom: "12px", background: `linear-gradient(180deg, rgba(37,99,235,0.06) 0%, ${T.bg2} 100%)` },
        children: [
          jsxs("div", {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" },
            children: [
              jsx("span", { style: { fontSize: "13.5px", fontWeight: 600, color: T.labelPrimary }, children: t("costSection") }),
              jsx(PillToggle, {
                label: t("costSection"),
                value: currency,
                onChange: setCurrency,
                options: [
                  { value: "cny", label: t("currencyCny") },
                  { value: "usd", label: t("currencyUsd") },
                ],
              }),
            ],
          }),
          jsxs("div", {
            style: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" },
            children: [
              metric(t("costEstimated"), formatMoney(cost, currency), T.accent),
              jsxs("div", {
                style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
                children: [
                  jsx("span", {
                    style: { fontSize: "11px", color: T.labelTertiary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                    children: t("cacheSaved"),
                  }),
                  jsxs("div", {
                    style: { display: "flex", alignItems: "baseline", gap: "4px", flexWrap: "nowrap", overflow: "hidden" },
                    children: [
                      jsx("span", { style: { fontSize: "17px", fontWeight: 600, color: T.success, whiteSpace: "nowrap" }, children: formatMoney(saved, currency) }),
                      savedPercent > 0 ? jsx("span", {
                        style: {
                          fontSize: "9.5px", padding: "1px 4px", borderRadius: "6px",
                          background: "rgba(74, 222, 128, 0.15)", color: T.success,
                          whiteSpace: "nowrap", flexShrink: 0,
                        },
                        children: `${savedPercent}%`,
                      }) : null,
                    ],
                  }),
                ],
              }),
              metric(t("speed"), `${totals?.tokensPerSecond || 0} t/s`),
              metric(t("avgTurn"), formatMs(totals?.avgTurnMs)),
            ],
          }),
        ],
      });
    }

    // ── Token Composition Breakdown Bar ─────────────────────────────────────

    function TokenCompositionBar({ composition, t }) {
      if (!Array.isArray(composition) || composition.length === 0) return null;
      return jsxs(Card, {
        children: [
          // Segmented horizontal stacked bar
          jsxs("div", {
            style: {
              height: "14px", width: "100%", borderRadius: "7px", overflow: "hidden",
              display: "flex", background: T.bg3, marginBottom: "12px",
            },
            children: composition.map((c) => {
              if (c.percent <= 0) return null;
              return jsx("div", {
                style: {
                  width: `${c.percent}%`, height: "100%", background: c.color,
                  transition: "width 0.6s ease", minWidth: c.percent > 0 ? "2px" : 0,
                },
                title: `${t(c.labelKey)}: ${formatTokens(c.tokens)} (${formatShare(c.percent, c.tokens)})`,
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
                jsx("span", { style: { color: T.labelSecondary }, children: t(c.labelKey) }),
                jsx("span", { style: { fontWeight: 600, color: T.labelPrimary }, children: formatTokens(c.tokens) }),
                jsx("span", { style: { color: T.labelTertiary, fontSize: "11px" }, children: `(${formatShare(c.percent, c.tokens)})` }),
              ],
            }, c.category)),
          }),
        ],
      });
    }

    // ── Heatmap (Contribution Graph Style) ───────────────────────────────────

    const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const HEAT_WEEKS = 53;
    const HEAT_DAYS = 7;
    const HEAT_GAP = 3;
    const HEAT_LABEL_H = 14;
    /** Minimum columns between two month labels so their text cannot collide. */
    const HEAT_LABEL_MIN_COLS = 3;

    function Heatmap({ byDay, t }) {
      const [ref, width] = useMeasuredWidth(900);
      const cell = Math.max(6, (width - HEAT_GAP * (HEAT_WEEKS - 1)) / HEAT_WEEKS);

      const model = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayKey = dayKeyOf(today);
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay());
        const start = new Date(lastWeekStart);
        start.setDate(lastWeekStart.getDate() - (HEAT_WEEKS - 1) * HEAT_DAYS);

        const max = Math.max(1, ...Object.values(byDay ?? {}).map((b) => b.totalTokens));

        const cells = [];
        const monthLabels = [];
        let prevMonth = -1;
        let lastLabelCol = -HEAT_LABEL_MIN_COLS;
        const cursor = new Date(start);
        for (let w = 0; w < HEAT_WEEKS; w += 1) {
          for (let d = 0; d < HEAT_DAYS; d += 1) {
            const key = dayKeyOf(cursor);
            cells.push({ key, total: byDay?.[key]?.totalTokens ?? 0, col: w, row: d, future: key > todayKey });
            if (d === 0 && cursor.getMonth() !== prevMonth) {
              const month = cursor.getMonth();
              if (monthLabels.length === 0 || w - lastLabelCol >= HEAT_LABEL_MIN_COLS) {
                // Store the month number only — the label text is localized at
                // render time so a locale switch cannot go stale inside the memo.
                monthLabels.push({ month, col: w });
                lastLabelCol = w;
              }
              prevMonth = month;
            }
            cursor.setDate(cursor.getDate() + 1);
          }
        }
        return { cells, monthLabels, max };
      }, [byDay]);

      const levelColor = (ratio) => {
        if (ratio <= 0) return T.bg3;
        if (ratio < 0.25) return "rgba(37, 99, 235, 0.25)";
        if (ratio < 0.5) return "rgba(37, 99, 235, 0.45)";
        if (ratio < 0.75) return "rgba(37, 99, 235, 0.7)";
        return T.accent;
      };

      const { cells, monthLabels, max } = model;
      const gridW = HEAT_WEEKS * (cell + HEAT_GAP) - HEAT_GAP;
      const gridH = HEAT_DAYS * (cell + HEAT_GAP) - HEAT_GAP;
      const totalH = gridH + HEAT_LABEL_H + 4;

      return jsxs("div", { ref, children: [
        jsxs("svg", {
          width: "100%",
          viewBox: `0 0 ${gridW} ${totalH}`,
          style: { display: "block" },
          children: [
            ...cells.map((c) => jsx("rect", {
              key: c.key,
              x: c.col * (cell + HEAT_GAP),
              y: c.row * (cell + HEAT_GAP),
              width: cell,
              height: cell,
              rx: 2,
              fill: c.future ? "transparent" : levelColor(c.total / max),
              pointerEvents: c.future ? "none" : undefined,
              children: c.future ? null : jsx("title", {
                children: `${c.key} · ${formatTokens(c.total)} ${t("unitTokens")}`,
              }),
            })),
            ...monthLabels.map((m) => jsx("text", {
              key: `${m.col}-${m.month}`,
              x: m.col * (cell + HEAT_GAP),
              y: gridH + HEAT_LABEL_H,
              fontSize: 10,
              fill: T.labelTertiary,
              children: isZh() ? `${m.month + 1}月` : MONTHS_EN[m.month],
            })),
          ],
        }),
        jsxs("div", {
          style: {
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            gap: "5px", marginTop: "8px", fontSize: "10.5px", color: T.labelTertiary,
          },
          children: [
            jsx("span", { children: t("less") }),
            ...[0, 0.25, 0.5, 0.75, 1].map((r) => jsx("span", {
              style: { width: "10px", height: "10px", borderRadius: "2px", background: levelColor(r), display: "inline-block" },
            }, `lg-${r}`)),
            jsx("span", { children: t("more") }),
          ],
        }),
      ]});
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

    const TREND_W = 900;
    const TREND_H = 200;
    const TREND_PAD = { top: 18, right: 12, bottom: 26, left: 48 };
    const TREND_TICKS = [0, 7, 14, 21, 29];

    function TrendLine({ byDay, t }) {
      const [ref, width] = useMeasuredWidth(TREND_W);
      const [revealed, setRevealed] = useState(false);
      const [hover, setHover] = useState(null);
      const W = width;

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
        const x = (i) => TREND_PAD.left + (i / (values.length - 1)) * (W - TREND_PAD.left - TREND_PAD.right);
        const y = (v) => TREND_PAD.top + (1 - v / max) * (TREND_H - TREND_PAD.top - TREND_PAD.bottom);
        const baseline = TREND_H - TREND_PAD.bottom;
        const inputLine = smoothPath(values.map((v, i) => ({ x: x(i), y: y(v.input) })));
        const outputLine = smoothPath(values.map((v, i) => ({ x: x(i), y: y(v.output) })));
        const closeArea = (line) => `${line} L${x(values.length - 1).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`;
        return { values, max, x, y, inputLine, outputLine, inputArea: closeArea(inputLine), outputArea: closeArea(outputLine) };
      }, [byDay, W]);

      const { values, max, x, y, inputLine, outputLine, inputArea, outputArea } = chart;

      useEffect(() => {
        setRevealed(false);
        const id = requestAnimationFrame(() => { setRevealed(true); });
        return () => { cancelAnimationFrame(id); };
      }, [byDay]);

      const gridLines = [0.25, 0.5, 0.75, 1].map((f) => TREND_PAD.top + (1 - f) * (TREND_H - TREND_PAD.top - TREND_PAD.bottom));

      const lineProps = (stroke) => ({
        fill: "none", stroke, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round",
        pathLength: 100, strokeDasharray: 100, strokeDashoffset: revealed ? 0 : 100,
        style: { transition: "stroke-dashoffset 0.9s ease" },
      });
      const areaProps = (fill) => ({
        fill, fillOpacity: 0.12, stroke: "none",
        style: { opacity: revealed ? 1 : 0, transition: "opacity 0.9s ease" },
      });

      const onMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (!rect || rect.width <= 0) return;
        const px = (e.clientX - rect.left) * (W / rect.width);
        const frac = (px - TREND_PAD.left) / (W - TREND_PAD.left - TREND_PAD.right);
        const idx = Math.max(0, Math.min(values.length - 1, Math.round(frac * (values.length - 1))));
        setHover(idx);
      };

      const hp = hover !== null ? values[hover] : null;
      const hx = hover !== null ? x(hover) : 0;

      return jsxs("div", {
        ref,
        style: { position: "relative" },
        onMouseMove: onMove,
        onMouseLeave: () => setHover(null),
        children: [
          jsxs("svg", {
            width: "100%", viewBox: `0 0 ${W} ${TREND_H}`, style: { display: "block" },
            children: [
              ...gridLines.map((gy, i) => jsxs(React.Fragment, {
                key: i,
                children: [
                  jsx("line", {
                    x1: TREND_PAD.left, x2: W - TREND_PAD.right, y1: gy, y2: gy,
                    stroke: T.border, strokeDasharray: "2 4", strokeWidth: 1,
                  }),
                  jsx("text", {
                    x: TREND_PAD.left - 6, y: gy + 3, textAnchor: "end",
                    fontSize: 9.5, fill: T.labelTertiary,
                    children: formatTokens([0.25, 0.5, 0.75, 1][i] * max),
                  }),
                ],
              })),
              jsx("path", { d: inputArea, ...areaProps(T.accent) }),
              jsx("path", { d: outputArea, ...areaProps(T.success) }),
              jsx("path", { d: inputLine, ...lineProps(T.accent) }),
              jsx("path", { d: outputLine, ...lineProps(T.success) }),
              ...TREND_TICKS.map((i) => {
                const p = values[i];
                if (!p) return null;
                return jsx("text", {
                  key: p.key, x: x(i), y: TREND_H - 8,
                  textAnchor: i === 0 ? "start" : i === values.length - 1 ? "end" : "middle",
                  fontSize: 10, fill: T.labelTertiary,
                  children: p.key.slice(5),
                });
              }),
              hp ? jsx("line", {
                x1: hx, x2: hx, y1: TREND_PAD.top, y2: TREND_H - TREND_PAD.bottom,
                stroke: T.labelTertiary, strokeWidth: 1, strokeDasharray: "3 3",
              }, "hover-line") : null,
              hp ? jsx("circle", { cx: hx, cy: y(hp.input), r: 3.5, fill: T.accent, stroke: T.bg2, strokeWidth: 1.5 }, "hover-in") : null,
              hp ? jsx("circle", { cx: hx, cy: y(hp.output), r: 3.5, fill: T.success, stroke: T.bg2, strokeWidth: 1.5 }, "hover-out") : null,
            ],
          }),
          hp ? jsxs("div", {
            style: {
              position: "absolute", top: "2px", left: `${(hx / W) * 100}%`,
              transform: "translateX(-50%)", pointerEvents: "none",
              background: T.bg3, border: `1px solid ${T.border}`, borderRadius: "8px",
              padding: "6px 10px", fontSize: "11px", whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
            },
            children: [
              jsx("div", { style: { color: T.labelSecondary, marginBottom: "3px", fontWeight: 600 }, children: hp.key }),
              jsxs("div", {
                style: { display: "flex", alignItems: "center", gap: "5px", color: T.labelTertiary },
                children: [
                  jsx("span", { style: { width: 7, height: 7, borderRadius: 2, background: T.accent, display: "inline-block" } }),
                  jsx("span", { children: t("legendInput") }),
                  jsx("span", { style: { color: T.labelPrimary, fontWeight: 600, marginLeft: "2px" }, children: formatTokens(hp.input) }),
                ],
              }),
              jsxs("div", {
                style: { display: "flex", alignItems: "center", gap: "5px", color: T.labelTertiary },
                children: [
                  jsx("span", { style: { width: 7, height: 7, borderRadius: 2, background: T.success, display: "inline-block" } }),
                  jsx("span", { children: t("legendOutput") }),
                  jsx("span", { style: { color: T.labelPrimary, fontWeight: 600, marginLeft: "2px" }, children: formatTokens(hp.output) }),
                ],
              }),
            ],
          }) : null,
          jsxs("div", {
            style: { display: "flex", gap: "14px", fontSize: "11.5px", color: T.labelTertiary, marginTop: "4px" },
            children: [
              jsxs("span", {
                style: { display: "inline-flex", alignItems: "center", gap: "5px" },
                children: [
                  jsx("span", { style: { width: 8, height: 8, borderRadius: 2, background: T.accent, display: "inline-block" } }),
                  jsx("span", { children: t("legendInput") }),
                ],
              }),
              jsxs("span", {
                style: { display: "inline-flex", alignItems: "center", gap: "5px" },
                children: [
                  jsx("span", { style: { width: 8, height: 8, borderRadius: 2, background: T.success, display: "inline-block" } }),
                  jsx("span", { children: t("legendOutput") }),
                ],
              }),
            ],
          }),
        ],
      });
    }

    // ── Model & Provider Share (Donut Chart) ─────────────────────────────────

    function Donut({ entries, total, isCost, currency, t }) {
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
          jsx("circle", { cx: 75, cy: 75, r: R, fill: "none", stroke: T.bg3, strokeWidth: SW }),
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
            fill: T.labelPrimary,
            children: [isCost ? formatMoney(total, currency) : formatTokens(total)],
          }),
          jsxs("text", {
            x: 75, y: 88, textAnchor: "middle", fontSize: 10,
            fill: T.labelTertiary,
            children: [isCost ? currency.toUpperCase() : t("unitTokens")],
          }),
        ],
      });
    }

    function ModelListRows({ entries, total, isCost, currency, t }) {
      const fmtPct = (p) => (p < 10 ? p.toFixed(1) : String(Math.round(p)));
      return jsxs("div", {
        style: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
        children: entries.map((e, i) => {
          const pct = total > 0 ? (e.value / total) * 100 : 0;
          return jsxs(React.Fragment, {
            key: e.name,
            children: [
              i > 0 ? jsx("div", { style: { height: "1px", background: T.border, margin: "8px 0" } }) : null,
              jsxs("div", {
                className: "dsh-us-row",
                style: { padding: "4px 6px", borderRadius: "6px", marginLeft: "-6px", marginRight: "-6px" },
                children: [
                  jsxs("div", {
                    style: { display: "flex", alignItems: "center", gap: "10px" },
                    children: [
                      jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0 } }),
                      jsx("span", {
                        style: { flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 500, color: T.labelPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                        children: e.name,
                      }),
                      jsx("span", { style: { flexShrink: 0, fontSize: "13px", color: T.labelSecondary }, children: `${fmtPct(pct)}%` }),
                    ],
                  }),
                  jsx("div", {
                    style: { marginTop: "2px", paddingLeft: "18px", fontSize: "12px", color: T.labelTertiary },
                    children: isCost ? `${formatMoney(e.value, currency)} · ${formatTokens(e.tokens)} ${t("unitTokens")}` : `${formatTokens(e.value)} ${t("unitTokens")} · ${formatMoney(e.cost, currency)}`,
                  }),
                ],
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

        // Keep the donut/list bounded: top 8 slices + one aggregated tail.
        const head = view.slice(0, MAX_MODEL_ROWS);
        const tail = view.slice(MAX_MODEL_ROWS);
        if (tail.length > 0) {
          head.push({
            name: "\u5176\u4ed6",
            value: tail.reduce((s, e) => s + e.value, 0),
            tokens: tail.reduce((s, e) => s + e.tokens, 0),
            cost: tail.reduce((s, e) => s + e.cost, 0),
            isOthers: true,
          });
        }
        head.forEach((e, i) => {
          e.color = e.isOthers ? OTHERS_COLOR : MODEL_PALETTE[i % MODEL_PALETTE.length];
        });
        return head;
      }, [byModel, dim, currency]);

      // Localize the aggregated tail label outside the memo so `t` identity
      // stays out of the memo keys (per project memo convention).
      const rows = entries.map((e) => (e.isOthers ? { ...e, name: t("others") } : e));
      const total = rows.reduce((s, e) => s + e.value, 0);

      return jsxs("div", {
        children: [
          jsx("div", {
            style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" },
            children: jsx(PillToggle, {
              label: t("byModel"),
              value: dim,
              onChange: setDim,
              options: [
                { value: "provider", label: t("dimProvider") },
                { value: "model", label: t("dimModel") },
                { value: "cost", label: t("dimCost") },
              ],
            }),
          }),
          jsxs("div", {
            style: { display: "flex", alignItems: "flex-start", gap: "20px", flexWrap: "wrap" },
            children: [
              jsx(Donut, { entries: rows, total, isCost, currency, t }),
              jsx(ModelListRows, { entries: rows, total, isCost, currency, t }),
            ],
          }),
        ],
      });
    }

    // ── Top 10 Sessions Leaderboard ──────────────────────────────────────────

    /** Shared column template so the header and the rows stay aligned. */
    const SESSIONS_GRID = "30px minmax(160px, 2fr) 64px 100px 88px";

    function RankBadge({ rank }) {
      const top = rank <= 3;
      return jsx("span", {
        style: {
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "18px", height: "18px", borderRadius: "50%",
          fontSize: "10.5px", fontWeight: 600,
          background: top ? "rgba(37, 99, 235, 0.12)" : "transparent",
          color: top ? T.accent : T.labelTertiary,
        },
        children: rank,
      });
    }

    function TopSessionsTable({ sessions, currency, t }) {
      if (!Array.isArray(sessions) || sessions.length === 0) return null;
      return jsx("div", {
        style: { overflowX: "auto" },
        children: jsxs(Card, {
          style: { padding: "0px", overflow: "hidden", minWidth: "520px" },
          children: [
            jsxs("div", {
              style: {
                display: "grid", gridTemplateColumns: SESSIONS_GRID,
                padding: "10px 16px", background: T.bg3,
                fontSize: "11.5px", fontWeight: 600, color: T.labelTertiary,
              },
              children: [
                jsx("span", { children: "" }),
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
                className: "dsh-us-row",
                style: {
                  display: "grid", gridTemplateColumns: SESSIONS_GRID,
                  padding: "12px 16px", alignItems: "center",
                  borderTop: i > 0 ? `1px solid ${T.border}` : "none",
                  fontSize: "12.5px",
                },
                children: [
                  jsx("div", { style: { display: "flex", alignItems: "center" }, children: jsx(RankBadge, { rank: i + 1 }) }),
                  jsxs("div", {
                    style: { display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, paddingRight: "8px" },
                    children: [
                      jsxs("a", {
                        href: `#/sessions/${s.id}`,
                        title: `${displayTitle} (${s.id})`,
                        className: "dsh-us-link",
                        style: {
                          color: T.labelPrimary, textDecoration: "none", fontWeight: 500,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
                        },
                        children: [displayTitle],
                      }),
                      jsxs("div", {
                        style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: T.labelTertiary },
                        children: [
                          wsName && wsName !== displayTitle ? jsx("span", {
                            style: { maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "1px 5px", borderRadius: "4px", background: T.bg3, color: T.labelSecondary },
                            children: wsName,
                          }) : null,
                          jsx("span", { children: formatRelativeTime(s.lastActiveTime) }),
                        ],
                      }),
                    ],
                  }),
                  jsx("span", { style: { textAlign: "right", color: T.labelSecondary }, children: formatInt(s.turns) }),
                  jsx("span", { style: { textAlign: "right", fontWeight: 500, color: T.accent }, children: formatTokens(s.totalTokens) }),
                  jsx("span", { style: { textAlign: "right", color: T.labelPrimary, fontWeight: 500 }, children: formatMoney(cost, currency) }),
                ],
              }, s.id);
            }),
          ],
        }),
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
              style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" },
              children: [
                jsx("div", { style: { width: "18px", flexShrink: 0 }, children: jsx(RankBadge, { rank: i + 1 }) }),
                jsx("span", {
                  style: {
                    fontWeight: 500, color: T.labelPrimary, fontFamily: "monospace",
                    flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  },
                  children: tool.name,
                }),
                jsxs("span", {
                  style: { color: T.labelTertiary, flexShrink: 0 },
                  children: [
                    jsx("span", { style: { color: T.labelSecondary, fontWeight: 600 }, children: formatInt(tool.count) }),
                    ` ${t("toolCalls")} · ${formatShare(tool.percent)}`,
                  ],
                }),
              ],
            }),
            jsx("div", {
              style: {
                height: "6px", borderRadius: "3px",
                background: T.bg3, overflow: "hidden", marginLeft: "26px",
                width: "calc(100% - 26px)",
              },
              children: jsx("div", {
                style: {
                  width: `${tool.percent}%`, minWidth: "2px", height: "100%",
                  borderRadius: "3px", background: T.accent,
                  transition: "width 0.6s ease",
                },
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

    function setStoredCache(data, fetchedAt) {
      if (!data || data.computing || !data.totals) return;
      const payload = { ...data, fetchedAt };
      memorySummaryCache = payload;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
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
        .dsh-us-btn, .dsh-us-pill, .dsh-us-link, .dsh-us-row {
          transition: background-color .15s ease, color .15s ease, border-color .15s ease;
        }
        .dsh-us-btn:not(:disabled):hover {
          background: var(--dsw-alias-bg-layer-3, #242424) !important;
          color: var(--dsw-alias-label-primary, #f3f4f6) !important;
          border-color: var(--dsw-alias-border-l2, #333) !important;
        }
        .dsh-us-pill:not(.is-active):hover {
          background: var(--dsw-alias-bg-layer-3, #242424) !important;
          color: var(--dsw-alias-label-primary, #f3f4f6) !important;
        }
        .dsh-us-link:hover {
          color: var(--dsw-alias-state-business-primary, #2563eb) !important;
          text-decoration: underline !important;
        }
        .dsh-us-row:hover {
          background: var(--dsw-alias-bg-layer-3, #242424) !important;
        }
        .dsh-us-btn:focus-visible, .dsh-us-pill:focus-visible, .dsh-us-link:focus-visible {
          outline: 2px solid var(--dsw-alias-state-business-primary, #2563eb);
          outline-offset: 2px;
        }
      `;
      document.head.appendChild(style);
    }

    // ── Sidebar Panel Icon ───────────────────────────────────────────────────

    /**
     * Decorative glyph for the left-sidebar panel row; the sidebar owns the
     * button, accessible label, tooltip and selected state around it. Returns
     * the svg as the row's direct icon child (no wrapper), as the shipped
     * panel icons do; `currentColor` follows the row's active/inactive color.
     */
    function UsageStatsPanelIcon({ size }) {
      return jsxs("svg", {
        width: size,
        height: size,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.4,
        strokeLinecap: "round",
        "aria-hidden": "true",
        children: [
          jsx("path", { d: "M2 13.5h12" }, "axis"),
          jsx("path", { d: "M4.75 13V9" }, "bar-low"),
          jsx("path", { d: "M8 13V4.75" }, "bar-high"),
          jsx("path", { d: "M11.25 13V6.75" }, "bar-mid"),
        ],
      });
    }

    // ── Section Page (Main Dashboard) ────────────────────────────────────────

    function UsageStatsSection({ t }) {
      const initialCache = useMemo(() => getStoredCache(), []);
      const [state, setState] = useState(() => ({
        status: initialCache ? "ready" : "loading",
        data: initialCache,
        error: null,
        isSyncing: false,
        updatedAt: initialCache ? initialCache.fetchedAt ?? null : null,
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
              const fetchedAt = Date.now();
              setStoredCache(data, fetchedAt);
              setState({ status: "ready", data, error: null, isSyncing: false, updatedAt: fetchedAt });
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
      const showError = !totals && state.status === "error";
      const showLoading = !totals && state.status === "loading";
      const showEmpty = state.status === "ready" && totals && totals.sessions === 0;

      return jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: "0", paddingBottom: "24px" },
        children: [
          jsxs("div", {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px", gap: "12px" },
            children: [
              jsx("h2", { style: { margin: 0, fontSize: "20px", fontWeight: 600, color: T.labelPrimary }, children: t("title") }),
              jsxs("div", {
                style: { display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 },
                children: [
                  state.updatedAt ? jsx("span", {
                    style: { fontSize: "11.5px", color: T.labelTertiary, whiteSpace: "nowrap" },
                    children: `${t("lastUpdated")} ${formatRelativeTime(state.updatedAt)}`,
                  }) : null,
                  jsxs("button", {
                    type: "button",
                    onClick: refresh,
                    disabled: state.isSyncing,
                    title: t("refreshHint"),
                    className: "dsh-us-btn",
                    style: {
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      height: "28px", padding: "0 12px", borderRadius: "14px",
                      fontSize: "12px", lineHeight: "18px", font: "inherit", cursor: state.isSyncing ? "default" : "pointer",
                      color: T.labelSecondary,
                      background: "transparent",
                      border: `1px solid ${T.border}`,
                      opacity: state.isSyncing ? 0.8 : 1,
                    },
                    children: [
                      jsx(IconRefreshOutline16, {
                        size: 14,
                        style: state.isSyncing ? { animation: "dshUsageStatsSpin 1s linear infinite" } : undefined,
                      }),
                      jsx("span", { children: state.isSyncing ? t("syncing") : t("refresh") }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          jsx("p", {
            style: { margin: "0 0 12px", fontSize: "12.5px", color: T.labelTertiary },
            children: t("intro"),
          }),

          showLoading ? jsxs("div", {
            style: {
              padding: "48px 24px",
              textAlign: "center",
              background: T.bg2,
              borderRadius: "12px",
              border: `1px dashed ${T.border}`,
              margin: "16px 0",
            },
            children: jsxs("div", {
              style: { display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "12px" },
              children: [
                jsx(IconRefreshOutline16, {
                  size: 24,
                  style: { animation: "dshUsageStatsSpin 1.2s linear infinite", color: T.labelSecondary },
                }),
                jsx("div", {
                  style: { fontSize: "14px", fontWeight: 500, color: T.labelPrimary },
                  children: t("loading"),
                }),
                jsx("div", {
                  style: { fontSize: "12px", color: T.labelTertiary, maxWidth: "360px" },
                  children: t("loadingHint"),
                }),
              ],
            }),
          }) : null,
          showError ? jsxs("div", {
            style: {
              display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
              padding: "40px 24px", textAlign: "center",
              background: T.bg2, borderRadius: "12px",
              border: `1px solid ${T.border}`, margin: "16px 0",
            },
            children: [
              jsxs("svg", {
                width: 28, height: 28, viewBox: "0 0 16 16", fill: "none",
                stroke: T.error, strokeWidth: 1.4, strokeLinecap: "round",
                "aria-hidden": "true",
                children: [
                  jsx("path", { d: "M8 2.5 15 14H1z" }),
                  jsx("path", { d: "M8 6.5v3.2" }),
                  jsx("circle", { cx: 8, cy: 11.6, r: 0.6, fill: T.error, stroke: "none" }),
                ],
              }),
              jsx("div", { style: { fontSize: "14px", fontWeight: 500, color: T.labelPrimary }, children: t("error") }),
              state.error ? jsx("div", {
                style: {
                  fontSize: "11.5px", color: T.labelTertiary, fontFamily: "monospace",
                  maxWidth: "420px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                },
                children: state.error,
              }) : null,
              jsx("button", {
                type: "button",
                onClick: refresh,
                className: "dsh-us-btn",
                style: {
                  height: "28px", padding: "0 14px", borderRadius: "14px",
                  fontSize: "12px", font: "inherit", cursor: "pointer",
                  color: T.labelSecondary, background: "transparent",
                  border: `1px solid ${T.border}`,
                },
                children: t("retry"),
              }),
            ],
          }) : null,
          showEmpty ? jsxs("div", {
            style: {
              display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
              padding: "48px 24px", textAlign: "center",
              background: T.bg2, borderRadius: "12px",
              border: `1px dashed ${T.border}`, margin: "16px 0",
            },
            children: [
              jsxs("svg", {
                width: 30, height: 30, viewBox: "0 0 16 16", fill: "none",
                stroke: T.labelTertiary, strokeWidth: 1.4, strokeLinecap: "round",
                "aria-hidden": "true",
                children: [
                  jsx("path", { d: "M2 13.5h12" }),
                  jsx("path", { d: "M4.75 13V9.5" }),
                  jsx("path", { d: "M8 13V6" }),
                  jsx("path", { d: "M11.25 13V8" }),
                ],
              }),
              jsx("div", { style: { fontSize: "14px", fontWeight: 500, color: T.labelPrimary }, children: t("empty") }),
              jsx("div", { style: { fontSize: "12px", color: T.labelTertiary, maxWidth: "360px" }, children: t("emptyHint") }),
            ],
          }) : null,

          state.status === "ready" && totals && totals.sessions > 0 ? jsxs(React.Fragment, {
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
              jsx(TokenCompositionBar, { composition: data.tokenComposition, t }),

              jsx(SectionTitle, { children: t("activity") }),
              jsx(Card, { children: jsx(Heatmap, { byDay, t }) }),

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
                  jsx(SectionTitle, {
                    right: totals.totalToolCalls ? jsx("span", {
                      style: { fontSize: "11.5px", color: T.labelTertiary, whiteSpace: "nowrap" },
                      children: `${t("totalToolCalls")} ${formatInt(totals.totalToolCalls)}`,
                    }) : null,
                    children: t("topTools"),
                  }),
                  jsx(TopToolsChart, { tools: data.topTools, t }),
                ],
              }) : null,
            ],
          }) : null,
        ],
      });
    }

    // ── Global Panel Page (Main Column) ──────────────────────────────────────

    /**
     * Full-page shell for the `main` panel: a centred 960px column with its
     * own scroll container — the frame hands main panels zero chrome, so the
     * page owns its height, scrolling and insets (same contract the shipped
     * Plugins / Tasks pages follow).
     */
    function UsageStatsPage({ t }) {
      return jsx("div", {
        style: {
          boxSizing: "border-box",
          height: "100%",
          overflowY: "auto",
          padding: "28px clamp(24px, 4vw, 48px) 48px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          color: T.labelPrimary,
          background: "var(--dsw-alias-bg-layer-1, transparent)",
        },
        children: jsx("div", {
          style: { width: "100%", maxWidth: "960px" },
          children: jsx(UsageStatsSection, { t }),
        }),
      });
    }

    // ── Module Exports & Plugin Registration ─────────────────────────────────

    exports.inject = ["locale", "slots"];
    exports.apply = function apply(ctx) {
      ensureStyles();
      ctx.locale.register(NS, { zh, en });

      // Global panel page: registered into the root-scoped `main` keyed slot.
      // The key makes the panel addressable to ctx.layout.selectPanel, which
      // the sidebar's panellist row below invokes on click.
      ctx.slots.inject("main", () => ctx.slots.register(
        {
          name: "main",
          key: PANEL_ID,
          locale: NS,
        },
        UsageStatsPage,
      ));

      // Left-sidebar panel row: sits beside the shipped Plugins / Tasks rows.
      // The sidebar owns the button, the wide-mode label, the collapsed-rail
      // tooltip and the selected state; `id` must equal the `main` key.
      ctx.slots.inject("sidebar.panellist", () => ctx.slots.register(
        {
          name: "sidebar.panellist",
          id: PANEL_ID,
          order: 20,
          label: () => (isZh() ? zh.nav : en.nav),
          locale: NS,
        },
        UsageStatsPanelIcon,
      ));
    };

    return exports;
  },
});
