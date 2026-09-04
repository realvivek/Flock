import "./stepper.css";
import { components, install, dataflow, myths, economics, products, sources, stillById } from "../content";
import { cite, escape, tag } from "../ui/cite";

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
const table = (host: HTMLElement, head: string[], rows: { cells: string[]; sources: string[] }[]) => {
  const wrap = document.createElement("div"); wrap.className = "st-tablewrap";
  const t = document.createElement("table"); t.className = "st-table";
  t.innerHTML = `<thead><tr>${head.map((h) => `<th>${escape(h)}</th>`).join("")}</tr></thead>`;
  const tb = document.createElement("tbody");
  for (const r of rows) { const tr = document.createElement("tr"); r.cells.forEach((c, i) => { const td = document.createElement("td"); td.textContent = c; if (i === r.cells.length - 1) td.appendChild(cite(r.sources, 1)); tr.appendChild(td); }); tb.appendChild(tr); }
  t.appendChild(tb); wrap.appendChild(t); host.appendChild(wrap);
};

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

  chapters.push({ id: "street", label: "Street", screens: [
    { eyebrow: "Interactive explainer", title: "Anatomy of a Flock camera", figure: { still: "pole-flock", alt: "A Flock camera on its pole" }, body: (h) => { p(h, "There are more than a hundred thousand of these on poles across the United States. This is one of them, at real scale, taken apart one board at a time, with every byte it produces followed to where it ends up."); p(h, "Built from Flock's own specification sheets and price lists, three independent teardowns, Flock's data-architecture document, FOIA'd audit logs, and court and congressional records. Every figure carries a citation. Tap Next to walk through it.", true); } },
    { eyebrow: "The product line", title: "One name, several machines", figure: { still: "falcon-front", alt: "Falcon front view" }, body: (h) => { p(h, "Half of the arguments about Flock come from collapsing different products into one. The plate reader takes stills; the video camera streams; the audio sensor listens for gunshots.", true); for (const pr of products) { const d = document.createElement("div"); d.innerHTML = `<dl class="st-kv"><dt>${escape(pr.name)}</dt><dd><strong>${escape(pr.type)}.</strong> ${escape(pr.captures)} <span class="muted">${escape(pr.not)}</span></dd></dl>`; d.querySelector("dd")!.appendChild(cite(pr.sources, 1)); h.appendChild(d); } } },
  ]});

  const modeScreens: Screen[] = (["flock", "existing", "ac"] as const).map((m) => ({
    eyebrow: "01 · The pole · installer view", title: install.modes[m]!.label, figure: { still: `pole-${m}`, alt: install.modes[m]!.label },
    body: (h) => { if (m === "flock") p(h, "A standard Flock install is a dedicated breakaway pole set in dirt or grass by a Flock crew. The camera is banded on at roughly ten feet, aimed diagonally down the lane so the rear plates of departing vehicles pass through a narrow field of view."); facts(h, install.modes[m]!.facts); },
  }));
  modeScreens.push({ eyebrow: "01 · The pole · coverage", title: "What one camera sees", figure: { still: "falcon-side", alt: "Falcon side view" }, body: (h) => { const c = install.coverage; kv(h, [["Field of view", `${c.widthFt} ft wide at ${c.distFt} ft`], ["Range", `up to ${c.maxFt} ft, ${c.lanes} lanes, ${c.mph} mph`], ["Frames", `${c.framesPerVehicle} stills per vehicle`], ["Aims at", c.aims]]); h.appendChild(cite(c.sources)); p(h, "The two published range figures disagree. The spec sheet says 65 ft; marketing says 75 to 100 ft.", true); } });
  chapters.push({ id: "pole", label: "Pole", screens: modeScreens });

  const inside: Screen[] = [];
  const stageCopy = ["Assembled. Eight and three-quarter inches tall, three pounds, band-clamped to the pole.", "The bezel and the illuminator ring come forward.", "The lens, the mechanical IR-cut filter and the sensor follow.", "The mainboard stays put; the system on module, storage and modem lift off it.", "Radios and the GPS patch separate; the rear shell moves back.", "Fully apart: thirteen parts and the clamps, front to back."];
  for (let k = 0; k <= 5; k++) inside.push({ eyebrow: "02 · Inside the enclosure", title: k === 0 ? "Thirteen parts, front to back" : `Stage ${k} of 5`, figure: { still: `explode-${k}`, alt: `Exploded view stage ${k}` }, body: (h) => { p(h, stageCopy[k]!); if (k === 5) { const chips = document.createElement("div"); chips.className = "st-chips"; parts.forEach((pt, i) => { const b = document.createElement("button"); b.textContent = `${String(pt.order).padStart(2, "0")} ${pt.name}`; b.addEventListener("click", () => go("inside", 6 + i)); chips.appendChild(b); }); h.appendChild(chips); } } });
  for (const pt of parts) inside.push({ eyebrow: `02 · Inside · part ${String(pt.order).padStart(2, "0")} of 14`, title: pt.name, figure: { still: `part-${pt.id}`, alt: pt.name }, body: (h) => { if (pt.partNumber) p(h, `${pt.partNumber}${pt.vendor ? " · " + pt.vendor : ""}`, true); p(h, pt.function); kv(h, Object.entries(pt.spec)); h.appendChild(cite(pt.sources)); } });
  chapters.push({ id: "inside", label: "Inside", screens: inside });

  chapters.push({ id: "power", label: "Power", screens: (["solar", "ac", "wing"] as const).map((m) => ({ eyebrow: "03 · Power and cable", title: install.paths[m]!.label, figure: { still: m === "wing" ? "wing-closet" : m === "ac" ? "pole-ac" : "pole-flock", alt: install.paths[m]!.label }, body: (h) => { p(h, install.paths[m]!.summary); facts(h, install.paths[m]!.facts); } })) });

  const data: Screen[] = hops.map((hp) => ({ eyebrow: `04 · The data · hop ${String(hp.n).padStart(2, "0")} of 12`, title: hp.title, figure: { svg: hopSvg(hp.n) }, cls: "cyan", body: (h) => { const t = document.createElement("div"); t.innerHTML = tag(hp.tag); h.appendChild(t); p(h, hp.summary); kv(h, [["Where", hp.where], ...(hp.transport ? [["Transport", hp.transport] as [string, string]] : []), ...(hp.storage ? [["Storage", hp.storage] as [string, string]] : []), ...(hp.retention ? [["Retention", hp.retention] as [string, string]] : []), ["In the packet", hp.payload.join(", ")]]); if (hp.unknowns?.length) { const u = document.createElement("p"); u.className = "muted"; u.innerHTML = `${tag("unknown")} ${hp.unknowns.map(escape).join(" · ")}`; h.appendChild(u); } h.appendChild(cite(hp.sources)); } }));
  data.push({ eyebrow: "04 · The data · retention", title: "How long one vehicle stays searchable", cls: "cyan", figure: { svg: hopSvg(12) }, body: (h) => { const chips = document.createElement("div"); chips.className = "st-chips"; const out = document.createElement("p"); out.className = "st-readout"; const set = (i: number) => { const r = dataflow.retentionPresets[i]!; out.textContent = `${r.label}: ${r.note}`; chips.querySelectorAll("button").forEach((b, j) => b.classList.toggle("is-active", j === i)); }; dataflow.retentionPresets.forEach((r, i) => { const b = document.createElement("button"); b.textContent = r.label; b.addEventListener("click", () => set(i)); chips.appendChild(b); }); h.appendChild(chips); h.appendChild(out); set(0); h.appendChild(cite(dataflow.retentionPresets.flatMap((r) => r.sources), 3)); } });
  data.push({ eyebrow: "04 · The data · be the deputy", title: "Run a nationwide search", cls: "cyan", figure: { svg: hopSvg(10) }, body: (h) => { const d = dataflow.deputy; p(h, "Type a reason and search. This reproduces one documented query from April 2025: no warrant, and until August 2026 no case number.", true); const f = document.createElement("form"); f.className = "st-form"; f.innerHTML = `<input type="text" maxlength="60" placeholder="e.g. &quot;${escape(d.reasonAsLogged)}&quot;" aria-label="Reason for search" /><button type="submit">Search</button>`; const out = document.createElement("p"); out.className = "st-readout"; f.addEventListener("submit", (e) => { e.preventDefault(); const r = (f.querySelector("input") as HTMLInputElement).value.trim() || d.reasonAsLogged; out.textContent = `Reason logged: “${r}” · ${d.networks.toLocaleString()} networks · ${d.cameras.toLocaleString()} cameras · ${d.lookbackDays}-day lookback · ${d.date}`; }); h.appendChild(f); h.appendChild(out); h.appendChild(cite(d.sources)); } });
  chapters.push({ id: "data", label: "Data", screens: data });

  chapters.push({ id: "myths", label: "Myths", screens: myths.map((m) => ({ eyebrow: "05 · Myths and facts", title: `“${m.claim}”`, cls: "st-myth", body: (h) => { const v = document.createElement("div"); v.className = `verdict ${m.verdict}`; v.textContent = m.verdict === "false" ? "Not true" : m.verdict === "true" ? "True" : "It depends"; h.appendChild(v); p(h, m.nuance); h.appendChild(cite(m.sources)); } })) });

  const e = economics;
  const econ: Screen[] = [
    { eyebrow: "06 · Economics", title: e.intro.headline, figure: { still: "pole-flock", alt: "The priced pole" }, body: (h) => { p(h, e.intro.summary); kv(h, e.pricedPole.map((pp) => [pp.k, pp.v] as [string, string])); h.appendChild(cite(e.intro.sources)); } },
    { eyebrow: "06 · Economics · list prices", title: "What each product costs per year", body: (h) => table(h, ["Item", "Price", "Term"], e.priceList.map((r) => ({ cells: [r.item, r.price, r.term], sources: r.sources }))) },
    { eyebrow: "06 · Economics", title: "What the annual fee covers", body: (h) => facts(h, e.included) },
    { eyebrow: "06 · Economics", title: "What the customer pays on top", body: (h) => facts(h, e.extra) },
    { eyebrow: "06 · Economics · fees", title: "Install and service fees, then and now", body: (h) => table(h, ["Fee", "2019 to 2023", "2026"], e.fees.map((r) => ({ cells: [r.item, r.then, r.now], sources: r.sources }))) },
    { eyebrow: "06 · Economics · price history", title: "How the price moved", body: (h) => table(h, ["When", "Price", "Note"], e.history.map((r) => ({ cells: [r.date, r.price, r.note], sources: r.sources }))) },
    { eyebrow: "06 · Economics · installation", title: "An install, and who does what", body: (h) => table(h, ["Step", "Flock", "Customer", "Others"], e.workflow.map((r) => ({ cells: [r.step, r.flock, r.customer, r.other || "—"], sources: r.sources }))) },
    { eyebrow: "06 · Economics · workforce", title: "Who turns the wrenches", body: (h) => facts(h, e.workforce) },
    { eyebrow: "06 · Economics · permits", title: "Permits, by where the pole goes", body: (h) => table(h, ["Where", "Needed", "Who", "What has happened"], e.permitting.map((r) => ({ cells: [r.scenario, r.permit, r.who, r.note || "—"], sources: r.sources }))) },
    { eyebrow: "06 · Economics · contract", title: "Ownership and the contract", body: (h) => facts(h, e.contract) },
    { eyebrow: "06 · Economics · scale", title: "How big it is", body: (h) => facts(h, e.scale) },
    { eyebrow: "06 · Economics", title: "What nobody outside Flock can say", body: (h) => { const ul = document.createElement("ul"); ul.className = "st-list"; for (const u of e.unknowns) { const li = document.createElement("li"); li.textContent = u.v; li.appendChild(cite(u.sources, 1)); ul.appendChild(li); } h.appendChild(ul); } },
  ];
  chapters.push({ id: "economics", label: "Economics", screens: econ });

  chapters.push({ id: "sources", label: "Sources", screens: [{ eyebrow: "07 · Sources and method", title: "Every number on this page", cls: "st-sources", body: (h) => { p(h, "Sources are tagged by origin. Flock is the company's own document; Independent is a teardown, court filing, audit or journalism. Each entry carries the date it was last checked.", true); const list = document.createElement("div"); list.className = "sources"; for (const s of sources.slice().sort((a, b) => a.kind.localeCompare(b.kind) || a.date.localeCompare(b.date))) { const row = document.createElement("div"); row.className = "source"; row.id = `src-${s.id}`; row.innerHTML = `<span><a href="${escape(s.url)}" rel="noopener noreferrer" target="_blank">${escape(s.title)}</a><br /><span class="pub">${escape(s.publisher)}</span></span><span class="date">${escape(s.date)} · checked ${escape(s.lastVerified)}</span>`; list.appendChild(row); } h.appendChild(list); } }] });
  return chapters;
}

let chapters: Chapter[] = [];
let root: HTMLElement;
let cur = { c: 0, i: 0 };

function go(chapterId: string | number, index = 0): void {
  const c = typeof chapterId === "number" ? chapterId : Math.max(0, chapters.findIndex((x) => x.id === chapterId));
  const ch = chapters[c]!;
  cur = { c, i: Math.max(0, Math.min(ch.screens.length - 1, index)) };
  history.replaceState(null, "", `#s=${ch.id}/${cur.i}`);
  render();
  scrollTo({ top: 0, behavior: "auto" });
}

function next(dir: 1 | -1): void {
  const ch = chapters[cur.c]!;
  const i = cur.i + dir;
  if (i >= 0 && i < ch.screens.length) return go(cur.c, i);
  const c = cur.c + dir;
  if (c < 0 || c >= chapters.length) return;
  go(c, dir === 1 ? 0 : chapters[c]!.screens.length - 1);
}

function render(): void {
  const ch = chapters[cur.c]!;
  const sc = ch.screens[cur.i]!;
  root.querySelectorAll(".st-chapters button").forEach((b, i) => b.classList.toggle("is-active", i === cur.c));
  const screen = root.querySelector<HTMLElement>(".st-screen")!;
  screen.innerHTML = "";
  screen.className = `st-screen ${sc.cls ?? ""}`;
  if (sc.figure) {
    const fig = document.createElement("div");
    fig.className = "st-figure";
    if (sc.figure.still) { const img = document.createElement("img"); img.src = still(sc.figure.still); img.alt = sc.figure.alt ?? ""; img.decoding = "async"; fig.appendChild(img); }
    else if (sc.figure.svg) fig.innerHTML = sc.figure.svg;
    fig.insertAdjacentHTML("beforeend", `<span class="st-count">${cur.i + 1} / ${ch.screens.length}</span>`);
    screen.appendChild(fig);
  }
  const eb = document.createElement("div"); eb.className = `st-eyebrow ${sc.cls === "cyan" ? "cyan" : ""}`; eb.textContent = sc.eyebrow; screen.appendChild(eb);
  const h2 = document.createElement("h2"); h2.textContent = sc.title; screen.appendChild(h2);
  sc.body(screen);
  // preload the next still
  const nx = ch.screens[cur.i + 1] ?? chapters[cur.c + 1]?.screens[0];
  if (nx?.figure?.still) { const pre = new Image(); pre.src = still(nx.figure.still); }
  const dots = root.querySelector<HTMLElement>(".st-dots")!;
  dots.innerHTML = ch.screens.map((_, i) => `<i class="${i === cur.i ? "on" : ""}"></i>`).join("");
  (root.querySelector("#st-back") as HTMLButtonElement).disabled = cur.c === 0 && cur.i === 0;
  (root.querySelector("#st-next") as HTMLButtonElement).disabled = cur.c === chapters.length - 1 && cur.i === ch.screens.length - 1;
  (root.querySelector("#st-next") as HTMLButtonElement).textContent = cur.i === ch.screens.length - 1 && cur.c < chapters.length - 1 ? `Next: ${chapters[cur.c + 1]!.label}` : "Next";
}

/** Mount the stills stepper into the page, hiding the desktop document. */
export function initStepper(): void {
  chapters = buildChapters();
  document.getElementById("main")!.hidden = true;
  document.getElementById("stage")!.hidden = true;
  document.getElementById("leaders")!.hidden = true;
  document.querySelector<HTMLElement>(".topbar")!.hidden = true;
  root = document.createElement("div");
  root.className = "stepper";
  root.id = "stepper";
  root.innerHTML = `
    <div class="st-top"><span class="brand"><span class="brand-mark"></span> Anatomy of a Flock camera</span></div>
    <nav class="st-chapters" aria-label="Chapters"></nav>
    <div class="st-screen"></div>
    <div class="st-nav"><button id="st-back" type="button">Back</button><div class="st-dots"></div><button id="st-next" type="button" class="pri">Next</button></div>`;
  document.body.appendChild(root);
  const nav = root.querySelector(".st-chapters")!;
  chapters.forEach((ch, i) => { const b = document.createElement("button"); b.textContent = ch.label; b.addEventListener("click", () => go(i, 0)); nav.appendChild(b); });
  root.querySelector("#st-back")!.addEventListener("click", () => next(-1));
  root.querySelector("#st-next")!.addEventListener("click", () => next(1));
  addEventListener("keydown", (e) => { if (e.key === "ArrowRight") next(1); if (e.key === "ArrowLeft") next(-1); });
  let tx = 0, ty = 0;
  root.addEventListener("touchstart", (e) => { tx = e.touches[0]!.clientX; ty = e.touches[0]!.clientY; }, { passive: true });
  root.addEventListener("touchend", (e) => { const dx = e.changedTouches[0]!.clientX - tx, dy = e.changedTouches[0]!.clientY - ty; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) next(dx < 0 ? 1 : -1); }, { passive: true });
  // deep link: #s=chapter/index
  const m = /#s=([a-z]+)\/(\d+)/.exec(location.hash);
  const q = new URLSearchParams(location.search).get("s");
  const mm = q ? /^([a-z]+)\/(\d+)$/.exec(q) : null;
  const target = m ?? mm;
  if (target) go(target[1]!, Number(target[2])); else go(0, 0);
  (window as unknown as { __flock: unknown }).__flock = { state: { ready: true, mode: "stills", act: -1, acts: [], focusedPart: null }, go, get frame() { return Math.floor(performance.now() / 16); } };
}
