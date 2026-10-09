/**
 * Figures for the reference pages, drawn with the same string helpers and frame as the home page story so every chart
 * on the site shares one look: mapped cameras by city, Texas's funding and Dallas's cameras, the fees for changes
 * after installation, and the claims index. Pure functions: rendered into the page at build time, or in the browser.
 */
import { escape } from "../../lib/escape.ts";
import { int, placeName } from "../../viz/format.ts";
import { g, line, rect, svg, text, label, hbar, tip, linScale, niceTicks, textWidth, WIDE, NARROW } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";

const cfg = (title: string, sub: string, srcs: string[], notes: string[] = []): FigureCfg => ({ title, sub, notes, sources: srcs });

export interface City { name: string; usps: string; flock: number; pop?: number | null; per100k?: number | null }
/** Mapped Flock cameras inside city limits: the 15 largest counts as bars, each with the number per 100,000 residents
 *  in a column at the right; all 25 in the data table. */
export function citiesFigure(rows: City[], snapshot: string, ctx: Ctx, o: { level?: 2 | 3 } = {}): string {
  const list = rows.slice(0, 15), max = list[0]!.flock;
  const rate = (c: City) => (c.per100k == null ? "" : String(Math.round(c.per100k)));
  const draw = (W: number, narrow: boolean) => {
    const L = narrow ? 118 : 168, R = narrow ? 40 : 56, RW = narrow ? 44 : 72, T = 22, rowH = 24, barH = 11;
    const x = linScale(0, max * 1.02, L, W - R - RW);
    const ticks = niceTicks(max, narrow ? 3 : 4).filter((t) => t <= max);
    let out = g(ticks.map((t) => line(x(t), T - 4, x(t), T + list.length * rowH)).join(""), { class: "grid" });
    out += g(ticks.map((t) => text(x(t), T - 9, int(t), { "text-anchor": "middle" })).join(""), { class: "axis" });
    // the rate column: cameras per 100,000 residents, for the scale of each city
    out += text(W - 2, T - 9, narrow ? "Per 100,000" : "Per 100,000 residents", { "text-anchor": "end", "font-size": 12, fill: "var(--ink-3)" });
    list.forEach((c, i) => {
      const y = T + i * rowH, hi = i === 0;
      out += tip(rect(0, y, W, rowH, { fill: "transparent" }) + text(L - 8, y + rowH / 2 + 4, placeName(c.name, c.usps), { "text-anchor": "end", "font-size": 12.5, "font-weight": hi ? 700 : 400, fill: hi ? "var(--ink)" : "var(--ink-2)" }) + hbar(x(0), y + (rowH - barH) / 2, x(c.flock) - x(0), barH, 3, { class: `mark ${hi ? "c-hi" : "c-ctx"}` }) + label(x(c.flock) + 5, y + rowH / 2 + 4, int(c.flock), { "font-size": 12, "font-weight": hi ? 700 : 500, fill: "var(--ink)" }) + text(W - 2, y + rowH / 2 + 4, rate(c), { "text-anchor": "end", "font-size": 12, fill: "var(--ink-2)", "font-variant-numeric": "tabular-nums" }), `${int(c.flock)} mapped Flock cameras${c.per100k == null ? "" : `, ${rate(c)} per 100,000 residents`}`, placeName(c.name, c.usps));
    });
    out += line(x(0), T - 4, x(0), T + list.length * rowH, { class: "baseline" });
    return svg(W, T + list.length * rowH + 4, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Bar chart of mapped Flock cameras inside city limits: ${list[0]!.name} has the most, ${int(max)}.` });
  };
  const table = dataTable(["City", "Mapped Flock cameras", "Population, 2024", "Per 100,000 residents"], rows.map((c) => [placeName(c.name, c.usps), c.flock, c.pop ?? null, c.per100k ?? null]), { caption: "Mapped Flock cameras inside city limits" });
  // the cities in the table with more cameras per resident than the one with the most cameras
  const denser = rows.filter((c) => c.per100k != null && list[0]!.per100k != null && c.per100k > list[0]!.per100k).sort((a, b) => b.per100k! - a.per100k!);
  // the takeaway the headline does not already give: how far ahead the first city is
  const ratio = list[0]!.flock / list[1]!.flock;
  const title = ratio >= 2 ? `${list[0]!.name} has more than twice as many mapped Flock cameras as any other city` : `${list[0]!.name} has the most mapped Flock cameras of any city`;
  const per = denser.length ? `Among the ${rows.length} cities in the table, ${denser.map((c) => c.name).slice(0, -1).join(", ")}${denser.length > 1 ? " and " : ""}${denser[denser.length - 1]!.name} have more mapped Flock cameras per resident than ${list[0]!.name}. ` : "";
  return frame("cities", cfg(title, `Flock cameras mapped inside city limits as of ${snapshot}: the 15 largest counts, and the number per 100,000 residents`, ["deflock-tiles-2026", "census-boundaries-2024", "census-places-pop-2024"], [`${per}Counts are inside each city’s 2024 Census boundary, and population is the Census Bureau’s estimate for 2024. Mapped counts include cameras run by businesses, homeowner groups and state police inside city limits, and miss any camera no volunteer has tagged.`]), ctx, draw(WIDE, false) + draw(NARROW, true), { table, level: o.level });
}

/** Texas: the $1 fee, the grants, the cameras, the governor's order and the switch-offs; Dallas's 684 cameras as squares. */
export function texasFigure(ctx: Ctx): string {
  const flow = `<ol class="flow">
<li><span class="n">$1</span><span class="t">added to each Texas auto insurance policy by a 2023 law, for the state’s Motor Vehicle Crime Prevention Authority</span></li>
<li><span class="n">$30 million</span><span class="t">or more in the authority’s grants and contracts for Flock cameras</span></li>
<li><span class="n">3,200</span><span class="t">Flock cameras or more installed with its help by state and local agencies since 2023</span></li>
<li class="is-stop"><span class="n">Aug. 27, 2026</span><span class="t">The governor orders state agencies to pause funding for Flock cameras</span></li>
<li class="is-stop"><span class="n">900</span><span class="t">cameras or more switched off by at least 14 cities and counties by late September, The Texas Tribune counted</span></li>
</ol>`;
  const f1 = frame("texas", cfg("Texas paid for cameras with a $1 insurance fee, then paused the money", "How state money reached state and local Flock networks, as The Texas Tribune reported it", ["texastribune-abbott-2026", "texastribune-dps-2026", "texastribune-unplugged-2026"]), ctx, flow);
  // Dallas: 684 cameras, 321 of them paid for by state grants
  const n = 684, off = 321;
  const unit = (narrow: boolean) => {
    const cols = narrow ? 30 : 38, s = narrow ? 9 : 13, gap = 2;
    let sq = "";
    for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); sq += rect(c * (s + gap), r * (s + gap), s, s, { rx: 1.5, class: i < off ? "c-hi" : "c-ctx2" }); }
    const rows = Math.ceil(n / cols), W = cols * (s + gap) - gap, H = rows * (s + gap) - gap;
    return svg(W, H, sq, { cls: `unit ${narrow ? "v-narrow" : "v-wide"}`, label: "684 squares, one per Dallas camera; 321 of them, nearly half, are marked as the cameras paid for by the state grant." });
  };
  const key = `<div class="unit-key"><span><i class="c-hi-bg"></i>321 paid for by the state grant</span><span><i class="c-ctx2-bg"></i>363 others</span></div>`;
  const f2 = frame("dallas", cfg("Nearly half of Dallas’s 684 cameras were paid for by the state grant Texas paused", "Each square is one camera on the department’s transparency portal", ["govtech-dallas-2025", "govtech-dallas-2026", "fox4-dallas-2026", "texastribune-reprieve-2026"], ["Nearly $1.7 million of the city’s three-year, $5.7 million contract came from the state authority’s grant. On Sept. 1, the department said it would switch off the 321 grant-funded cameras; on Sept. 30 it said they would stay on for at least 90 days, and The Texas Tribune reported that Flock had paused the city’s payments for them."]), ctx, unit(false) + unit(true) + key);
  return f1 + f2;
}

export interface Fee { item: string; now: string; sources: string[] }
const dollars = (v: string) => { const m = v.replace(/,/g, "").match(/\$(\d+)/); return m ? Number(m[1]) : null; };
/** Flock's 2026 schedule of fees for changes after installation, largest first. Rows priced per part (Flex) stay in
 *  the table. */
export function feesFigure(fees: Fee[], ctx: Ctx): string {
  // every row of the schedule in the table, the parts priced for the Falcon Flex included
  const table = dataTable(["Fee", "2026 schedule"], fees.map((f) => [f.item, f.now]), { text: [1], caption: "Flock’s 2026 fee schedule" });
  const rows = fees.map((f) => ({ f, v: dollars(f.now) })).filter((r) => r.v != null && !r.f.now.includes("/")).sort((a, b) => b.v! - a.v!) as { f: Fee; v: number }[];
  const draw = (W: number, narrow: boolean) => {
    const L = narrow ? 0 : 250, R = narrow ? 8 : 70, T = narrow ? 2 : 22, rowH = narrow ? 44 : 26, barH = 11;
    const x = linScale(0, 5000, L, W - R - (narrow ? 64 : 0));
    const ticks = [0, 1000, 2000, 3000, 4000, 5000];
    // on a phone the labels sit above the bars and every bar carries its value, so the grid would only cross the labels
    let out = narrow ? "" : g(ticks.map((t) => line(x(t), T - 4, x(t), T + rows.length * rowH)).join(""), { class: "grid" }) + g(ticks.map((t) => text(x(t), T - 9, `$${int(t)}`, { "text-anchor": "middle" })).join(""), { class: "axis" });
    const top = Math.max(...rows.map((r) => r.v));
    rows.forEach(({ f, v }, i) => {
      // the dearest fees, tied, are marked together
      const y = T + i * rowH, by = narrow ? y + 20 : y + (rowH - barH) / 2, hi = v === top;
      const plan = f.now.includes("$0 with") ? ", or $0 with the protection plan" : "";
      const short = f.item.replace(" after vandalism, theft or damage", "").replace(" or existing infrastructure", "");
      const name = text(narrow ? 0 : L - 10, narrow ? y + 14 : y + rowH / 2 + 4, short, { "text-anchor": narrow ? "start" : "end", "font-size": 12.5, "font-weight": hi ? 700 : 400, fill: hi ? "var(--ink)" : "var(--ink-2)" });
      out += tip(rect(0, y, W, rowH, { fill: "transparent" }) + name + hbar(x(0), by, x(v) - x(0), barH, 3, { class: `mark ${hi ? "c-hi" : "c-ctx"}` }) + label(x(v) + 6, by + barH - 1, `$${int(v)}${plan ? "*" : ""}`, { "font-size": 12, "font-weight": hi ? 700 : 600, fill: "var(--ink)" }), `$${int(v)}${plan}`, f.item);
    });
    if (!narrow) out += line(x(0), T - 4, x(0), T + rows.length * rowH, { class: "baseline" });
    return svg(W, T + rows.length * rowH + 6, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Bar chart of Flock's 2026 fees for changes after installation: moving a camera to an advanced pole, or replacing an advanced pole, costs $5,000, the most; installing a camera at the customer's request costs $1,000 to $1,250.` });
  };
  const srcs = [...new Set(rows.flatMap((r) => r.f.sources))];
  const lo = Math.min(...rows.map((r) => r.v)), hi = Math.max(...rows.map((r) => r.v));
  return frame("fees", cfg(`After the plan is agreed, changes and replacements cost $${int(lo)} to $${int(hi)} a camera`, "Flock’s 2026 fees per camera for changes a customer requests after the deployment plan is agreed, and for replacements after vandalism, theft or damage", srcs, ["* $0 for customers with Flock’s Camera Protection Plan, whose price is not published. The schedule does not say what makes a pole “advanced.”"]), ctx, draw(WIDE, false) + draw(NARROW, true), { table });
}

/** The Components page's parts explorer, framed like the story's figures: the 3D locator (or the assembled still) beside
 *  the parts grid, which the page script fills. */
export function partsFigure(n: number, sources: string[], ctx: Ctx, o: { level?: 2 | 3 } = {}): string {
  const body = `<div class="components">
<aside class="locator sheet" id="locator">
<div class="locator-fig"><canvas id="locator-canvas" aria-label="The assembled camera, see-through" hidden></canvas><img id="locator-img" alt="The assembled Falcon camera" hidden /></div>
<div class="locator-ui" id="locator-ui" hidden><div class="stage-row"><button type="button" class="chip" id="explode-prev" aria-label="Previous stage">‹</button><input id="explode-stage" type="range" min="0" max="5" value="0" step="1" aria-label="Explode stage" /><button type="button" class="chip" id="explode-next" aria-label="Next stage">›</button></div><p class="aim-readout" id="explode-readout"></p></div>
<p class="locator-note" id="locator-note">In place. The shell is drawn see-through; a selected part is framed on its own.</p>
</aside>
<div id="knolling" class="knolling"></div>
</div>`;
  return frame("parts", cfg("Optics at the front, then a computer and three radios", `The ${n} parts of the Falcon V2, numbered from the front of the case. Select one for its specification, part number and sources; on a desktop, the 3D view frames it and the slider pulls the parts apart.`, sources, ["Illustration. The 3D view and the part images are drawn from these records by scripts, not photographed; inside the case, positions and sizes are approximate."]), ctx, body, { level: o.level, cls: "parts" });
}

export interface Row { k: string; v: string; sources: string[] }
/** Flock's 2026 terms for customers: what changed, one line each, framed like a figure. */
export function termsFigure(rows: Row[], ctx: Ctx): string {
  const list = `<dl class="terms">${rows.map((r) => `<div class="terms-row"><dt>${escape(r.k)}</dt><dd>${escape(r.v)}.</dd></div>`).join("")}</dl>`;
  const srcs = [...new Set([...rows.flatMap((r) => r.sources), "flock-tc-update-2026", "flock-myths"])];
  return frame("terms", cfg("Flock’s 2026 terms no longer say it will not sell customer data", "What changed in Flock’s standard terms for customers in 2026, as Footnote 4a and the A.C.L.U. compared them with the earlier terms, and as contracts from 2023 give the earlier rules", srcs, ["Flock says it has never sold customer data and describes the February changes as a clarification of its definitions."]), ctx, list);
}

export interface Myth { id: string; claim: string; verdict: "false" | "true" | "nuanced" }
export const VERDICT = { false: "Not supported by the record", true: "Supported by the record", nuanced: "The record is mixed" } as const;
/** What each verdict means, as the Claims page's notes define it. */
export const VERDICT_DEF = {
  false: "The documents and records cited contradict the claim, or nothing in them supports it.",
  nuanced: "The record supports part of the claim, or the answer depends on the product, its settings or which evidence is weighed.",
  true: "The documents and records cited support the claim as stated.",
} as const;
/** The claims as a row of squares by verdict, each linked to its entry; every claim cites its own sources. */
export function verdictIndex(myths: Myth[], ctx: Ctx, o: { level?: 2 | 3 } = {}): string {
  const order = ["false", "nuanced", "true"] as const;
  const n = (v: Myth["verdict"]) => myths.filter((m) => m.verdict === v).length;
  const sq = (m: Myth, i: number) => `<a class="vi-sq v-${m.verdict}" href="#claim-${escape(m.id)}" title="${escape(`${String(i + 1).padStart(2, "0")} “${m.claim}”`)}"><span class="visually-hidden">${escape(`Claim ${i + 1}: “${m.claim}” ${VERDICT[m.verdict]}.`)}</span>${String(i + 1).padStart(2, "0")}</a>`;
  const rows = order.filter((v) => n(v) > 0).map((v) => `<div class="vi-row"><p class="vi-label"><b>${escape(VERDICT[v])}</b> <span class="vi-n">${n(v)}</span></p><div class="vi">${myths.map((m, i) => (m.verdict === v ? sq(m, i) : "")).join("")}</div></div>`).join("");
  // the largest group, stated plainly; the order of the rows does the rest
  const top = order.slice().sort((a, b) => n(b) - n(a))[0]!;
  const title = top === "false" ? `The record does not support ${n("false")} of the ${myths.length} claims` : top === "true" ? `The record supports ${n("true")} of the ${myths.length} claims` : `The record is mixed on ${n("nuanced")} of the ${myths.length} claims`;
  const sub = "Each square is one claim, numbered as in the list below; select one to read the entry.";
  return frame("verdicts", { title, sub, notes: [`“The record is mixed” means ${VERDICT_DEF.nuanced.charAt(0).toLowerCase()}${VERDICT_DEF.nuanced.slice(1)}`], sources: [] }, ctx, rows, { level: o.level, srcText: "Sources: listed with each claim.", cls: "verdicts" });
}

export interface SourceKind { kind: string }
/** The names of the four origins, shared by this chart and the Sources page's group heads. */
export const SOURCE_KINDS: Record<string, string> = { flock: "Flock Safety’s own documents", independent: "News reports, research and advocacy groups", government: "Government records", court: "Court rulings" };
const KINDS = ["independent", "flock", "government", "court"].map((kind) => ({ kind, label: SOURCE_KINDS[kind]! }));
const IN_TEN = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "all"];
/** A share as a reader says it: "one in five", "a third", "six in 10". */
function shareWords(p: number): string {
  const named: [number, string][] = [[1 / 2, "half"], [1 / 3, "a third"], [1 / 4, "one in four"], [1 / 5, "one in five"], [2 / 3, "two-thirds"], [3 / 4, "three in four"]];
  const tens = Math.round(p * 10), best = named.reduce((a, b) => (Math.abs(b[0] - p) < Math.abs(a[0] - p) ? b : a));
  return Math.abs(best[0] - p) <= Math.abs(tens / 10 - p) + 1e-9 ? best[1] : `${IN_TEN[tens]} in 10`;
}
/** The sources by origin: one bar each, Flock's own documents marked. */
export function originsFigure(sources: SourceKind[], ctx: Ctx, o: { level?: 2 | 3 } = {}): string {
  const rows = KINDS.map((k) => ({ ...k, n: sources.filter((s) => s.kind === k.kind).length })).filter((r) => r.n > 0);
  const total = sources.length, max = Math.max(...rows.map((r) => r.n));
  const draw = (W: number, narrow: boolean) => {
    // the label column is as wide as the longest label, so no name runs out of the drawing
    const T = 6, rowH = narrow ? 44 : 30, barH = 12, R = narrow ? 40 : 48;
    const L = narrow ? 0 : Math.ceil(Math.max(...rows.map((r) => textWidth(r.label, 12.5, r.kind === "flock" ? 700 : 400)))) + 14;
    const x = linScale(0, max, L, W - R);
    let out = "";
    rows.forEach((r, i) => {
      const y = T + i * rowH, hi = r.kind === "flock", by = narrow ? y + 20 : y + (rowH - barH) / 2;
      const name = text(narrow ? 0 : L - 10, narrow ? y + 14 : y + rowH / 2 + 4, r.label, { "text-anchor": narrow ? "start" : "end", "font-size": 12.5, "font-weight": hi ? 700 : 400, fill: hi ? "var(--ink)" : "var(--ink-2)" });
      out += tip(rect(0, y, W, rowH, { fill: "transparent" }) + name + hbar(x(0), by, x(r.n) - x(0), barH, 3, { class: `mark ${hi ? "c-hi" : "c-ctx"}` }) + label(x(r.n) + 6, by + barH - 1, int(r.n), { "font-size": 12, "font-weight": hi ? 700 : 600, fill: "var(--ink)" }), `${int(r.n)} of ${int(total)} sources`, r.label);
    });
    if (!narrow) out += line(x(0), T - 2, x(0), T + rows.length * rowH, { class: "baseline" });
    return svg(W, T + rows.length * rowH + 4, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Bar chart of the ${total} sources by origin: ${rows.map((r) => `${r.label}, ${r.n}`).join("; ")}.` });
  };
  const share = (k: string) => (rows.find((r) => r.kind === k)?.n ?? 0) / total;
  // the title names the marked bar: Flock's own share of what the site cites
  const title = `About ${shareWords(share("flock"))} of the sources ${/^(one|a) /.test(shareWords(share("flock"))) ? "is" : "are"} Flock’s own`;
  const table = dataTable(["Origin", "Sources"], rows.map((r) => [r.label, r.n]), { caption: "Sources by origin" });
  return frame("origins", { title, sub: `The ${total} documents this site cites, by who published them`, notes: ["News reports, research and advocacy groups include groups that campaign on the cameras, such as the A.C.L.U., the Electronic Frontier Foundation and DeFlock, and filings and statements by other companies. Each entry is counted by its publisher: a news report that quotes Flock or a government record counts as a news report."], sources: [] }, ctx, draw(WIDE, false) + draw(NARROW, true), { level: o.level, table, srcText: "Source: the list below." });
}
