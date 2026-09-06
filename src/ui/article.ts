import { myths, economics, sources, products, partById, hopById, stillById } from "../content";
import { cite, escape } from "../ui/cite";

/**
 * Article renderers shared by the desktop acts 5 to 7 and the phone stepper.
 * Each writes a single-column, paragraph-format document into `host`: the claims list,
 * the economics sections, and the bibliography. Both surfaces get identical DOM and styling.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

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
  const wrap = el("div", "tablewrap");
  const t = document.createElement("table");
  t.innerHTML = `<thead><tr>${head.map((h) => `<th>${escape(h)}</th>`).join("")}</tr></thead>`;
  const tb = document.createElement("tbody");
  for (const r of body) {
    const tr = document.createElement("tr");
    r.cells.forEach((c, i) => {
      const td = document.createElement("td");
      if (r.num?.includes(i)) td.className = "num";
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

/** Twenty-one claims as a running list: claim, documented position, related component or stage, sources. */
export function renderClaims(host: HTMLElement, links: ClaimLinks = {}): void {
  const ph = el("h3", undefined, "Product line");
  ph.id = "products";
  host.appendChild(ph);
  renderProducts(host);
  const ch = el("h3", undefined, "Claims");
  ch.id = "claims";
  host.appendChild(ch);
  host.appendChild(el("p", undefined, "Each entry states a claim, the documented position, the product or setting it applies to, and the sources. Entries link to the related component or data stage."));
  host.appendChild(jumpList(myths.map((m, i) => ({ id: `claim-${m.id}`, label: `${String(i + 1).padStart(2, "0")} ${m.claim.replace(/\.$/, "")}` }))));
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
}

/** Pricing, fee schedules, workflow, workforce, permitting, contract terms and scale, in order. */
export function renderEconomics(host: HTMLElement): void {
  const e = economics;
  const sum = el("p", "lede-p", e.intro.summary);
  sum.appendChild(cite(e.intro.sources));
  host.appendChild(sum);

  // The priced pole as a figure: the still with the fee attached to each element.
  const fig = el("figure", "inset");
  const img = document.createElement("img");
  img.src = `${BASE}${stillById.get("pole-flock") ?? ""}`;
  img.alt = "Flock pole with camera, solar panel and battery box";
  img.loading = "lazy";
  img.decoding = "async";
  fig.appendChild(img);
  const cap = el("figcaption");
  cap.appendChild(el("h3", undefined, "Fees by element"));
  rows(cap, e.pricedPole.map((p) => ({ k: p.k, v: p.v, sources: p.sources })));
  fig.appendChild(cap);
  host.appendChild(fig);

  const sections: { id: string; title: string; fine?: string; render(h: HTMLElement): void }[] = [
    { id: "econ-included", title: "Included in the annual fee", render: (h) => rows(h, e.included) },
    { id: "econ-extra", title: "Billed separately", render: (h) => rows(h, e.extra) },
    { id: "econ-prices", title: "List prices", fine: "Virginia Sheriffs' Association catalog, May 2024, matching 2025 invoices. Per unit per year.",
      render: (h) => table(h, ["Item", "Price", "Term"], e.priceList.map((p) => ({ cells: [p.item + (p.sku ? ` (${p.sku})` : ""), p.price, p.term], num: [1], sources: p.sources }))) },
    { id: "econ-history", title: "Price history, 2019 to 2026", render: (h) => {
      const tl = el("div", "timeline");
      for (const r of e.history) {
        const d = el("div", "tl");
        d.innerHTML = `<span class="d">${escape(r.date)}</span><span class="p">${escape(r.price)}</span><span class="n">${escape(r.note)}</span>`;
        d.querySelector(".n")!.appendChild(cite(r.sources, 1));
        tl.appendChild(d);
      }
      h.appendChild(tl);
    } },
    { id: "econ-fees", title: "Installation and service fees, 2021 guide and 2026 schedule", fine: "Flock's 2021 implementation guide and its 2026 published fee schedule.",
      render: (h) => table(h, ["Fee", "2019 to 2023", "2026 schedule"], e.fees.map((f) => ({ cells: [f.item, f.then, f.now], num: [1, 2], sources: f.sources }))) },
    { id: "econ-workflow", title: "Installation workflow and responsibilities",
      render: (h) => table(h, ["Step", "Flock", "Customer", "Utility, DOT or electrician"], e.workflow.map((w) => ({ cells: [w.step, w.flock, w.customer, w.other || "—"], sources: w.sources }))) },
    { id: "econ-workforce", title: "Installation workforce", render: (h) => rows(h, e.workforce) },
    { id: "econ-permitting", title: "Permitting by location type",
      render: (h) => table(h, ["Location", "Permit", "Responsibility", "Documented cases"], e.permitting.map((p) => ({ cells: [p.scenario, p.permit, p.who, p.note || "—"], sources: p.sources }))) },
    { id: "econ-contract", title: "Ownership and contract terms", render: (h) => rows(h, e.contract) },
    { id: "econ-scale", title: "Scale and finances", render: (h) => rows(h, e.scale) },
    { id: "econ-unknowns", title: "Not publicly documented", render: (h) => {
      const ul = el("ul", "unknown-list");
      for (const u of e.unknowns) { const li = el("li", undefined, u.v); li.appendChild(cite(u.sources, 1)); ul.appendChild(li); }
      h.appendChild(ul);
    } },
  ];
  host.appendChild(jumpList(sections.map((s) => ({ id: s.id, label: s.title }))));
  for (const s of sections) {
    const sec = el("section", "econ-block");
    sec.id = s.id;
    sec.appendChild(el("h3", undefined, s.title));
    if (s.fine) sec.appendChild(el("p", "fine", s.fine));
    s.render(sec);
    host.appendChild(sec);
  }
}

let revealTimer = 0;
/** Scroll a bibliography row into view and flash it so the landing point is visible among the rows. */
export function revealSource(id: string, behavior: ScrollBehavior = "smooth"): boolean {
  const row = document.getElementById(`src-${id}`);
  if (!row) return false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  row.scrollIntoView({ behavior: reduced ? "auto" : behavior, block: "start" });
  document.querySelectorAll(".source.is-target").forEach((r) => r.classList.remove("is-target"));
  row.classList.add("is-target");
  clearTimeout(revealTimer);
  revealTimer = window.setTimeout(() => row.classList.remove("is-target"), 2600);
  return true;
}

const kindClass: Record<string, string> = { flock: "tag-flock", independent: "tag-indep", government: "tag-gov", court: "tag-gov" };
const kindLabel: Record<string, string> = { flock: "Flock", independent: "Independent", government: "Government", court: "Court" };
const kindTitle: Record<string, string> = {
  flock: "Flock Safety documents and pages",
  independent: "Teardowns, research and news reports",
  government: "Legislatures, agencies and Congress",
  court: "Courts",
};
const order = ["flock", "independent", "government", "court"];

/** The bibliography, grouped by origin, each entry with its date and the date it was last checked. */
export function renderSources(host: HTMLElement): void {
  const legend = el("p");
  legend.innerHTML = `Sources are tagged by origin. <span class="tag tag-flock">Flock</span> is a document or page published by the company. <span class="tag tag-indep">Independent</span> is a teardown, court filing, government audit or news report. <span class="tag tag-unknown">Unknown</span> marks a statement not published by Flock and not verified by an independent source. Each source carries the date it was last checked.`;
  host.appendChild(legend);
  const list = el("div", "sources");
  const sorted = sources.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.date.localeCompare(b.date));
  let lastKind = "";
  for (const s of sorted) {
    if (s.kind !== lastKind) {
      lastKind = s.kind;
      const h = el("h3", "src-group");
      h.innerHTML = `<span class="tag ${kindClass[s.kind]}">${kindLabel[s.kind]}</span> ${kindTitle[s.kind]}`;
      list.appendChild(h);
    }
    const row = el("div", "source");
    row.id = `src-${s.id}`;
    // The whole title cell is the link, so a tap between wrapped lines still opens the document.
    row.innerHTML = `
      <span class="id">${escape(s.id)}</span>
      <a class="src-link" href="${escape(s.url)}" rel="noopener noreferrer" target="_blank"><span class="t">${escape(s.title)}</span><span class="pub">${escape(s.publisher)}</span></a>
      <span class="date">${escape(s.date)}<br />checked ${escape(s.lastVerified)}</span>`;
    list.appendChild(row);
  }
  host.appendChild(list);
  const fine = el("p", "fine");
  fine.innerHTML = `This page does not map camera locations and does not describe countermeasures. Camera locations are catalogued at <a href="https://deflock.org" rel="noopener">DeFlock</a>. Corrections: open an issue on the repository. Model files are published under CC BY 4.0; code under MIT.`;
  host.appendChild(fine);
}
