/**
 * The home page story as HTML, rendered at build time (vite.config.ts) from src/content/story.json and the built data,
 * so the text, figures, tables and links are in the page before any script runs. The client (./home.ts) adds the
 * map, the county search and tooltips. Pure functions: no DOM, no file access.
 */
import { escape } from "../lib/escape.ts";
import { apDate, int } from "../viz/format.ts";
import { inline, type Ctx } from "./frame.ts";
import type { StoryInput } from "./types.ts";
import { statesFigure, lookupFigure } from "./fig/places.ts";
import { readFigure } from "./fig/read.ts";
import { rulerFigure } from "./fig/ruler.ts";
import { auditFigure, type Deputy } from "./fig/searches.ts";
import { oaklandFigure, ladderFigure } from "./fig/outcomes.ts";
import { errorsFigure } from "./fig/errors.ts";
import { operatorsFigure } from "./fig/makers.ts";
import { priceFigure, contractsFigure } from "./fig/money.ts";
import { timelineFigure } from "./fig/timeline.ts";
import { completenessFigure } from "./fig/methods.ts";
import { evidenceFigure } from "./fig/evidence.ts";

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
      case "evidence": return evidenceFigure(cfg(id), ctx);
      case "errors": return errorsFigure(cfg(id), ctx);
      case "operators": return operatorsFigure(cfg(id), ctx, inp.operators);
      case "price": return priceFigure(cfg(id), ctx);
      case "contracts": return contractsFigure(cfg(id), ctx);
      case "timeline": return timelineFigure(cfg(id), ctx, inp.timeline, inp.timelineRule);
      case "completeness": return completenessFigure(cfg(id), ctx, inp.completeness);
      default: throw new Error(`story: unknown figure ${id}`);
    }
  };
  // 4:3 images of whole tiles with no small print; the journey has its own phone image with larger type
  const preview = (k: "components" | "journey") => k === "components"
    ? `<a class="preview" href="components/" id="preview"><img id="preview-img" src="img/knolling.jpg" alt="Six of the camera’s fourteen components, each rendered on its own tile: the front bezel, the infrared illuminator board, the infrared-cut filter, the camera module, the system on module and the GPS antenna" loading="lazy" decoding="async" width="1120" height="840"><span class="cap"><span class="kicker">Inside the camera</span><span class="t">Fourteen components in five groups, from the bezel to the clamps</span><span class="go">See the components</span></span></a>`
    : `<a class="preview" href="journey/" id="preview-journey"><picture><source media="(max-width: 640px)" srcset="img/journey-phone.jpg" width="1120" height="840"><img id="preview-journey-img" src="img/journey.jpg" alt="The first stops of one photograph’s journey, tracked like a parcel: picked up on the pole, in transit on the carrier network, arrived at Amazon’s cloud" loading="lazy" decoding="async" width="1120" height="840"></picture><span class="cap"><span class="kicker">The journey</span><span class="t">One photograph followed through seven stops, from the pole to deletion</span><span class="go">Follow the picture</span></span></a>`;
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
  // Without JavaScript the poster stands in for the map; with it, the alt text holds the space until the dots draw.
  const poster = `<p class="map-fallback">${escape(m.alt)}</p>${inp.poster ? `<noscript><img class="map-poster" src="${escape(inp.poster)}" alt="${escape(m.alt)}" width="1600" height="992"></noscript>` : ""}`;
  // The credit sits inside the sticky graphic, so it is on screen with every step of the map.
  const off = Number(inp.meta.cameras.offMap), offFlock = Number(inp.meta.cameras.offMapFlock);
  // the population line shows only on the steps that use population (the script hides it on the others)
  const credit = `<p class="map-credit">Map: license plate readers on OpenStreetMap as of ${escape(apDate(String(inp.stats.snapshot!.value)))}, via DeFlock. It shows the 50 states and D.C., with Alaska and Hawaii at different scales; ${escape(int(off))} readers elsewhere, ${escape(int(offFlock))} of them Flock’s, most in Puerto Rico, are not shown.<span class="cr-rates"> Rates: U.S. Census Bureau 2024 population estimates.</span></p>`;
  for (const id of ["deflock-tiles-2026", "census-pop-2024", "census-boundaries-2024"]) ctx.used.add(id);
  return `<section class="scrolly scrolly-map" id="${escape(m.id)}" data-scrolly="map" aria-label="Map of mapped license plate readers">
<div class="scrolly-graphic"><figure class="map" role="img" aria-label="${escape(m.alt)}">${poster}<canvas class="map-canvas" hidden></canvas><div class="map-labels" aria-hidden="true"></div><div class="map-legend" aria-hidden="true"></div></figure>${credit}</div>
<div class="scrolly-steps">${steps}</div>
</section>`;
}
