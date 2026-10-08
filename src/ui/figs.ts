/**
 * Figures for the reference pages, drawn in the browser with the same string helpers and frame as the home page
 * story, so every chart on the site shares one look: mapped cameras by city and the Texas funding and Dallas
 * figures on Deployments, fees then and now on Economics, and the verdict index on Claims.
 */
import { sources } from "../content";
import { ROOT } from "../lib/base";
import { escape } from "../lib/escape";
import { apState, int } from "../viz/format";
import { g, line, rect, svg, text, label, hbar, tip, linScale, niceTicks, circle } from "../viz/svg";
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

/** Texas: the $1 fee, the grants, the cameras and the governor's order; Dallas's planned switch-off as 684 squares. */
export function texasFigure(width: number): string {
  const flow = `<ol class="flow">
<li><span class="n">$1</span><span class="t">added to each Texas auto insurance policy by a 2023 law, for the state’s Motor Vehicle Crime Prevention Authority</span></li>
<li><span class="n">$30 million</span><span class="t">or more in the authority’s grants for Flock cameras</span></li>
<li><span class="n">3,200</span><span class="t">Flock cameras or more installed with its help since 2023</span></li>
<li class="is-stop"><span class="n">Aug. 27, 2026</span><span class="t">The governor orders state agencies to stop paying for Flock cameras</span></li>
</ol>`;
  const f1 = frame("texas", cfg("Texas paid for cameras with a $1 insurance fee, then stopped", "How state money reached local Flock networks, as The Texas Tribune reported it", ["texastribune-abbott-2026", "texastribune-dps-2026"]), figCtx(), flow);
  // Dallas: 684 cameras, 321 to be switched off
  const cols = width < 520 ? 24 : 38, n = 684, off = 321, s = width < 520 ? 12 : 13, gap = 2;
  let sq = "";
  for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); sq += rect(c * (s + gap), r * (s + gap), s, s, { rx: 1.5, class: i < off ? "c-hi" : "c-ctx2" }); }
  const rows = Math.ceil(n / cols), W = cols * (s + gap) - gap, H = rows * (s + gap) - gap;
  const unit = svg(W, H, sq, { cls: "unit", label: "684 squares, one per Dallas camera; 321 of them are marked as the cameras the department said it would switch off." });
  const key = `<div class="unit-key"><span><i class="c-hi-bg"></i>321 to be switched off Sept. 15, 2026</span><span><i class="c-ctx2-bg"></i>363 to stay in operation</span></div>`;
  const f2 = frame("dallas", cfg("Dallas said it would switch off 321 of its 684 cameras", "Each square is one camera on the department’s transparency portal", ["govtech-dallas-2026"], ["After the governor’s order. Nearly $1.7 million of the city’s three-year, $5.7 million contract came from the state authority’s grant; the report does not say which cameras that money paid for."]), figCtx(), unit + key);
  return f1 + f2;
}

interface Fee { item: string; then: string; now: string; sources: string[] }
const money = (s: string) => { const m = s.replace(/,/g, "").match(/\$(\d+)/g); return m ? m.map((v) => Number(v.slice(1))) : []; };
/** Each fee with a dollar figure both then and now, as a dot pair: the earlier figure hollow, the 2026 one filled. */
export function feesFigure(fees: Fee[], width: number): string {
  const rows = fees.map((f) => ({ f, a: money(f.then), b: money(f.now) })).filter((r) => r.a.length && r.b.length);
  const W = Math.max(300, Math.min(width, 680)), narrow = W < 520;
  const L = narrow ? 128 : 220, R = 70, T = 26, rowH = narrow ? 34 : 28;
  const max = 1250, x = linScale(0, max, L, W - R);
  let out = g([0, 250, 500, 750, 1000, 1250].map((t) => line(x(t), T - 4, x(t), T + rows.length * rowH)).join(""), { class: "grid" });
  out += g([0, 500, 1000].map((t) => text(x(t), T - 10, `$${int(t)}`, { "text-anchor": "middle" })).join(""), { class: "axis" });
  rows.forEach(({ f, a, b }, i) => {
    const y = T + i * rowH + rowH / 2, a0 = Math.min(...a), a1 = Math.max(...a), b0 = b[0]!;
    const name = f.item.replace(", standard", "").replace(" after vandalism, theft or damage", "");
    const nameLines = narrow && name.length > 20 ? [name.slice(0, name.lastIndexOf(" ", 20)), name.slice(name.lastIndexOf(" ", 20) + 1)] : [name];
    let lab = "";
    nameLines.forEach((t, k) => { lab += text(L - 10, y + 4 + (k - (nameLines.length - 1) / 2) * 13, t, { "text-anchor": "end", "font-size": 12, fill: "var(--ink-2)" }); });
    const range = a1 > a0 ? line(x(a0), y, x(a1), y, { stroke: "var(--ink)", "stroke-width": 3, "stroke-linecap": "round" }) : "";
    out += tip(rect(0, y - rowH / 2, W, rowH, { fill: "transparent" }) + lab + line(x(a1), y, x(b0), y, { stroke: "var(--rule-2)", "stroke-width": 2 }) + range + circle(x(a0), y, 5, { fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 }) + (a1 > a0 ? circle(x(a1), y, 5, { fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 }) : "") + circle(x(b0), y, 5.5, { class: "mark c-hi", stroke: "#fff", "stroke-width": 1.5 }) + label(x(b0) + 9, y + 4, `$${int(b0)}`, { "font-size": 12, "font-weight": 700, fill: "var(--ink)" }), `${f.then} → ${f.now}`, f.item);
  });
  const lg = T + rows.length * rowH + 18;
  out += circle(L + 4, lg - 4, 5, { fill: "#fff", stroke: "var(--ink)", "stroke-width": 2 }) + text(L + 14, lg, "2019–23 contracts", { "font-size": 12 }) + circle(L + 140, lg - 4, 5.5, { class: "c-hi" }) + text(L + 150, lg, "2026 fee schedule", { "font-size": 12 });
  const body = svg(W, lg + 8, out, { label: "Dot pairs comparing installation and service fees in 2019 to 2023 contracts with Flock's 2026 fee schedule; each rose, the standard installation fee from $250 to $350 to $1,000." });
  const srcs = [...new Set(rows.flatMap((r) => r.f.sources))];
  return frame("fees", cfg("Installation and service fees rose under the 2026 schedule", "Fees per camera in 2019–23 contracts and Flock’s 2026 schedule", srcs, ["Where an earlier contract gave a range, the line spans it. Fees without an earlier figure are in the table below."]), figCtx(), body);
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
