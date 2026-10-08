/** SVG as strings: the static charts are drawn at build time into the page, so they show without JavaScript. Every
 *  helper escapes its text. Marks follow the house specs: thin bars with a rounded data end, hairline grids, dots
 *  with a white ring, text never in a series colour. */
import { escape } from "../lib/escape.ts";

export type Attrs = Record<string, string | number | undefined | null | false>;
const attrs = (a: Attrs = {}): string => Object.entries(a).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => ` ${k}="${escape(String(v))}"`).join("");
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The outer element: a viewBox the chart was laid out in, scaled to the column; the label states the takeaway. */
export function svg(w: number, h: number, body: string, o: { label: string; cls?: string; desc?: string }): string {
  return `<svg class="viz${o.cls ? ` ${o.cls}` : ""}" viewBox="0 0 ${r2(w)} ${r2(h)}" width="${r2(w)}" height="${r2(h)}" role="img" aria-label="${escape(o.label)}" xmlns="http://www.w3.org/2000/svg">${o.desc ? `<desc>${escape(o.desc)}</desc>` : ""}${body}</svg>`;
}
export const g = (body: string, a: Attrs = {}) => `<g${attrs(a)}>${body}</g>`;
export const text = (x: number, y: number, s: string, a: Attrs = {}) => `<text x="${r2(x)}" y="${r2(y)}"${attrs(a)}>${escape(s)}</text>`;
/** Text with a white halo so it reads over marks and lines. */
export const label = (x: number, y: number, s: string, a: Attrs = {}) => text(x, y, s, { ...a, class: `halo${a.class ? ` ${a.class}` : ""}` });
export const line = (x1: number, y1: number, x2: number, y2: number, a: Attrs = {}) => `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}"${attrs(a)}/>`;
export const rect = (x: number, y: number, w: number, h: number, a: Attrs = {}) => `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(Math.max(0, w))}" height="${r2(Math.max(0, h))}"${attrs(a)}/>`;
export const circle = (cx: number, cy: number, r: number, a: Attrs = {}) => `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}"${attrs(a)}/>`;
export const path = (d: string, a: Attrs = {}) => `<path d="${d}"${attrs(a)}/>`;

/** A horizontal bar from x0 with a rounded data end (radius r) and a square base. */
export function hbar(x0: number, y: number, len: number, h: number, r = 4, a: Attrs = {}): string {
  const L = Math.max(0, len), rr = Math.min(r, h / 2, L);
  const d = `M${r2(x0)},${r2(y)}H${r2(x0 + L - rr)}A${rr},${rr} 0 0 1 ${r2(x0 + L)},${r2(y + rr)}V${r2(y + h - rr)}A${rr},${rr} 0 0 1 ${r2(x0 + L - rr)},${r2(y + h)}H${r2(x0)}Z`;
  return path(d, a);
}
/** A vertical column from baseline y0 upward with a rounded top. */
export function vbar(x: number, y0: number, w: number, len: number, r = 4, a: Attrs = {}): string {
  const L = Math.max(0, len), rr = Math.min(r, w / 2, L);
  const d = `M${r2(x)},${r2(y0)}V${r2(y0 - L + rr)}A${rr},${rr} 0 0 1 ${r2(x + rr)},${r2(y0 - L)}H${r2(x + w - rr)}A${rr},${rr} 0 0 1 ${r2(x + w)},${r2(y0 - L + rr)}V${r2(y0)}Z`;
  return path(d, a);
}
/** A dot with the 2px white ring that keeps it legible over lines and other dots. */
export const dot = (cx: number, cy: number, r: number, fill: string, a: Attrs = {}) => circle(cx, cy, r, { fill, stroke: "#fff", "stroke-width": 2, ...a });

/** An element the tooltip and keyboard can reach: the hit area is the group, so it can be larger than the mark. */
export const tip = (body: string, value: string, labelText: string, a: Attrs = {}) => g(body, { ...a, "data-tip": value, "data-tip-label": labelText, tabindex: 0, role: "img", "aria-label": `${labelText}: ${value}` });

/** Logarithmic scale for counts from 1 to `max` mapped onto [x0, x1]. */
export function logScale(min: number, max: number, x0: number, x1: number): (v: number) => number {
  const a = Math.log10(min), b = Math.log10(max);
  return (v: number) => x0 + (Math.log10(Math.max(v, min)) - a) / (b - a) * (x1 - x0);
}
export function linScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  return (v: number) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
}
/** Round tick values for a linear axis from 0 to max. */
export function niceTicks(max: number, count = 5): number[] {
  const raw = max / count, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
/** Approximate rendered width of a label in the chart sans, for placing labels without measuring the DOM. */
export function textWidth(s: string, size = 12, weight = 400): number {
  let w = 0;
  for (const ch of s) w += /[il.,:;'|!]/.test(ch) ? 0.28 : /[ftrjI( )\-]/.test(ch) ? 0.36 : /[mwMW]/.test(ch) ? 0.86 : /[A-Z0-9#%$]/.test(ch) ? 0.64 : 0.54;
  return w * size * (weight >= 600 ? 1.05 : 1);
}
