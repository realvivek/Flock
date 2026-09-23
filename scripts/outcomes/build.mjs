// Builds public/data/outcomes.json and public/data/cameras-flock.json from the hand-entered and fetched sources
// under data/outcomes/. Geocoding uses Nominatim (one request a second, cached in data/outcomes/geocode-cache.json);
// intersections are located as the closest approach of the two roads' geometries. Every located record is matched to
// the nearest mapped camera (any vendor) and the distance is kept, so the page can say how close the match is.
// Usage: node scripts/outcomes/build.mjs [path/to/cameras.geojson]   (downloads the deflock-data export otherwise)
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, "data/outcomes/sources");
const CACHE = path.join(ROOT, "data/outcomes/geocode-cache.json");
const read = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"));
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
const UA = "flock-anatomy-site/1.0 (https://realvivek.github.io/Flock/; yalmnchl@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastReq = 0;
async function nominatim(q) {
  if (cache[q]) return cache[q];
  const wait = 1100 - (Date.now() - lastReq); if (wait > 0) await sleep(wait);
  lastReq = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&polygon_geojson=1`;
  if (OFFLINE) return [];
  let j = null;
  for (let attempt = 0; attempt < 4 && !j; attempt++) {
    try { const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60000) }); if (!res.ok) throw new Error(`nominatim ${res.status}`); j = await res.json(); }
    catch (e) { console.warn("nominatim retry", attempt + 1, q, e.message); await sleep(5000 * (attempt + 1)); }
  }
  if (!j) return [];
  cache[q] = j.map((r) => ({ lat: +r.lat, lon: +r.lon, type: r.type, cls: r.class, name: r.display_name, geo: r.geojson }));
  saveCache();
  return cache[q];
}
const R = 6371000;
const hav = (a, b) => { const p1 = a[1] * Math.PI / 180, p2 = b[1] * Math.PI / 180, dp = p2 - p1, dl = (b[0] - a[0]) * Math.PI / 180; const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const coords = (geo) => { if (!geo) return []; const out = []; const walk = (c) => { if (typeof c[0] === "number") out.push(c); else c.forEach(walk); }; walk(geo.coordinates); return out; };
/** Closest approach of two road geometries (vertex to vertex), returning the midpoint if within `maxM`. */
function crossing(aRes, bRes, maxM = 90) {
  let best = { d: Infinity };
  for (const a of aRes) for (const b of bRes) {
    const ca = coords(a.geo), cb = coords(b.geo);
    if (!ca.length || !cb.length) continue;
    for (const p of ca) for (const q of cb) { const d = hav(p, q); if (d < best.d) best = { d, lon: (p[0] + q[0]) / 2, lat: (p[1] + q[1]) / 2 }; }
  }
  return best.d <= maxM ? best : null;
}
// ---- Overpass: intersections as the node shared by two named roads, or their closest approach ------------------
const OV_CACHE = path.join(ROOT, "data/outcomes/overpass-cache.json");
const ovCache = fs.existsSync(OV_CACHE) ? JSON.parse(fs.readFileSync(OV_CACHE, "utf8")) : {};
const OVERPASS = process.env.OVERPASS || "https://overpass.kumi.systems/api/interpreter";
const SUFFIX_RE = /\( \(North\|South\|East\|West\|N\|S\|E\|W\|NE\|NW\|SE\|SW\)\)\?/g;
const BBOX_RE = /\(-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+\)/g;
const norm = (q) => q.replace(SUFFIX_RE, "").replace(BBOX_RE, "(bbox)").replace(/\[timeout:\d+\]/, "");
const ovByNorm = new Map();
for (const [k, v] of Object.entries(ovCache)) if (v.length) ovByNorm.set(norm(k), v);
const OFFLINE = process.env.OVERPASS_OFFLINE === "1";
async function overpass(q) {
  if (ovCache[q]) return ovCache[q];
  // Earlier runs may have cached the same road with a different city box, timeout or name suffix; reuse a non-empty result.
  const hit = ovByNorm.get(norm(q));
  if (hit) return hit;
  if (OFFLINE) return [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(OVERPASS, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(100000) });
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      const j = await res.json();
      ovCache[q] = j.elements.map((e) => ({ id: e.id, tags: e.tags ?? {}, geometry: e.geometry ?? [] }));
      fs.writeFileSync(OV_CACHE, JSON.stringify(ovCache));
      return ovCache[q];
    } catch (e) { console.warn("overpass retry", attempt + 1, e.message); await sleep(8000); }
  }
  return [];
}
const SUFFIX = { pike: "(Pike|Pk)", lane: "(Lane|Ln)", boulevard: "(Boulevard|Blvd)", avenue: "(Avenue|Ave)", street: "(Street|St)", road: "(Road|Rd)", drive: "(Drive|Dr)", parkway: "(Parkway|Pkwy)", place: "(Place|Pl)", highway: "(Highway|Hwy)", expressway: "(Expressway|Expy)", east: "(East|E)", west: "(West|W)", north: "(North|N)", south: "(South|S)", connector: "(Connector|Conn)" };
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** An Overpass way filter for a road label: interstates and numbered routes by ref, everything else by name. */
function roadFilter(road, state) {
  let m;
  if (road.startsWith("re:")) return `["name"~"${road.slice(3)}",i]`;
  if ((m = road.match(/^Interstate (\d+)$/))) return `["ref"~"(^|;)I[ -]?${m[1]}($|;)"]`;
  if ((m = road.match(/^(?:Route|State Route|State Highway|Highway) (\d+)$/))) return `["ref"~"(^|;)(${state}|SR|SH|US)[ -]?${m[1]}($|;)"]`;
  const words = road.split(/\s+/).map((w) => { const k = w.toLowerCase(); if (SUFFIX[k]) return SUFFIX[k]; if (/^[A-Za-z]$/.test(w)) return `${w}\\.?`; return esc(w); });
  return `["name"~"^${words.join(" ")}( (North|South|East|West|N|S|E|W|NE|NW|SE|SW))?$",i]`;
}
const cityBox = {};
async function bbox(place) {
  if (cityBox[place]) return cityBox[place];
  const all = await nominatim(place);
  const r = all.find((x) => x.geo) ?? all[0];
  if (!r) throw new Error("no bbox for " + place);
  const pts = coords(r.geo); let s = r.lat, n = r.lat, w = r.lon, e = r.lon;
  for (const [x, y] of pts) { if (y < s) s = y; if (y > n) n = y; if (x < w) w = x; if (x > e) e = x; }
  const pad = 0.08; s -= pad; w -= pad; n += pad; e += pad;
  const midLat = (s + n) / 2, midLon = (w + e) / 2;
  s = Math.max(s, midLat - 0.22); n = Math.min(n, midLat + 0.22); w = Math.max(w, midLon - 0.28); e = Math.min(e, midLon + 0.28);
  return (cityBox[place] = `${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}`);
}
const EXPAND = { Pike: ["Pike", "Pk"], Lane: ["Lane", "Ln"], Boulevard: ["Boulevard", "Blvd"], Avenue: ["Avenue", "Ave"], Street: ["Street", "St"], Road: ["Road", "Rd"], Drive: ["Drive", "Dr"], Parkway: ["Parkway", "Pkwy"], Place: ["Place", "Pl"], Highway: ["Highway", "Hwy"], Expressway: ["Expressway", "Expy"] };
/** Exact-name spellings to try before the slow regex: the label, common suffix abbreviations, and direction suffixes. */
function nameCandidates(road) {
  const words = road.split(/\s+/);
  let forms = [""];
  for (const w of words) { const alts = EXPAND[w] ?? [w]; forms = forms.flatMap((f) => alts.map((a) => (f ? `${f} ${a}` : a))); }
  return forms.flatMap((f) => [f, `${f} North`, `${f} South`, `${f} East`, `${f} West`, `${f} NE`, `${f} NW`, `${f} SE`, `${f} SW`]);
}
async function roadWays(road, place, state) {
  const b = await bbox(place);
  const byRef = /^(re:|Interstate |Route |State Route |State Highway |Highway )/.test(road);
  if (!byRef) {
    const names = nameCandidates(road).map((n) => `way["highway"]["name"="${n.replace(/"/g, "")}"](${b});`).join("");
    const exact = await overpass(`[out:json][timeout:90];(${names});out tags geom;`);
    if (exact.length) return exact;
  }
  return overpass(`[out:json][timeout:90];way["highway"]${roadFilter(road, state)}(${b});out tags geom;`);
}
async function intersection(roads, place, state) {
  const a = await roadWays(roads[0], place, state), b = await roadWays(roads[1], place, state);
  if (!a.length || !b.length) return null;
  const key = (p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
  const setB = new Set(b.flatMap((w) => w.geometry.map(key)));
  const shared = a.flatMap((w) => w.geometry).filter((p) => setB.has(key(p)));
  if (shared.length) { const lat = shared.reduce((t, p) => t + p.lat, 0) / shared.length, lon = shared.reduce((t, p) => t + p.lon, 0) / shared.length; return { lon, lat, method: `shared node of the two roads (${shared.length})` }; }
  let best = { d: Infinity };
  for (const wa of a) for (const wb of b) for (const p of wa.geometry) for (const q of wb.geometry) { const d = hav([p.lon, p.lat], [q.lon, q.lat]); if (d < best.d) best = { d, lon: (p.lon + q.lon) / 2, lat: (p.lat + q.lat) / 2 }; }
  const limit = roads.some((r) => /^(Interstate|Route|State Route|State Highway|Highway) \d+$/.test(r)) ? 320 : 120;
  return best.d <= limit ? { lon: best.lon, lat: best.lat, method: `closest approach of the two roads (${Math.round(best.d)} m, grade-separated)` } : null;
}
async function roadGeo(road, place, state) { return (await roadWays(road, place, state)).map((w) => ({ geo: { type: "LineString", coordinates: w.geometry.map((p) => [p.lon, p.lat]) } })); }
// ---- cameras -------------------------------------------------------------------------------------------------
const camPath = process.argv[2];
let geojson;
if (camPath) geojson = JSON.parse(fs.readFileSync(camPath, "utf8"));
else { const res = await fetch("https://data.dontgetflocked.com/cameras-us-hourly.geojson.gz", { headers: { "User-Agent": UA } }); geojson = await res.json(); }
const cams = geojson.features.map((f) => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], brand: f.properties.brand || null, osmId: f.properties.osmId, dir: f.properties.direction ?? null, ts: f.properties.osmTimestamp }));
const flock = cams.filter((c) => c.brand === "Flock Safety");
const newest = cams.reduce((m, c) => (c.ts > m ? c.ts : m), "");
fs.mkdirSync(path.join(ROOT, "public/data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "public/data/cameras-flock.json"), JSON.stringify({ count: flock.length, total: cams.length, asOf: newest, points: flock.map((c) => [+c.lon.toFixed(4), +c.lat.toFixed(4)]) }));
console.log("cameras", cams.length, "flock", flock.length, "newest", newest);
// grid index for nearest-camera lookup
const cell = (lon, lat) => `${Math.floor(lat * 20)}:${Math.floor(lon * 20)}`;
const grid = new Map();
cams.forEach((c, i) => { const k = cell(c.lon, c.lat); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
function nearest(lon, lat) {
  let best = null;
  const la = Math.floor(lat * 20), lo = Math.floor(lon * 20);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const i of grid.get(`${la + dy}:${lo + dx}`) ?? []) {
    const d = hav([lon, lat], [cams[i].lon, cams[i].lat]);
    if (!best || d < best.distanceM) best = { osmId: cams[i].osmId, brand: cams[i].brand, direction: cams[i].dir, distanceM: Math.round(d), lon: cams[i].lon, lat: cams[i].lat };
  }
  return best;
}
function camerasAlongRoad(res, maxM = 60) {
  const pts = res.flatMap((r) => coords(r.geo)); const hits = new Map();
  for (const p of pts) { const la = Math.floor(p[1] * 20), lo = Math.floor(p[0] * 20); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const i of grid.get(`${la + dy}:${lo + dx}`) ?? []) { const d = hav(p, [cams[i].lon, cams[i].lat]); if (d <= maxM && (!hits.has(i) || d < hits.get(i))) hits.set(i, d); } }
  return [...hits.entries()].map(([i, d]) => ({ osmId: cams[i].osmId, brand: cams[i].brand, lon: cams[i].lon, lat: cams[i].lat, distanceM: Math.round(d) })).sort((a, b) => a.distanceM - b.distanceM);
}
const SITE_M = 150, ROAD_M = 60;
const sites = [];
const locate = (rec, lon, lat, method) => { const m = nearest(lon, lat); return { ...rec, lon: +lon.toFixed(5), lat: +lat.toFixed(5), geocode: method, match: m && m.distanceM <= SITE_M ? m : null, nearest: m }; };
// ---- Nashville -----------------------------------------------------------------------------------------------
const nash = read("nashville.json");
for (const s of nash.sites) {
  const rec = { id: `nash-${nash.sites.indexOf(s)}`, source: "nashville", level: "site", agency: nash.agency, city: nash.city, state: nash.state, period: nash.period, label: s.label, quadrant: s.quadrant, mobile: !!s.mobile, values: { reads: null, alerts: s.alerts, falseAlerts: null, stops: s.stops, recoveries: s.recoveries, arrests: s.arrests }, extra: { searches: s.searches }, sources: nash.sources };
  if (s.mobile) { sites.push({ ...rec, lon: null, lat: null, geocode: "mobile unit, no fixed site", match: null, nearest: null }); continue; }
  const x = await intersection(s.roads, "Nashville, Tennessee", "TN");
  sites.push(x ? locate(rec, x.lon, x.lat, x.method) : { ...rec, lon: null, lat: null, geocode: "intersection not resolved", match: null, nearest: null });
  console.log("nashville", s.label, x ? `${x.lat.toFixed(4)},${x.lon.toFixed(4)}` : "unresolved");
}
// ---- Windsor -------------------------------------------------------------------------------------------------
const win = read("windsor.json");
for (const s of win.sites) {
  const cases = win.cases.filter((c) => c.site === s.id);
  const rec = { id: `win-${s.id}`, source: "windsor", level: "site", agency: win.agency, city: win.city, state: win.state, period: "2023 to 2025", label: s.label, cameras: s.cameras ?? 1, values: { reads: null, alerts: null, falseAlerts: null, stops: null, recoveries: cases.filter((c) => /recover/.test(c.outcome)).length || null, arrests: cases.filter((c) => /arrest/.test(c.outcome)).length || null }, extra: { cases: cases.map((c) => ({ date: c.date, type: c.type, outcome: c.outcome, summary: c.summary })) }, sources: win.sources };
  let x = null;
  if (s.roadOnly) { const res = await roadGeo(s.roads[0], "Windsor, Connecticut", "CT"); const along = camerasAlongRoad(res); if (along.length) x = { lon: along[0].lon, lat: along[0].lat, method: `road only; nearest mapped camera on the road (${along.length} on it)` }; }
  else x = await intersection(s.roads, "Windsor, Connecticut", "CT");
  sites.push(x ? locate(rec, x.lon, x.lat, x.method) : { ...rec, lon: null, lat: null, geocode: "intersection not resolved", match: null, nearest: null });
  console.log("windsor", s.label, x ? "ok" : "unresolved");
}
// ---- Story County clusters -----------------------------------------------------------------------------------
const story = JSON.parse(fs.readFileSync(path.join(SRC, "story-rows.json"), "utf8"));
const clusters = [];
for (const r of story) { const la = +r.latitude, lo = +r.longitude; if (!la) continue; let c = clusters.find((c) => Math.abs(c.lat - la) < 0.0003 && Math.abs(c.lon - lo) < 0.0004); if (!c) { c = { lat: la, lon: lo, rows: [] }; clusters.push(c); } c.rows.push(r); }
clusters.sort((a, b) => b.rows.length - a.rows.length);
clusters.forEach((c, i) => {
  const st = (k) => c.rows.filter((r) => r.review_status.toLowerCase() === k).length;
  const rec = { id: `story-${i}`, source: "story", level: "cluster", agency: "Story County Sheriff's Office", city: "Story County", state: "IA", period: "2025-09-09 to 2025-10-09", label: `Location ${i + 1}: ${Object.entries(c.rows.reduce((m, r) => m.set(r.hotlist_offense_category, (m.get(r.hotlist_offense_category) ?? 0) + 1), new Map())).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(", ")}`, values: { reads: null, alerts: c.rows.length, falseAlerts: st("wrong state") + st("incorrect"), stops: null, recoveries: null, arrests: null }, extra: { wrongState: st("wrong state"), incorrect: st("incorrect"), correct: st("correct"), noAction: st("no action"), dismissed: st("dismiss"), categories: Object.fromEntries(c.rows.reduce((m, r) => m.set(r.hotlist_offense_category, (m.get(r.hotlist_offense_category) ?? 0) + 1), new Map())) }, sources: ["footnote4a-hotlist"] };
  sites.push(locate(rec, c.lon, c.lat, "coordinates in the county's export"));
});
console.log("story clusters", clusters.length);
// ---- Tucson calls --------------------------------------------------------------------------------------------
const tucsonFiles = fs.readdirSync(SRC).filter((f) => /^tucson-.*\.json$/.test(f));
const calls = new Map();
for (const f of tucsonFiles) for (const ft of JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8")).features) { const a = ft.attributes; if (!calls.has(a.call_id)) calls.set(a.call_id, { ...a, lon: ft.geometry.x, lat: ft.geometry.y }); }
const byPlace = new Map();
for (const c of calls.values()) { const k = c.ADDRESS_PUBLIC; if (!byPlace.has(k)) byPlace.set(k, { lon: c.lon, lat: c.lat, calls: [] }); byPlace.get(k).calls.push(c); }
let ti = 0;
for (const [addr, p] of byPlace) {
  const disp = Object.fromEntries(p.calls.reduce((m, c) => m.set(c.CSDISPOSIT || "?", (m.get(c.CSDISPOSIT || "?") ?? 0) + 1), new Map()));
  const rec = { id: `tucson-${ti++}`, source: "tucson", level: "call", agency: "University of Arizona Police (Tucson dispatch)", city: "Tucson", state: "AZ", period: `${new Date(Math.min(...p.calls.map((c) => c.ACTDATETIME))).toISOString().slice(0, 10)} to ${new Date(Math.max(...p.calls.map((c) => c.ACTDATETIME))).toISOString().slice(0, 10)}`, label: addr.replace(/\b(\w)(\w*)/g, (_, a, b) => a + b.toLowerCase()).replace(/\bAv\b/g, "Ave").replace(/\bBl\b/g, "Blvd"), values: { reads: null, alerts: p.calls.length, falseAlerts: null, stops: null, recoveries: null, arrests: disp.A ?? null }, extra: { dispositions: disp, caseIds: p.calls.map((c) => c.case_id).filter(Boolean) }, sources: ["tucson-cfs"] };
  sites.push(locate(rec, p.lon, p.lat, "dispatch coordinates (intersection)"));
}
console.log("tucson places", byPlace.size, "calls", calls.size);
// ---- News records naming the camera's road -------------------------------------------------------------------
const news = JSON.parse(fs.readFileSync(path.join(SRC, "news-sites.json"), "utf8"));
for (const n of news) {
  const place = `${n.city}, ${n.state}`;
  let x = null, along = [];
  if (n.roads?.length === 2) x = await intersection(n.roads, place, n.state);
  else if (n.roads?.length === 1) { const res = await roadGeo(n.roads[0], place, n.state); along = camerasAlongRoad(res); if (along.length) x = { lon: along[0].lon, lat: along[0].lat, method: `road only; nearest mapped camera on the road (${along.length} on it)` }; else if (res.length) { const c = coords(res[0].geo); const m = c[Math.floor(c.length / 2)]; if (m) x = { lon: m[0], lat: m[1], method: "a point on the road; no mapped camera on the road" }; } }
  const rec = { id: `news-${n.id}`, source: "news", level: n.roads?.length === 2 ? "site" : "road", agency: `${n.city} (${n.state}) police, as reported`, city: n.city, state: n.state, period: n.date, label: n.site, values: { reads: null, alerts: 1, falseAlerts: null, stops: null, recoveries: /recover/i.test(n.outcome) ? 1 : null, arrests: /arrest|charged|indicted/i.test(n.outcome) ? 1 : null }, extra: { crime: n.crime, outcome: n.outcome, summary: n.summary, url: n.url }, sources: ["lehman-tracker"] };
  sites.push(x ? locate(rec, x.lon, x.lat, x.method) : { ...rec, lon: null, lat: null, geocode: "not resolved", match: null, nearest: null });
  console.log("news", n.city, n.site, x ? "ok" : "unresolved");
}
// ---- Court site ----------------------------------------------------------------------------------------------
const courts = read("courts.json");
for (const c of courts.records.filter((r) => r.site)) {
  const res = await nominatim(c.site.address);
  const rec = { id: `court-${c.id}`, source: "court", level: "site", agency: c.court, city: c.city, state: c.state, period: c.date, label: c.site.label, values: { reads: null, alerts: 1, falseAlerts: null, stops: null, recoveries: 1, arrests: 1 }, extra: { case: c.case, crime: c.crime, role: c.role, outcome: c.outcome }, sources: c.sources };
  sites.push(res.length ? locate(rec, res[0].lon, res[0].lat, "address geocode") : { ...rec, lon: null, lat: null, geocode: "address not resolved", match: null, nearest: null });
}
// ---- Assemble ------------------------------------------------------------------------------------------------
const located = sites.filter((s) => s.lat != null);
const matched = located.filter((s) => s.match);
const out = {
  generated: new Date().toISOString().slice(0, 10),
  cameras: { total: cams.length, flock: flock.length, asOf: newest, withDirection: cams.filter((c) => c.dir != null).length },
  rungs: [
    { id: "reads", label: "Reads", def: "Plates read" },
    { id: "alerts", label: "Alerts", def: "Hot-list matches, unverified unless the source says verified" },
    { id: "falseAlerts", label: "Wrong alerts", def: "Alerts the agency found to be wrong on review" },
    { id: "stops", label: "Stops", def: "Vehicle stops made" },
    { id: "recoveries", label: "Recoveries", def: "Vehicles recovered" },
    { id: "arrests", label: "Arrests", def: "Persons arrested or charged" },
  ],
  sites,
  nashville: { totals: nash.totals, definitions: nash.definitions, period: nash.period, sources: nash.sources },
  windsor: { cameras: win.cameras, cases: win.cases, sources: win.sources },
  courts: courts.records,
  districts: read("districts.json").districts,
  ladders: read("agencies.json").ladders,
  national: read("national.json"),
  coverage: { sites: sites.length, located: located.length, matched: matched.length, bySource: Object.fromEntries(["nashville", "windsor", "story", "tucson", "news", "court"].map((k) => [k, { sites: sites.filter((s) => s.source === k).length, located: located.filter((s) => s.source === k).length, matched: matched.filter((s) => s.source === k).length }])) },
};
fs.writeFileSync(path.join(ROOT, "public/data/outcomes.json"), JSON.stringify(out));
console.log("sites", sites.length, "located", located.length, "matched within", SITE_M, "m:", matched.length);
console.log(JSON.stringify(out.coverage.bySource));
