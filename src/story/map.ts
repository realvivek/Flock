/**
 * The opening map. Every mapped plate reader is a dot on a canvas, pre-projected (Albers USA, 1000 x 620 frame) in
 * cams.bin. Four looks, one per step: all readers; Flock's highlighted; a zoom to Atlanta with its interstates; and
 * counties shaded by Flock cameras per 100,000 residents. Each step declares its whole look, so scrolling either way,
 * or jumping, lands on the right picture. Under reduced motion the looks change without animation.
 */
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { interpolateZoom } from "d3-interpolate";
import { BASE } from "../lib/base";
import { loadCams, type Cams } from "../viz/cams";
import { reduced } from "../ui/dom";

type View = [number, number, number];
interface Look { view: "us" | "atl"; hi: number; choro: number; roads: number; dots: number }
export const LOOKS: Record<string, Look> = {
  all: { view: "us", hi: 0, choro: 0, roads: 0, dots: 1 },
  flock: { view: "us", hi: 1, choro: 0, roads: 0, dots: 1 },
  atlanta: { view: "atl", hi: 1, choro: 0, roads: 1, dots: 1 },
  rate: { view: "us", hi: 1, choro: 1, roads: 0, dots: 0 },
};
/** Flock cameras per 100,000 residents: upper bounds of the classes, and their colours (checked as an ordered ramp). */
export const RATE_BREAKS = [10, 25, 50, 100, Infinity];
export const RATE_COLORS = ["#dcab55", "#c4851a", "#9e6510", "#6f4508", "#3f2504"];
const NONE = "#ecece9";
interface Labels { cities: { name: string; xy: [number, number] }[]; atlanta: { bbox: [number, number, number, number]; places: { name: string; kind: string; xy: [number, number] }[]; roads: { name: string; xy: [number, number] }[] } }

const INK = [18, 18, 18], AMBER = [196, 125, 14], GREY = [189, 189, 186];
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * t)).join(",")})`;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function pathOf(geoms: GeoJSON.Geometry[], close: boolean): Path2D {
  const p = new Path2D();
  const ring = (r: number[][]) => { r.forEach(([x, y], i) => (i ? p.lineTo(x!, y!) : p.moveTo(x!, y!))); if (close) p.closePath(); };
  for (const g of geoms) {
    if (!g) continue;
    if (g.type === "Polygon") g.coordinates.forEach(ring);
    else if (g.type === "MultiPolygon") g.coordinates.forEach((poly) => poly.forEach(ring));
    else if (g.type === "LineString") ring(g.coordinates);
    else if (g.type === "MultiLineString") g.coordinates.forEach(ring);
  }
  return p;
}

export interface StoryMap { go(step: string): void; ready: Promise<void> }

export function createMap(fig: HTMLElement, hooks: { busy(d: number): void; tween(d: number): void }): StoryMap {
  const canvas = fig.querySelector<HTMLCanvasElement>(".map-canvas")!;
  const labelsEl = fig.querySelector<HTMLElement>(".map-labels")!;
  const legend = fig.querySelector<HTMLElement>(".map-legend")!;
  const poster = fig.querySelector<HTMLElement>(".map-poster");
  const ctx = canvas.getContext("2d")!;
  let cams: Cams | null = null, idxF: Uint32Array, idxO: Uint32Array;
  let states: Path2D | null = null, nation: Path2D | null = null;
  let roads: { c: number; p: Path2D }[] | null = null, choro: Path2D[] | null = null, labels: Labels | null = null;
  let W = 0, H = 0, dpr = 1;
  // what is on screen now, and what the current step wants
  const s = { cx: 500, cy: 310, w: 1000, hi: 0, choro: 0, roads: 0, dots: 1 };
  let want = "all", anim = 0;

  const json = (f: string) => fetch(`${BASE}data/story/${f}`).then((r) => r.json());
  const area = () => {
    const phone = matchMedia("(max-width: 760px)").matches;
    if (phone) return { x0: 10, y0: 46, x1: W - 10, y1: Math.max(H * 0.58, 260) };
    const gutter = 20, left = Math.max(gutter, (W - 992) / 2) + Math.min(352, W - 2 * gutter) + 28;
    return { x0: Math.min(left, W * 0.42), y0: 64, x1: W - 28, y1: H - 28 };
  };
  const viewFor = (look: Look): View => {
    const a = area(), aw = a.x1 - a.x0, ah = a.y1 - a.y0;
    if (look.view === "atl" && labels) { const [x0, y0, x1, y1] = labels.atlanta.bbox; const bw = x1 - x0, bh = y1 - y0; return [(x0 + x1) / 2, (y0 + y1) / 2, Math.max(bw, bh * aw / ah) * 1.02]; }
    return [500, 310, Math.max(1000, 620 * aw / ah) * 1.01];
  };
  const toScreen = (x: number, y: number): [number, number] => { const a = area(), k = (a.x1 - a.x0) / s.w; return [(a.x0 + a.x1) / 2 + (x - s.cx) * k, (a.y0 + a.y1) / 2 + (y - s.cy) * k]; };

  function resize(): void {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const v = viewFor(LOOKS[want]!); if (!anim) { s.cx = v[0]; s.cy = v[1]; s.w = v[2]; }
    // the legend sits above the map's top-left corner
    const a = area();
    legend.style.left = `${Math.round(a.x0)}px`; legend.style.top = `${Math.round(a.y0 - (matchMedia("(max-width: 760px)").matches ? 40 : 46))}px`;
    draw();
  }

  function draw(): void {
    if (!cams || !states) return;
    const a = area(), k = (a.x1 - a.x0) / s.w;
    const ox = (a.x0 + a.x1) / 2 - s.cx * k, oy = (a.y0 + a.y1) / 2 - s.cy * k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    // counties by rate
    const ch = choro;
    if (ch && s.choro > 0.01) {
      ctx.globalAlpha = s.choro;
      ctx.fillStyle = NONE; ctx.fill(ch[0]!);
      RATE_COLORS.forEach((c, i) => { ctx.fillStyle = c; ctx.fill(ch[i + 1]!); });
      ctx.globalAlpha = 1;
    }
    // state lines and the coast
    ctx.lineJoin = "round";
    ctx.strokeStyle = s.choro > 0.5 ? "#ffffff" : "#d4d4d1"; ctx.lineWidth = (s.choro > 0.5 ? 0.9 : 0.75) / k; ctx.stroke(states);
    if (nation) { ctx.strokeStyle = "#b9b9b6"; ctx.lineWidth = 0.8 / k; ctx.stroke(nation); }
    // roads around Atlanta
    if (roads && s.roads > 0.01) {
      ctx.globalAlpha = s.roads;
      for (const r of roads) {
        if (r.c === 3) { ctx.setLineDash([]); ctx.strokeStyle = "#121212"; ctx.lineWidth = 1.6 / k; ctx.stroke(r.p); continue; }
        ctx.strokeStyle = r.c === 1 ? "#7d7d7a" : r.c === 2 ? "#c2c2bf" : "#d6d6d3"; ctx.lineWidth = (r.c === 1 ? 2.2 : r.c === 2 ? 1.1 : 1) / k; ctx.stroke(r.p);
      }
      ctx.globalAlpha = 1;
    }
    // dots
    if (s.dots > 0.01) {
      const zoom = 1000 / s.w;
      const px = Math.min(4, 1.45 + Math.max(0, Math.log2(zoom)) * 0.42), d = px / k, h = d / 2;
      const vx0 = (a.x0 - 20 - ox) / k, vx1 = (a.x1 + 20 - ox) / k, vy0 = (a.y0 - 20 - oy) / k, vy1 = (a.y1 + 20 - oy) / k;
      const cull = s.w < 900;
      const { x, y } = cams;
      ctx.globalAlpha = s.dots * (zoom > 4 ? 0.9 : 0.62);
      // squares while the whole country is in view (fast, and too small to tell apart); circles once zoomed in
      const round = px >= 2.6;
      const layer = (idx: Uint32Array, color: string) => {
        ctx.fillStyle = color;
        if (round) ctx.beginPath();
        for (let j = 0; j < idx.length; j++) {
          const i = idx[j]!, qx = x[i]!, qy = y[i]!;
          if (cull && (qx < vx0 || qx > vx1 || qy < vy0 || qy > vy1)) continue;
          if (round) { ctx.moveTo(qx + h, qy); ctx.arc(qx, qy, h, 0, 6.2832); } else ctx.fillRect(qx - h, qy - h, d, d);
        }
        if (round) ctx.fill();
      };
      layer(idxO, mix(INK, GREY, s.hi));
      layer(idxF, mix(INK, AMBER, s.hi));
      ctx.globalAlpha = 1;
    }
    placeLabels();
  }

  // ---- labels and legend (HTML over the canvas) ----
  let labelEls: { el: HTMLElement; xy: [number, number]; group: "cities" | "atl" }[] = [];
  function buildLabels(): void {
    if (!labels) return;
    const mk = (text: string, cls: string, xy: [number, number], group: "cities" | "atl") => { const el = document.createElement("span"); el.className = `mlabel ${cls}`; el.textContent = text; labelsEl.appendChild(el); labelEls.push({ el, xy, group }); };
    for (const c of labels.cities) mk(c.name, "small", c.xy, "cities");
    for (const p of labels.atlanta.places) mk(p.name, p.kind === "city" ? "city" : "area", p.xy, "atl");
    for (const r of labels.atlanta.roads) mk(r.name, "road", r.xy, "atl");
  }
  function placeLabels(): void {
    const atl = Math.max(0, Math.min(1, (700 - s.w) / 600)); // fades in as the view closes on Atlanta
    for (const l of labelEls) {
      const [x, y] = toScreen(l.xy[0], l.xy[1]);
      const o = l.group === "atl" ? atl * s.roads : (1 - atl) * (1 - s.choro * 0.4);
      l.el.style.left = `${x}px`; l.el.style.top = `${y}px`;
      l.el.style.opacity = String(o);
      l.el.style.visibility = o < 0.02 || x < 0 || x > W || y < 0 || y > H ? "hidden" : "visible";
    }
  }
  function setLegend(look: Look): void {
    if (look.choro) {
      const names = ["None", "Under 10", "10–25", "25–50", "50–100", "100+"].map((n, i) => (i === 1 && matchMedia("(max-width: 760px)").matches ? "<10" : n));
      legend.innerHTML = `<div class="legend-ramp"><span>Mapped Flock cameras per 100,000 residents</span><div class="ramp">${[NONE, ...RATE_COLORS].map((c, i) => `<span><i style="background:${c}"></i>${names[i]}</span>`).join("")}</div></div>`;
    } else if (look.hi) {
      legend.innerHTML = `<div class="legend-key"><span><i style="background:rgb(${AMBER})"></i>Flock Safety</span><span><i style="background:rgb(${GREY})"></i>Other makes</span></div>`;
    } else legend.innerHTML = `<div class="legend-key"><span><i style="background:rgb(${INK})"></i>One mapped plate reader</span></div>`;
  }

  // ---- data ----
  async function loadBase(): Promise<void> {
    hooks.busy(1);
    try {
      const [c, st, lb] = await Promise.all([loadCams(`${BASE}data/story/cams.bin`), json("states.topo.json"), json("labels.json")]);
      cams = c; labels = lb;
      const f: number[] = [], o: number[] = [];
      for (let i = 0; i < c.n; i++) (c.cls[i] === 0 ? f : o).push(i);
      idxF = Uint32Array.from(f); idxO = Uint32Array.from(o);
      const topo = st as Topology;
      const obj = topo.objects.states as GeometryCollection;
      states = pathOf([mesh(topo, obj, (a, b) => a !== b)], false);
      nation = pathOf([mesh(topo, obj, (a, b) => a === b)], false);
      buildLabels();
      canvas.hidden = false;
      if (poster) poster.hidden = true;
      fig.querySelector<HTMLElement>(".map-fallback")?.setAttribute("hidden", "");
      resize();
    } finally { hooks.busy(-1); }
  }
  let roadsP: Promise<void> | null = null, choroP: Promise<void> | null = null;
  const loadRoads = () => (roadsP ??= (async () => {
    hooks.busy(1);
    try {
      const t = (await json("atlanta.topo.json")) as Topology;
      // mapshaper splits mixed geometry into one object per type (atlanta1, atlanta2): read them all
      const feats = Object.values(t.objects).flatMap((o) => (feature(t, o as GeometryCollection) as unknown as GeoJSON.FeatureCollection).features);
      roads = [0, 2, 1, 3].map((c) => ({ c, p: pathOf(feats.filter((f) => (f.properties as { c: number }).c === c).map((f) => f.geometry), c === 3) }));
      draw();
    } finally { hooks.busy(-1); }
  })());
  const loadChoro = () => (choroP ??= (async () => {
    hooks.busy(1);
    try {
      const [t, rows] = await Promise.all([json("counties.topo.json") as Promise<Topology>, json("counties.json") as Promise<[string, string, string, number, number, number | null, number | null][]>]);
      const rate = new Map(rows.map((r) => [r[0], r[3] === 0 ? -1 : r[6] ?? -1]));
      const fc = feature(t, t.objects.counties as GeometryCollection) as unknown as GeoJSON.FeatureCollection;
      const groups: GeoJSON.Geometry[][] = [[], [], [], [], [], []];
      for (const f of fc.features) {
        const v = rate.get(String((f.properties as { GEOID: string }).GEOID)) ?? -1;
        const cls = v < 0 ? 0 : 1 + RATE_BREAKS.findIndex((b) => v <= b);
        groups[cls]!.push(f.geometry);
      }
      choro = groups.map((g) => pathOf(g, true));
      draw();
    } finally { hooks.busy(-1); }
  })());

  // ---- steps ----
  function go(step: string): void {
    const look = LOOKS[step] ?? LOOKS.all!;
    want = step;
    if (look.roads || step === "flock") void loadRoads();
    if (look.choro || step === "atlanta") void loadChoro();
    setLegend(look);
    const to = viewFor(look);
    const from: View = [s.cx, s.cy, s.w];
    const start = { hi: s.hi, choro: s.choro, roads: s.roads, dots: s.dots };
    cancelAnimationFrame(anim);
    const finish = () => { s.cx = to[0]; s.cy = to[1]; s.w = to[2]; Object.assign(s, { hi: look.hi, choro: look.choro, roads: look.roads, dots: look.dots }); draw(); };
    if (reduced() || !cams) { if (anim) { anim = 0; hooks.tween(-1); } finish(); return; }
    const zi = interpolateZoom(from, to);
    const moves = Math.abs(from[2] - to[2]) > 1 || Math.hypot(from[0] - to[0], from[1] - to[1]) > 1;
    const dur = moves ? Math.min(2400, Math.max(900, zi.duration * 0.75)) : 650;
    const t0 = performance.now();
    if (!anim) hooks.tween(1);
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur), e = ease(t);
      if (moves) { const v = zi(e); s.cx = v[0]; s.cy = v[1]; s.w = v[2]; }
      // colour and layers follow the zoom; the shading arrives in the second half
      s.hi = start.hi + (look.hi - start.hi) * e;
      s.roads = start.roads + (look.roads - start.roads) * Math.max(0, (e - 0.5) * 2);
      s.choro = start.choro + (look.choro - start.choro) * Math.max(0, Math.min(1, (e - 0.35) / 0.65));
      s.dots = start.dots + (look.dots - start.dots) * Math.max(0, Math.min(1, (e - 0.35) / 0.65));
      draw();
      if (t < 1) anim = requestAnimationFrame(frame); else { anim = 0; finish(); hooks.tween(-1); }
    };
    anim = requestAnimationFrame(frame);
  }

  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = window.setTimeout(resize, 120); });
  setLegend(LOOKS.all!);
  const ready = loadBase();
  return { go, ready };
}
