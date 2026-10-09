/** What it costs: documented prices per camera over time with the one documented list-price change, and the largest
 *  documented contracts per year. */
import { ap, apDate, int } from "../../viz/format.ts";
import { circle, g, line, path, rect, svg, text, label, hbar, tip, linScale, textWidth, WIDE, NARROW } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";

/** Decimal year of an ISO date. */
const yr = (iso: string) => { const [y, m = 1, d = 1] = iso.split("-").map(Number); return y! + (m - 1) / 12 + (d - 1) / 365; };
interface PricePoint { date: string; price: number; what: string; kind: "list" | "contract" }
/** Greenville's 2019 pilot (11 cameras for $2,000 a year in all, $182 a camera) is in the note and the table, not
 *  on the chart: a pilot price would read as a sixteenfold rise. */
const GREENVILLE = { date: "2019-12", price: 182, what: "Greenville, S.C., pilot: 11 cameras for $2,000 a year in all", kind: "contract" as const };
const POINTS: PricePoint[] = [
  { date: "2022-09", price: 2500, what: "Richland, Wash., order form: 10 cameras", kind: "contract" },
  { date: "2023-10", price: 2500, what: "Indio, Calif.: $2,500 offered for a five-year term", kind: "contract" },
  { date: "2024-04", price: 2500, what: "Greenville renewal, 50 cameras", kind: "contract" },
  { date: "2024-05", price: 3000, what: "Virginia Sheriffs’ Association catalog list price", kind: "list" },
  { date: "2025-06", price: 3000, what: "Park Ridge, Ill., invoice", kind: "contract" },
];

export function priceFigure(cfg: FigureCfg, ctx: Ctx): string {
  const draw = (W: number, narrow: boolean) => {
    const L = narrow ? 50 : 54, R = narrow ? 10 : 16, T = 18, PH = narrow ? 200 : 230;
    const x = linScale(2022, 2027, L, W - R), y = linScale(0, 3500, T + PH, T);
    let out = "";
    // grid and axes
    out += g([0, 1000, 2000, 3000].map((v) => line(L, y(v), W - R, y(v))).join(""), { class: "grid" });
    out += g([0, 1000, 2000, 3000].map((v) => text(L - 6, y(v) + 4, v === 0 ? "$0" : `$${int(v)}`, { "text-anchor": "end" })).join(""), { class: "axis" });
    out += g([2022, 2023, 2024, 2025, 2026].map((v) => text(x(v + 0.5), T + PH + 16, narrow ? `’${String(v).slice(2)}` : String(v), { "text-anchor": "middle" })).join(""), { class: "axis" });
    out += line(L, y(0) + 0.5, W - R, y(0) + 0.5, { class: "baseline" });
    // a tick at each new year, so the Jan. 1, 2024, step lines up with the start of 2024
    out += g([2022, 2023, 2024, 2025, 2026, 2027].map((v) => line(x(v), y(0) + 0.5, x(v), y(0) + 8, { stroke: "var(--ink-2)", "stroke-width": 1 })).join(""));
    // the documented change on Jan. 1, 2024: a step in the list price
    const s0 = x(yr("2022-09")), s1 = x(2024), s2 = x(2027);
    out += path(`M${s0} ${y(2500)} H${s1} V${y(3000)} H${s2}`, { fill: "none", stroke: "var(--amber-mark)", "stroke-width": 2.5, "stroke-linejoin": "round" });
    out += label(narrow ? W - R : s1 + 6, y(3000) - 9, narrow ? "$3,000 list price since Jan. 1, 2024" : "List price $3,000 since Jan. 1, 2024", { "font-size": 12, "font-weight": 700, fill: "var(--ink)", "text-anchor": narrow ? "end" : "start" });
    // documented prices
    for (const p of POINTS) {
      const cx = x(yr(p.date)), cy = y(p.price);
      out += tip(circle(cx, cy, 12, { fill: "transparent" }) + circle(cx, cy, 4.5, p.kind === "list" ? { fill: "var(--ink)", stroke: "#fff", "stroke-width": 2 } : { fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 }), `$${int(p.price)} a camera per year`, p.what);
    }
    // legend
    const lg = narrow ? T + PH + 34 : T + PH + 36;
    out += circle(L + 4, lg - 4, 4.5, { fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 }) + text(L + 14, lg, "Contract or invoice", { "font-size": 12 });
    out += circle(L + (narrow ? 140 : 160), lg - 4, 4.5, { fill: "var(--ink)" }) + text(L + (narrow ? 150 : 170), lg, "Price list", { "font-size": 12 });
    return svg(W, lg + 8, out, { cls: narrow ? "v-narrow" : "v-wide", label: "Chart of the annual price per Flock camera from 2022 to 2026: $2,500 in contracts and quotes from 2022 and 2023, and a list price of $3,000 since Jan. 1, 2024." });
  };
  const table = dataTable(["Date", "Price per camera per year", "Record"], [GREENVILLE, ...POINTS].map((p) => [apDate(p.date), p.price, p.what]).concat([["Jan. 1, 2024", "$3,000", "List price, up $500 (Grafton, Wis., village memo)"]]) as (string | number)[][], { text: [2] });
  return frame("price", cfg, ctx, draw(WIDE, false) + draw(NARROW, true), { table });
}

interface Contract { who: string; total: number; years: number; approved: string; note: string; upTo?: boolean }
const CONTRACTS: Contract[] = [
  { who: "Dallas", total: 5_700_000, years: 3, approved: "May 2025", note: "$1.7 million from a state grant" },
  { who: "Houston", total: 6_400_000, years: 5, approved: "August 2022", note: "318 cameras", upTo: true },
  { who: "Johnson City, Tenn.", total: 8_063_000, years: 10, approved: "July 2025", note: "with video cameras and gunshot detection" },
  { who: "Smyrna, Ga.", total: 5_700_000, years: 10, approved: "December 2025", note: "75 more plate readers and two drones" },
  { who: "Huntington, W.Va.", total: 2_100_000, years: 5, approved: "July 2026", note: "with video cameras, drones, gunshot detection" },
  { who: "Rhode Island State Police", total: 597_000, years: 3, approved: "reported July 2026", note: "39 cameras" },
];
const money = (n: number) => (n >= 1e6 ? `$${(Math.round(n / 1e5) / 10).toString()} million` : `$${int(Math.round(n / 1000) * 1000)}`);

export function contractsFigure(cfg: FigureCfg, ctx: Ctx): string {
  const rows = CONTRACTS.map((c) => ({ ...c, perYear: c.total / c.years })).sort((a, b) => b.perYear - a.perYear);
  const max = rows[0]!.perYear;
  const draw = (W: number, narrow: boolean) => {
    const L = narrow ? 0 : 262, R = narrow ? 8 : 12, T = 6, barH = 12, fs = narrow ? 12 : 11.5;
    const x = linScale(0, max * (narrow ? 1.6 : 1.45), L, W - R);
    // the term line breaks before the date when the label column is too narrow for it
    const termOf = (r: (typeof rows)[number]) => `${r.upTo ? "Up to " : ""}${money(r.total)} over ${ap(r.years)} years`;
    const lines = rows.map((r) => (narrow || textWidth(`${termOf(r)}, ${r.approved}`, fs) <= L - 16 ? [`${termOf(r)}, ${r.approved}`] : [`${termOf(r)},`, r.approved]));
    const heights = lines.map((ls) => (narrow ? 52 : 28 + ls.length * 14));
    let out = "", y = T;
    rows.forEach((r, i) => {
      const rowH = heights[i]!, by = narrow ? y + 20 : y + 6;
      const name = text(narrow ? 0 : L - 10, narrow ? y + 13 : y + 16, r.who, { "text-anchor": narrow ? "start" : "end", "font-size": 13, "font-weight": 700, fill: "var(--ink)" });
      const sub = lines[i]!.map((l, k) => text(narrow ? 0 : L - 10, (narrow ? by + barH + 14 : y + 31) + k * 14, l, { "text-anchor": narrow ? "start" : "end", "font-size": fs, fill: "var(--ink-3)" })).join("");
      const v = label(x(r.perYear) + 6, by + 10, `${r.upTo ? "up to " : ""}${money(r.perYear)} a year`, { "font-size": 12.5, "font-weight": 600, fill: "var(--ink)" });
      // a ceiling is drawn as an outline; the contract the title names is the highlighted bar
      const bar = r.upTo
        ? rect(x(0) + 0.75, by + 0.75, x(r.perYear) - x(0) - 1.5, barH - 1.5, { rx: 2.5, fill: "#fff", stroke: "var(--ink-3)", "stroke-width": 1.5 })
        : hbar(x(0), by, x(r.perYear) - x(0), barH, 3, { class: i === 0 ? "mark c-hi" : "mark c-ctx" });
      out += tip(rect(0, y, W, rowH, { fill: "transparent" }) + name + bar + v + sub, `${r.upTo ? "up to " : ""}${money(r.perYear)} a year`, `${r.who}: ${r.upTo ? "up to " : ""}${money(r.total)} over ${r.years} years (${r.note})`);
      y += rowH;
    });
    if (!narrow) out += line(x(0), T, x(0), y - 6, { class: "baseline" });
    return svg(W, y, out, { cls: narrow ? "v-narrow" : "v-wide", label: "Bar chart of the largest documented Flock contracts with a known term, per year: Dallas about $1.9 million a year, then Houston (a ceiling), Johnson City, Smyrna, Huntington and the Rhode Island State Police." });
  };
  const table = dataTable(["Agency", "Contract value", "Term", "Date", "Notes"], [
    ...CONTRACTS.map((c) => [c.who, `${c.upTo ? "Up to " : ""}${money(c.total)}`, `${ap(c.years)} years`, c.approved, c.note]),
    ["Texas Department of Public Safety", "$26 million", "not stated", "2025", "state roads; not charted because its term was not reported"],
    ["El Paso", "$702,500 state grant", "from May 2025", "2025", "about 150 cameras; use halted after Aug. 27, 2026, and the council later voted to remove them"],
    ["Oklahoma City", "about $270,000", "not stated", "Aug. 18, 2026", "approved 5 to 3"],
    ["Greenville, S.C.", "$2,000 a year", "pilot", "December 2019", "11 cameras"],
  ], { text: [1, 2, 3, 4] });
  return frame("contracts", cfg, ctx, draw(WIDE, false) + draw(NARROW, true), { table });
}
