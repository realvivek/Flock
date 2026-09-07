import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { smooth, lerp } from "../lib/math";
import rail from "../content/animation.json";

export interface RailKey { t: number; pos: [number, number, number]; target: [number, number, number]; fov: number; ease?: "smooth" | "linear"; frame?: "world" | "falcon" }

const keys = (rail.camera as RailKey[]).slice().sort((a, b) => a.t - b.t);

import type { Matrix } from "@babylonjs/core/Maths/math.vector";

const tmpA = new Vector3();
const tmpB = new Vector3();
function toWorld(v: [number, number, number], frame: RailKey["frame"], falconWorld: Matrix | null, out: Vector3): Vector3 {
  out.set(v[0], v[1], v[2]);
  if (frame === "falcon" && falconWorld) Vector3.TransformCoordinatesToRef(out, falconWorld, out);
  return out;
}

/** Evaluate the camera rail at global progress t. Keys may be in world space or in the Falcon's local frame
 *  (x right, y up, z toward the lens), in which case falconWorld converts them so framing survives re-aiming. */
export function evalRail(t: number, out: { pos: Vector3; target: Vector3; fov: number }, falconWorld: Matrix | null = null): void {
  if (keys.length === 0) return;
  let i = 0;
  while (i < keys.length - 1 && (keys[i + 1] as RailKey).t <= t) i++;
  const a = keys[i] as RailKey;
  const b = keys[Math.min(i + 1, keys.length - 1)] as RailKey;
  const span = b.t - a.t;
  let u = span > 0 ? (t - a.t) / span : 0;
  u = b.ease === "linear" ? u : smooth(u);
  const pa = toWorld(a.pos, a.frame, falconWorld, tmpA);
  const pb = toWorld(b.pos, b.frame, falconWorld, tmpB);
  out.pos.set(lerp(pa.x, pb.x, u), lerp(pa.y, pb.y, u), lerp(pa.z, pb.z, u));
  const ta = toWorld(a.target, a.frame, falconWorld, tmpA);
  const tb = toWorld(b.target, b.frame, falconWorld, tmpB);
  out.target.set(lerp(ta.x, tb.x, u), lerp(ta.y, tb.y, u), lerp(ta.z, tb.z, u));
  out.fov = lerp(a.fov, b.fov, u) * (Math.PI / 180);
}

export interface Pose { pos: Vector3; target: Vector3; fov: number }

/** Rail t for a view state. The values live in animation.json "views" so they can be tuned without code. */
export function railTFor(s: { act: number; explodeStage: number; dataStage: number; poleView: "mount" | "fov"; cutaway?: boolean }): number {
  const v = rail.views;
  switch (s.act) {
    case 1: return s.poleView === "fov" ? v.poleFov : v.pole;
    case 2: return s.cutaway ? v.cutaway : lerp(v.inside[0]!, v.inside[1]!, s.explodeStage / 5);
    case 3: return v.power;
    case 4: return lerp(v.data[0]!, v.data[1]!, (s.dataStage - 1) / 11);
    default: return v.overview;
  }
}

const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);

/** Eased move between camera poses. `from` is a snapshot at retarget time; the destination is re-evaluated
 *  every frame by the caller so falcon-frame keys keep following the aim once the move has settled. */
export class PoseTween {
  private from: Pose = { pos: new Vector3(), target: new Vector3(), fov: 0.7 };
  private start = 0;
  private dur = 600;
  private started = false;
  retarget(current: Pose, now: number, reduced: boolean): void {
    this.from.pos.copyFrom(current.pos); this.from.target.copyFrom(current.target); this.from.fov = current.fov;
    this.start = now;
    this.dur = reduced || !this.started ? 0 : 600;
    this.started = true;
  }
  /** Writes the blended pose into `out`; returns true while still moving. */
  mix(dest: Pose, now: number, out: Pose): boolean {
    const u = this.dur <= 0 ? 1 : Math.min(1, (now - this.start) / this.dur);
    const k = easeOutCubic(u);
    out.pos.set(lerp(this.from.pos.x, dest.pos.x, k), lerp(this.from.pos.y, dest.pos.y, k), lerp(this.from.pos.z, dest.pos.z, k));
    out.target.set(lerp(this.from.target.x, dest.target.x, k), lerp(this.from.target.y, dest.target.y, k), lerp(this.from.target.z, dest.target.z, k));
    out.fov = lerp(this.from.fov, dest.fov, k);
    return u < 1;
  }
}
