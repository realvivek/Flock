/**
 * The head of each reference page, rendered at build time (vite.config.ts) from src/content/pages.json: the <title>
 * and share tags, then kicker, headline, deck and dateline, so every page opens with what it found, in the same type
 * as the story, before any script runs. Pure functions.
 */
import { escape } from "../lib/escape.ts";
import { apDate } from "../viz/format.ts";
import { inline, stat, asH2, type Ctx } from "./frame.ts";
import type { PageHeadCfg } from "./schema.ts";

const SITE = "Anatomy of a Flock Camera";

/** Markup as plain text, for the title and share tags: numbers resolved, links reduced to their words. */
export function plain(md: string, ctx: Ctx): string {
  return md.replace(/\{\{([\w.]+)(?:\|(\w+))?\}\}/g, (_, k: string, f?: string) => stat(k, f, ctx)).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1");
}

export function renderPageMeta(cfg: PageHeadCfg, ctx: Ctx): string {
  const t = plain(cfg.title, ctx), d = plain(cfg.description ?? cfg.deck, ctx);
  return `<title>${escape(t)} · ${SITE}</title>
    <meta name="description" content="${escape(d)}" />
    <meta property="og:title" content="${escape(t)}" />
    <meta property="og:description" content="${escape(d)}" />`;
}

/** Kicker, headline, deck, the date of the last update and, where the page has one, a link to its notes on the data. */
export function renderPageHead(cfg: PageHeadCfg, ctx: Ctx, updated: string): string {
  const jump = cfg.jump.length ? `\n<nav class="jump" aria-label="On this page">${cfg.jump.map((j) => `<a href="${escape(j.href)}">${escape(j.label)}</a>`).join("")}</nav>` : "";
  return `<header class="page-head" id="top">
<p class="kicker">${escape(cfg.kicker)}</p>
<h1>${inline(cfg.title, ctx)}</h1>
<p class="deck">${inline(cfg.deck, ctx)}</p>
<p class="dateline"><time datetime="${escape(updated)}">Updated ${escape(apDate(updated))}</time>${cfg.about ? `<span class="sep" aria-hidden="true">·</span><a href="#about">About the data</a>` : ""}</p>${jump}
</header>`;
}

/** A figure made to open a page: its title is an h2, the level under the page's h1. */
export const asLead = asH2;
