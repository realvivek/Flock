/** Who makes and who runs the cameras: mapped readers by make, and Flock cameras by the type of operator recorded. */
import { escape } from "../../lib/escape.ts";
import { int } from "../../viz/format.ts";
import { g, rect, svg, text, label, hbar, tip, linScale, niceTicks, line } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";
import type { Operators } from "../types.ts";

const pct = (n: number, d: number) => { const p = n / d * 100; return p < 1 ? "<1%" : `${Math.round(p)}%`; };

export function makesFigure(cfg: FigureCfg, ctx: Ctx, op: Operators): string {
  const order = op.brands.slice().sort((a, b) => (a.brand === "Flock Safety" ? -1 : b.brand === "Flock Safety" ? 1 : a.brand.startsWith("(") ? 1 : b.brand.startsWith("(") ? -1 : a.brand === "Other makes" ? 1 : b.brand === "Other makes" ? -1 : b.count - a.count));
  const shade = (b: string) => (b === "Flock Safety" ? "c-hi2" : b.startsWith("(") ? "c-ctx3" : "c-ctx");
  const draw = (W: number, narrow: boolean) => {
    const H = 46, y = 8, h = 30;
    let x = 0, out = "";
    for (const b of order) {
      const w = b.count / op.total * W;
      out += tip(rect(x, y, Math.max(0.5, w - 2), h, { class: `mark ${shade(b.brand)}`, rx: x === 0 ? 3 : 0 }), `${int(b.count)} readers, ${pct(b.count, op.total)}`, b.brand === "(no make tagged)" ? "No make recorded" : b.brand);
      x += w;
    }
    out += text(12, y + 20, narrow ? `Flock ${pct(op.flock, op.total)}` : `Flock Safety · ${int(op.flock)} · ${pct(op.flock, op.total)}`, { "font-size": 13.5, "font-weight": 700, fill: "var(--ink)" });
    return svg(W, H, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Bar of ${int(op.total)} mapped plate readers by make: Flock Safety ${int(op.flock)}, ${pct(op.flock, op.total)}.` });
  };
  const legend = `<ul class="legend-list">${order.map((b) => `<li><span class="sw ${b.brand === "Flock Safety" || b.brand.startsWith("(") ? shade(b.brand) : "sw-none"}"></span><span class="lbl">${escape(b.brand === "(no make tagged)" ? "No make recorded" : b.brand)}</span><span class="val">${int(b.count)}</span><span class="pc">${pct(b.count, op.total)}</span></li>`).join("")}</ul>`;
  const table = dataTable(["Make", "Mapped readers", "Share"], order.map((b) => [b.brand === "(no make tagged)" ? "No make recorded" : b.brand, b.count, pct(b.count, op.total)]), { text: [2] });
  return frame("makes", cfg, ctx, draw(600, false) + draw(360, true) + legend, { table });
}

export function operatorsFigure(cfg: FigureCfg, ctx: Ctx, op: Operators): string {
  const rows = op.classes.slice().sort((a, b) => b.count - a.count);
  const max = rows[0]!.count;
  const draw = (W: number, narrow: boolean) => {
    const L = narrow ? 150 : 236, R = narrow ? 46 : 60, T = 24, rowH = narrow ? 26 : 24, barH = 12, fs = narrow ? 12 : 12.5;
    const x = linScale(0, max * 1.04, L, W - R);
    const ticks = niceTicks(max, narrow ? 3 : 5).filter((t) => t <= max * 1.04);
    let out = g(ticks.map((t) => line(x(t), T - 4, x(t), T + rows.length * rowH)).join(""), { class: "grid" });
    out += g(ticks.map((t) => text(x(t), T - 9, int(t), { "text-anchor": "middle" })).join(""), { class: "axis" });
    rows.forEach((r, i) => {
      const y = T + i * rowH, hi = r.id === "police";
      const name = narrow ? r.label.replace("Other businesses and institutions", "Other businesses").replace("Homeowner and residential groups", "Homeowner groups").replace("Retailers and shopping centers", "Retailers, shopping centers").replace("Flock Safety listed as operator", "Flock Safety listed") : r.label;
      out += tip(rect(0, y, W, rowH, { fill: "transparent" }) + text(L - 8, y + rowH / 2 + 4, name, { "text-anchor": "end", "font-size": fs, "font-weight": hi ? 700 : 400, fill: hi ? "var(--ink)" : "var(--ink-2)" }) + hbar(x(0), y + (rowH - barH) / 2, x(r.count) - x(0), barH, 3, { class: `mark ${hi ? "c-hi" : "c-ctx"}` }) + label(x(r.count) + 5, y + rowH / 2 + 4, int(r.count), { "font-size": fs, "font-weight": hi ? 700 : 500, fill: "var(--ink)" }), `${int(r.count)} cameras, ${pct(r.count, op.flockWithOperator)} of those with an operator`, r.label);
    });
    out += line(x(0), T - 4, x(0), T + rows.length * rowH, { class: "baseline" });
    return svg(W, T + rows.length * rowH + 6, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Bar chart of mapped Flock cameras by type of operator: police and sheriffs ${int(rows[0]!.count)}, the most.` });
  };
  const top = `<div class="top-ops"><p class="top-ops-k">Largest named operators</p><ol>${op.topNamed.slice(0, 8).map((t) => `<li><span class="lbl">${escape(t.name)}</span><span class="val">${int(t.count)}</span></li>`).join("")}</ol></div>`;
  const extra = `<p class="fig-note">No operator is recorded for ${int(op.flockWithoutOperator)} of the ${int(op.flock)} mapped Flock cameras, ${pct(op.flockWithoutOperator, op.flock)}.</p>`;
  const table = dataTable(["Operator type", "Mapped Flock cameras"], rows.map((r) => [r.label, r.count]).concat([["No operator recorded", op.flockWithoutOperator]]));
  return frame("operators", cfg, ctx, draw(600, false) + draw(360, true) + top, { table, extra });
}
