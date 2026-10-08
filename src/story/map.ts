/**
 * The opening map. Every mapped plate reader is a dot on a canvas, pre-projected (Albers USA, 1000 x 620 frame) in
 * cams.bin. Five looks, one per step: all readers; Flock's highlighted; counties shaded by Flock cameras per 100,000
 * residents (each county in its class's exact colour, those with fewer than 10,000 residents hatched, since their
 * rates rest on few people); Georgia; and Fulton County with Atlanta's interstates. Each step declares its whole look,
 * so scrolling either way, or jumping, lands on the right picture. Under reduced motion the looks change without
 * animation. The picture is clipped to its panel, so it never runs under the text. On phones the legend sits above
 * the map and the credit below it, so neither covers it.
 */
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { interpolateZoom } from "d3-interpolate";
import { BASE } from "../lib/base";
import { loadCams, type Cams } from "../viz/cams";
import { reduced } from "../ui/dom";

type View = [number, number, number];
type ViewId = "us" | "ga" | "atl";
/** `rates`: the step shows rates per resident, so the credit names the population source */
interface Look { view: ViewId; hi: number; choro: number; roads: number; dots: number; ga: number; rates: boolean }
export const LOOKS: Record<string, Look> = {
  all: { view: "us", hi: 0, choro: 0, roads: 0, dots: 1, ga: 0, rates: false },
  flock: { view: "us", hi: 1, choro: 0, roads: 0, dots: 1, ga: 0, rates: false },
  rate: { view: "us", hi: 1, choro: 1, roads: 0, dots: 0, ga: 0, rates: true },
  georgia: { view: "ga", hi: 1, choro: 1, roads: 0, dots: 0, ga: 1, rates: true },
  fulton: { view: "atl", hi: 1, choro: 0, roads: 1, dots: 1, ga: 0, rates: true },
};
/** Flock cameras per 100,000 residents: upper bounds of the classes, and their colours (checked as an ordered ramp). */
export const RATE_BREAKS = [10, 25, 50, 100, Infinity];
export const RATE_COLORS = ["#dcab55", "#c4851a", "#9e6510", "#6f4508", "#3f2504"];
/** Counties with fewer residents than this are hatched. */
export const SMALL_POP = 10_000;
const NONE = "#ecece9";
/** Reserved at the top of the phone graphic for the legend on the zoomed steps, so it never sits on the map */
const PHONE_LEGEND = 96;
/** On phones the map ends this far up the screen (a share of its height), above where the step cards are read */
const PHONE_MAP_BOTTOM = 0.6;
interface Place { name: string; kind: string; xy: [number, number]; sub?: string }
interface Labels { cities: { name: string; xy: [number, number] }[]; atlanta: { bbox: [number, number, number, number]; places: Place[]; roads: { name: string; xy: [number, number] }[] }; georgia: { bbox: [number, number, number, number]; xy: [number, number]; name: string; sub: string } }

const INK = [18, 18, 18], AMBER = [196, 125, 14], GREY = [189, 189, 186], GREY_TOP = [128, 128, 125], GREY_STREET = [74, 74, 72];
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** The grey of the same lightness (Rec. 601 luma) */
const grayOf = (hex: string) => { const [r, g, b] = rgbOf(hex); const v = Math.round(0.299 * r! + 0.587 * g! + 0.114 * b!).toString(16).padStart(2, "0"); return `#${v}${v}${v}`; };
const mixHex = (a: string, b: string, t: number) => mix(rgbOf(a), rgbOf(b), t);
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * t)).join(",")})`;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

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
/** Bounding box of a geometry's points, in the frame's units */
function bboxOf(geoms: (GeoJSON.Geometry | null | undefined)[]): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (c: unknown): void => { if (Array.isArray(c) && typeof c[0] === "number") { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1] as number); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1] as number); } else if (Array.isArray(c)) c.forEach(add); };
  for (const g of geoms) if (g && "coordinates" in g) add(g.coordinates);
  return b;
}
/** White diagonal lines on a transparent tile, one pattern cell in device pixels */
function hatchTile(dpr: number): HTMLCanvasElement {
  const t = Math.round(5 * dpr), c = document.createElement("canvas");
  c.width = c.height = t;
  const g = c.getContext("2d")!;
  g.strokeStyle = "rgba(255, 255, 255, 0.95)"; g.lineWidth = 1.3 * dpr;
  g.beginPath();
  for (const o of [-t, 0, t]) { g.moveTo(o, t); g.lineTo(o + t, 0); }
  g.stroke();
  return c;
}

export interface StoryMap { go(step: string): void; settle(): void; ready: Promise<void> }

export function createMap(fig: HTMLElement, hooks: { busy(d: number): void; tween(d: number): void }): StoryMap {
  const canvas = fig.querySelector<HTMLCanvasElement>(".map-canvas")!;
  const labelsEl = fig.querySelector<HTMLElement>(".map-labels")!;
  const legend = fig.querySelector<HTMLElement>(".map-legend")!;
  const credit = fig.parentElement?.querySelector<HTMLElement>(".map-credit") ?? null;
  const ctx = canvas.getContext("2d")!;
  let cams: Cams | null = null, idxF = new Uint32Array(0), idxO = new Uint32Array(0);
  let states: Path2D | null = null, nation: Path2D | null = null, georgia: Path2D | null = null, gaVeil: Path2D | null = null;
  let roads: { c: number; p: Path2D }[] | null = null, labels: Labels | null = null;
  /** Alaska and Hawaii's insets, faded out once the view leaves the whole country */
  let insets: [number, number, number, number][] = [];
  /** county shading: one path per rate class; the small-population counties; county lines for the zoomed views */
  let choro: { color: string; gray: string; p: Path2D }[] | null = null, small: Path2D | null = null, countyLines: Path2D | null = null;
  let hatch: CanvasPattern | null = null, hatchDpr = 0;
  /** the top of Fulton County's outline, where its label's leader points */
  let fultonTip: [number, number] | null = null;
  let W = 0, H = 0, dpr = 1;
  const s = { cx: 500, cy: 310, w: 1000, hi: 0, choro: 0, roads: 0, dots: 1, ga: 0 };
  let want = "all", anim = 0, finishing: (() => void) | null = null;
  const phone = () => matchMedia("(max-width: 760px)").matches;
  // ?poster: the national map alone, filling the frame (scripts/story/poster.mjs captures it)
  const posterMode = new URLSearchParams(location.search).has("poster");

  const json = (f: string) => fetch(`${BASE}data/story/${f}`).then((r) => r.json());
  let creditH = 0;
  const area = () => {
    if (posterMode) return { x0: 24, y0: 24, x1: W - 24, y1: H - 24 };
    // on phones the map sits between the legend and the cards' reading zone, so a card being read covers none of it
    if (phone()) return { x0: 8, y0: PHONE_LEGEND, x1: W - 8, y1: Math.max(PHONE_LEGEND + 220, H - (1 - PHONE_MAP_BOTTOM) * innerHeight) };
    const gutter = 20, left = Math.max(gutter, (W - 992) / 2) + Math.min(352, W - 2 * gutter) + 28;
    return { x0: Math.min(left, W * 0.42), y0: 76, x1: W - 24, y1: H - Math.max(24, creditH + 14) };
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
    for (const l of labelEls) l.w = undefined;
    if (credit) {
      // desktop: along the bottom of the map panel, clear of the page's Top button; phones: across the bottom
      if (phone() || posterMode) { credit.style.left = credit.style.maxWidth = ""; }
      else { const a0 = area(); credit.style.left = `${Math.round(a0.x0)}px`; credit.style.maxWidth = `${Math.round(Math.min(620, a0.x1 - a0.x0 - 110))}px`; }
      creditH = posterMode ? 0 : credit.offsetHeight;
    }
    const v = viewFor(LOOKS[want]!.view); if (!anim) { s.cx = v[0]; s.cy = v[1]; s.w = v[2]; }
    setLegend(LOOKS[want]!);
    draw();
  }

  function draw(): void {
    if (!cams || !states) return;
    const a = area(), k = (a.x1 - a.x0) / s.w;
    const ox = (a.x0 + a.x1) / 2 - s.cx * k, oy = (a.y0 + a.y1) / 2 - s.cy * k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // clip to the map's panel, so nothing runs under the legend, the credit or the cards
    ctx.save();
    ctx.beginPath(); ctx.rect(dpr * (a.x0 - 1), dpr * (a.y0 - 1), dpr * (a.x1 - a.x0 + 2), dpr * (a.y1 - a.y0 + 2)); ctx.clip();
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    if (choro && s.choro > 0.01) {
      ctx.globalAlpha = s.choro;
      // zoomed on Georgia, the other states turn grey (same lightness), so only Georgia carries the colour key
      for (const c of choro) { ctx.fillStyle = s.ga > 0.01 ? mixHex(c.color, c.gray, s.ga) : c.color; ctx.fill(c.p); }
      if (georgia && s.ga > 0.01) { ctx.save(); ctx.clip(georgia); for (const c of choro) { ctx.fillStyle = c.color; ctx.fill(c.p); } ctx.restore(); }
      // zoomed in, thin white county lines keep neighbouring counties of one class apart
      const zoomed = clamp01((700 - s.w) / 400);
      if (countyLines && zoomed > 0) { ctx.globalAlpha = s.choro * zoomed; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.7 / k; ctx.stroke(countyLines); }
      // counties with few residents: hatched, in screen pixels, over their class colour
      if (small) {
        if (!hatch || hatchDpr !== dpr) { hatch = ctx.createPattern(hatchTile(dpr), "repeat"); hatchDpr = dpr; }
        if (hatch) {
          ctx.save(); ctx.clip(small); ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = s.choro; ctx.fillStyle = hatch; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.lineJoin = "round";
    ctx.strokeStyle = s.choro > 0.5 ? "#ffffff" : "#d4d4d1"; ctx.lineWidth = (s.choro > 0.5 ? 1.1 : 0.75) / k; ctx.stroke(states);
    if (nation) { ctx.strokeStyle = "#b9b9b6"; ctx.lineWidth = 0.8 / k; ctx.stroke(nation); }
    if (georgia && s.ga > 0.01) {
      // everything outside Georgia fades back, so the state reads as the subject
      if (gaVeil) { ctx.globalAlpha = 0.62 * s.ga; ctx.fillStyle = "#ffffff"; ctx.fill(gaVeil, "evenodd"); }
      ctx.globalAlpha = s.ga; ctx.strokeStyle = "#121212"; ctx.lineWidth = 1.8 / k; ctx.stroke(georgia); ctx.globalAlpha = 1;
    }
    if (roads && s.roads > 0.01) {
      ctx.globalAlpha = s.roads;
      // roads stay light, so the dots, not the streets, carry the picture
      for (const r of roads) {
        if (r.c === 3) { ctx.strokeStyle = "#121212"; ctx.lineWidth = 1.6 / k; ctx.stroke(r.p); continue; }
        ctx.strokeStyle = r.c === 1 ? "#b3b3b0" : r.c === 2 ? "#d3d3d0" : "#dcdcd9"; ctx.lineWidth = (r.c === 1 ? 2 : 1) / k; ctx.stroke(r.p);
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
      // once Flock's are highlighted, the other makes are drawn on top in a darker grey, so the one in five shows;
      // on the streets of Atlanta they darken further, apart from the light grey roads
      if (s.hi < 0.5) { layer(idxO, mix(INK, GREY, s.hi)); layer(idxF, mix(INK, AMBER, s.hi)); }
      else { layer(idxF, mix(INK, AMBER, s.hi)); if (!posterMode) layer(idxO, s.roads > 0.01 ? mix(GREY_TOP, GREY_STREET, s.roads) : mix(GREY, GREY_TOP, (s.hi - 0.5) * 2)); }
      // (the share card, drawn in poster mode at the Flock step, shows Flock's cameras alone)
      ctx.globalAlpha = 1;
    }
    // Alaska and Hawaii are insets in the national frame, not neighbours of Georgia: they fade as the view closes in
    const insetFade = clamp01((990 - s.w) / 240);
    if (insetFade > 0 && insets.length) {
      ctx.globalAlpha = insetFade; ctx.fillStyle = "#ffffff";
      for (const b of insets) ctx.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    placeLabels();
  }

  // ---- labels and legend (HTML over the canvas) ----
  type Group = "cities" | "atl" | "ga";
  const labelEls: { el: HTMLElement; xy: [number, number]; group: Group; callout?: boolean; w?: number }[] = [];
  const SVGNS = "http://www.w3.org/2000/svg";
  const leaderSvg = document.createElementNS(SVGNS, "svg");
  leaderSvg.setAttribute("class", "map-leaders");
  const leader = document.createElementNS(SVGNS, "path");
  leaderSvg.appendChild(leader);
  function buildLabels(): void {
    if (!labels) return;
    labelsEl.appendChild(leaderSvg);
    const mk = (text: string, cls: string, xy: [number, number], group: Group, sub?: string) => {
      const el = document.createElement("span"); el.className = `mlabel ${cls}`;
      el.textContent = text;
      if (sub) { const sm = document.createElement("small"); sm.textContent = sub; el.appendChild(sm); }
      labelsEl.appendChild(el); labelEls.push({ el, xy, group, callout: cls === "area callout" });
    };
    for (const c of labels.cities) mk(c.name, "small", c.xy, "cities");
    // the county's name and counts go in a box above it, with a leader into the county
    // Atlanta: a point at the city, the name to its left, clear of Fulton County's eastern line
    for (const p of labels.atlanta.places) mk(p.name, p.kind === "city" ? "city pt-left" : "area callout", p.xy, "atl", p.sub);
    for (const r of labels.atlanta.roads) mk(r.name, "road", r.xy, "atl");
    mk(labels.georgia.name, "state", labels.georgia.xy, "ga", labels.georgia.sub);
  }
  function placeLabels(): void {
    const atl = clamp01((60 - s.w) / 30); // fades in as the view closes on Atlanta
    const a = area();
    let lead = "";
    for (const l of labelEls) {
      let [x, y] = project(s, l.xy[0], l.xy[1]);
      // the national names leave in the first part of a zoom; Georgia's name arrives in the last
      const o = l.group === "atl" ? atl * s.roads : l.group === "ga" ? clamp01((s.ga - 0.6) / 0.4) : clamp01(1 - 2.5 * Math.max(atl, s.ga)) * (1 - s.choro * 0.35);
      if (l.callout && fultonTip) {
        // the box's bottom edge sits a little above the county's northern edge; the leader runs into the county
        const [tx, ty] = project(s, fultonTip[0], fultonTip[1]);
        x = tx; y = ty - (phone() ? 16 : 22);
        if (o > 0.02) lead = `M${x.toFixed(1)} ${y.toFixed(1)}V${(ty + (phone() ? 12 : 18)).toFixed(1)}`;
      }
      const hide = o < 0.02 || x < a.x0 - 10 || x > a.x1 + 10 || y < a.y0 - 40 || y > a.y1 + 20;
      // every label, shown or hidden, stays inside the map's width (widths measured once, again after a resize or
      // once the fonts load), so none reaches past the edge of the page
      l.w ??= l.el.offsetWidth;
      x = Math.max(l.w / 2 + 2, Math.min(W - l.w / 2 - 2, x));
      l.el.style.left = `${x}px`; l.el.style.top = `${y}px`;
      l.el.style.opacity = String(o);
      l.el.style.visibility = hide ? "hidden" : "visible";
    }
    leader.setAttribute("d", lead);
    leaderSvg.style.opacity = String(atl * s.roads);
  }
  function setLegend(look: Look): void {
    if (look.choro) {
      const names = ["None", "Under 10", "10–25", "25–50", "50–100", "100+"];
      legend.innerHTML = `<div class="legend-ramp"><span class="legend-t">Mapped Flock cameras per 100,000 residents</span><div class="ramp">${[NONE, ...RATE_COLORS].map((c, i) => `<span><i style="background:${c}"></i>${names[i]}</span>`).join("")}</div><span class="legend-hatch"><i></i>Hatched: fewer than ${SMALL_POP.toLocaleString("en-US")} residents, where a few cameras swing the rate</span></div>`;
    } else if (look.hi) {
      legend.innerHTML = `<div class="legend-key"><span><i style="background:rgb(${AMBER})"></i>Flock Safety</span><span><i style="background:rgb(${look.roads ? GREY_STREET : GREY_TOP})"></i>Other makes</span></div>`;
    } else legend.innerHTML = `<div class="legend-key"><span><i style="background:rgb(${INK})"></i>One mapped plate reader</span></div>`;
    // zoomed on Georgia on a wide screen, the legend stands upright in the corner beside the state
    legend.classList.toggle("is-vertical", look.view === "ga" && !phone());
    placeLegend();
  }
  /** Phones: above the map. Desktop: at the national map's top-left corner, or, zoomed on Georgia, at the panel's
   *  bottom left, over the faded Gulf and Alabama rather than the state's northern counties. */
  function placeLegend(): void {
    if (!W) return;
    const a = area();
    if (phone()) {
      legend.style.left = "";
      if (LOOKS[want]!.view !== "us") { legend.style.top = ""; return; }
      const us = viewFor("us"), [, ly] = project({ cx: us[0], cy: us[1], w: us[2] }, 0, 0);
      legend.style.top = `${Math.round(Math.max(6, ly - legend.offsetHeight - 4))}px`;
      return;
    }
    if (LOOKS[want]!.view === "ga") {
      legend.style.left = `${Math.round(a.x0)}px`;
      legend.style.top = `${Math.round(a.y1 - legend.offsetHeight - 8)}px`;
      return;
    }
    const us = viewFor("us"), [lx, ly] = project({ cx: us[0], cy: us[1], w: us[2] }, 0, 0);
    legend.style.left = `${Math.round(Math.max(a.x0, lx))}px`;
    legend.style.top = `${Math.round(Math.max(12, ly - 50))}px`;
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
      const byState = (fp: string) => fc.features.filter((x) => (x.properties as { STATEFP?: string }).STATEFP === fp).map((x) => x.geometry);
      const gaGeoms = byState("13");
      georgia = pathOf(gaGeoms, true);
      // the frame with Georgia cut out of it (filled even-odd)
      gaVeil = new Path2D(); gaVeil.rect(-2000, -2000, 5000, 5000); gaVeil.addPath(pathOf(gaGeoms, true));
      insets = ["02", "15"].map((fp) => { const b = bboxOf(byState(fp)); return [b[0] - 6, b[1] - 6, b[2] + 6, b[3] + 6] as [number, number, number, number]; }).filter((b) => Number.isFinite(b[0]));
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
      // the middle of Fulton County's northern edge
      const fb = bboxOf(feats.filter((f) => (f.properties as { c: number }).c === 3).map((f) => f.geometry));
      const top: number[][] = [];
      const walk = (cs: unknown): void => { if (Array.isArray(cs) && typeof cs[0] === "number") { if ((cs[1] as number) < fb[1] + 0.35) top.push(cs as number[]); } else if (Array.isArray(cs)) cs.forEach(walk); };
      for (const f of feats) if ((f.properties as { c: number }).c === 3 && f.geometry && "coordinates" in f.geometry) walk(f.geometry.coordinates);
      if (top.length) fultonTip = [top.reduce((a2, p) => a2 + p[0]!, 0) / top.length, fb[1]];
      draw();
    } finally { hooks.busy(-1); }
  })());
  const loadChoro = () => (choroP ??= (async () => {
    hooks.busy(1);
    try {
      const [t, rows] = await Promise.all([json("counties.topo.json") as Promise<Topology>, json("counties.json") as Promise<[string, string, string, number, number, number | null, number | null][]>]);
      const by = new Map(rows.map((r) => [r[0], r]));
      const obj = t.objects.counties as GeometryCollection;
      const fc = feature(t, obj) as unknown as GeoJSON.FeatureCollection;
      const groups = new Map<number, GeoJSON.Geometry[]>(), smallGeoms: GeoJSON.Geometry[] = [];
      for (const f of fc.features) {
        const r = by.get(String((f.properties as { GEOID: string }).GEOID));
        const v = !r || r[3] === 0 || r[6] == null ? -1 : r[6];
        const cls = v < 0 ? 0 : 1 + RATE_BREAKS.findIndex((b) => v <= b);
        groups.set(cls, [...(groups.get(cls) ?? []), f.geometry]);
        if ((r?.[5] ?? 0) < SMALL_POP) smallGeoms.push(f.geometry);
      }
      choro = [...groups.entries()].sort((a2, b) => a2[0] - b[0]).map(([cls, g]) => { const color = cls === 0 ? NONE : RATE_COLORS[cls - 1]!; return { color, gray: grayOf(color), p: pathOf(g, true) }; });
      small = pathOf(smallGeoms, true);
      countyLines = pathOf([mesh(t, obj, (a2, b) => a2 !== b)], false);
      draw();
    } finally { hooks.busy(-1); }
  })());

  // ---- steps ----
  function go(step: string): void {
    const look = LOOKS[step] ?? LOOKS.all!;
    want = step;
    if (step === "flock" || look.choro) void loadChoro();
    if (look.view !== "us" || look.roads) void loadRoads();
    // the legend and the credit's population line change when the new look takes over, halfway through
    let keyed = false;
    const key = () => { if (keyed) return; keyed = true; setLegend(look); credit?.classList.toggle("no-rates", !look.rates); };
    const to = viewFor(look.view), from: View = [s.cx, s.cy, s.w];
    const start = { hi: s.hi, choro: s.choro, roads: s.roads, dots: s.dots, ga: s.ga };
    cancelAnimationFrame(anim);
    const finish = () => { key(); s.cx = to[0]; s.cy = to[1]; s.w = to[2]; Object.assign(s, { hi: look.hi, choro: look.choro, roads: look.roads, dots: look.dots, ga: look.ga }); draw(); };
    if (reduced() || !cams) { if (anim) { anim = 0; finishing = null; hooks.tween(-1); } finish(); return; }
    const zi = interpolateZoom(from, to);
    const moves = Math.abs(from[2] - to[2]) > 1 || Math.hypot(from[0] - to[0], from[1] - to[1]) > 1;
    const dur = moves ? Math.min(2400, Math.max(900, zi.duration * 0.75)) : 650;
    const t0 = performance.now();
    if (!anim) hooks.tween(1);
    finishing = finish;
    const late = (e: number, from: number) => clamp01((e - from) / (1 - from));
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur), e = ease(t);
      if (moves) { const v = zi(e); s.cx = v[0]; s.cy = v[1]; s.w = v[2]; }
      // colour follows the zoom; layers that belong to the destination arrive in its second half
      s.hi = start.hi + (look.hi - start.hi) * e;
      s.roads = start.roads + (look.roads - start.roads) * (look.roads > start.roads ? late(e, 0.5) : e);
      s.choro = start.choro + (look.choro - start.choro) * (look.choro > start.choro ? late(e, 0.35) : e);
      s.dots = start.dots + (look.dots - start.dots) * (look.dots > start.dots ? late(e, 0.45) : e);
      s.ga = start.ga + (look.ga - start.ga) * e;
      if (e >= 0.5) key();
      draw();
      if (t < 1) anim = requestAnimationFrame(frame); else { anim = 0; finishing = null; finish(); hooks.tween(-1); }
    };
    anim = requestAnimationFrame(frame);
  }
  /** Jump to the end of a running transition: the map is leaving the screen, and must not leave mid-zoom. */
  function settle(): void {
    if (!anim) return;
    cancelAnimationFrame(anim); anim = 0;
    const f = finishing; finishing = null;
    f?.(); hooks.tween(-1);
  }

  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = window.setTimeout(resize, 120); });
  setLegend(LOOKS.all!);
  credit?.classList.add("no-rates");
  void document.fonts?.ready.then(() => { for (const l of labelEls) l.w = undefined; draw(); });
  const ready = loadBase();
  return { go, settle, ready };
}
