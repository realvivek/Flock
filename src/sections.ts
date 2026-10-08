/** The Pole, Power and Data pages, built from the install and dataflow content. */
import { install, dataflow } from "./content";
import { cite, escape, tag } from "./ui/cite";
import { still, nn, el, p, kv, facts, topbarHeight } from "./ui/common";
import { icon } from "./ui/icons";
import { set } from "./store";

const hops = dataflow.hops.slice().sort((a, b) => a.n - b.n);

// ---- Pole, power and data sections from the install and dataflow content -------------------------------
export function buildPole(host: HTMLElement): void {
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

export function buildPower(host: HTMLElement): void {
  for (const m of ["solar", "ac", "wing"] as const) {
    const path = install.paths[m]!;
    const card = el("article", "card sheet");
    card.innerHTML = `<figure><img src="${still(m === "wing" ? "wing-closet" : m === "ac" ? "pole-ac" : "pole-flock")}" alt="${escape(path.label)}" loading="lazy" decoding="async" /></figure><h3>${escape(path.label)}</h3>`;
    p(card, path.summary);
    facts(card, path.facts);
    host.appendChild(card);
  }
}

/** The pipeline the reads travel through; each node covers one or more of the twelve stages. */
const NODES: { id: string; label: string; sub: string; stages: number[]; icon: string }[] = [
  { id: "pole", label: "Camera", sub: "on the pole", stages: [1, 2, 3], icon: "pole" },
  { id: "lte", label: "Cellular network", sub: "carrier SIM, encrypted", stages: [4], icon: "tower" },
  { id: "cloud", label: "Flock’s cloud", sub: "Amazon Web Services, U.S.", stages: [5, 6, 7], icon: "cloud" },
  { id: "lists", label: "Hot lists", sub: "NCIC, state and custom lists", stages: [8], icon: "list" },
  { id: "phone", label: "Officers’ phones", sub: "alert in about 10 to 15 seconds", stages: [9], icon: "phone" },
  { id: "search", label: "Network search", sub: "own, shared and national", stages: [10], icon: "search" },
  { id: "audit", label: "Audit log", sub: "a row for every search", stages: [11], icon: "list" },
  { id: "bin", label: "Deletion", sub: "after 7 days by default", stages: [12], icon: "bin" },
];
const nodeOf = (n: number) => NODES.find((x) => x.stages.includes(n))!;

/** The Data page: the pipeline diagram stays beside the stages (a progress bar under the header on phones) and lights
 *  the node of the stage being read, with what travels at that stage. */
export function buildData(host: HTMLElement): void {
  host.classList.add("datapath");
  const diagram = el("aside", "dp-diagram");
  diagram.setAttribute("aria-label", "The data path, with the stage being read highlighted");
  diagram.innerHTML = `<ol class="dp-nodes">${NODES.map((nd) => `<li class="dp-node" data-node="${nd.id}"><a href="#stage-${nd.stages[0]}"><span class="dp-ic">${icon(nd.icon)}</span><span class="dp-t"><b>${escape(nd.label)}</b><span>${escape(nd.sub)}</span></span><span class="dp-n">${nd.stages.length > 1 ? `${nn(nd.stages[0]!)}–${nn(nd.stages[nd.stages.length - 1]!)}` : nn(nd.stages[0]!)}</span></a></li>`).join("")}</ol><div class="dp-packet"><p class="dp-packet-k">In the packet</p><p class="dp-packet-v" id="dp-packet"></p></div>`;
  const bar = el("div", "dp-bar");
  bar.innerHTML = `<span class="dp-bar-k" id="dp-bar-k"></span><span class="dp-bar-track"><span class="dp-bar-fill" id="dp-bar-fill"></span></span>`;
  const list = el("div", "dp-stages");
  for (const h of hops) {
    const nd = nodeOf(h.n);
    const row = el("article", "stage");
    row.id = `stage-${h.n}`;
    row.dataset.node = nd.id;
    row.dataset.n = String(h.n);
    const meta: [string, string][] = [["Where", h.where]];
    if (h.transport) meta.push(["Transport", h.transport]);
    if (h.storage) meta.push(["Storage", h.storage]);
    if (h.retention) meta.push(["Retention", h.retention]);
    meta.push(["In the packet", h.payload.join(", ")]);
    row.innerHTML = `<div class="stage-body"><p class="mono">Stage ${nn(h.n)} of ${hops.length} · ${escape(nd.label)}</p><h3>${escape(h.title)} ${tag(h.tag)}</h3><p>${escape(h.summary)}</p></div>`;
    const body = row.querySelector(".stage-body")! as HTMLElement;
    kv(body, meta);
    if (h.unknowns?.length) body.insertAdjacentHTML("beforeend", `<p class="fine">${tag("unknown")} ${h.unknowns.map(escape).join(" · ")}</p>`);
    body.appendChild(cite(h.sources));
    list.appendChild(row);
  }
  // Retention presets
  const ret = el("article", "stage tool");
  ret.dataset.node = "bin";
  ret.innerHTML = `<div class="stage-body"><p class="mono">Retention</p><h3>How long the reads are kept</h3><p>Flock’s default and the limits some states set. Choose one to see what it applies to.</p><div class="toggle-row" id="retention-chips"></div><p class="aim-readout" id="retention-readout"></p></div>`;
  const chips = ret.querySelector<HTMLElement>("#retention-chips")!;
  const out = ret.querySelector<HTMLElement>("#retention-readout")!;
  const setRet = (i: number) => { const r = dataflow.retentionPresets[i]!; out.textContent = `${r.label}: ${r.note}`; chips.querySelectorAll("button").forEach((b, j) => { b.classList.toggle("is-active", j === i); b.setAttribute("aria-pressed", String(j === i)); }); set({ retentionIndex: i }); };
  dataflow.retentionPresets.forEach((r, i) => { const b = el("button", "chip", escape(r.label)); b.type = "button"; b.addEventListener("click", () => setRet(i)); chips.appendChild(b); });
  ret.querySelector(".stage-body")!.appendChild(cite(dataflow.retentionPresets.flatMap((r) => r.sources), 3));
  list.appendChild(ret);
  setRet(0);
  // Network search example
  const d = dataflow.deputy;
  const dep = el("article", "stage tool");
  dep.dataset.node = "search";
  dep.innerHTML = `<div class="stage-body"><p class="mono">Network search</p><h3>One documented search</h3><p>Enter a reason and run the search. The counts are those recorded in the audit log of one documented search, on May 9, 2025, which carried the case number of a sheriff’s office death investigation.</p><form id="deputy-form"><input id="deputy-reason" type="text" maxlength="60" placeholder="Reason for search" aria-label="Reason for search" /><button type="submit" class="chip">Search network</button></form><p class="aim-readout" id="deputy-readout" aria-live="polite"></p></div>`;
  const form = dep.querySelector<HTMLFormElement>("#deputy-form")!;
  const readout = dep.querySelector<HTMLElement>("#deputy-readout")!;
  form.addEventListener("submit", (e) => { e.preventDefault(); const r = (form.querySelector("input") as HTMLInputElement).value.trim() || d.reasonAsLogged; set({ deputyReason: r }); readout.textContent = `Reason as logged: “${r}” · ${d.networks.toLocaleString()} networks · ${d.cameras.toLocaleString()} cameras · ${d.lookbackDays}-day lookback · ${d.date}`; });
  dep.querySelector(".stage-body")!.appendChild(cite(d.sources));
  list.appendChild(dep);
  host.append(bar, diagram, list);

  // Light the node of the stage that has crossed a line under the header.
  const rows = [...list.querySelectorAll<HTMLElement>(".stage")];
  const nodes = new Map([...diagram.querySelectorAll<HTMLElement>(".dp-node")].map((li) => [li.dataset.node!, li]));
  const packet = diagram.querySelector<HTMLElement>("#dp-packet")!;
  const barK = bar.querySelector<HTMLElement>("#dp-bar-k")!, barFill = bar.querySelector<HTMLElement>("#dp-bar-fill")!;
  let cur = -1;
  const update = () => {
    const line = topbarHeight() + innerHeight * 0.35;
    let i = 0;
    rows.forEach((r, k) => { if (r.getBoundingClientRect().top < line) i = k; });
    if (i === cur) return;
    cur = i;
    const row = rows[i]!, node = row.dataset.node!;
    nodes.forEach((li, id) => { li.classList.toggle("is-active", id === node); li.classList.toggle("is-past", NODES.findIndex((x) => x.id === id) < NODES.findIndex((x) => x.id === node)); });
    rows.forEach((r, k) => r.classList.toggle("is-active", k === i));
    const n = Number(row.dataset.n);
    const hop = hops.find((h) => h.n === n);
    packet.textContent = hop ? hop.payload.join(" · ") : row.classList.contains("tool") ? "—" : "";
    barK.textContent = hop ? `Stage ${nn(n)} of ${hops.length} · ${nodeOf(n).label}` : (row.querySelector("h3")?.textContent ?? "");
    barFill.style.width = `${((i + 1) / rows.length) * 100}%`;
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  update();
}

/** Element ids of the twelve data stages, in order. */
export function dataStageIds(): string[] { return hops.map((h) => `stage-${h.n}`); }
