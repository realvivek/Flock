import { myths, economics, sources, products, deployments, overview, partById, hopById, stillById } from "../content";
import { cite, escape } from "../ui/cite";
import { BASE } from "../lib/base";
import { apDate, apState } from "../viz/format";
import { initTooltips } from "../viz/tooltip";
import { texasFigure, feesFigure, figCtx, figureCfg } from "./figs";
import { contractsFigure } from "../story/fig/money";
import { SOURCE_KINDS, VERDICT, VERDICT_DEF, termsFigure } from "../story/fig/reference";

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

/** A price list that reads the same on a phone: each item with its unit under it and its source, the price at the right. */
export function priceList(host: HTMLElement, body: { item: string; price: string; term: string; sources: string[] }[]): void {
  const list = el("div", "plist");
  list.setAttribute("role", "list");
  for (const r of body) {
    const row = el("div", "pl-row");
    row.setAttribute("role", "listitem");
    row.innerHTML = `<div class="pl-item"><span class="pl-name">${escape(r.item)}</span><span class="pl-term">${escape(r.term)}</span></div><div class="pl-price">${escape(r.price)}</div>`;
    row.querySelector(".pl-item")!.appendChild(cite(r.sources, 1));
    list.appendChild(row);
  }
  host.appendChild(list);
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

const verdictLabel: Record<string, string> = VERDICT;

export interface ClaimLinks {
  onPart?(partId: string): void;
  onHop?(n: number): void;
}

/** The product line from products.json as a table: several claims depend on which device is on the pole. */
export function renderProducts(host: HTMLElement): void {
  host.appendChild(el("p", "lede-p", "Flock sells several devices with different capabilities: the plate reader takes still photos, the video camera streams and the acoustic sensor listens for gunshots. Several of the claims depend on which one is on the pole."));
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
    h.innerHTML = `<span class="n">${String(i + 1).padStart(2, "0")}</span> “${escape(m.claim)}”`;
    art.appendChild(h);
    art.insertAdjacentHTML("beforeend", `<p class="claim-verdict"><span class="verdict ${m.verdict}">${verdictLabel[m.verdict]}</span></p>`);
    art.appendChild(el("p", "claim-body", m.nuance));
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
  host.appendChild(el("p", "lede-p", "The claims include statements by the company and by its critics. Each is put the way it is usually made, followed by what the documented record shows, the product or setting it applies to and the sources, with links to the related component or data stage. The verdicts describe the record, not the people who make the claims."));
  const dl = el("dl", "verdict-defs");
  for (const v of ["false", "nuanced", "true"] as const) dl.insertAdjacentHTML("beforeend", `<dt><span class="verdict ${v}">${verdictLabel[v]}</span></dt><dd>${escape(VERDICT_DEF[v])}</dd>`);
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
    } },
    // the 2026 changes first, then the terms they changed
    { id: "econ-contract", title: "Ownership and contract terms", render: (h) => { h.insertAdjacentHTML("beforeend", termsFigure(e.termsChanges, figCtx())); rows(h, e.contract); } },
    { id: "econ-fees", title: "Fees after installation", fine: "Flock’s Reinstall and Relocation Fee Schedule 2026 applies when a customer changes the agreed deployment plan, and to replacements after vandalism, theft or damage.",
      render: (h) => { h.insertAdjacentHTML("beforeend", feesFigure(e.fees, figCtx())); } },
    { id: "econ-prices", title: "List prices", fine: "From the Virginia Sheriffs’ Association catalog of May 2024, which matches 2025 invoices; the price of a drone program is from Everett, Wash., and Dunwoody, Ga.",
      render: (h) => { priceList(h, e.priceList.map((p) => ({ item: p.item, price: p.price, term: p.term, sources: p.sources }))); } },
    { id: "econ-install", title: "Installation and permits", render: (h) => {
      h.appendChild(el("h3", "sub-title", "Who does what"));
      table(h, ["Step", "Flock", "Customer", "Utility, transportation department or electrician"], e.workflow.map((w) => ({ cells: [w.step, w.flock, w.customer || "—", w.other || "—"], sources: w.sources })));
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
      h.insertAdjacentHTML("beforeend", contractsFigure(figureCfg("contracts"), figCtx(), { table: false }));
      h.appendChild(el("p", "fine", "The contracts in full, with the agencies whose terms were not reported:"));
      // a city agency carries its state unless its name is a city the Times names alone; a state or federal agency's name says where it is
      const who = (c: (typeof d.contracts)[number]) => (c.level === "City" && !/^(Houston|Dallas|Oklahoma City)\b/.test(c.agency) ? `${c.agency}, ${apState(c.state)}` : c.agency);
      table(h, ["Agency", "Cameras", "Contract value", "Term and status"], d.contracts.map((c) => ({ cells: [who(c), c.cameras, c.value, c.note ? `${c.term}. ${c.note}` : c.term], sources: c.sources })));
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

/** A title's trailing note in parentheses is this site's, so it is set apart from the document's own title. */
function splitTitle(t: string): [string, string] {
  const m = t.match(/^(.*\S) \(([^()]*(?:\([^()]*\)[^()]*)*)\)$/);
  return m && !/^\d{4}\)?$/.test(m[2]!) ? [m[1]!, m[2]!] : [t, ""];
}

/** The bibliography, grouped by origin, each entry with its date; the date it was last checked shows only where it is
 *  not the date most links were checked, which the notes give once. */
export function renderSources(host: HTMLElement): void {
  const checks = new Map<string, number>();
  for (const s of sources) checks.set(s.lastVerified, (checks.get(s.lastVerified) ?? 0) + 1);
  const usual = [...checks].sort((a, b) => b[1] - a[1])[0]![0];
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
      h.innerHTML = `<span class="tag ${kindClass[s.kind]}">${kindLabel[s.kind]}</span> ${escape(kindTitle[s.kind]!)} <span class="src-n">${sources.filter((x) => x.kind === s.kind).length}</span>`;
      list.appendChild(h);
    }
    const [title, note] = splitTitle(s.title);
    // the last word and the arrow stay together, so the arrow never wraps alone
    const words = escape(title).split(" "), last = words.pop()!;
    const row = el("div", "source");
    row.id = `src-${s.id}`;
    // The whole title cell is the link, so a tap between wrapped lines still opens the document.
    row.innerHTML = `
      <a class="src-link" href="${escape(s.url)}" rel="noopener noreferrer" target="_blank"><span class="t">${words.join(" ")}${words.length ? " " : ""}<span class="nw">${last}<span class="arr" aria-hidden="true"> ↗</span></span></span><span class="pub">${escape(s.publisher)}</span></a>
      ${note ? `<span class="note">${escape(note)}</span>` : ""}
      <span class="date">${escape(/^\d{4}(-\d{2}){0,2}$/.test(s.date) ? apDate(s.date) : s.date)}${s.lastVerified !== usual ? `<br />checked ${escape(apDate(s.lastVerified))}` : ""}</span>`;
    list.appendChild(row);
  }
  host.appendChild(list);
  host.appendChild(sectionHead("About the sources", "about"));
  const legend = el("p", "lede-p");
  legend.innerHTML = `Every document cited anywhere on this site is listed here, by who published it. <span class="tag tag-flock">Flock</span> is a document or page published by the company. <span class="tag tag-indep">Independent</span> is a news report, a study, a teardown, or a report or dataset from an advocacy group, a researcher or another company. <span class="tag tag-gov">Government</span> is a legislature, agency, council or public-records release, and <span class="tag tag-gov">Court</span> a ruling. Elsewhere on the site, <span class="tag tag-unknown">Not verified</span> marks a statement that neither Flock nor an independent source confirms.`;
  host.appendChild(legend);
  host.appendChild(el("p", "lede-p", `Each entry gives the document’s title where it has one, or a short description where it does not; a note under an entry is this site’s. The links were last checked on ${apDate(usual)}, unless an entry says otherwise.`));
  const fine = el("p", "fine");
  fine.innerHTML = `Camera positions on the Outcomes page come from OpenStreetMap contributors via <a href="https://deflock.org" rel="noopener">DeFlock</a>. Corrections: open an issue on the repository. Model files are published under CC BY 4.0; code under MIT.`;
  host.appendChild(fine);
}
