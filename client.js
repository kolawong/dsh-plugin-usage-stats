/**
 * dsh-plugin-usage-stats — Client half (the Web settings "使用统计" section).
 *
 * Registers a `settings.section` entry and renders a NextChat-style usage
 * page: summary cards, a daily token activity heatmap, a daily token trend
 * line (input vs output), and a per-model donut. Data comes from
 * /api/usage-stats/summary (the server half aggregates every session log).
 * All charts are hand-rolled SVG — no chart library, no cross-package import.
 */

window.__ModuleLoader__.load({
  id: "dsh-plugin-usage-stats",
  factory: (require) => {
    const exports = {};
    const React = require("react");
    const { useState, useEffect, useCallback } = React;
    const { jsx, jsxs } = require("react/jsx-runtime");
    const { IconRefreshOutline16 } = require("@deepseek-ai/dsh-client-ui-primitives");

    const NS = "usage-stats";

    const zh = {
      nav: "使用统计",
      title: "使用统计",
      intro: "聚合所有会话的 Token 用量与活动。",
      loading: "统计加载中…",
      empty: "还没有会话用量数据",
      error: "统计加载失败",
      refresh: "刷新",
      refreshHint: "重新统计",
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
      activity: "Token 活动",
      trend: "每日 Token 趋势",
      byModel: "模型用量",
      dimProvider: "按供应商",
      dimModel: "按模型",
      legendInput: "输入",
      legendOutput: "输出",
      dayUnit: "天",
    };
    const en = {
      nav: "Usage statistics",
      title: "Usage statistics",
      intro: "Token usage and activity aggregated across all sessions.",
      loading: "Loading statistics…",
      empty: "No usage data yet",
      error: "Failed to load statistics",
      refresh: "Refresh",
      refreshHint: "Recompute statistics",
      totalTokens: "Total tokens",
      inputTokens: "Input tokens",
      outputTokens: "Output tokens",
      cacheRead: "Cache-hit tokens",
      sessions: "Sessions",
      turns: "Turns",
      peakDay: "Peak-day tokens",
      longestTurn: "Longest turn",
      streakCurrent: "Current streak",
      streakLongest: "Longest streak",
      activity: "Token activity",
      trend: "Daily token trend",
      byModel: "Model usage",
      dimProvider: "By provider",
      dimModel: "By model",
      legendInput: "Input",
      legendOutput: "Output",
      dayUnit: "d",
    };

    // ── formatting helpers ───────────────────────────────────────────────────

/** Safe useMemo across the plugin bundle's React copy. */
    function useMemoSafe(fn, deps) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      return React.useMemo(fn, deps);
    }

    /** Whether the document is currently rendered in Chinese. */
    function isZh() {
      const lang = document.documentElement.lang;
      return lang === "zh-CN" || lang === "zh";
    }

    /** Compact token count: 1.8亿 / 6326万 / 1234 style. */
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

    /** Wall-time ms → compact "20.9 小时" / "5 分钟" / "3 秒" (or h/m/s). */
    function formatMs(ms) {
      if (!ms || ms <= 0) return "0";
      const zh = isZh();
      const sec = Math.round(ms / 1000);
      const h = sec / 3600;
      if (h >= 1) return zh ? `${h.toFixed(1)} 小时` : `${h.toFixed(1)}h`;
      const m = Math.round(sec / 60);
      if (m >= 1) return zh ? `${m} 分钟` : `${m}m`;
      return zh ? `${sec} 秒` : `${sec}s`;
    }

    /** Local YYYY-MM-DD key for an epoch-ms timestamp (or a Date, reused as-is). */
    function dayKeyOf(time) {
      const d = time instanceof Date ? time : new Date(time);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }

    // ── small presentational pieces ──────────────────────────────────────────

    /** One hero stat cell in the top strip (big value over a small label). */
    function StatCell({ label, value }) {
      return jsxs("div", {
        style: {
          flex: "1 1 0", minWidth: 0, textAlign: "center",
          display: "flex", flexDirection: "column", gap: "2px",
        },
        children: [
          jsx("span", {
            style: {
              fontSize: "18px", fontWeight: 600, lineHeight: 1.2,
              color: "var(--dsw-alias-label-primary, #f3f4f6)",
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
        ],
      });
    }

    /** The top hero strip: key metrics in one divided horizontal row. */
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
            jsx(StatCell, { label: cell.label, value: cell.value }),
            i < cells.length - 1 ? jsx("div", {
              style: { width: "1px", background: "var(--dsw-alias-border-l2, #333)", margin: "2px 0", flexShrink: 0 },
            }) : null,
          ],
        }, cell.label)),
      });
    }

    /** A single subtle line of secondary figures (input/output/cache/sessions/turns). */
    function SecondaryLine({ parts }) {
      return jsxs("div", {
        style: {
          display: "flex", flexWrap: "wrap", gap: "4px 18px",
          marginTop: "10px",
          fontSize: "12px", color: "var(--dsw-alias-label-tertiary, #9ca3af)",
        },
        children: parts.map((part) => jsxs("span", {
          children: [
            jsx("span", { style: { color: "var(--dsw-alias-label-secondary, #d1d5db)", fontWeight: 500 }, children: part.value }),
            jsx("span", { children: ` ${part.label}` }),
          ],
        }, part.label)),
      });
    }

    function SectionTitle({ children, right }) {
      return jsxs("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 10px" },
        children: [
          jsx("span", { style: { fontSize: "14px", fontWeight: 600, color: "var(--dsw-alias-label-primary, #f3f4f6)" }, children }),
          right ?? null,
        ],
      });
    }

    function Card({ children }) {
      return jsx("div", {
        style: {
          borderRadius: "12px",
          border: "1px solid var(--dsw-alias-border-l2, #333)",
          background: "var(--dsw-alias-bg-layer-2, #1e1e1e)",
          padding: "16px",
        },
        children,
      });
    }

    // ── heatmap (contribution-graph style, weekly columns, full year) ────────

    const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    function Heatmap({ byDay }) {
      const WEEKS = 53; // a full year ending today
      const DAYS = 7;
      const cell = 11;
      const gap = 3;
      const labelH = 14;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Each column is a Sun–Sat week; the last column contains today.
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
      // One running cursor walks all 371 cells (a fresh Date per cell would
      // allocate twice that); the month label is read on each column's first day.
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
            children: jsx("title", { children: `${c.key}：${formatTokens(c.total)}` }),
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

    // ── trend line (input vs output, last N days) ────────────────────────────

    /** Catmull-Rom → cubic Bézier smooth path through the points. */
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

      // Everything derived from byDay in one memo (the 30-day window is a
      // constant): day keys -> values -> points -> smooth paths -> areas.
      const chart = useMemoSafe(() => {
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
        const closeArea = (line) =>
          `${line} L${x(values.length - 1).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`;
        return {
          values, max, x,
          inputLine, outputLine,
          inputArea: closeArea(inputLine),
          outputArea: closeArea(outputLine),
        };
      }, [byDay]);
      const { values, max, x, inputLine, outputLine, inputArea, outputArea } = chart;

      // Left-to-right draw-in on mount / data change: the line strokes reveal
      // via stroke-dashoffset (pathLength normalized to 100), areas fade in.
      useEffect(() => {
        setRevealed(false);
        const id = requestAnimationFrame(() => { setRevealed(true); });
        return () => { cancelAnimationFrame(id); };
      }, [byDay]);

      const gridLines = [0.25, 0.5, 0.75, 1].map((f) => PAD.top + (1 - f) * (H - PAD.top - PAD.bottom));

      const lineProps = (stroke) => ({
        fill: "none",
        stroke,
        strokeWidth: 2,
        strokeLinejoin: "round",
        strokeLinecap: "round",
        pathLength: 100,
        strokeDasharray: 100,
        strokeDashoffset: revealed ? 0 : 100,
        style: { transition: "stroke-dashoffset 0.9s ease" },
      });
      const areaProps = (fill) => ({
        fill,
        fillOpacity: 0.12,
        stroke: "none",
        style: { opacity: revealed ? 1 : 0, transition: "opacity 0.9s ease" },
      });

      return jsxs("div", {
        children: [
          jsxs("svg", {
            width: "100%",
            viewBox: `0 0 ${W} ${H}`,
            style: { display: "block" },
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
              // soft area fill under each series, then the stroke line on top
              jsx("path", { d: inputArea, ...areaProps("var(--dsw-alias-state-business-primary, #2563eb)") }),
              jsx("path", { d: outputArea, ...areaProps("var(--dsw-alias-state-success-primary, #16a34a)") }),
              jsx("path", { d: inputLine, ...lineProps("var(--dsw-alias-state-business-primary, #2563eb)") }),
              jsx("path", { d: outputLine, ...lineProps("var(--dsw-alias-state-success-primary, #16a34a)") }),
              ...[0, 9, 19, 29].map((i) => {
                const p = values[i];
                if (!p) return null;
                return jsx("text", {
                  key: p.key,
                  x: x(i), y: H - 8, textAnchor: "middle",
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

    // ── model usage (compact list, per-model share) ──────────────────────────

    /** The palette shared by the donut and the model list (same order = same color). */
    const MODEL_PALETTE = [
      "var(--dsw-alias-state-business-primary, #2563eb)",
      "var(--dsw-alias-state-success-primary, #16a34a)",
      "var(--dsw-alias-state-warning-primary, #f59e0b)",
      "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316",
    ];

    /** A donut of per-entry share (entries: { name, total, color }). */
    function Donut({ entries, total }) {
      const R = 56;
      const SW = 20;
      const C = 2 * Math.PI * R;
      let acc = 0;
      const segs = entries.map((e) => {
        const frac = total > 0 ? e.total / total : 0;
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
            key: s.name,
            cx: 75, cy: 75, r: R, fill: "none",
            stroke: s.color, strokeWidth: SW,
            strokeDasharray: `${(s.frac * C).toFixed(2)} ${C.toFixed(2)}`,
            strokeDashoffset: `${(-s.offset * C).toFixed(2)}`,
            transform: "rotate(-90 75 75)",
            children: jsx("title", { children: `${s.name}: ${formatTokens(s.total)}` }),
          })),
          jsxs("text", {
            x: 75, y: 72, textAnchor: "middle", fontSize: 15, fontWeight: 600,
            fill: "var(--dsw-alias-label-primary, #f3f4f6)",
            children: [formatTokens(total)],
          }),
          jsxs("text", {
            x: 75, y: 88, textAnchor: "middle", fontSize: 10,
            fill: "var(--dsw-alias-label-tertiary, #9ca3af)",
            children: ["tokens"],
          }),
        ],
      });
    }

    /** The compact per-model list for one view's entries (aligned colors with the donut). */
    function ModelListRows({ entries, total }) {
      const fmtPct = (p) => (p < 10 ? p.toFixed(1) : String(Math.round(p)));
      return jsxs("div", {
        style: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
        children: entries.map((e, i) => {
          const pct = total > 0 ? (e.total / total) * 100 : 0;
          return jsxs(React.Fragment, {
            key: e.name,
            children: [
              i > 0 ? jsx("div", { style: { height: "1px", background: "var(--dsw-alias-border-l2, #333)", margin: "12px 0" } }) : null,
              jsxs("div", {
                style: { display: "flex", alignItems: "center", gap: "10px" },
                children: [
                  jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0, display: "inline-block" } }),
                  jsx("span", {
                    style: { flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 500, color: "var(--dsw-alias-label-primary, #f3f4f6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                    children: e.name,
                  }),
                  jsx("span", { style: { flexShrink: 0, fontSize: "13px", color: "var(--dsw-alias-label-secondary, #d1d5db)" }, children: `${fmtPct(pct)}%` }),
                ],
              }),
              jsx("div", {
                style: { marginTop: "4px", paddingLeft: "18px", fontSize: "12px", color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
                children: `${formatTokens(e.total)} tokens`,
              }),
            ],
          });
        }),
      });
    }

    /** Model share: donut + list, with a provider/model dimension toggle. */
    function ModelShare({ byModel, t }) {
      const [dim, setDim] = useState("provider");
      const entries = useMemoSafe(() => {
        const list = Object.entries(byModel ?? {})
          .map(([key, v]) => ({ key, total: v.totalTokens }))
          .filter((e) => e.total > 0);
        let view;
        if (dim === "provider") {
          view = list.map((e) => ({ name: e.key, total: e.total }));
        } else {
          // Model-only view: strip the "provider/" prefix and merge same-named models.
          const byName = {};
          for (const e of list) {
            const name = e.key.includes("/") ? e.key.split("/").pop() : e.key;
            byName[name] = (byName[name] ?? 0) + e.total;
          }
          view = Object.entries(byName).map(([name, total]) => ({ name, total }));
        }
        view.sort((a, b) => b.total - a.total);
        // One shared color assignment keeps the donut and the list aligned.
        view.forEach((e, i) => { e.color = MODEL_PALETTE[i % MODEL_PALETTE.length]; });
        return view;
      }, [byModel, dim]);
      const total = entries.reduce((s, e) => s + e.total, 0);

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
            style: { display: "flex", alignItems: "center", gap: "4px", marginBottom: "12px" },
            children: [toggle("provider", t("dimProvider")), toggle("model", t("dimModel"))],
          }),
          jsxs("div", {
            style: { display: "flex", alignItems: "flex-start", gap: "20px", flexWrap: "wrap" },
            children: [
              jsx(Donut, { entries, total }),
              jsx(ModelListRows, { entries, total }),
            ],
          }),
        ],
      });
    }

    // ── the section page ────────────────────────────────────────────────────

    function UsageStatsSection({ t }) {
      const [state, setState] = useState({ status: "loading", data: null, error: null });
      const [refreshTick, setRefreshTick] = useState(0);

      useEffect(() => {
        let cancelled = false;
        let timer = undefined;
        setState((s) => ({ ...s, status: "loading" }));
        const poll = () => {
          fetch("/api/usage-stats/summary")
            .then(async (res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = await res.json();
              if (cancelled) return;
              // The server answers {computing:true} while it seeds the
              // aggregate in the background; poll again shortly instead of
              // spinning forever on the scan.
              if (data?.computing) {
                timer = setTimeout(poll, 1200);
                return;
              }
              setState({ status: "ready", data, error: null });
            })
            .catch((error) => {
              if (!cancelled) setState({ status: "error", data: null, error: String(error) });
            });
        };
        poll();
        return () => { cancelled = true; if (timer !== undefined) clearTimeout(timer); };
      }, [refreshTick]);

      const refresh = useCallback(() => { setRefreshTick((n) => n + 1); }, []);

      const data = state.data;
      const totals = data?.totals;
      const byDay = data?.byDay ?? {};
      const byModel = data?.byModel ?? {};
      const peakDay = Math.max(0, ...Object.values(byDay).map((b) => b.totalTokens));

      return jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: "0", paddingBottom: "16px" },
        children: [
          jsxs("div", {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" },
            children: [
              jsx("h2", { style: { margin: 0, fontSize: "18px", fontWeight: 600, color: "var(--dsw-alias-label-primary, #f3f4f6)" }, children: t("title") }),
              jsxs("button", {
                type: "button",
                onClick: refresh,
                title: t("refreshHint"),
                style: {
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  height: "28px", padding: "0 12px", borderRadius: "14px",
                  fontSize: "12px", lineHeight: "18px", font: "inherit", cursor: "pointer",
                  color: "var(--dsw-alias-label-secondary, #d1d5db)",
                  background: "transparent",
                  border: "1px solid var(--dsw-alias-border-l2, #333)",
                },
                children: [jsx(IconRefreshOutline16, { size: 14 }), jsx("span", { children: t("refresh") })],
              }),
            ],
          }),
          jsx("p", {
            style: { margin: "0 0 8px", fontSize: "12.5px", color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
            children: t("intro"),
          }),

          state.status === "loading" ? jsx("p", { style: { color: "var(--dsw-alias-label-tertiary, #9ca3af)", fontSize: "13px" }, children: t("loading") }) : null,
          state.status === "error" ? jsx("p", { style: { color: "var(--dsw-alias-state-error-primary, #ef4444)", fontSize: "13px" }, children: `${t("error")}: ${state.error}` }) : null,
          state.status === "ready" && totals && totals.sessions === 0 ? jsx("p", { style: { color: "var(--dsw-alias-label-tertiary, #9ca3af)", fontSize: "13px" }, children: t("empty") }) : null,

          state.status === "ready" && totals ? jsxs(React.Fragment, {
            children: [
              jsx(StatStrip, {
                cells: [
                  { label: t("totalTokens"), value: formatTokens(totals.totalTokens) },
                  { label: t("peakDay"), value: formatTokens(peakDay) },
                  { label: t("longestTurn"), value: formatMs(data.longestTurnMs) },
                  { label: t("streakCurrent"), value: `${data.streak.current} ${t("dayUnit")}` },
                  { label: t("streakLongest"), value: `${data.streak.longest} ${t("dayUnit")}` },
                ],
              }),
              jsx(SecondaryLine, {
                parts: [
                  { label: t("inputTokens"), value: formatTokens(totals.inputTokens) },
                  { label: t("outputTokens"), value: formatTokens(totals.outputTokens) },
                  { label: t("cacheRead"), value: formatTokens(totals.cacheReadTokens) },
                  { label: t("sessions"), value: String(totals.sessions) },
                  { label: t("turns"), value: String(totals.turns) },
                ],
              }),

              jsx(SectionTitle, { children: t("activity") }),
              jsx(Card, { children: jsx(Heatmap, { byDay }) }),

              jsx(SectionTitle, { children: t("trend") }),
              jsx(Card, { children: jsx(TrendLine, { byDay, t }) }),

              jsx(SectionTitle, { children: t("byModel") }),
              jsx(Card, { children: jsx(ModelShare, { byModel, t }) }),
            ],
          }) : null,
        ],
      });
    }

    // ── registration ────────────────────────────────────────────────────────

    exports.inject = ["locale", "slots"];
    exports.apply = function apply(ctx) {
      ctx.locale.register(NS, { zh, en });
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
