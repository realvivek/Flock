/** Home page: the summary card per page from overview.json and the two previews. (Replaced by the story.) */
import { overview } from "./content";
import { BASE } from "./lib/base";
import { escape } from "./lib/escape";
import { el } from "./ui/dom";
import { PAGES } from "./pages";

export async function initHome(): Promise<void> {
  const lede = document.getElementById("hero-lede"), srcs = document.getElementById("hero-sources");
  if (lede) lede.textContent = overview.intro.lede;
  if (srcs) srcs.textContent = overview.intro.sources;
  (document.getElementById("preview-img") as HTMLImageElement).src = `${BASE}img/knolling.jpg`;
  (document.getElementById("preview-journey-img") as HTMLImageElement).src = `${BASE}img/journey.jpg`;
  const host = document.getElementById("summary-cards")!;
  PAGES.forEach((pg, i) => {
    const sec = overview.sections.find((s) => s.id === pg.section);
    const a = el("a", "summary-card sheet");
    a.href = `${pg.id}/`;
    a.innerHTML = `<span class="n mono">${String(i + 1).padStart(2, "0")}</span><span class="t">${escape(sec?.title ?? pg.label)}</span><span class="b">${escape(sec?.blurb ?? "")}</span><span class="go mono">Open ${escape(pg.label)} →</span>`;
    host.appendChild(a);
  });
}
