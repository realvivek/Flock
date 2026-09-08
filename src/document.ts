/**
 * The main page: hero with a preview of the components grid and a link to the components page, then Deployments,
 * Pole, Power, Data, Claims, Economics and Sources in one scroll with section links at the top.
 */
import "./document.css";
import { components, install, dataflow, overview } from "./content";
import { cite, escape, tag, setCiteHandler } from "./ui/cite";
import { renderClaims, renderEconomics, renderSources, renderDeployments, revealSource } from "./ui/article";
import { BASE, still, nn, el, p, kv, facts, scrollToEl, initNav, reduced } from "./ui/common";
import { parseRoute, chapterFor } from "./router";
import { state, set } from "./store";

const COMPONENTS = "components/";

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

/** Older links (#/hardware/inside/13, #act-2, #s=inside/13, ?s=data/9, #src-<id>, #claim-<id>) still land on the right place. */
function resolveLegacy(): void {
  const h = location.hash;
  const q = new URLSearchParams(location.search).get("s");
  if (h.startsWith("#src-")) { revealSource(h.slice(5), "auto"); return; }
  if (!q && (h === "" || h === "#top" || document.getElementById(h.slice(1)))) return;
  const r = parseRoute(h, location.search);
  const ch = chapterFor(r);
  if (ch === "inside") {
    const pt = r.index !== undefined && r.index >= 6 ? parts[r.index - 6] : undefined;
    location.replace(`${COMPONENTS}${pt ? `#${pt.id}` : ""}`);
    return;
  }
  const id = ch === "overview" ? "top" : ch === "myths" ? "claims" : ch;
  if (r.anchor?.startsWith("src-")) { revealSource(r.anchor.slice(4), "auto"); return; }
  if (r.anchor) { const t = document.getElementById(r.anchor); if (t) { history.replaceState(null, "", `#${r.anchor}`); scrollToEl(t); return; } }
  if (id === "data" && r.index !== undefined) { const t = document.getElementById(`stage-${Math.max(1, Math.min(hops.length, r.index + 1))}`); if (t) { history.replaceState(null, "", `#${t.id}`); scrollToEl(t); return; } }
  history.replaceState(null, "", `#${id}`);
  scrollToEl(document.getElementById(id));
}

export function initDocument(): void {
  document.getElementById("hero-lede")!.textContent = overview.intro.lede;
  document.getElementById("hero-sources")!.textContent = overview.intro.sources;
  (document.getElementById("preview-img") as HTMLImageElement).src = `${BASE}img/knolling.jpg`;
  renderDeployments(document.getElementById("deployments-body")!);
  buildPole(document.getElementById("pole-body")!);
  buildPower(document.getElementById("power-body")!);
  buildData(document.getElementById("data-body")!);
  renderClaims(document.getElementById("myths")!, {
    onPart: (id) => { location.href = `${COMPONENTS}#${id}`; },
    onHop: (n) => scrollToEl(document.getElementById(`stage-${n}`)),
  });
  renderEconomics(document.getElementById("economics-body")!);
  renderSources(document.getElementById("sources-body")!);
  setCiteHandler((id) => revealSource(id));
  initNav();
  addEventListener("hashchange", resolveLegacy);
  set({ reducedMotion: reduced(), ready: true, mode: "stills" });
  document.getElementById("status")!.textContent = "";
  (window as unknown as { __flock: unknown }).__flock = { state, set, get frame() { return Math.floor(performance.now() / 16); } };
  requestAnimationFrame(resolveLegacy);
}
