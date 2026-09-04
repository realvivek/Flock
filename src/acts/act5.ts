import { myths, partById, hopById } from "../content";
import { cite, escape } from "../ui/cite";
import { set } from "../store";

/** Act 5: claim cards. Each links to the related component or data stage. */
export function initAct5(): void {
  const host = document.getElementById("myths")!;
  for (const m of myths) {
    const el = document.createElement("article");
    el.className = "myth";
    el.id = `myth-${m.id}`;
    const verdict = m.verdict === "false" ? "Not supported by the record" : m.verdict === "true" ? "Supported by the record" : "Depends on the product or setting";
    el.innerHTML = `
      <div class="claim">“${escape(m.claim)}”</div>
      <div class="verdict ${m.verdict}">${verdict}</div>
      <div class="nuance">${escape(m.nuance)}</div>
      <div class="links"></div>`;
    const links = el.querySelector(".links")!;
    if (m.part) {
      const p = partById.get(m.part);
      if (p) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = `See part ${String(p.order).padStart(2, "0")} · ${p.name}`;
        b.addEventListener("click", () => { document.getElementById("act-2")?.scrollIntoView({ behavior: "smooth" }); setTimeout(() => set({ focusedPart: p.id }), 900); });
        links.appendChild(b);
      }
    }
    if (m.hop) {
      const h = hopById.get(m.hop);
      if (h) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = `See hop ${String(h.n).padStart(2, "0")} · ${h.title}`;
        b.addEventListener("click", () => {
          const sec = document.getElementById("act-4")!;
          const top = sec.offsetTop + (sec.offsetHeight - innerHeight) * (0.06 + ((h.n - 0.5) / 12) * 0.8);
          scrollTo({ top, behavior: "smooth" });
        });
        links.appendChild(b);
      }
    }
    el.appendChild(cite(m.sources));
    host.appendChild(el);
  }
}
