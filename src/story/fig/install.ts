/**
 * Diagrams for the Components page, drawn from install.json so a corrected measurement changes the drawing: the three
 * ways a Falcon is mounted, as elevations on one height scale; the three ways it is powered and connected, as flows;
 * and what it sees, as a plan of its field of view. Pure string renderers on the house SVG helpers.
 */
import { g, line, rect, circle, path, svg, text, label, textWidth, WIDE, NARROW } from "../../viz/svg.ts";

export interface Pole { heightFt: number; cameraHeightFt: number }
export interface Coverage { widthFt: number; distFt: number; maxFt: number; lanes: number }

const INK = "var(--ink)", INK2 = "var(--ink-2)", INK3 = "var(--ink-3)", RULE = "var(--rule)", RULE2 = "var(--rule-2)", BG2 = "var(--bg-2)";
const AMBER = "var(--amber-mark)", WASH = "var(--amber-wash)";
const FS = 12.5;

/** Words wrapped to a width, for labels drawn in SVG. */
function wrap(s: string, width: number, size = FS, weight = 400): string[] {
  const out: string[] = []; let cur = "";
  for (const w of s.split(" ")) { const t = cur ? `${cur} ${w}` : w; if (cur && textWidth(t, size, weight) > width) { out.push(cur); cur = w; } else cur = t; }
  return cur ? [...out, cur] : out;
}
const lines = (x: number, y: number, ls: string[], a: Record<string, string | number> = {}, lh = 15) => ls.map((l, i) => label(x, y + i * lh, l, { "font-size": FS, fill: INK2, ...a })).join("");

// ---- Mounting: elevations on one scale ---------------------------------------------------------------------------
const MW = NARROW, MH = 262, GROUND = 236, PX = 13; // pixels per foot, the same in all three
const yFt = (ft: number) => GROUND - ft * PX;
const POLE_X = 128, LX = 168; // the pole, and where the labels start
/** A label to the right of the pole with a leader to the point it names. */
function callout(px: number, py: number, ty: number, s: string, strong = false): string {
  const ls = wrap(s, MW - LX - 4, FS, strong ? 600 : 400);
  // a mark that already reaches the label column needs no leader
  const lead = px < LX - 12 ? path(`M${px},${py} H${LX - 10} L${LX - 4},${ty - 4}`, { fill: "none", stroke: RULE2, "stroke-width": 1 }) : "";
  return lead + lines(px < LX - 12 ? LX : px + 6, ty, ls, strong ? { "font-weight": 600, fill: INK } : {});
}
function scale(maxFt: number): string {
  const ticks = [0, 5, 10, 15].filter((t) => t <= maxFt);
  return text(0, yFt(maxFt) - 12, "Feet", { "font-size": 12, fill: INK3 }) + line(26, yFt(0), 26, yFt(maxFt), { stroke: RULE2 })
    + ticks.map((t) => line(22, yFt(t), 26, yFt(t), { stroke: RULE2 }) + text(18, yFt(t) + 4, String(t), { "text-anchor": "end", "font-size": 12, fill: INK3 })).join("");
}
const ground = () => rect(0, GROUND, MW, MH - GROUND, { fill: BG2 }) + line(0, GROUND + 0.5, MW, GROUND + 0.5, { stroke: INK3 });
/** The camera: a small amber box clamped to the pole, its lens toward `dir`. */
function camera(x: number, ft: number, dir: 1 | -1 = 1): string {
  const w = 7, h = 12, y = yFt(ft) - h / 2, cx = dir === 1 ? x : x - w;
  return rect(cx, y, w, h, { fill: AMBER, rx: 1 }) + line(x - dir * 3, y + 2, x, y + 2, { stroke: INK2 }) + line(x - dir * 3, y + h - 2, x, y + h - 2, { stroke: INK2 });
}
/** Two panels on a short mast, tilted toward the sun. */
function panels(cx: number, cy: number, w = 54): string {
  return line(cx, cy, cx, cy - 8, { stroke: INK2, "stroke-width": 2 }) + g(rect(-w / 2, -3, w, 6, { fill: "#4a5560", stroke: INK2, "stroke-width": 0.75 }) + line(0, -3, 0, 3, { stroke: "#fff", "stroke-width": 0.75 }), { transform: `translate(${cx},${cy - 11}) rotate(-18)` });
}

export function mountDiagram(mode: "flock" | "existing" | "ac", pole: Pole): string {
  let out = ground(), desc = "";
  const cam = pole.cameraHeightFt;
  if (mode === "flock") {
    const top = yFt(pole.heightFt);
    out += scale(15);
    out += path(`M${POLE_X - 9},${GROUND} L${POLE_X - 5},${GROUND - 9} H${POLE_X + 5} L${POLE_X + 9},${GROUND} Z`, { fill: INK3 });
    out += rect(POLE_X - 2, top, 4, GROUND - top, { fill: INK2 });
    out += panels(POLE_X, top);
    out += rect(POLE_X + 2, yFt(5.4) - 9, 11, 18, { fill: "#fff", stroke: INK2, rx: 1 });
    out += camera(POLE_X + 2, cam);
    out += callout(POLE_X + 26, top - 14, top - 14, "Two solar panels");
    out += callout(POLE_X + 9, yFt(cam), yFt(cam) + 4, `Camera, about ${cam} feet up`, true);
    out += callout(POLE_X + 13, yFt(5.4), yFt(5.4) + 4, "Battery box");
    out += callout(POLE_X + 9, GROUND - 5, GROUND - 24, "Breakaway base, set in soil");
    // the pole's height, as a dimension
    out += line(POLE_X - 22, top, POLE_X - 22, GROUND, { stroke: INK3 }) + line(POLE_X - 26, top, POLE_X - 18, top, { stroke: INK3 }) + line(POLE_X - 26, GROUND, POLE_X - 18, GROUND, { stroke: INK3 });
    out += label(POLE_X - 27, (top + GROUND) / 2, `${pole.heightFt} feet`, { "text-anchor": "end", "font-size": FS, fill: INK2 });
    desc = `Elevation drawing of Flock's own pole, ${pole.heightFt} feet tall on a breakaway base set in soil, with two solar panels on top, a battery box and the camera about ${cam} feet up.`;
  } else {
    // an existing pole: drawn lighter, and cut off at the top because it continues
    const cut = yFt(17.2);
    out += scale(15);
    out += rect(POLE_X - 4, cut, 8, GROUND - cut, { fill: "#d9d6d0", stroke: INK3, "stroke-width": 0.75 });
    out += path(`M${POLE_X - 7},${cut + 3} l4,-4 l4,4 l4,-4 l4,4`, { fill: "none", stroke: INK3, "stroke-width": 1 });
    if (mode === "existing") {
      // the mounting range, 8 to 12 feet
      out += rect(POLE_X - 18, yFt(12), 5, yFt(8) - yFt(12), { fill: WASH, stroke: AMBER, "stroke-width": 0.75 });
      out += label(POLE_X - 22, yFt(10) - 4, "8 to 12", { "text-anchor": "end", "font-size": FS, fill: INK2 }) + label(POLE_X - 22, yFt(10) + 11, "feet", { "text-anchor": "end", "font-size": FS, fill: INK2 });
      out += line(POLE_X + 4, yFt(13.6), POLE_X + 28, yFt(13.6), { stroke: INK2, "stroke-width": 2 }) + panels(POLE_X + 28, yFt(13.6) + 4, 40);
      out += rect(POLE_X + 4, yFt(6.4) - 9, 11, 18, { fill: "#fff", stroke: INK2, rx: 1 });
      out += camera(POLE_X + 4, cam);
      out += callout(POLE_X + 50, yFt(14.9), yFt(14.9), "Solar panels on a side bracket");
      out += callout(POLE_X + 11, yFt(cam), yFt(cam) + 4, "Camera, clamped to the pole", true);
      out += callout(POLE_X + 15, yFt(6.4), yFt(6.4) + 4, "Battery box");
      desc = "Elevation drawing of an existing utility or light pole with the camera clamped 8 to 12 feet up, solar panels on a side bracket above it and a battery box below.";
    } else {
      // a street light's arm, two cameras and the junction box; power comes up inside the pole
      out += path(`M${POLE_X - 4},${yFt(16.2)} Q${POLE_X - 30},${yFt(16.9)} ${POLE_X - 56},${yFt(16.6)}`, { fill: "none", stroke: INK3, "stroke-width": 3 }) + rect(POLE_X - 70, yFt(16.6) - 2, 18, 6, { fill: INK3, rx: 2 });
      out += camera(POLE_X + 4, cam) + camera(POLE_X - 4, cam, -1);
      out += rect(POLE_X + 4, yFt(7.6) - 8, 13, 16, { fill: "#fff", stroke: INK2, rx: 1 });
      out += path(`M${POLE_X},${GROUND - 2} V${yFt(7.6)} H${POLE_X + 4}`, { fill: "none", stroke: AMBER, "stroke-width": 1.5, "stroke-dasharray": "3 2" });
      out += callout(POLE_X + 11, yFt(cam), yFt(cam) - 6, "Two cameras can share a pole on wired power", true);
      out += callout(POLE_X + 17, yFt(7.6), yFt(7.6) + 8, "Flock junction box");
      out += callout(POLE_X + 2, yFt(2.2), yFt(3.6), "120 volts from the pole’s supply, connected by an electrician");
      desc = `Elevation drawing of an existing street-light pole with two cameras about ${cam} feet up and a Flock junction box below them, fed with 120-volt power from inside the pole.`;
    }
  }
  return svg(MW, MH, out, { cls: "mount", label: desc });
}

// ---- Power and network: three flows ------------------------------------------------------------------------------
interface Step { t: string; s?: string; cam?: boolean; cloud?: boolean }
interface Link { t: string; radio?: boolean }
/** Boxes down the card, joined by labeled arrows; a dashed arrow is a radio link. */
function flow(steps: Step[], links: Link[], note: string, desc: string): string {
  const W = NARROW, BX = 0, BW = 212, PAD = 9, LH = 15;
  let y = 2, out = "";
  steps.forEach((st, i) => {
    const tl = wrap(st.t, BW - 2 * PAD - (st.cam ? 14 : 0), 13, 600), sl = st.s ? wrap(st.s, BW - 2 * PAD, 12) : [];
    const h = PAD * 2 + tl.length * 16 + sl.length * LH - 2;
    out += rect(BX + 0.5, y + 0.5, BW - 1, h - 1, { fill: st.cloud ? BG2 : "#fff", stroke: st.cam ? AMBER : RULE2, "stroke-width": st.cam ? 1.5 : 1, rx: 3 });
    if (st.cam) out += rect(BX + PAD, y + PAD + 2, 8, 11, { fill: AMBER, rx: 1 });
    tl.forEach((l, k) => { out += text(BX + PAD + (st.cam ? 14 : 0), y + PAD + 11 + k * 16, l, { "font-size": 13, "font-weight": 600, fill: INK }); });
    sl.forEach((l, k) => { out += text(BX + PAD, y + PAD + 11 + tl.length * 16 + k * LH, l, { "font-size": 12, fill: INK3 }); });
    y += h;
    const link = links[i];
    if (link) {
      const ll = wrap(link.t, W - BW / 2 - 18, 12);
      const lh = Math.max(34, ll.length * LH + 14), ax = BX + 26;
      out += line(ax, y, ax, y + lh - 6, { stroke: link.radio ? AMBER : INK2, "stroke-width": 1.5, "stroke-dasharray": link.radio ? "4 3" : undefined });
      out += path(`M${ax - 4},${y + lh - 9} L${ax},${y + lh - 2} L${ax + 4},${y + lh - 9}`, { fill: "none", stroke: link.radio ? AMBER : INK2, "stroke-width": 1.5 });
      ll.forEach((l, k) => { out += text(ax + 12, y + (lh - ll.length * LH) / 2 + 11 + k * LH, l, { "font-size": 12, fill: INK2, "font-style": link.radio ? "italic" : undefined }); });
      y += lh;
    }
  });
  if (note) { y += 8; wrap(note, W, 12).forEach((l) => { out += text(0, y + 11, l, { "font-size": 12, fill: INK3, "font-style": "italic", "font-family": "var(--serif)" }); y += LH; }); }
  return svg(W, y + 4, out, { cls: "flow-d", label: desc });
}
const CAMERA: Step = { t: "Camera", s: "Reads the plate itself", cam: true };
const CLOUD: Step = { t: "Flock’s cloud", s: "Amazon Web Services", cloud: true };
const RADIO: Link = { t: "Over the cellular network (LTE)", radio: true };

export function powerDiagram(kind: "solar" | "ac" | "wing"): string {
  if (kind === "solar") return flow(
    [{ t: "Two solar panels", s: "18 to 20 volts" }, { t: "Battery box", s: "10.8-volt lithium-ion pack" }, CAMERA, CLOUD],
    [{ t: "Direct-current cable" }, { t: "Direct-current cable to the camera’s rear connector" }, RADIO],
    "No cable runs to the ground, and none carries data.",
    "Flow diagram: two solar panels charge a battery box, which powers the camera through a cable to its rear connector; the camera sends its reads over the cellular network to Flock's cloud.");
  if (kind === "ac") return flow(
    [{ t: "The pole’s power supply", s: "120 volts AC" }, { t: "Flock junction box", s: "Converts the power to direct current" }, CAMERA, CLOUD],
    [{ t: "Connected by an electrician the customer hires" }, { t: "Direct-current cable to the camera’s rear connector" }, RADIO],
    "Only the power source changes; the reads still go out by cellular network.",
    "Flow diagram: the pole's 120-volt supply feeds a Flock junction box, which converts it to direct current for the camera; the camera sends its reads over the cellular network to Flock's cloud.");
  return flow(
    [{ t: "An agency’s existing camera", s: "Any network camera that streams video (RTSP)" }, { t: "Network switch" }, { t: "Wing gateway", s: "In the network closet; reads plates and describes vehicles" }, CLOUD],
    [{ t: "Network cable that also carries power (PoE)" }, { t: "Fiber or copper, through a plug-in module (SFP)" }, { t: "The city’s internet connection" }],
    "",
    "Flow diagram: an agency's existing camera streams video over a network cable to a switch, then over fiber or copper to a Wing gateway in the network closet, which reads plates and sends the results over the city's internet to Flock's cloud.");
}

// ---- Field of view: a plan ---------------------------------------------------------------------------------------
/** The camera at the roadside, aimed along the road at the rear plates of cars moving away; the field of view at the
 *  distance Flock's sheet gives, and the range its product page gives, dashed. Drawn to scale in feet. */
export function fovDiagram(c: Coverage): string {
  const draw = (W: number, narrow: boolean) => {
    const s = (W - (narrow ? 28 : 40)) / (c.maxFt + 4); // pixels per foot
    const LANE = 12, roadFt = LANE * c.lanes;
    const top = narrow ? 58 : 46, curb = top + roadFt * s, H = curb + (narrow ? 84 : 66);
    const cam = { x: narrow ? 10 : 16, y: curb + 3.5 * s };
    // the aim: along the road and into it, so the far end of the range spans both lanes
    const aim = Math.atan2(-(roadFt * 0.62 + 3.5) * s, c.maxFt * 0.82 * s), ux = Math.cos(aim), uy = Math.sin(aim), px = -uy, py = ux;
    const at = (d: number, off: number) => [cam.x + (ux * d + px * off) * s, cam.y + (uy * d + py * off) * s] as const;
    const half = (d: number) => (c.widthFt / 2) * (d / c.distFt);
    let out = "";
    // road: two lanes, a dashed line between them, the sidewalk below
    out += rect(0, top, W, roadFt * s, { fill: BG2 });
    out += line(0, top + 0.5, W, top + 0.5, { stroke: INK3 }) + line(0, curb - 0.5, W, curb - 0.5, { stroke: INK3 });
    for (let k = 1; k < c.lanes; k++) out += line(0, top + k * LANE * s, W, top + k * LANE * s, { stroke: "#fff", "stroke-width": 2, "stroke-dasharray": "10 8" });
    // the field of view: solid to the sheet's distance, dashed to the product page's range
    const [a1x, a1y] = at(c.distFt, -half(c.distFt)), [b1x, b1y] = at(c.distFt, half(c.distFt));
    const [a2x, a2y] = at(c.maxFt, -half(c.maxFt)), [b2x, b2y] = at(c.maxFt, half(c.maxFt));
    out += path(`M${cam.x},${cam.y} L${a1x},${a1y} L${b1x},${b1y} Z`, { fill: WASH, stroke: AMBER, "stroke-width": 1, "fill-opacity": 0.9 });
    out += path(`M${a1x},${a1y} L${a2x},${a2y} M${b1x},${b1y} L${b2x},${b2y}`, { stroke: AMBER, "stroke-width": 1, "stroke-dasharray": "3 3", fill: "none" });
    // a car moving away, its rear plate toward the camera
    const carL = 15 * s, carW = 6 * s, [ccx, ccy] = at(c.distFt * 0.9, 0);
    const cy0 = Math.min(Math.max(ccy, top + LANE * s * 0.5), curb - LANE * s * 0.5);
    out += rect(ccx - carL / 2, cy0 - carW / 2, carL, carW, { fill: "#fff", stroke: INK2, rx: 2 }) + rect(ccx - carL / 2 - 1, cy0 - 2, 2.5, 4, { fill: INK });
    out += path(`M${ccx + carL / 2 + 4},${cy0} h${narrow ? 12 : 18} m-5,-4 l5,4 l-5,4`, { fill: "none", stroke: INK2, "stroke-width": 1.25 });
    // the camera on its pole at the roadside
    out += circle(cam.x, cam.y, 4.5, { fill: AMBER, stroke: "#fff", "stroke-width": 1.5 });
    // the width at the sheet's distance, as a dimension across the field of view
    out += line(a1x, a1y, b1x, b1y, { stroke: INK, "stroke-width": 1.25 });
    const lab1 = `${c.widthFt} feet wide at ${c.distFt} feet`;
    out += line(a1x, a1y, a1x, top - 8, { stroke: RULE2 }) + label(Math.min(a1x, W - textWidth(lab1, FS, 600) - 2), top - 13, lab1, { "font-size": FS, "font-weight": 600, fill: INK });
    // under the road: the camera and how it reads at the left, the published range at the right
    const lanesWord = c.lanes === 2 ? "two" : String(c.lanes);
    const left = narrow ? ["Camera at the roadside,", "aimed at the rear plates", "of cars moving away"] : ["Camera at the roadside, aimed at the", "rear plates of cars moving away"];
    const right = narrow ? ["Range up to", `${c.maxFt} feet, Flock says`] : [`Range up to ${c.maxFt} feet across ${lanesWord}`, "lanes, Flock’s product page says"];
    const ly = cam.y + 20;
    left.forEach((l, i) => { out += text(0, ly + i * 15, l, { "font-size": FS, fill: INK2 }); });
    right.forEach((l, i) => { out += text(W, ly + i * 15, l, { "font-size": FS, fill: INK2, "text-anchor": "end" }); });
    out += path(`M${(a2x + b2x) / 2},${Math.max(a2y, b2y) + 4} V${ly - 13}`, { stroke: RULE2, fill: "none" });
    return svg(W, Math.max(H, ly + Math.max(left.length, right.length) * 15), out, { cls: narrow ? "v-narrow" : "v-wide", label: `Plan view drawn to scale: a camera at the roadside aimed along a ${c.lanes}-lane road; its field of view is ${c.widthFt} feet wide at ${c.distFt} feet, and Flock's product page gives a range of up to ${c.maxFt} feet. A car moving away shows its rear plate to the camera.` });
  };
  return draw(WIDE, false) + draw(NARROW, true);
}

