// Downloads the raw inputs for the home story into data/story/raw/ (git-ignored) and records each file's URL, ETag,
// size and SHA-256 in data/story/manifest.json (committed), so every figure can be traced to the exact bytes used.
// Usage: node scripts/story/fetch.mjs [--force]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const RAW = path.join(ROOT, "data/story/raw");
const MANIFEST = path.join(ROOT, "data/story/manifest.json");
const UA = "flock-anatomy research build (https://github.com/realvivek/Flock)";
const FORCE = process.argv.includes("--force");
const CENSUS = "https://www2.census.gov";

export const INPUTS = [
  { id: "cameras", url: "https://tiles.dontgetflocked.com/cameras-us-hourly.pmtiles", file: "cameras-us-hourly.pmtiles", note: "OpenStreetMap surveillance nodes as published by DeFlock, ODbL" },
  { id: "cameras-july", url: "https://data.dontgetflocked.com/cameras-us-hourly.geojson.gz", file: "cameras-us-hourly-2026-07-17.geojson", note: "The same data as one GeoJSON file; its latest edit is 17 July 2026 (the snapshot the Outcomes matches use)" },
  { id: "counties", url: `${CENSUS}/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip`, file: "cb_2024_us_county_500k.zip", note: "Census 2024 cartographic boundary, counties (Connecticut planning regions)" },
  { id: "places", url: `${CENSUS}/geo/tiger/GENZ2024/shp/cb_2024_us_place_500k.zip`, file: "cb_2024_us_place_500k.zip", note: "Census 2024 cartographic boundary, incorporated places" },
  { id: "pop-states", url: `${CENSUS}/programs-surveys/popest/datasets/2020-2024/state/totals/NST-EST2024-ALLDATA.csv`, file: "NST-EST2024-ALLDATA.csv", note: "Census Vintage 2024 state population estimates" },
  { id: "pop-counties", url: `${CENSUS}/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv`, file: "co-est2024-alldata.csv", note: "Census Vintage 2024 county population estimates (Latin-1)" },
  { id: "roads-ga", url: `${CENSUS}/geo/tiger/TIGER2024/PRISECROADS/tl_2024_13_prisecroads.zip`, file: "tl_2024_13_prisecroads.zip", note: "TIGER 2024 primary and secondary roads, Georgia" },
  { id: "roads-davidson", url: `${CENSUS}/geo/tiger/TIGER2024/ROADS/tl_2024_47037_roads.zip`, file: "tl_2024_47037_roads.zip", note: "TIGER 2024 roads, Davidson County TN (Nashville)" },
  { id: "roads-capitol", url: `${CENSUS}/geo/tiger/TIGER2024/ROADS/tl_2024_09110_roads.zip`, file: "tl_2024_09110_roads.zip", note: "TIGER 2024 roads, Capitol Planning Region CT (Windsor)" },
  { id: "roads-pima", url: `${CENSUS}/geo/tiger/TIGER2024/ROADS/tl_2024_04019_roads.zip`, file: "tl_2024_04019_roads.zip", note: "TIGER 2024 roads, Pima County AZ (Tucson)" },
  { id: "roads-story", url: `${CENSUS}/geo/tiger/TIGER2024/ROADS/tl_2024_19169_roads.zip`, file: "tl_2024_19169_roads.zip", note: "TIGER 2024 roads, Story County IA" },
  { id: "water-davidson", url: `${CENSUS}/geo/tiger/TIGER2024/AREAWATER/tl_2024_47037_areawater.zip`, file: "tl_2024_47037_areawater.zip", note: "TIGER 2024 area water, Davidson County TN" },
  { id: "water-capitol", url: `${CENSUS}/geo/tiger/TIGER2024/AREAWATER/tl_2024_09110_areawater.zip`, file: "tl_2024_09110_areawater.zip", note: "TIGER 2024 area water, Capitol Planning Region CT" },
];

async function download(input) {
  const dest = path.join(RAW, input.file);
  if (!FORCE && fs.existsSync(dest)) return { ...input, cached: true };
  const res = await fetch(input.url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${input.url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { ...input, etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified"), fetchedAt: new Date().toISOString() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync(RAW, { recursive: true });
  const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { files: {} };
  const files = { ...prev.files };
  for (const input of INPUTS) {
    const r = await download(input);
    const buf = fs.readFileSync(path.join(RAW, input.file));
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    files[input.id] = { url: input.url, file: input.file, note: input.note, bytes: buf.length, sha256, etag: r.etag ?? files[input.id]?.etag ?? null, lastModified: r.lastModified ?? files[input.id]?.lastModified ?? null, fetchedAt: r.fetchedAt ?? files[input.id]?.fetchedAt ?? null };
    console.log(r.cached ? "cached " : "fetched", input.id, (buf.length / 1e6).toFixed(1), "MB");
  }
  fs.writeFileSync(MANIFEST, JSON.stringify({ files }, null, 2) + "\n");
}
