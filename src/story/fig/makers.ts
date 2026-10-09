/** Who runs the cameras: the share of mapped Flock cameras with an operator recorded, then the types of operator. */
import { escape } from "../../lib/escape.ts";
import { int, smart } from "../../viz/format.ts";
import { g, rect, svg, text, label, hbar, tip, linScale, niceTicks, line, textWidth, WIDE, NARROW } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";
import type { Operators } from "../types.ts";

/** A label in at most two lines of `max` px, split at the space nearest the middle when it does not fit on one. */
function wrapLabel(s: string, max: number, size: number, weight: number): string[] {
  if (textWidth(s, size, weight) <= max) return [s];
  const words = s.split(" ");
  let best = [s], bestW = Infinity;
  for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(" "), b = words.slice(i).join(" "), w = Math.max(textWidth(a, size, weight), textWidth(b, size, weight)); if (w < bestW) { bestW = w; best = [a, b]; } }
  return best;
}
const pct = (n: number, d: number) => { const p = n / d * 100; return p < 1 ? "<1%" : `${Math.round(p)}%`; };

export function operatorsFigure(cfg: FigureCfg, ctx: Ctx, op: Operators): string {
  const rows = op.classes.slice().sort((a, b) => b.count - a.count);
  const max = rows[0]!.count;
  const draw = (W: number, narrow: boolean) => {
    const L = narrow ? 150 : 236, R = narrow ? 46 : 60, T = 24, rowH = narrow ? 34 : 24, barH = 12, fs = narrow ? 12 : 12.5;
    const x = linScale(0, max * 1.04, L, W - R);
    const ticks = niceTicks(max, narrow ? 3 : 5).filter((t) => t <= max * 1.04);
    let out = g(ticks.map((t) => line(x(t), T - 4, x(t), T + rows.length * rowH)).join(""), { class: "grid" });
    out += g(ticks.map((t) => text(x(t), T - 9, int(t), { "text-anchor": "middle" })).join(""), { class: "axis" });
    rows.forEach((r, i) => {
      const y = T + i * rowH, hi = r.id === "police";
      // on a phone a long name keeps its words and takes two lines
      const lines = wrapLabel(r.label, L - 12, fs, hi ? 700 : 400), ty = y + rowH / 2 + 4 - (lines.length - 1) * 6.5;
      const name = lines.map((l, k) => text(L - 8, ty + k * 13, l, { "text-anchor": "end", "font-size": fs, "font-weight": hi ? 700 : 400, fill: hi ? "var(--ink)" : "var(--ink-2)" })).join("");
      out += tip(rect(0, y, W, rowH, { fill: "transparent" }) + name + hbar(x(0), y + (rowH - barH) / 2, x(r.count) - x(0), barH, 3, { class: `mark ${hi ? "c-hi" : "c-ctx"}` }) + label(x(r.count) + 5, y + rowH / 2 + 4, int(r.count), { "font-size": fs, "font-weight": hi ? 700 : 500, fill: "var(--ink)" }), `${int(r.count)} cameras, ${pct(r.count, op.flockWithOperator)} of those with an operator`, r.label);
    });
    out += line(x(0), T - 4, x(0), T + rows.length * rowH, { class: "baseline" });
    return svg(W, T + rows.length * rowH + 6, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Bar chart of mapped Flock cameras by type of operator: police and sheriffs ${int(rows[0]!.count)}, the most.` });
  };
  const top = `<div class="top-ops"><p class="top-ops-k">Largest named operators</p><ol>${op.topNamed.slice(0, 8).map((t) => `<li><span class="lbl">${escape(smart(t.name).replace(/\s*\([A-Z]{2,6}\)$/, ""))}</span><span class="val">${int(t.count)}</span></li>`).join("")}</ol></div>`;
  // first, how few cameras have an operator recorded at all
  const share = Math.round(op.flockWithOperator / op.flock * 100);
  const strip = `<div class="ops-strip" role="img" aria-label="${share} percent of mapped Flock cameras have an operator recorded; ${100 - share} percent do not"><span class="has" style="width:${share}%"></span><span class="none" style="width:${100 - share}%"></span></div><div class="ops-strip-key"><span><b>${int(op.flockWithOperator)}</b> with an operator recorded, ${share} percent</span><span><b>${int(op.flockWithoutOperator)}</b> with none recorded, ${100 - share} percent</span></div><p class="ops-strip-lead">Among the ${int(op.flockWithOperator)} with an operator:</p>`;
  const table = dataTable(["Operator type", "Mapped Flock cameras"], rows.map((r) => [r.label, r.count]).concat([["No operator recorded", op.flockWithoutOperator]]));
  return frame("operators", cfg, ctx, strip + draw(WIDE, false) + draw(NARROW, true) + top, { table });
}
