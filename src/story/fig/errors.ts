/** Three ways an alert can be wrong, each with its own total: a misread plate (Roseville), a plate that matches an
 *  entry from another state (Story County), and a list that was out of date (Los Angeles). */
import { g, rect, svg, text } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";

const ROSE = { wrong: 1011, total: 1427 }, STORY = { wrongState: 165, total: 214 }, LA = { stale: 161, alerts: 50183 };

/** 10 x 10 squares, the first `n` filled: each square is one percent of the total. */
function waffle(n: number): string {
  let s = "";
  for (let i = 0; i < 100; i++) { const c = i % 10, r = Math.floor(i / 10); s += rect(c * 13, r * 13, 11, 11, { rx: 1.5, class: i < n ? "c-hi" : "c-ctx2" }); }
  return svg(128, 128, s, { cls: "err-waffle", label: `${n} of 100 squares filled: ${n} percent` });
}
function plates(): string {
  const plate = (x: number, state: string, chars: string, sub: string, hi: boolean) =>
    rect(x, 18, 104, 52, { rx: 4, fill: "#fff", stroke: hi ? "var(--amber-mark)" : "var(--ink)", "stroke-width": hi ? 2.5 : 1.5 })
    + text(x + 52, 33, state, { "text-anchor": "middle", "font-size": 10, "font-weight": 700, "letter-spacing": 1, fill: hi ? "var(--amber-ink)" : "var(--ink-2)" })
    + text(x + 52, 57, chars, { "text-anchor": "middle", "font-size": 18, "font-weight": 700, "letter-spacing": 1, fill: "var(--ink)", "font-family": "var(--mono)" })
    + text(x + 52, 88, sub, { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-3)" });
  return svg(250, 96, plates2(plate), { cls: "err-plates", label: "A plate reading ABC 123 from Iowa matched to a list entry ABC 123 from Texas" });
  function plates2(p: typeof plate) { return p(0, "IOWA", "ABC 123", "Read by the camera", false) + text(125, 50, "≠", { "text-anchor": "middle", "font-size": 22, fill: "var(--ink)" }) + p(146, "TEXAS", "ABC 123", "Entry on the list", true); }
}
function listEntry(): string {
  const s = rect(0, 10, 214, 76, { rx: 3, fill: "#fff", stroke: "var(--rule-2)" })
    + text(12, 30, "HOT LIST", { "font-size": 10, "font-weight": 700, "letter-spacing": 1, fill: "var(--ink-3)" })
    + text(12, 52, "ABC 123", { "font-size": 17, "font-weight": 700, fill: "var(--ink)", "font-family": "var(--mono)" })
    + text(12, 72, "Stolen vehicle", { "font-size": 12, fill: "var(--ink-2)" })
    + g(rect(-48, -13, 96, 26, { rx: 2, fill: "none", stroke: "var(--amber-mark)", "stroke-width": 2 }) + text(0, 5, "NOT STOLEN", { "text-anchor": "middle", "font-size": 12, "font-weight": 700, "letter-spacing": 1, fill: "var(--amber-ink)" }), { transform: "translate(160 50) rotate(-9)" })
;
  return svg(214, 96, s, { cls: "err-list", label: "A hot-list entry for a stolen vehicle that is no longer stolen" });
}

export function errorsFigure(cfg: FigureCfg, ctx: Ctx): string {
  const pct = (a: number, b: number) => Math.round(a / b * 100);
  const cards = [
    { k: "The camera misreads the plate", g: waffle(pct(ROSE.wrong, ROSE.total)), n: `${pct(ROSE.wrong, ROSE.total)}%`, t: `of 1,427 stolen-vehicle and felony alerts in Roseville, Calif., in 2023 and 2024 involved a misread plate: 1,011 alerts. A police lieutenant said none led to a contact or an arrest. Flock called the figure a mischaracterization and said the city’s older cameras were mounted unusually high.` },
    { k: "The plate matches, the state does not", g: plates(), n: `${STORY.wrongState} of ${STORY.total}`, t: `hits flagged in a month by the Story County, Iowa, sheriff’s in-car readers matched a list entry from another state, 77 percent.` },
    { k: "The list is out of date", g: listEntry(), n: String(LA.stale), t: `alerts in two months in Los Angeles were accurate reads of plates on cars that, it turned out, were not stolen. The inspector general pointed to records that were not updated in time.` },
  ];
  const body = `<div class="errors">${cards.map((c) => `<div class="err"><p class="err-k">${c.k}</p><div class="err-g">${c.g}</div><p class="err-n">${c.n}</p><p class="err-t">${c.t}</p></div>`).join("")}</div>`;
  const table = dataTable(["Kind of error", "Count", "Of", "Where and when"], [["Misread plate", ROSE.wrong, ROSE.total, "Roseville, Calif., stolen-vehicle and felony alerts, 2023–24"], ["Plate from another state", STORY.wrongState, STORY.total, "Story County, Iowa, hits reviewed, Sept. 9 to Oct. 9, 2025"], ["Accurate read, vehicle not stolen", LA.stale, LA.alerts, "Los Angeles, in-car alerts, Aug.–Sept. 2025"]], { text: [3] });
  return frame("errors", cfg, ctx, body, { width: "wide", table });
}
