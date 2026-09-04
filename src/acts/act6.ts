import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { economics } from "../content";
import { cite, escape } from "../ui/cite";
import type { PinLayer } from "../ui/pins";
import type { World } from "../scene/world";
import { state, subscribe } from "../store";

const byId = (id: string) => document.getElementById(id)!;

function rows(host: HTMLElement, list: { k: string; v: string; sources: string[] }[]) {
  const wrap = document.createElement("div");
  wrap.className = "rows";
  for (const r of list) {
    const d = document.createElement("div");
    d.className = "row";
    d.innerHTML = `<span class="k">${escape(r.k)}</span><span class="v">${escape(r.v)}</span>`;
    d.querySelector(".v")!.appendChild(cite(r.sources));
    wrap.appendChild(d);
  }
  host.appendChild(wrap);
}

function table(host: HTMLElement, head: string[], body: { cells: string[]; num?: number[]; sources: string[] }[]) {
  const wrap = document.createElement("div");
  wrap.className = "tablewrap";
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

/** Act 6: economics. Tables and rows from economics.json, and the priced pole in 3D. */
export function initAct6(world: World, pins: PinLayer): void {
  const e = economics;
  byId("econ-headline").textContent = e.intro.headline;
  const sum = byId("econ-summary");
  sum.textContent = e.intro.summary;
  sum.appendChild(cite(e.intro.sources));

  rows(byId("econ-included"), e.included);
  rows(byId("econ-extra"), e.extra);
  table(byId("econ-prices"), ["Item", "Price", "Term"], e.priceList.map((p) => ({ cells: [p.item + (p.sku ? ` (${p.sku})` : ""), p.price, p.term], num: [1], sources: p.sources })));

  const tl = document.createElement("div");
  tl.className = "timeline";
  for (const h of e.history) {
    const d = document.createElement("div");
    d.className = "tl";
    d.innerHTML = `<span class="d">${escape(h.date)}</span><span class="p">${escape(h.price)}</span><span class="n">${escape(h.note)}</span>`;
    d.querySelector(".n")!.appendChild(cite(h.sources, 1));
    tl.appendChild(d);
  }
  byId("econ-history").appendChild(tl);

  table(byId("econ-fees"), ["Fee", "2019 to 2023", "2026 schedule"], e.fees.map((f) => ({ cells: [f.item, f.then, f.now], num: [1, 2], sources: f.sources })));
  table(byId("econ-workflow"), ["Step", "Flock", "Customer", "Utility, DOT or electrician"], e.workflow.map((w) => ({ cells: [w.step, w.flock, w.customer, w.other || "—"], sources: w.sources })));
  rows(byId("econ-workforce"), e.workforce);
  table(byId("econ-permitting"), ["Location", "Permit", "Responsibility", "Documented cases"], e.permitting.map((p) => ({ cells: [p.scenario, p.permit, p.who, p.note || "—"], sources: p.sources })));
  rows(byId("econ-contract"), e.contract);
  rows(byId("econ-scale"), e.scale);
  const un = document.createElement("ul");
  un.className = "unknown-list";
  for (const u of e.unknowns) { const li = document.createElement("li"); li.textContent = u.v; li.appendChild(cite(u.sources, 1)); un.appendChild(li); }
  byId("econ-unknowns").appendChild(un);

  // Priced pole: amber pins on the pole with the fee attached to each element.
  for (const p of e.pricedPole) {
    const a = new Vector3(p.anchor[0], p.anchor[1], p.anchor[2]);
    pins.add({ id: p.id, anchor: () => a, k: p.k, v: p.v, dx: p.dx, dy: p.dy, cls: "amber" });
  }
  const showPins = (on: boolean) => { for (const p of e.pricedPole) pins.show(p.id, on); };
  subscribe((s, changed) => {
    if (changed.has("act")) {
      showPins(s.act === 6);
      if (s.act === 6) {
        // The economics view shows the standard Flock pole regardless of the installer toggle.
        const g = world.poleGroups;
        for (const m of g.pole) m.setEnabled(true);
        g.solar?.setEnabled(true); g.battery?.setEnabled(true); g.flag?.setEnabled(true);
        g.utility?.setEnabled(false); g.utilitySolar?.setEnabled(false); g.ac?.setEnabled(false);
        if (world.falcon) world.falcon.position.z = 0.10;
      } else if (state.poleMode !== "flock" && s.act === 5) {
        // leaving toward the installer act restores the toggle state via act1's subscription
      }
    }
  });
  showPins(false);
}
