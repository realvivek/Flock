/**
 * Camera maps drawn from the mapped cameras themselves: a national scatter of every Flock-tagged camera and city
 * panels around the outcome sites. Plain canvas, no tiles, no library; the camera file loads once when the first
 * panel scrolls into view.
 */
import { BASE } from "./lib/base";

export type Pt = [number, number];
export interface Ring { lon: number; lat: number; size: number; depth: 0 | 1 | 2 | 3; n?: number }
interface CamFile { count: number; total: number; asOf: string; points: Pt[] }
let camsPromise: Promise<CamFile> | null = null;
export const loadCameras = (): Promise<CamFile> => (camsPromise ??= fetch(`${BASE}data/cameras-flock.json`).then((r) => r.json()));

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#000";
const depthStyle = (d: Ring["depth"]) => d === 3 ? { stroke: css("--ink"), fill: css("--ink"), alpha: 0.85 } : d === 2 ? { stroke: css("--amber"), fill: css("--amber"), alpha: 0.75 } : d === 1 ? { stroke: css("--ink-3"), fill: css("--ink-3"), alpha: 0.35 } : { stroke: css("--ink-3"), fill: "transparent", alpha: 1 };

function setup(canvas: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d")!; ctx.scale(dpr, dpr);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  return ctx;
}
function rings(ctx: CanvasRenderingContext2D, project: (lon: number, lat: number) => [number, number], list: Ring[], label: boolean) {
  ctx.font = `600 11px ${css("--mono") || "monospace"}`;
  for (const r of list) {
    const [x, y] = project(r.lon, r.lat); const st = depthStyle(r.depth); const rad = 4 + 2.6 * Math.sqrt(r.size);
    ctx.globalAlpha = st.alpha; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = st.fill; if (st.fill !== "transparent") ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.strokeStyle = st.stroke; ctx.stroke();
    if (label && r.n != null) { ctx.fillStyle = css("--ink"); ctx.fillText(String(r.n), x + rad + 3, y + 4); }
  }
}
/** The lower 48 on an equirectangular projection; every Flock camera is one dot. */
export function drawNational(canvas: HTMLCanvasElement, pts: Pt[], sites: Ring[]): void {
  const w = 1120, h = 640; const ctx = setup(canvas, w, h);
  const W = -125.5, E = -66, S = 24, N = 49.6; const k = Math.cos(37 * Math.PI / 180);
  const sx = w / ((E - W) * k), sy = h / (N - S); const s = Math.min(sx, sy);
  const ox = (w - (E - W) * k * s) / 2, oy = (h - (N - S) * s) / 2;
  const project = (lon: number, lat: number): [number, number] => [ox + (lon - W) * k * s, oy + (N - lat) * s];
  ctx.fillStyle = css("--ink-3"); ctx.globalAlpha = 0.55;
  for (const [lon, lat] of pts) { if (lon < W || lon > E || lat < S || lat > N) continue; const [x, y] = project(lon, lat); ctx.fillRect(x, y, 1.2, 1.2); }
  ctx.globalAlpha = 1;
  rings(ctx, project, sites, false);
}
/** A city panel: cameras within the box, outcome sites as numbered rings, a scale bar. Returns the camera count drawn. */
export function drawCity(canvas: HTMLCanvasElement, pts: Pt[], sites: Ring[], box: { s: number; w: number; n: number; e: number }): number {
  const w = 1120, h = 700; const ctx = setup(canvas, w, h);
  const k = Math.cos(((box.s + box.n) / 2) * Math.PI / 180);
  const s = Math.min(w / ((box.e - box.w) * k), h / (box.n - box.s)) * 0.94;
  const ox = (w - (box.e - box.w) * k * s) / 2, oy = (h - (box.n - box.s) * s) / 2;
  const project = (lon: number, lat: number): [number, number] => [ox + (lon - box.w) * k * s, oy + (box.n - lat) * s];
  // faint grid like the page ground
  ctx.strokeStyle = "rgba(60, 90, 160, .10)"; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  let n = 0;
  ctx.fillStyle = css("--cyan"); ctx.globalAlpha = 0.8;
  for (const [lon, lat] of pts) { if (lon < box.w || lon > box.e || lat < box.s || lat > box.n) continue; const [x, y] = project(lon, lat); ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); n++; }
  ctx.globalAlpha = 1;
  rings(ctx, project, sites, true);
  // scale bar: 2 km
  const metersPerDeg = 111320 * k; const px = (2000 / metersPerDeg) * s;
  ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(24, h - 24); ctx.lineTo(24 + px, h - 24); ctx.stroke();
  ctx.fillStyle = css("--ink"); ctx.font = `500 11px ${css("--mono") || "monospace"}`; ctx.fillText("2 km", 24, h - 30);
  return n;
}
