/**
 * The journey page: one photograph followed like a parcel through seven stops. A sticky slip on the left shows the
 * parcel and the stop the reader has scrolled to; the stops on the right are marked reached as they pass.
 */
import { journey, hopById } from "./content";
import { cite, escape } from "./ui/cite";
import { el, nn, reduced } from "./ui/common";
import { ROOT } from "./lib/base";

const ICONS: Record<string, string> = {
  pole: '<path d="M12 3v18M8 21h8M9 6h6v5H9z"/><path d="M15 8h3" />',
  tower: '<path d="M12 8v13M8 21h8M9.5 21l2.5-9 2.5 9"/><path d="M8 6a5.5 5.5 0 0 1 8 0M5.5 3.5a9 9 0 0 1 13 0"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 8.5a3.8 3.8 0 0 1 .5 7.5H7z"/><path d="M9 14h6M9 11.5h6" />',
  list: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 12.5h8M8 16h5"/><path d="M6.5 9l-1 1"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/><path d="M3.5 6.5a6 6 0 0 1 0 11M20.5 6.5a6 6 0 0 1 0 11" stroke-dasharray="1.5 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M14.5 14.5 20 20"/>',
  bin: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 10v7M14 10v7"/>',
};
const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;

export function buildJourney(host: HTMLElement): void {
  const { intro, stops } = journey;
  document.getElementById("journey-eyebrow")!.textContent = intro.eyebrow;
  document.getElementById("journey-title")!.textContent = intro.title;
  document.getElementById("journey-lede")!.textContent = intro.lede;

  // The slip: parcel card and the current stop, sticky beside the list on desktop.
  const slip = el("aside", "slip sheet");
  slip.innerHTML = `
    <div class="parcel" aria-hidden="true">
      <div class="parcel-photo"><span class="plate">${escape(intro.parcel.plate)}</span></div>
      <div class="parcel-stamp mono">${escape(intro.parcel.label)}</div>
    </div>
    <p class="parcel-contents">${escape(intro.parcel.contents)}</p>
    <div class="slip-status">
      <span class="mono" id="slip-count">Stop 1 of ${stops.length}</span>
      <strong id="slip-status">${escape(stops[0]!.status)}</strong>
      <span id="slip-where">${escape(stops[0]!.where)}</span>
    </div>
    <ol class="slip-route" aria-label="Stops">${stops.map((s, i) => `<li data-i="${i}"><a href="#${s.id}"><span class="dot"></span>${escape(s.status)}</a></li>`).join("")}</ol>
    <p class="fine">Each stop summarises stages of the <a href="${ROOT}data/">data path</a> and cites the same sources.</p>`;
  host.appendChild(slip);

  const list = el("ol", "stops");
  stops.forEach((s, i) => {
    const li = el("li", "stop");
    li.id = s.id;
    li.dataset.i = String(i);
    li.innerHTML = `
      <div class="marker"><span class="ring">${icon(s.icon)}</span></div>
      <div class="stop-body">
        <div class="stop-head">
          <span class="status mono">${nn(i + 1)} · ${escape(s.status)}</span>
          <span class="when mono">${escape(s.when)}</span>
        </div>
        <h2>${escape(s.title)}</h2>
        <div class="where">${escape(s.where)}</div>
        <p>${escape(s.body)}</p>
        <dl class="kv">
          <dt>In the package</dt><dd><ul>${s.packed.map((p) => `<li>${escape(p)}</li>`).join("")}</ul></dd>
          <dt>Who can open it</dt><dd>${escape(s.opens)}</dd>
          <dt>Data path</dt><dd>${s.hops.map((h) => { const hop = hopById.get(h); return hop ? `<a href="${ROOT}data/#stage-${hop.n}">stage ${nn(hop.n)}, ${escape(hop.title)}</a>` : ""; }).filter(Boolean).join(" · ")}</dd>
        </dl>
      </div>`;
    li.querySelector(".stop-body")!.appendChild(cite(s.sources, 3));
    list.appendChild(li);
  });
  host.appendChild(list);

  // Mark stops reached as they scroll past the middle of the viewport; the slip follows.
  const items = [...list.querySelectorAll<HTMLElement>(".stop")];
  const routeItems = [...slip.querySelectorAll<HTMLElement>(".slip-route li")];
  const setCurrent = (i: number) => {
    items.forEach((it, k) => it.classList.toggle("is-reached", k <= i));
    routeItems.forEach((it, k) => { it.classList.toggle("is-reached", k <= i); it.classList.toggle("is-current", k === i); });
    host.style.setProperty("--progress", String(i / Math.max(1, stops.length - 1)));
    document.getElementById("slip-count")!.textContent = `Stop ${i + 1} of ${stops.length}`;
    document.getElementById("slip-status")!.textContent = stops[i]!.status;
    document.getElementById("slip-where")!.textContent = stops[i]!.where;
  };
  const update = () => {
    const line = innerHeight * 0.55;
    let cur = 0;
    items.forEach((it, k) => { if (it.getBoundingClientRect().top < line) cur = k; });
    setCurrent(cur);
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  if (reduced()) host.classList.add("no-motion");
  update();
}
