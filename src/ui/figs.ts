/**
 * Figures for the reference pages, drawn in the browser with the same string helpers and frame as the home page
 * story, so every chart on the site shares one look: mapped cameras by city and the Texas funding and Dallas
 * figures on Deployments, fees then and now on Economics, and the verdict index on Claims.
 */
import { sources } from "../content";
import { ROOT } from "../lib/base";
import { escape } from "../lib/escape";
import { apState, int } from "../viz/format";
import { g, line, rect, svg, text, label, hbar, tip, linScale, niceTicks } from "../viz/svg";
import { frame, type Ctx } from "../story/frame";
import type { FigureCfg } from "../story/schema";

/** A frame context for figures drawn in the browser: sources come from the site content. */
export function figCtx(): Ctx {
  return { root: ROOT, sources: new Map(sources.map((s) => [s.id, s])), stats: {}, completeness: [], used: new Set() };
}
const cfg = (title: string, sub: string, srcs: string[], notes: string[] = []): FigureCfg => ({ title, sub, notes, sources: srcs });

interface City { name: string; usps: string; flock: number }
/** Mapped Flock cameras inside city limits, the largest counts, drawn at the column's width. */
export function citiesFigure(rows: City[], snapshot: string, width: number): string {
  const list = rows.slice(0, 15), max = list[0]!.flock;
  const W = Math.max(300, Math.min(width, 720)), narrow = W < 520;
  const L = narrow ? 118 : 168, R = narrow ? 44 : 56, T = 22, rowH = 24, barH = 11;
  const x = linScale(0, max * 1.02, L, W - R);
  const ticks = niceTicks(max, narrow ? 3 : 4).filter((t) => t <= max);
  let out = g(ticks.map((t) => line(x(t), T - 4, x(t), T + list.length * rowH)).join(""), { class: "grid" });
  out += g(ticks.map((t) => text(x(t), T - 9, int(t), { "text-anchor": "middle" })).join(""), { class: "axis" });
  list.forEach((c, i) => {
    const y = T + i * rowH, hi = i === 0;
    out += tip(rect(0, y, W, rowH, { fill: "transparent" }) + text(L - 8, y + rowH / 2 + 4, `${c.name}, ${apState(c.usps)}`, { "text-anchor": "end", "font-size": 12.5, "font-weight": hi ? 700 : 400, fill: hi ? "var(--ink)" : "var(--ink-2)" }) + hbar(x(0), y + (rowH - barH) / 2, x(c.flock) - x(0), barH, 3, { class: `mark ${hi ? "c-hi" : "c-ctx"}` }) + label(x(c.flock) + 5, y + rowH / 2 + 4, int(c.flock), { "font-size": 12, "font-weight": hi ? 700 : 500, fill: "var(--ink)" }), `${int(c.flock)} mapped Flock cameras`, `${c.name}, ${apState(c.usps)}`);
  });
  out += line(x(0), T - 4, x(0), T + list.length * rowH, { class: "baseline" });
  const body = svg(W, T + list.length * rowH + 4, out, { label: `Bar chart of mapped Flock cameras inside city limits: ${list[0]!.name} has the most, ${int(max)}.` });
  return frame("cities", cfg(`${list[0]!.name} has the most mapped Flock cameras of any city`, `Flock cameras mapped inside city limits as of ${snapshot}, the 15 largest counts`, ["deflock-tiles-2026", "census-boundaries-2024"], ["Inside each city’s 2024 Census boundary. Mapped counts include cameras run by businesses, homeowner groups and state police inside city limits, and miss any camera no volunteer has tagged."]), figCtx(), body);
}

/** Texas: the $1 fee, the grants, the cameras, the governor's order and the switch-offs; Dallas's 684 cameras as squares. */
export function texasFigure(width: number): string {
  const flow = `<ol class="flow">
<li><span class="n">$1</span><span class="t">added to each Texas auto insurance policy by a 2023 law, for the state’s Motor Vehicle Crime Prevention Authority</span></li>
<li><span class="n">$30 million</span><span class="t">or more in the authority’s grants and contracts for Flock cameras</span></li>
<li><span class="n">3,200</span><span class="t">Flock cameras or more installed with its help by state and local agencies since 2023</span></li>
<li class="is-stop"><span class="n">Aug. 27, 2026</span><span class="t">The governor orders state agencies to pause funding for Flock cameras</span></li>
<li class="is-stop"><span class="n">900</span><span class="t">cameras or more switched off by at least 14 cities and counties by late September, The Texas Tribune counted</span></li>
</ol>`;
  const f1 = frame("texas", cfg("Texas paid for cameras with a $1 insurance fee, then paused the money", "How state money reached state and local Flock networks, as The Texas Tribune reported it", ["texastribune-abbott-2026", "texastribune-dps-2026", "texastribune-unplugged-2026"]), figCtx(), flow);
  // Dallas: 684 cameras, 321 of them paid for by state grants
  const cols = width < 520 ? 24 : 38, n = 684, off = 321, s = width < 520 ? 12 : 13, gap = 2;
  let sq = "";
  for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); sq += rect(c * (s + gap), r * (s + gap), s, s, { rx: 1.5, class: i < off ? "c-hi" : "c-ctx2" }); }
  const rows = Math.ceil(n / cols), W = cols * (s + gap) - gap, H = rows * (s + gap) - gap;
  const unit = svg(W, H, sq, { cls: "unit", label: "684 squares, one per Dallas camera; 321 of them are marked as the cameras paid for by state grants, which the department planned to switch off in September and then kept on." });
  const key = `<div class="unit-key"><span><i class="c-hi-bg"></i>321 paid for by state grants: to be switched off, then kept on for at least 90 days</span><span><i class="c-ctx2-bg"></i>363 others</span></div>`;
  const f2 = frame("dallas", cfg("Dallas planned to switch off its 321 grant-funded cameras, then kept them on", "Each square is one camera on the department’s transparency portal", ["govtech-dallas-2026", "fox4-dallas-2026", "texastribune-reprieve-2026"], ["Nearly $1.7 million of the city’s three-year, $5.7 million contract came from the state authority’s grant. On Sept. 30 the department said the grant-funded cameras would stay on for at least 90 days; The Texas Tribune reported that Flock paused the city’s payments for them."]), figCtx(), unit + key);
  return f1 + f2;
}

interface Fee { item: string; now: string; sources: string[] }
const dollars = (v: string) => { const m = v.replace(/,/g, "").match(/\$(\d+)/); return m ? Number(m[1]) : null; };
/** Flock's 2026 schedule of fees for changes after installation, largest first. Rows priced per part (Flex) stay in
 *  the table. */
export function feesFigure(fees: Fee[], width: number): string {
  const rows = fees.map((f) => ({ f, v: dollars(f.now) })).filter((r) => r.v != null && !r.f.now.includes("/")).sort((a, b) => b.v! - a.v!) as { f: Fee; v: number }[];
  const W = Math.max(300, Math.min(width, 680)), narrow = W < 520;
  const L = narrow ? 0 : 250, R = narrow ? 8 : 70, T = 22, rowH = narrow ? 44 : 26, barH = 11;
  const x = linScale(0, 5000, L, W - R - (narrow ? 64 : 0));
  const ticks = [0, 1000, 2000, 3000, 4000, 5000];
  let out = g(ticks.map((t) => line(x(t), T - 4, x(t), T + rows.length * rowH)).join(""), { class: "grid" });
  out += g(ticks.filter((t) => !narrow || t % 2000 === 0 || t === 5000).map((t) => text(x(t), T - 9, `$${int(t)}`, { "text-anchor": t === 0 && narrow ? "start" : "middle" })).join(""), { class: "axis" });
  rows.forEach(({ f, v }, i) => {
    const y = T + i * rowH, by = narrow ? y + 20 : y + (rowH - barH) / 2, hi = i === 0;
    const plan = f.now.includes("$0 with") ? ", or $0 with the protection plan" : "";
    const short = f.item.replace(" after vandalism, theft or damage", "").replace(" or existing infrastructure", "");
    const name = text(narrow ? 0 : L - 10, narrow ? y + 14 : y + rowH / 2 + 4, short, { "text-anchor": narrow ? "start" : "end", "font-size": 12.5, "font-weight": hi ? 700 : 400, fill: hi ? "var(--ink)" : "var(--ink-2)" });
    out += tip(rect(0, y, W, rowH, { fill: "transparent" }) + name + hbar(x(0), by, x(v) - x(0), barH, 3, { class: `mark ${hi ? "c-hi" : "c-ctx"}` }) + label(x(v) + 6, by + barH - 1, `$${int(v)}${plan ? "*" : ""}`, { "font-size": 12, "font-weight": hi ? 700 : 600, fill: "var(--ink)" }), `$${int(v)}${plan}`, f.item);
  });
  out += line(x(0), T - 4, x(0), T + rows.length * rowH, { class: "baseline" });
  const body = svg(W, T + rows.length * rowH + 6, out, { label: `Bar chart of Flock's 2026 fees for changes after installation: moving a camera onto an advanced or DOT pole costs $5,000, the most; installing a camera at the customer's request costs $1,000 to $1,250.` });
  const srcs = [...new Set(rows.flatMap((r) => r.f.sources))];
  return frame("fees", cfg("Moving a camera onto a highway pole costs the most", "Flock’s 2026 fees per camera for changes a customer requests after the deployment plan is agreed, and for replacements", srcs, ["* $0 for customers with Flock’s Camera Protection Plan, whose price is not published."]), figCtx(), body);
}

interface Myth { id: string; claim: string; verdict: "false" | "true" | "nuanced" }
const VERDICT = { false: "Not supported by the record", true: "Supported by the record", nuanced: "Depends on the product or setting" } as const;
/** The claims as a row of squares by verdict, each linked to its entry. */
export function verdictIndex(myths: Myth[]): string {
  const counts = (["false", "nuanced", "true"] as const).map((v) => ({ v, n: myths.filter((m) => m.verdict === v).length }));
  const squares = myths.map((m, i) => `<a class="vi-sq v-${m.verdict}" href="#claim-${escape(m.id)}" title="${escape(`${String(i + 1).padStart(2, "0")} ${m.claim}`)}"><span class="visually-hidden">${escape(`Claim ${i + 1}: ${m.claim} — ${VERDICT[m.verdict]}`)}</span>${String(i + 1).padStart(2, "0")}</a>`).join("");
  const key = counts.map((c) => `<span class="vi-k"><i class="vi-sw v-${c.v}"></i>${VERDICT[c.v]}: <b>${c.n}</b></span>`).join("");
  return `<figure class="fig verdicts" id="fig-verdicts"><figcaption class="fig-head"><h3 class="fig-title">${counts.map((c) => `${c.n} ${c.v === "false" ? "not supported" : c.v === "true" ? "supported" : "depend on the setting"}`).join(", ")}</h3><p class="fig-sub">The ${myths.length} claims below, by what the documented record shows. Select a square to read the entry.</p></figcaption><div class="vi">${squares}</div><div class="vi-key">${key}</div></figure>`;
}
