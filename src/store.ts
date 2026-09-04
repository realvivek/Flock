/** Minimal reactive store shared between the scroll layer, the 3D scene and the HTML overlays. */

export type PoleMode = "flock" | "existing" | "ac";
export type PathMode = "solar" | "ac" | "wing";
export type Tier = "low" | "mid" | "high";

export interface State {
  /** Global scroll progress across all acts, 0..1 */
  progress: number;
  /** Current act index */
  act: number;
  /** Progress inside the current act, 0..1 */
  actProgress: number;
  /** Per-act progress, each 0..1 (acts before are 1, after are 0) */
  acts: number[];
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

/** Called by the scroll layer with each act's raw progress; derives the global values. */
export function setActProgress(index: number, p: number): void {
  const acts = state.acts.slice();
  acts[index] = p;
  let act = 0;
  for (let i = 0; i < ACT_COUNT; i++) if ((acts[i] ?? 0) > 0) act = i;
  const actProgress = acts[act] ?? 0;
  const progress = (act + actProgress) / ACT_COUNT;
  set({ acts, act, actProgress, progress });
}

export { ACT_COUNT };
