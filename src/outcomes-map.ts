/**
 * Maps for the Outcomes page. The overview draws every mapped Flock camera from the story's packed camera file
 * (Albers USA frame) with the outcome sites as rings. Each city panel draws Census TIGER streets and water from
 * public/data/basemaps, the cameras mapped on July 17, 2026 (the snapshot the tables were matched against) with
 * Flock cameras as wedges pointing the way they face, and the outcome sites as numbered rings whose numbers avoid
 * each other. Panels draw at their on-screen width, so text keeps its size on a phone.
 */
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { BASE } from "./lib/base";
import { loadCams, type Cams } from "./viz/cams";

export interface Ring { x: number; y: number; size: number; depth: 0 | 1 | 2 | 3; n?: number }
export interface Box { s: number; w: number; n: number; e: number }
interface Basemap { bbox: [number, number, number, number]; snapshot: string; topo: Topology; cameras: [number, number, number, number[]][] }

const DEPTH_FILL = ["#ffffff", "#ffffff", "#e3b45f", "#7d4f08"];
const DEPTH_STROKE = ["#727272", "#121212", "#9a5b00", "#432704"];
/** Legend entries for the rings, shared with the page's text. */
export const DEPTH_LABEL = ["", "Alerts only", "A stop", "A recovery or an arrest"];

let camsP: Promise<Cams> | null = null, statesP: Promise<Path2D> | null = null;
const basemaps = new Map<string, Promise<Basemap>>();
const loadNational = () => (camsP ??= loadCams(`${BASE}data/story/cams.bin`));
const loadStates = () => (statesP ??= fetch(`${BASE}data/story/states.topo.json`).then((r) => r.json()).then((t: Topology) => toPath([mesh(t, t.objects.states as GeometryCollection)], false)));
const loadBasemap = (key: string) => { let p = basemaps.get(key); if (!p) { p = fetch(`${BASE}data/basemaps/${key}.json`).then((r) => r.json()); basemaps.set(key, p); } return p; };

function toPath(geoms: (GeoJSON.Geometry | null)[], close: boolean, f: (x: number, y: number) => [number, number] = (x, y) => [x, y]): Path2D {
  const p = new Path2D();
  const ring = (r: number[][]) => { r.forEach((c, i) => { const [x, y] = f(c[0]!, c[1]!); if (i) p.lineTo(x, y); else p.moveTo(x, y); }); if (close) p.closePath(); };
  for (const g of geoms) {
    if (!g) continue;
    if (g.type === "Polygon") g.coordinates.forEach(ring);
    else if (g.type === "MultiPolygon") g.coordinates.forEach((poly) => poly.forEach(ring));
    else if (g.type === "LineString") ring(g.coordinates);
    else if (g.type === "MultiLineString") g.coordinates.forEach(ring);
  }
  return p;
}

const cssWidth = (canvas: HTMLCanvasElement) => Math.round(canvas.parentElement?.clientWidth || canvas.getBoundingClientRect().width || 900);
function setup(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.aspectRatio = `${w} / ${h}`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  return ctx;
}
const ringRadius = (size: number, scale: number) => (3.5 + 2.2 * Math.sqrt(size)) * scale;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
interface Rect { x: number; y: number; w: number; h: number }
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Rings, largest first so small ones stay visible; numbers placed where they collide least with other numbers and rings. */
function drawRings(ctx: CanvasRenderingContext2D, list: { x: number; y: number; r: number; depth: number; n?: number }[], W: number, H: number): void {
  const circles = list.slice().sort((a, b) => b.r - a.r);
  for (const c of circles) {
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.globalAlpha = c.depth >= 2 ? 0.9 : 0.75; ctx.fillStyle = DEPTH_FILL[c.depth]!; ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.strokeStyle = DEPTH_STROKE[c.depth]!; ctx.stroke();
  }
  const numbered = circles.filter((c) => c.n != null).sort((a, b) => a.n! - b.n!);
  if (!numbered.length) return;
  ctx.font = `700 11px ${getComputedStyle(document.body).getPropertyValue("--sans") || "sans-serif"}`;
  ctx.textBaseline = "middle";
  const placed: Rect[] = [];
  const hitsCircle = (rc: Rect, c: { x: number; y: number; r: number }) => { const nx = clamp(c.x, rc.x, rc.x + rc.w), ny = clamp(c.y, rc.y, rc.y + rc.h); return (nx - c.x) ** 2 + (ny - c.y) ** 2 < (c.r - 0.5) ** 2; };
  const score = (rc: Rect, self: object) => rc.x < 2 || rc.y < 2 || rc.x + rc.w > W - 2 || rc.y + rc.h > H - 2 ? Infinity : placed.filter((p) => overlap(p, rc)).length * 10 + circles.filter((o) => o !== self && hitsCircle(rc, o)).length;
  for (const c of numbered) {
    const t = String(c.n), tw = ctx.measureText(t).width + 4, th = 13, d = c.r + 2;
    const near: [number, number][] = [[d, -th / 2], [-d - tw, -th / 2], [-tw / 2, -d - th], [-tw / 2, d], [d * 0.7, -d * 0.7 - th], [d * 0.7, d * 0.7], [-d * 0.7 - tw, -d * 0.7 - th], [-d * 0.7 - tw, d * 0.7]];
    let best: Rect | null = null, bestScore = Infinity, leader = false;
    for (const [dx, dy] of near) { const rc = { x: c.x + dx, y: c.y + dy, w: tw, h: th }; const s = score(rc, c); if (s < bestScore) { best = rc; bestScore = s; } if (s === 0) break; }
    if (bestScore > 0) {
      search: for (const dist of [d + 14, d + 26, d + 40, d + 56]) for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, rc = { x: c.x + Math.cos(a) * dist - tw / 2, y: c.y + Math.sin(a) * dist - th / 2, w: tw, h: th };
        const s = score(rc, c); if (s < bestScore) { best = rc; bestScore = s; leader = true; } if (s === 0) break search;
      }
    }
    if (!best) continue;
    const cx = best.x + best.w / 2, cy = best.y + best.h / 2;
    if (leader) { const a = Math.atan2(cy - c.y, cx - c.x); ctx.strokeStyle = "#727272"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r); ctx.lineTo(cx - Math.cos(a) * (tw / 2), cy - Math.sin(a) * (th / 2)); ctx.stroke(); }
    ctx.lineWidth = 3.5; ctx.strokeStyle = "#fff"; ctx.lineJoin = "round"; ctx.strokeText(t, best.x + 2, cy);
    ctx.fillStyle = "#121212"; ctx.fillText(t, best.x + 2, cy);
    placed.push(best);
  }
  ctx.textBaseline = "alphabetic";
}

/** The overview: every mapped Flock camera as a grey dot, the outcome sites as rings. */
export async function drawNational(canvas: HTMLCanvasElement, sites: Ring[]): Promise<number> {
  const [cams, states] = await Promise.all([loadNational(), loadStates()]);
  const w = cssWidth(canvas), h = Math.round(w * 0.62), ctx = setup(canvas, w, h);
  const pad = w < 600 ? 6 : 12, k = Math.min((w - 2 * pad) / 1000, (h - 2 * pad) / 620), ox = (w - 1000 * k) / 2, oy = (h - 620 * k) / 2;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k);
  ctx.strokeStyle = "#dcdcd9"; ctx.lineWidth = 0.8 / k; ctx.stroke(states);
  ctx.fillStyle = "#b9b9b6"; ctx.globalAlpha = 0.55;
  const d = (w < 600 ? 1 : 1.2) / k;
  let n = 0;
  for (let i = 0; i < cams.n; i++) if (cams.cls[i] === 0) { ctx.fillRect(cams.x[i]! - d / 2, cams.y[i]! - d / 2, d, d); n++; }
  ctx.restore(); ctx.globalAlpha = 1;
  const scale = clamp(w / 1100, 0.55, 1);
  drawRings(ctx, sites.map((s) => ({ x: ox + s.x * k, y: oy + s.y * k, r: ringRadius(s.size, scale) * 0.8, depth: s.depth })), w, h);
  return n;
}

/** A city panel. `sites` are in lon/lat; `box` frames the numbered sites. Returns the number of Flock cameras drawn. */
export async function drawCity(canvas: HTMLCanvasElement, key: string, sites: { lon: number; lat: number; size: number; depth: 0 | 1 | 2 | 3; n?: number }[], box: Box): Promise<number> {
  const base = await loadBasemap(key);
  const k = Math.cos(((box.s + box.n) / 2) * Math.PI / 180);
  const boxW = (box.e - box.w) * k, boxH = box.n - box.s;
  const w = cssWidth(canvas), h = Math.round(clamp(w * (boxH / boxW), w * 0.5, Math.min(w * 0.9, 620)));
  const ctx = setup(canvas, w, h);
  const s = Math.min(w / boxW, h / boxH) * 0.94;
  const ox = (w - boxW * s) / 2, oy = (h - boxH * s) / 2;
  const P = (lon: number, lat: number): [number, number] => [ox + (lon - box.w) * k * s, oy + (box.n - lat) * s];
  // streets and water from TIGER (one topology object per geometry type)
  const feats = Object.values(base.topo.objects).flatMap((o) => (feature(base.topo, o as GeometryCollection) as unknown as GeoJSON.FeatureCollection).features);
  const byClass = (c: number) => feats.filter((f) => (f.properties as { c: number }).c === c).map((f) => f.geometry);
  ctx.fillStyle = "#e3ecf2"; ctx.fill(toPath(byClass(9), true, P));
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [c, color, width] of [[3, "#ececea", 0.8], [2, "#cacac7", 1.6], [1, "#a5a5a2", 2.6]] as const) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(toPath(byClass(c), false, P)); }
  // cameras: other makes as grey dots, Flock as amber wedges facing the recorded direction
  const view = { w: box.w - ox / (k * s), e: box.w + (w - ox) / (k * s), n: box.n + oy / s, s: box.n - (h - oy) / s };
  let n = 0;
  const L = w < 600 ? 9 : 11;
  for (const [lon, lat, cls, dirs] of base.cameras) {
    if (lon < view.w || lon > view.e || lat < view.s || lat > view.n) continue;
    const [x, y] = P(lon, lat);
    if (cls !== 0) { ctx.fillStyle = "#a9a9a6"; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); continue; }
    n++;
    ctx.fillStyle = "rgba(196,125,14,.55)";
    for (const dir of dirs) { const a = (dir - 90) * Math.PI / 180, half = 0.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a - half) * L, y + Math.sin(a - half) * L); ctx.lineTo(x + Math.cos(a + half) * L, y + Math.sin(a + half) * L); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = "#c47d0e"; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  const scale = clamp(w / 1100, 0.6, 1);
  drawRings(ctx, sites.filter((r) => r.lon >= view.w && r.lon <= view.e && r.lat >= view.s && r.lat <= view.n).map((r) => { const [x, y] = P(r.lon, r.lat); return { x, y, r: ringRadius(r.size, scale), depth: r.depth, n: r.n }; }), w, h);
  // scale bar: the longest round length that fits in a quarter of the width
  const mPerPx = 111320 / s;
  const len = [100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter((m) => m / mPerPx <= w * 0.25).pop() ?? 100, px = len / mPerPx;
  const sx = Math.max(18, Math.round(ox) + 8);
  ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(sx - 8, h - 34, px + 28, 26);
  ctx.strokeStyle = "#121212"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx, h - 13); ctx.lineTo(sx + px, h - 13); ctx.moveTo(sx, h - 17); ctx.lineTo(sx, h - 13); ctx.moveTo(sx + px, h - 17); ctx.lineTo(sx + px, h - 13); ctx.stroke();
  ctx.fillStyle = "#333"; ctx.font = `500 11px ${getComputedStyle(document.body).getPropertyValue("--sans") || "sans-serif"}`; ctx.fillText(len >= 1000 ? `${len / 1000} km` : `${len} m`, sx, h - 20);
  return n;
}
