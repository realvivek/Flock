/** Whether the cameras reduce crime: the working paper's estimate of the change in vehicle thefts under its main
 *  weighting and the two alternatives in its appendix, each with a 95 percent confidence interval. */
import { g, line, rect, svg, text, label, tip, linScale, dot } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";

interface Est { label: string; sub: string; est: number; lo: number; hi: number; p: string; main?: boolean }
/** Mourtgos and Adams (2026), Table 2 and Table S7: percent change in reported motor vehicle thefts, event months 0
 *  to 12 against months -12 to -1. */
const ESTIMATES: Est[] = [
  { label: "Weighted by thefts before the cameras", sub: "The paper’s main estimate", est: -11.0, lo: -17.3, hi: -4.2, p: ".002", main: true },
  { label: "Weighted by population", sub: "From the paper’s appendix", est: 4.1, lo: -5.0, hi: 14.1, p: ".39" },
  { label: "Every agency-month counted equally", sub: "From the paper’s appendix", est: 4.4, lo: -3.4, hi: 13.0, p: ".28" },
];
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;

function draw(W: number, narrow: boolean): string {
  const L = narrow ? 22 : 300, R = narrow ? 22 : 24, T = 40, rowH = narrow ? 88 : 58;
  const x = linScale(-20, 20, L, W - R);
  const H = T + ESTIMATES.length * rowH + 30;
  let out = "";
  // grid every 10 points; zero is the reference
  out += g([-20, -10, 10, 20].map((v) => line(x(v), T - 8, x(v), T + ESTIMATES.length * rowH)).join(""), { class: "grid" });
  out += line(x(0), T - 22, x(0), T + ESTIMATES.length * rowH, { stroke: "var(--ink)", "stroke-width": 1.25 });
  out += text(x(0), T - 28, "No change", { "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: "var(--ink)" });
  // direction words under the axis
  const ay = T + ESTIMATES.length * rowH + 16;
  out += g([-20, -10, 0, 10, 20].map((v) => text(x(v), ay, v === 0 ? "0" : `${signed(v).replace(".0", "")}${Math.abs(v) === 20 ? "%" : ""}`, { "text-anchor": "middle" })).join(""), { class: "axis" });
  out += text(x(-10), ay + 16, "← Fewer thefts", { "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" });
  out += text(x(10), ay + 16, "More thefts →", { "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" });
  ESTIMATES.forEach((e, i) => {
    const y0 = T + i * rowH, cy = narrow ? y0 + 64 : y0 + rowH / 2;
    const color = e.main ? "var(--amber-mark)" : "var(--ink)";
    // on a phone the names run across the plot, so they carry a white halo over the grid and the zero line
    const name = label(narrow ? 0 : L - 14, narrow ? y0 + 16 : cy - 3, e.label, { "text-anchor": narrow ? "start" : "end", "font-size": 13, "font-weight": e.main ? 700 : 600, fill: "var(--ink)" })
      + label(narrow ? 0 : L - 14, narrow ? y0 + 31 : cy + 13, e.sub, { "text-anchor": narrow ? "start" : "end", "font-size": 12, fill: "var(--ink-3)" });
    const ci = line(x(e.lo), cy, x(e.hi), cy, { stroke: color, "stroke-width": e.main ? 3 : 2, "stroke-linecap": "round" })
      + line(x(e.lo), cy - 5, x(e.lo), cy + 5, { stroke: color, "stroke-width": 1.5 }) + line(x(e.hi), cy - 5, x(e.hi), cy + 5, { stroke: color, "stroke-width": 1.5 });
    // the value sits above its dot, clear of the interval
    const val = label(x(e.est), cy - 11, `${signed(e.est)}%`, { "text-anchor": "middle", "font-size": 12.5, "font-weight": 700, fill: "var(--ink)" });
    out += tip(rect(0, y0, W, rowH, { fill: "transparent" }) + name + ci + dot(x(e.est), cy, 6, color) + val, `${signed(e.est)} percent (95 percent interval ${signed(e.lo)} to ${signed(e.hi)})`, e.label);
  });
  return svg(W, H, out, { cls: narrow ? "v-narrow" : "v-wide", label: "Estimates of the change in vehicle thefts after Flock cameras went live: minus 11 percent when agencies are weighted by their thefts before the cameras, an interval that excludes zero; plus 4.1 and plus 4.4 percent when weighted by population or with every agency-month counted equally, intervals that include zero." });
}

export function evidenceFigure(cfg: FigureCfg, ctx: Ctx): string {
  const key = `<div class="ev-key"><span><i class="ev-dot"></i>Estimate</span><span><i class="ev-ci"></i>95 percent confidence interval: the range of effects consistent with the data</span></div>`;
  const table = dataTable(["Weighting", "Estimated change, %", "95% interval, low", "95% interval, high", "p"], ESTIMATES.map((e) => [e.label, e.est, e.lo, e.hi, e.p]), { text: [4] });
  return frame("evidence", cfg, ctx, key + draw(600, false) + draw(360, true), { table });
}
