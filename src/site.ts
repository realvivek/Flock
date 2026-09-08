/**
 * Entry for every page. The page id in `<body data-page>` picks what to build: the home page (hero, preview and a
 * summary card per page), one of the content pages, or the components page with its grid and locator.
 * Every page shares the header links, the pager at the bottom, the Top button and the citation handling.
 */
import "./document.css";
import { overview, components } from "./content";
import { setCiteHandler } from "./ui/cite";
import { renderClaims, renderEconomics, renderSources, renderDeployments, revealSource } from "./ui/article";
import { BASE, ROOT, PAGE } from "./lib/base";
import { el, initNav, scrollToEl } from "./ui/common";
import { buildPole, buildPower, buildData, dataStageIds } from "./sections";
import { initComponentsPage } from "./components-page";
import { parseRoute, chapterFor } from "./router";
import { state, set } from "./store";
import { escape } from "./ui/cite";

/** Pages in reading order, with the overview section that describes each. */
export const PAGES: { id: string; label: string; section: string }[] = [
  { id: "deployments", label: "Deployments", section: "deployments" },
  { id: "components", label: "Components", section: "inside" },
  { id: "pole", label: "Pole", section: "pole" },
  { id: "power", label: "Power", section: "power" },
  { id: "data", label: "Data", section: "data" },
  { id: "claims", label: "Claims", section: "myths" },
  { id: "economics", label: "Economics", section: "economics" },
  { id: "sources", label: "Sources", section: "sources" },
];
const pageFor = (section: string) => PAGES.find((p) => p.section === section)?.id;

/** Previous and next page links under the content. */
function buildPager(host: HTMLElement): void {
  const i = PAGES.findIndex((p) => p.id === PAGE);
  if (i < 0) return;
  const prev = PAGES[i - 1], next = PAGES[i + 1];
  host.innerHTML = `${prev ? `<a class="prev" href="${ROOT}${prev.id}/"><span class="mono">Previous</span>${escape(prev.label)}</a>` : `<a class="prev" href="${ROOT}"><span class="mono">Previous</span>Home</a>`}<a class="up" href="${ROOT}">Home</a>${next ? `<a class="next" href="${ROOT}${next.id}/"><span class="mono">Next</span>${escape(next.label)}</a>` : `<span class="next end"><span class="mono">End</span>Last page</span>`}`;
}

/** Home: lede, preview and one summary card per page from overview.json. */
function buildHome(): void {
  document.getElementById("hero-lede")!.textContent = overview.intro.lede;
  document.getElementById("hero-sources")!.textContent = overview.intro.sources;
  (document.getElementById("preview-img") as HTMLImageElement).src = `${BASE}img/knolling.jpg`;
  const host = document.getElementById("summary-cards")!;
  PAGES.forEach((pg, i) => {
    const sec = overview.sections.find((s) => s.id === pg.section);
    const a = el("a", "summary-card sheet");
    a.href = `${pg.id}/`;
    a.innerHTML = `<span class="n mono">${String(i + 1).padStart(2, "0")}</span><span class="t">${escape(sec?.title ?? pg.label)}</span><span class="b">${escape(sec?.blurb ?? "")}</span><span class="go mono">Open ${escape(pg.label)} →</span>`;
    host.appendChild(a);
  });
}

/** Older single-page links (#act-N, #/hardware/inside/13, #deployments, #s=data/9, ?s=…, #src-<id>, #claim-<id>) go to the page they named. */
function redirectLegacy(): void {
  const h = location.hash;
  const q = new URLSearchParams(location.search).get("s");
  if (!h && !q) return;
  const plain = h.slice(1);
  if (PAGES.some((p) => p.id === plain)) { location.replace(`${plain}/`); return; }
  if (plain.startsWith("src-")) { location.replace(`sources/${h}`); return; }
  if (plain.startsWith("claim-")) { location.replace(`claims/${h}`); return; }
  if (plain.startsWith("stage-")) { location.replace(`data/${h}`); return; }
  const r = parseRoute(h, location.search);
  const ch = chapterFor(r);
  if (ch === "overview") { if (plain !== "top" && plain !== "summary" && plain !== "main") history.replaceState(null, "", location.pathname); return; }
  const page = pageFor(ch) ?? ch;
  let tail = "";
  if (page === "components" && r.index !== undefined && r.index >= 6) { const pt = components.parts.slice().sort((a, b) => a.order - b.order)[r.index - 6]; tail = pt ? `#${pt.id}` : ""; }
  if (page === "data" && r.index !== undefined) tail = `#${dataStageIds()[Math.max(0, Math.min(11, r.index))]}`;
  if (r.anchor) tail = `#${r.anchor}`;
  location.replace(`${page}/${tail}`);
}

function init(): void {
  const body = document.getElementById("page-body");
  switch (PAGE) {
    case "home": buildHome(); redirectLegacy(); break;
    case "deployments": renderDeployments(body!); break;
    case "components": initComponentsPage(); break;
    case "pole": buildPole(body!); break;
    case "power": buildPower(body!); break;
    case "data": buildData(body!); break;
    case "claims": renderClaims(body!, { onPart: (id) => { location.href = `${ROOT}components/#${id}`; }, onHop: (n) => { location.href = `${ROOT}data/#stage-${n}`; } }); break;
    case "economics": renderEconomics(body!); break;
    case "sources": renderSources(body!); break;
  }
  // Citation chips: reveal the row on the Sources page, otherwise go there.
  if (PAGE === "sources") {
    setCiteHandler((id) => revealSource(id));
    const reveal = () => { if (location.hash.startsWith("#src-")) revealSource(location.hash.slice(5), "auto"); };
    addEventListener("hashchange", reveal);
    requestAnimationFrame(reveal);
  } else setCiteHandler((id) => { location.href = `${ROOT}sources/#src-${id}`; });
  if (PAGE === "claims" || PAGE === "data") { const t = location.hash && document.getElementById(location.hash.slice(1)); if (t) requestAnimationFrame(() => scrollToEl(t, "start")); }
  const pager = document.getElementById("pager");
  if (pager) buildPager(pager);
  initNav();
  set({ reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
  if (PAGE !== "components") { set({ ready: true, mode: "stills" }); (window as unknown as { __flock: unknown }).__flock = { state, set, get frame() { return Math.floor(performance.now() / 16); } }; }
}

init();
