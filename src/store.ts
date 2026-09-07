/** Minimal reactive store shared between the router, the 3D scene and the HTML overlays. */

import type { Tab, Sub } from "./router";

export type PoleMode = "flock" | "existing" | "ac";
export type PathMode = "solar" | "ac" | "wing";
export type Tier = "low" | "mid" | "high";

export interface State {
  /** Camera rail position, 0..1; the target pose for the current view (kept for tooling). */
  progress: number;
  /** Act index derived from the route: 0 overview, 1 pole, 2 inside, 3 power, 4 data, 5 claims, 6 economics, 7 sources, -1 deployments */
  act: number;
  actProgress: number;
  /** Per-act values the scene reads: acts[2] explode amount, acts[4] data-journey progress, acts[0] sedan, acts[1]/acts[3] active flags */
  acts: number[];
  tab: Tab;
  sub: Sub;
  /** Exploded view stage, 0 (assembled) to 5 (all parts) */
  explodeStage: number;
  /** Data journey stage, 1 to 12 */
  dataStage: number;
  /** Pole tab camera: the mount close-up or the aerial field-of-view shot */
  poleView: "mount" | "fov";
  /** Inside tab: assembled camera with a translucent shell instead of the explosion */
  /** Part under the pointer in the exploded view (badge, halo or legend row) */
  hoverPart: string | null;
  /** A camera or stage tween is in flight */
  tweening: boolean;
  focusedPart: string | null;
  poleMode: PoleMode;
  pathMode: PathMode;
  aimYaw: number;
  aimPitch: number;
  retentionIndex: number;
  deputyReason: string | null;
  tier: Tier;
  reducedMotion: boolean;
  ready: boolean;
}

type Listener = (s: State, changed: Set<keyof State>) => void;

const ACT_COUNT = 8;

export const state: State = {
  progress: 0,
  act: 0,
  actProgress: 0,
  acts: new Array(ACT_COUNT).fill(0),
  tab: "overview",
  sub: "pole",
  explodeStage: 0,
  dataStage: 1,
  poleView: "mount",
  hoverPart: null,
  tweening: false,
  focusedPart: null,
  poleMode: "flock",
  pathMode: "solar",
  aimYaw: 0,
  aimPitch: -8,
  retentionIndex: 0,
  deputyReason: null,
  tier: "mid",
  reducedMotion: false,
  ready: false,
};

const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function set(patch: Partial<State>): void {
  const changed = new Set<keyof State>();
  for (const k of Object.keys(patch) as (keyof State)[]) {
    const v = patch[k];
    if (k === "acts") {
      changed.add(k);
      state.acts = v as number[];
      continue;
    }
    if (state[k] !== v) {
      (state as unknown as Record<string, unknown>)[k] = v;
      changed.add(k);
    }
  }
  if (changed.size) for (const l of listeners) l(state, changed);
}

export const ACT_FOR: Record<string, number> = { overview: 0, "hardware/pole": 1, "hardware/inside": 2, "hardware/power": 3, data: 4, claims: 5, economics: 6, sources: 7, deployments: -1 };

/** Route → act. acts[] keeps its meaning for the scene readers; acts[2] and acts[4] are tweened per frame by desktop.ts. */
export function setView(tab: Tab, sub: Sub): void {
  const act = ACT_FOR[tab === "hardware" ? `hardware/${sub}` : tab] ?? -1;
  const acts = state.acts.slice();
  acts[0] = tab === "overview" ? 0.5 : 1;
  acts[1] = act === 1 ? 1 : 0;
  acts[3] = act === 3 ? 1 : 0;
  set({ tab, sub, act, acts, actProgress: 0 });
}

/** Per-frame writer for tweened act values. No listeners fire: every reader polls state.acts in a render observer. */
export function driveAct(i: number, v: number): void { state.acts[i] = v; }

export { ACT_COUNT };
