/** DOM helpers every page shares: element builders, motion preference, header offset, table wrappers, the header and
 *  the Top button. Nothing here imports the site content, so the page shell stays small. */
import { ROOT } from "../lib/base";

export const nn = (o: number) => String(o).padStart(2, "0");

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Height of the fixed header in CSS pixels, from the --topbar-h token. */
export const topbarHeight = (): number => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 48;

/** Scroll an element into view under the fixed header. */
export function scrollToEl(target: Element | null, block: ScrollLogicalPosition = "start"): void {
  if (!target) return;
  target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block });
}

/** Tables wider than their container: a right-edge fade until scrolled to the end, and a hint above them on small screens. */
export function initTableWraps(root: ParentNode = document): void {
  for (const w of root.querySelectorAll<HTMLElement>(".tablewrap")) {
    if (w.dataset.wrapped) continue;
    w.dataset.wrapped = "1";
    const update = () => { const scrolls = w.scrollWidth > w.clientWidth + 1; w.classList.toggle("is-scroll", scrolls); w.classList.toggle("is-end", !scrolls || w.scrollLeft + w.clientWidth >= w.scrollWidth - 2); };
    w.addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    update();
    if (w.scrollWidth > w.clientWidth + 1 && matchMedia("(max-width: 800px)").matches && !w.previousElementSibling?.classList.contains("scroll-hint")) { const p = document.createElement("p"); p.className = "scroll-hint"; p.textContent = "Swipe sideways for more columns"; w.insertAdjacentElement("beforebegin", p); }
  }
}

/** Header: the current page is marked in the markup; Home and the brand on the home page scroll to the start without a
 *  reload; the Top button appears once scrolled and keeps a part hash (components/#som) in the address. On phones it
 *  steps aside while the reader scrolls down, so it never sits on the words being read. */
export function initNav(): void {
  const nav = document.querySelector<HTMLElement>(".sections")!;
  const toTop = () => { scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); if (!location.hash || /^#(top|main|summary)$/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search); };
  if (ROOT === "./") for (const a of [nav.querySelector<HTMLAnchorElement>("a.home"), document.querySelector<HTMLAnchorElement>(".topbar .brand")]) a?.addEventListener("click", (e) => { e.preventDefault(); toTop(); });
  const totop = document.getElementById("totop") as HTMLAnchorElement | null;
  if (!totop) return;
  const phone = matchMedia("(max-width: 800px)");
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY, down = y > lastY + 2; lastY = y;
    const nearEnd = y + innerHeight >= document.documentElement.scrollHeight - 200;
    totop.hidden = y < 500 || (phone.matches && down && !nearEnd);
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  totop.addEventListener("click", (e) => { e.preventDefault(); toTop(); });
}
