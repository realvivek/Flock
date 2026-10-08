/**
 * Entry for every page: the header, the pager, the Top button and table wrappers, then the page's own code, loaded on
 * demand from `<body data-page>` so each page downloads only what it draws. The store's `ready` flag is set once the
 * page has built its content, including anything it fetches.
 */
import "./document.css";
import { ROOT, PAGE } from "./lib/base";
import { escape } from "./lib/escape";
import { initNav, initTableWraps, scrollToEl } from "./ui/dom";
import { PAGES, pageFor } from "./pages";
import { state, set } from "./store";

/** Previous and next page links under the content. */
function buildPager(host: HTMLElement): void {
  const i = PAGES.findIndex((p) => p.id === PAGE);
  if (i < 0) return;
  const prev = PAGES[i - 1], next = PAGES[i + 1];
  host.innerHTML = `${prev ? `<a class="prev" href="${ROOT}${prev.id}/"><span class="k">Previous</span>${escape(prev.label)}</a>` : `<a class="prev" href="${ROOT}"><span class="k">Previous</span>Home</a>`}<a class="up" href="${ROOT}">Home</a>${next ? `<a class="next" href="${ROOT}${next.id}/"><span class="k">Next</span>${escape(next.label)}</a>` : `<span class="next end"><span class="k">End</span>Last page</span>`}`;
}

/** Older links (#act-N, #/hardware/inside/13, #deployments, #pole, #s=data/9, ?s=…, #src-<id>, #claim-<id>) go to the
 *  page or section they named. Anchors that exist on the home page (the story's sections) stay where they are.
 *  Resolves true when the page is being replaced. */
async function redirectLegacy(): Promise<boolean> {
  const h = location.hash;
  const q = new URLSearchParams(location.search).get("s");
  if (!h && !q) return false;
  const plain = decodeURIComponent(h.slice(1));
  if (plain && document.getElementById(plain)) return false;
  const go = (to: string) => { location.replace(to); return true; };
  if (PAGES.some((p) => p.id === plain)) return go(`${plain}/`);
  if (plain === "pole" || plain === "power") return go(`components/#${plain}`);
  if (plain.startsWith("src-")) return go(`sources/${h}`);
  if (plain.startsWith("claim-")) return go(`claims/${h}`);
  if (plain.startsWith("stage-")) return go(`data/${h}`);
  const { parseRoute, chapterFor } = await import("./router");
  const r = parseRoute(h, location.search);
  const ch = chapterFor(r);
  if (ch === "overview") { if (plain !== "top" && plain !== "summary" && plain !== "main") history.replaceState(null, "", location.pathname); return false; }
  let page = pageFor(ch) ?? ch;
  let tail = "";
  if (ch === "pole" || ch === "power") { page = "components"; tail = `#${ch}`; }
  if (page === "components" && r.index !== undefined && r.index >= 6) {
    const { components } = await import("./content");
    const pt = components.parts.slice().sort((a, b) => a.order - b.order)[r.index - 6];
    tail = pt ? `#${pt.id}` : "";
  }
  if (page === "data" && r.index !== undefined) { const { dataStageIds } = await import("./sections"); tail = `#${dataStageIds()[Math.max(0, Math.min(11, r.index))]}`; }
  if (r.anchor && page !== "components") tail = `#${r.anchor}`;
  return go(`${page}/${tail}`);
}

const body = () => document.getElementById("page-body")!;

/** Each page's builder; components sets `ready` itself once its locator has decided between 3D and stills. */
const BUILD: Record<string, () => Promise<void>> = {
  home: async () => { await (await import("./story/home")).initHome(); },
  deployments: async () => { await (await import("./ui/article")).renderDeployments(body()); },
  components: async () => {
    const [page, sections] = await Promise.all([import("./components-page"), import("./sections")]);
    page.initComponentsPage();
    sections.buildPole(document.getElementById("pole-body")!);
    sections.buildPower(document.getElementById("power-body")!);
  },
  data: async () => { (await import("./sections")).buildData(body()); },
  journey: async () => { (await import("./journey")).buildJourney(body()); },
  outcomes: async () => { await (await import("./outcomes")).buildOutcomes(body()); },
  claims: async () => { (await import("./ui/article")).renderClaims(body(), { onPart: (id) => { location.href = `${ROOT}components/#${id}`; }, onHop: (n) => { location.href = `${ROOT}data/#stage-${n}`; } }); },
  economics: async () => { (await import("./ui/article")).renderEconomics(body()); },
  sources: async () => {
    const { renderSources, revealSource } = await import("./ui/article");
    renderSources(body());
    // A citation link on this page is an in-page anchor: mark the row it lands on.
    const reveal = (behavior: ScrollBehavior) => { if (location.hash.startsWith("#src-")) revealSource(location.hash.slice(5), behavior); };
    addEventListener("hashchange", () => reveal("smooth"));
    requestAnimationFrame(() => reveal("auto"));
  },
};

async function init(): Promise<void> {
  set({ reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
  if (PAGE !== "components") (window as unknown as { __flock: unknown }).__flock = { state, set, get frame() { return Math.floor(performance.now() / 16); } };
  const pager = document.getElementById("pager");
  if (pager) buildPager(pager);
  initNav();
  if (PAGE === "home" && (await redirectLegacy())) return;
  await BUILD[PAGE]?.();
  if (PAGE === "claims" || PAGE === "data") { const t = location.hash && document.getElementById(location.hash.slice(1)); if (t) requestAnimationFrame(() => scrollToEl(t, "start")); }
  if (PAGE !== "outcomes") initTableWraps();
  if (PAGE !== "components") set({ ready: true, mode: "stills" });
}

void init();
