import "@babylonjs/core/Meshes/thinInstanceMesh";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TrailMesh } from "@babylonjs/core/Meshes/trailMesh";
import { Curve3 } from "@babylonjs/core/Maths/math.path";
import type { World } from "./world";
import anim from "../content/animation.json";
import { clamp01, smooth, window01, lerp } from "../lib/math";

const NETWORKS = 6809;

export interface DataViz {
  packet: Mesh;
  cloud: Vector3;
  phone: Vector3;
  setPacketProgress(p4: number, falconWorld: Vector3): void;
  setFanout(amount: number): void;
  setTrail(days: number, evidence: boolean): void;
  setVisible(on: boolean): void;
}

function glow(scene: World["scene"], name: string, color: Color3, alpha = 1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.emissiveColor = color;
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.disableLighting = true;
  m.alpha = alpha;
  return m;
}

/** 3D companions to the data act: a travelling packet with a trail, the AWS "cloud" markers, the officer's phone,
 *  a 6,809-node network field that lights up on a search, and the retention trail along the road. */
export function createDataViz(world: World): DataViz {
  const { scene } = world;
  const cyan = new Color3(0.31, 0.82, 0.9);
  const amber = new Color3(0.95, 0.7, 0.25);

  const packet = MeshBuilder.CreateSphere("packet", { diameter: 0.12, segments: 12 }, scene);
  packet.material = glow(scene, "packetMat", cyan);
  packet.isPickable = false;
  const trail = new TrailMesh("packetTrail", packet, scene, 0.03, 24, true);
  let lastPacketPos = new Vector3(NaN, NaN, NaN);
  trail.material = glow(scene, "trailMat", cyan, 0.55);
  trail.isPickable = false;

  const cloud = new Vector3(...(anim.cloud as [number, number, number]));
  const phone = new Vector3(...(anim.phone as [number, number, number]));

  // Cloud: three translucent slabs for object storage, relational and NoSQL stores.
  const cloudMat = glow(scene, "cloudMat", cyan, 0.16);
  const cloudNodes: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const b = MeshBuilder.CreateBox(`cloud${i}`, { width: 0.9, height: 0.55, depth: 0.5 }, scene);
    b.position = cloud.add(new Vector3((i - 1) * 1.15, 0, 0));
    b.material = cloudMat;
    b.isPickable = false;
    cloudNodes.push(b);
  }
  const phoneMesh = MeshBuilder.CreateBox("phone", { width: 0.08, height: 0.16, depth: 0.012 }, scene);
  phoneMesh.position = phone;
  phoneMesh.rotation.y = -0.6;
  phoneMesh.material = glow(scene, "phoneMat", new Color3(0.9, 0.93, 1.0), 0.9);
  phoneMesh.isPickable = false;

  // Packet path: falcon -> arc up to the cloud -> arc down to the phone.
  let path: Vector3[] = [];
  let lastStart = new Vector3(NaN, NaN, NaN);
  const rebuildPath = (start: Vector3) => {
    if (Vector3.Distance(start, lastStart) < 0.01) return;
    lastStart = start.clone();
    const up = new Vector3(start.x + 1.0, start.y + 4.5, start.z - 1.5);
    const c1 = Curve3.CreateCatmullRomSpline([start, up, cloud.add(new Vector3(-1.2, 0.6, 0)), cloud], 24, false);
    const c2 = Curve3.CreateCatmullRomSpline([cloud, cloud.add(new Vector3(2.2, -1.0, -0.5)), phone.add(new Vector3(0.4, 1.5, 0.3)), phone], 24, false);
    path = [...c1.getPoints(), ...c2.getPoints()];
  };
  const sample = (u: number): Vector3 => {
    const i = clamp01(u) * (path.length - 1);
    const a = path[Math.floor(i)]!, b = path[Math.min(path.length - 1, Math.ceil(i))]!;
    return Vector3.Lerp(a, b, i - Math.floor(i));
  };

  // Network field: one disc per network, thin-instanced, spread across the far sky like a map of a country.
  const disc = MeshBuilder.CreateDisc("netdisc", { radius: 0.09, tessellation: 8 }, scene);
  const discMat = glow(scene, "netMat", cyan);
  disc.material = discMat;
  disc.isPickable = false;
  disc.alwaysSelectAsActiveMesh = true;
  const matrices = new Float32Array(NETWORKS * 16);
  const colors = new Float32Array(NETWORKS * 4);
  const dist = new Float32Array(NETWORKS);
  let seed = 1337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const cx = -4, cy = 12, cz = 34;
  for (let i = 0; i < NETWORKS; i++) {
    // Rough continental blob: an ellipse with jitter, denser toward the middle.
    const r = Math.sqrt(rnd()) * 1.0;
    const a = rnd() * Math.PI * 2;
    const x = cx + Math.cos(a) * r * 30 + (rnd() - 0.5) * 3;
    const y = cy + Math.sin(a) * r * 12 + (rnd() - 0.5) * 2;
    const z = cz + (rnd() - 0.5) * 6;
    Matrix.TranslationToRef(x, y, z, Matrix.IdentityReadOnly.clone()).copyToArray(matrices, i * 16);
    // Distance from the "home" agency (near the middle-right), used to light nodes outward.
    dist[i] = Math.hypot(x - (cx + 8), y - (cy - 2));
    colors[i * 4] = 0.12; colors[i * 4 + 1] = 0.16; colors[i * 4 + 2] = 0.2; colors[i * 4 + 3] = 1;
  }
  disc.thinInstanceSetBuffer("matrix", matrices, 16, false);
  disc.thinInstanceSetBuffer("color", colors, 4, false);
  discMat.backFaceCulling = false;
  let maxDist = 0;
  for (let i = 0; i < NETWORKS; i++) maxDist = Math.max(maxDist, dist[i]!);

  // Retention trail: plate markers along lane 1 behind the car, one per day up to a cap.
  const marker = MeshBuilder.CreatePlane("trailMarker", { width: 0.34, height: 0.16 }, scene);
  marker.material = glow(scene, "markerMat", amber, 0.85);
  marker.isPickable = false;
  (marker.material as StandardMaterial).backFaceCulling = false;
  marker.alwaysSelectAsActiveMesh = true;
  const TRAIL_CAP = 60;
  const tm = new Float32Array(TRAIL_CAP * 16);
  for (let i = 0; i < TRAIL_CAP; i++) {
    const m = Matrix.RotationY(Math.PI / 2).multiply(Matrix.Translation(-2 - i * 1.1, 0.5, 3.0 + 1.8));
    m.copyToArray(tm, i * 16);
  }
  marker.thinInstanceSetBuffer("matrix", tm, 16, false);
  marker.thinInstanceCount = 0;
  const infinity = MeshBuilder.CreateTorus("evidenceRing", { diameter: 0.9, thickness: 0.05, tessellation: 32 }, scene);
  infinity.material = glow(scene, "ringMat", amber, 0.9);
  infinity.position = new Vector3(-2 - TRAIL_CAP * 1.1 - 1.5, 0.6, 4.8);
  infinity.rotation.x = Math.PI / 2;
  infinity.setEnabled(false);

  let fan = 0;
  const viz: DataViz = {
    packet, cloud, phone,
    setPacketProgress(p4, falconWorld) {
      rebuildPath(falconWorld);
      const vis = p4 > 0.02 && p4 < 0.97;
      packet.setEnabled(vis);
      trail.setEnabled(vis);
      // Segments: 0.05-0.25 on the camera (pulse), 0.25-0.33 uplink, 0.33-0.60 in the cloud, 0.60-0.68 down to the phone.
      let u: number;
      if (p4 < 0.25) u = 0;
      else if (p4 < 0.33) u = smooth(window01(p4, 0.25, 0.33)) * 0.5;
      else if (p4 < 0.60) u = 0.5;
      else if (p4 < 0.68) u = 0.5 + smooth(window01(p4, 0.60, 0.68)) * 0.5;
      else u = 1;
      const pos = sample(u);
      if (p4 >= 0.33 && p4 < 0.60) {
        const t = performance.now() / 900;
        pos.addInPlace(new Vector3(Math.cos(t) * 1.3, Math.sin(t * 1.7) * 0.25, Math.sin(t) * 0.5));
      }
      if (Vector3.Distance(pos, lastPacketPos) > 0.6) { packet.position.copyFrom(pos); packet.computeWorldMatrix(true); trail.reset(); }
      lastPacketPos.copyFrom(pos);
      packet.position.copyFrom(pos);
      const pulse = p4 < 0.25 ? 1 + 0.5 * Math.sin(performance.now() / 120) : 1;
      packet.scaling.setAll(pulse);
      const cloudVis = smooth(window01(p4, 0.28, 0.36)) * (1 - smooth(window01(p4, 0.9, 0.98)));
      for (const c of cloudNodes) { c.setEnabled(cloudVis > 0.01); c.scaling.setAll(0.2 + 0.8 * cloudVis); }
      phoneMesh.setEnabled(p4 > 0.55 && p4 < 0.95);
    },
    setFanout(amount) {
      if (Math.abs(amount - fan) < 0.002) return;
      fan = amount;
      const reach = amount * (maxDist + 2);
      for (let i = 0; i < NETWORKS; i++) {
        const lit = clamp01((reach - dist[i]!) / 2.5);
        colors[i * 4] = lerp(0.12, 0.35, lit); colors[i * 4 + 1] = lerp(0.16, 0.85, lit); colors[i * 4 + 2] = lerp(0.2, 0.95, lit);
      }
      disc.thinInstanceSetBuffer("color", colors, 4, false);
    },
    setTrail(days, evidence) {
      marker.thinInstanceCount = Math.min(TRAIL_CAP, days);
      infinity.setEnabled(evidence);
    },
    setVisible(on) {
      disc.setEnabled(on);
      marker.setEnabled(on);
      if (!on) { packet.setEnabled(false); trail.setEnabled(false); for (const c of cloudNodes) c.setEnabled(false); phoneMesh.setEnabled(false); infinity.setEnabled(false); }
    },
  };
  viz.setVisible(false);
  return viz;
}
