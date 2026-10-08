/** Pieces every story figure shares: the frame (title, subtitle, graphic, notes, source line, data table) and the
 *  inline markup of the story's paragraphs. Pure string functions, run at build time. */
import { escape } from "../lib/escape.ts";
import { apDate, dec1, int } from "../viz/format.ts";
import type { FigureCfg } from "./schema.ts";
import type { SourceRec, Stats, CompletenessRow } from "./types.ts";

export interface Ctx {
  root: string;
  sources: Map<string, SourceRec>;
  stats: Stats;
  completeness: CompletenessRow[];
  /** source ids used anywhere in the story, for the build-time check */
  used: Set<string>;
}

const shortPub = (p: string) => p.replace(/\s*\(.*?\)\s*/g, " ").split(/ via | on GitHub/)[0]!.replace(/\s+/g, " ").trim();

/** "Source: A; B and C", each publisher linked to its row in the bibliography. */
export function sourceLine(ids: string[], ctx: Ctx, label = "Source"): string {
  const seen = new Map<string, string[]>();
  for (const id of ids) {
    const s = ctx.sources.get(id);
    if (!s) throw new Error(`story: unknown source ${id}`);
    ctx.used.add(id);
    const pub = shortPub(s.publisher);
    seen.set(pub, [...(seen.get(pub) ?? []), id]);
  }
  const parts = [...seen.entries()].map(([pub, list]) => `<a href="${ctx.root}sources/#src-${escape(list[0]!)}" data-src="${escape(list.join(" "))}">${escape(pub)}</a>`);
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join("; ")} and ${parts[parts.length - 1]}` : parts[0] ?? "";
  return `<p class="fig-src">${label}${parts.length > 1 ? "s" : ""}: ${joined}</p>`;
}

/** A data table for "Show the data": the first column is a label, the rest numbers unless marked text. */
export function dataTable(head: string[], rows: (string | number | null)[][], opts: { text?: number[]; caption?: string } = {}): string {
  const isNum = (i: number) => i > 0 && !opts.text?.includes(i);
  const cell = (v: string | number | null) => (v == null ? "—" : typeof v === "number" ? (Number.isInteger(v) ? int(v) : dec1(v)) : escape(v));
  return `<div class="tablewrap"><table class="data">${opts.caption ? `<caption class="visually-hidden">${escape(opts.caption)}</caption>` : ""}<thead><tr>${head.map((h, i) => `<th${isNum(i) ? ' class="num"' : ""} scope="col">${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v, i) => (i === 0 ? `<th scope="row">${cell(v)}</th>` : `<td${isNum(i) ? ' class="num"' : ""}>${cell(v)}</td>`)).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/** The figure frame. `body` is the graphic; `table` (if any) folds under "Show the data". */
export function frame(id: string, cfg: FigureCfg, ctx: Ctx, body: string, o: { width?: "body" | "wide"; table?: string; extra?: string } = {}): string {
  return `<figure class="fig fig-${o.width ?? "body"}" id="fig-${escape(id)}">
<figcaption class="fig-head"><h3 class="fig-title">${inline(cfg.title, ctx)}</h3>${cfg.sub ? `<p class="fig-sub">${inline(cfg.sub, ctx)}</p>` : ""}</figcaption>
<div class="fig-body">${body}</div>
<div class="fig-foot">${o.extra ?? ""}${cfg.notes.map((n) => `<p class="fig-note">${inline(n, ctx)}</p>`).join("")}${sourceLine(cfg.sources, ctx)}${o.table ? `<details class="fig-data"><summary>Show the data</summary>${o.table}</details>` : ""}</div>
</figure>`;
}

/** Resolve a {{token}} against stats.json: a dotted path into a stat's value, with an optional format. */
export function stat(key: string, fmt: string | undefined, ctx: Ctx): string {
  const [head, ...rest] = key.split(".");
  let v: unknown = head === "completeness" ? Object.fromEntries(ctx.completeness.map((r) => [r.place, r])) : ctx.stats[head!]?.value;
  if (head !== "completeness" && !(head! in ctx.stats)) throw new Error(`story: unknown stat ${key}`);
  for (const k of rest) v = (v as Record<string, unknown> | undefined)?.[k];
  if (v === undefined || v === null) throw new Error(`story: stat ${key} has no value`);
  if (head !== "completeness") for (const id of ctx.stats[head!]!.sources) ctx.used.add(id);
  if (typeof v === "string") return fmt === "date" ? apDate(v) : v;
  if (typeof v !== "number") throw new Error(`story: stat ${key} is not a number`);
  switch (fmt) {
    case "k": return int(Math.floor(v / 1000) * 1000);
    case "pct": case "round": return int(Math.round(v));
    case undefined: return Number.isInteger(v) ? int(v) : dec1(v);
    default: throw new Error(`story: unknown format ${fmt}`);
  }
}

/** Paragraph markup: {{stat|fmt}}, [text](src:id), [text](#anchor), [text](page:id), [text](url). */
export function inline(md: string, ctx: Ctx): string {
  const withStats = md.replace(/\{\{([\w.]+)(?:\|(\w+))?\}\}/g, (_, k: string, f?: string) => stat(k, f, ctx));
  return escape(withStats).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, target: string) => {
    if (target.startsWith("src:")) {
      const id = target.slice(4), s = ctx.sources.get(id);
      if (!s) throw new Error(`story: unknown source ${id}`);
      ctx.used.add(id);
      return `<a class="src" href="${escape(s.url)}" data-src="${escape(id)}" title="${escape(`${s.title} (${s.publisher}, ${s.date})`)}" rel="noopener">${text}</a>`;
    }
    if (target.startsWith("#")) return `<a href="${target}">${text}</a>`;
    if (target.startsWith("page:")) return `<a href="${ctx.root}${target.slice(5)}/">${text}</a>`;
    return `<a href="${target}"${/^https?:/.test(target) ? ' rel="noopener"' : ""}>${text}</a>`;
  });
}
