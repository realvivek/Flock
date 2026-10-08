/** How long a read lasts: a vertical time scale where each step is ten times longer, from the read to deletion. */
import { circle, g, line, path, rect, svg, text, textWidth } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";

const S = 1, MIN = 60, HR = 3600, DAY = 86400, YR = 365 * DAY;
interface Ev { t0: number; t1?: number; title: string; sub: string; hi?: boolean; open?: boolean; faint?: boolean }
const EVENTS: Ev[] = [
  { t0: 1, t1: 9, title: "Sent to Flock’s servers", sub: "seconds; no figure published", faint: true },
  { t0: 10, t1: 15, title: "Alert on officers’ phones", sub: "about 10 to 15 seconds" },
  { t0: 7 * DAY, title: "Deleted by default", sub: "7 days, since Aug. 13, 2026", hi: true },
  { t0: 21 * DAY, title: "Virginia and Washington limit", sub: "21 days" },
  { t0: 30 * DAY, title: "Flock’s earlier default", sub: "30 days, until Aug. 13, 2026" },
  { t0: 60 * DAY, title: "California Highway Patrol limit", sub: "60 days" },
  { t0: YR * 1.25, title: "Evidence Mode", sub: "kept for an investigation; no published limit", open: true },
];
const TICKS: [number, string, string][] = [[S, "1 second", "1 sec."], [10 * S, "10 seconds", "10 sec."], [MIN, "1 minute", "1 min."], [10 * MIN, "10 minutes", "10 min."], [HR, "1 hour", "1 hr."], [DAY, "1 day", "1 day"], [7 * DAY, "1 week", "1 wk."], [30 * DAY, "1 month", "1 mo."], [YR, "1 year", "1 yr."]];

/** Split text into lines of at most `max` px at the given size. */
function wrap(s: string, max: number, size: number, weight = 400): string[] {
  const words = s.split(" "), out: string[] = [];
  let cur = "";
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (textWidth(t, size, weight) > max && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out;
}
/** Place labels at their wanted y without overlap: push down, then pull back up from the bottom. */
function dodge(items: { want: number; h: number }[], top: number, bottom: number, gap = 6): number[] {
  const y = items.map((it) => it.want);
  for (let i = 0; i < y.length; i++) y[i] = Math.max(y[i]!, i ? y[i - 1]! + items[i - 1]!.h + gap : top);
  for (let i = y.length - 1; i >= 0; i--) { const lim = i === y.length - 1 ? bottom - items[i]!.h : y[i + 1]! - gap - items[i]!.h; if (y[i]! > lim) y[i] = lim; }
  return y;
}

function draw(W: number, narrow: boolean): string {
  const T = 58, B = narrow ? 520 : 470, AX = narrow ? 70 : 150, LX = AX + (narrow ? 22 : 30), fs = narrow ? 12 : 12.5, lh = fs * 1.25;
  const y = (t: number) => T + Math.log10(t) / Math.log10(YR) * (B - T);
  let out = "";
  // axis with a break between the read (time zero) and one second
  out += line(AX, T - 30, AX, T - 16, { stroke: "var(--ink)", "stroke-width": 1.5 });
  out += path(`M${AX - 6} ${T - 13} l12 -4 M${AX - 6} ${T - 8} l12 -4`, { stroke: "var(--ink)", "stroke-width": 1.2 });
  out += line(AX, T - 6, AX, B + 26, { stroke: "var(--ink)", "stroke-width": 1.5 });
  out += path(`M${AX - 5} ${B + 20} L${AX} ${B + 30} L${AX + 5} ${B + 20}`, { fill: "none", stroke: "var(--ink)", "stroke-width": 1.5 });
  out += circle(AX, T - 34, 5, { fill: "var(--ink)" }) + text(AX + 14, T - 30, "Plate read", { "font-size": fs, "font-weight": 700, fill: "var(--ink)" });
  out += g(TICKS.map(([t, long, short]) => line(AX - 4, y(t), AX, y(t), { stroke: "var(--ink-3)" }) + text(AX - 9, y(t) + 4, narrow ? short : long, { "text-anchor": "end" })).join(""), { class: "axis" });
  // events
  const maxW = W - LX - 6;
  const blocks = EVENTS.map((e) => { const tl = wrap(e.title, maxW, fs, 700), sl = wrap(e.sub, maxW, fs - 1); return { e, tl, sl, h: (tl.length + sl.length) * lh, want: y(e.t1 ? Math.sqrt(e.t0 * e.t1) : e.t0) - lh * 0.8 }; });
  const placed = dodge(blocks, T - 4, B + 40, narrow ? 8 : 10);
  blocks.forEach((b, i) => {
    const { e } = b;
    const ym = y(e.t1 ? Math.sqrt(e.t0 * e.t1) : e.t0), ly = placed[i]!;
    const color = e.hi ? "var(--amber-mark)" : e.faint ? "var(--context)" : "var(--ink)";
    let mark = e.t1 ? rect(AX - 4, y(e.t0), 8, Math.max(4, y(e.t1) - y(e.t0)), { rx: 3, fill: color }) : e.open ? "" : circle(AX, ym, 5, { fill: color, stroke: "#fff", "stroke-width": 2 });
    if (e.open) mark = rect(AX - 4, y(YR) + 4, 8, B + 18 - y(YR) - 4, { rx: 3, fill: "var(--ink)" });
    // leader from the axis to the label when it was moved
    const anchorY = ly + lh * 0.65;
    const leader = path(`M${AX + 7} ${ym} L${LX - 10} ${anchorY} L${LX - 4} ${anchorY}`, { fill: "none", stroke: "var(--rule-2)", "stroke-width": 1 });
    let t = "";
    b.tl.forEach((l, k) => { t += text(LX, ly + lh * (k + 0.8), l, { "font-size": fs, "font-weight": 700, fill: "var(--ink)" }); });
    b.sl.forEach((l, k) => { t += text(LX, ly + lh * (b.tl.length + k + 0.8), l, { "font-size": fs - 1, fill: "var(--ink-2)" }); });
    out += g(leader + mark + t, { class: "ruler-ev" });
  });
  return svg(W, B + 46, out, { cls: narrow ? "v-narrow" : "v-wide", label: "Time scale from a plate read: sent within seconds, an alert on phones in about 10 to 15 seconds, deleted by default after 7 days, state limits of 21 and 60 days, Flock's earlier 30-day default, and Evidence Mode with no published limit." });
}

export function rulerFigure(cfg: FigureCfg, ctx: Ctx): string {
  const table = dataTable(["Step", "Time after the read"], EVENTS.map((e) => [e.title, e.sub]), { text: [1] });
  return frame("ruler", cfg, ctx, draw(600, false) + draw(360, true), { table });
}
