/** The Pole, Power and Data pages, built from the install and dataflow content. */
import { install, dataflow } from "./content";
import { cite, escape, tag } from "./ui/cite";
import { still, nn, el, p, kv, facts, topbarHeight } from "./ui/common";
import { icon } from "./ui/icons";
import { ap } from "./viz/format";
import { figCtx, figureCfg } from "./ui/figs";
import { auditFigure, type Deputy } from "./story/fig/searches";
import { mountDiagram, powerDiagram, fovDiagram } from "./story/fig/install";

const hops = dataflow.hops.slice().sort((a, b) => a.n - b.n);

// ---- Pole, power and data sections from the install and dataflow content -------------------------------
export function buildPole(host: HTMLElement): void {
  for (const m of ["flock", "existing", "ac"] as const) {
    const mode = install.modes[m]!;
    const card = el("article", "card sheet");
    card.innerHTML = `<figure class="card-fig">${mountDiagram(m, install.pole)}</figure><h3>${escape(mode.label)}</h3>`;
    facts(card, mode.facts);
    host.appendChild(card);
  }
  const c = install.coverage;
  const fov = el("article", "card sheet wide fov");
  fov.innerHTML = `<h3>What the camera sees</h3><figure class="card-fig">${fovDiagram(c)}</figure>`;
  kv(fov, [["Field of view", `${c.widthFt} feet wide at ${c.distFt} feet`], ["Range", `Up to ${c.maxFt} feet across ${ap(c.lanes)} lanes, at speeds up to ${c.mph} miles an hour`], ["Photos", `${c.framesPerVehicle.charAt(0).toUpperCase()}${c.framesPerVehicle.slice(1)} of each passing vehicle`], ["Aimed at", c.aims]]);
  fov.appendChild(cite(c.sources));
  p(fov, "The field of view is from Flock’s 2020 specification sheet; the range, lanes and speed are from the data sheet for the Falcon Flex, which elsewhere gives a maximum distance of 90 feet. Drawn to scale; lanes are 12 feet wide.", "fine");
  host.appendChild(fov);
}

export function buildPower(host: HTMLElement): void {
  for (const m of ["solar", "ac", "wing"] as const) {
    const path = install.paths[m]!;
    const card = el("article", "card sheet");
    card.innerHTML = `<figure class="card-fig flow-fig">${powerDiagram(m)}</figure><h3>${escape(path.label)}</h3>`;
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
  { id: "lists", label: "Hot lists", sub: "NCIC, NCMEC, Amber Alert and agency lists", stages: [8], icon: "list" },
  { id: "phone", label: "Alert to officers", sub: "10 to 15 seconds on average, Flock says", stages: [9], icon: "phone" },
  { id: "search", label: "Network search", sub: "own, shared and national", stages: [10], icon: "search" },
  { id: "audit", label: "Audit log", sub: "a row for every search", stages: [11], icon: "list" },
  { id: "bin", label: "Deletion", sub: "seven days by default for new customers", stages: [12], icon: "bin" },
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
    row.innerHTML = `<div class="stage-body"><p class="mono">Stage ${nn(h.n)} of ${hops.length} · ${escape(nd.label)}</p><h2>${escape(h.title)} ${tag(h.tag)}</h2><p>${escape(h.summary)}</p></div>`;
    const body = row.querySelector(".stage-body")! as HTMLElement;
    kv(body, meta);
    if (h.unknowns?.length) body.insertAdjacentHTML("beforeend", `<p class="fine">${tag("unknown")} ${h.unknowns.map(escape).join(" · ")}</p>`);
    body.appendChild(cite(h.sources));
    list.appendChild(row);
  }
  host.append(bar, diagram, list);
  // After the path, past the end of the sticky diagram: one documented search (stages 10 and 11 in practice), then the
  // page's notes on its records
  const search = el("section", "dp-search");
  search.id = "search-example";
  search.innerHTML = `<h2 class="sec-title">One documented search</h2><p class="lede-p">What stages 10 and 11 look like in practice: the audit log of two searches by one sheriff’s office, and how the people involved described them.</p>${auditFigure(figureCfg("audit"), figCtx(), dataflow.deputy as Deputy)}`;
  const about = el("section", "dp-about");
  about.id = "about";
  about.innerHTML = `<h2 class="sec-title">About the data</h2><p>Each stage cites the documents behind it: Flock’s own architecture, policy and product documents, and independent teardowns, audits and public records. The tag beside each stage says whether it rests on Flock’s word, on independent documentation or on both; statements neither confirms are marked as not verified. The time scale at the top uses the averages and limits Flock and state laws publish; Flock publishes no time for the upload.</p>`;
  host.after(search, about);

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
    packet.textContent = hop ? hop.payload.join(" · ") : "";
    barK.textContent = hop ? `Stage ${nn(n)} of ${hops.length} · ${nodeOf(n).label}` : (row.querySelector("h2")?.textContent ?? "");
    barFill.style.width = `${((i + 1) / rows.length) * 100}%`;
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  update();
}

/** Element ids of the twelve data stages, in order. */
export function dataStageIds(): string[] { return hops.map((h) => `stage-${h.n}`); }
