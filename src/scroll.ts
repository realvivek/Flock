import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ACT_COUNT, setActProgress, set, state } from "./store";

gsap.registerPlugin(ScrollTrigger);

/** One ScrollTrigger per act section. Progress is scrubbed by native scroll; nothing autoplays. */
export function wireScroll(): void {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  set({ reducedMotion: reduced });

  const sections = Array.from(document.querySelectorAll<HTMLElement>("section.act"));
  sections.forEach((el, i) => {
    ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        // In reduced-motion mode snap to quarter steps so nothing scrubs continuously.
        const p = reduced ? Math.round(self.progress * 4) / 4 : self.progress;
        setActProgress(i, p);
      },
    });
  });

  // Nav highlight
  const nav = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-nav]"));
  let last = -1;
  const tick = () => {
    if (state.act !== last) {
      last = state.act;
      nav.forEach((a) => a.classList.toggle("is-active", Number(a.dataset.nav) === last));
    }
    requestAnimationFrame(tick);
  };
  tick();

  addEventListener("resize", () => ScrollTrigger.refresh());
  if (ACT_COUNT !== sections.length) console.warn(`Expected ${ACT_COUNT} acts, found ${sections.length}`);
}
