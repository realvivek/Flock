/**
 * The components page: the fourteen parts of the Falcon V2 in a knolling grid in five groups, the record of the
 * selected part under its group, and on desktops that can run a 3D engine a locator that frames the part.
 */
import { components, partById, hopById, stillById, EXPLODE_STAGES, PART_GROUPS } from "./content";
import { cite, escape } from "./ui/cite";
import { still, nn, el, scrollToEl } from "./ui/common";
import { BASE, ROOT } from "./lib/base";
import { parseRoute, chapterFor } from "./router";
import { state, set, subscribe } from "./store";

const confidenceLabel = { measured: "Measured or documented", estimated: "Estimated from the envelope", disputed: "Sources disagree" } as const;
const parts = components.parts.slice().sort((a, b) => a.order - b.order);
const cells = new Map<string, HTMLButtonElement>();
let detail: HTMLElement | null = null;

function buildKnolling(host: HTMLElement): void {
  for (const g of PART_GROUPS) {
    const members = parts.filter((x) => x.group === g.id);
    if (!members.length) continue;
    const group = el("div", `group g-${g.id}`);
    group.dataset.group = g.id;
    group.innerHTML = `<div class="group-head"><span class="mono">${members.length === 1 ? nn(members[0]!.order) : `${nn(members[0]!.order)}–${nn(members[members.length - 1]!.order)}`}</span><h3>${escape(g.label)}</h3><span class="count">${members.length} part${members.length === 1 ? "" : "s"}</span></div>`;
    const grid = el("div", "cells");
    grid.setAttribute("role", "list");
    for (const pt of members) {
      const b = el("button", "cell");
      b.type = "button";
      b.dataset.part = pt.id;
      b.setAttribute("role", "listitem");
      b.setAttribute("aria-expanded", "false");
      const s = stillById.get(`part-${pt.id}`);
      b.innerHTML = `${s ? `<img src="${BASE}${s}" alt="" loading="lazy" decoding="async" />` : `<span class="thumb"></span>`}<span class="txt"><span class="n">${nn(pt.order)}</span><span class="t">${escape(pt.name)}</span><span class="pn">${escape(pt.partNumber ?? "")}</span></span>`;
      b.addEventListener("click", () => set({ focusedPart: state.focusedPart === pt.id ? null : pt.id }));
      grid.appendChild(b);
      cells.set(pt.id, b);
    }
    group.appendChild(grid);
    host.appendChild(group);
  }
}

function renderDetail(id: string | null): void {
  for (const [pid, b] of cells) { b.classList.toggle("is-active", pid === id); b.setAttribute("aria-expanded", String(pid === id)); }
  detail?.remove(); detail = null;
  history.replaceState(null, "", location.pathname + location.search + (id ? `#${id}` : ""));
  if (!id) return;
  const pt = partById.get(id);
  const cell = cells.get(id);
  if (!pt || !cell) return;
  const hop = pt.hop ? hopById.get(pt.hop) : null;
  const d = el("div", `detail g-${pt.group}`);
  d.id = "part-detail";
  d.innerHTML = `
    <div class="detail-fig"><img src="${still(`part-${pt.id}`)}" alt="" /></div>
    <div class="detail-body">
      <div class="mono">${nn(pt.order)} · ${escape(PART_GROUPS.find((g) => g.id === pt.group)?.label ?? pt.group)}</div>
      <h3>${escape(pt.name)}</h3>
      ${pt.partNumber ? `<div class="pn">${escape(pt.partNumber)}${pt.vendor ? " · " + escape(pt.vendor) : ""}</div>` : ""}
      <p>${escape(pt.function)}</p>
      <dl class="kv">${Object.entries(pt.spec).map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join("")}</dl>
      <p class="fine">${confidenceLabel[pt.confidence]}${hop ? ` · <a href="${ROOT}data/#stage-${hop.n}">data stage ${nn(hop.n)}: ${escape(hop.title)}</a>` : ""}</p>
    </div>`;
  const body = d.querySelector(".detail-body")!;
  body.appendChild(cite(pt.sources));
  const close = el("button", "chip", "Close");
  close.type = "button";
  close.addEventListener("click", () => set({ focusedPart: null }));
  body.appendChild(close);
  cell.closest(".group")!.appendChild(d);
  detail = d;
  // Bring the record into view; a record taller than the viewport (phones) aligns its top under the header.
  requestAnimationFrame(() => { const r = d.getBoundingClientRect(); if (r.bottom > innerHeight || r.top < 60) scrollToEl(d, r.height > innerHeight * 0.6 ? "start" : "nearest"); });
}

// ---- Locator: 3D on capable desktops, the assembled still elsewhere ---------------------------------------
async function initLocator(): Promise<void> {
  const canvas = document.getElementById("locator-canvas") as HTMLCanvasElement;
  const img = document.getElementById("locator-img") as HTMLImageElement;
  const ui = document.getElementById("locator-ui")!;
  const note = document.getElementById("locator-note")!;
  const status = document.getElementById("status")!;
  const q = new URLSearchParams(location.search);
  const wantStills = q.get("mode") === "stills" || (q.get("mode") !== "3d" && matchMedia("(max-width: 800px)").matches);
  const fallback = (why: unknown) => {
    console.warn("locator: stills", why);
    canvas.hidden = true; ui.hidden = true;
    img.src = still("explode-0"); img.hidden = false;
    note.textContent = "The assembled camera. Select a part for its record.";
    status.textContent = "stills";
    set({ ready: true, mode: "stills" });
  };
  if (wantStills) { fallback("small screen"); return; }
  canvas.hidden = false;
  try {
    const { initLocator: boot } = await import("./locator");
    const loc = await boot(canvas, status);
    ui.hidden = false;
    (window as unknown as { __flock: unknown }).__flock = { state, set, scene: loc.scene, engine: loc.engine, world: loc.world, get frame() { return loc.frame; } };
    const input = document.getElementById("explode-stage") as HTMLInputElement;
    const readout = document.getElementById("explode-readout")!;
    const setStage = (n: number) => set({ explodeStage: Math.max(0, Math.min(5, Math.round(n))) });
    input.addEventListener("input", () => setStage(Number(input.value)));
    document.getElementById("explode-prev")!.addEventListener("click", () => setStage(state.explodeStage - 1));
    document.getElementById("explode-next")!.addEventListener("click", () => setStage(state.explodeStage + 1));
    const renderStage = () => {
      const s = EXPLODE_STAGES[state.explodeStage] ?? EXPLODE_STAGES[0];
      input.value = String(state.explodeStage);
      readout.textContent = `Stage ${state.explodeStage} of 5 · ${s.label}. ${s.copy}`;
      (document.getElementById("explode-prev") as HTMLButtonElement).disabled = state.explodeStage === 0;
      (document.getElementById("explode-next") as HTMLButtonElement).disabled = state.explodeStage === 5;
    };
    subscribe((_, changed) => { if (changed.has("explodeStage")) renderStage(); });
    renderStage();
    loc.engine.onContextLostObservable.add(() => fallback("context lost"));
  } catch (e) { fallback(e); }
}

/** `#som` opens a part; older links (#/hardware/inside/13, #s=inside/13, ?s=inside/13, #act-2) still resolve.
 *  Section and skip-link hashes (#top, #main) and anything that names an element on this page are left alone. */
function resolveHash(): void {
  const h = location.hash.slice(1);
  if (partById.has(h)) { if (state.focusedPart !== h) set({ focusedPart: h }); return; }
  const q = new URLSearchParams(location.search).get("s");
  if (!q && (!h || document.getElementById(h))) return;
  if (!q && !/^(\/|act-|s=)/.test(h)) return;
  const r = parseRoute(location.hash, location.search);
  if (chapterFor(r) === "inside") {
    if (r.index !== undefined) {
      if (r.index >= 6) { const pt = parts[r.index - 6]; if (pt) set({ focusedPart: pt.id }); }
      else set({ explodeStage: r.index });
    }
  } else location.replace(`${ROOT}${location.hash}`);
}

export function initComponentsPage(): void {
  buildKnolling(document.getElementById("knolling")!);
  subscribe((s, changed) => { if (changed.has("focusedPart")) renderDetail(s.focusedPart); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && state.focusedPart) set({ focusedPart: null }); });
  addEventListener("hashchange", resolveHash);
  (window as unknown as { __flock: unknown }).__flock = { state, set, get frame() { return Math.floor(performance.now() / 16); } };
  // Resolve the address at once so a linked record opens before the locator has loaded its models.
  resolveHash();
  void initLocator().finally(() => requestAnimationFrame(resolveHash));
}
