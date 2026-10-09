/**
 * The 3D locator in the Components section: the assembled Falcon with a see-through shell. Selecting a
 * component isolates it and frames it; the stage slider separates the parts front to back. Renders only
 * while the locator is on screen.
 */
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { bootEngine } from "./engine";
import { createWorld, explodeAmount, type World } from "./scene/world";
import { evalRail, PoseTween, type Pose } from "./scene/rail";
import { components } from "./content";
import { lerp, smooth } from "./lib/math";
import { state, set, subscribe } from "./store";
import rail from "./content/animation.json";

const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);

export interface Locator { world: World; scene: World["scene"]; engine: ReturnType<World["scene"]["getEngine"]>; frame: number;
  /** The share of the canvas the parts cover on screen, and whether they all lie inside it (for tests). */
  fit(): { w: number; h: number; inside: boolean } }

/** The eight corners of every part's box in world space. */
function partCorners(world: World): Vector3[] {
  const out: Vector3[] = [];
  for (const rec of world.parts.values()) {
    const { min, max } = rec.node.getHierarchyBoundingVectors(true);
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) out.push(new Vector3(x, y, z));
  }
  return out;
}

/** Move a pose along its own view direction so the parts fill the frame: the box they span, seen from the pose's
 *  direction, fits the narrower of the two fields of view with `margin` to spare. */
function fitPose(dest: { pos: Vector3; target: Vector3; fov: number }, up: Vector3, corners: Vector3[], aspect: number, margin: number): void {
  const back = dest.pos.subtract(dest.target).normalize(), fwd = back.scale(-1);
  const right = Vector3.Cross(fwd, up).normalize(), upv = Vector3.Cross(right, fwd).normalize();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const c of corners) {
    const v = c.subtract(dest.target);
    const x = Vector3.Dot(v, right), y = Vector3.Dot(v, upv), z = Vector3.Dot(v, fwd);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const center = dest.target.add(right.scale((x0 + x1) / 2)).add(upv.scale((y0 + y1) / 2)).add(fwd.scale((z0 + z1) / 2));
  const tv = Math.tan(dest.fov / 2), th = tv * aspect;
  const d = Math.max((x1 - x0) / 2 / th, (y1 - y0) / 2 / tv) * margin + (z1 - z0) / 2;
  dest.target.copyFrom(center);
  dest.pos.copyFrom(center.add(back.scale(d)));
}

/** One part alone on a transparent background, three-quarters on from above, for the parts grid (`?still=lens`). */
async function renderStill(canvas: HTMLCanvasElement, world: World, id: string): Promise<void> {
  const { scene, camera } = world;
  const engine = scene.getEngine();
  const rec = world.parts.get(id);
  if (!rec) throw new Error(`still: no part ${id}`);
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.fogMode = Scene.FOGMODE_NONE;
  for (const p of scene.postProcessRenderPipelineManager.supportedPipelines) p.dispose();
  const keep = new Set(rec.node.getChildMeshes(false));
  for (const m of scene.meshes) m.isVisible = keep.has(m);
  world.isolate(null);
  // light it so a dark part keeps its edges: brighter surroundings, a fill from the camera, a rim from behind
  scene.environmentIntensity = 1.2;
  world.fill.intensity = 1.4;
  world.hemi.intensity = 0.8;
  const M = world.falcon ? world.falcon.getWorldMatrix() : Matrix.Identity();
  const rim = new DirectionalLight("still-rim", Vector3.TransformNormal(new Vector3(0.6, -0.5, -0.6), M).normalize(), scene);
  rim.intensity = 1.6;
  const { min, max } = rec.node.getHierarchyBoundingVectors(true);
  const c = min.add(max).scale(0.5), r = Vector3.Distance(min, max) / 2;
  // about 55 degrees off the lens axis (the body's +z), from the front, above and to the left
  const dir = Vector3.TransformNormal(new Vector3(-0.55, 0.45, 0.5), M).normalize();
  camera.fov = 26 * Math.PI / 180;
  camera.minZ = 0.001;
  camera.position.copyFrom(c.add(dir.scale((r / Math.tan(camera.fov / 2)) * 1.15)));
  camera.upVector.copyFrom(Vector3.TransformNormal(new Vector3(0, 1, 0), M).normalize());
  camera.setTarget(c);
  Object.assign(canvas.style, { position: "fixed", left: "0", top: "0", width: "1000px", height: "800px", zIndex: "100" });
  engine.resize();
  await scene.whenReadyAsync();
  for (let i = 0; i < 30; i++) { scene.render(); await new Promise((res) => requestAnimationFrame(res)); }
  (window as unknown as { __still?: string }).__still = canvas.toDataURL("image/webp", 0.9);
}

export async function initLocator(canvas: HTMLCanvasElement, status: HTMLElement): Promise<Locator> {
  const stillPart = new URLSearchParams(location.search).get("still");
  const boot = await bootEngine(canvas, { still: !!stillPart });
  const { engine } = boot;
  set({ tier: boot.tier, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
  status.textContent = `${boot.backend} · ${boot.tier}`;
  const world = await createWorld(engine, boot.tier);
  const { scene, camera } = world;
  if (stillPart) { await renderStill(canvas, world, stillPart); return { world, scene, engine, frame: 0, fit: () => ({ w: 0, h: 0, inside: true }) }; }
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

  const api: Locator = { world, scene, engine, frame: 0, fit() {
    const w = engine.getRenderWidth(), h = engine.getRenderHeight();
    const vp = camera.viewport.toGlobal(w, h), m = scene.getTransformMatrix();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of partCorners(world)) { const p = Vector3.Project(c, Matrix.Identity(), m, vp); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    return { w: (x1 - x0) / w, h: (y1 - y0) / h, inside: x0 >= -1 && y0 >= -1 && x1 <= w + 1 && y1 <= h + 1 };
  } };
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
      // A tighter spread than the full-width stage used, so the stack fits the portrait frame with its parts large.
      rec.node.position.copyFrom(rec.rest).addInPlace(rec.explode.scale(0.45 * explodeAmount(stage.v, p.order - 1, n)));
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
    // the parts fill the frame at every stage: the rail sets the direction, the fit sets the distance
    if (!rec) fitPose(dest, up, partCorners(world), engine.getAspectRatio(camera), 1.08);
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
  if (state.focusedPart) world.isolate(state.focusedPart);

  // Render only while the locator is on screen.
  let visible = true;
  const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); }, { rootMargin: "100px" });
  io.observe(canvas);
  engine.runRenderLoop(() => { if (visible) scene.render(); });
  const ro = new ResizeObserver(() => engine.resize());
  ro.observe(canvas);
  // ready once every material has compiled and a frame is on screen, so the panel never shows an empty stage
  await scene.whenReadyAsync();
  // the first frame is drawn even when the panel starts below the fold, so the page is ready wherever it opens
  const first = new Promise<void>((res) => scene.onAfterRenderObservable.addOnce(() => res()));
  if (!visible) scene.render();
  await first;
  set({ ready: true, mode: "3d" });
  return api;
}
