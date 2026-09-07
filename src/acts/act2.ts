import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { components, hopById, stillById, EXPLODE_STAGES, PART_GROUPS } from "../content";
import { lerp, smooth } from "../lib/math";
import { cite, escape } from "../ui/cite";
import type { PinLayer } from "../ui/pins";
import type { World } from "../scene/world";
import { state, set, subscribe } from "../store";

const confidenceLabel = { measured: "Measured or documented", estimated: "Estimated from the envelope", disputed: "Sources disagree" } as const;

/** Inside tab: a see-through enclosure with a dot marker on every part and one leader per callout card; the stage slider
 *  separates the parts front to back while the shell fades back to solid. Selecting a card or a marker isolates the part. */
export function initAct2(world: World, pins: PinLayer): void {
  const card = document.getElementById("spec-card")!;
  const stageInput = document.getElementById("explode-stage") as HTMLInputElement;
  const stageReadout = document.getElementById("explode-readout")!;
  const parts = components.parts.slice().sort((a, b) => a.order - b.order);
  const buttons = new Map<string, HTMLButtonElement>();
  const nn = (o: number) => String(o).padStart(2, "0");

  // Callout cards in two columns flanking the model: rear-half parts on the left, front-half parts on the right.
  const BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const colL = document.getElementById("callouts-left")!;
  const colR = document.getElementById("callouts-right")!;
  const firstSentence = (t: string) => { const m = /^(.+?[.!?])(\s|$)/.exec(t); return m ? m[1]! : t; };
  for (const p of parts) {
    const front = p.group === "optics" || p.id === "bezel";
    const b = document.createElement("button");
    b.type = "button";
    b.className = `callout g-${p.group}`;
    b.dataset.part = p.id;
    b.dataset.order = String(p.order);
    b.setAttribute("role", "listitem");
    const still = stillById.get(`part-${p.id}`);
    b.innerHTML = `${still ? `<img src="${BASE}${still}" alt="" loading="lazy" decoding="async" />` : `<span class="thumb"></span>`}<span class="txt"><span class="n">${nn(p.order)}</span><span class="t">${escape(p.name)}</span><span class="d">${escape(firstSentence(p.function))}</span></span>`;
    b.addEventListener("click", () => {
      set({ focusedPart: state.focusedPart === p.id ? null : p.id });
    });
    b.addEventListener("pointerenter", () => set({ hoverPart: p.id }));
    b.addEventListener("pointerleave", () => { if (state.hoverPart === p.id) set({ hoverPart: null }); });
    (front ? colR : colL).appendChild(b);
    buttons.set(p.id, b);
  }
  for (const g of PART_GROUPS) {
    const members = parts.filter((p) => p.group === g.id);
    if (members.length) pins.addHalo({ id: g.id, caption: `${g.label} · ${members.length === 1 ? nn(members[0]!.order) : `${nn(members[0]!.order)}–${nn(members[members.length - 1]!.order)}`}`, parts: members.map((m) => m.id) });
  }
  // One thin leader per card, from the card's inner edge to its badge, coloured by group.
  const svg = document.getElementById("leaders") as unknown as SVGSVGElement;
  const leaders = new Map<string, SVGPolylineElement>();
  for (const p of parts) {
    const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    pl.setAttribute("class", `leader g-${p.group}`);
    pl.setAttribute("fill", "none");
    svg.appendChild(pl);
    leaders.set(p.id, pl);
  }

  for (const p of parts) {
    const rec = world.parts.get(p.id);
    if (!rec) continue;
    // Anchor at the part's own bounding centre (fixed in the node's frame), not the node origin: at rest every
    // node sits at the body centre, which would put all fourteen anchors on one point.
    rec.node.computeWorldMatrix(true);
    const bb = rec.node.getHierarchyBoundingVectors(true);
    const local = Vector3.TransformCoordinates(bb.min.add(bb.max).scale(0.5), rec.node.getWorldMatrix().clone().invert());
    const tmp = new Vector3();
    pins.add({
      id: `part-${p.id}`,
      anchor: () => Vector3.TransformCoordinatesToRef(local, rec.node.getWorldMatrix(), tmp),
      k: nn(p.order),
      v: p.name,
      badge: true,
      halo: p.group,
      cls: `g-${p.group}`,
      onHover: (on) => set({ hoverPart: on ? p.id : state.hoverPart === p.id ? null : state.hoverPart }),
      onClick: () => set({ focusedPart: state.focusedPart === p.id ? null : p.id }),
    });
  }

  // Markers are dots at each part's centre; the numbers live on the cards.
  pins.dots = true;

  // Stage control
  const setStage = (n: number) => set({ explodeStage: Math.max(0, Math.min(5, Math.round(n))) });
  stageInput.addEventListener("input", () => setStage(Number(stageInput.value)));
  document.getElementById("explode-prev")!.addEventListener("click", () => setStage(state.explodeStage - 1));
  document.getElementById("explode-next")!.addEventListener("click", () => setStage(state.explodeStage + 1));
  const renderStage = () => {
    const s = EXPLODE_STAGES[state.explodeStage] ?? EXPLODE_STAGES[0];
    stageInput.value = String(state.explodeStage);
    stageReadout.textContent = `Stage ${state.explodeStage} of 5 · ${s.label}. ${s.copy}`;
    (document.getElementById("explode-prev") as HTMLButtonElement).disabled = state.explodeStage === 0;
    (document.getElementById("explode-next") as HTMLButtonElement).disabled = state.explodeStage === 5;
  };

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

  // Hover tooltip: one name near the hovered badge.
  const tip = document.createElement("div");
  tip.className = "pin-tip";
  tip.hidden = true;
  document.getElementById("pins")!.appendChild(tip);
  const renderHover = () => {
    for (const [id, b] of buttons) b.classList.toggle("is-hover", id === state.hoverPart);
    pins.highlight(state.hoverPart ? `part-${state.hoverPart}` : null);
    const p = parts.find((x) => x.id === state.hoverPart);
    if (!p) { tip.hidden = true; return; }
    tip.textContent = `${nn(p.order)} · ${p.name}`;
    tip.hidden = false;
  };
  // Cards in each column follow the vertical order of their badges once the camera has settled, so the leaders
  // fan out from the column without crossing one another.
  const orderKey = { left: "", right: "" };
  const reorder = (col: HTMLElement, side: "left" | "right") => {
    const rows = Array.from(col.children as HTMLCollectionOf<HTMLElement>);
    const ys = rows.map((b) => ({ b, y: pins.badgePos(`part-${b.dataset.part}`)?.y ?? Number.POSITIVE_INFINITY }));
    const sorted = ys.slice().sort((a, b) => a.y - b.y || Number(a.b.dataset.order) - Number(b.b.dataset.order));
    const key = sorted.map((r) => r.b.dataset.part).join(",");
    if (key === orderKey[side]) return;
    orderKey[side] = key;
    sorted.forEach((r, i) => { r.b.style.order = String(i); });
  };
  world.scene.onAfterRenderObservable.add(() => {
    // Leaders follow the badges; only drawn when the card column is visible and the part is separated.
    const showLeaders = state.act === 2;
    if (showLeaders && !state.tweening) { reorder(colL, "left"); reorder(colR, "right"); }
    for (const p of parts) {
      const pl = leaders.get(p.id)!;
      const pos = showLeaders ? pins.badgePos(`part-${p.id}`) : null;
      const b = buttons.get(p.id)!;
      if (!pos || b.offsetParent === null || (state.focusedPart && state.focusedPart !== p.id)) { pl.setAttribute("opacity", "0"); continue; }
      const r = b.getBoundingClientRect();
      const left = b.parentElement === colL;
      const x0 = left ? r.right : r.left, y0 = r.top + r.height / 2;
      const x1 = left ? x0 + 16 : x0 - 16;
      pl.setAttribute("points", `${x0.toFixed(1)},${y0.toFixed(1)} ${x1.toFixed(1)},${y0.toFixed(1)} ${pos.x.toFixed(1)},${pos.y.toFixed(1)}`);
      pl.setAttribute("opacity", state.hoverPart && state.hoverPart !== p.id ? "0.25" : "1");
      pl.classList.toggle("is-hl", state.hoverPart === p.id);
    }
    if (tip.hidden || !state.hoverPart) return;
    const el = document.querySelector<HTMLElement>(`#pins .pin.badge.is-hl`);
    if (!el) { tip.hidden = true; return; }
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth || 160;
    const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const y = r.top - 34 > 56 ? r.top - 34 : r.bottom + 8;
    tip.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
  });

  const renderCard = (id: string | null) => {
    if (!id) { card.hidden = true; return; }
    const p = parts.find((x) => x.id === id);
    if (!p) { card.hidden = true; return; }
    const hop = p.hop ? hopById.get(p.hop) : null;
    const spec = Object.entries(p.spec).map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join("");
    card.innerHTML = `
      <h3>${nn(p.order)} · ${escape(p.name)}</h3>
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
    if (changed.has("hoverPart")) renderHover();
    if (changed.has("explodeStage")) renderStage();
    if (changed.has("act") && s.act !== 2) { if (s.focusedPart) set({ focusedPart: null }); if (s.hoverPart) set({ hoverPart: null }); }
  });
  renderStage();

  // Shell opacity: see-through while assembled, solid once the parts have separated (nothing is hidden then).
  // Isolating a part restores the shell so the bezel and rear shell can be inspected on their own.
  let shellAlpha = -1;
  world.scene.onBeforeRenderObservable.add(() => {
    const p2 = state.acts[2] ?? 0;
    const inAct = state.act === 2;
    const want = inAct && !state.focusedPart ? lerp(0.16, 1, smooth(p2)) : 1;
    if (Math.abs(want - shellAlpha) > 0.004) { shellAlpha = want; world.setShellAlpha(want); }
    for (const p of parts) pins.show(`part-${p.id}`, inAct && (!state.focusedPart || state.focusedPart === p.id));
    for (const g of PART_GROUPS) pins.showHalo(g.id, false);
  });
}
