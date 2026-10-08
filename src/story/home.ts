/**
 * Home page behaviour on top of the story already in the page: the opening map and its steps, the county search and
 * the chart tooltips. The page is complete without it; `ready` is set once the map has drawn (or failed to load).
 */
import { initTooltips } from "../viz/tooltip";
import { scrolly } from "../viz/scrolly";
import { createMap } from "./map";
import { initLookup } from "./lookup";
import { set, state } from "../store";

export async function initHome(): Promise<void> {
  initTooltips(document);
  const busy = (d: number) => set({ busy: state.busy + d });
  const tween = (d: number) => set({ tweens: state.tweens + d });
  const lookup = document.querySelector<HTMLElement>(".lookup");
  if (lookup) initLookup(lookup, busy);
  const sec = document.querySelector<HTMLElement>(".scrolly-map");
  if (!sec) return;
  const map = createMap(sec.querySelector<HTMLElement>(".map")!, { busy, tween });
  const ids = [...sec.querySelectorAll<HTMLElement>(".step")].map((s) => s.dataset.step!);
  scrolly(sec, (i) => { set({ step: `map:${ids[i]}` }); map.go(ids[i]!); });
  await map.ready.catch((e: unknown) => { console.warn("map:", e); });
}
