/**
 * The page: one scrolling document with section links at the top, a knolling grid of the fourteen components in
 * five groups, and the pole, power, data, claims, economics and sources sections beneath. Desktops that can run
 * a 3D engine get a locator beside the grid; every other screen gets the same document with stills.
 */
import "./document.css";
import { components, install, dataflow, economics, overview, stillById, partById, hopById, EXPLODE_STAGES, PART_GROUPS } from "./content";
import { cite, escape, tag, setCiteHandler } from "./ui/cite";
import { renderClaims, renderEconomics, renderSources, renderDeployments, revealSource } from "./ui/article";
import { parseRoute, chapterFor } from "./router";
import { state, set, subscribe } from "./store";

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");
const still = (id: string) => `${BASE}${stillById.get(id) ?? ""}`;
const nn = (o: number) => String(o).padStart(2, "0");
const confidenceLabel = { measured: "Measured or documented", estimated: "Estimated from the envelope", disputed: "Sources disagree" } as const;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const p = (host: HTMLElement, text: string, cls = "") => { const e = el("p", cls); e.textContent = text; host.appendChild(e); return e; };
const kv = (host: HTMLElement, rows: [string, string][]) => { const dl = el("dl", "kv"); for (const [k, v] of rows) dl.insertAdjacentHTML("beforeend", `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`); host.appendChild(dl); return dl; };
const facts = (host: HTMLElement, rows: { k: string; v: string; sources: string[] }[]) => { const dl = el("dl", "kv"); for (const r of rows) { dl.insertAdjacentHTML("beforeend", `<dt>${escape(r.k)}</dt><dd>${escape(r.v)}</dd>`); dl.lastElementChild!.appendChild(cite(r.sources, 1)); } host.appendChild(dl); };

/** Small inline diagram for a data stage: camera, cloud, officer and network, with the active stage lit. */
function hopSvg(n: number): string {
  const stage = n <= 3 ? 0 : n === 4 ? 1 : n <= 8 ? 2 : n === 9 ? 3 : n <= 11 ? 4 : 5;
  const on = (i: number) => (stage === i ? "#1b4fd8" : "#c9cdd4");
  const fill = (i: number) => (stage === i ? "rgba(27,79,216,.12)" : "#fff");
  const dots = Array.from({ length: 90 }, (_, i) => { const x = 250 + (i % 15) * 9, y = 40 + Math.floor(i / 15) * 9; const lit = stage === 4 && (i * 7) % 5 !== 0; return `<circle cx="${x}" cy="${y}" r="2.2" fill="${lit ? "#1b4fd8" : "#dfe3ea"}"/>`; }).join("");
  return `<svg viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Mono, monospace" font-size="9" role="img" aria-label="Diagram of stage ${n}">
    <defs><marker id="a${n}" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" fill="#7c8390"/></marker></defs>
    <rect x="20" y="70" width="46" height="70" rx="4" fill="${fill(0)}" stroke="${on(0)}" stroke-width="1.5"/><circle cx="43" cy="92" r="9" fill="none" stroke="${on(0)}"/><text x="43" y="160" text-anchor="middle" fill="#4a505a">camera</text>
    <path d="M70 105 C 100 105, 100 60, 130 60" fill="none" stroke="${on(1)}" stroke-width="1.5" marker-end="url(#a${n})"/><text x="100" y="52" text-anchor="middle" fill="${stage === 1 ? "#1b4fd8" : "#7c8390"}">LTE · TLS</text>
    <rect x="132" y="35" width="90" height="50" rx="8" fill="${fill(2)}" stroke="${on(2)}" stroke-width="1.5"/><text x="177" y="56" text-anchor="middle" fill="#4a505a">S3 · RDS</text><text x="177" y="70" text-anchor="middle" fill="#4a505a">DynamoDB</text><text x="177" y="100" text-anchor="middle" fill="#4a505a">cloud · US</text>
    <path d="M177 88 C 177 115, 177 115, 177 130" fill="none" stroke="${on(3)}" stroke-width="1.5" marker-end="url(#a${n})"/>
    <rect x="165" y="132" width="24" height="40" rx="4" fill="${fill(3)}" stroke="${on(3)}" stroke-width="1.5"/><text x="177" y="178" text-anchor="middle" fill="#4a505a">officer</text>
    <path d="M224 60 C 240 60, 240 60, 246 60" fill="none" stroke="${on(4)}" stroke-width="1.5" marker-end="url(#a${n})"/>${dots}<text x="313" y="110" text-anchor="middle" fill="#4a505a">6,809 networks</text>
    <text x="313" y="150" text-anchor="middle" fill="${stage === 5 ? "#1b4fd8" : "#7c8390"}">${stage === 5 ? "deleted after retention" : "audit row per search"}</text>
  </svg>`;
}

const parts = components.parts.slice().sort((a, b) => a.order - b.order);
const hops = dataflow.hops.slice().sort((a, b) => a.n - b.n);
const cells = new Map<string, HTMLButtonElement>();
let detail: HTMLElement | null = null;

/** Scroll an element into view under the sticky header. */
function scrollToEl(target: Element | null, block: ScrollLogicalPosition = "start"): void {
  if (!target) return;
  target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block });
}

// ---- Components: knolling grid in five groups, a detail block under the selected part's group --------------
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
      <p class="fine">${confidenceLabel[pt.confidence]}${hop ? ` · <a href="#stage-${hop.n}">data stage ${nn(hop.n)}: ${escape(hop.title)}</a>` : ""}</p>
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

// ---- Pole, power and data sections from the install and dataflow content -------------------------------
function buildPole(host: HTMLElement): void {
  for (const m of ["flock", "existing", "ac"] as const) {
    const mode = install.modes[m]!;
    const card = el("article", "card sheet");
    card.innerHTML = `<figure><img src="${still(`pole-${m}`)}" alt="${escape(mode.label)}" loading="lazy" decoding="async" /></figure><h3>${escape(mode.label)}</h3>`;
    facts(card, mode.facts);
    host.appendChild(card);
  }
  const c = install.coverage;
  const fov = el("article", "card sheet wide");
  fov.innerHTML = `<figure><img src="${still("falcon-side")}" alt="Falcon side view" loading="lazy" decoding="async" /></figure><h3>Field of view</h3>`;
  kv(fov, [["Field of view", `${c.widthFt} ft wide at ${c.distFt} ft`], ["Range", `up to ${c.maxFt} ft, ${c.lanes} lanes, ${c.mph} mph`], ["Frames", `${c.framesPerVehicle} stills per vehicle`], ["Aims at", c.aims]]);
  fov.appendChild(cite(c.sources));
  p(fov, "Flock's specification sheet gives the field of view at 65 ft; Flock's product page gives a range of up to 100 ft.", "fine");
  host.appendChild(fov);
}

function buildPower(host: HTMLElement): void {
  for (const m of ["solar", "ac", "wing"] as const) {
    const path = install.paths[m]!;
    const card = el("article", "card sheet");
    card.innerHTML = `<figure><img src="${still(m === "wing" ? "wing-closet" : m === "ac" ? "pole-ac" : "pole-flock")}" alt="${escape(path.label)}" loading="lazy" decoding="async" /></figure><h3>${escape(path.label)}</h3>`;
    p(card, path.summary);
    facts(card, path.facts);
    host.appendChild(card);
  }
}

function buildData(host: HTMLElement): void {
  for (const h of hops) {
    const row = el("article", "stage sheet");
    row.id = `stage-${h.n}`;
    const meta: [string, string][] = [["Where", h.where]];
    if (h.transport) meta.push(["Transport", h.transport]);
    if (h.storage) meta.push(["Storage", h.storage]);
    if (h.retention) meta.push(["Retention", h.retention]);
    meta.push(["In the packet", h.payload.join(", ")]);
    row.innerHTML = `<div class="stage-fig">${hopSvg(h.n)}</div><div class="stage-body"><div class="mono cyan">Stage ${nn(h.n)} of ${hops.length}</div><h3>${escape(h.title)} ${tag(h.tag)}</h3><p>${escape(h.summary)}</p></div>`;
    const body = row.querySelector(".stage-body")!;
    kv(body as HTMLElement, meta);
    if (h.unknowns?.length) body.insertAdjacentHTML("beforeend", `<p class="fine">${tag("unknown")} ${h.unknowns.map(escape).join(" · ")}</p>`);
    body.appendChild(cite(h.sources));
    host.appendChild(row);
  }
  // Retention presets
  const ret = el("article", "stage sheet tool");
  ret.innerHTML = `<div class="stage-fig">${hopSvg(12)}</div><div class="stage-body"><div class="mono cyan">Retention</div><h3>Retention periods</h3><p>Retention presets from Flock's default and from state statutes.</p><div class="toggle-row" id="retention-chips"></div><p class="aim-readout cyan" id="retention-readout"></p></div>`;
  const chips = ret.querySelector<HTMLElement>("#retention-chips")!;
  const out = ret.querySelector<HTMLElement>("#retention-readout")!;
  const setRet = (i: number) => { const r = dataflow.retentionPresets[i]!; out.textContent = `${r.label}: ${r.note}`; chips.querySelectorAll("button").forEach((b, j) => b.classList.toggle("is-active", j === i)); set({ retentionIndex: i }); };
  dataflow.retentionPresets.forEach((r, i) => { const b = el("button", "chip", escape(r.label)); b.type = "button"; b.addEventListener("click", () => setRet(i)); chips.appendChild(b); });
  ret.querySelector(".stage-body")!.appendChild(cite(dataflow.retentionPresets.flatMap((r) => r.sources), 3));
  host.appendChild(ret);
  setRet(0);
  // Network search example
  const d = dataflow.deputy;
  const dep = el("article", "stage sheet tool");
  dep.innerHTML = `<div class="stage-fig">${hopSvg(10)}</div><div class="stage-body"><div class="mono cyan">Network search</div><h3>Network search example</h3><p>Enter a reason and run the search. The camera and network counts shown are those recorded in the audit log of one documented April 2025 query. The log records no warrant; a case number became a mandatory field in August 2026.</p><form id="deputy-form"><input id="deputy-reason" type="text" maxlength="60" placeholder="Reason for search" aria-label="Reason for search" /><button type="submit" class="chip">Search network</button></form><p class="aim-readout cyan" id="deputy-readout"></p></div>`;
  const form = dep.querySelector<HTMLFormElement>("#deputy-form")!;
  const readout = dep.querySelector<HTMLElement>("#deputy-readout")!;
  form.addEventListener("submit", (e) => { e.preventDefault(); const r = (form.querySelector("input") as HTMLInputElement).value.trim() || d.reasonAsLogged; set({ deputyReason: r }); readout.textContent = `Reason as logged: “${r}” · ${d.networks.toLocaleString()} networks · ${d.cameras.toLocaleString()} cameras · ${d.lookbackDays}-day lookback · ${d.date}`; });
  dep.querySelector(".stage-body")!.appendChild(cite(d.sources));
  host.appendChild(dep);
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
    // Explode stage control
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

// ---- Navigation: section links, current section, Top button, legacy hashes --------------------------------
function initNav(): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".sections a"));
  const secs = Array.from(document.querySelectorAll<HTMLElement>("section.sec"));
  const nav = document.querySelector<HTMLElement>(".sections")!;
  let current = "";
  const mark = (id: string) => {
    if (id === current) return;
    current = id;
    for (const a of links) a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`);
    const a = links.find((l) => l.getAttribute("href") === `#${id}`);
    if (a && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2);
  };
  const io = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    const top = visible[0]?.target as HTMLElement | undefined;
    if (top) mark(top.id);
  }, { rootMargin: "-20% 0px -65% 0px", threshold: 0 });
  secs.forEach((s) => io.observe(s));
  const totop = document.getElementById("totop") as HTMLAnchorElement;
  const onScroll = () => { totop.hidden = scrollY < 500; if (scrollY < 200) mark(""); };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  totop.addEventListener("click", (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); history.replaceState(null, "", location.pathname + location.search); });
}

/** Older links (#/hardware/inside/13, #act-2, #s=inside/13, ?s=data/9, #src-<id>, #claim-<id>) still land on the right place. */
function resolveLegacy(): void {
  const h = location.hash;
  const q = new URLSearchParams(location.search).get("s");
  if (!q && (h === "" || h === "#top" || document.getElementById(h.slice(1)))) return;
  const r = parseRoute(h, location.search);
  const ch = chapterFor(r);
  const id = ch === "overview" ? "top" : ch === "inside" ? "components" : ch === "myths" ? "claims" : ch;
  if (r.anchor?.startsWith("src-")) { revealSource(r.anchor.slice(4), "auto"); return; }
  if (r.anchor) { const t = document.getElementById(r.anchor); if (t) { history.replaceState(null, "", `#${r.anchor}`); scrollToEl(t); return; } }
  if (id === "components" && r.index !== undefined) {
    if (r.index >= 6) { const pt = parts[r.index - 6]; if (pt) set({ focusedPart: pt.id }); }
    else set({ explodeStage: r.index });
  }
  if (id === "data" && r.index !== undefined) { const t = document.getElementById(`stage-${Math.max(1, Math.min(hops.length, r.index + 1))}`); if (t) { history.replaceState(null, "", `#${t.id}`); scrollToEl(t); return; } }
  history.replaceState(null, "", `#${id}`);
  scrollToEl(document.getElementById(id));
}

export function initDocument(): void {
  document.getElementById("hero-lede")!.textContent = overview.intro.lede;
  document.getElementById("hero-sources")!.textContent = overview.intro.sources;
  (document.getElementById("preview-img") as HTMLImageElement).src = `${BASE}img/knolling.jpg`;
  renderDeployments(document.getElementById("deployments-body")!);
  buildKnolling(document.getElementById("knolling")!);
  buildPole(document.getElementById("pole-body")!);
  buildPower(document.getElementById("power-body")!);
  buildData(document.getElementById("data-body")!);
  renderClaims(document.getElementById("myths")!, {
    onPart: (id) => { set({ focusedPart: id }); scrollToEl(cells.get(id) ?? document.getElementById("components")); },
    onHop: (n) => scrollToEl(document.getElementById(`stage-${n}`)),
  });
  renderEconomics(document.getElementById("economics-body")!);
  renderSources(document.getElementById("sources-body")!);
  setCiteHandler((id) => revealSource(id));
  subscribe((s, changed) => { if (changed.has("focusedPart")) renderDetail(s.focusedPart); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && state.focusedPart) set({ focusedPart: null }); });
  initNav();
  addEventListener("hashchange", resolveLegacy);
  set({ reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
  (window as unknown as { __flock: unknown }).__flock = { state, set, get frame() { return Math.floor(performance.now() / 16); } };
  void initLocator().finally(() => requestAnimationFrame(resolveLegacy));
}
