/** Minimal reactive store shared between the document, the 3D locator and the tests. */

export type Tier = "low" | "mid" | "high";

export interface State {
  /** Selected component (knolling cell), or null */
  focusedPart: string | null;
  /** Explode stage of the locator, 0 (assembled) to 5 (all parts) */
  explodeStage: number;
  /** A camera or stage tween is in flight in the locator */
  tweening: boolean;
  retentionIndex: number;
  deputyReason: string | null;
  tier: Tier;
  reducedMotion: boolean;
  /** "3d" when the locator renders, "stills" otherwise */
  mode: "3d" | "stills";
  ready: boolean;
}

type Listener = (s: State, changed: Set<keyof State>) => void;

export const state: State = {
  focusedPart: null,
  explodeStage: 0,
  tweening: false,
  retentionIndex: 0,
  deputyReason: null,
  tier: "mid",
  reducedMotion: false,
  mode: "stills",
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
    if (state[k] !== v) { (state as unknown as Record<string, unknown>)[k] = v; changed.add(k); }
  }
  if (changed.size) for (const fn of listeners) fn(state, changed);
}
