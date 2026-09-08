/** Helpers shared by the main page and the components page: element builders, stills, section navigation. */
import { stillById } from "../content";
import { cite, escape } from "./cite";
import { BASE, ROOT } from "../lib/base";
export { BASE, ROOT };

export const still = (id: string) => `${BASE}${stillById.get(id) ?? ""}`;
export const nn = (o: number) => String(o).padStart(2, "0");

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
export const p = (host: HTMLElement, text: string, cls = "") => { const e = el("p", cls); e.textContent = text; host.appendChild(e); return e; };
export const kv = (host: HTMLElement, rows: [string, string][]) => { const dl = el("dl", "kv"); for (const [k, v] of rows) dl.insertAdjacentHTML("beforeend", `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`); host.appendChild(dl); return dl; };
export const facts = (host: HTMLElement, rows: { k: string; v: string; sources: string[] }[]) => { const dl = el("dl", "kv"); for (const r of rows) { dl.insertAdjacentHTML("beforeend", `<dt>${escape(r.k)}</dt><dd>${escape(r.v)}</dd>`); dl.lastElementChild!.appendChild(cite(r.sources, 1)); } host.appendChild(dl); };

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Scroll an element into view under the sticky header. */
export function scrollToEl(target: Element | null, block: ScrollLogicalPosition = "start"): void {
  if (!target) return;
  target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block });
}

/** Section links in the header mark the section in view (when the page has sections); the Top button appears once scrolled. */
export function initNav(): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".sections a"));
  const secs = Array.from(document.querySelectorAll<HTMLElement>("section.sec"));
  const nav = document.querySelector<HTMLElement>(".sections")!;
  const fixed = links.find((a) => a.classList.contains("is-fixed"));
  let current = "";
  const mark = (id: string) => {
    if (id === current) return;
    current = id;
    if (!fixed) for (const a of links) a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`);
    const a = fixed ?? links.find((l) => l.getAttribute("href") === `#${id}`);
    if (a && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2);
  };
  if (secs.length && !fixed) {
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const top = visible[0]?.target as HTMLElement | undefined;
      if (top) mark(top.id);
    }, { rootMargin: "-20% 0px -65% 0px", threshold: 0 });
    secs.forEach((s) => io.observe(s));
  }
  if (fixed) mark(fixed.getAttribute("href")!.slice(1));
  const totop = document.getElementById("totop") as HTMLAnchorElement;
  const onScroll = () => { totop.hidden = scrollY < 500; if (scrollY < 200 && !fixed) mark(""); };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  totop.addEventListener("click", (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); history.replaceState(null, "", location.pathname + location.search); });
}
