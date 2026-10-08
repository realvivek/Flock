/** How complete the map is: mapped Flock cameras inside city limits against the counts cities or reporting published. */
import { apState, int } from "../../viz/format.ts";
import { circle, g, line, rect, svg, text, label, tip, logScale, textWidth } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";
import type { CompletenessRow } from "../types.ts";

export function completenessFigure(cfg: FigureCfg, ctx: Ctx, rows: CompletenessRow[]): string {
  const list = rows.slice().sort((a, b) => b.published - a.published);
  const draw = (W: number, narrow: boolean) => {
    const L = narrow ? 92 : 132, R = narrow ? 12 : 24, T = narrow ? 56 : 44, rowH = narrow ? 30 : 28;
    const x = logScale(20, 5000, L + 8, W - R);
    const ticks = [20, 50, 100, 200, 500, 1000, 2000, 5000];
    let out = g(ticks.map((t) => line(x(t), T - 6, x(t), T + list.length * rowH)).join(""), { class: "grid" });
    const shown = narrow ? [20, 50, 100, 200, 1000, 5000] : ticks;
    out += g(shown.map((t, i) => text(x(t), T - 12, int(t), { "text-anchor": narrow && i === shown.length - 1 ? "end" : "middle" })).join(""), { class: "axis" });
    // legend
    const lx = narrow ? 7 : L + 8;
    out += circle(lx, 10, 5, { fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 }) + text(lx + 10, 14, "Published count", { "font-size": 12 });
    out += circle(lx + 120, 10, 5, { class: "c-hi" }) + text(lx + 130, 14, "Mapped by volunteers", { "font-size": 12 });
    list.forEach((r, i) => {
      const y = T + i * rowH + rowH / 2;
      const a = x(r.published), b = x(r.mapped);
      out += tip(rect(0, y - rowH / 2, W, rowH, { fill: "transparent" })
        + text(L - 6, y + 4, `${r.place}${narrow ? "" : `, ${apState(r.usps)}`}`, { "text-anchor": "end", "font-size": 12.5, fill: "var(--ink-2)" })
        + line(Math.min(a, b), y, Math.max(a, b), y, { stroke: "var(--rule-2)", "stroke-width": 2 })
        + circle(a, y, 5, { fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 })
        + circle(b, y, 5, { class: "mark c-hi", stroke: "#fff", "stroke-width": 1.5 })
        + (() => {
          // each count beside its own dot, outside the pair; where one side has no room, both go on the other
          const lo = Math.min(a, b), hi = Math.max(a, b), loT = r.mapped < r.published ? `${int(r.mapped)} mapped` : `${int(r.published)} published`, hiT = r.mapped < r.published ? `${int(r.published)} published` : `${int(r.mapped)} mapped`;
          const fs = 12, leftOk = lo - 9 - textWidth(loT, fs) > L + 2, rightOk = hi + 9 + textWidth(hiT, fs) < W - 2;
          if (leftOk && rightOk) return label(lo - 9, y + 4, loT, { "font-size": fs, fill: "var(--ink-2)", "text-anchor": "end" }) + label(hi + 9, y + 4, hiT, { "font-size": fs, fill: "var(--ink-2)" });
          const both = `${loT} · ${hiT}`;
          return rightOk || !leftOk ? label(hi + 9, y + 4, both, { "font-size": fs, fill: "var(--ink-2)" }) : label(lo - 9, y + 4, both, { "font-size": fs, fill: "var(--ink-2)", "text-anchor": "end" });
        })(),
        `${int(r.mapped)} mapped, ${int(r.published)} published`, `${r.place}: published ${r.when}, ${r.what}`);
    });
    return svg(W, T + list.length * rowH + 4, out, { cls: narrow ? "v-narrow" : "v-wide", label: "Dot chart comparing mapped Flock cameras inside eight cities with the counts the cities or their reporting published." });
  };
  const table = dataTable(["City", "Mapped", "Tagged to the city’s police", "Tagged to another operator", "No operator tagged", "Published", "Published count"], list.map((r) => [`${r.place}, ${apState(r.usps)}`, r.mapped, r.police, r.other, r.untagged, r.published, `${r.what} (${r.when})${r.topOther && r.topOther.count >= 20 ? `; largest other operator mapped: ${r.topOther.name}, ${int(r.topOther.count)}` : ""}`]), { text: [6] });
  return frame("completeness", cfg, ctx, draw(600, false) + draw(360, true), { table });
}
