/** Reads everything the home page story is rendered from; shared by the Vite plugin and scripts/check-sources.ts. */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { StoryFile, TimelineFile, PagesFile } from "../../src/story/schema.ts";
import { renderStory, type Rendered } from "../../src/story/render.ts";
import type { StoryInput, Stats, SourceRec } from "../../src/story/types.ts";
import type { Deputy } from "../../src/story/fig/searches.ts";
import type { Ctx } from "../../src/story/frame.ts";
import { renderPageMeta, renderPageHead, asLead } from "../../src/story/pagehead.ts";
import { citiesFigure, verdictIndex, originsFigure, partsFigure, type Myth } from "../../src/story/fig/reference.ts";
import { rulerFigure } from "../../src/story/fig/ruler.ts";
import { priceFigure } from "../../src/story/fig/money.ts";
import { apDate, typeset } from "../../src/viz/format.ts";

export const STORY_FILES = ["src/content/story.json", "src/content/timeline-2026.json", "src/content/sources.json", "src/content/overview.json", "src/content/dataflow.json", "src/content/pages.json", "src/content/myths.json", "public/data/outcomes.json", "public/data/story/stats.json", "public/data/story/meta.json", "public/data/story/states.json", "public/data/story/counties.json", "public/data/story/operators.json", "public/data/story/completeness.json", "public/data/story/cities.json"];

/** The date the site was last updated: the camera snapshot, or the last time a source was checked if that is later. */
export function updatedDate(stats: Stats, sources: SourceRec[]): string {
  return [String(stats.snapshot!.value), ...sources.map((s) => s.lastVerified)].sort().at(-1)!;
}
/** The poster that stands in for the map until the camera file loads (or without JavaScript), if it has been made. */
export const POSTER = "data/story/map-poster.jpg";

export function renderHome(root: string): Rendered {
  const j = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
  const story = StoryFile.parse(j("src/content/story.json"));
  const timeline = TimelineFile.parse(j("src/content/timeline-2026.json"));
  const outcomes = j("public/data/outcomes.json");
  const input: StoryInput & { deputy: Deputy; timelineRule: string; poster?: string } = {
    story,
    stats: j("public/data/story/stats.json"),
    meta: j("public/data/story/meta.json"),
    states: j("public/data/story/states.json"),
    counties: j("public/data/story/counties.json"),
    operators: j("public/data/story/operators.json"),
    completeness: j("public/data/story/completeness.json"),
    ladders: outcomes.ladders,
    sources: typeset(j("src/content/sources.json").sources),
    overview: j("src/content/overview.json"),
    timeline: timeline.events,
    timelineRule: timeline.rule,
    deputy: j("src/content/dataflow.json").deputy,
    root: "./",
    poster: existsSync(resolve(root, "public", POSTER)) ? POSTER : undefined,
  };
  return renderStory(input);
}

export interface RenderedPage { meta: string; head: string; lead: string; data: string; used: Set<string> }
/** The story figures a page draws in the browser, whose titles and notes come from story.json. */
const PAGE_FIGURES: Record<string, string[]> = { deployments: ["contracts"], outcomes: ["errors", "evidence"], data: ["audit"] };

/** A reference page's head and opening figure, from src/content/pages.json and the built data. Counts a deck may quote
 *  (the city with the most cameras, the claims by verdict, the sources by origin, the Outcomes coverage) are added to
 *  the story's stats for the page. */
export function renderPage(root: string, id: string): RenderedPage {
  const j = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
  const cfg = PagesFile.parse(j("src/content/pages.json")).pages[id];
  if (!cfg) throw new Error(`pages.json: no head for ${id}`);
  const sources: SourceRec[] = typeset(j("src/content/sources.json").sources);
  const myths: Myth[] = typeset(j("src/content/myths.json").myths);
  const cities: { snapshot: string; rows: { name: string; usps: string; flock: number }[] } = j("public/data/story/cities.json");
  const coverage = j("public/data/outcomes.json").coverage;
  const byKind = (k: string) => sources.filter((s) => s.kind === k).length;
  const byVerdict = (v: string) => myths.filter((m) => m.verdict === v).length;
  const base: Stats = j("public/data/story/stats.json");
  const stats: Stats = {
    ...base,
    topCity: { value: cities.rows[0], sources: ["deflock-tiles-2026", "census-boundaries-2024"] },
    outcomes: { value: coverage, sources: [] },
    claims: { value: { total: myths.length, true: byVerdict("true"), false: byVerdict("false"), nuanced: byVerdict("nuanced") }, sources: [] },
    sources: { value: { total: sources.length, flock: byKind("flock"), independent: byKind("independent"), government: byKind("government"), court: byKind("court"), public: byKind("government") + byKind("court") }, sources: [] },
  };
  const ctx: Ctx = { root: "../", sources: new Map(sources.map((s) => [s.id, s])), stats, completeness: j("public/data/story/completeness.json"), used: new Set() };
  const story = StoryFile.parse(j("src/content/story.json"));
  const lead = (() => {
    switch (cfg.lead) {
      case undefined: return "";
      case "cities": return citiesFigure(cities.rows, apDate(cities.snapshot), ctx, { level: 2 });
      case "price": return asLead(priceFigure(story.figures.price!, ctx));
      case "verdicts": return verdictIndex(myths, ctx, { level: 2 });
      case "origins": return originsFigure(sources, ctx, { level: 2 });
      case "ruler": return asLead(rulerFigure(story.figures.ruler!, ctx));
      case "parts": { const c = j("src/content/components.json"); return partsFigure(c.parts.length, [...new Set([...c.envelope.sources, "cehrp-dissection", "ryanohoro-2024", "flockcamre", "fccid-2bkg8"])], ctx, { level: 2 }); }
      default: throw new Error(`pages.json: unknown lead figure ${cfg.lead} on ${id}`);
    }
  })();
  return {
    meta: renderPageMeta(cfg, ctx),
    head: renderPageHead(cfg, ctx, updatedDate(base, sources)),
    // the parts explorer spans the page; the other opening figures keep the reading column
    lead: lead ? `<div class="page-lead${cfg.lead === "parts" ? " is-wide" : ""}">${lead}</div>` : "",
    // the numbers client-rendered text may quote and the story figures it draws, for src/ui/figs.ts; "<" escaped so it
    // cannot close the tag
    data: JSON.stringify({ stats, figures: Object.fromEntries((PAGE_FIGURES[id] ?? []).map((f) => [f, story.figures[f]])) }).replace(/</g, "\\u003c"),
    used: ctx.used,
  };
}
