/** Where the cameras are: states ranked by rate, and the county lookup with the distribution of county rates. */
import { escape } from "../../lib/escape.ts";
import { apState, dec1, int } from "../../viz/format.ts";
import { g, line, rect, svg, text, label, hbar, tip, linScale } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";
import type { StatesFile, CountyRow } from "../types.ts";

/** States by mapped Flock cameras per 100,000 residents: the 10 highest and the five lowest, with the rest in the table;
 *  the U.S. rate as a reference line. */
export function statesFigure(cfg: FigureCfg, ctx: Ctx, states: StatesFile): string {
  const rows = states.rows.filter((r) => r.usps !== "PR" && r.per100k != null).sort((a, b) => b.per100k! - a.per100k!);
  const top = rows.slice(0, 10), bottom = rows.slice(-5), mid = rows.slice(10, -5);
  const max = 90, ticks = [0, 20, 40, 60, 80];
  const draw = (W: number, narrow: boolean) => {
    const L = narrow ? 112 : 140, R = narrow ? 36 : 44, T = 56, rowH = narrow ? 24 : 22, barH = 10, fs = narrow ? 13 : 12.5, gapH = narrow ? 46 : 40;
    const H = T + (top.length + bottom.length) * rowH + gapH + 6;
    const x = linScale(0, max, L, W - R);
    const yOf = (i: number) => T + i * rowH + (i >= top.length ? gapH : 0);
    let out = "";
    out += g(ticks.map((t) => line(x(t), T - 6, x(t), H - 4)).join(""), { class: "grid" });
    out += g(ticks.map((t, i) => text(x(t), T - 12, String(t), { "text-anchor": i === 0 ? "start" : "middle" })).join(""), { class: "axis" });
    [...top, ...bottom].forEach((r, i) => {
      const y = yOf(i), hi = r.usps === "GA";
      const name = narrow && r.usps === "DC" ? "D.C." : r.name;
      const body = rect(0, y, W, rowH, { fill: "transparent" })
        + text(L - 8, y + rowH / 2 + fs * 0.35, name, { "text-anchor": "end", "font-size": fs, "font-weight": hi ? 700 : 400, fill: hi ? "var(--ink)" : "var(--ink-2)" })
        + hbar(x(0), y + (rowH - barH) / 2, x(r.per100k!) - x(0), barH, 1.5, { class: `mark ${hi ? "c-hi" : "c-ctx"}` })
        + label(x(r.per100k!) + 5, y + rowH / 2 + fs * 0.35, dec1(r.per100k!), { "font-size": fs - 0.5, "font-weight": hi ? 700 : 500, fill: "var(--ink)" });
      out += tip(body, `${dec1(r.per100k!)} per 100,000`, `${r.name}: ${int(r.flock)} mapped Flock cameras`, { class: "row" });
    });
    // the break between the highest and the lowest
    const by = yOf(top.length) - gapH / 2;
    out += line(0, by - 10, W, by - 10, { stroke: "var(--rule-2)", "stroke-dasharray": "2 3" }) + line(0, by + 10, W, by + 10, { stroke: "var(--rule-2)", "stroke-dasharray": "2 3" });
    out += label(narrow ? 0 : L, by + 4, `${mid.length} more, from ${mid[0]!.name} (${dec1(mid[0]!.per100k!)}) to ${mid[mid.length - 1]!.name} (${dec1(mid[mid.length - 1]!.per100k!)}), in the table`, { "font-size": fs - 1, "font-style": "italic", fill: "var(--ink-3)", "font-family": "var(--serif)" });
    // U.S. reference: a hairline from the top label down through the bars
    const ux = x(states.usRate);
    out += line(ux, T - 40, ux, H - 4, { stroke: "var(--ink)", "stroke-width": 1 });
    out += text(ux + 5, T - 32, `U.S. rate, ${dec1(states.usRate)}`, { "font-size": fs, "font-weight": 600, fill: "var(--ink)" });
    return svg(W, H, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Bar chart of mapped Flock cameras per 100,000 residents in the 10 highest and five lowest states. Georgia is highest at ${dec1(rows[0]!.per100k!)}; New Hampshire lowest at ${dec1(rows[rows.length - 1]!.per100k!)}; the U.S. rate is ${dec1(states.usRate)}.` });
  };
  const table = dataTable(["State", "Mapped Flock cameras", "Per 100,000 residents", "All mapped readers", "Population, 2024"], rows.map((r) => [r.name, r.flock, r.per100k, r.all, r.pop]), { caption: cfg.title });
  return frame("states", cfg, ctx, draw(600, false) + draw(360, true), { table });
}

/** Bins of county rates for the lookup's distribution: none mapped, then steps of 10 per 100,000 up to 300 and more. */
export function countyBins(counties: CountyRow[]): { lo: number; hi: number; n: number }[] {
  const us = counties.filter((c) => c[2] !== "PR" && c[6] != null);
  const bins: { lo: number; hi: number; n: number }[] = [{ lo: -1, hi: 0, n: 0 }];
  for (let lo = 0; lo < 300; lo += 10) bins.push({ lo, hi: lo + 10, n: 0 });
  bins.push({ lo: 300, hi: Infinity, n: 0 });
  for (const c of us) {
    const v = c[6]!;
    if (c[3] === 0) { bins[0]!.n++; continue; }
    const b = bins.find((b) => b.lo >= 0 && v >= b.lo && v < b.hi) ?? bins[bins.length - 1]!;
    b.n++;
  }
  return bins;
}
export const countyName = (c: CountyRow) => `${c[1]}, ${apState(c[2])}`;
/** Share of counties (50 states and D.C.) with a lower rate than this one, in percent. */
export function percentile(counties: CountyRow[], c: CountyRow): number {
  const us = counties.filter((x) => x[2] !== "PR" && x[6] != null);
  return Math.round(us.filter((x) => x[6]! < c[6]!).length / us.length * 100);
}
export function lookupCard(c: CountyRow, states: StatesFile, counties: CountyRow[]): string {
  const st = states.rows.find((r) => r.usps === c[2]);
  const pct = percentile(counties, c);
  const rate = c[6] == null ? "Population not available" : c[3] === 0 ? "None mapped" : `${dec1(c[6])} per 100,000 residents`;
  const rank = c[3] === 0 || c[6] == null ? "" : `, higher than in ${pct} percent of counties`;
  return `<p class="lk-name">${escape(countyName(c))}</p><p class="lk-big"><span class="n">${int(c[3])}</span> mapped Flock camera${c[3] === 1 ? "" : "s"}</p><p class="lk-rate">${escape(rate)}${rank}. ${st ? `${escape(st.name)}:&nbsp;${dec1(st.per100k ?? 0)}.` : ""} U.S.:&nbsp;${dec1(states.usRate)}.</p>`;
}
/** The histogram of county rates; the selected county is marked by the client (and for the default at build time). */
export function histogram(bins: { lo: number; hi: number; n: number }[], W: number, narrow: boolean, mark: number | null, markName = ""): string {
  const L = narrow ? 30 : 34, R = 8, T = 24, B = 30, H = narrow ? 160 : 170;
  const n = bins.length, gapNone = 10;
  const bw = (W - L - R - gapNone) / n;
  const maxN = Math.max(...bins.map((b) => b.n));
  const y = linScale(0, maxN, H - B, T);
  const xOf = (i: number) => L + i * bw + (i > 0 ? gapNone : 0);
  const yt = [0, 200, 400, 600, 800].filter((v) => v <= maxN);
  let out = g(yt.map((v) => line(L, y(v), W - R, y(v))).join(""), { class: "grid" }) + g(yt.map((v) => text(L - 5, y(v) + 4, String(v), { "text-anchor": "end" })).join(""), { class: "axis" });
  out += line(L, H - B + 0.5, W - R, H - B + 0.5, { class: "baseline" });
  bins.forEach((b, i) => {
    const h = H - B - y(b.n);
    const lbl = i === 0 ? "No cameras mapped" : b.hi === Infinity ? `${b.lo} or more per 100,000` : `${b.lo} to ${b.hi} per 100,000`;
    out += tip(rect(xOf(i), T - 4, bw, H - B - T + 4, { fill: "transparent" }) + rect(xOf(i) + 0.5, H - B - h, bw - 1, h, { class: `mark ${i === 0 ? "c-ink3" : "c-ctx"}`, "data-bin": i }), `${int(b.n)} counties`, lbl);
  });
  // axis: none, 0, 100, 200, 300+
  const xRate = (v: number) => xOf(1) + (v / 10) * bw;
  out += g([text(xOf(0), H - B + 15, "None", { "text-anchor": "start" }), ...[100, 200].map((v) => text(xRate(v), H - B + 15, String(v), { "text-anchor": "middle" })), text(xRate(300) + bw, H - B + 15, "300+", { "text-anchor": "end" })].join(""), { class: "axis" });
  out += text(W - R, H - 4, "Mapped Flock cameras per 100,000 residents", { "text-anchor": "end", class: "axis-title", "font-size": 11, fill: "var(--ink-3)" });
  out += text(L, 12, "Number of counties", { "font-size": 11, fill: "var(--ink-3)" });
  // the marker
  const mx = mark == null ? -100 : mark < 0 ? xOf(0) + bw / 2 : mark >= 300 ? xRate(300) + bw / 2 : xRate(mark);
  const right = mx > W * 0.62;
  out += g(line(0, T - 6, 0, H - B, { stroke: "var(--ink)", "stroke-width": 1.5 }) + `<circle cx="0" cy="${T - 6}" r="3.5" fill="var(--amber-mark)" stroke="#fff" stroke-width="1.5"/>` + label(right ? -7 : 7, T - 2, markName, { class: "lk-mark-t", "text-anchor": right ? "end" : "start", "font-size": 12, "font-weight": 700, fill: "var(--ink)" }), { class: "lk-mark", "data-w": W, transform: `translate(${Math.round(mx * 10) / 10},0)` });
  return svg(W, H, out, { cls: `lk-hist ${narrow ? "v-narrow" : "v-wide"}`, label: "Histogram of counties by mapped Flock cameras per 100,000 residents, with the selected county marked." });
}

export function lookupFigure(cfg: FigureCfg, ctx: Ctx, states: StatesFile, counties: CountyRow[]): string {
  const def = counties.find((c) => c[0] === "13121")!;
  const bins = countyBins(counties);
  const mark = def[3] === 0 ? -1 : def[6];
  const body = `<div class="lookup" data-default="${def[0]}">
<form class="lk-form" role="search" onsubmit="return false"><label for="county-q" class="visually-hidden">Find a county</label><div class="lk-box"><input id="county-q" type="search" autocomplete="off" spellcheck="false" placeholder="Type a county or state" value="${escape(countyName(def))}" role="combobox" aria-expanded="false" aria-controls="county-list" aria-autocomplete="list" disabled><ul id="county-list" class="lk-list" role="listbox" hidden></ul></div></form>
<div class="lk-card" aria-live="polite">${lookupCard(def, states, counties)}</div>
<div class="lk-dist">${histogram(bins, 600, false, mark, def[1])}${histogram(bins, 360, true, mark, def[1])}</div>
<noscript><p class="fig-note">Searching needs JavaScript; the full table is in the file of <a href="data/story/cameras-by-county.csv">cameras by county</a>.</p></noscript>
</div>`;
  return frame("lookup", cfg, ctx, body);
}
