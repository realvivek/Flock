/**
 * Invariants of the committed story data: the packed camera file decodes to the counts in meta.json, the state,
 * county and operator tables add up to the totals the story quotes, every number in stats.json cites known sources,
 * and each city basemap covers its outcome sites. Reads files from disk; no browser.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { decodeCams } from "../src/viz/cams";

const json = (p: string) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const meta = json("public/data/story/meta.json");
const stats = json("public/data/story/stats.json");
const states = json("public/data/story/states.json");
const counties: [string, string, string, number, number, number | null, number | null][] = json("public/data/story/counties.json");
const operators = json("public/data/story/operators.json");
const sourceIds = new Set<string>(json("src/content/sources.json").sources.map((s: { id: string }) => s.id));

test("cams.bin decodes to every on-map camera inside the frame", () => {
  const gz = readFileSync(new URL("../public/data/story/cams.bin", import.meta.url));
  const raw = gunzipSync(gz);
  const cams = decodeCams(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  expect(cams.n).toBe(meta.cameras.onMap);
  expect([cams.w, cams.h]).toEqual(meta.frame);
  // count in plain loops and assert once: an expect() per point would take minutes
  let flock = 0, badClass = 0, outside = 0;
  for (let i = 0; i < cams.n; i++) {
    if (cams.cls[i]! > 2) badClass++;
    if (cams.cls[i] === 0) flock++;
    // the projection was fitted with a 6-unit margin; allow a little for points just off a simplified coastline
    if (cams.x[i]! < 2 || cams.x[i]! > cams.w - 2 || cams.y[i]! < 2 || cams.y[i]! > cams.h - 2) outside++;
  }
  expect(badClass).toBe(0);
  expect(outside).toBe(0);
  // Georgia, the state with the highest rate, should hold a dense block of dots near Atlanta (x ≈ 690, y ≈ 394)
  let atl = 0;
  for (let i = 0; i < cams.n; i++) if (Math.abs(cams.x[i]! - 690) < 12 && Math.abs(cams.y[i]! - 394) < 12) atl++;
  expect(atl).toBeGreaterThan(1000);
  expect(flock).toBeLessThanOrEqual(meta.cameras.flock);
  expect(meta.cameras.flock - flock).toBeLessThanOrEqual(meta.cameras.offMap);
  expect(meta.cameras.onMap + meta.cameras.offMap).toBe(meta.cameras.total);
});

test("state and county tables add up to the totals the story quotes", () => {
  const rows51 = states.rows.filter((r: { usps: string }) => r.usps !== "PR");
  expect(rows51).toHaveLength(51);
  const usFlock = rows51.reduce((a: number, r: { flock: number }) => a + r.flock, 0);
  const usPop = rows51.reduce((a: number, r: { pop: number }) => a + r.pop, 0);
  expect(usFlock).toBe(states.usFlock);
  expect(usFlock).toBe(stats.usFlock.value);
  expect(states.usRate).toBe(Math.round(usFlock / usPop * 1e6) / 10);
  expect(stats.usRate.value).toBe(states.usRate);
  // every state's count equals the sum of its counties
  const byState = new Map<string, number>();
  for (const c of counties) byState.set(c[2], (byState.get(c[2]) ?? 0) + c[3]);
  for (const r of states.rows) expect(byState.get(r.usps) ?? 0, r.usps).toBe(r.flock);
  const top = rows51.slice().sort((a: { per100k: number }, b: { per100k: number }) => b.per100k - a.per100k)[0];
  expect(stats.topState.value.name).toBe(top.name);
  const us = counties.filter((c) => c[2] !== "PR");
  expect(stats.countiesNone.value.of).toBe(us.length);
  expect(stats.countiesNone.value.count).toBe(us.filter((c) => c[3] === 0).length);
});

test("make and operator tables match the camera totals", () => {
  expect(operators.total).toBe(meta.cameras.total);
  expect(operators.flock).toBe(meta.cameras.flock);
  expect(stats.mappedTotal.value).toBe(meta.cameras.total);
  expect(stats.mappedFlock.value).toBe(meta.cameras.flock);
  expect(operators.brands.reduce((a: number, b: { count: number }) => a + b.count, 0)).toBe(operators.total);
  expect(operators.flockWithOperator + operators.flockWithoutOperator).toBe(operators.flock);
  expect(operators.classes.reduce((a: number, c: { count: number }) => a + c.count, 0)).toBe(operators.flockWithOperator);
  expect(stats.operatorsNamed.value.count).toBe(operators.flockWithOperator);
});

test("every computed figure cites sources that exist", () => {
  for (const [k, v] of Object.entries(stats) as [string, { value: unknown; sources: string[] }][]) {
    expect(v.value, k).not.toBeNull();
    expect(v.sources.length, k).toBeGreaterThan(0);
    for (const id of v.sources) expect(sourceIds.has(id), `${k}: ${id}`).toBe(true);
  }
  for (const id of meta.sources) expect(sourceIds.has(id), id).toBe(true);
  for (const row of json("public/data/story/completeness.json")) {
    expect(row.mapped, row.place).toBeGreaterThan(0);
    for (const id of row.sources) expect(sourceIds.has(id), `${row.place}: ${id}`).toBe(true);
  }
});

test("each city basemap covers its outcome sites and uses the July snapshot", () => {
  const outcomes = json("public/data/outcomes.json");
  for (const key of ["nashville", "windsor", "tucson", "story"]) {
    const map = json(`public/data/basemaps/${key}.json`);
    expect(map.snapshot, key).toBe("2026-07-17");
    expect(Object.keys(map.topo.objects).length, key).toBeGreaterThan(0);
    expect(map.cameras.length, key).toBeGreaterThan(0);
    const [w, s, e, n] = map.bbox;
    const sites = outcomes.sites.filter((x: { source: string; lat: number | null; values: { alerts?: number } }) => x.source === key && x.lat != null && (key !== "story" || (x.values.alerts ?? 0) >= 2));
    expect(sites.length, key).toBeGreaterThan(0);
    for (const x of sites) expect(x.lon >= w && x.lon <= e && x.lat >= s && x.lat <= n, `${key} ${x.label}`).toBe(true);
  }
});
