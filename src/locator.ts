/**
 * The 3D locator in the Components section: the assembled Falcon with a see-through shell. Selecting a
 * component isolates it and frames it; the stage slider separates the parts front to back. Renders only
 * while the locator is on screen.
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { bootEngine } from "./engine";
import { createWorld, explodeAmount, type World } from "./scene/world";
import { evalRail, PoseTween, type Pose } from "./scene/rail";
import { components } from "./content";
import { lerp, smooth } from "./lib/math";
import { state, set, subscribe } from "./store";
import rail from "./content/animation.json";

const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);

export interface Locator { world: World; scene: World["scene"]; engine: ReturnType<World["scene"]["getEngine"]>; frame: number }

export async function initLocator(canvas: HTMLCanvasElement, status: HTMLElement): Promise<Locator> {
  const boot = await bootEngine(canvas);
  const { engine } = boot;
  set({ tier: boot.tier, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
  status.textContent = `${boot.backend} · ${boot.tier}`;
  const world = await createWorld(engine, boot.tier);
  const { scene, camera } = world;
  camera.minZ = 0.02;
  const partList = components.parts.slice().sort((a, b) => a.order - b.order);
  const n = partList.length;

  // Studio look: the pole and street ghosted, the shell see-through while assembled.
  world.setContextAlpha(0.1);
  world.irLight.intensity = 0;
  world.fill.intensity = 1.2;
  world.hemi.intensity = 0.55;
  world.footprint.visibility = 0;
  world.cone.visibility = 0;
  if (world.sedan) world.sedan.setEnabled(false);

  const dest: Pose = { pos: new Vector3(), target: new Vector3(), fov: 0.7 };
  const out: Pose = { pos: new Vector3(), target: new Vector3(), fov: 0.7 };
  const tween = new PoseTween();
  const up = new Vector3(0, 1, 0);
  let poseKey = "";
  let shellAlpha = -1;
  const stage = { from: 0, to: 0, t0: 0, v: 0 };
  let tweening = false;
  subscribe((s, changed) => { if (changed.has("explodeStage")) { stage.from = stage.v; stage.to = s.explodeStage / 5; stage.t0 = performance.now(); } });

  const api: Locator = { world, scene, engine, frame: 0 };
  scene.onBeforeRenderObservable.add(() => {
    api.frame++;
    const now = performance.now();
    const dur = state.reducedMotion ? 0 : 600;
    const u = dur <= 0 ? 1 : Math.min(1, (now - stage.t0) / dur);
    stage.v = lerp(stage.from, stage.to, easeOutCubic(u));
    let moving = u < 1;

    // Explosion
    for (const p of partList) {
      const rec = world.parts.get(p.id);
      if (!rec) continue;
      // A tighter spread than the full-width stage used, so the stack fits the portrait frame.
      rec.node.position.copyFrom(rec.rest).addInPlace(rec.explode.scale(0.6 * explodeAmount(stage.v, p.order - 1, n)));
    }
    // Shell: see-through while assembled, solid once apart. While a part is isolated the isolation owns every
    // part's visibility, so the shell is left alone and re-applied when the isolation ends.
    if (state.focusedPart) shellAlpha = -1;
    else { const want = lerp(0.16, 1, smooth(stage.v)); if (Math.abs(want - shellAlpha) > 0.004) { shellAlpha = want; world.setShellAlpha(want); } }

    // Camera: the assembled preset pose; as the parts separate the view backs off and rolls so the explosion
    // runs down the portrait frame, front at the top.
    const key = `${state.focusedPart ?? ""}`;
    if (key !== poseKey) { tween.retarget(out, now, state.reducedMotion); poseKey = key; }
    const M = world.falcon ? world.falcon.getWorldMatrix() : null;
    evalRail(rail.views.inside[0]!, dest, M);
    // The roll completes by stage 2 so the intermediate stages do not read as a tilted frame.
    const k = smooth(Math.min(1, stage.v * 2));
    if (M && k > 0) {
      const pB = Vector3.TransformCoordinates(new Vector3(-1.15, 0.4, 0.9), M);
      const tB = Vector3.TransformCoordinates(new Vector3(0, 0.05, -0.05), M);
      dest.pos.set(lerp(dest.pos.x, pB.x, k), lerp(dest.pos.y, pB.y, k), lerp(dest.pos.z, pB.z, k));
      dest.target.set(lerp(dest.target.x, tB.x, k), lerp(dest.target.y, tB.y, k), lerp(dest.target.z, tB.z, k));
      dest.fov = lerp(dest.fov, 44 * Math.PI / 180, k);
      const zAxis = Vector3.TransformNormal(new Vector3(0, 0, 1), M).normalize();
      up.set(lerp(0, zAxis.x, k), lerp(1, zAxis.y, k), lerp(0, zAxis.z, k)).normalize();
    } else up.set(0, 1, 0);
    const rec = state.focusedPart ? world.parts.get(state.focusedPart) : undefined;
    if (rec) {
      const bb = rec.node.getHierarchyBoundingVectors(true);
      const c = bb.min.add(bb.max).scale(0.5);
      const r = Math.max(0.008, Vector3.Distance(bb.min, bb.max) / 2);
      const dir = dest.pos.subtract(dest.target).normalize();
      const d = Math.max(0.1, (r / Math.tan(dest.fov / 2)) * 2.2);
      dest.target.copyFrom(c); dest.pos.copyFrom(c.add(dir.scale(d)));
    }
    moving = tween.mix(dest, now, out) || moving;
    camera.upVector.copyFrom(rec ? Vector3.Up() : up);
    camera.position.copyFrom(out.pos);
    camera.setTarget(out.target);
    camera.fov = out.fov;
    if (moving !== tweening) { tweening = moving; set({ tweening }); }
  });
  subscribe((s, changed) => { if (changed.has("focusedPart")) world.isolate(s.focusedPart); });

  // Render only while the locator is on screen.
  let visible = true;
  const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); }, { rootMargin: "100px" });
  io.observe(canvas);
  engine.runRenderLoop(() => { if (visible) scene.render(); });
  const ro = new ResizeObserver(() => engine.resize());
  ro.observe(canvas);
  set({ ready: true, mode: "3d" });
  return api;
}
