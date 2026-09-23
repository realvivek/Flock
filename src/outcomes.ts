/**
 * The outcomes page: every public record that ties a Flock camera to a result, on six shared rungs, at the finest level
 * each source supports. Data comes from public/data/outcomes.json, built by scripts/outcomes/build.mjs; the camera
 * scatter for the map panels loads separately and only when a panel is on screen.
 */
import { z } from "zod";
import { cite, escape } from "./ui/cite";
import { el } from "./ui/common";
import { BASE } from "./lib/base";
import { drawNational, drawCity, loadCameras, type Ring } from "./outcomes-map";

const Values = z.object({ reads: z.number().nullable(), alerts: z.number().nullable(), falseAlerts: z.number().nullable(), stops: z.number().nullable(), recoveries: z.number().nullable(), arrests: z.number().nullable() });
const Match = z.object({ osmId: z.number(), brand: z.string().nullable(), distanceM: z.number(), lon: z.number(), lat: z.number() }).passthrough().nullable();
const Site = z.object({ id: z.string(), source: z.string(), level: z.string(), agency: z.string(), city: z.string(), state: z.string(), period: z.string(), label: z.string(), lon: z.number().nullable(), lat: z.number().nullable(), geocode: z.string(), match: Match, nearest: Match, values: Values, extra: z.record(z.string(), z.unknown()).optional(), sources: z.array(z.string()), quadrant: z.string().optional(), mobile: z.boolean().optional(), cameras: z.number().optional() });
const File = z.object({
  generated: z.string(),
  cameras: z.object({ total: z.number(), flock: z.number(), asOf: z.string(), withDirection: z.number() }),
  rungs: z.array(z.object({ id: z.string(), label: z.string(), def: z.string() })),
  sites: z.array(Site),
  nashville: z.object({ totals: z.record(z.string(), z.number()), definitions: z.record(z.string(), z.string()), period: z.string(), sources: z.array(z.string()) }),
  windsor: z.object({ cameras: z.number(), cases: z.array(z.object({ date: z.string(), type: z.string(), site: z.string().nullable(), summary: z.string(), outcome: z.string() })), sources: z.array(z.string()) }),
  courts: z.array(z.object({ id: z.string(), case: z.string(), court: z.string(), state: z.string(), city: z.string().optional(), date: z.string(), crime: z.string(), role: z.string(), outcome: z.string(), sources: z.array(z.string()) })),
  districts: z.array(z.object({ agency: z.string(), city: z.string(), state: z.string(), unit: z.string(), asOf: z.string(), cameras: z.number(), sources: z.array(z.string()), rows: z.array(z.tuple([z.string(), z.number()])) })),
  ladders: z.array(z.object({ id: z.string(), agency: z.string(), city: z.string(), state: z.string(), period: z.string(), cameras: z.string(), vendorMix: z.boolean().optional(), values: Values, note: z.string(), sources: z.array(z.string()) })),
  national: z.object({ statements: z.array(z.object({ tag: z.string(), who: z.string(), text: z.string(), sources: z.array(z.string()) })), excluded: z.array(z.object({ what: z.string(), why: z.string(), sources: z.array(z.string()) })) }),
  coverage: z.object({ sites: z.number(), located: z.number(), matched: z.number(), bySource: z.record(z.string(), z.object({ sites: z.number(), located: z.number(), matched: z.number() })) }),
});
type Data = z.infer<typeof File>;
type SiteT = z.infer<typeof Site>;
type V = z.infer<typeof Values>;

const RUNGS: (keyof V)[] = ["reads", "alerts", "falseAlerts", "stops", "recoveries", "arrests"];
const fmt = (n: number | null | undefined) => n == null ? `<span class="na">not reported</span>` : n.toLocaleString("en-US");
const depth = (v: V): Ring["depth"] => (v.arrests || v.recoveries) ? 3 : v.stops ? 2 : (v.alerts || v.falseAlerts) ? 1 : 0;
const SOURCE_META: Record<string, { title: string; how: string; unit: string }> = {
  nashville: { title: "Nashville, Tennessee: 24 fixed sites and 4 mobile units, eight weeks in 2023", how: "Metro Nashville Police published verified hits, stops, searches, arrests and recoveries for each intersection in its ALPR pilot. A verified hit is a hit notification an employee confirmed before a stop was authorised. The report does not name the vendor of the fixed cameras. Sites were located as the node the two named roads share in OpenStreetMap.", unit: "Verified hits" },
  windsor: { title: "Windsor, Connecticut: 16 cameras at 14 sites, cases named to a camera", how: "The town's fact sheet lists every camera site and ten dated cases; four name the camera used. Counts here are those cases, not hit totals, which the town does not publish.", unit: "Cases" },
  story: { title: "Story County, Iowa: every wrong hot-list hit for one month, by location", how: "The sheriff's export of hits reviewed as wrong, with the coordinates of each hit. 77% were 'wrong state': the plate matched a list entry from another state. Correct hits were not exported, so the denominator is unknown. Each row carries a coordinate; few fall within 150 m of a camera on the crowd-sourced map, so either the county's cameras are largely unmapped or the coordinates are not the camera positions. The match column says which.", unit: "Hits reviewed" },
  tucson: { title: "Tucson, Arizona: dispatch calls with nature code FLOCK, last 45 days", how: "The city's calls-for-service layer carries a FLOCK nature code, used by the University of Arizona police, with the intersection and a disposition code. Codes: A arrest, B report, G citation, J no report, O other. The layer is a rolling window; the build keeps every snapshot.", unit: "Calls" },
  news: { title: "News reports that name the camera's road", how: "From a public dataset of 1,743 news-reported outcomes credited to Flock cameras, the records whose summary names the road or intersection of the camera. These are police statements relayed by local news; successes reach the news far more often than errors. Each row is one incident.", unit: "Incidents" },
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
function rates(v: V): string {
  const out: string[] = [];
  if (v.reads && v.alerts != null) out.push(`${(v.alerts / v.reads * 1e6).toFixed(1)} alerts per million reads`);
  if (v.alerts && v.falseAlerts != null) out.push(`${Math.round(v.falseAlerts / v.alerts * 100)}% of alerts wrong`);
  if (v.alerts && v.recoveries != null) out.push(`${(v.recoveries / v.alerts * 100).toFixed(1)} recoveries per 100 alerts`);
  if (v.alerts && v.arrests != null) out.push(`${(v.arrests / v.alerts * 100).toFixed(1)} arrests per 100 alerts`);
  return out.length ? `<p class="rates mono">${out.join(" · ")}</p>` : "";
}
const matchText = (s: SiteT) => s.lat == null ? `<span class="na">${escape(s.geocode)}</span>` : s.match ? `${s.match.distanceM} m${s.match.brand && s.match.brand !== "Flock Safety" ? ` (${escape(s.match.brand)})` : ""}` : s.nearest ? `<span class="na">none within 150 m (nearest ${s.nearest.distanceM.toLocaleString("en-US")} m)</span>` : `<span class="na">none nearby</span>`;

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
  const extraCol = key === "nashville" ? "<th>Searches</th>" : key === "story" ? "<th>Wrong state</th><th>Correct</th><th>Dismissed</th>" : key === "tucson" ? "<th>Dispositions</th>" : key === "news" || key === "court" ? "<th>What happened</th>" : key === "windsor" ? "<th>Cases</th>" : "";
  const rungHead = key === "story" ? `<th>${escape(meta.unit)}</th><th>Reviewed wrong</th>` : `<th>${escape(meta.unit)}</th><th>Wrong alerts</th><th>Stops</th><th>Recoveries</th><th>Arrests</th>`;
  t.innerHTML = `<thead><tr><th>#</th><th>Site</th>${rungHead}${extraCol}<th>Nearest mapped camera</th></tr></thead>`;
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
    else if (key === "windsor") extra = `<td class="small">${((x.cases as { date: string; type: string }[]) ?? []).map((c) => `${c.date} ${escape(c.type)}`).join("; ") || "<span class=na>none named to this site</span>"}</td>`;
    const rungs = key === "story" ? `<td class="rung">${fmt(s.values.alerts)}</td><td class="rung">${fmt(s.values.falseAlerts)}</td>` : `<td class="rung">${fmt(s.values.alerts)}</td><td class="rung">${fmt(s.values.falseAlerts)}</td><td class="rung">${fmt(s.values.stops)}</td><td class="rung">${fmt(s.values.recoveries)}</td><td class="rung">${fmt(s.values.arrests)}</td>`;
    tr.innerHTML = `<td class="mono">${i + 1}</td><td class="site-label">${escape(s.label)}${s.mobile ? ' <span class="mono">mobile</span>' : ""}${key === "news" || key === "court" ? `<div class="small">${escape(s.city)}, ${escape(s.state)} · ${escape(s.period)}</div>` : ""}</td>${rungs}${extra}<td class="small">${matchText(s)}</td>`;
    tb.appendChild(tr);
  });
  t.appendChild(tb); wrap.appendChild(t); block.appendChild(wrap);
  const ids = [...new Set(sites.flatMap((s) => s.sources))];
  if (key === "story") { const p = el("p", "fine"); p.textContent = "Hits reviewed counts every row at the location in the export, which holds only hits the office reviewed; 'reviewed wrong' is wrong state plus incorrect. The export has no field for stops or arrests."; block.appendChild(p); }
  if (key === "nashville") { const p = el("p", "fine"); const tt = d.nashville.totals; p.textContent = `Pilot totals in the report: ${tt.alerts} verified hits, ${tt.stops} stops, ${tt.searches} searches, ${tt.arrests} arrests, ${tt.recoveries} recoveries. Mobile units have no fixed site.`; block.appendChild(p); }
  block.appendChild(cite(ids, 3));
  return block;
}

export async function buildOutcomes(host: HTMLElement): Promise<void> {
  const raw = await fetch(`${BASE}data/outcomes.json`).then((r) => r.json());
  const d = File.parse(raw);
  const mapOff = new URLSearchParams(location.search).get("map") === "off";
  // Summary line
  const top = el("div", "coverage-strip sheet");
  top.innerHTML = `<div><span class="big">${d.cameras.flock.toLocaleString("en-US")}</span><span class="mono">Flock cameras mapped by OpenStreetMap contributors (${d.cameras.total.toLocaleString("en-US")} readers of all makes, as of ${d.cameras.asOf.slice(0, 10)})</span></div><div><span class="big">${d.coverage.sites}</span><span class="mono">locations with a published outcome record</span></div><div><span class="big">${d.coverage.matched}</span><span class="mono">of ${d.coverage.located} located sites within 150 m of a mapped camera</span></div>`;
  host.appendChild(top);
  // National map
  const nat = el("section", "source-block"); nat.id = "sites";
  nat.innerHTML = `<div class="sec-head"><h2>By camera site</h2><p class="lede small">Six sources publish outcomes that can be placed at a camera. Rings mark them on the map of every mapped Flock camera; ring size follows the count of hits or calls, and shade follows the deepest rung the record reaches: outline for alerts only, amber for stops, ink for a recovery or arrest.</p></div>`;
  if (!mapOff) { const fig = el("figure", "panel national"); fig.dataset.panel = "national"; fig.innerHTML = `<canvas aria-label="Every mapped Flock camera in the lower 48 states with the outcome sites marked"></canvas><figcaption class="mono"></figcaption>`; nat.appendChild(fig); }
  host.appendChild(nat);
  for (const key of ["nashville", "story", "tucson", "windsor", "court", "news"]) {
    let sites = d.sites.filter((s) => s.source === key);
    if (!sites.length) continue;
    let note = "";
    if (key === "story") { const singles = sites.filter((s) => (s.values.alerts ?? 0) < 2); sites = sites.filter((s) => (s.values.alerts ?? 0) >= 2); note = `${singles.length} further locations had one hit each in the month (${singles.filter((s) => s.match).length} of them within 150 m of a mapped camera); all are drawn on the panel.`; }
    const block = siteTable(d, sites, key);
    if (note) { const p = el("p", "fine"); p.textContent = note; block.appendChild(p); }
    host.appendChild(block);
  }
  // Windsor cases not tied to a site
  const wc = d.windsor.cases.filter((c) => !c.site);
  if (wc.length) { const p = el("p", "fine"); p.innerHTML = `Windsor also lists ${wc.length} cases without naming the camera: ${wc.map((c) => `${c.date} ${escape(c.type)} (${escape(c.outcome)})`).join("; ")}.`; host.appendChild(p); }
  // Courts without a site
  const cc = d.courts.filter((c) => !d.sites.some((s) => s.id === `court-${c.id}`));
  const cs = el("section", "source-block"); cs.innerHTML = `<div class="sec-head"><h3>Other court records citing a Flock read</h3><p class="lede small">Filings and opinions that rely on a read or alert without naming the camera. The legal outcome is the record's, not the case's final result.</p></div>`;
  const ct = el("div", "tablewrap"); ct.innerHTML = `<table class="rung-table"><thead><tr><th>Case</th><th>Court</th><th>Date</th><th>Offence</th><th>What the read did</th><th>Record</th></tr></thead><tbody>${cc.map((c) => `<tr><td>${escape(c.case)}</td><td class="small">${escape(c.court)}, ${escape(c.state)}</td><td class="mono">${escape(c.date)}</td><td class="small">${escape(c.crime)}</td><td class="small">${escape(c.role)}</td><td class="small">${escape(c.outcome)}</td></tr>`).join("")}</tbody></table>`;
  cs.appendChild(ct); cs.appendChild(cite([...new Set(cc.flatMap((c) => c.sources))], 2)); host.appendChild(cs);
  // Districts
  const ds = el("section", "source-block"); ds.id = "districts";
  ds.innerHTML = `<div class="sec-head"><h2>By district</h2><p class="lede small">Two agencies publish where their cameras are by district or police area. Neither breaks outcomes down the same way, so the agency totals sit beside the counts.</p></div>`;
  for (const g of d.districts) {
    const max = Math.max(...g.rows.map((r) => r[1]));
    const card = el("article", "district sheet");
    card.innerHTML = `<h3>${escape(g.agency)}</h3><p class="small">${escape(g.cameras.toLocaleString("en-US"))} cameras by ${escape(g.unit.toLowerCase())}, as of ${escape(g.asOf)}</p><div class="bars">${g.rows.map(([k, n]) => `<div class="row"><span class="k mono">${escape(k)}</span><span class="track"><span class="bar" style="width:${(n / max * 100).toFixed(0)}%"></span></span><span class="n mono">${n}</span></div>`).join("")}</div>`;
    card.appendChild(cite(g.sources, 2)); ds.appendChild(card);
  }
  host.appendChild(ds);
  // Agency ladders
  const ag = el("section", "source-block"); ag.id = "agencies";
  ag.innerHTML = `<div class="sec-head"><h2>By agency</h2><p class="lede small">Audits and annual reports that give some rungs of the ladder for a whole programme. Rates are computed only where both rungs come from the same report. Definitions differ: an alert may be an unverified match or a verified hit, and an arrest may be 'directly related' or 'assisted'; the note says which.</p><div class="rung-legend">${d.rungs.map((r) => `<span><b>${escape(r.label)}</b> ${escape(r.def)}</span>`).join("")}</div></div>`;
  const lw = el("div", "tablewrap"); const lt = el("table", "rung-table ladders");
  lt.innerHTML = `<thead><tr><th>Agency</th><th>Period</th><th>Reads</th><th>Alerts</th><th>Wrong alerts</th><th>Stops</th><th>Recoveries</th><th>Arrests</th></tr></thead>`;
  const ltb = el("tbody");
  for (const L of d.ladders) {
    const tr = el("tr", "ladder"); tr.id = `ladder-${L.id}`;
    tr.innerHTML = `<td class="site-label">${escape(L.agency)}<div class="small">${escape(L.cameras)}${L.vendorMix ? " · mixed vendors" : ""}</div></td><td class="mono small">${escape(L.period)}</td>${rungCells(L.values, { bars: true })}`;
    ltb.appendChild(tr);
    const tr2 = el("tr", "ladder-note"); const td = el("td"); td.colSpan = 8; td.innerHTML = `${rates(L.values)}<p class="small">${escape(L.note)}</p>`; td.appendChild(cite(L.sources, 3)); tr2.appendChild(td); ltb.appendChild(tr2);
  }
  lt.appendChild(ltb); lw.appendChild(lt); ag.appendChild(lw); host.appendChild(ag);
  // National
  const ns = el("section", "source-block"); ns.id = "national";
  ns.innerHTML = `<div class="sec-head"><h2>National statements</h2><p class="lede small">Figures that describe the whole network rather than a place, tagged by who states them.</p></div>`;
  for (const s of d.national.statements) { const p = el("div", "stmt sheet"); p.innerHTML = `<span class="tag ${s.tag === "flock" ? "tag-flock" : "tag-indep"}">${s.tag === "flock" ? "Flock" : "Independent"}</span> <b>${escape(s.who)}.</b> ${escape(s.text)}`; p.appendChild(cite(s.sources, 2)); ns.appendChild(p); }
  const ex = el("div", "excluded"); ex.innerHTML = `<h3>Records found but not placed</h3><ul>${d.national.excluded.map((e) => `<li><b>${escape(e.what)}.</b> ${escape(e.why)}.</li>`).join("")}</ul>`; ns.appendChild(ex);
  host.appendChild(ns);
  // Coverage
  const cv = el("section", "source-block"); cv.id = "coverage";
  const by = Object.entries(d.coverage.bySource).map(([k, v]) => `<tr><td>${escape(SOURCE_META[k]?.title.split(":")[0] ?? k)}</td><td class="mono">${v.sites}</td><td class="mono">${v.located}</td><td class="mono">${v.matched}</td></tr>`).join("");
  cv.innerHTML = `<div class="sec-head"><h2>Coverage</h2><p class="lede small">What this page can and cannot say. ${d.cameras.flock.toLocaleString("en-US")} Flock cameras are mapped; ${d.coverage.sites} locations have a published outcome record, ${d.coverage.matched} of them within 150 m of a mapped camera. Every other camera on the map has no public outcome record at all.</p></div><div class="tablewrap"><table class="rung-table"><thead><tr><th>Source</th><th>Locations</th><th>Located</th><th>Matched to a mapped camera</th></tr></thead><tbody>${by}</tbody></table></div><p class="small">What would extend it: Flock's software exports a hot-list alert report with the camera name, timestamp, plate and list, and since September 2022 an outcome field ('Apprehended' or 'Not Apprehended') officers can set on alerts and searches. Agencies release these under public-records law; Story County's export above is one. A request for the alert report and the outcome field, plus the agency's camera inventory, gives the per-camera ladder for any agency.</p><p class="fine">Camera positions: OpenStreetMap contributors via the deflock-data export, ODbL. Built ${escape(d.generated)}.</p>`;
  cv.appendChild(cite(["deflock-data"], 2));
  host.appendChild(cv);
  if (!mapOff) void drawPanels(d, host);
}

async function drawPanels(d: Data, host: HTMLElement): Promise<void> {
  const panels = [...host.querySelectorAll<HTMLElement>(".panel")];
  if (!panels.length) return;
  const ringOf = (s: SiteT, n?: number): Ring => ({ lon: s.lon!, lat: s.lat!, size: s.values.alerts ?? s.values.falseAlerts ?? 1, depth: depth(s.values), n });
  const draw = async (fig: HTMLElement) => {
    const cams = await loadCameras();
    const canvas = fig.querySelector("canvas")!; const cap = fig.querySelector("figcaption")!;
    const key = fig.dataset.panel!;
    if (key === "national") { drawNational(canvas, cams.points, d.sites.filter((s) => s.lat != null).map((s) => ringOf(s))); cap.textContent = `${cams.count.toLocaleString("en-US")} mapped Flock cameras; ${d.coverage.located} outcome locations marked`; return; }
    const sites = d.sites.filter((s) => s.source === key && s.lat != null);
    if (!sites.length) { cap.textContent = "No located sites"; return; }
    const lats = sites.map((s) => s.lat!), lons = sites.map((s) => s.lon!);
    const pad = 3000 / 111320; const k = Math.cos(lats[0]! * Math.PI / 180);
    const box = { s: Math.min(...lats) - pad, n: Math.max(...lats) + pad, w: Math.min(...lons) - pad / k, e: Math.max(...lons) + pad / k };
    // Numbers match the table rows; Story County's one-hit locations are drawn but not numbered.
    const listed = key === "story" ? d.sites.filter((s) => s.source === key && (s.values.alerts ?? 0) >= 2) : d.sites.filter((s) => s.source === key);
    const n = drawCity(canvas, cams.points, sites.map((s) => { const i = listed.indexOf(s); return ringOf(s, i >= 0 ? i + 1 : undefined); }), box);
    cap.textContent = `${n.toLocaleString("en-US")} mapped Flock cameras in view; numbers match the table`;
  };
  const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); void draw(e.target as HTMLElement); } }, { rootMargin: "200px" });
  panels.forEach((p) => io.observe(p));
}
