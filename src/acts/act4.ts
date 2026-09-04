import { dataflow } from "../content";
import { cite, escape, tag } from "../ui/cite";
import type { PinLayer } from "../ui/pins";
import type { World } from "../scene/world";
import type { DataViz } from "../scene/dataviz";
import { state, set, subscribe } from "../store";
import { clamp01, window01, smooth } from "../lib/math";

/** Act 4: the data journey. Hop stepper synced to scroll, retention slider, deputy search, and the 3D packet. */
export function initAct4(world: World, viz: DataViz, pins: PinLayer): void {
  const list = document.getElementById("hops")!;
  const hops = dataflow.hops.slice().sort((a, b) => a.n - b.n);
  const items: HTMLLIElement[] = [];
  for (const h of hops) {
    const li = document.createElement("li");
    li.className = "hop";
    li.id = h.id;
    const meta = [h.where, h.transport, h.storage, h.retention].filter(Boolean).map((m) => `<span>${escape(m!)}</span>`).join("");
    li.innerHTML = `
      <span class="num">${String(h.n).padStart(2, "0")}</span>
      <div>
        <div class="t">${escape(h.title)} ${tag(h.tag)}</div>
        <div class="body">
          <div class="d">${escape(h.summary)}</div>
          <div class="meta">${meta}</div>
          <div class="payload">${h.payload.map((p) => `<span>${escape(p)}</span>`).join("")}</div>
          ${h.unknowns?.length ? `<div class="unknown">${tag("unknown")} ${h.unknowns.map(escape).join(" · ")}</div>` : ""}
        </div>
      </div>`;
    li.querySelector(".body")!.appendChild(cite(h.sources));
    list.appendChild(li);
    items.push(li);
  }
  let active = -1;
  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    items.forEach((li, j) => { li.classList.toggle("is-active", j === i); li.classList.toggle("is-past", j < i); });
  };

  // Cloud and phone pins
  pins.add({ id: "p4-cloud", anchor: () => viz.cloud, k: "AWS · United States", v: "S3 · RDS · DynamoDB · CJIS data in GovCloud", dx: 0, dy: -70, cls: "cyan" });
  pins.add({ id: "p4-phone", anchor: () => viz.phone, k: "officer's phone", v: "alert in 10–15 s · MFA mandatory since Aug 2026", dx: 160, dy: -50, cls: "cyan" });
  pins.add({ id: "p4-camera", anchor: () => world.mount.getAbsolutePosition(), k: "on the pole", v: "6–12 stills · OCR · Vehicle Fingerprint", dx: -170, dy: -60, cls: "cyan" });

  // Retention
  const slider = document.getElementById("retention") as HTMLInputElement;
  const rReadout = document.getElementById("retention-readout")!;
  const presets = dataflow.retentionPresets;
  slider.max = String(presets.length - 1);
  const renderRetention = () => {
    const p = presets[state.retentionIndex] ?? presets[0]!;
    rReadout.innerHTML = `${escape(p.label)} — ${escape(p.note)}`;
    rReadout.appendChild(cite(p.sources));
    viz.setTrail(p.days, p.label.startsWith("Evidence"));
  };
  slider.addEventListener("input", () => set({ retentionIndex: Number(slider.value) }));

  // Deputy
  const form = document.getElementById("deputy-form") as HTMLFormElement;
  const reason = document.getElementById("deputy-reason") as HTMLInputElement;
  const dReadout = document.getElementById("deputy-readout")!;
  const d = dataflow.deputy;
  reason.placeholder = `e.g. "${d.reasonAsLogged}"`;
  let fanStart = 0;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const r = reason.value.trim() || d.reasonAsLogged;
    set({ deputyReason: r });
    fanStart = performance.now();
    dReadout.innerHTML = `Reason as logged: “${escape(r)}” · no warrant recorded · case number optional before Aug 2026 · <strong>${d.networks.toLocaleString()} networks</strong> · <strong>${d.cameras.toLocaleString()} cameras</strong> · ${d.lookbackDays}-day lookback · ${escape(d.date)}`;
    dReadout.appendChild(cite(d.sources));
  });

  subscribe((s, changed) => {
    if (changed.has("retentionIndex")) renderRetention();
    if (changed.has("act")) {
      const on = s.act === 4;
      viz.setVisible(on);
      pins.show("p4-cloud", false); pins.show("p4-phone", false); pins.show("p4-camera", false);
      if (!on) setActive(-1);
    }
  });
  renderRetention();

  world.scene.onBeforeRenderObservable.add(() => {
    if (state.act !== 4) return;
    const p4 = state.acts[4] ?? 0;
    const idx = Math.min(hops.length - 1, Math.floor(clamp01((p4 - 0.04) / 0.82) * hops.length));
    setActive(p4 < 0.02 ? -1 : idx);
    viz.setPacketProgress(p4, world.mount.getAbsolutePosition());
    pins.show("p4-camera", p4 > 0.03 && p4 < 0.3);
    pins.show("p4-cloud", p4 > 0.3 && p4 < 0.6);
    pins.show("p4-phone", p4 > 0.6 && p4 < 0.72);
    // Network fan-out: driven by the deputy search if it was run, else a gentle pass during hop 10.
    const scroll = smooth(window01(p4, 0.66, 0.80)) * 0.35;
    const search = fanStart ? smooth(clamp01((performance.now() - fanStart) / 2400)) : 0;
    viz.setFanout(Math.max(scroll, search) * (1 - smooth(window01(p4, 0.9, 1))));
  });
}
