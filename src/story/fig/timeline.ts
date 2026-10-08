/** 2026: dated events that changed where the cameras operate, who pays for them or how their data is kept. */
import { escape } from "../../lib/escape.ts";
import { apDate } from "../../viz/format.ts";
import { frame, sourceLine, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";
import type { TimelineEvent } from "../types.ts";

const KIND: Record<TimelineEvent["kind"], string> = { added: "Added, renewed or kept", ended: "Ended or switched off", restricted: "Restricted by law or order", flock: "Changed by Flock" };

export function timelineFigure(cfg: FigureCfg, ctx: Ctx, events: TimelineEvent[], rule: string): string {
  const legend = `<ul class="tml-legend">${(Object.keys(KIND) as TimelineEvent["kind"][]).map((k) => `<li><span class="tml-m k-${k}"></span>${KIND[k]}</li>`).join("")}</ul>`;
  const items = events.map((e) => {
    const when = e.precision === "day" ? apDate(e.date, { year: false }) : apDate(e.date).replace(/ \d{4}$/, "");
    const src = sourceLine(e.sources, ctx, "Source").replace('<p class="fig-src">', '<p class="tml-src">');
    return `<li class="tml-ev k-${e.kind}"><span class="tml-when">${escape(when)}</span><span class="tml-m k-${e.kind}" aria-label="${escape(KIND[e.kind])}"></span><div class="tml-body"><p class="tml-where">${escape(e.where)}</p><p class="tml-text">${escape(e.text)}</p>${src}</div></li>`;
  }).join("");
  return frame("timeline", { ...cfg, notes: [rule] }, ctx, `${legend}<ol class="tml">${items}</ol>`);
}
