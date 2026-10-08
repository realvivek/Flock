import { sourceById } from "../content";
import { escape } from "../lib/escape";
import { ROOT, PAGE } from "../lib/base";
export { escape };

const kindClass: Record<string, string> = { flock: "tag-flock", independent: "tag-indep", government: "tag-gov", court: "tag-gov" };
const kindLabel: Record<string, string> = { flock: "Flock", independent: "Independent", government: "Government", court: "Court" };

/** Link to a source's row in the bibliography: an in-page anchor on the Sources page, the Sources page elsewhere. */
export const sourceHref = (id: string): string => (PAGE === "sources" ? `#src-${id}` : `${ROOT}sources/#src-${id}`);

/** A quiet source line: each source's origin, publisher and year, linked to its row in the bibliography. */
export function cite(ids: readonly string[], max = 2): HTMLElement {
  const el = document.createElement("div");
  el.className = "cite";
  const shown = ids.slice(0, max);
  for (const id of shown) {
    const s = sourceById.get(id);
    if (!s) continue;
    const a = document.createElement("a");
    a.href = sourceHref(s.id);
    a.dataset.src = s.id;
    a.title = `${s.title} (${s.publisher}, ${s.date})`;
    a.innerHTML = `<span class="tag ${kindClass[s.kind] ?? "tag-unknown"}">${kindLabel[s.kind] ?? s.kind}</span><span class="p">${escape(short(s.publisher))}, ${escape(s.date.slice(0, 4))}</span>`;
    el.appendChild(a);
  }
  if (ids.length > max) {
    const more = document.createElement("button");
    more.type = "button";
    more.textContent = `+${ids.length - max} more`;
    more.addEventListener("click", () => { el.replaceWith(cite(ids, ids.length)); });
    el.appendChild(more);
  }
  return el;
}

export function tag(kind: "flock" | "independent" | "both" | "unknown"): string {
  const map = { flock: ["tag-flock", "Flock source"], independent: ["tag-indep", "Independent source"], both: ["tag-both", "Flock and independent"], unknown: ["tag-unknown", "Not verified"] } as const;
  const [cls, label] = map[kind];
  return `<span class="tag ${cls}">${label}</span>`;
}

function short(p: string): string {
  return p.replace(/\s*\(.*?\)\s*/g, "").split(/ via | on GitHub/)[0]!.trim();
}
