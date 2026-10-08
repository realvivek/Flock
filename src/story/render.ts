/**
 * The home page story as HTML, rendered at build time (vite.config.ts) from src/content/story.json and the built data,
 * so the text, figures, tables and links are in the page before any script runs. The client (./home.ts) adds the
 * map, the county search and tooltips. Pure functions: no DOM, no file access.
 */
import { escape } from "../lib/escape.ts";
import { apDate } from "../viz/format.ts";
import { inline, type Ctx } from "./frame.ts";
import type { StoryInput } from "./types.ts";
import { statesFigure, lookupFigure } from "./fig/places.ts";
import { readFigure } from "./fig/read.ts";
import { rulerFigure } from "./fig/ruler.ts";
import { auditFigure, type Deputy } from "./fig/searches.ts";
import { oaklandFigure, ladderFigure } from "./fig/outcomes.ts";
import { errorsFigure } from "./fig/errors.ts";
import { makesFigure, operatorsFigure } from "./fig/makers.ts";
import { priceFigure, contractsFigure } from "./fig/money.ts";
import { timelineFigure } from "./fig/timeline.ts";
import { completenessFigure } from "./fig/methods.ts";

const PAGES: { id: string; label: string; section: string }[] = [
  { id: "deployments", label: "Deployments", section: "deployments" },
  { id: "components", label: "Components", section: "inside" },
  { id: "data", label: "Data", section: "data" },
  { id: "journey", label: "Journey", section: "journey" },
  { id: "outcomes", label: "Outcomes", section: "outcomes" },
  { id: "claims", label: "Claims", section: "myths" },
  { id: "economics", label: "Economics", section: "economics" },
  { id: "sources", label: "Sources", section: "sources" },
];

export interface Rendered { html: string; used: Set<string> }

export function renderStory(inp: StoryInput & { deputy: Deputy; timelineRule: string; poster?: string }): Rendered {
  const ctx: Ctx = { root: inp.root, sources: new Map(inp.sources.map((s) => [s.id, s])), stats: inp.stats, completeness: inp.completeness, used: new Set() };
  const s = inp.story;
  const cfg = (id: string) => { const c = s.figures[id]; if (!c) throw new Error(`story: no figure config for ${id}`); return c; };
  const figure = (id: string): string => {
    switch (id) {
      case "states": return statesFigure(cfg(id), ctx, inp.states);
      case "lookup": return lookupFigure(cfg(id), ctx, inp.states, inp.counties);
      case "read": return readFigure(cfg(id), ctx);
      case "ruler": return rulerFigure(cfg(id), ctx);
      case "audit": return auditFigure(cfg(id), ctx, inp.deputy);
      case "oakland": return oaklandFigure(cfg(id), ctx);
      case "ladder": return ladderFigure(cfg(id), ctx, inp.ladders);
      case "errors": return errorsFigure(cfg(id), ctx);
      case "makes": return makesFigure(cfg(id), ctx, inp.operators);
      case "operators": return operatorsFigure(cfg(id), ctx, inp.operators);
      case "price": return priceFigure(cfg(id), ctx);
      case "contracts": return contractsFigure(cfg(id), ctx);
      case "timeline": return timelineFigure(cfg(id), ctx, inp.timeline, inp.timelineRule);
      case "completeness": return completenessFigure(cfg(id), ctx, inp.completeness);
      default: throw new Error(`story: unknown figure ${id}`);
    }
  };
  const preview = (k: "components" | "journey") => k === "components"
    ? `<a class="preview" href="components/" id="preview"><img id="preview-img" src="img/knolling.jpg" alt="The fourteen components of a Falcon camera laid out in a grid: shell, optics, compute, radios and mount" loading="lazy" decoding="async" width="1600" height="900"><span class="cap"><span class="kicker">Inside the camera</span><span class="t">Fourteen components in five groups, from the lens to the LTE modem</span><span class="go">See the components</span></span></a>`
    : `<a class="preview" href="journey/" id="preview-journey"><img id="preview-journey-img" src="img/journey.jpg" alt="One photograph tracked like a parcel through seven stops: the pole, the carrier network, Amazon’s cloud, the hot lists, an officer’s phone, a network search, and deletion" loading="lazy" decoding="async" width="1600" height="900"><span class="cap"><span class="kicker">The journey</span><span class="t">One photograph followed through seven stops, from the pole to deletion</span><span class="go">Follow the picture</span></span></a>`;
  const cards = () => `<div id="summary-cards" class="summary">${PAGES.map((pg, i) => {
    const sec = inp.overview.sections.find((x) => x.id === pg.section);
    return `<a class="summary-card" href="${pg.id}/"><span class="n">${String(i + 1).padStart(2, "0")}</span><span class="t">${escape(sec?.title ?? pg.label)}</span><span class="b">${escape(sec?.blurb ?? "")}</span><span class="go">${escape(pg.label)} →</span></a>`;
  }).join("")}</div>`;

  const snapshot = String(inp.stats.snapshot!.value);
  let html = `<article class="story">
<header class="story-head" id="top">
<p class="kicker">${escape(s.kicker)}</p>
<h1>${escape(s.headline)}</h1>
<p class="deck">${inline(s.deck, ctx)}</p>
<p class="dateline"><time datetime="${escape(snapshot)}">Updated ${escape(apDate(snapshot))}</time><span class="sep" aria-hidden="true">·</span><a href="#how-this-was-made">How this was made</a></p>
</header>
<div class="prose intro">${s.intro.map((p) => `<p>${inline(p, ctx)}</p>`).join("")}</div>
${mapSection(inp, ctx)}
`;
  for (const sec of s.sections) {
    const title = sec.title ? `<h2 class="chapter-title">${escape(sec.title)}</h2>` : "";
    let body = "";
    let open = false; // paragraphs are grouped into a prose column between figures
    const close = () => { if (open) { body += "</div>"; open = false; } };
    for (const b of sec.blocks) {
      if ("p" in b) { if (!open) { body += `<div class="prose">`; open = true; } body += `<p>${inline(b.p, ctx)}</p>`; continue; }
      close();
      if ("fig" in b) body += figure(b.fig);
      else if ("preview" in b) body += preview(b.preview);
    }
    close();
    if (sec.kind === "cards") body += cards();
    html += `<section class="chapter${sec.kind !== "chapter" ? ` chapter-${sec.kind}` : ""}" id="${sec.id}">${title}${body}</section>\n`;
  }
  html += `</article>`;
  return { html, used: ctx.used };
}

/** The opening map: a sticky graphic with step cards over it. Without JavaScript the poster image stands in. */
function mapSection(inp: StoryInput & { poster?: string }, ctx: Ctx): string {
  const m = inp.story.map;
  const steps = m.steps.map((st, i) => `<div class="step" data-step="${escape(st.id)}" data-i="${i}"><div class="step-card"><p>${inline(st.text, ctx)}</p></div></div>`).join("");
  const poster = inp.poster ? `<img class="map-poster" src="${escape(inp.poster)}" alt="${escape(m.alt)}" width="1600" height="992" decoding="async">` : `<p class="map-fallback">${escape(m.alt)}</p>`;
  const credit = `<p class="map-credit">Map: license plate readers mapped on OpenStreetMap as of ${escape(apDate(String(inp.stats.snapshot!.value)))}, via DeFlock; Alaska and Hawaii are shown at different scales. Rates: U.S. Census Bureau 2024 estimates.</p>`;
  for (const id of ["deflock-tiles-2026", "census-pop-2024", "census-boundaries-2024"]) ctx.used.add(id);
  return `<section class="scrolly scrolly-map" id="${escape(m.id)}" data-scrolly="map" aria-label="Map of mapped license plate readers">
<div class="scrolly-graphic"><figure class="map" role="img" aria-label="${escape(m.alt)}">${poster}<canvas class="map-canvas" hidden></canvas><div class="map-labels" aria-hidden="true"></div><div class="map-legend" aria-hidden="true"></div></figure></div>
<div class="scrolly-steps">${steps}</div>
${credit}
</section>`;
}
