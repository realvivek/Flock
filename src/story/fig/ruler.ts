/** How long a read lasts: a vertical logarithmic time scale, from the read to deletion. The four retention periods
 *  sit too close on a log scale to label at their own heights, so a list keyed by days stacks down from the first. */
import { circle, g, line, path, rect, svg, text, textWidth } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";

const S = 1, MIN = 60, HR = 3600, DAY = 86400, YR = 365 * DAY;
interface Keep { days: number; title: string; sub?: string; hi?: boolean }
const ALERT = { t0: 10, t1: 15, title: "Alert to officers", sub: "10 to 15 seconds on average" };
const KEEP: Keep[] = [
  { days: 7, title: "Flock’s default for new customers,", sub: "announced Aug. 13, 2026", hi: true },
  { days: 21, title: "Virginia and Washington limits" },
  { days: 30, title: "Flock’s earlier default;", sub: "existing customers keep their settings" },
  { days: 60, title: "California Highway Patrol limit" },
];
const EVIDENCE = { title: "Evidence Mode", sub: "Kept for an investigation; no published limit" };
/** Ticks, with the ones a phone leaves out */
const TICKS: [number, string, boolean][] = [[S, "1 second", true], [10 * S, "10 seconds", false], [MIN, "1 minute", true], [10 * MIN, "10 minutes", false], [HR, "1 hour", true], [DAY, "1 day", true], [7 * DAY, "1 week", true], [30 * DAY, "1 month", true], [YR, "1 year", true]];

/** Split text into lines of at most `max` px at the given size. */
function wrap(s: string, max: number, size: number, weight = 400): string[] {
  const words = s.split(" "), out: string[] = [];
  let cur = "";
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (textWidth(t, size, weight) > max && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out;
}

function draw(W: number, narrow: boolean): string {
  const T = 58, B = narrow ? 500 : 460, AX = narrow ? 66 : 150, LX = AX + (narrow ? 30 : 40), fs = narrow ? 12 : 12.5, fsSub = narrow ? 12 : 11.5, lh = fs * 1.3;
  const y = (t: number) => T + Math.log10(t) / Math.log10(YR) * (B - T);
  const maxW = W - LX - 4;
  let out = "";
  // axis with a break between the read (time zero) and one second
  out += line(AX, T - 30, AX, T - 16, { stroke: "var(--ink)", "stroke-width": 1.5 });
  out += path(`M${AX - 6} ${T - 13} l12 -4 M${AX - 6} ${T - 8} l12 -4`, { stroke: "var(--ink)", "stroke-width": 1.2 });
  out += line(AX, T - 6, AX, y(YR) + 6, { stroke: "var(--ink)", "stroke-width": 1.5 });
  out += circle(AX, T - 34, 5, { fill: "var(--ink)" }) + text(AX + 14, T - 30, "Plate read", { "font-size": fs, "font-weight": 700, fill: "var(--ink)" });
  // the upload has no published figure: a note at the break, not a mark on the scale
  out += text(AX + 14, T - 15, narrow ? "Sent to Flock; no time is published" : "Sent to Flock’s servers; no time is published", { "font-size": fsSub, fill: "var(--ink-3)" });
  out += g(TICKS.filter((t) => !narrow || t[2]).map(([t, name]) => line(AX - 4, y(t), AX, y(t), { stroke: "var(--ink-3)" }) + text(AX - 9, y(t) + 4, name, { "text-anchor": "end" })).join(""), { class: "axis" });

  // the alert, a span of seconds
  const ay = y(Math.sqrt(ALERT.t0 * ALERT.t1));
  out += g(rect(AX - 4, y(ALERT.t0), 8, Math.max(4, y(ALERT.t1) - y(ALERT.t0)), { rx: 3, fill: "var(--ink)" })
    + line(AX + 8, ay, LX - 6, ay, { stroke: "var(--ink-3)", "stroke-width": 1 })
    + text(LX, ay - 2, ALERT.title, { "font-size": fs, "font-weight": 700, fill: "var(--ink)" })
    + text(LX, ay - 2 + lh, ALERT.sub, { "font-size": fsSub, fill: "var(--ink-2)" }), { class: "ruler-ev" });

  // retention: a dot on the axis for each period, and a list keyed by the number of days that starts level with the
  // first dot and stacks downward, each entry joined to its dot by a leader
  const y0 = y(KEEP[0]!.days * DAY);
  const dayW = Math.max(...KEEP.map((k) => textWidth(`${k.days} days`, fs, 700))) + 8;
  const items = KEEP.map((k) => ({ k, lines: wrap(`${k.title}${k.sub ? ` ${k.sub}` : ""}`, maxW - dayW, fs) }));
  const gap = narrow ? 6 : 5;
  out += text(LX, y0 - lh * 1.05, "Deleted after", { "font-size": fs - 1, "font-weight": 700, fill: "var(--ink-3)", "letter-spacing": 0.4 });
  let cy = y0 + fs * 0.36;
  for (const it of items) {
    const dy = y(it.k.days * DAY), my = cy - fs * 0.36;
    out += path(`M${AX + 6} ${dy} L${LX - 14} ${my} H${LX - 6}`, { fill: "none", stroke: "var(--ink-2)", "stroke-width": 1 });
    out += circle(AX, dy, 4.5, { fill: it.k.hi ? "var(--amber-mark)" : "var(--ink)", stroke: "#fff", "stroke-width": 1.5 });
    out += text(LX, cy, `${it.k.days} days`, { "font-size": fs, "font-weight": 700, fill: it.k.hi ? "var(--amber-ink)" : "var(--ink)" });
    it.lines.forEach((l, i) => { out += text(LX + dayW, cy + i * lh, l, { "font-size": fs, fill: "var(--ink-2)" }); });
    cy += it.lines.length * lh + gap;
  }
  const listBottom = cy - gap - fs * 0.36 + lh * 0.3;

  // past the year, a second break and an open arrow for what has no published limit
  const ey = Math.max(y(YR) + 46, listBottom + 30);
  out += path(`M${AX - 6} ${y(YR) + 13} l12 -4 M${AX - 6} ${y(YR) + 18} l12 -4`, { stroke: "var(--ink)", "stroke-width": 1.2 });
  out += line(AX, y(YR) + 21, AX, ey + 2, { stroke: "var(--ink)", "stroke-width": 1.5 });
  out += path(`M${AX - 5} ${ey - 6} L${AX} ${ey + 4} L${AX + 5} ${ey - 6}`, { fill: "none", stroke: "var(--ink)", "stroke-width": 1.5 });
  out += g(line(AX + 9, ey - 2, LX - 6, ey - 2, { stroke: "var(--ink-3)", "stroke-width": 1 })
    + text(LX, ey + 2, EVIDENCE.title, { "font-size": fs, "font-weight": 700, fill: "var(--ink)" })
    + wrap(EVIDENCE.sub, maxW, fsSub).map((l, i) => text(LX, ey + 2 + (i + 1) * lh, l, { "font-size": fsSub, fill: "var(--ink-2)" })).join(""), { class: "ruler-ev" });
  const H = ey + 2 + (wrap(EVIDENCE.sub, maxW, fsSub).length + 0.6) * lh;
  return svg(W, Math.ceil(H), out, { cls: narrow ? "v-narrow" : "v-wide", label: "Time scale from a plate read: an alert to officers in 10 to 15 seconds on average; reads deleted after 7 days by Flock's default for new customers, 21 days under Virginia and Washington law, 30 days under Flock's earlier default and 60 days for the California Highway Patrol; and Evidence Mode, with no published limit." });
}

export function rulerFigure(cfg: FigureCfg, ctx: Ctx): string {
  const rows: [string, string][] = [[ALERT.title, ALERT.sub], ...KEEP.map((k): [string, string] => [`${k.title.replace(/[,;]$/, "")}${k.sub ? ` (${k.sub})` : ""}`, `${k.days} days`]), [EVIDENCE.title, EVIDENCE.sub]];
  const table = dataTable(["Step", "Time after the read"], rows, { text: [1] });
  return frame("ruler", cfg, ctx, draw(600, false) + draw(360, true), { table });
}
