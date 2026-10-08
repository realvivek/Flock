/** Reads everything the home page story is rendered from; shared by the Vite plugin and scripts/check-sources.ts. */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { StoryFile, TimelineFile } from "../../src/story/schema.ts";
import { renderStory, type Rendered } from "../../src/story/render.ts";
import type { StoryInput } from "../../src/story/types.ts";
import type { Deputy } from "../../src/story/fig/searches.ts";

export const STORY_FILES = ["src/content/story.json", "src/content/timeline-2026.json", "src/content/sources.json", "src/content/overview.json", "src/content/dataflow.json", "public/data/outcomes.json", "public/data/story/stats.json", "public/data/story/meta.json", "public/data/story/states.json", "public/data/story/counties.json", "public/data/story/operators.json", "public/data/story/completeness.json"];
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
    sources: j("src/content/sources.json").sources,
    overview: j("src/content/overview.json"),
    timeline: timeline.events,
    timelineRule: timeline.rule,
    deputy: j("src/content/dataflow.json").deputy,
    root: "./",
    poster: existsSync(resolve(root, "public", POSTER)) ? POSTER : undefined,
  };
  return renderStory(input);
}
