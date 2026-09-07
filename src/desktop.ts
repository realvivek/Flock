import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { bootEngine } from "./engine";
import { evalRail, railTFor, PoseTween, type Pose } from "./scene/rail";
import { createWorld, explodeAmount, updateFootprint, AIM_DEFAULT_YAW, type World } from "./scene/world";
import { components, overview } from "./content";
import { PinLayer } from "./ui/pins";
import { initAct1 } from "./acts/act1";
import { initAct2 } from "./acts/act2";
import { initAct3 } from "./acts/act3";
import { initAct4 } from "./acts/act4";
import { initAct5 } from "./acts/act5";
import { initAct6 } from "./acts/act6";
import { initAct7 } from "./acts/act7";
import { setCiteHandler } from "./ui/cite";
import { revealSource, renderDeployments, renderContents } from "./ui/article";
import { createDataViz } from "./scene/dataviz";
import anim from "./content/animation.json";
import { lerp } from "./lib/math";
import { state, set, subscribe, setView, driveAct } from "./store";
import { degToRad } from "./lib/math";
import { wireRouter, navigate, parseRoute, type Route, type Tab, type Sub } from "./router";

const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);

/** Horizontal band of the viewport free for the 3D subject: right of the panel column, or between the callout columns. */
export function freeBand(): { left: number; right: number } {
  if (innerWidth < 800) return { left: 0, right: innerWidth };
  const strip = document.querySelector<HTMLElement>(".view:not([hidden]) .callouts:not([hidden])");
  if (strip) {
    const l = strip.querySelector<HTMLElement>(".callout-col.left")?.getBoundingClientRect().right ?? 0;
    const r = strip.querySelector<HTMLElement>(".callout-col.right")?.getBoundingClientRect().left ?? innerWidth;
    return { left: l, right: r };
  }
  const col = document.querySelector<HTMLElement>(".view:not([hidden]) .panel-col");
  return { left: col ? col.getBoundingClientRect().right : 0, right: innerWidth };
}

export async function startDesktop() {
  const canvas = document.getElementById("stage") as HTMLCanvasElement;
  const status = document.getElementById("status")!;
  let fellBack = false;
  const fallbackToStills = (why: unknown) => {
    if (fellBack) return;
    fellBack = true;
    console.error("3D view unavailable, showing the stills version", why);
    canvas.hidden = true;
    document.body.classList.remove("is-tabs", "is-3d");
    import("./mobile/stepper").then(({ initStepper }) => initStepper({ notice: "The 3D view could not start on this device. This is the stills version of the same content." }));
  };
  set({ reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
  let boot;
  let world: World;
  try {
    boot = await bootEngine(canvas);
    set({ tier: boot.tier });
    status.textContent = `${boot.backend} · ${boot.tier}`;
    world = await createWorld(boot.engine, boot.tier);
  } catch (e) {
    boot?.engine.dispose();
    fallbackToStills(e);
    return;
  }
  const { engine } = boot;
  engine.onContextLostObservable.add(() => fallbackToStills("context lost"));
  const { scene, camera, mount, tilt, parts } = world;
  const partList = components.parts.slice().sort((a, b) => a.order - b.order);
  const n = partList.length;
  document.body.classList.add("is-tabs");

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
  renderDeployments(document.getElementById("deployments-body")!);
  document.getElementById("hero-lede")!.textContent = overview.intro.lede;
  document.getElementById("hero-sources")!.textContent = overview.intro.sources;
  const routeFor: Record<string, string> = { deployments: "#/deployments", pole: "#/hardware/pole", inside: "#/hardware/inside", power: "#/hardware/power", data: "#/data", myths: "#/claims", economics: "#/economics", sources: "#/sources" };
  renderContents(document.getElementById("contents-host")!, (id) => routeFor[id] ?? "#/overview");

  // ---- Tabs -------------------------------------------------------------------------------------
  const views = Array.from(document.querySelectorAll<HTMLElement>("section.view"));
  const tabLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".tabs a"));
  const subLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".subtabs a"));
  const showView = (tab: Tab, sub: Sub, changedTab: boolean) => {
    for (const v of views) v.hidden = v.id !== `view-${tab}`;
    for (const a of tabLinks) a.setAttribute("aria-selected", String(a.dataset.tab === tab));
    for (const a of subLinks) a.setAttribute("aria-selected", String(a.dataset.sub === sub));
    document.querySelectorAll<HTMLElement>("#view-hardware .panel[data-sub]").forEach((p) => { p.hidden = p.dataset.sub !== sub; });
    const hw = document.getElementById("view-hardware")!;
    hw.classList.toggle("is-inside", sub === "inside");
    (hw.querySelector(".callouts") as HTMLElement).hidden = sub !== "inside";
    document.body.classList.toggle("is-3d", tab === "overview" || tab === "hardware" || tab === "data");
    document.body.dataset.tab = tab;
    if (changedTab) { const sc = document.querySelector<HTMLElement>(`#view-${tab} .view-scroll`); if (sc) sc.scrollTop = 0; }
    requestAnimationFrame(() => engine.resize());
  };
  const applyIndex = (r: Route) => {
    if (r.index === undefined) return;
    if (r.tab === "hardware" && (r.sub ?? "pole") === "inside") {
      if (r.index <= 5) set({ explodeStage: r.index });
      else { const p = partList[r.index - 6]; set({ explodeStage: 5, focusedPart: p ? p.id : null }); }
    } else if (r.tab === "data") set({ dataStage: Math.max(1, Math.min(12, r.index)) });
  };
  const applyRoute = (r: Route) => {
    const sub = r.sub ?? (r.tab === "hardware" ? state.sub : state.sub);
    const changedTab = r.tab !== state.tab;
    if (changedTab || sub !== state.sub || !document.body.dataset.tab) { setView(r.tab, sub); showView(r.tab, sub, changedTab); }
    applyIndex(r);
    if (r.anchor) {
      const anchor = r.anchor;
      requestAnimationFrame(() => {
        if (anchor.startsWith("src-")) revealSource(anchor.slice(4), "auto");
        else document.getElementById(anchor)?.scrollIntoView({ block: "start" });
      });
    }
  };
  setCiteHandler((id) => navigate({ tab: "sources", anchor: `src-${id}` }));

  // ---- Camera: preset pose per view state, tweened --------------------------------------------
  const wingView: Pose = { pos: new Vector3(...(anim.wing.pos as [number, number, number])), target: new Vector3(...(anim.wing.target as [number, number, number])), fov: anim.wing.fov * Math.PI / 180 };
  const dest: Pose = { pos: new Vector3(), target: new Vector3(), fov: 0.7 };
  const railOut: Pose = { pos: new Vector3(), target: new Vector3(), fov: 0.7 };
  const tween = new PoseTween();
  let poseKey = "";
  let wingBlend = 0;
  let fpVis = 0, inside = 0, lastInside = -1;
  let compShift = 0, compZoom = 1;
  const debugView = q.get("view");
  // Stage tweens for acts[2] and acts[4]
  const stage = { from2: 0, to2: 0, t2: 0, from4: 0, to4: 0, t4: 0 };
  let tweening = false;
  subscribe((s, changed) => {
    if (changed.has("explodeStage") || changed.has("act")) { stage.from2 = s.acts[2] ?? 0; stage.to2 = s.explodeStage / 5; stage.t2 = performance.now(); }
    if (changed.has("dataStage") || changed.has("act")) { stage.from4 = s.acts[4] ?? 0; stage.to4 = (s.dataStage - 1) / 11; stage.t4 = performance.now(); }
  });

  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    const dur = state.reducedMotion ? 0 : 600;
    const ease = (t0: number) => dur <= 0 ? 1 : easeOutCubic(Math.min(1, (now - t0) / dur));
    const u2 = ease(stage.t2), u4 = ease(stage.t4);
    driveAct(2, lerp(stage.from2, stage.to2, u2));
    driveAct(4, lerp(stage.from4, stage.to4, u4));
    let moving = u2 < 1 || u4 < 1;

    if (!debugView) {
      const key = `${state.act}|${state.explodeStage}|${state.dataStage}|${state.poleView}|${state.pathMode}|${state.act === 2 ? state.focusedPart ?? "" : ""}`;
      if (key !== poseKey) { tween.retarget(railOut, now, state.reducedMotion); poseKey = key; set({ progress: railTFor(state) }); }
      if (state.act === 3 && state.pathMode === "wing") { dest.pos.copyFrom(wingView.pos); dest.target.copyFrom(wingView.target); dest.fov = wingView.fov; }
      else evalRail(railTFor(state), dest, world.falcon ? world.falcon.getWorldMatrix() : null);
      // Isolated part: keep the viewing direction, aim at the part's centre and close in until it fills about
      // a third of the frame height.
      const focusRec = state.act === 2 && state.focusedPart ? world.parts.get(state.focusedPart) : undefined;
      if (focusRec) {
        const bb = focusRec.node.getHierarchyBoundingVectors(true);
        const c = bb.min.add(bb.max).scale(0.5);
        const r = Math.max(0.05, Vector3.Distance(bb.min, bb.max) / 2);
        const dir = dest.pos.subtract(dest.target).normalize();
        const d = Math.max(0.3, (r / Math.tan(dest.fov / 2)) * 2.4);
        dest.target.copyFrom(c); dest.pos.copyFrom(c.add(dir.scale(d)));
      }
      const camMoving = tween.mix(dest, now, railOut);
      moving = moving || camMoving;
      const dt = Math.min(0.1, engine.getDeltaTime() / 1000);
      const wantWing = state.act === 3 && state.pathMode === "wing" ? 1 : 0;
      wingBlend += (wantWing - wingBlend) * (1 - Math.exp(-dt / 0.3));
      // Portrait phones: keep the subject in the top part of the frame, above the text.
      if (engine.getRenderHeight() > engine.getRenderWidth()) { railOut.target.y -= 0.9 + 0.08 * Vector3.Distance(railOut.pos, railOut.target); railOut.fov *= 1.25; }
      // Exploded view: keep the whole assembly in the free band between the callout columns at any aspect.
      // A feedback loop shifts the camera sideways and widens the field of view until the projected badges fit;
      // it only integrates once the camera has settled, and decays outside the Inside stage.
      if (state.act === 2 && innerWidth >= 800) {
        const box = pins.groupBox("parts");
        const band = freeBand();
        if (!box) compShift *= 0.9;
        else if (!camMoving) {
          const freeL = band.left + 60, freeR = band.right - 60;
          const err = (freeL + freeR) / 2 - (box.left + box.right) / 2;
          const dist = Vector3.Distance(railOut.pos, railOut.target);
          const worldPerPx = (2 * dist * Math.tan(railOut.fov / 2)) / innerHeight;
          const span = worldPerPx * innerWidth;
          // Deadband and hysteresis so the loop settles instead of creeping or oscillating around its target.
          if (Math.abs(err) > 3) compShift = Math.max(-span * 0.5, Math.min(span * 0.5, compShift + err * worldPerPx * 0.3));
          const width = box.right - box.left, free = freeR - freeL;
          if (width > free * 0.92) compZoom = Math.min(1.6, compZoom * 1.04);
          else if (width < free * 0.8) compZoom = Math.max(0.7, compZoom * 0.985);
        }
      } else { compShift *= 0.85; compZoom = 1 + (compZoom - 1) * 0.85; }
      if (Math.abs(compShift) > 1e-4 || compZoom > 1.001) {
        const fwd = railOut.target.subtract(railOut.pos).normalize();
        const right = Vector3.Cross(Vector3.Up(), fwd).normalize();
        const off = right.scale(compShift);
        railOut.pos.addInPlace(off); railOut.target.addInPlace(off);
        railOut.fov *= compZoom;
      }
      camera.position.copyFrom(railOut.pos);
      camera.setTarget(railOut.target);
      camera.fov = railOut.fov;
    }
    pins.freeze = moving;
    if (moving !== tweening) { tweening = moving; set({ tweening }); }
    // Aim
    mount.rotation.y = degToRad(AIM_DEFAULT_YAW + state.aimYaw);
    tilt.rotation.x = degToRad(-state.aimPitch);
    // Explode
    const p2 = state.acts[2] ?? 0;
    for (const p of partList) {
      const rec = parts.get(p.id);
      if (!rec) continue;
      const k = explodeAmount(p2, p.order - 1, n);
      rec.node.position.copyFrom(rec.rest).addInPlace(rec.explode.scale(k));
    }
    // Footprint on the Pole stage; ghosting on the Inside stage (both eased, act-gated).
    const dt2 = Math.min(0.1, engine.getDeltaTime() / 1000);
    const k = state.reducedMotion ? 1 : 1 - Math.exp(-dt2 / 0.25);
    fpVis += ((state.act === 1 ? 1 : 0) - fpVis) * k;
    world.footprint.visibility = fpVis;
    world.cone.visibility = fpVis;
    inside += ((state.act === 2 ? 1 : 0) - inside) * k;
    world.irLight.intensity = (0.25 + 0.15 * Math.sin(now / 600)) * (1 - inside);
    world.fill.intensity = 1.2 * inside + 1.5 * wingBlend;
    world.hemi.intensity = 0.35 + 0.2 * inside;
    if (Math.abs(inside - lastInside) > 0.01) { world.setContextAlpha(1 - 0.88 * inside); lastInside = inside; }
    // Sedan: parked mid-street on the overview, driven through elsewhere
    if (world.sedan) {
      const p0 = state.acts[0] ?? 0;
      world.sedan.position.x = -30 + 70 * (3 * p0 * p0 - 2 * p0 * p0 * p0);
    }
  });

  let fpDirty = true;
  subscribe((_, changed) => { if (changed.has("aimYaw") || changed.has("aimPitch")) fpDirty = true; });
  scene.onAfterRenderObservable.add(() => {
    if (fpDirty) { updateFootprint(world); fpDirty = false; }
    const band = freeBand();
    pins.update(scene, scene.activeCamera ?? camera, band.left, band.right);
  });

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
    const orbit = new ArcRotateCamera("orbit", Number(q.get("a") ?? 0.9), Number(q.get("b") ?? 1.25), Number(q.get("r") ?? radius), tgt, scene);
    orbit.attachControl(canvas, true);
    orbit.minZ = 0.02;
    scene.activeCamera = orbit;
    if (debugView === "wing") { await world.loadAct("wing"); world.wing?.setEnabled(true); }
    (window as unknown as { __orbit: unknown }).__orbit = orbit;
  }

  // Keyboard: arrows step the stage of the current 3D tab unless typing in a field.
  addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const d = e.key === "ArrowRight" ? 1 : -1;
    if (state.act === 2) set({ explodeStage: Math.max(0, Math.min(5, state.explodeStage + d)) });
    else if (state.act === 4) set({ dataStage: Math.max(1, Math.min(12, state.dataStage + d)) });
  });

  engine.runRenderLoop(() => { if (document.body.classList.contains("is-3d")) scene.render(); });
  addEventListener("resize", () => engine.resize());
  wireRouter(applyRoute);
  // Debug presets for screenshots: ?pole=existing&path=wing&focus=som&aim=20,-12
  if (q.get("pole")) set({ poleMode: q.get("pole") as "flock" });
  if (q.get("path")) set({ pathMode: q.get("path") as "solar" });
  if (q.get("aim")) { const [y, p] = q.get("aim")!.split(",").map(Number); set({ aimYaw: y ?? 0, aimPitch: p ?? -8 }); }
  if (q.get("focus")) set({ focusedPart: q.get("focus") });
  set({ ready: true });
  (window as unknown as { __flock: unknown }).__flock = {
    scene, engine, state, world, set, navigate,
    go: (s: string) => navigate(parseRoute("#/" + s.replace(/^#?\/?/, ""))),
    get frame() { return engine.frameId; },
  };
}
