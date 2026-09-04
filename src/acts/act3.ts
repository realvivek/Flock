import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { install } from "../content";
import { cite, escape } from "../ui/cite";
import type { PinLayer } from "../ui/pins";
import type { World } from "../scene/world";
import { state, set, subscribe, type PathMode } from "../store";

/** Act 3: power and cable. Path toggle, facts, cable pulse, AC kit swap, and the Wing closet vignette. */
export function initAct3(world: World, pins: PinLayer): void {
  const facts = document.getElementById("path-facts")!;
  const chips = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-path]"));
  const cables = world.scene.meshes.filter((m) => /^cable_/.test(m.name));
  const cableMats = cables.map((m) => m.material).filter((m): m is PBRMaterial => m instanceof PBRMaterial);

  const anchorOf = (name: string) => {
    const tmp = new Vector3();
    return () => { const n = world.scene.getNodeByName(name); if (n && "getWorldMatrix" in n) (n as { getWorldMatrix(): { getTranslationToRef(v: Vector3): void } }).getWorldMatrix().getTranslationToRef(tmp); return tmp; };
  };
  const world3 = (x: number, y: number, z: number) => { const v = new Vector3(x, y, z); return () => v; };

  const pinDefs: Record<PathMode, { id: string; anchor: () => Vector3; k: string; v: string; dx?: number; dy?: number }[]> = {
    solar: [
      { id: "p3-panel", anchor: world3(0, 3.85, -0.05), k: "solar", v: "18–20 V DC down the pole", dx: 170, dy: 20 },
      { id: "p3-battery", anchor: world3(0, 2.45, -0.12), k: "battery box", v: "10.8 V · 19 Ah · BLE health", dx: 180, dy: 0 },
      { id: "p3-lead", anchor: world3(0, 2.98, -0.04), k: "DC lead", v: "into the rear connector", dx: 170, dy: -50 },
      { id: "p3-nodata", anchor: world3(0, 0.6, 0.0), k: "to the ground", v: "nothing · data is LTE only", dx: 170, dy: -20 },
    ],
    ac: [
      { id: "p3-acbox", anchor: world3(0, 2.45, -0.12), k: "junction box", v: "120 V in · indicator lights", dx: 180, dy: 0 },
      { id: "p3-conduit", anchor: world3(0, 1.2, -0.15), k: "conduit", v: "electrician's run to supply", dx: 160, dy: -20 },
      { id: "p3-kit", anchor: world3(0, 2.98, -0.04), k: "AC kit", v: "steps down to DC · $150 part", dx: 170, dy: -50 },
    ],
    wing: [
      { id: "p3-gw", anchor: anchorOf("wing_gateway"), k: "Wing Gateway 2.0", v: "8 / 16 / 32 streams", dx: 230, dy: 70 },
      { id: "p3-sw", anchor: anchorOf("poe_switch"), k: "PoE switch", v: "CAT6 to each camera", dx: 230, dy: -10 },
      { id: "p3-sfp", anchor: anchorOf("sfp_cutaway"), k: "SFP module ×6", v: "laser + photodiode on a card edge", dx: -60, dy: -120 },
      { id: "p3-fiber", anchor: anchorOf("fiber_cutaway"), k: "fiber ×40", v: "jacket · aramid · buffer · cladding · 9 µm core", dx: 160, dy: 140 },
      { id: "p3-cat6", anchor: anchorOf("cat6_cutaway"), k: "CAT6 ×12", v: "spline · 4 twisted pairs · 23 AWG", dx: 230, dy: 90 },
      { id: "p3-cam", anchor: anchorOf("existing_camera"), k: "existing camera", v: "RTSP stream in, plates out", dx: 120, dy: -140 },
    ],
  };
  for (const list of Object.values(pinDefs)) for (const p of list) pins.add({ ...p, cls: "amber" });

  const renderFacts = (mode: PathMode) => {
    const path = install.paths[mode]!;
    facts.innerHTML = `<p class="path-summary">${escape(path.summary)}</p>`;
    for (const f of path.facts) {
      const d = document.createElement("div");
      d.innerHTML = `<span class="k">${escape(f.k)}</span><span class="v">${escape(f.v)}</span>`;
      d.appendChild(cite(f.sources));
      facts.appendChild(d);
    }
  };

  const showPins = () => {
    if (state.act !== 3) { for (const list of Object.values(pinDefs)) for (const p of list) pins.show(p.id, false); return; }
    for (const [m, list] of Object.entries(pinDefs)) for (const p of list) pins.show(p.id, m === state.pathMode);
  };

  const applyPath = async (mode: PathMode) => {
    chips.forEach((c) => c.classList.toggle("is-active", c.dataset.path === mode));
    renderFacts(mode);
    const g = world.poleGroups;
    if (state.act === 3) {
      g.battery?.setEnabled(mode !== "ac");
      g.ac?.setEnabled(mode === "ac");
      g.solar?.setEnabled(mode !== "ac" && state.poleMode === "flock");
    }
    if (mode === "wing") { await world.loadAct("wing"); world.wing?.setEnabled(true); }
    else world.wing?.setEnabled(false);
    showPins();
  };

  chips.forEach((c) => c.addEventListener("click", () => set({ pathMode: c.dataset.path as PathMode })));
  subscribe((s, changed) => {
    if (changed.has("pathMode")) void applyPath(s.pathMode);
    if (changed.has("act")) {
      if (s.act === 3) void applyPath(s.pathMode);
      else if (s.act !== 6) {
        // restore the pole-mode configuration when leaving
        const g = world.poleGroups;
        g.battery?.setEnabled(s.poleMode !== "ac");
        g.ac?.setEnabled(s.poleMode === "ac");
        g.solar?.setEnabled(s.poleMode === "flock");
        world.wing?.setEnabled(false);
      }
      showPins();
    }
  });
  renderFacts(state.pathMode);
  showPins();

  // Cable pulse while in act 3 with the solar or AC path.
  world.scene.onBeforeRenderObservable.add(() => {
    const on = state.act === 3 && state.pathMode !== "wing";
    const t = performance.now() / 500;
    const k = on ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t)) : 0;
    for (const m of cableMats) m.emissiveColor = new Color3(0.95 * k, 0.7 * k, 0.25 * k);
  });
}
