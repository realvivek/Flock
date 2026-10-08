/**
 * Scroll-driven steps. A step is active once its card has risen past a line in the viewport (lower on phones, where
 * the cards ride under the graphic). The callback receives the index of the active step every time it changes, in
 * either direction, so each step can declare its whole target state and a fast scroll or a jump lands correctly.
 */
export interface Scrolly { destroy(): void; current(): number }

export function scrolly(section: HTMLElement, onStep: (i: number, prev: number) => void): Scrolly {
  const steps = [...section.querySelectorAll<HTMLElement>(".step")];
  const cards = steps.map((s) => s.querySelector<HTMLElement>(".step-card") ?? s);
  let cur = -1, raf = 0;
  const line = () => innerHeight * (matchMedia("(max-width: 760px)").matches ? 0.8 : 0.72);
  const measure = () => {
    raf = 0;
    const y = line();
    let i = 0;
    for (let k = 0; k < cards.length; k++) if (cards[k]!.getBoundingClientRect().top < y) i = k;
    if (i !== cur) { const prev = cur; cur = i; for (const [k, s] of steps.entries()) s.classList.toggle("is-active", k === i); onStep(i, prev); }
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  measure();
  return { destroy() { removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); }, current: () => cur };
}
