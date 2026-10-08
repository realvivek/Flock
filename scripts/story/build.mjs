// Builds the home story's data from the raw inputs in data/story/raw/ (downloaded by fetch.mjs) into
// public/data/story/ and public/data/basemaps/. Everything here is deterministic given the raw files, whose
// checksums are in data/story/manifest.json.
//
//   node scripts/story/build.mjs
//
// Outputs
//   public/data/story/cams.bin          every mapped plate reader, pre-projected (Albers USA, 1000 x 620 frame),
//                                       gzip-compressed binary: x and y as delta-coded Uint16, a class byte
//   public/data/story/states.topo.json  state shapes in the same projected frame
//   public/data/story/counties.topo.json county shapes in the same frame (loaded only by the county lookup)
//   public/data/story/states.json       Flock and all-make counts, 2024 population and rates by state
//   public/data/story/counties.json     the same by county (the lookup table)
//   public/data/story/operators.json    makes, operator classes and the largest named operators
//   public/data/story/completeness.json mapped cameras inside city limits against published counts
//   public/data/story/atlanta.json      primary roads and county lines for the Atlanta zoom, projected
//   public/data/story/meta.json         snapshot date, projection, counts, sources
//   public/data/story/*.csv             downloads (camera data: OpenStreetMap contributors, ODbL)
//   public/data/basemaps/<city>.json    streets, water and cameras (with direction) for the Outcomes city maps
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import mapshaper from "mapshaper";
import { PMTiles } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { geoAlbersUsa, geoArea } from "d3-geo";
import { geoProject } from "d3-geo-projection";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const RAW = path.join(ROOT, "data/story/raw");
const DATA = path.join(ROOT, "data/story");
const OUT = path.join(ROOT, "public/data/story");
const BASE = path.join(ROOT, "public/data/basemaps");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(BASE, { recursive: true });
const raw = (f) => path.join(RAW, f);
const write = (dir, name, obj) => { const s = typeof obj === "string" ? obj : JSON.stringify(obj); fs.writeFileSync(path.join(dir, name), s); return s.length; };
const log = (...a) => console.log(...a);

// FIPS → USPS for the 50 states, D.C. and Puerto Rico.
const USPS = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "72": "PR" };
const STATES51 = Object.keys(USPS).filter((f) => f !== "72");
// Census Bureau regions
const REGIONS = [
  { name: "Northeast", usps: "CT ME MA NH RI VT NJ NY PA".split(" ") },
  { name: "Midwest", usps: "IL IN MI OH WI IA KS MN MO NE ND SD".split(" ") },
  { name: "South", usps: "DE FL GA MD NC SC VA DC WV AL KY MS TN AR LA OK TX".split(" ") },
  { name: "West", usps: "AZ CO ID MT NV NM UT WY AK CA HI OR WA".split(" ") },
];

// ---- 1. Cameras from the tile archive (zoom 9 keeps every point with its properties) ------------------------
async function readCameras() {
  const fd = fs.openSync(raw("cameras-us-hourly.pmtiles"), "r");
  const source = { getKey: () => "cameras", getBytes: async (offset, length) => { const b = Buffer.alloc(length); fs.readSync(fd, b, 0, length, offset); return { data: b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; } };
  const pm = new PMTiles(source);
  const h = await pm.getHeader();
  const Z = 9, n = 2 ** Z;
  const lon2x = (lon) => Math.floor((lon + 180) / 360 * n);
  const lat2y = (lat) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); };
  const seen = new Map(); let tiles = 0;
  for (let x = lon2x(h.minLon); x <= lon2x(h.maxLon); x++) for (let y = lat2y(h.maxLat); y <= lat2y(h.minLat); y++) {
    const t = await pm.getZxy(Z, x, y);
    if (!t) continue;
    tiles++;
    const layer = new VectorTile(new PbfReader(new Uint8Array(t.data))).layers.cameras;
    if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      for (const ring of f.loadGeometry()) for (const g of ring) {
        const lon = (x + g.x / layer.extent) / n * 360 - 180;
        const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + g.y / layer.extent) / n))) * 180 / Math.PI;
        const p = f.properties;
        const key = `${p.osmType}/${p.osmId}`;
        if (!seen.has(key)) seen.set(key, { lon, lat, ...p });
      }
    }
  }
  fs.closeSync(fd);
  return { cams: [...seen.values()], tiles };
}

// ---- 2. Shapes ------------------------------------------------------------------------------------------------
async function shapes(zip, cmd = "") {
  const out = await mapshaper.applyCommands(`-i in.zip ${cmd} -o format=geojson precision=0.000001 out.json`, { "in.zip": fs.readFileSync(raw(zip)) });
  return JSON.parse(out["out.json"]);
}
async function ms(cmd, input) { return mapshaper.applyCommands(cmd, input); }
// d3-geo reads a polygon's ring order on the sphere: an outer ring wound the other way means "everything except this
// shape", which projects to the whole clip rectangle. Reverse any polygon whose outer ring covers more than a hemisphere.
function rewindForD3(fc) {
  for (const f of fc.features) {
    const gm = f.geometry;
    if (!gm) continue;
    const polys = gm.type === "Polygon" ? [gm.coordinates] : gm.type === "MultiPolygon" ? gm.coordinates : [];
    for (const poly of polys) if (geoArea({ type: "Polygon", coordinates: [poly[0]] }) > 2 * Math.PI) for (const ring of poly) ring.reverse();
  }
  return fc;
}
// mapshaper writes a GeometryCollection when a layer has no attributes; d3's geoProject needs features.
const asFeatures = (g) => (g.type === "FeatureCollection" ? g : { type: "FeatureCollection", features: (g.geometries ?? []).map((geometry) => ({ type: "Feature", properties: {}, geometry })) });

function polygonIndex(features, idOf) {
  const items = features.map((f) => {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const b = [180, 90, -180, -90];
    for (const poly of polys) for (const [x, y] of poly[0]) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    return { id: idOf(f), polys, b };
  });
  const cell = (x, y) => `${Math.floor(x * 2)}:${Math.floor(y * 2)}`;
  const grid = new Map();
  for (const it of items) for (let gx = Math.floor(it.b[0] * 2); gx <= Math.floor(it.b[2] * 2); gx++) for (let gy = Math.floor(it.b[1] * 2); gy <= Math.floor(it.b[3] * 2); gy++) { const k = `${gx}:${gy}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(it); }
  const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const inPoly = (x, y, poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((hole) => inRing(x, y, hole));
  const segDist = (px, py, ax, ay, bx, by, k) => { const dx = (bx - ax) * k, dy = by - ay, qx = (px - ax) * k, qy = py - ay; const t = Math.max(0, Math.min(1, (qx * dx + qy * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(qx - t * dx, qy - t * dy) * 111320; };
  return {
    find(lon, lat) { for (const it of grid.get(cell(lon, lat)) ?? []) { if (lon < it.b[0] || lon > it.b[2] || lat < it.b[1] || lat > it.b[3]) continue; if (it.polys.some((p) => inPoly(lon, lat, p))) return it.id; } return null; },
    nearest(lon, lat, maxM) {
      const k = Math.cos(lat * Math.PI / 180); let best = null, bestD = maxM;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const it of grid.get(`${Math.floor(lon * 2) + dx}:${Math.floor(lat * 2) + dy}`) ?? []) for (const poly of it.polys) for (const ring of poly) for (let i = 1; i < ring.length; i++) { const d = segDist(lon, lat, ring[i - 1][0], ring[i - 1][1], ring[i][0], ring[i][1], k); if (d < bestD) { bestD = d; best = it.id; } }
      return best;
    },
  };
}

// ---- 3. Census population ---------------------------------------------------------------------------------------
function csv(file, encoding = "utf8") {
  const lines = fs.readFileSync(raw(file)).toString(encoding).trim().split(/\r?\n/);
  const head = lines[0].split(",");
  return lines.slice(1).map((l) => { const c = l.split(","); return Object.fromEntries(head.map((h, i) => [h, c[i]])); });
}

// ---- 4. Operators -------------------------------------------------------------------------------------------------
const CLASSES = [
  { id: "police", label: "Police and sheriffs" },
  { id: "government", label: "Other government" },
  { id: "school", label: "Schools and universities" },
  { id: "retail", label: "Retailers and shopping centers" },
  { id: "business", label: "Other businesses and institutions" },
  { id: "residential", label: "Homeowner and residential groups" },
  { id: "flock", label: "Flock Safety listed as operator" },
  { id: "unclear", label: "Unclear" },
];
const normOp = (s) => String(s).replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
function guessClass(o) {
  if (/\bflock\b/i.test(o)) return "flock";
  if (/\b(sheriff(?:'?s)?|sherriff|police|pd|so|public safety|law enforcement|marshal|constable|state patrol|highway patrol|troopers?|dps|chp)\b/i.test(o)) return "police";
  if (/\b(homeowners?|hoa|poa|owners'? association|property owners|community association|residential|condominiums?|apartments?|maintenance association|homes association|village association)\b/i.test(o)) return "residential";
  if (/\b(lowe'?s|home depot|home depo|walmart|target|kroger|costco|publix|menards|dierbergs|scheels|cvs|walgreens|mall|galleria|town center|towne center|shopping|plaza|outlets?|simon property|brookfield|property group|market)\b/i.test(o)) return "retail";
  if (/\b(school|schools|isd|university|college|academy)\b/i.test(o)) return "school";
  if (/\b(city of|town of|village of|county|township|borough|municipal|parish|department of transportation|dot|authority|state parks?|nation|tribe|government)\b/i.test(o)) return "government";
  if (/\b(inc|llc|corp|corporation|company|bank|credit union|health|hospital|medical|fedex|ups|dhl|amazon|boeing|lodge|hotel|church|realty|real estate|mortgage)\b/i.test(o)) return "business";
  return "unclear";
}

// ---- 5. Packed point file -------------------------------------------------------------------------------------------
function packPoints(points, frame) {
  // Sort by a coarse Morton order so neighbours sit together, then delta-code x and y (zig-zag into Uint16).
  const morton = (x, y) => { let m = 0; for (let i = 0; i < 10; i++) m |= ((x >> (i + 6)) & 1) << (2 * i) | ((y >> (i + 6)) & 1) << (2 * i + 1); return m; };
  points.sort((a, b) => morton(a.qx, a.qy) - morton(b.qx, b.qy) || a.qx - b.qx || a.qy - b.qy);
  const n = points.length;
  const head = Buffer.alloc(16);
  head.write("FLK1", 0, "ascii"); head.writeUInt32LE(n, 4); head.writeUInt16LE(frame[0], 8); head.writeUInt16LE(frame[1], 10);
  const xs = new Uint16Array(n), ys = new Uint16Array(n), cls = new Uint8Array(n);
  // The difference wraps to 16 bits (exact modulo 65,536), then zig-zags so small steps either way stay small numbers;
  // the reader adds each step and masks to 16 bits (src/viz/cams.ts).
  const zz = (d) => { d = (d << 16) >> 16; return ((d << 1) ^ (d >> 15)) & 0xffff; };
  let px = 0, py = 0;
  points.forEach((p, i) => { xs[i] = zz(p.qx - px); ys[i] = zz(p.qy - py); cls[i] = p.cls; px = p.qx; py = p.qy; });
  const body = Buffer.concat([head, Buffer.from(xs.buffer), Buffer.from(ys.buffer), Buffer.from(cls.buffer)]);
  return zlib.gzipSync(body, { level: 9 });
}

// ---- 6. Projected shapes -------------------------------------------------------------------------------------------
const round2 = (gj) => JSON.parse(JSON.stringify(gj, (k, v) => (typeof v === "number" && k !== "id" ? Math.round(v * 100) / 100 : v)));
async function toTopo(gj, name, quant = 20000) {
  const out = await ms(`-i in.json name=${name} -o format=topojson quantization=${quant} out.json`, { "in.json": JSON.stringify(gj) });
  return out["out.json"];
}

// =====================================================================================================================
const t0 = Date.now();
const { cams, tiles } = await readCameras();
const snapshot = cams.reduce((m, c) => (c.osmTimestamp && c.osmTimestamp > m ? c.osmTimestamp : m), "");
log(`cameras: ${cams.length} from ${tiles} tiles; latest edit ${snapshot}`);

const counties = await shapes("cb_2024_us_county_500k.zip", "-filter-fields GEOID,NAME,NAMELSAD,STATEFP,STUSPS,STATE_NAME");
const countyIdx = polygonIndex(counties.features, (f) => f.properties.GEOID);
const countyProps = new Map(counties.features.map((f) => [f.properties.GEOID, f.properties]));

// population
const popCounty = new Map(csv("co-est2024-alldata.csv", "latin1").filter((r) => r.SUMLEV === "050").map((r) => [r.STATE + r.COUNTY, { pop: +r.POPESTIMATE2024, name: r.CTYNAME, state: r.STNAME }]));
const popState = new Map(csv("NST-EST2024-ALLDATA.csv").filter((r) => r.SUMLEV === "040").map((r) => [r.STATE, { pop: +r.POPESTIMATE2024, name: r.NAME }]));

// assign
let fallback = 0, unassigned = 0;
const brandOf = (c) => (c.brand ? String(c.brand).trim() : "");
for (const c of cams) {
  let g = countyIdx.find(c.lon, c.lat);
  if (!g) { g = countyIdx.nearest(c.lon, c.lat, 1000); if (g) fallback++; else unassigned++; }
  c.county = g;
  c.state = g ? g.slice(0, 2) : null;
  const b = brandOf(c);
  c.cls = b === "Flock Safety" ? 0 : b ? 1 : 2;
}
log(`counties: ${fallback} assigned by the 1 km fallback, ${unassigned} outside every county`);

// counts by county and state
const byCounty = new Map(), byState = new Map();
for (const c of cams) {
  if (!c.county) continue;
  for (const [m, k] of [[byCounty, c.county], [byState, c.state]]) { const r = m.get(k) ?? { flock: 0, all: 0 }; r.all++; if (c.cls === 0) r.flock++; m.set(k, r); }
}
const countyRows = [...countyProps.values()].filter((p) => USPS[p.STATEFP]).map((p) => {
  const r = byCounty.get(p.GEOID) ?? { flock: 0, all: 0 };
  const pop = popCounty.get(p.GEOID)?.pop ?? null;
  return { fips: p.GEOID, name: p.NAMELSAD, state: p.STATE_NAME, usps: USPS[p.STATEFP], flock: r.flock, all: r.all, pop, per100k: pop ? Math.round(r.flock / pop * 1e6) / 10 : null };
}).sort((a, b) => a.fips.localeCompare(b.fips));
const missingPop = countyRows.filter((r) => r.pop == null && r.usps !== "PR");
if (missingPop.length) log("counties without a population row:", missingPop.map((r) => r.fips + " " + r.name).join(", "));
const stateRows = Object.entries(USPS).map(([fips, usps]) => {
  const r = byState.get(fips) ?? { flock: 0, all: 0 };
  const pop = popState.get(fips)?.pop ?? null;
  return { fips, usps, name: popState.get(fips)?.name ?? usps, flock: r.flock, all: r.all, pop, per100k: pop ? Math.round(r.flock / pop * 1e6) / 10 : null };
});
const s51 = stateRows.filter((r) => STATES51.includes(r.fips));
const usFlock = s51.reduce((a, r) => a + r.flock, 0), usPop = s51.reduce((a, r) => a + r.pop, 0);
const usRate = Math.round(usFlock / usPop * 1e6) / 10;
log(`U.S. (50 states + D.C.): ${usFlock} Flock cameras, ${usRate} per 100,000`);

// makes
const brandCounts = new Map();
for (const c of cams) { const b = brandOf(c) || "(no make tagged)"; brandCounts.set(b, (brandCounts.get(b) ?? 0) + 1); }
const brands = [...brandCounts.entries()].sort((a, b) => b[1] - a[1]).map(([brand, count]) => ({ brand, count }));
const flockTotal = cams.filter((c) => c.cls === 0).length;
const branded = cams.filter((c) => c.cls !== 2).length;

// operators
const classFile = path.join(DATA, "operator-classes.json");
const classes = fs.existsSync(classFile) ? JSON.parse(fs.readFileSync(classFile, "utf8")) : { map: {} };
const flockCams = cams.filter((c) => c.cls === 0);
const opCounts = new Map();
for (const c of flockCams) if (c.operator) { const o = normOp(c.operator); opCounts.set(o, (opCounts.get(o) ?? 0) + 1); }
const unmapped = [...opCounts.entries()].filter(([o, n]) => n >= 10 && !classes.map[o]).sort((a, b) => b[1] - a[1]);
if (unmapped.length) {
  fs.writeFileSync(path.join(DATA, "operator-classes.draft.json"), JSON.stringify(Object.fromEntries(unmapped.map(([o, n]) => [o, { suggested: guessClass(o), cameras: n }])), null, 2) + "\n");
  console.error(`${unmapped.length} operator names with 10 or more cameras have no class; a draft is in data/story/operator-classes.draft.json`);
  if (!process.argv.includes("--allow-draft")) process.exit(1);
}
const classOf = (o) => classes.map[o] ?? guessClass(o);
const classCount = new Map(CLASSES.map((c) => [c.id, 0]));
for (const [o, n] of opCounts) classCount.set(classOf(o), classCount.get(classOf(o)) + n);
const withOperator = [...opCounts.values()].reduce((a, n) => a + n, 0);
// group spelling variants of the same operator for the "largest named operators" list
const canon = (o) => classes.canonical?.[o] ?? o;
const named = new Map();
for (const [o, n] of opCounts) { const k = canon(o); named.set(k, (named.get(k) ?? 0) + n); }
const topNamed = [...named.entries()].filter(([k]) => classOf(k) !== "flock").sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count, cls: classOf(name) }));

// projection: Albers USA fitted to the 50 states and D.C. in a 1000 x 620 frame
const FRAME = [1000, 620];
const states = await ms("-i in.json -filter 'STATEFP !== \"72\" && STATEFP < \"60\"' -dissolve STATEFP copy-fields=STUSPS,STATE_NAME -simplify 3% keep-shapes -o format=geojson precision=0.00001 out.json", { "in.json": JSON.stringify(counties) }).then((o) => JSON.parse(o["out.json"]));
rewindForD3(states);
const projection = geoAlbersUsa().fitExtent([[6, 6], [FRAME[0] - 6, FRAME[1] - 6]], states);
const scale = projection.scale(), translate = projection.translate();
const statesProj = round2(geoProject(states, projection));
const statesTopo = await toTopo(statesProj, "states");
const countiesSimple = await ms("-i in.json -filter 'STATEFP !== \"72\" && STATEFP < \"60\"' -simplify 1.2% keep-shapes -filter-fields GEOID -o format=geojson precision=0.00001 out.json", { "in.json": JSON.stringify(counties) }).then((o) => JSON.parse(o["out.json"]));
const countiesTopo = await toTopo(round2(geoProject(rewindForD3(countiesSimple), projection)), "counties", 8000);

// points
const pts = [];
let offMap = 0;
for (const c of cams) {
  const p = projection([c.lon, c.lat]);
  if (!p) { offMap++; continue; }
  pts.push({ qx: Math.max(0, Math.min(65535, Math.round(p[0] / FRAME[0] * 65535))), qy: Math.max(0, Math.min(65535, Math.round(p[1] / FRAME[1] * 65535))), cls: c.cls });
}
const bin = packPoints(pts, FRAME);
fs.writeFileSync(path.join(OUT, "cams.bin"), bin);
log(`cams.bin: ${pts.length} points (${offMap} outside the map's states), ${(bin.length / 1024).toFixed(0)} KB gzip`);

// ---- Atlanta zoom: primary and secondary roads, county lines -------------------------------------------------------
const ATL = [-84.86, 33.42, -83.86, 34.2];
const roadsGa = await shapes("tl_2024_13_prisecroads.zip", `-clip bbox=${ATL.join(",")} -filter 'MTFCC === "S1100" || MTFCC === "S1200"' -filter-fields MTFCC,FULLNAME -simplify 12%`);
const metroFips = ["13121", "13089", "13067", "13135", "13063", "13057", "13117", "13151", "13113", "13097", "13247"];
const atlCounties = await ms("-i in.json -filter '" + metroFips.map((f) => `GEOID === "${f}"`).join(" || ") + "' -simplify 15% keep-shapes -innerlines -o format=geojson precision=0.00001 out.json", { "in.json": JSON.stringify(counties) }).then((o) => JSON.parse(o["out.json"]));
// Fulton County's outline, which the story names
const fulton = rewindForD3({ type: "FeatureCollection", features: [JSON.parse(JSON.stringify(counties.features.find((f) => f.properties.GEOID === "13121")))] });
const atlFc = { type: "FeatureCollection", features: [
  ...geoProject(fulton, projection).features.map((f) => ({ type: "Feature", properties: { c: 3, n: "Fulton County" }, geometry: f.geometry })),
  ...geoProject(roadsGa, projection).features.filter((f) => f.geometry).map((f) => ({ type: "Feature", properties: { c: f.properties.MTFCC === "S1100" ? 1 : 2, n: f.properties.FULLNAME ?? "" }, geometry: f.geometry })),
  ...geoProject(asFeatures(atlCounties), projection).features.filter((f) => f.geometry).map((f) => ({ type: "Feature", properties: { c: 0 }, geometry: f.geometry })),
] };
write(OUT, "atlanta.topo.json", await toTopo(atlFc, "atlanta", 10000));
// Label positions for the story map, in the same projected frame: a few large cities for the national view; for the
// Atlanta zoom the city, Fulton County and the interstates, each snapped to the nearest point on its road.
{
  const pt = (lon, lat) => projection([lon, lat]).map((v) => Math.round(v * 100) / 100);
  const snap = (name, lon, lat) => {
    const t = projection([lon, lat]); let best = null, bd = Infinity;
    for (const f of atlFc.features) if (f.properties.n === name) for (const ln of (f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates)) for (const q of ln) { const d = (q[0] - t[0]) ** 2 + (q[1] - t[1]) ** 2; if (d < bd) { bd = d; best = q; } }
    if (!best) throw new Error(`label: no road named ${name}`);
    return best.map((v) => Math.round(v * 100) / 100);
  };
  const corners = [[ATL[0], ATL[1]], [ATL[0], ATL[3]], [ATL[2], ATL[1]], [ATL[2], ATL[3]]].map(([lo, la]) => projection([lo, la]));
  const labels = {
    cities: [["Seattle", -122.33, 47.61], ["Los Angeles", -118.24, 34.05], ["Denver", -104.99, 39.74], ["Dallas", -96.8, 32.78], ["Houston", -95.37, 29.76], ["Chicago", -87.63, 41.88], ["Atlanta", -84.39, 33.75], ["Miami", -80.19, 25.76], ["New York", -74.01, 40.71]].map(([name, lon, lat]) => ({ name, xy: pt(lon, lat) })),
    atlanta: {
      bbox: [Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[1]))].map((v) => Math.round(v * 100) / 100),
      places: [{ name: "Atlanta", kind: "city", xy: pt(-84.39, 33.75) }, { name: "Fulton County", kind: "area", xy: pt(-84.36, 34.03) }],
      roads: [["75", "I- 75", -84.56, 34.0], ["85", "I- 85", -84.2, 33.93], ["20", "I- 20", -84.17, 33.72], ["285", "I- 285", -84.36, 33.92], ["75", "I- 75", -84.33, 33.5], ["85", "I- 85", -84.6, 33.5]].map(([name, road, lon, lat]) => ({ name, xy: snap(road, lon, lat) })),
    },
  };
  write(OUT, "labels.json", labels);
}

// ---- Completeness: mapped Flock cameras inside city limits against published counts ------------------------------
const places = await shapes("cb_2024_us_place_500k.zip", "-filter-fields GEOID,NAME,STUSPS");
const placeIdx = polygonIndex(places.features, (f) => f.properties.GEOID);
const WANT = [
  { name: "Oakland", usps: "CA", published: 293, when: "2025", what: "Flock cameras in the 2025 annual report", sources: ["oaklandside-2026", "oakland-pac-2026"] },
  { name: "Denver", usps: "CO", published: 111, when: "2024–25", what: "Flock cameras at about 70 sites", sources: ["denverite-2025"] },
  { name: "Lexington-Fayette", usps: "KY", published: 125, when: "Dec. 2025", what: "cameras by council district", sources: ["lexington-lpr-locations"] },
  { name: "Berkeley", usps: "CA", published: 52, when: "2025", what: "Flock cameras", sources: ["berkeleyside-2025"] },
  { name: "Piedmont", usps: "CA", published: 48, when: "2025", what: "cameras", sources: ["piedmont-2025"] },
  { name: "Lafayette", usps: "CO", published: 30, when: "2024–25", what: "Flock cameras", sources: ["lafayette-co-alpr"] },
  { name: "Dallas", usps: "TX", published: 684, when: "Sept. 2026", what: "cameras on the department's transparency portal, before 321 were to be switched off", sources: ["govtech-dallas-2026"] },
  { name: "Houston", usps: "TX", published: 3800, when: "2024", what: "cameras operating citywide, police and private, per city officials", sources: ["houstonchronicle-flock-2025"] },
];
const placeById = new Map(places.features.map((f) => [f.properties.GEOID, f.properties]));
const wantIds = WANT.map((w) => { const f = places.features.find((p) => p.properties.STUSPS === w.usps && p.properties.NAME.toLowerCase() === w.name.toLowerCase()); if (!f) log("place not found:", w.name, w.usps); return f?.properties.GEOID ?? null; });
// Inside each city: cameras tagged to that city's police, to another named operator, or to no operator.
const placeCounts = new Map();
for (const c of flockCams) {
  const g = placeIdx.find(c.lon, c.lat);
  if (!g || !wantIds.includes(g)) continue;
  const w = WANT[wantIds.indexOf(g)];
  const city = w.name.split("-")[0].toLowerCase();
  const o = c.operator ? normOp(c.operator).toLowerCase() : "";
  const kind = !o ? "untagged" : o.includes(city) && /(police|\bpd\b|sheriff|public safety)/.test(o) ? "police" : "other";
  const r = placeCounts.get(g) ?? { mapped: 0, police: 0, other: 0, untagged: 0, ops: new Map() };
  r.mapped++; r[kind]++;
  if (kind === "other") { const k = (classes.canonical?.[normOp(c.operator)] ?? normOp(c.operator)); r.ops.set(k, (r.ops.get(k) ?? 0) + 1); }
  placeCounts.set(g, r);
}
// the largest other operator in each city, then drop the working map
for (const r of placeCounts.values()) { const top = [...r.ops.entries()].sort((a, b) => b[1] - a[1])[0]; r.topOther = top ? { name: top[0], count: top[1] } : null; delete r.ops; }
// Mapped Flock cameras inside each incorporated place: the largest counts, for the Deployments page
const byPlace = new Map();
for (const c of flockCams) { const g = placeIdx.find(c.lon, c.lat); if (g) byPlace.set(g, (byPlace.get(g) ?? 0) + 1); }
// Census names consolidated governments by their legal form ("Indianapolis city (balance)"); keep the city's name.
const cleanPlace = (n) => n.replace(/ \(balance\)$/, "").replace(/ city$/, "").replace(/[-/][A-Z][A-Za-z ]* (metropolitan|metro|unified|consolidated) government$/, "").replace(/^Lexington-Fayette$/, "Lexington");
const cities = [...byPlace.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([g, n]) => ({ geoid: g, name: cleanPlace(placeById.get(g).NAME), usps: placeById.get(g).STUSPS, flock: n }));
write(OUT, "cities.json", { snapshot: snapshot.slice(0, 10), sources: ["deflock-tiles-2026", "census-boundaries-2024"], rows: cities });
log("cities:", cities.slice(0, 10).map((c) => `${c.name} ${c.usps} ${c.flock}`).join("; "));
const completeness = WANT.map((w, i) => ({ place: w.name === "Lexington-Fayette" ? "Lexington" : w.name, usps: w.usps, published: w.published, when: w.when, what: w.what, sources: w.sources, ...(wantIds[i] ? (placeCounts.get(wantIds[i]) ?? { mapped: 0, police: 0, other: 0, untagged: 0 }) : { mapped: null }) }));
write(OUT, "completeness.json", completeness);
log("completeness:", completeness.map((r) => `${r.place} ${r.mapped}/${r.published} (police-tagged ${r.police}, other ${r.other}, untagged ${r.untagged})`).join("; "));

// ---- Outcomes city basemaps ------------------------------------------------------------------------------------------
const outcomes = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/outcomes.json"), "utf8"));
// The Outcomes page matches records to the July 17, 2026 snapshot (the cameras on the map while the records were
// made); its city maps draw that same snapshot so the distances in its tables match what is drawn.
const july = JSON.parse(fs.readFileSync(raw("cameras-us-hourly-2026-07-17.geojson"), "utf8")).features.map((f) => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], ...f.properties, cls: f.properties.brand === "Flock Safety" ? 0 : f.properties.brand ? 1 : 2 }));
const circle = (lon, lat, m) => { const k = Math.cos(lat * Math.PI / 180), r = m / 111320, ring = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * 2 * Math.PI; ring.push([lon + Math.cos(a) * r / k, lat + Math.sin(a) * r]); } return ring; };
const CITY = [
  { key: "nashville", source: "nashville", roads: "tl_2024_47037_roads.zip", water: "tl_2024_47037_areawater.zip" },
  { key: "windsor", source: "windsor", roads: "tl_2024_09110_roads.zip", water: "tl_2024_09110_areawater.zip" },
  { key: "tucson", source: "tucson", roads: "tl_2024_04019_roads.zip" },
  { key: "story", source: "story", roads: "tl_2024_19169_roads.zip" },
];
const ROAD_CLASS = { S1100: 1, S1200: 2, S1630: 2, S1400: 3 };
for (const city of CITY) {
  const sites = outcomes.sites.filter((s) => s.source === city.source && s.lat != null && (city.source !== "story" || (s.values.alerts ?? 0) >= 2));
  const lats = sites.map((s) => s.lat), lons = sites.map((s) => s.lon);
  const k = Math.cos(((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI / 180), minPad = 600 / 111320;
  const padLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.15, minPad), padLon = Math.max((Math.max(...lons) - Math.min(...lons)) * 0.15, minPad / k);
  const bbox = [Math.min(...lons) - padLon, Math.min(...lats) - padLat, Math.max(...lons) + padLon, Math.max(...lats) + padLat];
  const major = await shapes(city.roads, `-clip bbox=${bbox.join(",")} -filter 'MTFCC === "S1100" || MTFCC === "S1200" || MTFCC === "S1630"' -filter-fields MTFCC,FULLNAME -simplify 40%`);
  // Local streets only within 1.2 km of a site: the texture where the reader looks, not across the whole county.
  const near = { type: "FeatureCollection", features: sites.map((s) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circle(s.lon, s.lat, 1200)] } })) };
  const localOut = await mapshaper.applyCommands(`-i in.zip -filter 'MTFCC === "S1400"' -clip near.json -dissolve MTFCC -simplify 30% -o format=geojson precision=0.00001 out.json`, { "in.zip": fs.readFileSync(raw(city.roads)), "near.json": JSON.stringify(near) });
  const local = JSON.parse(localOut["out.json"]);
  const roads = { features: major.features.concat(local.features) };
  const water = city.water ? await shapes(city.water, `-clip bbox=${bbox.join(",")} -filter 'AWATER > 20000' -simplify 30% -filter-fields FULLNAME`) : { features: [] };
  const r5 = (v) => Math.round(v * 1e4) / 1e4;
  const camsIn = july.filter((c) => c.lon >= bbox[0] && c.lon <= bbox[2] && c.lat >= bbox[1] && c.lat <= bbox[3]).map((c) => {
    const dirs = c.directions ? String(c.directions).split(/[;,]/).map((d) => parseFloat(d)).filter((d) => Number.isFinite(d)) : Number.isFinite(c.direction) ? [c.direction] : [];
    return [r5(c.lon), r5(c.lat), c.cls, dirs];
  });
  const fc = { type: "FeatureCollection", features: [
    ...roads.features.filter((f) => f.geometry).map((f) => ({ type: "Feature", properties: { c: ROAD_CLASS[f.properties.MTFCC] ?? 3, n: f.properties.FULLNAME ?? "" }, geometry: f.geometry })),
    ...water.features.filter((f) => f.geometry).map((f) => ({ type: "Feature", properties: { c: 9 }, geometry: f.geometry })),
  ] };
  const topo = JSON.parse(await toTopo(fc, "base", 20000));
  const size = write(BASE, `${city.key}.json`, { bbox, snapshot: "2026-07-17", topo, cameras: camsIn });
  log(`basemap ${city.key}: ${roads.features.length} roads, ${water.features.length} water, ${camsIn.length} cameras, ${(size / 1024).toFixed(0)} KB`);
}

// ---- Write tables, downloads and meta ---------------------------------------------------------------------------------
write(OUT, "states.topo.json", statesTopo);
write(OUT, "counties.topo.json", countiesTopo);
write(OUT, "states.json", { usRate, usFlock, usPop, rows: stateRows });
write(OUT, "counties.json", countyRows.map((r) => [r.fips, r.name, r.usps, r.flock, r.all, r.pop, r.per100k]));
write(OUT, "operators.json", {
  total: cams.length, flock: flockTotal, branded, shareAll: Math.round(flockTotal / cams.length * 1000) / 10, shareBranded: Math.round(flockTotal / branded * 1000) / 10,
  brands: brands.slice(0, 8).concat([{ brand: "Other makes", count: brands.slice(8).reduce((a, b) => a + b.count, 0) }]),
  flockWithOperator: withOperator, flockWithoutOperator: flockTotal - withOperator,
  classes: CLASSES.map((c) => ({ ...c, count: classCount.get(c.id) })),
  topNamed,
});
const csvRow = (a) => a.map((v) => (v == null ? "" : /[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",");
fs.writeFileSync(path.join(OUT, "cameras-by-state.csv"), ["state,usps,flock_cameras,all_plate_readers,population_2024,flock_per_100k"].concat(stateRows.map((r) => csvRow([r.name, r.usps, r.flock, r.all, r.pop, r.per100k]))).join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "cameras-by-county.csv"), ["fips,county,usps,flock_cameras,all_plate_readers,population_2024,flock_per_100k"].concat(countyRows.map((r) => csvRow([r.fips, r.name, r.usps, r.flock, r.all, r.pop, r.per100k]))).join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "operator-classes.csv"), ["operator_as_tagged,flock_cameras,class"].concat([...opCounts.entries()].sort((a, b) => b[1] - a[1]).map(([o, n]) => csvRow([o, n, classOf(o)]))).join("\n") + "\n");
const versions = { v1: cams.filter((c) => c.osmVersion === 1).length };
write(OUT, "meta.json", {
  snapshot: snapshot.slice(0, 10), built: new Date().toISOString().slice(0, 10), frame: FRAME, projection: { name: "geoAlbersUsa", scale, translate },
  cameras: { total: cams.length, flock: flockTotal, onMap: pts.length, offMap, assignedByFallback: fallback, unassigned, neverEditedShare: Math.round(versions.v1 / cams.length * 1000) / 10 },
  sources: ["deflock-tiles-2026", "census-pop-2024", "census-boundaries-2024"],
  licence: "Camera positions © OpenStreetMap contributors, ODbL 1.0, via DeFlock. Population: U.S. Census Bureau, Vintage 2024 estimates. Boundaries and roads: U.S. Census Bureau 2024 cartographic boundary and TIGER/Line files.",
});
// ---- stats.json: every number the story's text uses, each with the sources behind it --------------------------------
const CAM = ["deflock-tiles-2026"], POP = ["deflock-tiles-2026", "census-pop-2024", "census-boundaries-2024"];
const st = (value, sources, note) => ({ value, sources, ...(note ? { note } : {}) });
const rank51 = s51.slice().sort((a, b) => b.per100k - a.per100k);
const countiesUS = countyRows.filter((r) => r.usps !== "PR");
const noneRows = countiesUS.filter((r) => r.flock === 0);
const big = countiesUS.filter((r) => r.pop >= 1e6).sort((a, b) => b.per100k - a.per100k);
const mostCounty = countiesUS.slice().sort((a, b) => b.flock - a.flock)[0];
const opNamed = withOperator, retail = classCount.get("retail"), police = classCount.get("police");
const stats = {
  snapshot: st(snapshot.slice(0, 10), CAM, "Latest edit in the archive"),
  mappedTotal: st(cams.length, CAM), mappedFlock: st(flockTotal, CAM),
  flockShareAll: st(Math.round(flockTotal / cams.length * 100), CAM, "Percent of all mapped plate readers"),
  flockShareBranded: st(Math.round(flockTotal / branded * 100), CAM, "Percent of mapped readers with a make tagged"),
  neverEdited: st(Math.round(versions.v1 / cams.length * 100), CAM, "Percent never edited since first mapped"),
  usFlock: st(usFlock, POP, "50 states and D.C."), usRate: st(usRate, POP, "Flock cameras per 100,000 residents, 50 states and D.C."),
  topState: st({ name: rank51[0].name, rate: rank51[0].per100k, flock: rank51[0].flock, ratio: Math.round(rank51[0].per100k / usRate * 10) / 10 }, POP),
  bottomStates: st(rank51.slice(-5).reverse().map((r) => ({ name: r.name, rate: r.per100k, flock: r.flock })), POP),
  mostStates: st(s51.slice().sort((a, b) => b.flock - a.flock).slice(0, 2).map((r) => ({ name: r.name, flock: r.flock })), POP),
  countiesNone: st({ count: noneRows.length, of: countiesUS.length, popShare: Math.round(noneRows.reduce((a, r) => a + (r.pop || 0), 0) / countiesUS.reduce((a, r) => a + (r.pop || 0), 0) * 1000) / 10 }, POP),
  topBigCounty: st({ name: big[0].name, usps: big[0].usps, rate: big[0].per100k, flock: big[0].flock, pop: big[0].pop }, POP, "Highest rate per 100,000 residents among counties of a million people or more"),
  regions: st(REGIONS.map((g) => { const rows = s51.filter((r) => g.usps.includes(r.usps)); const f = rows.reduce((a, r) => a + r.flock, 0), p = rows.reduce((a, r) => a + r.pop, 0); return { name: g.name, flock: f, rate: Math.round(f / p * 1e6) / 10 }; }), POP, "Census regions; Flock cameras per 100,000 residents"),
  oaklandChp: st(completeness.find((r) => r.place === "Oakland")?.topOther ?? null, CAM, "The largest operator tagged on mapped Flock cameras inside Oakland other than its police"),
  mostCounty: st({ name: mostCounty.name, usps: mostCounty.usps, flock: mostCounty.flock }, POP),
  operatorsNamed: st({ count: opNamed, share: Math.round(opNamed / flockTotal * 100) }, CAM, "Flock cameras with an operator tagged"),
  operatorsRetail: st({ count: retail, share: Math.round(retail / opNamed * 100) }, CAM, "Retailers and shopping centers, among named operators"),
  operatorsPolice: st({ count: police, share: Math.round(police / opNamed * 100) }, CAM, "Police and sheriffs, among named operators"),
  topOperators: st(topNamed.slice(0, 3), CAM),
};
write(OUT, "stats.json", stats);
log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
