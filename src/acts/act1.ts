import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { install } from "../content";
import { cite, escape } from "../ui/cite";
import type { PinLayer } from "../ui/pins";
import type { World } from "../scene/world";
import { state, set, subscribe, type PoleMode } from "../store";
import { feetToM } from "../lib/math";

/** Act 1: installer view. Pole-mode toggle, install facts, pinned dimensions, and the aim interaction. */
export function initAct1(world: World, pins: PinLayer): void {
  const facts = document.getElementById("install-facts")!;
  const chips = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-pole]"));
  const yaw = document.getElementById("aim-yaw") as HTMLInputElement;
  const pitch = document.getElementById("aim-pitch") as HTMLInputElement;
  const readout = document.getElementById("aim-readout")!;

  for (const pin of install.pins) {
    const a = new Vector3(pin.anchor[0], pin.anchor[1], pin.anchor[2]);
    pins.add({ id: pin.id, anchor: () => a, k: pin.k, v: pin.v, dx: pin.dx ?? 110, dy: pin.dy ?? -40 });
  }

  const renderFacts = (mode: PoleMode) => {
    const m = install.modes[mode]!;
    facts.innerHTML = "";
    for (const f of m.facts) {
      const d = document.createElement("div");
      d.innerHTML = `<span class="k">${escape(f.k)}</span><span class="v">${escape(f.v)}</span>`;
      d.appendChild(cite(f.sources));
      facts.appendChild(d);
    }
  };

  const applyMode = (mode: PoleMode) => {
    chips.forEach((c) => c.classList.toggle("is-active", c.dataset.pole === mode));
    renderFacts(mode);
    const g = world.poleGroups;
    const flock = mode === "flock";
    for (const m of g.pole) m.setEnabled(flock);
    g.flag?.setEnabled(flock);
    g.solar?.setEnabled(flock);
    g.utility?.setEnabled(!flock);
    g.utilitySolar?.setEnabled(mode === "existing");
    g.battery?.setEnabled(mode !== "ac");
    g.ac?.setEnabled(mode === "ac");
    // Existing poles are fatter: push the camera out so the clamps wrap the larger diameter.
    if (world.falcon) world.falcon.position.z = flock ? 0.10 : 0.10 + (0.14 - 0.0365);
    world.mount.position.y = feetToM(flock ? install.pole.cameraHeightFt : 10);
    pins.showOnly(install.pins.filter((p) => p.modes.includes(mode)).map((p) => p.id));
  };

  chips.forEach((c) => c.addEventListener("click", () => set({ poleMode: c.dataset.pole as PoleMode })));
  yaw.addEventListener("input", () => set({ aimYaw: Number(yaw.value) }));
  pitch.addEventListener("input", () => set({ aimPitch: Number(pitch.value) }));

  const updateReadout = () => {
    const cov = install.coverage;
    const dist = feetToM(cov.distFt);
    const drop = world.mount.position.y;
    const ground = Math.max(0, Math.sqrt(Math.max(0, (drop / Math.tan(Math.max(0.5, -state.aimPitch) * Math.PI / 180)) ** 2)));
    readout.textContent = `yaw ${state.aimYaw >= 0 ? "+" : ""}${state.aimYaw}° · pitch ${state.aimPitch}° · centre of view meets the road at ≈ ${(ground).toFixed(0)} m · published: ${cov.widthFt} ft wide at ${cov.distFt} ft (${dist.toFixed(0)} m), up to ${cov.maxFt} ft, ${cov.lanes} lanes, ${cov.mph} mph`;
  };

  // Drag on the canvas to aim while in act 1.
  const canvas = document.getElementById("stage") as HTMLCanvasElement;
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener("pointerdown", (e) => { if (state.act !== 1) return; dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    const ny = Math.max(-60, Math.min(60, state.aimYaw + dx * 0.25));
    const np = Math.max(-25, Math.min(5, state.aimPitch - dy * 0.12));
    yaw.value = String(Math.round(ny)); pitch.value = String(Math.round(np));
    set({ aimYaw: ny, aimPitch: np });
  });
  const stop = () => { dragging = false; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);

  subscribe((s, changed) => {
    if (changed.has("poleMode")) applyMode(s.poleMode);
    if (changed.has("aimYaw") || changed.has("aimPitch")) updateReadout();
    if (changed.has("act")) {
      if (s.act === 1) { applyMode(s.poleMode); }
      else for (const p of install.pins) pins.show(p.id, false);
    }
  });
  applyMode(state.poleMode);
  updateReadout();
  for (const p of install.pins) pins.show(p.id, false);
}
