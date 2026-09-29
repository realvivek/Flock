/**
 * Camera maps drawn from the mapped cameras themselves: a national scatter of every Flock-tagged camera and city
 * panels around the outcome sites. Plain canvas, no tiles, no library; the camera file loads once when the first
 * panel scrolls into view. Panels draw at their on-screen width, so labels keep their size on a phone.
 */
import { BASE } from "./lib/base";

export type Pt = [number, number];
export interface Ring { lon: number; lat: number; size: number; depth: 0 | 1 | 2 | 3; n?: number }
export interface Box { s: number; w: number; n: number; e: number }
interface CamFile { count: number; total: number; asOf: string; points: Pt[] }
let camsPromise: Promise<CamFile> | null = null;
export const loadCameras = (): Promise<CamFile> => (camsPromise ??= fetch(`${BASE}data/cameras-flock.json`).then((r) => r.json()));

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#000";
const depthStyle = (d: Ring["depth"]) => d === 3 ? { stroke: css("--ink"), fill: css("--ink"), alpha: 0.85 } : d === 2 ? { stroke: css("--amber"), fill: css("--amber"), alpha: 0.75 } : d === 1 ? { stroke: css("--ink-3"), fill: css("--ink-3"), alpha: 0.35 } : { stroke: css("--ink-3"), fill: "transparent", alpha: 1 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** The canvas's width on screen in CSS pixels. */
const cssWidth = (canvas: HTMLCanvasElement) => Math.round(canvas.parentElement?.clientWidth || canvas.getBoundingClientRect().width || 1120);

function setup(canvas: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.aspectRatio = `${w} / ${h}`;
  const ctx = canvas.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  return ctx;
}

interface Rect { x: number; y: number; w: number; h: number }
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Rings, largest first so small ones stay visible; numbers placed where they collide least with other numbers and rings. */
function rings(ctx: CanvasRenderingContext2D, project: (lon: number, lat: number) => [number, number], list: Ring[], label: boolean, scale: number, W: number, H: number) {
  const circles = list.map((r) => { const [x, y] = project(r.lon, r.lat); return { r, x, y, rad: (3 + 2.4 * Math.sqrt(r.size)) * scale }; }).sort((a, b) => b.rad - a.rad);
  for (const c of circles) {
    const st = depthStyle(c.r.depth);
    ctx.globalAlpha = st.alpha; ctx.beginPath(); ctx.arc(c.x, c.y, c.rad, 0, Math.PI * 2); ctx.fillStyle = st.fill; if (st.fill !== "transparent") ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.strokeStyle = st.stroke; ctx.stroke();
  }
  if (!label) return;
  ctx.font = `600 11px ${css("--mono") || "monospace"}`; ctx.textBaseline = "middle";
  const placed: Rect[] = [];
  const hitsCircle = (rc: Rect, c: { x: number; y: number; rad: number }) => { const nx = clamp(c.x, rc.x, rc.x + rc.w), ny = clamp(c.y, rc.y, rc.y + rc.h); return (nx - c.x) ** 2 + (ny - c.y) ** 2 < (c.rad - 0.5) ** 2; };
  const score = (rc: Rect, self: (typeof circles)[number]) => rc.x < 2 || rc.y < 2 || rc.x + rc.w > W - 2 || rc.y + rc.h > H - 2 ? Infinity : placed.filter((p) => overlap(p, rc)).length * 10 + circles.filter((o) => o !== self && hitsCircle(rc, o)).length;
  for (const c of circles.filter((c) => c.r.n != null).sort((a, b) => a.r.n! - b.r.n!)) {
    const text = String(c.r.n); const tw = ctx.measureText(text).width + 4, th = 13; const d = c.rad + 2;
    const near: [number, number][] = [[d, -th / 2], [-d - tw, -th / 2], [-tw / 2, -d - th], [-tw / 2, d], [d * 0.7, -d * 0.7 - th], [d * 0.7, d * 0.7], [-d * 0.7 - tw, -d * 0.7 - th], [-d * 0.7 - tw, d * 0.7]];
    let best: Rect | null = null, bestScore = Infinity, leader = false;
    for (const [dx, dy] of near) { const rc = { x: c.x + dx, y: c.y + dy, w: tw, h: th }; const s = score(rc, c); if (s < bestScore) { best = rc; bestScore = s; } if (s === 0) break; }
    if (bestScore > 0) {
      search: for (const dist of [d + 14, d + 26, d + 40, d + 56]) for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2; const rc = { x: c.x + Math.cos(a) * dist - tw / 2, y: c.y + Math.sin(a) * dist - th / 2, w: tw, h: th };
        const s = score(rc, c); if (s < bestScore) { best = rc; bestScore = s; leader = true; } if (s === 0) break search;
      }
    }
    if (!best) continue;
    const cx = best.x + best.w / 2, cy = best.y + best.h / 2;
    if (leader) { const a = Math.atan2(cy - c.y, cx - c.x); ctx.strokeStyle = css("--ink-3"); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * c.rad, c.y + Math.sin(a) * c.rad); ctx.lineTo(cx - Math.cos(a) * (tw / 2), cy - Math.sin(a) * (th / 2)); ctx.stroke(); }
    ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.lineJoin = "round"; ctx.strokeText(text, best.x + 2, cy);
    ctx.fillStyle = css("--ink"); ctx.fillText(text, best.x + 2, cy);
    placed.push(best);
  }
  ctx.textBaseline = "alphabetic";
}

/** The lower 48 on an equirectangular projection; every Flock camera is one dot. */
export function drawNational(canvas: HTMLCanvasElement, pts: Pt[], sites: Ring[]): void {
  const w = cssWidth(canvas), h = Math.round(w * 640 / 1120); const ctx = setup(canvas, w, h);
  const W = -125.5, E = -66, S = 24, N = 49.6; const k = Math.cos(37 * Math.PI / 180);
  const sx = w / ((E - W) * k), sy = h / (N - S); const s = Math.min(sx, sy);
  const ox = (w - (E - W) * k * s) / 2, oy = (h - (N - S) * s) / 2;
  const project = (lon: number, lat: number): [number, number] => [ox + (lon - W) * k * s, oy + (N - lat) * s];
  ctx.fillStyle = css("--ink-3"); ctx.globalAlpha = 0.5; const dot = w < 600 ? 1 : 1.2;
  for (const [lon, lat] of pts) { if (lon < W || lon > E || lat < S || lat > N) continue; const [x, y] = project(lon, lat); ctx.fillRect(x, y, dot, dot); }
  ctx.globalAlpha = 1;
  rings(ctx, project, sites, false, clamp(w / 1120, 0.55, 1), w, h);
}

/** A city panel: cameras within the box, outcome sites as numbered rings, a scale bar. Returns the camera count drawn. */
export function drawCity(canvas: HTMLCanvasElement, pts: Pt[], sites: Ring[], box: Box): number {
  const k = Math.cos(((box.s + box.n) / 2) * Math.PI / 180);
  const boxW = (box.e - box.w) * k, boxH = box.n - box.s;
  const w = cssWidth(canvas); const h = Math.round(clamp(w * (boxH / boxW), w * 0.45, Math.min(w, 640)));
  const ctx = setup(canvas, w, h);
  const s = Math.min(w / boxW, h / boxH) * 0.94;
  const ox = (w - boxW * s) / 2, oy = (h - boxH * s) / 2;
  const project = (lon: number, lat: number): [number, number] => [ox + (lon - box.w) * k * s, oy + (box.n - lat) * s];
  // what the frame actually shows, which is wider than the box on one axis
  const view: Box = { w: box.w - ox / (k * s), e: box.w + (w - ox) / (k * s), n: box.n + oy / s, s: box.n - (h - oy) / s };
  ctx.strokeStyle = "rgba(60, 90, 160, .10)"; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); ctx.stroke(); }
  let n = 0;
  ctx.fillStyle = css("--cyan"); ctx.globalAlpha = 0.8; const dotR = w < 600 ? 2 : 2.6;
  for (const [lon, lat] of pts) { if (lon < view.w || lon > view.e || lat < view.s || lat > view.n) continue; const [x, y] = project(lon, lat); ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI * 2); ctx.fill(); n++; }
  ctx.globalAlpha = 1;
  rings(ctx, project, sites.filter((r) => r.lon >= view.w && r.lon <= view.e && r.lat >= view.s && r.lat <= view.n), true, clamp(w / 1120, 0.6, 1), w, h);
  // scale bar: the longest round length that fits in a quarter of the width
  const mPerPx = 111320 / s; // metres per CSS pixel (one pixel is 1/s degrees of latitude, or 1/(k*s) of longitude)
  const lengths = [100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const len = lengths.filter((m) => m / mPerPx <= w * 0.25).pop() ?? 100; const px = len / mPerPx;
  ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(14, h - 40, px + 20, 30);
  ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(24, h - 16); ctx.lineTo(24 + px, h - 16); ctx.stroke();
  ctx.fillStyle = css("--ink"); ctx.font = `500 11px ${css("--mono") || "monospace"}`; ctx.fillText(len >= 1000 ? `${len / 1000} km` : `${len} m`, 24, h - 22);
  return n;
}
