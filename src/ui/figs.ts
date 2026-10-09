/**
 * Reference-page figures drawn in the browser: the same pure renderers as the build (src/story/fig/reference.ts), with
 * a frame context whose sources come from the site content and whose numbers come from the stats the build embeds.
 */
import { sources } from "../content";
import { ROOT } from "../lib/base";
import type { Ctx } from "../story/frame";
import type { Stats } from "../story/types";

let stats: Stats | undefined;
/** The story's numbers, embedded in each page by the build as <script type="application/json" id="site-stats">. */
function siteStats(): Stats {
  if (!stats) { const el = document.getElementById("site-stats"); stats = el ? JSON.parse(el.textContent || "{}") as Stats : {}; }
  return stats;
}

/** A frame context for figures and text drawn in the browser. */
export function figCtx(): Ctx {
  return { root: ROOT, sources: new Map(sources.map((s) => [s.id, s])), stats: siteStats(), completeness: [], used: new Set() };
}
export { texasFigure, feesFigure } from "../story/fig/reference";
