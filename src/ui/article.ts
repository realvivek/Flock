import { myths, economics, sources, products, deployments, overview, partById, hopById, stillById } from "../content";
import { cite, escape } from "../ui/cite";
import { BASE } from "../lib/base";
import { apDate, apState } from "../viz/format";
import { initTooltips } from "../viz/tooltip";
import { texasFigure, feesFigure, figCtx, figureCfg } from "./figs";
import { contractsFigure } from "../story/fig/money";
import { SOURCE_KINDS } from "../story/fig/reference";

/**
 * Article renderers shared by the desktop acts 5 to 7 and the phone stepper.
 * Each writes a single-column, paragraph-format document into `host`: the claims list,
 * the economics sections, and the bibliography. Both surfaces get identical DOM and styling.
 */



const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** A section of an article page: an h2 under the page's h1, in the story's section type. */
export function sectionHead(title: string, id?: string): HTMLHeadingElement {
  const h = el("h2", "sec-title", title);
  if (id) h.id = id;
  return h;
}

/** Jump list of in-page anchors. Clicks scroll without rewriting the location hash (the stepper keeps its own). */
function jumpList(items: { id: string; label: string }[]): HTMLElement {
  const nav = el("nav", "jump");
  nav.setAttribute("aria-label", "Contents");
  for (const it of items) {
    const a = el("a", undefined, it.label);
    a.href = `#${it.id}`;
    a.addEventListener("click", (e) => { e.preventDefault(); document.getElementById(it.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); });
    nav.appendChild(a);
  }
  return nav;
}

/** The splash contents: one card per section with a one-line description; `hrefFor` maps a section id to its route. Plain links, so the hash router handles the click. */
export function renderContents(host: HTMLElement, hrefFor: (id: string) => string): HTMLElement {
  const nav = el("nav", "contents");
  nav.setAttribute("aria-label", "Sections");
  overview.sections.forEach((sec, i) => {
    const a = el("a");
    a.href = hrefFor(sec.id);
    a.dataset.section = sec.id;
    a.innerHTML = `<span class="n">${String(i + 1).padStart(2, "0")}</span><span class="t">${escape(sec.title)}</span><span class="b">${escape(sec.blurb)}</span>`;
    nav.appendChild(a);
  });
  host.appendChild(nav);
  return nav;
}

export function rows(host: HTMLElement, list: { k: string; v: string; sources: string[] }[]): void {
  const wrap = el("div", "rows");
  for (const r of list) {
    const d = el("div", "row");
    d.innerHTML = `<span class="k">${escape(r.k)}</span><span class="v">${escape(r.v)}</span>`;
    d.querySelector(".v")!.appendChild(cite(r.sources));
    wrap.appendChild(d);
  }
  host.appendChild(wrap);
}

export function table(host: HTMLElement, head: string[], body: { cells: string[]; num?: number[]; sources: string[] }[]): void {
  const wrap = el("div", "tablewrap stack");
  const t = document.createElement("table");
  t.innerHTML = `<thead><tr>${head.map((h) => `<th>${escape(h)}</th>`).join("")}</tr></thead>`;
  const tb = document.createElement("tbody");
  for (const r of body) {
    const tr = document.createElement("tr");
    r.cells.forEach((c, i) => {
      const td = document.createElement("td");
      if (r.num?.includes(i)) td.className = "num";
      td.dataset.label = head[i] ?? "";
      td.textContent = c;
      if (i === r.cells.length - 1) td.appendChild(cite(r.sources, 1));
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  }
  t.appendChild(tb);
  wrap.appendChild(t);
  host.appendChild(wrap);
}

const verdictLabel: Record<string, string> = {
  false: "Not supported by the record",
  true: "Supported by the record",
  nuanced: "Depends on the product or setting",
};

export interface ClaimLinks {
  onPart?(partId: string): void;
  onHop?(n: number): void;
}

/** The product line from products.json as a table: several claims depend on which device is on the pole. */
export function renderProducts(host: HTMLElement): void {
  host.appendChild(el("p", undefined, "Flock sells several devices with different capabilities. The plate reader captures still frames; the video camera streams; the acoustic sensor detects gunshots."));
  table(host, ["Product", "Type", "Captures", "Notes"], products.map((pr) => ({ cells: [pr.name, pr.type, pr.captures, pr.note ? `${pr.not}. ${pr.note}` : pr.not], sources: pr.sources })));
  host.lastElementChild?.classList.add("products");
}

/** The claims as a running list (claim, what the record shows, related component or stage, sources), then the product
 *  line and the page's notes. The index of claims by verdict opens the page (rendered at build time). */
export function renderClaims(host: HTMLElement, links: ClaimLinks = {}): void {
  host.appendChild(sectionHead("The claims", "claim-list"));
  const list = el("div", "claims");
  myths.forEach((m, i) => {
    const art = el("article", "claim");
    art.id = `claim-${m.id}`;
    const h = el("h3", "claim-text");
    h.innerHTML = `<span class="n">${String(i + 1).padStart(2, "0")}</span> ${escape(m.claim)}`;
    art.appendChild(h);
    const body = el("p", "claim-body");
    body.innerHTML = `<span class="verdict ${m.verdict}">${verdictLabel[m.verdict]}</span> ${escape(m.nuance)}`;
    art.appendChild(body);
    const related = el("div", "links");
    if (m.part && links.onPart) {
      const p = partById.get(m.part);
      if (p) { const b = el("button", undefined, `Component ${String(p.order).padStart(2, "0")} · ${p.name}`); b.type = "button"; b.addEventListener("click", () => links.onPart!(p.id)); related.appendChild(b); }
    }
    if (m.hop && links.onHop) {
      const hp = hopById.get(m.hop);
      if (hp) { const b = el("button", undefined, `Data stage ${String(hp.n).padStart(2, "0")} · ${hp.title}`); b.type = "button"; b.addEventListener("click", () => links.onHop!(hp.n)); related.appendChild(b); }
    }
    if (related.childElementCount) art.appendChild(related);
    art.appendChild(cite(m.sources));
    list.appendChild(art);
  });
  host.appendChild(list);
  host.appendChild(sectionHead("Product line", "products"));
  renderProducts(host);
  host.appendChild(sectionHead("About the claims", "about"));
  host.appendChild(el("p", "lede-p", "Each entry states a common claim about the cameras, what the documented record shows, the product or setting it applies to, and the sources, with links to the related component or data stage. The verdicts describe the record, not the people who make the claims."));
  const dl = el("dl", "verdict-defs");
  for (const [v, d] of [["false", "The documents and records cited contradict the claim, or nothing in them supports it."], ["nuanced", "The answer differs by product (plate reader, video camera or audio sensor) or by how a customer has set it up."], ["true", "The documents and records cited support the claim as stated."]] as const) dl.insertAdjacentHTML("beforeend", `<dt><span class="verdict ${v}">${verdictLabel[v]}</span></dt><dd>${escape(d)}</dd>`);
  host.appendChild(dl);
}

interface Block { id: string; title: string; fine?: string; render(h: HTMLElement): void }
/** An article page's sections in order, each an h2 under the page's h1, with a quiet row of links to them first. */
function sections(host: HTMLElement, list: Block[]): void {
  host.appendChild(jumpList(list.map((s) => ({ id: s.id, label: s.title }))));
  for (const s of list) {
    const sec = el("section", "econ-block");
    sec.id = s.id;
    sec.appendChild(sectionHead(s.title));
    if (s.fine) sec.appendChild(el("p", "fine", s.fine));
    s.render(sec);
    host.appendChild(sec);
  }
}
const unknownList = (h: HTMLElement, list: { v: string; sources: string[] }[]) => {
  const ul = el("ul", "unknown-list");
  for (const u of list) { const li = el("li", undefined, u.v); li.appendChild(cite(u.sources, 1)); ul.appendChild(li); }
  h.appendChild(ul);
};
/** The page's notes on its records: the text that opened the page before, now last, with its sources. */
const about = (h: HTMLElement, text: string, srcs: string[]) => { const p = el("p", "lede-p", text); p.appendChild(cite(srcs, 4)); h.appendChild(p); };

/** What the fee covers, the fees after installation, prices, contract terms, installation and the company. The price
 *  chart opens the page (rendered at build time). */
export function renderEconomics(host: HTMLElement): void {
  const e = economics;
  sections(host, [
    { id: "econ-covers", title: "What the fee covers", render: (h) => {
      // the two lists side by side: what the yearly fee includes, and what the customer pays for on top
      const two = el("div", "covers");
      for (const [k, list, label] of [["in", e.included, "Included in the annual fee"], ["out", e.extra, "Billed separately"]] as const) {
        const col = el("div", `covers-col covers-${k}`);
        col.appendChild(el("h3", undefined, label));
        const ul = el("ul");
        for (const r of list) { const li = el("li"); li.innerHTML = `<b>${escape(r.k)}</b> ${escape(r.v)}`; li.appendChild(cite(r.sources, 1)); ul.appendChild(li); }
        col.appendChild(ul);
        two.appendChild(col);
      }
      h.appendChild(two);
      // the priced pole: the still with the fee attached to each element
      const fig = el("figure", "inset");
      const img = document.createElement("img");
      img.src = `${BASE}${stillById.get("pole-flock") ?? ""}`;
      img.alt = "Flock pole with camera, solar panel and battery box";
      img.loading = "lazy";
      img.decoding = "async";
      fig.appendChild(img);
      const cap = el("figcaption");
      cap.appendChild(el("h3", undefined, "What each part of a camera costs"));
      rows(cap, e.pricedPole.map((p) => ({ k: p.k, v: p.v, sources: p.sources })));
      fig.appendChild(cap);
      h.appendChild(fig);
    } },
    { id: "econ-fees", title: "Fees after installation", fine: "Flock’s Reinstall and Relocation Fee Schedule 2026 applies when a customer changes the agreed deployment plan, and to replacements after vandalism, theft or damage. Contracts and quotes from 2022 and 2023 list a one-time installation fee of $350 to $650 a camera, or $150 on existing infrastructure.",
      render: (h) => { h.insertAdjacentHTML("beforeend", feesFigure(e.fees, figCtx())); table(h, ["Fee", "2026 schedule"], e.fees.map((f) => ({ cells: [f.item, f.now], num: [1], sources: f.sources }))); } },
    { id: "econ-prices", title: "List prices", fine: "Virginia Sheriffs’ Association catalog, May 2024, matching 2025 invoices. Per unit per year.",
      render: (h) => table(h, ["Item", "Price", "Term"], e.priceList.map((p) => ({ cells: [p.item + (p.sku ? ` (${p.sku})` : ""), p.price, p.term], num: [1], sources: p.sources }))) },
    { id: "econ-history", title: "Price history", render: (h) => {
      const tl = el("div", "timeline");
      for (const r of e.history) {
        const d = el("div", "tl");
        d.innerHTML = `<span class="d">${escape(r.date)}</span><span class="p">${escape(r.price)}</span><span class="n">${escape(r.note)}</span>`;
        d.querySelector(".n")!.appendChild(cite(r.sources, 1));
        tl.appendChild(d);
      }
      h.appendChild(tl);
    } },
    { id: "econ-contract", title: "Ownership and contract terms", render: (h) => rows(h, e.contract) },
    { id: "econ-install", title: "Installation and permits", render: (h) => {
      h.appendChild(el("h3", "sub-title", "Who does what"));
      table(h, ["Step", "Flock", "Customer", "Utility, DOT or electrician"], e.workflow.map((w) => ({ cells: [w.step, w.flock, w.customer, w.other || "—"], sources: w.sources })));
      h.appendChild(el("h3", "sub-title", "Who installs the cameras"));
      rows(h, e.workforce);
      h.appendChild(el("h3", "sub-title", "Permits by location"));
      table(h, ["Location", "Permit", "Responsibility", "Documented cases"], e.permitting.map((p) => ({ cells: [p.scenario, p.permit, p.who, p.note || "—"], sources: p.sources })));
    } },
    // public money for the cameras is on the Deployments page, with Texas's grants
    { id: "econ-company", title: "The company", render: (h) => rows(h, e.scale.filter((r) => r.k !== "Public money")) },
    { id: "econ-unknowns", title: "What is not public", render: (h) => unknownList(h, e.unknowns) },
    { id: "about", title: "About the data", render: (h) => about(h, e.intro.summary, e.intro.sources) },
  ]);
  initTooltips(host);
}

/** Scroll a bibliography row into view and mark it so the landing point stays visible among the rows until the next citation. */
export function revealSource(id: string, behavior: ScrollBehavior = "smooth"): boolean {
  const row = document.getElementById(`src-${id}`);
  if (!row) return false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  row.scrollIntoView({ behavior: reduced ? "auto" : behavior, block: "start" });
  document.querySelectorAll(".source.is-target").forEach((r) => r.classList.remove("is-target"));
  row.classList.add("is-target");
  return true;
}

/** Who pays for the cameras, the largest documented contracts and what is not public. The chart of mapped cameras by
 *  city opens the page (rendered at build time). */
export async function renderDeployments(host: HTMLElement): Promise<void> {
  const d = deployments;
  sections(host, [
    { id: "dep-pays", title: "Who pays for the cameras", render: (h) => { h.insertAdjacentHTML("beforeend", texasFigure(figCtx())); rows(h, d.funding); } },
    { id: "dep-contracts", title: "The largest documented contracts", render: (h) => {
      h.insertAdjacentHTML("beforeend", contractsFigure(figureCfg("contracts"), figCtx()));
      table(h, ["Agency", "Cameras", "Contract value", "Term and status"], d.contracts.map((c) => ({ cells: [`${c.agency} · ${c.level}${c.level === "Federal" ? "" : `, ${apState(c.state)}`}`, c.cameras, c.value, c.note ? `${c.term}. ${c.note}` : c.term], sources: c.sources })));
      h.lastElementChild?.classList.add("contracts");
    } },
    { id: "dep-unknowns", title: "What is not public", render: (h) => unknownList(h, d.unknowns) },
    { id: "about", title: "About the data", render: (h) => { about(h, d.intro.summary, d.intro.sources); h.appendChild(el("h3", "sub-title", "Where the records are")); rows(h, d.records); } },
  ]);
  initTooltips(host);
}

const kindClass: Record<string, string> = { flock: "tag-flock", independent: "tag-indep", government: "tag-gov", court: "tag-gov" };
const kindLabel: Record<string, string> = { flock: "Flock", independent: "Independent", government: "Government", court: "Court" };
const kindTitle = SOURCE_KINDS;
const order = ["flock", "independent", "government", "court"];

/** The bibliography, grouped by origin, each entry with its date and the date it was last checked. */
export function renderSources(host: HTMLElement): void {
  const legend = el("p", "lede-p");
  legend.innerHTML = `Sources are tagged by origin. <span class="tag tag-flock">Flock</span> is a document or page published by the company. <span class="tag tag-indep">Independent</span> is a teardown, research paper or news report. <span class="tag tag-gov">Government</span> is a legislature, agency, council or public-records release, and <span class="tag tag-gov">Court</span> a filing or opinion. Elsewhere on the site, <span class="tag tag-unknown">Not verified</span> marks a statement that neither Flock nor an independent source confirms. Each source carries the date it was last checked.`;
  const jump = el("nav", "jump");
  jump.setAttribute("aria-label", "Source groups");
  jump.innerHTML = order.filter((k) => sources.some((s) => s.kind === k)).map((k) => `<a href="#group-${k}">${escape(kindTitle[k]!)}</a>`).join("") + `<a href="#about">About the sources</a>`;
  host.appendChild(jump);
  const list = el("div", "sources");
  const sorted = sources.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.date.localeCompare(b.date));
  let lastKind = "";
  for (const s of sorted) {
    if (s.kind !== lastKind) {
      lastKind = s.kind;
      const h = el("h2", "src-group");
      h.id = `group-${s.kind}`;
      h.innerHTML = `<span class="tag ${kindClass[s.kind]}">${kindLabel[s.kind]}</span> ${kindTitle[s.kind]}`;
      list.appendChild(h);
    }
    const row = el("div", "source");
    row.id = `src-${s.id}`;
    // The whole title cell is the link, so a tap between wrapped lines still opens the document.
    row.innerHTML = `
      <span class="id">${escape(s.id)}</span>
      <a class="src-link" href="${escape(s.url)}" rel="noopener noreferrer" target="_blank"><span class="t">${escape(s.title)}</span><span class="pub">${escape(s.publisher)}</span></a>
      <span class="date">${escape(/^\d{4}(-\d{2}){0,2}$/.test(s.date) ? apDate(s.date) : s.date)}<br />checked ${escape(apDate(s.lastVerified))}</span>`;
    list.appendChild(row);
  }
  host.appendChild(list);
  host.appendChild(sectionHead("About the sources", "about"));
  host.appendChild(legend);
  const fine = el("p", "fine");
  fine.innerHTML = `Camera positions on the Outcomes page come from OpenStreetMap contributors via <a href="https://deflock.org" rel="noopener">DeFlock</a>. This site does not describe ways to avoid or disable the cameras. Corrections: open an issue on the repository. Model files are published under CC BY 4.0; code under MIT.`;
  host.appendChild(fine);
}
