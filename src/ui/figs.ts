/**
 * Reference-page figures drawn in the browser: the same pure renderers as the build (src/story/fig/reference.ts), with
 * a frame context whose sources come from the site content, and the story's numbers and figure settings from the JSON
 * the build writes into each page (<script type="application/json" id="site-data">).
 */
import { sources } from "../content";
import { ROOT } from "../lib/base";
import type { Ctx } from "../story/frame";
import type { Stats } from "../story/types";
import type { FigureCfg } from "../story/schema";

let data: { stats: Stats; figures: Record<string, FigureCfg> } | undefined;
function siteData(): NonNullable<typeof data> {
  if (!data) { const el = document.getElementById("site-data"); data = el ? JSON.parse(el.textContent || "{}") : { stats: {}, figures: {} }; }
  return data!;
}

/** A frame context for figures and text drawn in the browser. */
export function figCtx(): Ctx {
  return { root: ROOT, sources: new Map(sources.map((s) => [s.id, s])), stats: siteData().stats ?? {}, completeness: [], used: new Set() };
}
/** A story figure's title, subtitle, notes and sources, as the build wrote them into this page. */
export function figureCfg(id: string): FigureCfg {
  const c = siteData().figures?.[id];
  if (!c) throw new Error(`no figure settings for ${id} on this page`);
  return c;
}
export { texasFigure, feesFigure } from "../story/fig/reference";
