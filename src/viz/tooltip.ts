/**
 * One tooltip for every chart on a page. Any element with `data-tip` (the value) and `data-tip-label` (what it is)
 * shows it on pointer hover and on keyboard focus; the value leads, the label follows. Text is set with textContent.
 */
let tipEl: HTMLDivElement | null = null;
let current: Element | null = null;

function ensure(): HTMLDivElement {
  if (tipEl) return tipEl;
  tipEl = document.createElement("div");
  tipEl.className = "tip";
  tipEl.setAttribute("role", "tooltip");
  tipEl.innerHTML = "<strong></strong><span></span>";
  document.body.appendChild(tipEl);
  return tipEl;
}

function show(target: Element, x: number, y: number): void {
  const t = ensure();
  if (current !== target) {
    current?.classList.remove("is-hot");
    current = target;
    target.classList.add("is-hot");
    t.querySelector("strong")!.textContent = target.getAttribute("data-tip") ?? "";
    t.querySelector("span")!.textContent = target.getAttribute("data-tip-label") ?? "";
  }
  t.classList.add("is-on");
  const r = t.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > innerHeight - 8) top = y - r.height - 14;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${Math.max(8, top)}px`;
}
function hide(): void {
  current?.classList.remove("is-hot");
  current = null;
  tipEl?.classList.remove("is-on");
}

/** Wire every `[data-tip]` under `root` (and any added later) to the shared tooltip. */
export function initTooltips(root: ParentNode = document): void {
  const host = root as HTMLElement | Document;
  host.addEventListener("pointermove", (e) => {
    const ev = e as PointerEvent;
    if (ev.pointerType === "touch") return;
    const t = (ev.target as Element | null)?.closest?.("[data-tip]");
    if (t) show(t, ev.clientX, ev.clientY); else if (current) hide();
  }, { passive: true });
  host.addEventListener("pointerleave", hide, { passive: true } as AddEventListenerOptions);
  host.addEventListener("pointerdown", (e) => {
    // a tap on a mark shows its tooltip; a tap elsewhere hides it
    const ev = e as PointerEvent;
    const t = (ev.target as Element | null)?.closest?.("[data-tip]");
    if (t && ev.pointerType === "touch") show(t, ev.clientX, ev.clientY - 40); else if (!t) hide();
  }, { passive: true });
  host.addEventListener("focusin", (e) => {
    const t = (e.target as Element | null)?.closest?.("[data-tip]");
    if (!t) return;
    const r = t.getBoundingClientRect();
    show(t, r.left + r.width / 2, r.top + r.height / 2);
  });
  host.addEventListener("focusout", hide);
  addEventListener("scroll", () => { if (current && !(document.activeElement && current.contains(document.activeElement))) hide(); }, { passive: true });
  addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
}
