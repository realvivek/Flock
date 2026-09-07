import "./stepper.css";
import { components, install, dataflow, economics, overview, stillById, partById } from "../content";
import { cite, escape, tag, setCiteHandler } from "../ui/cite";
import { renderClaims, renderEconomics, renderSources, renderDeployments, renderContents, revealSource } from "../ui/article";

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");
const still = (id: string) => `${BASE}${stillById.get(id) ?? ""}`;

interface Screen {
  eyebrow: string;
  title: string;
  /** still id, or an inline SVG string, or nothing */
  figure?: { still?: string; svg?: string; alt?: string };
  body: (host: HTMLElement) => void;
  cls?: string;
}
interface Chapter { id: string; label: string; screens: Screen[] }

const p = (host: HTMLElement, text: string, muted = false) => { const el = document.createElement("p"); if (muted) el.className = "muted"; el.textContent = text; host.appendChild(el); return el; };
const kv = (host: HTMLElement, rows: [string, string][]) => { const dl = document.createElement("dl"); dl.className = "st-kv"; for (const [k, v] of rows) dl.insertAdjacentHTML("beforeend", `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`); host.appendChild(dl); return dl; };
const facts = (host: HTMLElement, rows: { k: string; v: string; sources: string[] }[]) => { for (const r of rows) { const d = document.createElement("div"); d.innerHTML = `<dl class="st-kv"><dt>${escape(r.k)}</dt><dd>${escape(r.v)}</dd></dl>`; d.querySelector("dd")!.appendChild(cite(r.sources, 1)); host.appendChild(d); } };
/** Small inline diagram for the data act: camera, cloud, phone and network, with the active stage lit. */
function hopSvg(n: number): string {
  const stage = n <= 3 ? 0 : n === 4 ? 1 : n <= 8 ? 2 : n === 9 ? 3 : n <= 11 ? 4 : 5;
  const on = (i: number) => (stage === i ? "#1b4fd8" : "#c9cdd4");
  const fill = (i: number) => (stage === i ? "rgba(27,79,216,.12)" : "#fff");
  const dots = Array.from({ length: 90 }, (_, i) => { const x = 250 + (i % 15) * 9, y = 40 + Math.floor(i / 15) * 9; const lit = stage === 4 && (i * 7) % 5 !== 0; return `<circle cx="${x}" cy="${y}" r="2.2" fill="${lit ? "#1b4fd8" : "#dfe3ea"}"/>`; }).join("");
  return `<svg viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Mono, monospace" font-size="9">
    <defs><marker id="a" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" fill="#7c8390"/></marker></defs>
    <rect x="20" y="70" width="46" height="70" rx="4" fill="${fill(0)}" stroke="${on(0)}" stroke-width="1.5"/><circle cx="43" cy="92" r="9" fill="none" stroke="${on(0)}"/><text x="43" y="160" text-anchor="middle" fill="#4a505a">camera</text>
    <path d="M70 105 C 100 105, 100 60, 130 60" fill="none" stroke="${on(1)}" stroke-width="1.5" marker-end="url(#a)"/><text x="100" y="52" text-anchor="middle" fill="${stage === 1 ? "#1b4fd8" : "#7c8390"}">LTE · TLS</text>
    <rect x="132" y="35" width="90" height="50" rx="8" fill="${fill(2)}" stroke="${on(2)}" stroke-width="1.5"/><text x="177" y="56" text-anchor="middle" fill="#4a505a">S3 · RDS</text><text x="177" y="70" text-anchor="middle" fill="#4a505a">DynamoDB</text><text x="177" y="100" text-anchor="middle" fill="#4a505a">cloud · US</text>
    <path d="M177 88 C 177 115, 177 115, 177 130" fill="none" stroke="${on(3)}" stroke-width="1.5" marker-end="url(#a)"/>
    <rect x="165" y="132" width="24" height="40" rx="4" fill="${fill(3)}" stroke="${on(3)}" stroke-width="1.5"/><text x="177" y="178" text-anchor="middle" fill="#4a505a">officer</text>
    <path d="M224 60 C 240 60, 240 60, 246 60" fill="none" stroke="${on(4)}" stroke-width="1.5" marker-end="url(#a)"/>${dots}<text x="313" y="110" text-anchor="middle" fill="#4a505a">6,809 networks</text>
    <text x="313" y="150" text-anchor="middle" fill="${stage === 5 ? "#1b4fd8" : "#7c8390"}">${stage === 5 ? "deleted after retention" : "audit row per search"}</text>
  </svg>`;
}

function buildChapters(): Chapter[] {
  const parts = components.parts.slice().sort((a, b) => a.order - b.order);
  const hops = dataflow.hops.slice().sort((a, b) => a.n - b.n);
  const chapters: Chapter[] = [];

  chapters.push({ id: "overview", label: "Overview", screens: [
    { eyebrow: "Reference", title: "Anatomy of a Flock camera", figure: { still: "pole-flock", alt: "A Flock camera on its pole" }, cls: "st-overview", body: (h) => { p(h, overview.intro.lede); renderContents(h, (id) => `#ch-${id}`); p(h, overview.intro.sources, true); } },
  ]});

  const modeScreens: Screen[] = (["flock", "existing", "ac"] as const).map((m) => ({
    eyebrow: "01 · Pole and mount", title: install.modes[m]!.label, figure: { still: `pole-${m}`, alt: install.modes[m]!.label },
    body: (h) => { if (m === "flock") p(h, "Flock's standard installation is a dedicated breakaway pole set in soil by a Flock crew. The camera is band-clamped at about ten feet and aimed diagonally along the lane so that the rear plates of departing vehicles pass through the field of view."); facts(h, install.modes[m]!.facts); },
  }));
  modeScreens.push({ eyebrow: "01 · Pole · field of view", title: "Field of view", figure: { still: "falcon-side", alt: "Falcon side view" }, body: (h) => { const c = install.coverage; kv(h, [["Field of view", `${c.widthFt} ft wide at ${c.distFt} ft`], ["Range", `up to ${c.maxFt} ft, ${c.lanes} lanes, ${c.mph} mph`], ["Frames", `${c.framesPerVehicle} stills per vehicle`], ["Aims at", c.aims]]); h.appendChild(cite(c.sources)); p(h, "Flock's specification sheet gives the field of view at 65 ft; Flock's product page gives a range of up to 100 ft.", true); } });
  chapters.push({ id: "deployments", label: "Deployments", screens: [{ eyebrow: "Deployments and contracts", title: "Where it is deployed, and what the contracts say", cls: "st-article cyan", body: (h) => renderDeployments(h) }] });
  chapters.push({ id: "pole", label: "Pole", screens: modeScreens });

  const inside: Screen[] = [];
  const stageCopy = ["Assembled: 8.75 in tall, about 3 lb, band-clamped to the pole.", "Stage 1: bezel and illuminator ring.", "Stage 2: lens, mechanical IR-cut filter and image sensor.", "Stage 3: system on module, storage and LTE module lifted from the mainboard.", "Stage 4: Wi-Fi and Bluetooth module, GPS patch and rear shell.", "Stage 5: all fourteen components, front to back."];
  for (let k = 0; k <= 5; k++) inside.push({ eyebrow: "02 · Inside the enclosure", title: k === 0 ? "Components, front to back" : `Stage ${k} of 5`, figure: { still: `explode-${k}`, alt: `Exploded view stage ${k}` }, body: (h) => { p(h, stageCopy[k]!); if (k === 5) { const chips = document.createElement("div"); chips.className = "st-chips"; parts.forEach((pt, i) => { const b = document.createElement("button"); b.textContent = `${String(pt.order).padStart(2, "0")} ${pt.name}`; b.addEventListener("click", () => go("inside", 6 + i)); chips.appendChild(b); }); h.appendChild(chips); } } });
  for (const pt of parts) inside.push({ eyebrow: `02 · Inside · part ${String(pt.order).padStart(2, "0")} of 14`, title: pt.name, figure: { still: `part-${pt.id}`, alt: pt.name }, body: (h) => { if (pt.partNumber) p(h, `${pt.partNumber}${pt.vendor ? " · " + pt.vendor : ""}`, true); p(h, pt.function); kv(h, Object.entries(pt.spec)); h.appendChild(cite(pt.sources)); } });
  chapters.push({ id: "inside", label: "Inside", screens: inside });

  chapters.push({ id: "power", label: "Power", screens: (["solar", "ac", "wing"] as const).map((m) => ({ eyebrow: "03 · Power and cable", title: install.paths[m]!.label, figure: { still: m === "wing" ? "wing-closet" : m === "ac" ? "pole-ac" : "pole-flock", alt: install.paths[m]!.label }, body: (h) => { p(h, install.paths[m]!.summary); facts(h, install.paths[m]!.facts); } })) });

  const data: Screen[] = hops.map((hp) => ({ eyebrow: `04 · Data path · stage ${String(hp.n).padStart(2, "0")} of 12`, title: hp.title, figure: { svg: hopSvg(hp.n) }, cls: "cyan", body: (h) => { const t = document.createElement("div"); t.innerHTML = tag(hp.tag); h.appendChild(t); p(h, hp.summary); kv(h, [["Where", hp.where], ...(hp.transport ? [["Transport", hp.transport] as [string, string]] : []), ...(hp.storage ? [["Storage", hp.storage] as [string, string]] : []), ...(hp.retention ? [["Retention", hp.retention] as [string, string]] : []), ["In the packet", hp.payload.join(", ")]]); if (hp.unknowns?.length) { const u = document.createElement("p"); u.className = "muted"; u.innerHTML = `${tag("unknown")} ${hp.unknowns.map(escape).join(" · ")}`; h.appendChild(u); } h.appendChild(cite(hp.sources)); } }));
  data.push({ eyebrow: "04 · Data path · retention", title: "Retention periods", cls: "cyan", figure: { svg: hopSvg(12) }, body: (h) => { const chips = document.createElement("div"); chips.className = "st-chips"; const out = document.createElement("p"); out.className = "st-readout"; const set = (i: number) => { const r = dataflow.retentionPresets[i]!; out.textContent = `${r.label}: ${r.note}`; chips.querySelectorAll("button").forEach((b, j) => b.classList.toggle("is-active", j === i)); }; dataflow.retentionPresets.forEach((r, i) => { const b = document.createElement("button"); b.textContent = r.label; b.addEventListener("click", () => set(i)); chips.appendChild(b); }); h.appendChild(chips); h.appendChild(out); set(0); h.appendChild(cite(dataflow.retentionPresets.flatMap((r) => r.sources), 3)); } });
  data.push({ eyebrow: "04 · Data path · network search", title: "Network search example", cls: "cyan", figure: { svg: hopSvg(10) }, body: (h) => { const d = dataflow.deputy; p(h, "Enter a reason and run the search. The counts shown are those recorded in the audit log of one documented April 2025 query. The log records no warrant; a case number became a mandatory field in August 2026.", true); const f = document.createElement("form"); f.className = "st-form"; f.innerHTML = `<input type="text" maxlength="60" placeholder="e.g. &quot;${escape(d.reasonAsLogged)}&quot;" aria-label="Reason for search" /><button type="submit">Search</button>`; const out = document.createElement("p"); out.className = "st-readout"; f.addEventListener("submit", (e) => { e.preventDefault(); const r = (f.querySelector("input") as HTMLInputElement).value.trim() || d.reasonAsLogged; out.textContent = `Reason as logged: “${r}” · ${d.networks.toLocaleString()} networks · ${d.cameras.toLocaleString()} cameras · ${d.lookbackDays}-day lookback · ${d.date}`; }); h.appendChild(f); h.appendChild(out); h.appendChild(cite(d.sources)); } });
  chapters.push({ id: "data", label: "Data", screens: data });

  // Claims, Economics and Sources are single scrolling articles, shared with the desktop acts.
  chapters.push({ id: "myths", label: "Claims", screens: [{ eyebrow: "05 · Common claims", title: "Common claims and the public record", cls: "st-article cyan", body: (h) => renderClaims(h, {
    onPart: (id) => { const pt = partById.get(id); if (pt) go("inside", 6 + parts.findIndex((x) => x.id === pt.id)); },
    onHop: (n) => go("data", n - 1),
  }) }] });
  chapters.push({ id: "economics", label: "Economics", screens: [{ eyebrow: "06 · Economics", title: economics.intro.headline, cls: "st-article", body: (h) => renderEconomics(h) }] });
  chapters.push({ id: "sources", label: "Sources", screens: [{ eyebrow: "07 · Sources", title: "Sources", cls: "st-article", body: (h) => renderSources(h) }] });
  return chapters;
}

let chapters: Chapter[] = [];
let root: HTMLElement;

/** A multi-screen chapter shown one screen at a time inside the scrolling page, with its own Back, Next, dots and count. */
interface Deck { ch: Chapter; i: number; el: HTMLElement; screen: HTMLElement; bar: HTMLElement }
const decks = new Map<string, Deck>();
const chapterEl = (id: string) => document.getElementById(`ch-${id}`);

function renderScreen(sc: Screen, host: HTMLElement, count?: string): void {
  host.innerHTML = "";
  host.className = `st-screen ${sc.cls ?? ""}`;
  if (sc.figure) {
    const fig = document.createElement("div");
    fig.className = "st-figure";
    if (sc.figure.still) { const img = document.createElement("img"); img.src = still(sc.figure.still); img.alt = sc.figure.alt ?? ""; img.decoding = "async"; fig.appendChild(img); }
    else if (sc.figure.svg) fig.innerHTML = sc.figure.svg;
    if (count) fig.insertAdjacentHTML("beforeend", `<span class="st-count">${count}</span>`);
    host.appendChild(fig);
  }
  const eb = document.createElement("div"); eb.className = `st-eyebrow ${(sc.cls ?? "").includes("cyan") ? "cyan" : ""}`; eb.textContent = sc.eyebrow; host.appendChild(eb);
  const h2 = document.createElement("h2"); h2.textContent = sc.title; host.appendChild(h2);
  sc.body(host);
}

function renderDeck(d: Deck): void {
  const n = d.ch.screens.length;
  const sc = d.ch.screens[d.i]!;
  renderScreen(sc, d.screen, `${d.i + 1} / ${n}`);
  const nx = d.ch.screens[d.i + 1];
  if (nx?.figure?.still) { const pre = new Image(); pre.src = still(nx.figure.still); }
  d.bar.querySelector(".st-dots")!.innerHTML = d.ch.screens.map((_, i) => `<i class="${i === d.i ? "on" : ""}"></i>`).join("");
  d.bar.querySelector(".st-barcount")!.textContent = `${d.i + 1} / ${n}`;
  (d.bar.querySelector(".st-back") as HTMLButtonElement).disabled = d.i === 0;
  (d.bar.querySelector(".st-next") as HTMLButtonElement).disabled = d.i === n - 1;
}

function setHash(chapterId: string, i: number): void {
  history.replaceState(null, "", `#s=${chapterId}/${i}`);
}

/** Show screen `index` of a chapter and scroll the chapter into view. Article chapters ignore the index. */
function go(chapterId: string | number, index = 0, scroll = true): void {
  const ch = typeof chapterId === "number" ? chapters[chapterId] : chapters.find((x) => x.id === chapterId) ?? (chapterId === "street" ? chapters[0] : undefined);
  if (!ch) return;
  const d = decks.get(ch.id);
  if (d) { d.i = Math.max(0, Math.min(ch.screens.length - 1, index)); renderDeck(d); }
  setHash(ch.id, d?.i ?? 0);
  if (scroll) chapterEl(ch.id)?.scrollIntoView({ behavior: "auto", block: "start" });
}

function step(d: Deck, dir: 1 | -1): void {
  const i = d.i + dir;
  if (i < 0 || i >= d.ch.screens.length) return;
  d.i = i;
  renderDeck(d);
  setHash(d.ch.id, d.i);
  // Keep the deck's top in view when its height changes between screens.
  const top = d.el.getBoundingClientRect().top;
  if (top < 0) d.el.scrollIntoView({ behavior: "auto", block: "start" });
}

/** The deck nearest the middle of the viewport, for arrow keys. */
function activeDeck(): Deck | undefined {
  let best: Deck | undefined; let bestD = Infinity;
  for (const d of decks.values()) {
    const r = d.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const dist = Math.abs((r.top + r.bottom) / 2 - innerHeight / 2);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best;
}

/** Mount the scrolling stills document into the page, hiding the desktop document. */
export function initStepper(opts: { notice?: string } = {}): void {
  chapters = buildChapters();
  document.getElementById("main")!.hidden = true;
  document.getElementById("stage")!.hidden = true;
  document.getElementById("leaders")!.hidden = true;
  document.querySelector<HTMLElement>(".topbar")!.hidden = true;
  root = document.createElement("div");
  root.className = "stepper";
  root.id = "stepper";
  root.innerHTML = `
    <div class="st-top"><a class="brand" href="#top" aria-label="Back to the top"><span class="brand-mark"></span> Anatomy of a Flock camera</a><button type="button" class="st-totop" aria-label="Back to the top">↑ Top</button></div>
    <nav class="st-chapters" aria-label="Chapters"></nav>
    ${opts.notice ? `<p class="st-notice" role="status">${escape(opts.notice)} <button type="button" aria-label="Dismiss">×</button></p>` : ""}`;
  document.body.appendChild(root);
  root.querySelector(".st-notice button")?.addEventListener("click", (e) => (e.currentTarget as HTMLElement).parentElement!.remove());
  const toTop = (e: Event) => { e.preventDefault(); scrollTo({ top: 0, behavior: "auto" }); };
  root.querySelector(".st-top .brand")!.addEventListener("click", toTop);
  root.querySelector(".st-totop")!.addEventListener("click", toTop);
  const nav = root.querySelector<HTMLElement>(".st-chapters")!;

  for (const ch of chapters) {
    const sec = document.createElement("section");
    sec.className = "st-chapter";
    sec.id = `ch-${ch.id}`;
    sec.dataset.chapter = ch.id;
    const first = ch.screens[0]!;
    const article = (first.cls ?? "").includes("st-article");
    if (ch.id !== "overview") sec.innerHTML = `<div class="st-chhead"><span>${escape(ch.label)}</span><span class="st-chmeta">${article ? "article" : `${ch.screens.length} screens`}</span></div>`;
    if (article) {
      const sheet = document.createElement("div"); sheet.className = `article sheet ${first.cls ?? ""}`;
      const eb = document.createElement("div"); eb.className = `st-eyebrow ${(first.cls ?? "").includes("cyan") ? "cyan" : ""}`; eb.textContent = first.eyebrow; sheet.appendChild(eb);
      const h2 = document.createElement("h2"); h2.textContent = first.title; sheet.appendChild(h2);
      const body = document.createElement("div"); body.className = "article-body"; sheet.appendChild(body);
      first.body(body);
      sec.appendChild(sheet);
    } else {
      const screen = document.createElement("div");
      sec.appendChild(screen);
      if (ch.screens.length === 1) {
        renderScreen(first, screen);
      } else {
        const bar = document.createElement("div");
        bar.className = "st-deckbar";
        bar.innerHTML = `<button type="button" class="st-back">Back</button><div class="st-mid"><div class="st-dots"></div><span class="st-barcount"></span></div><button type="button" class="st-next pri">Next</button>`;
        sec.appendChild(bar);
        const d: Deck = { ch, i: 0, el: sec, screen, bar };
        decks.set(ch.id, d);
        bar.querySelector(".st-back")!.addEventListener("click", () => step(d, -1));
        bar.querySelector(".st-next")!.addEventListener("click", () => step(d, 1));
        let tx = 0, ty = 0, inTable = false;
        sec.addEventListener("touchstart", (e) => { tx = e.touches[0]!.clientX; ty = e.touches[0]!.clientY; inTable = !!(e.target as Element).closest(".tablewrap"); }, { passive: true });
        sec.addEventListener("touchend", (e) => { if (inTable) return; const dx = e.changedTouches[0]!.clientX - tx, dy = e.changedTouches[0]!.clientY - ty; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) step(d, dx < 0 ? 1 : -1); }, { passive: true });
        renderDeck(d);
      }
    }
    root.appendChild(sec);
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = ch.label;
    b.dataset.chapter = ch.id;
    b.addEventListener("click", () => go(ch.id, decks.get(ch.id)?.i ?? 0));
    nav.appendChild(b);
  }

  // Highlight the chapter at the top of the viewport and keep its chip visible in the rail.
  const chips = Array.from(nav.querySelectorAll<HTMLButtonElement>("button"));
  let current = "";
  const io = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    const top = visible[0]?.target as HTMLElement | undefined;
    if (!top || top.dataset.chapter === current) return;
    current = top.dataset.chapter!;
    chips.forEach((c) => c.classList.toggle("is-active", c.dataset.chapter === current));
    const chip = chips.find((c) => c.dataset.chapter === current);
    if (chip) nav.scrollLeft = Math.max(0, chip.offsetLeft - nav.clientWidth / 2 + chip.offsetWidth / 2);
    setHash(current, decks.get(current)?.i ?? 0);
  }, { rootMargin: "-25% 0px -60% 0px", threshold: 0 });
  root.querySelectorAll<HTMLElement>(".st-chapter").forEach((s) => io.observe(s));

  // Citation chips scroll to the cited bibliography row; every article is already in the page.
  setCiteHandler((id) => revealSource(id));
  addEventListener("keydown", (e) => { const d = activeDeck(); if (!d) return; if (e.key === "ArrowRight") step(d, 1); if (e.key === "ArrowLeft") step(d, -1); });

  // deep link: #s=chapter/index or ?s=chapter/index
  const m = /#s=([a-z]+)\/(\d+)/.exec(location.hash);
  const q = new URLSearchParams(location.search).get("s");
  const mm = q ? /^([a-z]+)\/(\d+)$/.exec(q) : null;
  const target = m ?? mm;
  if (target && target[1] !== "overview" && target[1] !== "street") requestAnimationFrame(() => go(target[1]!, Number(target[2])));
  (window as unknown as { __flock: unknown }).__flock = { state: { ready: true, mode: "stills", act: -1, acts: [], focusedPart: null }, go, get frame() { return Math.floor(performance.now() / 16); } };
}
