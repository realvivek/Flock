/**
 * The journey page: one photograph followed like a parcel through seven stops. A sticky slip on the left shows the
 * parcel and the stop the reader has scrolled to; the stops on the right are marked reached as they pass. Each card
 * shows one sentence and who can open the package; the paragraph, contents, data-path links and sources fold under Details.
 */
import { journey, hopById } from "./content";
import { cite, escape } from "./ui/cite";
import { el, nn, reduced, topbarHeight } from "./ui/common";
import { ROOT } from "./lib/base";
import { icon } from "./ui/icons";


export function buildJourney(host: HTMLElement): void {
  const { intro, stops } = journey;

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
    <p class="fine">Each stop summarizes stages of the <a href="${ROOT}data/">data path</a> and cites the same sources.</p>`;
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
        <p class="line">${escape(s.line)}</p>
        <p class="opens"><span class="mono">Who can open it</span> ${escape(s.opens)}</p>
        <details class="more">
          <summary><span class="mono">Details</span></summary>
          <div class="more-body">
            <p>${escape(s.body)}</p>
            <dl class="kv">
              <dt>In the package</dt><dd><ul>${s.packed.map((p) => `<li>${escape(p)}</li>`).join("")}</ul></dd>
              <dt>Data path</dt><dd>${s.hops.map((h) => { const hop = hopById.get(h); return hop ? `<a href="${ROOT}data/#stage-${hop.n}">stage ${nn(hop.n)}, ${escape(hop.title)}</a>` : ""; }).filter(Boolean).join(" · ")}</dd>
            </dl>
          </div>
        </details>
      </div>`;
    li.querySelector(".more-body")!.appendChild(cite(s.sources, 3));
    list.appendChild(li);
  });
  host.appendChild(list);

  // Mark stops reached as they scroll under the header; the slip follows.
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
  // The current stop is the last one whose card top has passed a line just under the header; at the end of the page it
  // is the last stop, so short cards on a tall screen still reach Disposed.
  const update = () => {
    const line = topbarHeight() + 160;
    let cur = 0;
    items.forEach((it, k) => { if (it.getBoundingClientRect().top < line) cur = k; });
    // On a tall screen the page is short, so the scroll position also advances the stop; the end of the page is the last stop.
    const range = document.documentElement.scrollHeight - innerHeight;
    if (range > 0) cur = Math.max(cur, Math.round((scrollY / range) * (items.length - 1)));
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) cur = items.length - 1;
    setCurrent(Math.min(cur, items.length - 1));
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  if (reduced()) host.classList.add("no-motion");
  update();
}
