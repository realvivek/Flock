/**
 * The county search: a combobox over the 3,144 counties of the 50 states and D.C. (and Puerto Rico's municipios),
 * a card with the county's mapped cameras and rate, and its place in the histogram of county rates. The county
 * file loads when the figure comes near the screen.
 */
import { BASE } from "../lib/base";
import { escape } from "../lib/escape";
import { apState, dec1, int } from "../viz/format";
import type { CountyRow, StatesFile } from "./types";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.']/g, "");
const STATE_NAMES: Record<string, string> = {};

export function initLookup(root: HTMLElement, onBusy: (d: number) => void): void {
  const input = root.querySelector<HTMLInputElement>("#county-q")!;
  const list = root.querySelector<HTMLUListElement>("#county-list")!;
  const card = root.querySelector<HTMLElement>(".lk-card")!;
  const marks = [...root.querySelectorAll<SVGGElement>(".lk-mark")];
  let rows: CountyRow[] = [], states: StatesFile | null = null, matches: CountyRow[] = [], active = -1;

  const load = async () => {
    onBusy(1);
    try {
      [rows, states] = await Promise.all([fetch(`${BASE}data/story/counties.json`).then((r) => r.json()), fetch(`${BASE}data/story/states.json`).then((r) => r.json())]);
      for (const s of states!.rows) STATE_NAMES[s.usps] = s.name;
      input.disabled = false;
    } finally { onBusy(-1); }
  };
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); void load(); } }, { rootMargin: "800px 0px" });
  io.observe(root);

  const us = () => rows.filter((c) => c[2] !== "PR" && c[6] != null);
  const label = (c: CountyRow) => `${c[1]}, ${apState(c[2])}`;

  function select(c: CountyRow): void {
    const st = states!.rows.find((r) => r.usps === c[2]);
    const pool = us();
    const pct = c[6] == null ? null : Math.round(pool.filter((x) => x[6]! < c[6]!).length / pool.length * 100);
    const rate = c[6] == null ? "Population not available" : c[3] === 0 ? "None mapped" : `${dec1(c[6])} per 100,000 residents`;
    const rank = c[3] === 0 || pct == null || c[2] === "PR" ? "" : `, higher than in ${pct} percent of counties`;
    card.innerHTML = `<p class="lk-name">${escape(label(c))}</p><p class="lk-big"><span class="n">${int(c[3])}</span> mapped Flock camera${c[3] === 1 ? "" : "s"}</p><p class="lk-rate">${escape(rate)}${rank}. ${st && st.per100k != null ? `${escape(st.name)}: ${dec1(st.per100k)}.` : ""} U.S.: ${dec1(states!.usRate)}.</p>`;
    input.value = label(c);
    // move the marker in each histogram (they share bins; positions are read from the drawn bars)
    for (const m of marks) {
      const svg = m.ownerSVGElement!;
      const bars = [...svg.querySelectorAll<SVGRectElement>("rect[data-bin]")];
      const v = c[3] === 0 ? -1 : c[6] ?? -1;
      const bin = v < 0 ? 0 : v >= 300 ? bars.length - 1 : 1 + Math.floor(v / 10);
      const b = bars[Math.min(bin, bars.length - 1)]!;
      const x0 = +b.getAttribute("x")!, w = +b.getAttribute("width")!;
      const x = v < 0 || v >= 300 ? x0 + w / 2 : x0 + ((v % 10) / 10) * (w + 1);
      m.setAttribute("transform", `translate(${Math.round(x * 10) / 10},0)`);
      const t = m.querySelector("text"), right = x > +(m.dataset.w ?? 600) * 0.62;
      if (t) { t.textContent = c[1]; t.setAttribute("x", right ? "-7" : "7"); t.setAttribute("text-anchor", right ? "end" : "start"); }
    }
    close();
  }
  function close(): void { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; input.removeAttribute("aria-activedescendant"); }
  function render(): void {
    list.innerHTML = matches.map((c, i) => `<li id="lk-opt-${i}" role="option" aria-selected="${i === active}" data-i="${i}"><span>${escape(label(c))}</span><span class="v">${int(c[3])}</span></li>`).join("");
    list.hidden = matches.length === 0;
    input.setAttribute("aria-expanded", String(!list.hidden));
    if (active >= 0) { input.setAttribute("aria-activedescendant", `lk-opt-${active}`); list.children[active]?.scrollIntoView({ block: "nearest" }); }
  }
  function search(q: string): void {
    const f = fold(q.trim());
    if (!f) { matches = []; render(); return; }
    // "fulton", "fulton ga", "fulton county, georgia", "georgia"
    const words = f.split(/[\s,]+/).filter(Boolean);
    matches = rows.filter((c) => {
      const hay = fold(`${c[1]} ${c[2]} ${STATE_NAMES[c[2]] ?? ""} ${apState(c[2])}`);
      return words.every((w) => hay.includes(w));
    }).sort((a, b) => (fold(a[1]).startsWith(words[0]!) ? 0 : 1) - (fold(b[1]).startsWith(words[0]!) ? 0 : 1) || (b[5] ?? 0) - (a[5] ?? 0)).slice(0, 12);
    active = matches.length ? 0 : -1;
    render();
  }
  input.addEventListener("input", () => search(input.value));
  input.addEventListener("focus", () => { if (input.value) input.select(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!matches.length) return; active = (active + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length; render(); }
    else if (e.key === "Enter") { e.preventDefault(); const c = matches[Math.max(0, active)]; if (c) select(c); }
    else if (e.key === "Escape") close();
  });
  list.addEventListener("pointerdown", (e) => { const li = (e.target as Element).closest("li"); if (li) { e.preventDefault(); select(matches[+li.dataset.i!]!); } });
  input.addEventListener("blur", () => setTimeout(close, 120));
}
