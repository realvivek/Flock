/** Three ways an alert can be wrong, each with its own total: a misread plate (Roseville), a plate that matches an
 *  entry from another state (Story County), and a list that was out of date (Los Angeles). Each panel has the same
 *  grid of 100 squares, one square for 1 percent of the alerts its own report counted. */
import { rect, svg } from "../../viz/svg.ts";
import { frame, dataTable, type Ctx } from "../frame.ts";
import { int } from "../../viz/format.ts";
import type { FigureCfg } from "../schema.ts";

const ROSE = { wrong: 1011, total: 1427 }, STORY = { wrongState: 165, total: 214 }, LA = { stale: 161, alerts: 50183 };

/** 10 x 10 squares filled to `pct` percent, the last one in part, so a share under 1 percent still shows. */
function waffle(pct: number, label: string): string {
  let s = "";
  const full = Math.floor(pct), part = pct - full;
  for (let i = 0; i < 100; i++) {
    const x = (i % 10) * 13, y = Math.floor(i / 10) * 13;
    s += rect(x, y, 11, 11, { rx: 1.5, class: i < full ? "c-hi" : "c-ctx2" });
    if (i === full && part > 0) s += rect(x, y, Math.max(1.5, 11 * part), 11, { rx: 0.5, class: "c-hi" });
  }
  return svg(128, 128, s, { cls: "err-waffle", label });
}

export function errorsFigure(cfg: FigureCfg, ctx: Ctx): string {
  const pct = (a: number, b: number) => (a / b) * 100;
  const fmt = (p: number) => (p < 1 ? p.toFixed(1) : String(Math.round(p)));
  const cards = [
    { k: "The camera misreads the plate", m: "Roseville, Calif. · Flock cameras", p: pct(ROSE.wrong, ROSE.total), t: `${int(ROSE.wrong)} of ${int(ROSE.total)} stolen-vehicle and felony alerts in 2023 and 2024 involved a misread plate. A police lieutenant said none led to a contact or an arrest. Flock called the figure a mischaracterization and said the city’s older cameras were mounted unusually high.` },
    { k: "The plate matches; the state does not", m: "Story County, Iowa · Axon readers in patrol cars", p: pct(STORY.wrongState, STORY.total), t: `${STORY.wrongState} of ${STORY.total} hits flagged in a month by the sheriff’s in-car readers matched a list entry from another state.` },
    { k: "The list is out of date", m: "Los Angeles · Axon readers in patrol cars", p: pct(LA.stale, LA.alerts), t: `${LA.stale} of ${int(LA.alerts)} alerts in two months were accurate reads of plates on cars that, it turned out, were not stolen. The inspector general pointed to records that were not updated in time.` },
  ];
  const key = `<p class="err-key"><i aria-hidden="true"></i>Each square is 1 percent of the alerts that place counted</p>`;
  const body = key + `<div class="errors">${cards.map((c) => `<div class="err"><p class="err-k">${c.k}</p><p class="err-m">${c.m}</p><div class="err-g">${waffle(c.p, `${fmt(c.p)} of 100 squares filled`)}<p class="err-n">${fmt(c.p)}<span>%</span></p></div><p class="err-t">${c.t}</p></div>`).join("")}</div>`;
  const table = dataTable(["Kind of error", "Count", "Of", "Percent", "Where and when"], [
    ["Misread plate", ROSE.wrong, ROSE.total, fmt(pct(ROSE.wrong, ROSE.total)), "Roseville, Calif., stolen-vehicle and felony alerts, 2023–24"],
    ["Plate from another state", STORY.wrongState, STORY.total, fmt(pct(STORY.wrongState, STORY.total)), "Story County, Iowa, hits reviewed, Sept. 9 to Oct. 9, 2025"],
    ["Accurate read, vehicle not stolen", LA.stale, LA.alerts, fmt(pct(LA.stale, LA.alerts)), "Los Angeles, in-car alerts, August–September 2025"],
  ], { text: [4] });
  return frame("errors", cfg, ctx, body, { width: "wide", table });
}
