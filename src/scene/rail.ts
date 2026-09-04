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
