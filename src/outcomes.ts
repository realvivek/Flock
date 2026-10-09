/**
 * The outcomes page: every public record that ties a Flock camera to a result, on six shared rungs, at the finest level
 * each source supports. Data comes from public/data/outcomes.json, built by scripts/outcomes/build.mjs; the camera
 * scatter for the map panels loads separately and only when a panel is on screen.
 */
import { z } from "zod";
import { cite, escape } from "./ui/cite";
import { el, initTableWraps } from "./ui/common";
import { BASE } from "./lib/base";
import { svg, g, line, text, label, circle, tip, logScale, rect, textWidth, WIDE, NARROW } from "./viz/svg";
import { tickWords, apState, apDate, apPeriod, placeName, ap, big, typeset } from "./viz/format";
import { figCtx, figureCfg } from "./ui/figs";
import { frame, dataTable, type Ctx } from "./story/frame";
import { errorsFigure } from "./story/fig/errors";
import { evidenceFigure } from "./story/fig/evidence";
import type { FigureCfg } from "./story/schema";
import { initTooltips } from "./viz/tooltip";
import { drawNational, drawCity, DEPTH_LABEL, type Ring } from "./outcomes-map";

const Values = z.object({ reads: z.number().nullable(), alerts: z.number().nullable(), falseAlerts: z.number().nullable(), stops: z.number().nullable(), recoveries: z.number().nullable(), arrests: z.number().nullable() });
const Match = z.object({ osmId: z.number(), brand: z.string().nullable(), distanceM: z.number(), lon: z.number(), lat: z.number() }).passthrough().nullable();
const Site = z.object({ id: z.string(), source: z.string(), level: z.string(), agency: z.string(), city: z.string(), state: z.string(), period: z.string(), label: z.string(), lon: z.number().nullable(), lat: z.number().nullable(), geocode: z.string(), match: Match, nearest: Match, values: Values, extra: z.record(z.string(), z.unknown()).optional(), sources: z.array(z.string()), quadrant: z.string().optional(), mobile: z.boolean().optional(), cameras: z.number().optional(), placedAtCamera: z.boolean().optional(), inCar: z.boolean().optional() });
const File = z.object({
  generated: z.string(),
  cameras: z.object({ total: z.number(), flock: z.number(), asOf: z.string(), withDirection: z.number() }),
  rungs: z.array(z.object({ id: z.string(), label: z.string(), def: z.string() })),
  sites: z.array(Site),
  nashville: z.object({ totals: z.record(z.string(), z.number()), definitions: z.record(z.string(), z.string()), period: z.string(), sources: z.array(z.string()) }),
  windsor: z.object({ cameras: z.number(), cases: z.array(z.object({ date: z.string(), type: z.string(), site: z.string().nullable(), summary: z.string(), outcome: z.string() })), sources: z.array(z.string()) }),
  courts: z.array(z.object({ id: z.string(), case: z.string(), court: z.string(), state: z.string(), city: z.string().optional(), date: z.string(), crime: z.string(), role: z.string(), outcome: z.string(), sources: z.array(z.string()) })),
  districts: z.array(z.object({ agency: z.string(), city: z.string(), state: z.string(), unit: z.string(), asOf: z.string(), cameras: z.number(), sources: z.array(z.string()), rows: z.array(z.tuple([z.string(), z.number()])) })),
  ladders: z.array(z.object({ id: z.string(), agency: z.string(), city: z.string(), state: z.string(), period: z.string(), cameras: z.string(), vendorMix: z.boolean().optional(), vendor: z.string().optional(), mixedWindows: z.boolean().optional(), noRates: z.boolean().optional(), words: z.record(z.string(), z.string()).optional(), values: Values, note: z.string(), sources: z.array(z.string()) })),
  national: z.object({ statements: z.array(z.object({ tag: z.string(), who: z.string(), text: z.string(), sources: z.array(z.string()) })), excluded: z.array(z.object({ what: z.string(), why: z.string(), sources: z.array(z.string()) })) }),
  coverage: z.object({ sites: z.number(), located: z.number(), matched: z.number(), placedAtCamera: z.number(), inCar: z.number(), bySource: z.record(z.string(), z.object({ sites: z.number(), located: z.number(), matched: z.number(), placedAtCamera: z.number() })) }),
});
type Data = z.infer<typeof File>;
type SiteT = z.infer<typeof Site>;
type V = z.infer<typeof Values>;

const RUNGS: (keyof V)[] = ["reads", "alerts", "falseAlerts", "stops", "recoveries", "arrests"];
const fmt = (n: number | null | undefined) => n == null ? `<span class="na">not reported</span>` : n.toLocaleString("en-US");
const depth = (v: V): Ring["depth"] => (v.arrests || v.recoveries) ? 3 : v.stops ? 2 : (v.alerts || v.falseAlerts) ? 1 : 0;
const SOURCE_META: Record<string, { title: string; how: string; unit: string }> = {
  nashville: { title: "Nashville, Tenn.: 24 fixed sites and four mobile units, eight weeks in 2023", how: "Metro Nashville Police published verified hits, stops, searches, arrests and recoveries for each intersection in its plate-reader pilot. A verified hit is a hit notification an employee confirmed before a stop was authorized. The report does not name the maker of the fixed cameras. Sites were located as the node the two named roads share in OpenStreetMap.", unit: "Verified hits" },
  windsor: { title: "Windsor, Conn.: 16 cameras at 14 sites, cases named to a camera", how: "The town’s fact sheet lists every camera site and 10 dated cases; four name the camera used. Counts here are those cases, not hit totals, which the town does not publish.", unit: "Alerts" },
  tucson: { title: "Tucson, Ariz.: dispatch calls with the nature code FLOCK", how: "The city’s calls-for-service layer carries a FLOCK nature code, used by the University of Arizona police, with the intersection and how each call was closed. The layer covers a rolling 45 days; the build keeps every snapshot.", unit: "Calls" },
  news: { title: "News reports that name the camera’s road", how: "From a public dataset of 1,743 news-reported outcomes credited to Flock cameras, the records whose summary names the road or intersection of the camera. These are police statements relayed by local news; successes reach the news far more often than errors. Each row is one incident.", unit: "Incidents" },
  court: { title: "Court opinions that name the camera", how: "An appellate opinion that identifies the camera whose hot-list alert began the case.", unit: "Alerts" },
};
/** Sources drawn on a city map of their own. */
const CITY_KEYS = new Set(["nashville", "windsor", "tucson"]);
/** How Tucson's calls were closed, in words. */
const DISPOSITION: Record<string, string> = { A: "arrest", B: "report written", G: "citation", J: "no report", O: "other" };
const cap1 = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const RUNG_HEAD: Record<keyof V, string> = { reads: "Reads", alerts: "Alerts", falseAlerts: "Wrong alerts", stops: "Stops", recoveries: "Recoveries", arrests: "Arrests" };
function rungCells(v: V): string {
  return RUNGS.map((r) => { const n = v[r]; return `<td class="rung${n == null ? " is-na" : ""}" data-label="${RUNG_HEAD[r]}">${fmt(n)}</td>`; }).join("");
}
/** Rates between rungs of one record. Reads and alerts from different sets of readers (`vendorMix`) give no alert rate. */
function rates(v: V, o: { vendorMix?: boolean; words?: Record<string, string> } = {}): string {
  const out: string[] = [], A = o.words?.alerts ?? "alerts";
  if (v.reads && v.alerts != null && !o.vendorMix) out.push(`${(v.alerts / v.reads * 1e6).toFixed(1)} ${A} per million reads`);
  if (v.alerts && v.falseAlerts != null) { const p = v.falseAlerts / v.alerts * 100; out.push(`${p < 1 ? p.toFixed(1) : Math.round(p)}% of ${A} wrong`); }
  const per = (n: number, what: string) => { const r = n / v.alerts! * 100; return r >= 0.1 ? `${r.toFixed(1)} ${what} per 100 ${A}` : `${(n / v.alerts! * 1e5).toFixed(1)} ${what} per 100,000 ${A}`; };
  if (v.alerts && v.recoveries != null) out.push(per(v.recoveries, "recoveries"));
  if (v.alerts && v.arrests != null) out.push(per(v.arrests, o.words?.arrests ?? "arrests"));
  return out.length ? `<p class="rates mono">${out.join(" · ")}</p>` : "";
}
const matchText = (s: SiteT) => s.inCar ? `<span class="na">in-car reader, not a fixed camera</span>` : s.placedAtCamera ? `<span class="na">placed at a mapped camera on the named road</span>` : s.mobile ? `<span class="na">mobile unit, no fixed site</span>` : s.lat == null ? `<span class="na">location not resolved</span>` : s.match ? `${s.match.distanceM} m${s.match.brand && s.match.brand !== "Flock Safety" ? ` (${escape(s.match.brand)})` : ""}` : s.nearest ? `<span class="na">${s.nearest.distanceM.toLocaleString("en-US")} m, no match</span>` : `<span class="na">no mapped camera within about 4 km</span>`;
const RUNG_COLS: Record<string, string> = { falseAlerts: "Wrong alerts", stops: "Stops", recoveries: "Recoveries", arrests: "Arrests" };

function siteTable(d: Data, sites: SiteT[], key: string, ctx: Ctx): HTMLElement {
  const meta = SOURCE_META[key]!;
  const block = el("section", "source-block");
  block.id = `src-block-${key}`;
  const head = el("div", "sec-head");
  head.innerHTML = `<h3>${escape(meta.title)}</h3><p class="lede small">${escape(meta.how)}</p>`;
  block.appendChild(head);
  const ids = [...new Set(sites.flatMap((s) => s.sources))];
  if (CITY_KEYS.has(key)) block.insertAdjacentHTML("beforeend", cityFigure(d, key, ctx, ids));
  // on a phone each row becomes a card: the site as its title, the counts three to a line, the rest under them
  const wrap = el("div", "tablewrap stack rung-cards");
  const t = el("table", "rung-table");
  const extraHead = key === "nashville" ? ["Searches"] : key === "tucson" ? ["How the calls were closed"] : key === "news" || key === "court" ? ["What happened"] : key === "windsor" ? ["Cases named here"] : [];
  // Rung columns this source reports on at least one row; a rung it never reports is named once above the table
  // instead. News reports give no counts: each row is one incident, described in words.
  const cols: { k: keyof V; label: string }[] = key === "news" ? [] : [{ k: "alerts", label: meta.unit }, ...(["falseAlerts", "stops", "recoveries", "arrests"] as const).map((k) => ({ k, label: RUNG_COLS[k]! }))];
  // Tucson records how every call was closed, so a call with no arrest counts as none, not as unreported
  const value = (s: SiteT, k: keyof V) => (key === "tucson" && k === "arrests" ? s.values.arrests ?? 0 : s.values[k]);
  const shown = cols.filter((c) => sites.some((s) => value(s, c.k) != null));
  const unreported = cols.filter((c) => !shown.includes(c)).map((c) => c.label.toLowerCase());
  const note = el("p", "fine table-note");
  note.textContent = `Nearest mapped camera: within 150 meters counts as a match.${unreported.length ? ` Not reported by this source: ${unreported.join(", ")}.` : ""}`;
  block.appendChild(note);
  t.innerHTML = `<thead><tr><th>#</th><th>Site</th>${shown.map((c) => `<th>${escape(c.label)}</th>`).join("")}${extraHead.map((h) => `<th>${h}</th>`).join("")}<th>Nearest mapped camera</th></tr></thead>`;
  const tb = el("tbody");
  sites.forEach((s, i) => {
    const tr = el("tr", "site"); tr.id = s.id;
    const x = (s.extra ?? {}) as Record<string, unknown>;
    const num = (n: unknown, h: string) => `<td class="rung${n == null ? " is-na" : ""}" data-label="${h}">${fmt(n as number)}</td>`;
    const wide = (h: string, body: string) => `<td class="small" data-label="${h}">${body}</td>`;
    let extra = "";
    if (key === "nashville") extra = num(x.searches, "Searches");
    else if (key === "tucson") extra = wide("How the calls were closed", cap1(Object.entries((x.dispositions as Record<string, number>) ?? {}).map(([k, n]) => `${DISPOSITION[k] ?? k}: ${n}`).join("; ")));
    else if (key === "news") extra = wide("What happened", `${escape(cap1(String(x.crime ?? "")))}: ${escape(String(x.outcome ?? "").replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase()))}. <a href="${escape(String(x.url ?? "#"))}" rel="noopener noreferrer" target="_blank">Report</a>`);
    else if (key === "court") extra = wide("What happened", `${escape(String(x.case ?? ""))}: ${escape(String(x.outcome ?? ""))}`);
    else if (key === "windsor") extra = wide("Cases named here", ((x.cases as { date: string; type: string }[]) ?? []).map((c) => `${apDate(c.date)}: ${escape(c.type)}`).join("; ") || "<span class=na>none named to this site</span>");
    const rungs = shown.map((c) => num(value(s, c.k), c.label)).join("");
    // a news report's place is where the case was, which is not always where the camera stood
    const when = s.period ? `<span class="nw">${escape(apPeriod(s.period))}</span>` : "date not stated";
    const sub = key === "news" ? `<div class="small">${escape(placeName(s.city, s.state))} case · ${when}</div>` : key === "court" ? `<div class="small">${escape(placeName(s.city, s.state))} · ${when}</div>` : "";
    tr.innerHTML = `<td class="mono idx">${i + 1}</td><td class="site-label"><span class="n">${i + 1}. </span>${escape(s.label)}${sub}</td>${rungs}${extra}${wide("Nearest mapped camera", matchText(s))}`;
    tb.appendChild(tr);
  });
  t.appendChild(tb); wrap.appendChild(t); block.appendChild(wrap);
  // a long table shows its first five cards on a phone, and the rest on request
  if (sites.length > 8) {
    wrap.classList.add("is-collapsed");
    const more = el("button", "chip show-all", `Show all ${sites.length} ${key === "news" ? "reports" : key === "tucson" ? "intersections" : "sites"}`) as HTMLButtonElement;
    more.type = "button";
    more.addEventListener("click", () => { wrap.classList.remove("is-collapsed"); more.remove(); });
    block.appendChild(more);
  }
  if (key === "nashville") { const p = el("p", "fine"); const tt = d.nashville.totals; p.textContent = `Pilot totals in the report: ${tt.alerts} verified hits, ${tt.stops} stops, ${tt.searches} searches, ${tt.arrests} arrests, ${tt.recoveries} recoveries. Mobile units have no fixed site.`; block.appendChild(p); }
  if (key === "news") { const p = el("p", "fine"); p.textContent = "The place under each road is where the case was reported, which is not always where the camera stood."; block.appendChild(p); }
  block.appendChild(cite(ids, 3));
  return block;
}

/** A city's map as a figure: a title that states how many of its sites lie near a mapped camera, the map and its key. */
function cityFigure(d: Data, key: string, ctx: Ctx, ids: string[]): string {
  const all = d.sites.filter((s) => s.source === key), fixed = all.filter((s) => !s.mobile), m = fixed.filter((s) => s.match).length;
  const span = (() => { const ds = all.flatMap((s) => s.period.match(/\d{4}-\d{2}-\d{2}/g) ?? []).sort(); return ds.length ? apPeriod(`${ds[0]} to ${ds[ds.length - 1]}`) : ""; })();
  const wedge = "each wedge is a Flock camera on the map of July 17, 2026, pointing the way it faces";
  const cfg: FigureCfg = key === "nashville"
    ? { title: `${cap1(ap(m))} of Nashville’s ${fixed.length} fixed pilot sites lie within 150 meters of a mapped Flock camera`, sub: `Each ring is a fixed pilot site, numbered as in the table and sized by its verified hits; ${wedge}`, notes: ["The four mobile units have no fixed site. The report does not name the maker of the fixed cameras, so the mapped camera nearest a site may not be the pilot’s."], sources: [] }
    : key === "windsor"
      ? { title: `${cap1(ap(m))} of Windsor’s ${fixed.length} listed camera sites have a mapped Flock camera within 150 meters`, sub: `Each ring is a camera site from the town’s list, numbered as in the table; ${wedge}`, notes: ["The town publishes no counts, so the rings are one size. Its cameras have been switched off since February 2026."], sources: [] }
      : { title: `${cap1(ap(m))} of the ${fixed.length} intersections with FLOCK calls lie within 150 meters of a mapped Flock camera`, sub: `Each ring is an intersection with calls ${span ? `from ${span}` : "in the window"}, numbered as in the table and sized by its calls; ${wedge}`, notes: ["A call is a dispatch with the FLOCK nature code; the table gives how each one was closed."], sources: [] };
  cfg.sources = [...ids, "deflock-data", "census-boundaries-2024"];
  const body = `<div class="panel" data-panel="${key}"><canvas aria-label="${escape(`Map: ${cfg.title}`)}"></canvas><p class="panel-cap"></p></div>${cityKey(all.filter((s) => s.lat != null), key)}`;
  return frame(`map-${key}`, cfg, ctx, body, { cls: "city-map" });
}

/** The page opens with the entries themselves: one square per entry in a published record of results, by source,
 *  marked by whether it could be placed within 150 meters of a mapped camera. */
const RECORD_ROWS: { key: string; label: string }[] = [
  { key: "nashville", label: "Nashville pilot: sites and mobile units" },
  { key: "windsor", label: "Windsor, Conn.: camera sites and their cases" },
  { key: "tucson", label: "Tucson, Ariz.: dispatch calls by intersection" },
  { key: "news", label: "News reports that name the camera’s road" },
  { key: "court", label: "Court opinions that name the camera" },
];
const hasResult = (s: SiteT) => !!(s.values.stops || s.values.recoveries || s.values.arrests);
function recordsFigure(d: Data, ctx: Ctx, onMap: number): string {
  const fixed = d.sites.filter((x) => !x.inCar);
  // 3: within 150 m of a mapped camera; 2: placed at a camera on the named road, so the distance cannot be tested;
  // 1: placed, farther away; 0: not placed
  const status = (x: SiteT) => (x.match ? 3 : x.placedAtCamera ? 2 : x.lat != null ? 1 : 0);
  const square = (st: number, x: number, y: number, sq: number) => st === 3 ? rect(x, y, sq, sq, { class: "c-hi", rx: 1.5 }) : st === 2 ? rect(x + 0.6, y + 0.6, sq - 1.2, sq - 1.2, { class: "c-ctx", stroke: "var(--ink)", "stroke-width": 1.2, rx: 1.5 }) : st === 1 ? rect(x, y, sq, sq, { class: "c-ctx", rx: 1.5 }) : rect(x + 0.75, y + 0.75, sq - 1.5, sq - 1.5, { fill: "#fff", stroke: "var(--ink-3)", "stroke-width": 1.5, rx: 1.5 });
  const draw = (W: number, narrow: boolean) => {
    const sq = narrow ? 9 : 12, gap = narrow ? 2 : 3, rowH = narrow ? 44 : 46;
    let out = "";
    // the key, as direct labels at the top
    const keys: [number, string][] = [[3, "Within 150 meters of a mapped camera"], [2, "Placed at a camera on the named road"], [1, "Placed, farther away"], [0, "Could not be placed"]];
    let kx = 0, ky = 12;
    for (const [st, t] of keys) {
      const w = sq + 6 + textWidth(t, 12) + 16;
      if (kx + w > W) { kx = 0; ky += 18; }
      out += square(st, kx, ky - sq + 2, sq) + text(kx + sq + 6, ky, t, { "font-size": 12, fill: "var(--ink-2)" });
      kx += w;
    }
    // the rows start a clear line under the key, however many lines it took
    const T = ky + 22;
    RECORD_ROWS.forEach((r, i) => {
      const list = fixed.filter((x) => x.source === r.key).sort((a, b) => status(b) - status(a));
      if (!list.length) return;
      const y0 = T + i * rowH, m = list.filter((x) => status(x) === 3).length;
      out += text(0, y0 + 12, r.label, { "font-size": 12.5, "font-weight": 600, fill: "var(--ink)" });
      out += text(W, y0 + 12, `${m} of ${list.length}`, { "font-size": 12.5, "font-weight": 600, fill: "var(--ink)", "text-anchor": "end" });
      list.forEach((x, k) => {
        const st = status(x);
        out += tip(square(st, k * (sq + gap), y0 + 20, sq), st === 3 ? `${x.match!.distanceM} m from a mapped camera${hasResult(x) ? "; a stop, a recovery or an arrest" : ""}` : st === 2 ? "placed at a camera on the named road; the distance cannot be tested" : st === 1 ? "placed, no mapped camera within 150 m" : "not placed", x.label);
      });
    });
    const H = T + RECORD_ROWS.length * rowH;
    return svg(W, H, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Unit chart of the ${fixed.length} entries in published outcome records, by source: ${RECORD_ROWS.map((r) => { const l = fixed.filter((x) => x.source === r.key); return `${r.label}, ${l.filter((x) => x.match).length} of ${l.length} within 150 meters of a mapped camera`; }).join("; ")}.` });
  };
  const bySrc = Object.entries(d.coverage.bySource);
  const table = dataTable(["Source", "Entries", "Placed", "Within 150 m"], bySrc.map(([k, v]) => [RECORD_ROWS.find((r) => r.key === k)?.label ?? k, v.sites, v.located, v.matched]), { caption: "Entries in published outcome records by source: how many could be placed on the map, and how many lie within 150 meters of a mapped camera" });
  const matched = fixed.filter((x) => x.match), res = matched.filter(hasResult).length, none = matched.filter((x) => depth(x.values) === 0).length;
  const windsor = d.coverage.bySource.windsor?.matched ?? 0, mobile = fixed.filter((x) => x.mobile).length;
  const srcs = [...new Set(fixed.flatMap((x) => x.sources))].concat("deflock-data");
  const cfg: FigureCfg = {
    title: `${matched.length} of ${fixed.length} published outcome entries lie within 150 meters of a mapped camera`,
    sub: `Each square is one entry in a published record of results (a pilot site, a camera site, an intersection, a news report or a court case), by whether it could be placed within 150 meters, about 500 feet, of a Flock camera on the map of ${apDate(d.cameras.asOf.slice(0, 10))}`,
    notes: [`Of the ${matched.length} within 150 meters, ${ap(res)} report a stop, a recovery or an arrest; ${ap(matched.length - res - none)} report hits or calls only, and ${ap(none)} are camera sites with no case named. ${cap1(ap(windsor))} of the ${matched.length} are in Windsor, Conn., where the cameras have been switched off since February 2026.${mobile ? ` ${cap1(ap(mobile))} of Nashville’s entries are mobile units with no fixed site.` : ""} The entries were matched against the ${d.cameras.flock.toLocaleString("en-US")} Flock cameras on that map; ${onMap.toLocaleString("en-US")} are mapped in the 50 states and D.C. as of Oct. 8, 2026.`],
    sources: srcs,
  };
  return frame("records", cfg, ctx, draw(WIDE, false) + draw(NARROW, true), { level: 2, table, cls: "outcomes-lead" });
}

export async function buildOutcomes(host: HTMLElement): Promise<void> {
  const raw = await fetch(`${BASE}data/outcomes.json`).then((r) => r.json());
  const d = typeset(File.parse(raw));
  const mapOff = new URLSearchParams(location.search).get("map") === "off";
  const ctx = figCtx();
  const snapshot = String(ctx.stats.snapshot?.value ?? "");
  const onMap = Number(ctx.stats.usFlock?.value ?? 0);
  // The entries, and how few of them can be tied to a camera
  host.insertAdjacentHTML("beforeend", recordsFigure(d, ctx, onMap));
  // Agency audits: each department's counts, step by step, then every count in a table in the chart's order
  const ag = el("section", "source-block"); ag.id = "agencies";
  ag.innerHTML = `<div class="sec-head"><h2>By agency</h2><p class="lede small">Audits and annual reports that give some of the steps from plate reads to arrests for a whole program. Rates are computed only where both steps come from the same report and the same readers. Definitions differ: an alert may be an unverified match or a verified hit, and an arrest may be “directly related” or “assisted”; the note under each department says which.</p></div>`;
  ag.insertAdjacentHTML("beforeend", ladderFigure(d.ladders, ctx));
  ag.insertAdjacentHTML("beforeend", `<div class="rung-legend">${d.rungs.map((r) => `<span><b>${escape(r.label)}</b> ${escape(r.def)}</span>`).join("")}</div>`);
  // the table becomes one card per department on a phone, its note under it
  const lw = el("div", "tablewrap stack rung-cards"); const lt = el("table", "rung-table ladders");
  lt.innerHTML = `<thead><tr><th>Agency</th><th>Period</th>${RUNGS.map((r) => `<th>${RUNG_HEAD[r]}</th>`).join("")}</tr></thead>`;
  const ltb = el("tbody");
  const charted = ladderRows(d.ladders), order = [...charted, ...d.ladders.filter((L) => !charted.includes(L))];
  for (const L of order) {
    const tr = el("tr", "ladder"); tr.id = `ladder-${L.id}`;
    tr.innerHTML = `<td class="site-label">${escape(L.agency)}<div class="small">${escape(L.cameras)}</div></td><td class="small" data-label="Period">${escape(apPeriod(L.period))}</td>${rungCells(L.values)}`;
    ltb.appendChild(tr);
    const tr2 = el("tr", "ladder-note"); const td = el("td"); td.colSpan = 8; td.innerHTML = `${L.mixedWindows || L.noRates ? "" : rates(L.values, L)}<p class="small">${escape(L.note)}</p>`; td.appendChild(cite(L.sources, 3)); tr2.appendChild(td); ltb.appendChild(tr2);
  }
  lt.appendChild(ltb); lw.appendChild(lt); ag.appendChild(lw); host.appendChild(ag);
  // Whether the cameras reduce crime: the one multi-agency study, as the story draws it
  const ev = el("section", "source-block"); ev.id = "evidence";
  ev.innerHTML = `<div class="sec-head"><h2>Whether the cameras reduce crime</h2><p class="lede small">One working paper compares agencies that adopted Flock cameras with agencies that did not. Its estimate depends on how the agencies are weighted.</p></div>${evidenceFigure(figureCfg("evidence"), ctx)}`;
  host.appendChild(ev);
  // When an alert is wrong: the story's figure of three kinds of error
  const er = el("section", "source-block"); er.id = "errors";
  er.innerHTML = `<div class="sec-head"><h2>When an alert is wrong</h2><p class="lede small">An alert means a camera’s reading of a plate matched an entry on a list. In these three records, the match was wrong in three different ways.</p></div>${errorsFigure(figureCfg("errors"), ctx)}`;
  host.appendChild(er);
  // By camera site: where the placed entries are, then each source with its map and table
  const nat = el("section", "source-block"); nat.id = "sites";
  nat.innerHTML = `<div class="sec-head"><h2>By camera site</h2><p class="lede small">Five sources publish results that can be placed at a fixed camera or a street corner: Nashville’s pilot report, Windsor’s fact sheet, Tucson’s dispatch calls, news reports and a court opinion. Nashville, Tucson and Windsor have their own maps below, and every table lists each location.</p></div>`;
  const placed = d.sites.filter((s) => !s.inCar && s.lat != null);
  const three = ["nashville", "windsor", "tucson"].reduce((t, k) => t + (d.coverage.bySource[k]?.located ?? 0), 0);
  const natCfg: FigureCfg = {
    title: `${three} of the ${d.coverage.located} entries placed on the map come from three cities`,
    sub: `Each gray dot is one of the ${onMap ? `${onMap.toLocaleString("en-US")} ` : ""}Flock cameras mapped in the 50 states and D.C.${snapshot ? ` as of ${apDate(snapshot)}` : ""}; each ring is a place with an entry in a published record of results`,
    notes: ["Story County’s hits are left off: they mark where a patrol car was, not a fixed camera. Alaska and Hawaii are shown at different scales."],
    sources: [...new Set(placed.flatMap((s) => s.sources)), "deflock-tiles-2026"],
  };
  nat.insertAdjacentHTML("beforeend", frame("national", natCfg, ctx, mapOff ? "" : `<div class="panel national" data-panel="national"><canvas aria-label="Every mapped Flock camera in the 50 states and D.C., with the places that have a published outcome entry marked as rings"></canvas></div>${nationalKey(placed)}`));
  host.appendChild(nat);
  for (const key of ["nashville", "tucson", "windsor", "court", "news"]) {
    const sites = d.sites.filter((s) => s.source === key);
    if (!sites.length) continue;
    const block = siteTable(d, sites, key, ctx);
    // Windsor cases not tied to a site belong with the Windsor table
    const wc = key === "windsor" ? d.windsor.cases.filter((c) => !c.site) : [];
    if (wc.length) { const p = el("p", "fine"); p.innerHTML = `Windsor also lists ${ap(wc.length)} cases without naming the camera: ${wc.map((c) => `${apDate(c.date)}, ${escape(c.type.charAt(0).toLowerCase() + c.type.slice(1))} (${escape(c.outcome)})`).join("; ")}.`; block.appendChild(p); }
    host.appendChild(block);
  }
  // Story County: hits where a patrol car was, so a paragraph rather than a table of anonymous locations
  const story = d.sites.filter((s) => s.source === "story");
  if (story.length) {
    const sc = el("section", "source-block"); sc.id = "src-block-story";
    const hits = story.reduce((t, s) => t + (s.values.alerts ?? 0), 0), wrongState = story.reduce((t, s) => t + Number((s.extra as { wrongState?: number } | undefined)?.wrongState ?? 0), 0);
    sc.innerHTML = `<div class="sec-head"><h3>Story County, Iowa: hits from the sheriff’s in-car readers</h3><p class="lede small">The sheriff’s office’s report of erroneous hot-list hits from its Axon readers in patrol cars, which are not Flock cameras, lists ${hits.toLocaleString("en-US")} hits in a month at ${story.length.toLocaleString("en-US")} locations; ${wrongState.toLocaleString("en-US")} were marked “wrong state,” meaning the plate matched a list entry from another state. A hit’s location is where a patrol car was, so these hits are not matched to cameras or mapped. The report’s counts are in the agency table and in “When an alert is wrong.”</p></div>`;
    sc.appendChild(cite([...new Set(story.flatMap((s) => s.sources))], 1)); host.appendChild(sc);
  }
  // Courts without a site, most recent first
  const cc = d.courts.filter((c) => !d.sites.some((s) => s.id === `court-${c.id}`)).sort((a, b) => b.date.localeCompare(a.date));
  if (cc.length) {
    const cs = el("section", "source-block"); cs.innerHTML = `<div class="sec-head"><h3>Other court records citing a Flock read</h3><p class="lede small">Filings and opinions that rely on a read or alert without naming the camera. The legal outcome is the record’s, not the case’s final result.</p></div>`;
    const ct = el("div", "tablewrap stack"); ct.innerHTML = `<table class="rung-table"><thead><tr><th>Case</th><th>Court</th><th>Date</th><th>Offense</th><th>What the read did</th><th>Record</th></tr></thead><tbody>${cc.map((c) => `<tr><td>${escape(c.case)}</td><td class="small" data-label="Court">${escape(c.court)}</td><td class="small nw" data-label="Date">${escape(apDate(c.date))}</td><td class="small" data-label="Offense">${escape(c.crime)}</td><td class="small" data-label="What the read did">${escape(c.role)}</td><td class="small" data-label="Record">${escape(c.outcome)}</td></tr>`).join("")}</tbody></table>`;
    cs.appendChild(ct); cs.appendChild(cite([...new Set(cc.flatMap((c) => c.sources))], 2)); host.appendChild(cs);
  }
  // National
  const ns = el("section", "source-block"); ns.id = "national";
  ns.innerHTML = `<div class="sec-head"><h2>National statements</h2><p class="lede small">Figures that describe the whole network rather than a place, tagged by who states them.</p></div>`;
  for (const s of d.national.statements) { const p = el("div", "stmt sheet"); p.innerHTML = `<span class="tag ${s.tag === "flock" ? "tag-flock" : "tag-indep"}">${s.tag === "flock" ? "Flock" : "Independent"}</span> <b>${escape(s.who)}.</b> ${escape(s.text)}`; p.appendChild(cite(s.sources, 2)); ns.appendChild(p); }
  const ex = el("div", "excluded"); ex.innerHTML = `<h3>Records found but not placed</h3>`;
  const ul = el("ul");
  for (const e of d.national.excluded) { const li = el("li"); li.innerHTML = `<b>${escape(e.what)}.</b> ${escape(e.why)}.`; li.appendChild(cite(e.sources, 1)); ul.appendChild(li); }
  ex.appendChild(ul); ns.appendChild(ex);
  host.appendChild(ns);
  // About the data: what the page can and cannot say, and the two camera snapshots
  const ab = el("section", "source-block"); ab.id = "about";
  const matched = d.sites.filter((s) => !s.inCar && s.match);
  ab.innerHTML = `<div class="sec-head"><h2>About the data</h2></div><p class="lede small">What this page can and cannot say. Published records of results name ${d.coverage.sites} places or cases that can be tied to fixed cameras; ${d.coverage.located} of them could be placed on a map, ${d.coverage.matched} lie within 150 meters of a mapped camera, and ${ap(matched.filter(hasResult).length)} of those report a stop, a recovery or an arrest. The other cameras on the map have no public outcome record tied to their location.</p><p class="lede small">The entries were matched to the ${d.cameras.flock.toLocaleString("en-US")} Flock cameras on the map on ${apDate(d.cameras.asOf.slice(0, 10))}, when most of them were compiled, so the distances in the tables are to the cameras that were there then; the city maps show the same snapshot. The national map shows the ${onMap ? onMap.toLocaleString("en-US") : "Flock cameras"} mapped in the 50 states and D.C. as of ${snapshot ? apDate(snapshot) : "the latest snapshot"}.</p><p class="small">What would extend it: an agency’s alerts and their outcomes, camera by camera, with its list of camera locations.</p><p class="fine">Camera positions: OpenStreetMap contributors via DeFlock, under the Open Database License. Updated ${escape(apDate(d.generated))}.</p>`;
  ab.appendChild(cite(["deflock-data", "deflock-tiles-2026"], 2));
  host.appendChild(ab);
  initTableWraps();
  initTooltips(host);
  if (!mapOff) void drawPanels(d, host);
}

async function drawPanels(d: Data, host: HTMLElement): Promise<void> {
  const panels = [...host.querySelectorAll<HTMLElement>(".panel")];
  if (!panels.length) return;
  const xy: Record<string, [number, number]> = await fetch(`${BASE}data/basemaps/outcome-sites.json`).then((r) => r.json());
  const sizeOf = (s: SiteT) => s.values.alerts ?? s.values.falseAlerts ?? 1;
  const draw = async (fig: HTMLElement) => {
    const canvas = fig.querySelector("canvas")!, cap = fig.querySelector(".panel-cap");
    const key = fig.dataset.panel!;
    if (key === "national") {
      const on = d.sites.filter((s) => xy[s.id] && !s.inCar);
      const rings: Ring[] = on.map((s) => ({ x: xy[s.id]![0], y: xy[s.id]![1], size: sizeOf(s), depth: depth(s.values) }));
      // the three cities the title names, labeled with their placed entries
      const labels = ([["nashville", "Nashville"], ["tucson", "Tucson"], ["windsor", "Windsor, Conn."]] as const).map(([k, name]) => {
        const l = on.filter((s) => s.source === k);
        return { x: l.reduce((t, s) => t + xy[s.id]![0], 0) / l.length, y: l.reduce((t, s) => t + xy[s.id]![1], 0) / l.length, text: `${name}, ${l.length}` };
      }).filter((l) => Number.isFinite(l.x));
      await drawNational(canvas, rings, labels);
      return;
    }
    const sites = d.sites.filter((s) => s.source === key && s.lat != null);
    if (!sites.length) { if (cap) cap.textContent = "No located sites"; return; }
    // Numbers match the table rows.
    const listed = d.sites.filter((s) => s.source === key);
    // Frame the numbered sites, padded by 12% of their spread and at least 400 m.
    const lats = sites.map((s) => s.lat!), lons = sites.map((s) => s.lon!);
    const k = Math.cos(((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI / 180), minPad = 400 / 111320;
    const padLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.12, minPad), padLon = Math.max((Math.max(...lons) - Math.min(...lons)) * 0.12, minPad / k);
    const box = { s: Math.min(...lats) - padLat, n: Math.max(...lats) + padLat, w: Math.min(...lons) - padLon, e: Math.max(...lons) + padLon };
    const n = await drawCity(canvas, key, sites.map((s) => { const i = listed.indexOf(s); return { lon: s.lon!, lat: s.lat!, size: sizeOf(s), depth: depth(s.values), n: i >= 0 ? i + 1 : undefined }; }), box);
    if (cap) cap.textContent = `${n.toLocaleString("en-US")} Flock cameras in view. Streets: U.S. Census Bureau.`;
  };
  const drawn = new Set<HTMLElement>();
  const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); drawn.add(e.target as HTMLElement); void draw(e.target as HTMLElement); } }, { rootMargin: "300px" });
  panels.forEach((p) => io.observe(p));
  // Panels draw at their on-screen width, so redraw after the width changes (a rotated phone, a resized window).
  let lastW = innerWidth, timer = 0;
  addEventListener("resize", () => { clearTimeout(timer); timer = window.setTimeout(() => { if (innerWidth === lastW) return; lastW = innerWidth; drawn.forEach((fig) => void draw(fig)); }, 200); });
}

/** The steps the agency chart draws; wrong alerts are left to "When an alert is wrong" and the table. */
const STEPS: (keyof V)[] = ["reads", "alerts", "stops", "recoveries", "arrests"];
const STEP_NAME: Record<string, string> = { reads: "Plate reads", alerts: "Alerts", stops: "Stops", recoveries: "Recoveries", arrests: "Arrests" };
type LadderT = Data["ladders"][number];
/** A step's name as the department's report counts it ("Verified hits", "People charged"). */
const stepName = (L: LadderT, k: keyof V) => (L.words?.[k] ? cap1(L.words[k]!) : STEP_NAME[k]!);
const who = (L: LadderT) => `${/Sheriff/.test(L.agency) ? `${L.agency.replace(/ Sheriff.*$/, "")}, ${apState(L.state)}` : placeName(L.city, L.state)}${L.vendor ? ` (${L.vendor} readers)` : ""}`;
const shortPeriod = (L: LadderT) => apPeriod(L.period.replace(/ \(.*\)/, "").replace(/, cumulative.*$/, ""));
const peak = (L: LadderT) => Math.max(...STEPS.map((k) => L.values[k] ?? 0));
/** The departments the chart draws, those with two or more steps, from the largest count down. */
const ladderRows = (ladders: Data["ladders"]) => ladders.filter((L) => STEPS.filter((k) => L.values[k] != null).length >= 2).sort((a, b) => peak(b) - peak(a));

/** The home page's ladder for every department that reports two or more steps: a panel each, one row per step it
 *  reported, its count beside the dot on one logarithmic scale. */
function ladderFigure(ladders: Data["ladders"], ctx: Ctx): string {
  const rows = ladderRows(ladders);
  const mixed = (L: LadderT) => !!(L.mixedWindows || L.vendorMix);
  const draw = (W: number, narrow: boolean) => {
    const LW = narrow ? 142 : 178, R = narrow ? 8 : 12, rowH = narrow ? 19 : 20, gap = 16, top = 24;
    const x = logScale(1, 1e9, LW + 8, W - R);
    // on a phone the axis stops labeling at a million, where the next label would run into it
    const decades = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9], ticks = narrow ? [1, 1e3, 1e6] : [1, 100, 1e4, 1e6, 1e8];
    const axis = (y: number) => g(ticks.map((v, i) => text(x(v), y, tickWords(v), { "text-anchor": i === ticks.length - 1 && x(v) + textWidth(tickWords(v), 12) / 2 > W ? "end" : "middle" })).join(""), { class: "axis" });
    let out = axis(14), y0 = top;
    for (const L of rows) {
      const ks = STEPS.filter((k) => L.values[k] != null), name = `${who(L)}${mixed(L) ? "*" : ""}`, per = shortPeriod(L);
      const nameW = textWidth(name, 14, 700), inline = nameW + 10 + textWidth(per, 12) <= W, headH = inline ? 28 : 44;
      out += line(0, y0 + 0.5, W, y0 + 0.5, { stroke: "var(--ink)", "stroke-width": 1 });
      out += text(0, y0 + 18, name, { "font-size": 14, "font-weight": 700, fill: "var(--ink)" });
      // the period follows the name, or takes the next line when the two do not fit
      out += text(inline ? nameW + 10 : 0, inline ? y0 + 18 : y0 + 34, per, { "font-size": 12, fill: "var(--ink-3)" });
      const panelH = headH + ks.length * rowH;
      out += g(decades.map((v) => line(x(v), y0 + headH - 4, x(v), y0 + panelH)).join(""), { class: "grid" });
      ks.forEach((k, j) => {
        const y = y0 + headH + j * rowH + rowH / 2, v = L.values[k]!, nm = stepName(L, k);
        const vt = v >= 1e5 ? big(v) : v.toLocaleString("en-US"), left = x(v) + 9 + textWidth(vt, 12, 600) > W;
        out += text(LW, y + 4, nm, { "text-anchor": "end", "font-size": 12, fill: "var(--ink-2)" });
        out += tip(rect(LW + 4, y - rowH / 2, W - LW - 4, rowH, { fill: "transparent" }) + circle(x(v), y, 5, { class: "mark c-ink", stroke: "#fff", "stroke-width": 2 }) + label(left ? x(v) - 9 : x(v) + 9, y + 4, vt, { "font-size": 12, "font-weight": 600, fill: "var(--ink)", "text-anchor": left ? "end" : "start" }), v.toLocaleString("en-US"), `${who(L)}, ${apPeriod(L.period)}: ${nm.toLowerCase()}`);
      });
      y0 += panelH + gap;
    }
    out += axis(y0 + 2);
    return svg(W, y0 + 8, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Dot chart on a logarithmic scale of the counts each department reported: ${rows.map((L) => `${who(L)}, ${shortPeriod(L)}: ${STEPS.filter((k) => L.values[k] != null).map((k) => `${stepName(L, k).toLowerCase()} ${(L.values[k] ?? 0).toLocaleString("en-US")}`).join(", ")}`).join("; ")}.` });
  };
  const cfg: FigureCfg = {
    title: "Reads run to the millions; arrests, to the dozens or hundreds",
    sub: "Counts from each department’s own audit or report, one row for each step it reported, on a logarithmic scale",
    notes: ["The panels are not a ranking: departments count different steps, over different periods and with different definitions. * Not every count comes from Flock cameras over one period: the readers include other makes or makes the report does not name, or the reads and alerts cover different windows. Wrong alerts are in the table and under “When an alert is wrong.”"],
    sources: [...new Set(rows.flatMap((L) => L.sources))],
  };
  return frame("ladders", cfg, ctx, draw(WIDE, false) + draw(NARROW, true), { cls: "ladder-ov" });
}

/** Ring shades in a key, only those a map uses; a city may name its own ("Calls, none closed by an arrest"). */
const RING_WORDS: Record<string, Partial<Record<number, string>>> = {
  nashville: { 1: "Verified hits only" },
  tucson: { 1: "Calls, none closed by an arrest", 3: "A call closed by an arrest" },
  windsor: { 0: "Camera site, no case named", 3: "A case with an arrest or a recovery" },
};
const ringKey = (depths: Set<number>, key = "") => [0, 1, 2, 3].filter((k) => depths.has(k)).map((k) => `<span class="mk-item"><i class="mk-ring d${k}"></i>${RING_WORDS[key]?.[k] ?? DEPTH_LABEL[k]}</span>`).join("");
const depthsOf = (sites: SiteT[]) => new Set(sites.map((s) => depth(s.values)));
/** The key under the national map: the gray dots are Flock cameras, the rings places with a published entry. */
function nationalKey(sites: SiteT[]): string {
  return `<div class="map-key"><span class="mk-item"><i class="mk-dot"></i>Mapped Flock camera</span>${ringKey(depthsOf(sites))}<span class="mk-note">Each ring is a place with a published entry, shaded by the furthest step it reports; its area follows the number of alerts, hits or calls there.</span></div>`;
}
/** The key under a city map: Flock cameras point the way they face; other makes are dots; rings are numbered as in the table. */
function cityKey(sites: SiteT[], key: string): string {
  return `<div class="map-key"><span class="mk-item"><i class="mk-wedge"></i>Flock camera, pointing the way it faces</span><span class="mk-item"><i class="mk-dot"></i>Camera of another make</span>${ringKey(depthsOf(sites), key)}</div>`;
}
