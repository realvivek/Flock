/** What the reads produce: Oakland's reads and alerts as areas, its logged successes, and three departments' counts
 *  on a logarithmic scale. */
import { apPeriod, big, int, tickWords } from "../../viz/format.ts";
import { circle, g, line, path, rect, svg, text, label, tip, logScale, textWidth } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";
import type { Ladder } from "../types.ts";

const OAK = { reads: 638_747_333, alerts: 1_099_837, off: 653_566, success: 425, arrests: 162, vehicles: 174, guns: 51, byOffense: { arrests: 162, vehicles: 25, guns: 50 } };

export function oaklandFigure(cfg: FigureCfg, ctx: Ctx): string {
  const draw = (W: number, narrow: boolean) => {
    const S = narrow ? 300 : 300, x0 = 0, y0 = 26;
    const s = S * Math.sqrt(OAK.alerts / OAK.reads);
    // the enlargement stays smaller than the square it comes from
    const I = narrow ? 230 : 210, ix = narrow ? W - I - 2 : W - I - 10, iy = narrow ? y0 + S + 46 : y0 + 30;
    const offShare = OAK.off / OAK.alerts, wOff = I * offShare;
    let out = "";
    out += text(x0, 14, "Plate reads", { "font-size": 13, "font-weight": 700, fill: "var(--ink)" });
    out += tip(rect(x0, y0, S, S, { class: "mark c-wash", stroke: "var(--rule-2)", "stroke-width": 1 }), `${int(OAK.reads)} plate reads`, "Oakland, 2025");
    out += text(x0 + 14, y0 + 34, big(OAK.reads), { "font-size": narrow ? 26 : 32, "font-weight": 700, fill: "var(--ink)", "font-family": "var(--sans)" });
    out += text(x0 + 14, y0 + (narrow ? 54 : 58), "reads", { "font-size": 14, fill: "var(--ink-2)" });
    // the alerts square sits in the corner of the reads square, and the zoom lines lead to its enlargement
    const ax = x0 + S - s - 10, ay = y0 + S - s - 10;
    out += path(`M${ax} ${ay} L${ix} ${iy} M${ax + s} ${ay + s} L${ix + I} ${iy + I}`, { stroke: "var(--ink-3)", "stroke-width": 1, fill: "none", "stroke-opacity": 0.6 });
    out += tip(rect(ax, ay, s, s, { fill: "var(--ink)" }), `${int(OAK.alerts)} alerts`, "Hot-list alerts, 2025");
    out += text(ix, iy - 10, `${int(OAK.alerts)} alerts, enlarged`, { "font-size": 13, "font-weight": 700, fill: "var(--ink)" });
    out += tip(rect(ix, iy, wOff - 1, I, { class: "mark c-wash2" }), `${int(OAK.off)} alerts`, "Stolen plates and stolen vehicles: generated, but not sent to officers");
    out += tip(rect(ix + wOff + 1, iy, I - wOff - 1, I, { class: "mark c-hi" }), `${int(OAK.alerts - OAK.off)} alerts`, "Other alert types, including felony vehicles and custom lists");
    const t1 = narrow ? 13 : 13.5;
    out += text(ix + 8, iy + 22, int(OAK.off), { "font-size": t1 + 2, "font-weight": 700, fill: "var(--ink)" });
    out += text(ix + 8, iy + 40, "stolen plates", { "font-size": t1 - 1.5, fill: "var(--ink)" }) + text(ix + 8, iy + 55, "and vehicles,", { "font-size": t1 - 1.5, fill: "var(--ink)" }) + text(ix + 8, iy + 70, "switched off", { "font-size": t1 - 1.5, fill: "var(--ink)" });
    out += text(ix + wOff + 8, iy + 22, int(OAK.alerts - OAK.off), { "font-size": t1 + 2, "font-weight": 700, fill: "var(--ink)" });
    out += text(ix + wOff + 8, iy + 40, "other", { "font-size": t1 - 1.5, fill: "var(--ink)" }) + text(ix + wOff + 8, iy + 55, "types", { "font-size": t1 - 1.5, fill: "var(--ink)" });
    const H = narrow ? iy + I + 28 : Math.max(y0 + S, iy + I + 26) + 4;
    return svg(W, H, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Two squares drawn to scale: ${int(OAK.reads)} plate reads and, in its corner, ${int(OAK.alerts)} alerts, about one for every 580 reads. Of the alerts, ${int(OAK.off)} were stolen-plate or stolen-vehicle alerts the department kept switched off.` });
  };
  // the report totals the same outcomes twice, in its summary and in its table by offense, and they differ: both shown
  const rowsOut: [string, number, number][] = [["Arrests", OAK.arrests, OAK.byOffense.arrests], ["Vehicles recovered", OAK.vehicles, OAK.byOffense.vehicles], ["Guns recovered", OAK.guns, OAK.byOffense.guns]];
  const tiles = `<div class="tiles"><p class="tiles-k">Officers also logged <b>${OAK.success}</b> “success stories” in 2025. The report totals what came of them twice, and the totals differ:</p><table class="oak-t"><thead><tr><th scope="col"><span class="visually-hidden">Outcome</span></th><th scope="col">In the report’s summary</th><th scope="col">In its table by offense</th></tr></thead><tbody>${rowsOut.map(([k, a, b]) => `<tr><th scope="row">${k}</th><td>${a}</td><td${a !== b ? ' class="differs"' : ""}>${b}</td></tr>`).join("")}</tbody></table></div>`;
  const table = dataTable(["Measure, Oakland 2025", "Count"], [["Plate reads", OAK.reads], ["Alerts", OAK.alerts], ["  Stolen plates and stolen vehicles (switched off)", OAK.off], ["  Other alert types", OAK.alerts - OAK.off], ["Success stories logged", OAK.success], ["Arrests, report summary", OAK.arrests], ["Arrests, table by offense", OAK.byOffense.arrests], ["Vehicles recovered, report summary", OAK.vehicles], ["Vehicles recovered, table by offense", OAK.byOffense.vehicles], ["Guns recovered, report summary", OAK.guns], ["Guns recovered, table by offense", OAK.byOffense.guns]]);
  return frame("oakland", cfg, ctx, draw(600, false) + draw(360, true) + tiles, { table });
}

const RUNGS: { k: keyof Ladder["values"]; label: string }[] = [
  { k: "reads", label: "Plate reads" }, { k: "alerts", label: "Alerts" }, { k: "stops", label: "Stops" }, { k: "recoveries", label: "Vehicles recovered" }, { k: "arrests", label: "Arrests" },
];
const PANELS: { id: string; name: string; sub: string; readsLabel?: string; alertsLabel?: string; arrestsLabel?: string }[] = [
  { id: "lapd-2025", name: "Los Angeles", sub: "August–September 2025 · alerts and results from Axon readers in patrol cars", readsLabel: "Reads, all readers", alertsLabel: "Alerts, in-car readers" },
  { id: "columbia-2025", name: "Columbia, Mo.", sub: "2025 · Flock cameras", arrestsLabel: "Cases cleared by arrest" },
  { id: "nashville-2023", name: "Nashville", sub: "Eight weeks in 2023 · 117 readers, make not named", alertsLabel: "Verified hits" },
];

export function ladderFigure(cfg: FigureCfg, ctx: Ctx, ladders: Ladder[]): string {
  const rows = PANELS.map((p) => ({ p, L: ladders.find((l) => l.id === p.id)! }));
  for (const r of rows) if (!r.L) throw new Error(`story: ladder ${r.p.id} missing`);
  const draw = (W: number, narrow: boolean) => {
    const LW = narrow ? 136 : 164, R = narrow ? 44 : 60, top = 26, rowH = narrow ? 19 : 20, gap = 18;
    // the panel's description wraps under its name when the line is too long
    const subLines = (sub: string) => { const out: string[] = []; let cur = ""; for (const w of sub.split(" ")) { const t = cur ? `${cur} ${w}` : w; if (textWidth(t, 12) > (narrow ? W : W - 100) && cur) { out.push(cur); cur = w; } else cur = t; } return [...out, cur]; };
    const headH = Math.max(...rows.map(({ p }) => (narrow ? 26 + subLines(p.sub).length * 15 : 22 + subLines(p.sub).length * 15))) + 2;
    const x = logScale(1, 1e9, LW + 6, W - R);
    const decades = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
    const panelH = headH + RUNGS.length * rowH;
    const H = top + rows.length * (panelH + gap) + 4;
    // every other power of 10 is labeled; the grid has them all
    let out = g((narrow ? [1, 1e3, 1e6, 1e9] : [1, 100, 1e4, 1e6, 1e8]).map((d) => text(x(d), 14, tickWords(d), { "text-anchor": "middle" })).join(""), { class: "axis" });
    rows.forEach(({ p, L }, i) => {
      const y0 = top + i * (panelH + gap);
      out += line(0, y0 + 0.5, W, y0 + 0.5, { stroke: "var(--ink)", "stroke-width": 1 });
      out += text(0, y0 + 17, p.name, { "font-size": 14, "font-weight": 700, fill: "var(--ink)" });
      subLines(p.sub).forEach((l, k) => { out += text(narrow ? 0 : 100, y0 + (narrow ? 33 : 17) + k * 15, l, { "font-size": 12, fill: "var(--ink-3)" }); });
      out += g(decades.map((d) => line(x(d), y0 + headH - 6, x(d), y0 + panelH)).join(""), { class: "grid" });
      RUNGS.forEach((r, k) => {
        const y = y0 + headH + k * rowH + rowH / 2, v = L.values[r.k];
        const name = r.k === "reads" && p.readsLabel ? p.readsLabel : r.k === "alerts" && p.alertsLabel ? p.alertsLabel : r.k === "arrests" && p.arrestsLabel ? p.arrestsLabel : r.label;
        out += text(LW - 4, y + 4, name, { "text-anchor": "end", "font-size": 12, fill: v == null ? "var(--ink-3)" : "var(--ink-2)" });
        if (v == null) { out += text(LW + 8, y + 4, "not reported", { "font-size": 11.5, fill: "var(--ink-3)", "font-style": "italic", "font-family": "var(--serif)" }); return; }
        const vt = v >= 1e5 ? big(v) : int(v), left = x(v) + 9 + vt.length * 7 > W;
        out += tip(rect(LW, y - rowH / 2, W - LW, rowH, { fill: "transparent" }) + circle(x(v), y, 5, { class: "mark c-ink", stroke: "#fff", "stroke-width": 2 }) + label(left ? x(v) - 9 : x(v) + 9, y + 4, vt, { "font-size": 12, "font-weight": 600, fill: "var(--ink)", "text-anchor": left ? "end" : "start" }), `${int(v)}`, `${p.name}: ${name}`);
      });
    });
    return svg(W, H, out, { cls: narrow ? "v-narrow" : "v-wide", label: "Dot plot on a logarithmic scale of plate reads, alerts, stops, vehicles recovered and arrests for Los Angeles, Columbia, Mo., and Nashville, each from its own report or audit: alerts in the hundreds or thousands, arrests in the dozens." });
  };
  const table = dataTable(["Department", "Period", "Plate reads", "Alerts", "Stops", "Vehicles recovered", "Arrests"], rows.map(({ p, L }) => [p.name, apPeriod(L.period), L.values.reads, L.values.alerts, L.values.stops, L.values.recoveries, L.values.arrests]), { text: [1] });
  return frame("ladder", cfg, ctx, draw(600, false) + draw(360, true), { table });
}
