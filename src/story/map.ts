/**
 * The opening map. Every mapped plate reader is a dot on a canvas, pre-projected (Albers USA, 1000 x 620 frame) in
 * cams.bin. Five looks, one per step: all readers; Flock's highlighted; counties shaded by Flock cameras per 100,000
 * residents (thinly populated counties drawn lighter, so their area does not outweigh their people); Georgia; and
 * Fulton County with Atlanta's interstates. Each step declares its whole look, so scrolling either way, or jumping,
 * lands on the right picture. Under reduced motion the looks change without animation. The picture is clipped to
 * its panel, so it never runs under the text.
 */
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { interpolateZoom } from "d3-interpolate";
import { BASE } from "../lib/base";
import { loadCams, type Cams } from "../viz/cams";
import { reduced } from "../ui/dom";

type View = [number, number, number];
type ViewId = "us" | "ga" | "atl";
interface Look { view: ViewId; hi: number; choro: number; roads: number; dots: number; ga: number }
export const LOOKS: Record<string, Look> = {
  all: { view: "us", hi: 0, choro: 0, roads: 0, dots: 1, ga: 0 },
  flock: { view: "us", hi: 1, choro: 0, roads: 0, dots: 1, ga: 0 },
  rate: { view: "us", hi: 1, choro: 1, roads: 0, dots: 0, ga: 0 },
  georgia: { view: "ga", hi: 1, choro: 1, roads: 0, dots: 0, ga: 1 },
  fulton: { view: "atl", hi: 1, choro: 0, roads: 1, dots: 1, ga: 0 },
};
/** Flock cameras per 100,000 residents: upper bounds of the classes, and their colours (checked as an ordered ramp). */
export const RATE_BREAKS = [10, 25, 50, 100, Infinity];
export const RATE_COLORS = ["#dcab55", "#c4851a", "#9e6510", "#6f4508", "#3f2504"];
/** Opacity by county population: fewer residents, lighter, so a large empty county does not outweigh a city. */
const POP_TIERS: [number, number][] = [[10_000, 0.38], [50_000, 0.68], [Infinity, 1]];
const NONE = "#ecece9";
interface Place { name: string; kind: string; xy: [number, number]; sub?: string }
interface Labels { cities: { name: string; xy: [number, number] }[]; atlanta: { bbox: [number, number, number, number]; places: Place[]; roads: { name: string; xy: [number, number] }[] }; georgia: { bbox: [number, number, number, number]; xy: [number, number]; name: string; sub: string } }

const INK = [18, 18, 18], AMBER = [196, 125, 14], GREY = [189, 189, 186], GREY_TOP = [128, 128, 125];
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * t)).join(",")})`;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function pathOf(geoms: (GeoJSON.Geometry | null | undefined)[], close: boolean): Path2D {
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
  const credit = fig.parentElement?.querySelector<HTMLElement>(".map-credit") ?? null;
  const ctx = canvas.getContext("2d")!;
  let cams: Cams | null = null, idxF = new Uint32Array(0), idxO = new Uint32Array(0);
  let states: Path2D | null = null, nation: Path2D | null = null, georgia: Path2D | null = null, gaVeil: Path2D | null = null;
  let roads: { c: number; p: Path2D }[] | null = null, labels: Labels | null = null;
  /** county shading: one path per rate class and population tier, plus counties with none mapped */
  let choro: { color: string; alpha: number; p: Path2D }[] | null = null;
  let W = 0, H = 0, dpr = 1;
  const s = { cx: 500, cy: 310, w: 1000, hi: 0, choro: 0, roads: 0, dots: 1, ga: 0 };
  let want = "all", anim = 0;
  const phone = () => matchMedia("(max-width: 760px)").matches;
  // ?poster: the national map alone, filling the frame (scripts/story/poster.mjs captures it)
  const posterMode = new URLSearchParams(location.search).has("poster");

  const json = (f: string) => fetch(`${BASE}data/story/${f}`).then((r) => r.json());
  const area = () => {
    if (posterMode) return { x0: 24, y0: 24, x1: W - 24, y1: H - 24 };
    if (phone()) return { x0: 8, y0: 52, x1: W - 8, y1: Math.max(H * 0.6, 270) };
    const gutter = 20, left = Math.max(gutter, (W - 992) / 2) + Math.min(352, W - 2 * gutter) + 28;
    return { x0: Math.min(left, W * 0.42), y0: 76, x1: W - 24, y1: H - 24 };
  };
  const viewFor = (id: ViewId): View => {
    const a = area(), aw = a.x1 - a.x0, ah = a.y1 - a.y0;
    const fit = (b: [number, number, number, number], pad: number): View => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, Math.max(b[2] - b[0], (b[3] - b[1]) * aw / ah) * pad];
    if (id === "atl" && labels) return fit(labels.atlanta.bbox, 1.02);
    if (id === "ga" && labels) return fit(labels.georgia.bbox, 1.12);
    return [500, 310, Math.max(1000, 620 * aw / ah) * 1.01];
  };
  const project = (v: { cx: number; cy: number; w: number }, x: number, y: number): [number, number] => { const a = area(), k = (a.x1 - a.x0) / v.w; return [(a.x0 + a.x1) / 2 + (x - v.cx) * k, (a.y0 + a.y1) / 2 + (y - v.cy) * k]; };

  function resize(): void {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const v = viewFor(LOOKS[want]!.view); if (!anim) { s.cx = v[0]; s.cy = v[1]; s.w = v[2]; }
    // the legend sits on the national map's top-left corner, whatever the step
    const us = viewFor("us"), [lx, ly] = project({ cx: us[0], cy: us[1], w: us[2] }, 0, 0);
    legend.style.left = `${Math.round(Math.max(area().x0, lx))}px`;
    legend.style.top = `${Math.round(Math.max(phone() ? 6 : 12, ly - (phone() ? 46 : 50)))}px`;
    // the credit runs along the bottom of the map panel, clear of the page's Top button at the right
    if (credit) {
      const a = area();
      if (phone() || posterMode) { credit.style.left = credit.style.maxWidth = ""; }
      else { credit.style.left = `${Math.round(a.x0)}px`; credit.style.maxWidth = `${Math.round(Math.min(620, a.x1 - a.x0 - 110))}px`; }
    }
    draw();
  }

  function draw(): void {
    if (!cams || !states) return;
    const a = area(), k = (a.x1 - a.x0) / s.w;
    const ox = (a.x0 + a.x1) / 2 - s.cx * k, oy = (a.y0 + a.y1) / 2 - s.cy * k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // clip to the map's panel (a little wider on phones, where nothing sits beside it)
    ctx.save();
    ctx.beginPath(); ctx.rect(dpr * (a.x0 - (phone() ? 8 : 6)), dpr * (a.y0 - 30), dpr * (a.x1 - a.x0 + (phone() ? 16 : 30)), dpr * (a.y1 - a.y0 + 54)); ctx.clip();
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    if (choro && s.choro > 0.01) {
      for (const c of choro) { ctx.globalAlpha = s.choro * c.alpha; ctx.fillStyle = c.color; ctx.fill(c.p); }
      ctx.globalAlpha = 1;
    }
    ctx.lineJoin = "round";
    ctx.strokeStyle = s.choro > 0.5 ? "#ffffff" : "#d4d4d1"; ctx.lineWidth = (s.choro > 0.5 ? 0.9 : 0.75) / k; ctx.stroke(states);
    if (nation) { ctx.strokeStyle = "#b9b9b6"; ctx.lineWidth = 0.8 / k; ctx.stroke(nation); }
    if (georgia && s.ga > 0.01) {
      // everything outside Georgia fades back, so the state reads as the subject
      if (gaVeil) { ctx.globalAlpha = 0.62 * s.ga; ctx.fillStyle = "#ffffff"; ctx.fill(gaVeil, "evenodd"); }
      ctx.globalAlpha = s.ga; ctx.strokeStyle = "#121212"; ctx.lineWidth = 1.8 / k; ctx.stroke(georgia); ctx.globalAlpha = 1;
    }
    if (roads && s.roads > 0.01) {
      ctx.globalAlpha = s.roads;
      for (const r of roads) {
        if (r.c === 3) { ctx.strokeStyle = "#121212"; ctx.lineWidth = 1.6 / k; ctx.stroke(r.p); continue; }
        ctx.strokeStyle = r.c === 1 ? "#7d7d7a" : r.c === 2 ? "#c2c2bf" : "#d6d6d3"; ctx.lineWidth = (r.c === 1 ? 2.2 : r.c === 2 ? 1.1 : 1) / k; ctx.stroke(r.p);
      }
      ctx.globalAlpha = 1;
    }
    if (s.dots > 0.01) {
      const zoom = 1000 / s.w;
      const px = Math.min(4, 1.45 + Math.max(0, Math.log2(zoom)) * 0.42), d = px / k, h = d / 2;
      const vx0 = (a.x0 - 20 - ox) / k, vx1 = (a.x1 + 20 - ox) / k, vy0 = (a.y0 - 40 - oy) / k, vy1 = (a.y1 + 40 - oy) / k;
      const cull = s.w < 900, round = px >= 2.6, { x, y } = cams;
      ctx.globalAlpha = s.dots * (zoom > 4 ? 0.9 : 0.62);
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
      // once Flock's are highlighted, the other makes are drawn on top in a darker grey, so the one in five shows
      if (s.hi < 0.5) { layer(idxO, mix(INK, GREY, s.hi)); layer(idxF, mix(INK, AMBER, s.hi)); }
      else { layer(idxF, mix(INK, AMBER, s.hi)); if (!posterMode) layer(idxO, mix(GREY, GREY_TOP, (s.hi - 0.5) * 2)); }
      // (the share card, drawn in poster mode at the Flock step, shows Flock's cameras alone)
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    placeLabels();
  }

  // ---- labels and legend (HTML over the canvas) ----
  type Group = "cities" | "atl" | "ga";
  const labelEls: { el: HTMLElement; xy: [number, number]; group: Group }[] = [];
  function buildLabels(): void {
    if (!labels) return;
    const mk = (text: string, cls: string, xy: [number, number], group: Group, sub?: string) => {
      const el = document.createElement("span"); el.className = `mlabel ${cls}`;
      el.textContent = text;
      if (sub) { const sm = document.createElement("small"); sm.textContent = sub; el.appendChild(sm); }
      labelsEl.appendChild(el); labelEls.push({ el, xy, group });
    };
    for (const c of labels.cities) mk(c.name, "small", c.xy, "cities");
    for (const p of labels.atlanta.places) mk(p.name, p.kind === "city" ? "city" : "area", p.xy, "atl", p.sub);
    for (const r of labels.atlanta.roads) mk(r.name, "road", r.xy, "atl");
    mk(labels.georgia.name, "state", labels.georgia.xy, "ga", labels.georgia.sub);
  }
  function placeLabels(): void {
    const atl = Math.max(0, Math.min(1, (60 - s.w) / 30)); // fades in as the view closes on Atlanta
    const a = area();
    for (const l of labelEls) {
      const [x, y] = project(s, l.xy[0], l.xy[1]);
      const o = l.group === "atl" ? atl * s.roads : l.group === "ga" ? s.ga : (1 - Math.max(atl, s.ga)) * (1 - s.choro * 0.35);
      l.el.style.left = `${x}px`; l.el.style.top = `${y}px`;
      l.el.style.opacity = String(o);
      l.el.style.visibility = o < 0.02 || x < a.x0 - 10 || x > a.x1 + 10 || y < a.y0 - 30 || y > a.y1 + 20 ? "hidden" : "visible";
    }
  }
  function setLegend(look: Look): void {
    if (look.choro) {
      const names = ["None", phone() ? "<10" : "Under 10", "10–25", "25–50", "50–100", "100+"];
      legend.innerHTML = `<div class="legend-ramp"><span>Mapped Flock cameras per 100,000 residents</span><div class="ramp">${[NONE, ...RATE_COLORS].map((c, i) => `<span><i style="background:${c}"></i>${names[i]}</span>`).join("")}</div><span class="legend-note">Counties with fewer residents are drawn lighter.</span></div>`;
    } else if (look.hi) {
      legend.innerHTML = `<div class="legend-key"><span><i style="background:rgb(${AMBER})"></i>Flock Safety</span><span><i style="background:rgb(${GREY_TOP})"></i>Other makes</span></div>`;
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
      const topo = st as Topology, obj = topo.objects.states as GeometryCollection;
      states = pathOf([mesh(topo, obj, (a, b) => a !== b)], false);
      nation = pathOf([mesh(topo, obj, (a, b) => a === b)], false);
      const fc = feature(topo, obj) as unknown as GeoJSON.FeatureCollection;
      const gaGeoms = fc.features.filter((x) => (x.properties as { STATEFP?: string }).STATEFP === "13").map((x) => x.geometry);
      georgia = pathOf(gaGeoms, true);
      // the frame with Georgia cut out of it (filled even-odd)
      gaVeil = new Path2D(); gaVeil.rect(-2000, -2000, 5000, 5000); gaVeil.addPath(pathOf(gaGeoms, true));
      buildLabels();
      canvas.hidden = false;
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
      const by = new Map(rows.map((r) => [r[0], r]));
      const fc = feature(t, t.objects.counties as GeometryCollection) as unknown as GeoJSON.FeatureCollection;
      const groups = new Map<string, GeoJSON.Geometry[]>();
      for (const f of fc.features) {
        const r = by.get(String((f.properties as { GEOID: string }).GEOID));
        const v = !r || r[3] === 0 || r[6] == null ? -1 : r[6];
        const cls = v < 0 ? 0 : 1 + RATE_BREAKS.findIndex((b) => v <= b);
        const tier = POP_TIERS.findIndex(([max]) => (r?.[5] ?? 0) < max);
        const key = `${cls}:${cls === 0 ? 2 : tier}`;
        groups.set(key, [...(groups.get(key) ?? []), f.geometry]);
      }
      choro = [...groups.entries()].map(([key, g]) => { const [cls, tier] = key.split(":").map(Number); return { color: cls === 0 ? NONE : RATE_COLORS[cls! - 1]!, alpha: POP_TIERS[tier!]![1], p: pathOf(g, true) }; });
      draw();
    } finally { hooks.busy(-1); }
  })());

  // ---- steps ----
  function go(step: string): void {
    const look = LOOKS[step] ?? LOOKS.all!;
    want = step;
    if (step === "flock" || look.choro) void loadChoro();
    if (look.view !== "us" || look.roads) void loadRoads();
    setLegend(look);
    const to = viewFor(look.view), from: View = [s.cx, s.cy, s.w];
    const start = { hi: s.hi, choro: s.choro, roads: s.roads, dots: s.dots, ga: s.ga };
    cancelAnimationFrame(anim);
    const finish = () => { s.cx = to[0]; s.cy = to[1]; s.w = to[2]; Object.assign(s, { hi: look.hi, choro: look.choro, roads: look.roads, dots: look.dots, ga: look.ga }); draw(); };
    if (reduced() || !cams) { if (anim) { anim = 0; hooks.tween(-1); } finish(); return; }
    const zi = interpolateZoom(from, to);
    const moves = Math.abs(from[2] - to[2]) > 1 || Math.hypot(from[0] - to[0], from[1] - to[1]) > 1;
    const dur = moves ? Math.min(2400, Math.max(900, zi.duration * 0.75)) : 650;
    const t0 = performance.now();
    if (!anim) hooks.tween(1);
    const late = (e: number, from: number) => Math.max(0, Math.min(1, (e - from) / (1 - from)));
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur), e = ease(t);
      if (moves) { const v = zi(e); s.cx = v[0]; s.cy = v[1]; s.w = v[2]; }
      // colour follows the zoom; layers that belong to the destination arrive in its second half
      s.hi = start.hi + (look.hi - start.hi) * e;
      s.roads = start.roads + (look.roads - start.roads) * (look.roads > start.roads ? late(e, 0.5) : e);
      s.choro = start.choro + (look.choro - start.choro) * (look.choro > start.choro ? late(e, 0.35) : e);
      s.dots = start.dots + (look.dots - start.dots) * (look.dots > start.dots ? late(e, 0.45) : e);
      s.ga = start.ga + (look.ga - start.ga) * e;
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
