/** What one read records: a car seen from behind, with numbered markers keyed to the fields the camera produces. */
import { escape } from "../../lib/escape.ts";
import { circle, g, path, rect, svg, text } from "../../viz/svg.ts";
import { frame, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";

interface Field { n: number; x: number; y: number; label: string; detail?: string }
const GROUPS: { name: string; fields: Field[] }[] = [
  { name: "Plate", fields: [{ n: 1, x: 206, y: 137, label: "Characters and state", detail: "and whether the plate is missing or covered" }] },
  { name: "Vehicle", fields: [
    { n: 2, x: 184, y: 106, label: "Make" },
    { n: 3, x: 48, y: 72, label: "Body type" },
    { n: 4, x: 248, y: 124, label: "Color" },
  ] },
  { name: "Add-ons", fields: [
    { n: 5, x: 112, y: 20, label: "Roof rack" },
    { n: 6, x: 128, y: 173, label: "Bumper stickers" },
    { n: 7, x: 240, y: 70, label: "Decals" },
    { n: 8, x: 214, y: 209, label: "Trailer hitch or rear rack" },
    { n: 9, x: 98, y: 212, label: "Aftermarket wheels" },
  ] },
  { name: "Marks", fields: [{ n: 10, x: 278, y: 160, label: "Dents" }] },
];

function car(): string {
  const body = "#e6e6e3", edge = "#8f8f8f", glass = "#c9cdd0", dark = "#3a3a3a";
  let s = "";
  // tires below the body
  s += rect(42, 178, 40, 48, { rx: 7, fill: dark }) + rect(238, 178, 40, 48, { rx: 7, fill: dark });
  s += rect(50, 200, 24, 18, { rx: 4, fill: "none", stroke: "#9a9a9a", "stroke-width": 2 }) + rect(246, 200, 24, 18, { rx: 4, fill: "none", stroke: "#9a9a9a", "stroke-width": 2 });
  // roof rack
  s += rect(74, 31, 172, 4, { rx: 2, fill: dark }) + rect(84, 35, 5, 6, { fill: dark }) + rect(231, 35, 5, 6, { fill: dark });
  // body and tailgate
  s += path("M30 190 L30 122 Q30 102 42 94 L62 50 Q66 41 77 41 L243 41 Q254 41 258 50 L278 94 Q290 102 290 122 L290 190 Z", { fill: body, stroke: edge, "stroke-width": 1.5 });
  // rear window
  s += path("M76 52 L244 52 Q250 52 252 57 L266 90 L54 90 L68 57 Q70 52 76 52 Z", { fill: glass, stroke: edge, "stroke-width": 1 });
  // decal on the window: a small round sticker
  s += circle(222, 76, 6, { fill: "#fff", stroke: edge }) + path("M218.5 77 L221 79.5 L226 73.5", { fill: "none", stroke: edge, "stroke-width": 1.4 });
  // tail lights
  s += rect(36, 102, 22, 30, { rx: 4, fill: "#b9b9b9", stroke: edge }) + rect(262, 102, 22, 30, { rx: 4, fill: "#b9b9b9", stroke: edge });
  // emblem
  s += `<ellipse cx="160" cy="110" rx="11" ry="5" fill="#fff" stroke="${edge}"/>`;
  // plate
  s += rect(124, 122, 72, 30, { rx: 3, fill: "#fff", stroke: "#121212", "stroke-width": 1.5 });
  s += text(160, 131, "STATE", { "text-anchor": "middle", "font-size": 6.5, "font-weight": 700, "letter-spacing": 1, fill: "#555" });
  s += text(160, 146, "ABC 1234", { "text-anchor": "middle", "font-size": 13, "font-weight": 700, "letter-spacing": 1, fill: "#121212", "font-family": "var(--mono)" });
  // bumper with stickers and a dent
  s += rect(26, 160, 268, 30, { rx: 8, fill: "#d4d4d0", stroke: edge, "stroke-width": 1.5 });
  s += rect(62, 167, 30, 12, { rx: 1.5, fill: "#fff", stroke: edge }) + rect(96, 167, 18, 12, { rx: 1.5, fill: "#fff", stroke: edge });
  s += path("M255 170 L262 174 L258 177 L268 182 L263 184", { fill: "none", stroke: "#555", "stroke-width": 1.4, "stroke-linecap": "round", "stroke-linejoin": "round" });
  // a rack on the hitch: the bar, a cross arm and two cradles
  s += rect(155, 190, 10, 14, { fill: dark }) + rect(116, 203, 88, 5, { rx: 2, fill: dark });
  s += rect(124, 194, 4, 10, { fill: dark }) + rect(192, 194, 4, 10, { fill: dark });
  return s;
}

export function readFigure(cfg: FigureCfg, ctx: Ctx): string {
  const markers = GROUPS.flatMap((gr) => gr.fields).map((f) => g(circle(f.x, f.y, 9.5, { fill: "var(--ink)", stroke: "#fff", "stroke-width": 2 }) + text(f.x, f.y + 4, String(f.n), { "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "#fff" }), { class: "read-mk", "data-n": f.n }));
  const drawing = svg(320, 236, car() + markers.join(""), { cls: "read-car", label: "Illustration of a car seen from behind, with numbered markers on the plate, the emblem, the body, the roof rack, bumper stickers, a window decal, a rack on the trailer hitch, the wheels and a dent in the bumper." });
  const list = GROUPS.map((gr) => `<li class="read-grp"><span class="read-gname">${escape(gr.name)}</span><ol>${gr.fields.map((f) => `<li data-n="${f.n}"><span class="read-n" aria-hidden="true">${f.n}</span><span><b>${escape(f.label)}</b>${f.detail ? ` ${escape(f.detail)}` : ""}</span></li>`).join("")}</ol></li>`).join("");
  const meta = `<div class="read-meta"><span class="read-meta-k">The camera adds</span><span>Time</span><span>GPS position</span><span>Camera ID</span></div>`;
  return frame("read", cfg, ctx, `<div class="read">${drawing}<ul class="read-list">${list}</ul></div>${meta}`);
}
