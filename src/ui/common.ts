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

/** Header: the current page is marked in the markup; Home and the brand on the home page scroll to the start without a
 *  reload; the Top button appears once scrolled and keeps a part hash (components/#som) in the address. */
export function initNav(): void {
  const nav = document.querySelector<HTMLElement>(".sections")!;
  const active = nav.querySelector<HTMLAnchorElement>("a.is-active");
  if (active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, active.offsetLeft - nav.clientWidth / 2 + active.offsetWidth / 2);
  const toTop = () => { scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); if (!location.hash || /^#(top|main|summary)$/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search); };
  if (ROOT === "./") for (const a of [nav.querySelector<HTMLAnchorElement>("a.home"), document.querySelector<HTMLAnchorElement>(".topbar .brand")]) a?.addEventListener("click", (e) => { e.preventDefault(); toTop(); });
  const totop = document.getElementById("totop") as HTMLAnchorElement;
  const onScroll = () => { totop.hidden = scrollY < 500; };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  totop.addEventListener("click", (e) => { e.preventDefault(); toTop(); });
}
