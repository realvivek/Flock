/**
 * The outcomes page: every public record that ties a Flock camera to a result, on six shared rungs, at the finest level
 * each source supports. Data comes from public/data/outcomes.json, built by scripts/outcomes/build.mjs; the camera
 * scatter for the map panels loads separately and only when a panel is on screen.
 */
import { z } from "zod";
import { cite, escape } from "./ui/cite";
import { el, initTableWraps } from "./ui/common";
import { BASE } from "./lib/base";
import { svg, g, line, text, circle, tip, logScale, rect } from "./viz/svg";
import { tickWords, apState, apDate, apPeriod, placeName, ap, typeset } from "./viz/format";
import { figCtx } from "./ui/figs";
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
  ladders: z.array(z.object({ id: z.string(), agency: z.string(), city: z.string(), state: z.string(), period: z.string(), cameras: z.string(), vendorMix: z.boolean().optional(), vendor: z.string().optional(), mixedWindows: z.boolean().optional(), noRates: z.boolean().optional(), values: Values, note: z.string(), sources: z.array(z.string()) })),
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
  story: { title: "Story County, Iowa: a month of hot-list hits from the sheriff’s in-car readers, by location", how: "The sheriff’s office’s “Erroneous hotlist hits” report from its Axon in-car readers (not Flock cameras), with the coordinates of each hit: 214 rows from NCIC lists, 165 of them marked “wrong state,” meaning the plate matched a list entry from another state. Accurate hits and total reads were not in the report. A hit’s location is where a patrol car was, so these records are mapped but not matched to fixed cameras.", unit: "Hits in the report" },
  tucson: { title: "Tucson, Ariz.: dispatch calls with nature code FLOCK, last 45 days", how: "The city’s calls-for-service layer carries a FLOCK nature code, used by the University of Arizona police, with the intersection and a disposition code. Codes: A arrest, B report, G citation, J no report, O other. The layer is a rolling window; the build keeps every snapshot.", unit: "Calls" },
  news: { title: "News reports that name the camera’s road", how: "From a public dataset of 1,743 news-reported outcomes credited to Flock cameras, the records whose summary names the road or intersection of the camera. These are police statements relayed by local news; successes reach the news far more often than errors. Each row is one incident.", unit: "Incidents" },
  court: { title: "Court opinions that name the camera", how: "An appellate opinion that identifies the camera whose hot-list alert began the case.", unit: "Alerts" },
};
const CITY_PANELS: { key: string; title: string; filter: (s: SiteT) => boolean }[] = [
  { key: "nashville", title: "Nashville", filter: (s) => s.source === "nashville" },
  { key: "windsor", title: "Windsor", filter: (s) => s.source === "windsor" },
  { key: "story", title: "Story County", filter: (s) => s.source === "story" },
  { key: "tucson", title: "Tucson", filter: (s) => s.source === "tucson" },
];

function rungCells(v: V, opts: { bars?: boolean } = {}): string {
  const max = Math.max(1, ...RUNGS.map((r) => Math.log10((v[r] ?? 0) + 1)));
  return RUNGS.map((r) => { const n = v[r]; const w = n == null ? 0 : (Math.log10(n + 1) / max) * 100; return `<td class="rung ${n == null ? "is-na" : ""}"><span class="v">${fmt(n)}</span>${opts.bars && n != null ? `<span class="bar" style="width:${w.toFixed(0)}%"></span>` : ""}</td>`; }).join("");
}
/** Rates between rungs of one record. Reads and alerts from different sets of readers (`vendorMix`) give no alert rate. */
function rates(v: V, o: { vendorMix?: boolean } = {}): string {
  const out: string[] = [];
  if (v.reads && v.alerts != null && !o.vendorMix) out.push(`${(v.alerts / v.reads * 1e6).toFixed(1)} alerts per million reads`);
  if (v.alerts && v.falseAlerts != null) { const p = v.falseAlerts / v.alerts * 100; out.push(`${p < 1 ? p.toFixed(1) : Math.round(p)}% of alerts wrong`); }
  const per = (n: number, what: string) => { const r = n / v.alerts! * 100; return r >= 0.1 ? `${r.toFixed(1)} ${what} per 100 alerts` : `${(n / v.alerts! * 1e5).toFixed(1)} ${what} per 100,000 alerts`; };
  if (v.alerts && v.recoveries != null) out.push(per(v.recoveries, "recoveries"));
  if (v.alerts && v.arrests != null) out.push(per(v.arrests, "arrests"));
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
  if (CITY_PANELS.some((p) => p.key === key)) { const fig = el("figure", "panel"); fig.dataset.panel = key; fig.innerHTML = `<canvas aria-label="Map of ${escape(meta.title)}"></canvas><figcaption class="mono"></figcaption>`; block.appendChild(fig); }
  const wrap = el("div", "tablewrap");
  const t = el("table", "rung-table");
  const extraCol = key === "nashville" ? "<th>Searches</th>" : key === "story" ? "<th>Wrong state</th><th>Correct</th><th>Dismissed</th>" : key === "tucson" ? "<th>Dispositions</th>" : key === "news" || key === "court" ? "<th>What happened</th>" : key === "windsor" ? "<th>Cases named here</th>" : "";
  // Rung columns this source reports on at least one row; a rung it never reports is named once above the table instead.
  const cols: { k: keyof V; label: string }[] = key === "story" ? [{ k: "alerts", label: meta.unit }, { k: "falseAlerts", label: "Reviewed wrong" }] : [{ k: "alerts", label: meta.unit }, ...(["falseAlerts", "stops", "recoveries", "arrests"] as const).map((k) => ({ k, label: RUNG_COLS[k]! }))];
  const shown = cols.filter((c) => sites.some((s) => s.values[c.k] != null));
  const unreported = cols.filter((c) => !shown.includes(c)).map((c) => c.label.toLowerCase());
  const note = el("p", "fine table-note");
  note.textContent = `Nearest mapped camera: within 150 meters counts as a match.${unreported.length ? ` Not reported by this source: ${unreported.join(", ")}.` : ""}`;
  block.appendChild(note);
  t.innerHTML = `<thead><tr><th>#</th><th>Site</th>${shown.map((c) => `<th>${escape(c.label)}</th>`).join("")}${extraCol}<th>Nearest mapped camera</th></tr></thead>`;
  const tb = el("tbody");
  sites.forEach((s, i) => {
    const tr = el("tr", "site"); tr.id = s.id;
    const x = (s.extra ?? {}) as Record<string, unknown>;
    let extra = "";
    if (key === "nashville") extra = `<td>${fmt(x.searches as number)}</td>`;
    else if (key === "story") extra = `<td>${fmt(x.wrongState as number)}</td><td>${fmt(x.correct as number)}</td><td>${fmt(x.dismissed as number)}</td>`;
    else if (key === "tucson") extra = `<td class="small">${Object.entries((x.dispositions as Record<string, number>) ?? {}).map(([k, n]) => `${escape(k)} ${n}`).join(", ")}</td>`;
    else if (key === "news") extra = `<td class="small">${escape(String(x.crime ?? ""))}: ${escape(String(x.outcome ?? ""))} <a href="${escape(String(x.url ?? "#"))}" rel="noopener noreferrer" target="_blank">report</a></td>`;
    else if (key === "court") extra = `<td class="small">${escape(String(x.case ?? ""))}: ${escape(String(x.outcome ?? ""))}</td>`;
    else if (key === "windsor") extra = `<td class="small">${((x.cases as { date: string; type: string }[]) ?? []).map((c) => `${apDate(c.date)}: ${escape(c.type)}`).join("; ") || "<span class=na>none named to this site</span>"}</td>`;
    const rungs = shown.map((c) => `<td class="rung">${fmt(s.values[c.k])}</td>`).join("");
    const cats = key === "story" ? Object.entries((x.categories as Record<string, number>) ?? {}).map(([k, n]) => `${n} ${escape(k.toLowerCase())}`).join(", ") : "";
    const sub = key === "news" || key === "court" ? `<div class="small">${escape(placeName(s.city, s.state))} · ${s.period ? `<span class="nw">${escape(apPeriod(s.period))}</span>` : "date not stated"}</div>` : cats ? `<div class="small">${cats}</div>` : "";
    tr.innerHTML = `<td class="mono">${i + 1}</td><td class="site-label">${escape(s.label)}${sub}</td>${rungs}${extra}<td class="small">${matchText(s)}</td>`;
    tb.appendChild(tr);
  });
  t.appendChild(tb); wrap.appendChild(t); block.appendChild(wrap);
  const ids = [...new Set(sites.flatMap((s) => s.sources))];
  if (key === "story") { const p = el("p", "fine"); p.textContent = "Hits in the report counts every row at the location in the export, which holds only hits the office reviewed; “reviewed wrong” is wrong state plus incorrect. The export has no field for stops or arrests."; block.appendChild(p); }
  if (key === "nashville") { const p = el("p", "fine"); const tt = d.nashville.totals; p.textContent = `Pilot totals in the report: ${tt.alerts} verified hits, ${tt.stops} stops, ${tt.searches} searches, ${tt.arrests} arrests, ${tt.recoveries} recoveries. Mobile units have no fixed site.`; block.appendChild(p); }
  block.appendChild(cite(ids, 3));
  return block;
}

export async function buildOutcomes(host: HTMLElement): Promise<void> {
  const raw = await fetch(`${BASE}data/outcomes.json`).then((r) => r.json());
  const d = typeset(File.parse(raw));
  const mapOff = new URLSearchParams(location.search).get("map") === "off";
  // Summary line
  const top = el("div", "coverage-strip sheet");
  top.innerHTML = `<div><span class="big">${d.cameras.flock.toLocaleString("en-US")}</span><span class="mono">Flock cameras mapped by OpenStreetMap contributors on ${apDate(d.cameras.asOf.slice(0, 10))}, the snapshot the records were matched against (${d.cameras.total.toLocaleString("en-US")} readers of all makes)</span></div><div><span class="big">${d.coverage.sites}</span><span class="mono">locations with a published outcome record</span></div><div><span class="big">${d.coverage.matched}</span><span class="mono">of ${d.coverage.located} located sites within 150 m of a mapped camera</span></div>`;
  host.appendChild(top);
  // National map
  const nat = el("section", "source-block"); nat.id = "sites";
  nat.innerHTML = `<div class="sec-head"><h2>By camera site</h2><p class="lede small">Six sources publish outcomes that can be placed at a camera. Rings mark them on the map of every mapped Flock camera; a ring’s area follows the count of hits or calls, and its shade the deepest rung the record reaches.</p></div>`;
  if (!mapOff) { const fig = el("figure", "panel national"); fig.dataset.panel = "national"; fig.innerHTML = `<canvas aria-label="Every mapped Flock camera in the United States with the outcome sites marked"></canvas><figcaption class="mono"></figcaption>`; nat.appendChild(fig); nat.insertAdjacentHTML("beforeend", mapKey()); }
  host.appendChild(nat);
  for (const key of ["nashville", "story", "tucson", "windsor", "court", "news"]) {
    let sites = d.sites.filter((s) => s.source === key);
    if (!sites.length) continue;
    let note = "";
    if (key === "story") { const singles = sites.filter((s) => (s.values.alerts ?? 0) < 2); sites = sites.filter((s) => (s.values.alerts ?? 0) >= 2); const near = singles.filter((s) => s.match).length; note = `Another ${singles.length} locations had one hit each in the month, ${near ? `${ap(near)} of them` : "none"} within 150 meters of a mapped camera; those inside the map frame are drawn as unnumbered rings.`; }
    const block = siteTable(d, sites, key);
    if (note) { const p = el("p", "fine"); p.textContent = note; block.appendChild(p); }
    // Windsor cases not tied to a site belong with the Windsor table
    const wc = key === "windsor" ? d.windsor.cases.filter((c) => !c.site) : [];
    if (wc.length) { const p = el("p", "fine"); p.innerHTML = `Windsor also lists ${ap(wc.length)} cases without naming the camera: ${wc.map((c) => `${apDate(c.date)}, ${escape(c.type.charAt(0).toLowerCase() + c.type.slice(1))} (${escape(c.outcome)})`).join("; ")}.`; block.appendChild(p); }
    host.appendChild(block);
  }
  // Courts without a site
  const cc = d.courts.filter((c) => !d.sites.some((s) => s.id === `court-${c.id}`));
  const cs = el("section", "source-block"); cs.innerHTML = `<div class="sec-head"><h3>Other court records citing a Flock read</h3><p class="lede small">Filings and opinions that rely on a read or alert without naming the camera. The legal outcome is the record’s, not the case’s final result.</p></div>`;
  const ct = el("div", "tablewrap"); ct.innerHTML = `<table class="rung-table"><thead><tr><th>Case</th><th>Court</th><th>Date</th><th>Offense</th><th>What the read did</th><th>Record</th></tr></thead><tbody>${cc.map((c) => `<tr><td>${escape(c.case)}</td><td class="small">${escape(c.court)}</td><td class="small nw">${escape(apDate(c.date))}</td><td class="small">${escape(c.crime)}</td><td class="small">${escape(c.role)}</td><td class="small">${escape(c.outcome)}</td></tr>`).join("")}</tbody></table>`;
  cs.appendChild(ct); cs.appendChild(cite([...new Set(cc.flatMap((c) => c.sources))], 2)); host.appendChild(cs);
  // Districts
  const ds = el("section", "source-block"); ds.id = "districts";
  ds.innerHTML = `<div class="sec-head"><h2>By district</h2><p class="lede small">Two agencies publish where their cameras are by district or police area. Neither breaks outcomes down the same way, so the agency totals sit beside the counts.</p></div>`;
  for (const g of d.districts) {
    const max = Math.max(...g.rows.map((r) => r[1]));
    const card = el("article", "district sheet");
    card.innerHTML = `<h3>${escape(g.agency)}</h3><p class="small">${escape(g.cameras.toLocaleString("en-US"))} cameras by ${escape(g.unit.toLowerCase())}, as of ${escape(/^\d{4}-\d{2}(-\d{2})?$/.test(g.asOf) ? apDate(g.asOf) : g.asOf)}</p><div class="bars">${g.rows.map(([k, n]) => `<div class="row"><span class="k mono">${escape(k)}</span><span class="track"><span class="bar" style="width:${(n / max * 100).toFixed(0)}%"></span></span><span class="n mono">${n}</span></div>`).join("")}</div>`;
    card.appendChild(cite(g.sources, 2)); ds.appendChild(card);
  }
  host.appendChild(ds);
  // Agency ladders
  const ag = el("section", "source-block"); ag.id = "agencies";
  ag.innerHTML = `<div class="sec-head"><h2>By agency</h2><p class="lede small">Audits and annual reports that give some rungs of the ladder for a whole program. Rates are computed only where both rungs come from the same report. Definitions differ: an alert may be an unverified match or a verified hit, and an arrest may be “directly related” or “assisted”; the note says which. Amber bars show each figure on a log scale against the largest figure in its row.</p><div class="rung-legend">${d.rungs.map((r) => `<span><b>${escape(r.label)}</b> ${escape(r.def)}</span>`).join("")}</div></div>`;
  const ov = el("figure", "fig ladder-ov");
  ov.innerHTML = `<figcaption class="fig-head"><h3 class="fig-title">Every rung each audit reports, on one scale</h3><p class="fig-sub">Counts per department, on a logarithmic scale. Hollow marks: reads and alerts from different windows, or readers of several makes.</p></figcaption><div class="fig-body"></div><div class="ladder-legend">${LADDER_RUNGS.map((r, i) => `<span><i style="background:${ORD[i]}"></i>${r.label}</span>`).join("")}</div>`;
  ag.appendChild(ov);
  // drawn at the width it is shown at (once the section is in the page), so its labels keep their size on a phone
  const drawOv = () => { ov.querySelector(".fig-body")!.innerHTML = ladderOverview(d.ladders, Math.max(300, Math.min(ov.clientWidth || 640, 760))); };
  let ovW = innerWidth; addEventListener("resize", () => { if (innerWidth !== ovW) { ovW = innerWidth; drawOv(); } });
  initTooltips(ov);
  const lw = el("div", "tablewrap"); const lt = el("table", "rung-table ladders");
  lt.innerHTML = `<thead><tr><th>Agency</th><th>Period</th><th>Reads</th><th>Alerts</th><th>Wrong alerts</th><th>Stops</th><th>Recoveries</th><th>Arrests</th></tr></thead>`;
  const ltb = el("tbody");
  for (const L of d.ladders) {
    const tr = el("tr", "ladder"); tr.id = `ladder-${L.id}`;
    tr.innerHTML = `<td class="site-label">${escape(L.agency)}<div class="small">${escape(L.cameras)}${L.vendorMix ? " · mixed vendors" : ""}</div></td><td class="small">${escape(apPeriod(L.period))}</td>${rungCells(L.values, { bars: true })}`;
    ltb.appendChild(tr);
    const tr2 = el("tr", "ladder-note"); const td = el("td"); td.colSpan = 8; td.innerHTML = `${L.mixedWindows || L.noRates ? "" : rates(L.values, L)}<p class="small">${escape(L.note)}</p>`; td.appendChild(cite(L.sources, 3)); tr2.appendChild(td); ltb.appendChild(tr2);
  }
  lt.appendChild(ltb); lw.appendChild(lt); ag.appendChild(lw); host.appendChild(ag);
  drawOv();
  // National
  const ns = el("section", "source-block"); ns.id = "national";
  ns.innerHTML = `<div class="sec-head"><h2>National statements</h2><p class="lede small">Figures that describe the whole network rather than a place, tagged by who states them.</p></div>`;
  for (const s of d.national.statements) { const p = el("div", "stmt sheet"); p.innerHTML = `<span class="tag ${s.tag === "flock" ? "tag-flock" : "tag-indep"}">${s.tag === "flock" ? "Flock" : "Independent"}</span> <b>${escape(s.who)}.</b> ${escape(s.text)}`; p.appendChild(cite(s.sources, 2)); ns.appendChild(p); }
  const ex = el("div", "excluded"); ex.innerHTML = `<h3>Records found but not placed</h3><ul>${d.national.excluded.map((e) => `<li><b>${escape(e.what)}.</b> ${escape(e.why)}.</li>`).join("")}</ul>`; ns.appendChild(ex);
  host.appendChild(ns);
  // Coverage
  const cv = el("section", "source-block"); cv.id = "coverage";
  const by = Object.entries(d.coverage.bySource).map(([k, v]) => `<tr><td>${escape(SOURCE_META[k]?.title.split(":")[0] ?? k)}</td><td class="mono">${v.sites}</td><td class="mono">${v.located}</td><td class="mono">${v.matched}</td></tr>`).join("");
  cv.innerHTML = `<div class="sec-head"><h2>Coverage</h2><p class="lede small">What this page can and cannot say. When the records were matched, ${d.cameras.flock.toLocaleString("en-US")} Flock cameras were on the map; ${d.coverage.sites} locations have a published outcome record, ${d.coverage.matched} of them within 150 meters of a mapped camera. Every other camera on the map has no public outcome record at all.</p></div><div class="tablewrap"><table class="rung-table"><thead><tr><th>Source</th><th>Locations</th><th>Located</th><th>Matched to a mapped camera</th></tr></thead><tbody>${by}</tbody></table></div><p class="small">What would extend it: Flock’s software exports a hot-list alert report with the camera name, timestamp, plate and list, and since September 2022 an outcome field (“Apprehended” or “Not Apprehended”) officers can set on alerts and searches. Agencies release these under public-records law; Story County’s export above is one. A request for the alert report and the outcome field, plus the agency’s camera inventory, gives the per-camera ladder for any agency.</p><p class="fine">Camera positions: OpenStreetMap contributors via the deflock-data export, ODbL. Updated ${escape(apDate(d.generated))}.</p>`;
  cv.appendChild(cite(["deflock-data"], 2));
  host.appendChild(cv);
  initTableWraps();
  if (!mapOff) void drawPanels(d, host);
}

async function drawPanels(d: Data, host: HTMLElement): Promise<void> {
  const panels = [...host.querySelectorAll<HTMLElement>(".panel")];
  if (!panels.length) return;
  const xy: Record<string, [number, number]> = await fetch(`${BASE}data/basemaps/outcome-sites.json`).then((r) => r.json());
  const sizeOf = (s: SiteT) => s.values.alerts ?? s.values.falseAlerts ?? 1;
  const draw = async (fig: HTMLElement) => {
    const canvas = fig.querySelector("canvas")!, cap = fig.querySelector("figcaption")!;
    const key = fig.dataset.panel!;
    if (key === "national") {
      const rings: Ring[] = d.sites.filter((s) => xy[s.id]).map((s) => ({ x: xy[s.id]![0], y: xy[s.id]![1], size: sizeOf(s), depth: depth(s.values) }));
      const n = await drawNational(canvas, rings);
      const snap = String(figCtx().stats.snapshot?.value ?? "");
      cap.textContent = `Each gray dot is one of the ${n.toLocaleString("en-US")} Flock cameras mapped${snap ? ` as of ${apDate(snap)}` : ""}; the ${rings.length} rings are outcome locations. Alaska and Hawaii are shown at different scales.`;
      return;
    }
    const sites = d.sites.filter((s) => s.source === key && s.lat != null);
    if (!sites.length) { cap.textContent = "No located sites"; return; }
    // Numbers match the table rows; Story County’s one-hit locations are drawn but not numbered.
    const listed = key === "story" ? d.sites.filter((s) => s.source === key && (s.values.alerts ?? 0) >= 2) : d.sites.filter((s) => s.source === key);
    // Frame the numbered sites, padded by 12% of their spread and at least 400 m.
    const framed = listed.filter((s) => s.lat != null), f = framed.length ? framed : sites;
    const lats = f.map((s) => s.lat!), lons = f.map((s) => s.lon!);
    const k = Math.cos(((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI / 180), minPad = 400 / 111320;
    const padLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.12, minPad), padLon = Math.max((Math.max(...lons) - Math.min(...lons)) * 0.12, minPad / k);
    const box = { s: Math.min(...lats) - padLat, n: Math.max(...lats) + padLat, w: Math.min(...lons) - padLon, e: Math.max(...lons) + padLon };
    const n = await drawCity(canvas, key, sites.map((s) => { const i = listed.indexOf(s); return { lon: s.lon!, lat: s.lat!, size: sizeOf(s), depth: depth(s.values), n: i >= 0 ? i + 1 : undefined }; }), box);
    cap.textContent = `Each wedge is one of the ${n.toLocaleString("en-US")} Flock cameras in view as mapped on July 17, 2026, pointing the way it faces; numbers match the table. Streets: U.S. Census Bureau.`;
  };
  const drawn = new Set<HTMLElement>();
  const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); drawn.add(e.target as HTMLElement); void draw(e.target as HTMLElement); } }, { rootMargin: "300px" });
  panels.forEach((p) => io.observe(p));
  // Panels draw at their on-screen width, so redraw after the width changes (a rotated phone, a resized window).
  let lastW = innerWidth, timer = 0;
  addEventListener("resize", () => { clearTimeout(timer); timer = window.setTimeout(() => { if (innerWidth === lastW) return; lastW = innerWidth; drawn.forEach((fig) => void draw(fig)); }, 200); });
}

const ORD = ["#d9a447", "#c4851a", "#a86c10", "#87530b", "#643c07", "#432704"];
const LADDER_RUNGS: { k: keyof V; label: string }[] = [{ k: "reads", label: "Plate reads" }, { k: "alerts", label: "Alerts" }, { k: "falseAlerts", label: "Wrong alerts" }, { k: "stops", label: "Stops" }, { k: "recoveries", label: "Recoveries" }, { k: "arrests", label: "Arrests" }];
/** One row per department, a dot per reported rung on a logarithmic scale, coloured light to dark down the ladder. */
function ladderOverview(ladders: Data["ladders"], W: number): string {
  const rows = ladders.filter((L) => LADDER_RUNGS.filter((r) => L.values[r.k] != null).length >= 2);
  const narrow = W < 560, LW = narrow ? 138 : 190, R = 14, T = 30, rowH = 36;
  const x = logScale(1, 1e9, LW + 8, W - R);
  const dec = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
  let out = g(dec.map((v) => line(x(v), T - 6, x(v), T + rows.length * rowH)).join(""), { class: "grid" });
  // every power of 10 has a grid line; labels skip as many as the width needs
  const shown = dec.filter((_, i) => i % (narrow ? 3 : 2) === 0);
  out += g(shown.map((v, i) => text(x(v), T - 12, tickWords(v), { "text-anchor": i === shown.length - 1 && x(v) + 30 > W ? "end" : "middle" })).join(""), { class: "axis" });
  rows.forEach((L, i) => {
    const y = T + i * rowH + rowH / 2, hollow = !!(L.mixedWindows || L.vendorMix);
    out += line(0, y + rowH / 2, W, y + rowH / 2, { stroke: "var(--rule)" });
    const who = /Sheriff/.test(L.agency) ? `${L.agency.replace(/ Sheriff.*$/, "")}, ${apState(L.state)}` : placeName(L.city, L.state);
    out += text(LW - 4, y - 2, who, { "text-anchor": "end", "font-size": 12, "font-weight": 600, fill: "var(--ink)" });
    out += text(LW - 4, y + 11, apPeriod(L.period.replace(/ \(.*\)/, "")), { "text-anchor": "end", "font-size": 11.5, fill: "var(--ink-3)" });
    LADDER_RUNGS.forEach((r, k) => {
      const v = L.values[r.k];
      if (v == null) return;
      const mark = circle(x(v), y, 5.5, hollow ? { fill: "#fff", stroke: ORD[k], "stroke-width": 2.5 } : { fill: ORD[k], stroke: "#fff", "stroke-width": 1.5 });
      out += tip(rect(x(v) - 9, y - 9, 18, 18, { fill: "transparent" }) + mark, v.toLocaleString("en-US"), `${L.agency}, ${apPeriod(L.period)}: ${r.label.toLowerCase()}`);
    });
  });
  return svg(W, T + rows.length * rowH + 4, out, { label: "Dot chart of the counts each department’s audit reports, from plate reads to arrests, on a logarithmic scale." });
}

/** The key under the maps: what a ring’s size and shade mean, and the camera symbols. */
export function mapKey(): string {
  return `<div class="map-key"><span class="mk-item"><i class="mk-ring d1"></i>${DEPTH_LABEL[1]}</span><span class="mk-item"><i class="mk-ring d2"></i>${DEPTH_LABEL[2]}</span><span class="mk-item"><i class="mk-ring d3"></i>${DEPTH_LABEL[3]}</span><span class="mk-item"><i class="mk-wedge"></i>Flock camera, facing</span><span class="mk-item"><i class="mk-dot"></i>Other make</span><span class="mk-note">Ring area follows the number of hits, alerts or calls at the site.</span></div>`;
}
