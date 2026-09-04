import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { components, hopById } from "../content";
import { cite, escape } from "../ui/cite";
import type { PinLayer } from "../ui/pins";
import type { World } from "../scene/world";
import { state, set, subscribe } from "../store";

const confidenceLabel = { measured: "Measured or documented", estimated: "Estimated from the envelope", disputed: "Sources disagree" } as const;

/** Act 2: exploded view. Part list, spec card, isolate, and pins on each part once it has separated. */
export function initAct2(world: World, pins: PinLayer): void {
  const list = document.getElementById("part-list")!;
  const card = document.getElementById("spec-card")!;
  const parts = components.parts.slice().sort((a, b) => a.order - b.order);
  const buttons = new Map<string, HTMLButtonElement>();

  for (const p of parts) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span class="n">${String(p.order).padStart(2, "0")}</span>${escape(p.name)}`;
    b.addEventListener("click", () => set({ focusedPart: state.focusedPart === p.id ? null : p.id }));
    list.appendChild(b);
    buttons.set(p.id, b);
    const rec = world.parts.get(p.id);
    if (rec) {
      const tmp = new Vector3();
      pins.add({
        id: `part-${p.id}`,
        anchor: () => { rec.node.getWorldMatrix().getTranslationToRef(tmp); return tmp; },
        k: String(p.order).padStart(2, "0"),
        v: p.name.length > 30 ? p.name.slice(0, 28) + "…" : p.name,
        group: "parts",
      });
    }
  }

  // Pick a part in 3D
  const canvas = document.getElementById("stage") as HTMLCanvasElement;
  let down = { x: 0, y: 0 };
  canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", (e) => {
    if (state.act !== 2) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const pick = world.scene.pick(e.clientX * devicePixelRatio * world.scene.getEngine().getHardwareScalingLevel(), e.clientY * devicePixelRatio * world.scene.getEngine().getHardwareScalingLevel());
    const id = (pick?.pickedMesh?.metadata as { partId?: string } | undefined)?.partId ?? null;
    set({ focusedPart: id === state.focusedPart ? null : id });
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") set({ focusedPart: null }); });

  const renderCard = (id: string | null) => {
    if (!id) { card.hidden = true; return; }
    const p = parts.find((x) => x.id === id);
    if (!p) { card.hidden = true; return; }
    const hop = p.hop ? hopById.get(p.hop) : null;
    const spec = Object.entries(p.spec).map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join("");
    card.innerHTML = `
      <h3>${String(p.order).padStart(2, "0")} · ${escape(p.name)}</h3>
      ${p.partNumber ? `<div class="pn">${escape(p.partNumber)}${p.vendor ? " · " + escape(p.vendor) : ""}</div>` : ""}
      <p>${escape(p.function)}</p>
      <dl>${spec}</dl>
      <p class="fine">${confidenceLabel[p.confidence]}${hop ? ` · data stage ${hop.n}: ${escape(hop.title)}` : ""}</p>
    `;
    card.appendChild(cite(p.sources));
    const close = document.createElement("button");
    close.className = "chip";
    close.textContent = "Close";
    close.addEventListener("click", () => set({ focusedPart: null }));
    card.appendChild(close);
    card.hidden = false;
  };

  subscribe((s, changed) => {
    if (changed.has("focusedPart")) {
      for (const [id, b] of buttons) b.classList.toggle("is-active", id === s.focusedPart);
      world.isolate(s.focusedPart);
      renderCard(s.focusedPart);
    }
    if (changed.has("act") && s.act !== 2 && s.focusedPart) set({ focusedPart: null });
  });

  // Pins appear as parts separate.
  world.scene.onBeforeRenderObservable.add(() => {
    const p2 = state.acts[2] ?? 0;
    const inAct = state.act === 2 && p2 > 0.2 && p2 < 0.9;
    for (const p of parts) {
      const rec = world.parts.get(p.id);
      const sep = rec ? Vector3.Distance(rec.node.position, rec.rest) : 0;
      pins.show(`part-${p.id}`, inAct && (sep > 0.02 || p.id === "mainboard") && (!state.focusedPart || state.focusedPart === p.id));
    }
  });
}
