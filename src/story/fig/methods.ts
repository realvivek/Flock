/** How complete the map is: mapped Flock cameras inside city limits against the counts cities or reporting published. */
import { apState, compact, int } from "../../viz/format.ts";
import { circle, g, line, rect, svg, text, label, tip, logScale, textWidth } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";
import type { CompletenessRow } from "../types.ts";

export function completenessFigure(cfg: FigureCfg, ctx: Ctx, rows: CompletenessRow[]): string {
  const list = rows.slice().sort((a, b) => b.published - a.published);
  const draw = (W: number, narrow: boolean) => {
    const L = narrow ? 92 : 132, R = narrow ? 18 : 30, T = 40, rowH = narrow ? 26 : 28;
    const x = logScale(20, 5000, L + 8, W - R);
    const ticks = [20, 50, 100, 200, 500, 1000, 2000, 5000];
    let out = g(ticks.map((t) => line(x(t), T - 6, x(t), T + list.length * rowH)).join(""), { class: "grid" });
    out += g(ticks.map((t) => text(x(t), T - 12, compact(t), { "text-anchor": "middle" })).join(""), { class: "axis" });
    // legend
    out += circle(L + 8, 10, 5, { fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 }) + text(L + 18, 14, "Published count", { "font-size": 12 });
    out += circle(L + (narrow ? 120 : 140), 10, 5, { class: "c-hi" }) + text(L + (narrow ? 130 : 150), 14, "Mapped by volunteers", { "font-size": 12 });
    list.forEach((r, i) => {
      const y = T + i * rowH + rowH / 2;
      const a = x(r.published), b = x(r.mapped);
      out += tip(rect(0, y - rowH / 2, W, rowH, { fill: "transparent" })
        + text(L - 6, y + 4, `${r.place}${narrow ? "" : `, ${apState(r.usps)}`}`, { "text-anchor": "end", "font-size": 12.5, fill: "var(--ink-2)" })
        + line(Math.min(a, b), y, Math.max(a, b), y, { stroke: "var(--rule-2)", "stroke-width": 2 })
        + circle(a, y, 5, { fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 })
        + circle(b, y, 5, { class: "mark c-hi", stroke: "#fff", "stroke-width": 1.5 })
        + (() => {
          // the mapped count sits beside its own dot, outside the pair; if that runs into the names, it goes to the right
          const t = `${int(r.mapped)} mapped`, tw = textWidth(t, 11.5);
          const leftSide = r.mapped < r.published && b - 9 - tw > L + 2;
          const x0 = leftSide ? b - 9 : Math.max(a, b) + 9;
          return label(x0, y + 4, t, { "font-size": 11.5, fill: "var(--ink-2)", "text-anchor": leftSide ? "end" : "start" });
        })(),
        `${int(r.mapped)} mapped, ${int(r.published)} published`, `${r.place}: published ${r.when}, ${r.what}`);
    });
    return svg(W, T + list.length * rowH + 4, out, { cls: narrow ? "v-narrow" : "v-wide", label: "Dot chart comparing mapped Flock cameras inside eight cities with the counts the cities or their reporting published." });
  };
  const table = dataTable(["City", "Mapped", "Tagged to the city’s police", "Tagged to another operator", "No operator tagged", "Published", "Published count"], list.map((r) => [`${r.place}, ${apState(r.usps)}`, r.mapped, r.police, r.other, r.untagged, r.published, `${r.what} (${r.when})${r.topOther && r.topOther.count >= 20 ? `; largest other operator mapped: ${r.topOther.name}, ${int(r.topOther.count)}` : ""}`]), { text: [6] });
  return frame("completeness", cfg, ctx, draw(600, false) + draw(360, true), { table });
}
