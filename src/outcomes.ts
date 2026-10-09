/**
 * The outcomes page: every public record that ties a Flock camera to a result, on six shared rungs, at the finest level
 * each source supports. Data comes from public/data/outcomes.json, built by scripts/outcomes/build.mjs; the camera
 * scatter for the map panels loads separately and only when a panel is on screen.
 */
import { z } from "zod";
import { cite, escape } from "./ui/cite";
import { el, initTableWraps } from "./ui/common";
import { BASE } from "./lib/base";
import { svg, g, line, text, circle, tip, logScale, rect, textWidth, WIDE, NARROW } from "./viz/svg";
import { tickWords, apState, apDate, apPeriod, placeName, ap, big, typeset } from "./viz/format";
import { figCtx, figureCfg } from "./ui/figs";
import { frame, dataTable } from "./story/frame";
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
  nashville: { title: "Nashville, Tenn.: 24 fixed sites and four mobile units, eight weeks in 2023", how: "Metro Nashville Police published verified hits, stops, searches, arrests and recoveries for each intersection in its ALPR pilot. A verified hit is a hit notification an employee confirmed before a stop was authorized. The report does not name the vendor of the fixed cameras. Sites were located as the node the two named roads share in OpenStreetMap.", unit: "Verified hits" },
  windsor: { title: "Windsor, Conn.: 16 cameras at 14 sites, cases named to a camera", how: "The town’s fact sheet lists every camera site and 10 dated cases; four name the camera used. Counts here are those cases, not hit totals, which the town does not publish.", unit: "Alerts" },
  story: { title: "Story County, Iowa: a month of hot-list hits from the sheriff’s in-car readers, by location", how: "The sheriff’s office’s “Erroneous hotlist hits” report from its Axon in-car readers (not Flock cameras), with the coordinates of each hit: 214 rows from NCIC lists, 165 of them marked “wrong state,” meaning the plate matched a list entry from another state. Accurate hits and total reads were not in the report. A hit’s location is where a patrol car was, so these records are not matched to fixed cameras or shown on the maps.", unit: "Hits in the report" },
  tucson: { title: "Tucson, Ariz.: dispatch calls with nature code FLOCK, last 45 days", how: "The city’s calls-for-service layer carries a FLOCK nature code, used by the University of Arizona police, with the intersection and a disposition code. Codes: A arrest, B report, G citation, J no report, O other. The layer is a rolling window; the build keeps every snapshot.", unit: "Calls" },
  news: { title: "News reports that name the camera’s road", how: "From a public dataset of 1,743 news-reported outcomes credited to Flock cameras, the records whose summary names the road or intersection of the camera. These are police statements relayed by local news; successes reach the news far more often than errors. Each row is one incident.", unit: "Incidents" },
  court: { title: "Court opinions that name the camera", how: "An appellate opinion that identifies the camera whose hot-list alert began the case.", unit: "Alerts" },
};
const CITY_PANELS: { key: string; title: string; filter: (s: SiteT) => boolean }[] = [
  { key: "nashville", title: "Nashville", filter: (s) => s.source === "nashville" },
  { key: "windsor", title: "Windsor", filter: (s) => s.source === "windsor" },
  { key: "tucson", title: "Tucson", filter: (s) => s.source === "tucson" },
];

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

function siteTable(d: Data, sites: SiteT[], key: string): HTMLElement {
  const meta = SOURCE_META[key]!;
  const block = el("section", "source-block");
  block.id = `src-block-${key}`;
  const head = el("div", "sec-head");
  head.innerHTML = `<h3>${escape(meta.title)}</h3><p class="lede small">${escape(meta.how)}</p>`;
  block.appendChild(head);
  if (CITY_PANELS.some((p) => p.key === key)) { const fig = el("figure", "panel"); fig.dataset.panel = key; fig.innerHTML = `<canvas aria-label="Map of ${escape(meta.title)}"></canvas>${cityKey(d.sites.filter((s) => s.source === key && s.lat != null))}<figcaption></figcaption>`; block.appendChild(fig); }
  // on a phone each row becomes a card: the site as its title, the counts three to a line, the rest under them
  const wrap = el("div", "tablewrap stack rung-cards");
  const t = el("table", "rung-table");
  const extraHead = key === "nashville" ? ["Searches"] : key === "story" ? ["Wrong state", "Correct", "Dismissed"] : key === "tucson" ? ["Dispositions"] : key === "news" || key === "court" ? ["What happened"] : key === "windsor" ? ["Cases named here"] : [];
  // Rung columns this source reports on at least one row; a rung it never reports is named once above the table
  // instead. News reports give no counts: each row is one incident, described in words.
  const cols: { k: keyof V; label: string }[] = key === "news" ? [] : key === "story" ? [{ k: "alerts", label: meta.unit }, { k: "falseAlerts", label: "Reviewed wrong" }] : [{ k: "alerts", label: meta.unit }, ...(["falseAlerts", "stops", "recoveries", "arrests"] as const).map((k) => ({ k, label: RUNG_COLS[k]! }))];
  const shown = cols.filter((c) => sites.some((s) => s.values[c.k] != null));
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
    else if (key === "story") extra = num(x.wrongState, "Wrong state") + num(x.correct, "Correct") + num(x.dismissed, "Dismissed");
    else if (key === "tucson") extra = wide("Dispositions", Object.entries((x.dispositions as Record<string, number>) ?? {}).map(([k, n]) => `${escape(k)} ${n}`).join(", "));
    else if (key === "news") extra = wide("What happened", `${escape(String(x.crime ?? "").replace(/^./, (c) => c.toUpperCase()))}: ${escape(String(x.outcome ?? "").replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase()))}. <a href="${escape(String(x.url ?? "#"))}" rel="noopener noreferrer" target="_blank">Report</a>`);
    else if (key === "court") extra = wide("What happened", `${escape(String(x.case ?? ""))}: ${escape(String(x.outcome ?? ""))}`);
    else if (key === "windsor") extra = wide("Cases named here", ((x.cases as { date: string; type: string }[]) ?? []).map((c) => `${apDate(c.date)}: ${escape(c.type)}`).join("; ") || "<span class=na>none named to this site</span>");
    const rungs = shown.map((c) => num(s.values[c.k], c.label)).join("");
    const cats = key === "story" ? Object.entries((x.categories as Record<string, number>) ?? {}).map(([k, n]) => `${n} ${escape(k.toLowerCase())}`).join(", ") : "";
    // a news report's place is where the case was, which is not always where the camera stood
    const when = s.period ? `<span class="nw">${escape(apPeriod(s.period))}</span>` : "date not stated";
    const sub = key === "news" ? `<div class="small">${escape(placeName(s.city, s.state))} case · ${when}</div>` : key === "court" ? `<div class="small">${escape(placeName(s.city, s.state))} · ${when}</div>` : cats ? `<div class="small">${cats}</div>` : "";
    tr.innerHTML = `<td class="mono idx">${i + 1}</td><td class="site-label"><span class="n">${i + 1}. </span>${escape(s.label)}${sub}</td>${rungs}${extra}${wide("Nearest mapped camera", matchText(s))}`;
    tb.appendChild(tr);
  });
  t.appendChild(tb); wrap.appendChild(t); block.appendChild(wrap);
  const ids = [...new Set(sites.flatMap((s) => s.sources))];
  if (key === "story") { const p = el("p", "fine"); p.textContent = "Hits in the report counts every row at the location in the export, which holds only hits the office reviewed; “reviewed wrong” is wrong state plus incorrect. The export has no field for stops or arrests."; block.appendChild(p); }
  if (key === "nashville") { const p = el("p", "fine"); const tt = d.nashville.totals; p.textContent = `Pilot totals in the report: ${tt.alerts} verified hits, ${tt.stops} stops, ${tt.searches} searches, ${tt.arrests} arrests, ${tt.recoveries} recoveries. Mobile units have no fixed site.`; block.appendChild(p); }
  if (key === "news") { const p = el("p", "fine"); p.textContent = "The place under each road is where the case was reported, which is not always where the camera stood."; block.appendChild(p); }
  block.appendChild(cite(ids, 3));
  return block;
}

/** The page opens with the records themselves: one square per published record of a result, by source, marked by
 *  whether it could be placed within 150 meters of a mapped camera. */
const RECORD_ROWS: { key: string; label: string }[] = [
  { key: "nashville", label: "Nashville pilot: sites and mobile units" },
  { key: "windsor", label: "Windsor, Conn.: cases and camera sites" },
  { key: "tucson", label: "Tucson, Ariz.: dispatch calls by intersection" },
  { key: "news", label: "News reports that name the camera’s road" },
  { key: "court", label: "Court opinions that name the camera" },
];
function recordsFigure(d: Data, ctx: ReturnType<typeof figCtx>, onMap: number): string {
  const fixed = d.sites.filter((x) => !x.inCar);
  const status = (x: SiteT) => (x.match ? 2 : x.lat != null ? 1 : 0);
  const draw = (W: number, narrow: boolean) => {
    const sq = narrow ? 9 : 12, gap = narrow ? 2 : 3, rowH = narrow ? 44 : 46;
    let out = "";
    // the key, as direct labels at the top
    const keys: [string, string][] = [["c-hi", "Within 150 meters of a mapped camera"], ["c-ctx", "Placed on the map, farther away"], ["", "Could not be placed"]];
    let kx = 0, ky = 12;
    for (const [cls, t] of keys) {
      const w = sq + 6 + textWidth(t, 12) + 16;
      if (kx + w > W) { kx = 0; ky += 18; }
      out += (cls ? rect(kx, ky - sq + 2, sq, sq, { class: cls, rx: 1.5 }) : rect(kx + 0.75, ky - sq + 2.75, sq - 1.5, sq - 1.5, { fill: "#fff", stroke: "var(--ink-3)", "stroke-width": 1.5, rx: 1.5 })) + text(kx + sq + 6, ky, t, { "font-size": 12, fill: "var(--ink-2)" });
      kx += w;
    }
    // the rows start a clear line under the key, however many lines it took
    const T = ky + 22;
    RECORD_ROWS.forEach((r, i) => {
      const list = fixed.filter((x) => x.source === r.key).sort((a, b) => status(b) - status(a));
      if (!list.length) return;
      const y0 = T + i * rowH, m = list.filter((x) => status(x) === 2).length;
      out += text(0, y0 + 12, r.label, { "font-size": 12.5, "font-weight": 600, fill: "var(--ink)" });
      const count = `${m} of ${list.length}`;
      out += text(W, y0 + 12, count, { "font-size": 12.5, "font-weight": 600, fill: "var(--ink)", "text-anchor": "end" });
      list.forEach((x, k) => {
        const cx = k * (sq + gap), cy = y0 + 20, st = status(x);
        const body = st === 2 ? rect(cx, cy, sq, sq, { class: "c-hi", rx: 1.5 }) : st === 1 ? rect(cx, cy, sq, sq, { class: "c-ctx", rx: 1.5 }) : rect(cx + 0.75, cy + 0.75, sq - 1.5, sq - 1.5, { fill: "#fff", stroke: "var(--ink-3)", "stroke-width": 1.5, rx: 1.5 });
        out += tip(body, st === 2 ? `${x.match!.distanceM} m from a mapped camera` : st === 1 ? "placed, no mapped camera within 150 m" : "not placed", x.label);
      });
    });
    const H = T + RECORD_ROWS.length * rowH;
    return svg(W, H, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Unit chart of the ${fixed.length} published outcome records by source: ${RECORD_ROWS.map((r) => { const l = fixed.filter((x) => x.source === r.key); return `${r.label}, ${l.filter((x) => x.match).length} of ${l.length} within 150 meters of a mapped camera`; }).join("; ")}.` });
  };
  const bySrc = Object.entries(d.coverage.bySource);
  const table = dataTable(["Source", "Records", "Placed on the map", "Within 150 meters of a mapped camera"], bySrc.map(([k, v]) => [RECORD_ROWS.find((r) => r.key === k)?.label ?? k, v.sites, v.located, v.matched]), { caption: "Outcome records by source" });
  const windsor = d.coverage.bySource.windsor?.matched ?? 0, mobile = fixed.filter((x) => x.mobile).length;
  const srcs = [...new Set(fixed.flatMap((x) => x.sources))].concat("deflock-data");
  const cfg: FigureCfg = {
    title: `${d.coverage.matched} of ${d.coverage.sites} published outcome records can be tied to a mapped camera`,
    sub: `Each square is one published record of a result, by whether it could be placed within 150 meters of a Flock camera on the map of ${apDate(d.cameras.asOf.slice(0, 10))}`,
    notes: [`${mobile ? `${ap(mobile).replace(/^./, (c) => c.toUpperCase())} of Nashville’s records are mobile units with no fixed site. ` : ""}${ap(windsor).replace(/^./, (c) => c.toUpperCase())} of the ${d.coverage.matched} matches are in Windsor, Conn., where the cameras have been switched off since February 2026. For scale, ${onMap.toLocaleString("en-US")} Flock cameras are mapped in the 50 states and D.C.`],
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
  // The records, and how few of them can be tied to a camera
  host.insertAdjacentHTML("beforeend", recordsFigure(d, ctx, onMap));
  // Agency audits: each department's counts from the first step it reported to the last, then every count in a table
  const ag = el("section", "source-block"); ag.id = "agencies";
  ag.innerHTML = `<div class="sec-head"><h2>By agency</h2><p class="lede small">Audits and annual reports that give some of the steps from plate reads to arrests for a whole program. Rates are computed only where both steps come from the same report and the same readers. Definitions differ: an alert may be an unverified match or a verified hit, and an arrest may be “directly related” or “assisted”; the note under each department says which.</p></div>`;
  ag.insertAdjacentHTML("beforeend", ladderFigure(d.ladders, ctx));
  ag.insertAdjacentHTML("beforeend", `<div class="rung-legend">${d.rungs.map((r) => `<span><b>${escape(r.label)}</b> ${escape(r.def)}</span>`).join("")}</div>`);
  // the table becomes one card per department on a phone, its note under it
  const lw = el("div", "tablewrap stack rung-cards"); const lt = el("table", "rung-table ladders");
  lt.innerHTML = `<thead><tr><th>Agency</th><th>Period</th>${RUNGS.map((r) => `<th>${RUNG_HEAD[r]}</th>`).join("")}</tr></thead>`;
  const ltb = el("tbody");
  for (const L of d.ladders) {
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
  // By camera site: an overview of where the placed records are, then each source with its map and table
  const nat = el("section", "source-block"); nat.id = "sites";
  nat.innerHTML = `<div class="sec-head"><h2>By camera site</h2><p class="lede small">Five sources publish results that can be placed at a fixed camera or a street corner: Nashville’s pilot report, Windsor’s fact sheet, Tucson’s dispatch calls, news reports and a court opinion. A sixth, Story County’s report, places each hit where a patrol car was. Nashville, Tucson and Windsor have their own maps below, and every table lists each location.</p></div>`;
  const placed = d.sites.filter((s) => !s.inCar && s.lat != null);
  const three = ["nashville", "windsor", "tucson"].reduce((t, k) => t + (d.coverage.bySource[k]?.located ?? 0), 0);
  const natCfg: FigureCfg = {
    title: `${three} of the ${d.coverage.located} records placed on the map come from three cities`,
    sub: `Each gray dot is one of the ${onMap ? `${onMap.toLocaleString("en-US")} ` : ""}Flock cameras mapped in the 50 states and D.C.${snapshot ? ` as of ${apDate(snapshot)}` : ""}; each ring is a place with a published record of a result`,
    notes: ["Story County’s hits are left off: they mark where a patrol car was, not a fixed camera. Alaska and Hawaii are shown at different scales."],
    sources: [...new Set(placed.flatMap((s) => s.sources)), "deflock-tiles-2026"],
  };
  nat.insertAdjacentHTML("beforeend", frame("national", natCfg, ctx, mapOff ? "" : `<div class="panel national" data-panel="national"><canvas aria-label="Every mapped Flock camera in the 50 states and D.C., with the places that have a published outcome record marked as rings"></canvas></div>${nationalKey(placed)}`));
  host.appendChild(nat);
  for (const key of ["nashville", "story", "tucson", "windsor", "court", "news"]) {
    let sites = d.sites.filter((s) => s.source === key);
    if (!sites.length) continue;
    let note = "";
    if (key === "story") { const singles = sites.filter((s) => (s.values.alerts ?? 0) < 2); sites = sites.filter((s) => (s.values.alerts ?? 0) >= 2); note = `Another ${singles.length} locations had one hit each in the month.`; }
    const block = siteTable(d, sites, key);
    if (note) { const p = el("p", "fine"); p.textContent = note; block.appendChild(p); }
    // Windsor cases not tied to a site belong with the Windsor table
    const wc = key === "windsor" ? d.windsor.cases.filter((c) => !c.site) : [];
    if (wc.length) { const p = el("p", "fine"); p.innerHTML = `Windsor also lists ${ap(wc.length)} cases without naming the camera: ${wc.map((c) => `${apDate(c.date)}, ${escape(c.type.charAt(0).toLowerCase() + c.type.slice(1))} (${escape(c.outcome)})`).join("; ")}.`; block.appendChild(p); }
    host.appendChild(block);
  }
  // Courts without a site
  const cc = d.courts.filter((c) => !d.sites.some((s) => s.id === `court-${c.id}`));
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
  ab.innerHTML = `<div class="sec-head"><h2>About the data</h2></div><p class="lede small">What this page can and cannot say. ${d.coverage.sites} published records tie a result to a place; ${d.coverage.located} of them could be placed on a map, and ${d.coverage.matched} lie within 150 meters of a mapped camera. The other cameras on the map have no public outcome record tied to their location.</p><p class="lede small">The records were matched to the ${d.cameras.flock.toLocaleString("en-US")} Flock cameras on the map on ${apDate(d.cameras.asOf.slice(0, 10))}, when most of them were compiled, so the distances in the tables are to the cameras that were there then; the city maps show the same snapshot. The national map shows the ${onMap ? onMap.toLocaleString("en-US") : "Flock cameras"} mapped in the 50 states and D.C. as of ${snapshot ? apDate(snapshot) : "the latest snapshot"}.</p><p class="small">What would extend it: an agency’s alerts and their outcomes, camera by camera, with its list of camera locations.</p><p class="fine">Camera positions: OpenStreetMap contributors via DeFlock, under the Open Database License. Updated ${escape(apDate(d.generated))}.</p>`;
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
    const canvas = fig.querySelector("canvas")!, cap = fig.querySelector(".panel-cap, figcaption");
    const key = fig.dataset.panel!;
    if (key === "national") {
      const rings: Ring[] = d.sites.filter((s) => xy[s.id] && !s.inCar).map((s) => ({ x: xy[s.id]![0], y: xy[s.id]![1], size: sizeOf(s), depth: depth(s.values) }));
      await drawNational(canvas, rings);
      return;
    }
    const sites = d.sites.filter((s) => s.source === key && s.lat != null);
    if (!sites.length) { if (cap) cap.textContent = "No located sites"; return; }
    // Numbers match the table rows; Story County’s one-hit locations are drawn but not numbered.
    const listed = key === "story" ? d.sites.filter((s) => s.source === key && (s.values.alerts ?? 0) >= 2) : d.sites.filter((s) => s.source === key);
    // Frame the numbered sites, padded by 12% of their spread and at least 400 m.
    const framed = listed.filter((s) => s.lat != null), f = framed.length ? framed : sites;
    const lats = f.map((s) => s.lat!), lons = f.map((s) => s.lon!);
    const k = Math.cos(((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI / 180), minPad = 400 / 111320;
    const padLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.12, minPad), padLon = Math.max((Math.max(...lons) - Math.min(...lons)) * 0.12, minPad / k);
    const box = { s: Math.min(...lats) - padLat, n: Math.max(...lats) + padLat, w: Math.min(...lons) - padLon, e: Math.max(...lons) + padLon };
    const n = await drawCity(canvas, key, sites.map((s) => { const i = listed.indexOf(s); return { lon: s.lon!, lat: s.lat!, size: sizeOf(s), depth: depth(s.values), n: i >= 0 ? i + 1 : undefined }; }), box);
    if (cap) cap.textContent = `${n.toLocaleString("en-US")} Flock cameras in view, as mapped on July 17, 2026, the snapshot the table was matched against. Streets: U.S. Census Bureau.`;
  };
  const drawn = new Set<HTMLElement>();
  const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); drawn.add(e.target as HTMLElement); void draw(e.target as HTMLElement); } }, { rootMargin: "300px" });
  panels.forEach((p) => io.observe(p));
  // Panels draw at their on-screen width, so redraw after the width changes (a rotated phone, a resized window).
  let lastW = innerWidth, timer = 0;
  addEventListener("resize", () => { clearTimeout(timer); timer = window.setTimeout(() => { if (innerWidth === lastW) return; lastW = innerWidth; drawn.forEach((fig) => void draw(fig)); }, 200); });
}

/** Words for each rung in a row's label; a record may name its own ("verified hits", "people charged"). */
const WORD: Record<keyof V, string> = { reads: "reads", alerts: "alerts", falseAlerts: "wrong alerts", stops: "stops", recoveries: "recoveries", arrests: "arrests" };
const INPUTS: (keyof V)[] = ["reads", "alerts", "falseAlerts"];
type LadderT = Data["ladders"][number];
const count = (n: number) => (n >= 1e6 ? big(n) : n.toLocaleString("en-US"));
/** A department's counts as the row's label: from the first step it reported to the last ("210.6 million reads to 74
 *  arrests"); counts that are all results are listed, and wrong alerts are given as a share of the alerts. */
function rangeText(L: LadderT): string {
  const ks = RUNGS.filter((k) => L.values[k] != null), w = (k: keyof V) => L.words?.[k] ?? WORD[k];
  const one = (k: keyof V) => `${count(L.values[k]!)} ${w(k)}`, a = ks[0]!, b = ks[ks.length - 1]!;
  if (b === "falseAlerts") return `${one(a)}, ${count(L.values[b]!)} ${L.words?.falseAlerts ?? "of them wrong"}`;
  return INPUTS.includes(a) ? `${one(a)} to ${one(b)}` : ks.map(one).join(", ");
}
const who = (L: LadderT) => `${/Sheriff/.test(L.agency) ? `${L.agency.replace(/ Sheriff.*$/, "")}, ${apState(L.state)}` : placeName(L.city, L.state)}${L.vendor ? ` (${L.vendor} readers)` : ""}`;
const shortPeriod = (L: LadderT) => apPeriod(L.period.replace(/ \(.*\)/, "").replace(/, cumulative.*$/, ""));

/** One line per department on a logarithmic scale, from the first count it reported to the last: open circles for
 *  reads and alerts, solid ones for stops, recoveries and arrests. Rows run from the largest count down. */
function ladderFigure(ladders: Data["ladders"], ctx: ReturnType<typeof figCtx>): string {
  const rows = ladders.filter((L) => RUNGS.filter((k) => L.values[k] != null).length >= 2).sort((a, b) => Math.max(...RUNGS.map((k) => b.values[k] ?? 0)) - Math.max(...RUNGS.map((k) => a.values[k] ?? 0)));
  const mixed = (L: LadderT) => !!(L.mixedWindows || L.vendorMix);
  const draw = (W: number, narrow: boolean) => {
    const x = logScale(1, 1e9, 6, W - 6), ticks = narrow ? [1, 1e3, 1e6, 1e9] : [1, 100, 1e4, 1e6, 1e8];
    const decades = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
    const axis = (y: number) => g(ticks.map((v, i) => text(i === 0 ? 0 : x(v), y, tickWords(v), { "text-anchor": i === 0 ? "start" : i === ticks.length - 1 && x(v) + textWidth(tickWords(v), 12) / 2 > W ? "end" : "middle" })).join(""), { class: "axis" });
    // the key: what an open and a solid circle stand for
    let out = circle(6, 9, 5, { fill: "#fff", stroke: "var(--ink)", "stroke-width": 1.75 }) + text(17, 13, "Reads or alerts", { "font-size": 12, fill: "var(--ink-2)" });
    const k2 = narrow ? { x: 0, y: 30 } : { x: 17 + textWidth("Reads or alerts", 12) + 22, y: 9 };
    out += circle(k2.x + 6, k2.y, 5, { fill: "var(--ink)", stroke: "#fff", "stroke-width": 1.5 }) + text(k2.x + 17, k2.y + 4, "A result: a stop, a recovery or an arrest", { "font-size": 12, fill: "var(--ink-2)" });
    const T = (narrow ? 58 : 38);
    out += axis(T);
    let y0 = T + 12;
    for (const L of rows) {
      const name = `${who(L)}${mixed(L) ? "*" : ""}`, per = shortPeriod(L), range = rangeText(L);
      const nameW = textWidth(name, 13, 700), perW = textWidth(per, 12), rangeW = textWidth(range, 12);
      const lines = !narrow && nameW + 8 + perW + 24 + rangeW <= W ? 1 : narrow && nameW + 8 + perW > W ? 3 : 2;
      out += line(0, y0 + 0.5, W, y0 + 0.5, { stroke: "var(--rule)" });
      out += text(0, y0 + 17, name, { "font-size": 13, "font-weight": 700, fill: "var(--ink)" });
      // the period follows the name, or takes its own line when the two do not fit
      out += lines === 3 ? text(0, y0 + 33, per, { "font-size": 12, fill: "var(--ink-3)" }) : text(nameW + 8, y0 + 17, per, { "font-size": 12, fill: "var(--ink-3)" });
      const ry = lines === 1 ? y0 + 17 : y0 + 17 + (lines - 1) * 16;
      out += text(lines === 1 ? W : 0, ry, range, { "font-size": 12, "font-weight": 600, fill: "var(--ink-2)", "text-anchor": lines === 1 ? "end" : "start" });
      const y = ry + 17, ks = RUNGS.filter((k) => L.values[k] != null), xs = ks.map((k) => x(L.values[k]!));
      out += g(decades.map((v) => line(x(v), y - 8, x(v), y + 8)).join(""), { class: "grid" });
      out += line(Math.min(...xs), y, Math.max(...xs), y, { stroke: "var(--ink-3)", "stroke-width": 2 });
      for (const k of ks) {
        const v = L.values[k]!, open = INPUTS.includes(k);
        const mark = circle(x(v), y, 5, open ? { fill: "#fff", stroke: "var(--ink)", "stroke-width": 1.75 } : { fill: "var(--ink)", stroke: "#fff", "stroke-width": 1.5 });
        out += tip(rect(x(v) - 9, y - 9, 18, 18, { fill: "transparent" }) + mark, `${v.toLocaleString("en-US")} ${L.words?.[k] ?? WORD[k]}`, `${who(L)}, ${apPeriod(L.period)}`);
      }
      y0 = y + 14;
    }
    out += axis(y0 + 16);
    return svg(W, y0 + 22, out, { cls: narrow ? "v-narrow" : "v-wide", label: `Dot chart on a logarithmic scale of the counts each department reported, from the first step to the last: ${rows.map((L) => `${who(L)}, ${shortPeriod(L)}: ${rangeText(L)}`).join("; ")}.` });
  };
  const cfg: FigureCfg = {
    title: "Reads run to the millions; arrests, to the dozens or hundreds",
    sub: "Counts from each department’s own audit or report, on a logarithmic scale, from the first step it reported to the last",
    notes: ["The rows are not a ranking: departments count different steps, over different periods and with different definitions. * Not every count comes from Flock cameras over one period: the readers include other makes or makes the report does not name, or the reads and alerts cover different windows. The table below gives each department’s details."],
    sources: [...new Set(rows.flatMap((L) => L.sources))],
  };
  return frame("ladders", cfg, ctx, draw(WIDE, false) + draw(NARROW, true), { cls: "ladder-ov" });
}

/** The ring shades a map uses, in the key: only those present on it. */
const ringKey = (depths: Set<number>) => [0, 1, 2, 3].filter((k) => depths.has(k)).map((k) => `<span class="mk-item"><i class="mk-ring d${k}"></i>${DEPTH_LABEL[k]}</span>`).join("");
const depthsOf = (sites: SiteT[]) => new Set(sites.map((s) => depth(s.values)));
/** The key under the national map: the gray dots are Flock cameras, the rings places with a published record. */
function nationalKey(sites: SiteT[]): string {
  return `<div class="map-key"><span class="mk-item"><i class="mk-dot"></i>Mapped Flock camera</span>${ringKey(depthsOf(sites))}<span class="mk-note">Each ring is a place with a published record, shaded by the furthest step it reports; its area follows the number of alerts, hits or calls there.</span></div>`;
}
/** The key under a city map: Flock cameras point the way they face; other makes are dots; rings are numbered as in the table. */
function cityKey(sites: SiteT[]): string {
  return `<div class="map-key"><span class="mk-item"><i class="mk-wedge"></i>Flock camera, pointing the way it faces</span><span class="mk-item"><i class="mk-dot"></i>Camera of another make</span>${ringKey(depthsOf(sites))}<span class="mk-note">Ring numbers match the table; a ring’s area follows the number of alerts, hits or calls at the site.</span></div>`;
}
