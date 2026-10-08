/** What it costs: documented prices per camera over time with the one documented list-price change, the installation
 *  fee then and now, and the largest documented contracts per year. */
import { int } from "../../viz/format.ts";
import { circle, g, line, path, rect, svg, text, label, hbar, tip, linScale } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";

/** Decimal year of an ISO date. */
const yr = (iso: string) => { const [y, m = 1, d = 1] = iso.split("-").map(Number); return y! + (m - 1) / 12 + (d - 1) / 365; };
interface PricePoint { date: string; price: number; what: string; kind: "list" | "contract" }
const POINTS: PricePoint[] = [
  { date: "2019-12", price: 182, what: "Greenville, S.C.: 11 cameras for $2,000 a year in all", kind: "contract" },
  { date: "2023-10", price: 2500, what: "Indio, Calif.: $2,500 offered for a five-year term", kind: "contract" },
  { date: "2024-04", price: 2500, what: "Greenville renewal, 50 cameras", kind: "contract" },
  { date: "2024-05", price: 3000, what: "Virginia Sheriffs’ Association catalog list price", kind: "list" },
  { date: "2025-06", price: 3000, what: "Park Ridge, Ill., invoice", kind: "contract" },
];

export function priceFigure(cfg: FigureCfg, ctx: Ctx): string {
  const draw = (W: number, narrow: boolean) => {
    const L = narrow ? 44 : 52, R = narrow ? 10 : 16, T = 18, PH = narrow ? 200 : 230;
    const x = linScale(2019, 2027, L, W - R), y = linScale(0, 3500, T + PH, T);
    let out = "";
    // grid and axes
    out += g([0, 1000, 2000, 3000].map((v) => line(L, y(v), W - R, y(v))).join(""), { class: "grid" });
    out += g([0, 1000, 2000, 3000].map((v) => text(L - 6, y(v) + 4, v === 0 ? "$0" : `$${int(v)}`, { "text-anchor": "end" })).join(""), { class: "axis" });
    out += g([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((v) => text(x(v + 0.5), T + PH + 16, narrow ? `’${String(v).slice(2)}` : String(v), { "text-anchor": "middle" })).join(""), { class: "axis" });
    out += line(L, y(0) + 0.5, W - R, y(0) + 0.5, { class: "baseline" });
    // the range reported for 2021 to 2023 contracts, as a light band
    out += tip(rect(x(2021), y(2500), x(2024) - x(2021), y(2000) - y(2500), { class: "mark c-wash" }), "$2,000 to $2,500 a camera", "Council agreements and reporting, 2021 to 2023");
    out += text(x(2021) + 6, y(2000) + 15, narrow ? "2021–23 contracts" : "Range in 2021–23 contracts", { "font-size": 11.5, fill: "var(--ink-2)" });
    // the documented change on Jan. 1, 2024: a step in the list price
    const s0 = x(2023 + 9 / 12), s1 = x(2024), s2 = x(2027);
    out += path(`M${s0} ${y(2500)} H${s1} V${y(3000)} H${s2}`, { fill: "none", stroke: "var(--amber-mark)", "stroke-width": 2.5, "stroke-linejoin": "round" });
    out += label(s1 + 6, y(3000) - 9, narrow ? "$3,000 list since Jan. 1, 2024" : "List price $3,000 since Jan. 1, 2024", { "font-size": 12, "font-weight": 700, fill: "var(--ink)" });
    // documented prices
    for (const p of POINTS) {
      const cx = x(yr(p.date)), cy = y(p.price);
      out += tip(circle(cx, cy, 12, { fill: "transparent" }) + circle(cx, cy, 4.5, p.kind === "list" ? { fill: "var(--ink)", stroke: "#fff", "stroke-width": 2 } : { fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 }), `$${int(p.price)} a camera per year`, p.what);
    }
    const gp = POINTS[0]!;
    out += label(x(yr(gp.date)) + 9, y(gp.price) - 8, narrow ? "Greenville, 2019: $182" : "Greenville, S.C., 2019: $182 a camera", { "font-size": 12, "font-weight": 600, fill: "var(--ink)" });
    // legend
    const lg = narrow ? T + PH + 34 : T + PH + 36;
    out += circle(L + 4, lg - 4, 4.5, { fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 }) + text(L + 14, lg, "Contract or invoice", { "font-size": 12 });
    out += circle(L + (narrow ? 140 : 160), lg - 4, 4.5, { fill: "var(--ink)" }) + text(L + (narrow ? 150 : 170), lg, "Price list", { "font-size": 12 });
    return svg(W, lg + 8, out, { cls: narrow ? "v-narrow" : "v-wide", label: "Chart of the annual price per Flock camera from 2019 to 2026: $182 a camera in Greenville in 2019, $2,000 to $2,500 in contracts from 2021 to 2023, and a list price of $3,000 since Jan. 1, 2024." });
  };
  const fees = `<div class="fees"><p class="fees-k">Installation fee per camera</p><div class="fee"><span class="when">2019–23 contracts</span><span class="bar"><span style="width:${(350 / 1250 * 100).toFixed(1)}%"></span></span><span class="v">$250–$350</span></div><div class="fee is-now"><span class="when">2026 fee schedule</span><span class="bar"><span style="width:100%"></span></span><span class="v">$1,000–$1,250</span></div></div>`;
  const table = dataTable(["Date", "Price per camera per year", "Record"], POINTS.map((p) => [p.date, p.price, p.what]).concat([["2021–2023", "$2,000 to $2,500", "Council agreements and reporting"], ["Jan. 1, 2024", "$3,000", "List price, up $500 (Grafton, Mass., staff report)"]]) as (string | number)[][], { text: [2] });
  return frame("price", cfg, ctx, draw(600, false) + draw(360, true) + fees, { table });
}

interface Contract { who: string; total: number; years: number; approved: string; note: string; upTo?: boolean }
const CONTRACTS: Contract[] = [
  { who: "Dallas", total: 5_700_000, years: 3, approved: "May 2025", note: "$1.7 million from a state grant" },
  { who: "Houston", total: 6_400_000, years: 5, approved: "Aug. 2022", note: "318 cameras", upTo: true },
  { who: "Johnson City, Tenn.", total: 8_063_000, years: 10, approved: "July 2025", note: "with video cameras and gunshot detection" },
  { who: "Smyrna, Ga.", total: 5_700_000, years: 10, approved: "Dec. 2025", note: "with video cameras and drones" },
  { who: "Huntington, W.Va.", total: 2_100_000, years: 5, approved: "July 2026", note: "with video cameras, drones, gunshot detection" },
  { who: "Rhode Island State Police", total: 597_000, years: 3, approved: "July 2026", note: "39 cameras" },
];
const money = (n: number) => (n >= 1e6 ? `$${(Math.round(n / 1e5) / 10).toString()} million` : `$${int(Math.round(n / 1000) * 1000)}`);

export function contractsFigure(cfg: FigureCfg, ctx: Ctx): string {
  const rows = CONTRACTS.map((c) => ({ ...c, perYear: c.total / c.years })).sort((a, b) => b.perYear - a.perYear);
  const max = rows[0]!.perYear;
  const draw = (W: number, narrow: boolean) => {
    const L = narrow ? 0 : 252, R = narrow ? 8 : 12, T = 6, rowH = narrow ? 52 : 42, barH = 12;
    const x = linScale(0, max * (narrow ? 1.6 : 1.45), L, W - R);
    let out = "";
    rows.forEach((r, i) => {
      const y = T + i * rowH;
      const by = narrow ? y + 20 : y + 6;
      const name = text(narrow ? 0 : L - 10, narrow ? y + 13 : y + 16, r.who, { "text-anchor": narrow ? "start" : "end", "font-size": 13, "font-weight": 700, fill: "var(--ink)" });
      const sub = text(narrow ? 0 : L - 10, narrow ? by + barH + 14 : y + 31, `${money(r.total)} over ${r.years} years, ${r.approved}`, { "text-anchor": narrow ? "start" : "end", "font-size": 11.5, fill: "var(--ink-3)" });
      const v = label(x(r.perYear) + 6, by + 10, `${r.upTo ? "up to " : ""}${money(r.perYear)} a year`, { "font-size": 12.5, "font-weight": 600, fill: "var(--ink)" });
      out += tip(rect(0, y, W, rowH, { fill: "transparent" }) + name + hbar(x(0), by, x(r.perYear) - x(0), barH, 3, { class: "mark c-ctx" }) + v + (narrow ? sub : sub), `${r.upTo ? "up to " : ""}${money(r.perYear)} a year`, `${r.who}: ${money(r.total)} over ${r.years} years (${r.note})`);
    });
    out += line(x(0), T, x(0), T + rows.length * rowH - 6, { class: "baseline" });
    return svg(W, T + rows.length * rowH, out, { cls: narrow ? "v-narrow" : "v-wide", label: "Bar chart of the largest documented Flock contracts per year: Dallas about $1.9 million a year, then Houston, Johnson City, Smyrna, Huntington and the Rhode Island State Police." });
  };
  const table = dataTable(["Agency", "Contract value", "Term", "Approved", "Notes"], [
    ...CONTRACTS.map((c) => [c.who, `${c.upTo ? "Up to " : ""}${money(c.total)}`, `${c.years} years`, c.approved, c.note]),
    ["Texas Department of Public Safety", "$26 million", "not stated", "2025", "state roads; 206 partner agencies"],
    ["El Paso", "$702,500 state grant", "from May 2025", "2025", "about 150 cameras; halted after Aug. 27, 2026"],
    ["Oklahoma City", "about $270,000", "renewal", "Aug. 18, 2026", "90 cameras"],
  ], { text: [1, 2, 3, 4] });
  return frame("contracts", cfg, ctx, draw(600, false) + draw(360, true), { table });
}
