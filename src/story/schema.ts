/** The story's content file, src/content/story.json. */
import { z } from "zod";

const Block = z.union([
  z.object({ p: z.string().min(1) }),
  z.object({ fig: z.string().min(1) }),
  z.object({ preview: z.enum(["components", "journey"]) }),
]);
const Section = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().optional(),
  kind: z.enum(["chapter", "cards", "methods"]).default("chapter"),
  blocks: z.array(Block).default([]),
});
const Figure = z.object({
  title: z.string().min(1),
  sub: z.string().optional(),
  notes: z.array(z.string()).default([]),
  sources: z.array(z.string().min(1)).min(1),
});
export const StoryFile = z.object({
  kicker: z.string(),
  headline: z.string(),
  deck: z.string(),
  intro: z.array(z.string()),
  map: z.object({ id: z.string(), alt: z.string(), steps: z.array(z.object({ id: z.string(), text: z.string() })).min(1) }),
  sections: z.array(Section),
  figures: z.record(z.string(), Figure),
}).passthrough();
export type Story = z.infer<typeof StoryFile>;
export type FigureCfg = z.infer<typeof Figure>;

export const TimelineFile = z.object({
  rule: z.string(),
  events: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/), precision: z.enum(["day", "month"]), kind: z.enum(["added", "ended", "restricted", "flock"]), where: z.string(), text: z.string(), sources: z.array(z.string()).min(1) })),
}).passthrough();
