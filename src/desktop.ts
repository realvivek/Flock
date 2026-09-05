import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { bootEngine } from "./engine";
import { wireScroll } from "./scroll";
import { evalRail } from "./scene/rail";
import { createWorld, explodeAmount, updateFootprint, AIM_DEFAULT_YAW, type World } from "./scene/world";
import { components } from "./content";
import { PinLayer } from "./ui/pins";
import { initAct1 } from "./acts/act1";
import { initAct2 } from "./acts/act2";
import { initAct3 } from "./acts/act3";
import { initAct4 } from "./acts/act4";
import { initAct5 } from "./acts/act5";
import { initAct6 } from "./acts/act6";
import { initAct7 } from "./acts/act7";
import { setCiteHandler } from "./ui/cite";
import { revealSource } from "./ui/article";
import { createDataViz } from "./scene/dataviz";
import anim from "./content/animation.json";
import { lerp } from "./lib/math";
import { state, set, subscribe } from "./store";
import { degToRad, window01, smooth } from "./lib/math";

export async function startDesktop() {
  const canvas = document.getElementById("stage") as HTMLCanvasElement;
  const status = document.getElementById("status")!;
  let boot;
  try {
    boot = await bootEngine(canvas);
  } catch (e) {
    console.error(e);
    document.getElementById("webgl-fallback")!.hidden = false;
    wireScroll();
    return;
  }
  const { engine, backend, tier } = boot;
  set({ tier });
  status.textContent = `${backend} · ${tier}`;

  const world: World = await createWorld(engine, tier);
  const { scene, camera, mount, tilt, parts } = world;
  const partList = components.parts.slice().sort((a, b) => a.order - b.order);
  const n = partList.length;

  const q = new URLSearchParams(location.search);
  const pins = new PinLayer();
  initAct1(world, pins);
  initAct2(world, pins);
  initAct3(world, pins);
  const viz = createDataViz(world);
  initAct4(world, viz, pins);
  initAct5();
  initAct6();
  initAct7();
  // Citation chips scroll to the bibliography row and flash it; the hash still records the target.
  setCiteHandler((id) => { history.replaceState(null, "", `#src-${id}`); revealSource(id); });
  const wingView = { pos: new Vector3(...(anim.wing.pos as [number, number, number])), target: new Vector3(...(anim.wing.target as [number, number, number])), fov: anim.wing.fov };
  let wingBlend = 0;
  let lastInside = -1;
  const railOut = { pos: new Vector3(), target: new Vector3(), fov: 0.7 };
  const debugView = new URLSearchParams(location.search).get("view");

  scene.onBeforeRenderObservable.add(() => {
    const t = state.progress;
    // Camera rail
    if (!debugView) {
      evalRail(t, railOut, world.falcon ? world.falcon.getWorldMatrix() : null);
      // Wing closet override while its path is selected in act 3.
      const wantWing = state.act === 3 && state.pathMode === "wing" ? 1 : 0;
      const dt = Math.min(0.1, engine.getDeltaTime() / 1000);
      wingBlend += (wantWing - wingBlend) * (1 - Math.exp(-dt / 0.3));
      if (wingBlend > 0.001) {
        railOut.pos.set(lerp(railOut.pos.x, wingView.pos.x, wingBlend), lerp(railOut.pos.y, wingView.pos.y, wingBlend), lerp(railOut.pos.z, wingView.pos.z, wingBlend));
        railOut.target.set(lerp(railOut.target.x, wingView.target.x, wingBlend), lerp(railOut.target.y, wingView.target.y, wingBlend), lerp(railOut.target.z, wingView.target.z, wingBlend));
        railOut.fov = lerp(railOut.fov, wingView.fov * Math.PI / 180, wingBlend);
      }
      // Portrait phones: keep the subject in the top part of the frame, above the text.
      if (engine.getRenderHeight() > engine.getRenderWidth()) { railOut.target.y -= 0.9 + 0.08 * Vector3.Distance(railOut.pos, railOut.target); railOut.fov *= 1.25; }
      camera.position.copyFrom(railOut.pos);
      camera.setTarget(railOut.target);
      camera.fov = railOut.fov;
    }
    // Aim
    mount.rotation.y = degToRad(AIM_DEFAULT_YAW + state.aimYaw);
    tilt.rotation.x = degToRad(-state.aimPitch);
    // Explode in act 2
    const p2 = state.acts[2] ?? 0;
    for (const p of partList) {
      const rec = parts.get(p.id);
      if (!rec) continue;
      const k = explodeAmount(p2, p.order - 1, n);
      rec.node.position.copyFrom(rec.rest).addInPlace(rec.explode.scale(k));
    }
    // Footprint visible in act 1
    const p1 = state.acts[1] ?? 0;
    const fpVis = smooth(window01(p1, 0.25, 0.45)) * (1 - smooth(window01(p1, 0.9, 1)));
    world.footprint.visibility = fpVis;
    world.cone.visibility = fpVis;
    // IR ring glow breathes in the hero, fades during the exploded view; the pole ghosts out so the parts read.
    const inside = smooth(window01(p2, 0.0, 0.12)) * (1 - smooth(window01(p2, 0.9, 1.0)));
    world.irLight.intensity = (0.25 + 0.15 * Math.sin(performance.now() / 600)) * (1 - inside);
    world.fill.intensity = 1.2 * inside + 1.5 * wingBlend;
    world.hemi.intensity = 0.35 + 0.2 * inside;
    if (Math.abs(inside - lastInside) > 0.01) { world.setContextAlpha(1 - 0.88 * inside); lastInside = inside; }
    // Sedan drives through in act 0 and act 4
    if (world.sedan) {
      const p0 = state.acts[0] ?? 0;
      const x = -30 + 70 * smooth(p0);
      world.sedan.position.x = x;
    }
  });

  let fpDirty = true;
  subscribe((_, changed) => { if (changed.has("aimYaw") || changed.has("aimPitch")) fpDirty = true; });
  scene.onAfterRenderObservable.add(() => { if (fpDirty) { updateFootprint(world); fpDirty = false; } pins.update(scene, scene.activeCamera ?? camera); });

  // Debug orbit views for checking the models: ?view=falcon|pole|wing
  if (debugView) {
    const { ArcRotateCamera } = await import("@babylonjs/core/Cameras/arcRotateCamera");
    const targets: Record<string, [Vector3, number]> = {
      falcon: [new Vector3(0, 3.05, 0.1), 0.6],
      pole: [new Vector3(0, 2.2, 0), 6],
      wing: [new Vector3(-3.2, 1.0, -2.6), 1.6],
      street: [new Vector3(5, 1, 5), 25],
    };
    const [tgt, radius] = targets[debugView] ?? targets.falcon!;
    const q = new URLSearchParams(location.search);
    const orbit = new ArcRotateCamera("orbit", Number(q.get("a") ?? 0.9), Number(q.get("b") ?? 1.25), Number(q.get("r") ?? radius), tgt, scene);
    orbit.attachControl(canvas, true);
    orbit.minZ = 0.02;
    scene.activeCamera = orbit;
    if (debugView === "wing") { await world.loadAct("wing"); world.wing?.setEnabled(true); }
    (window as unknown as { __orbit: unknown }).__orbit = orbit;
  }

  // Acts 5 to 7 are articles: fade the scene out and stop rendering it.
  subscribe((s, changed) => { if (changed.has("act")) document.body.classList.toggle("is-article", s.act >= 5); });
  engine.runRenderLoop(() => { if (!document.body.classList.contains("is-article")) scene.render(); });
  addEventListener("resize", () => engine.resize());
  wireScroll();
  // Debug presets for screenshots: ?pole=existing&path=wing&focus=som&aim=20,-12
  if (q.get("pole")) set({ poleMode: q.get("pole") as "flock" });
  if (q.get("path")) set({ pathMode: q.get("path") as "solar" });
  if (q.get("aim")) { const [y, p] = q.get("aim")!.split(",").map(Number); set({ aimYaw: y ?? 0, aimPitch: p ?? -8 }); }
  if (q.get("focus")) set({ focusedPart: q.get("focus") });
  set({ ready: true });
  (window as unknown as { __flock: unknown }).__flock = { scene, engine, state, world, set, get frame() { return engine.frameId; } };
}

