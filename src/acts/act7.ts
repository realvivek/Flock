import { sources } from "../content";
import { escape } from "../ui/cite";

const kindClass: Record<string, string> = { flock: "tag-flock", independent: "tag-indep", government: "tag-gov", court: "tag-gov" };
const kindLabel: Record<string, string> = { flock: "Flock", independent: "Independent", government: "Government", court: "Court" };
const order = ["flock", "independent", "government", "court"];

/** Act 7: the bibliography, grouped by origin, each entry with its date and the date it was last checked. */
export function initAct7(): void {
  const host = document.getElementById("sources")!;
  const sorted = sources.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.date.localeCompare(b.date));
  let lastKind = "";
  for (const s of sorted) {
    if (s.kind !== lastKind) {
      lastKind = s.kind;
      const h = document.createElement("h3");
      h.className = "src-group";
      h.innerHTML = `<span class="tag ${kindClass[s.kind]}">${kindLabel[s.kind]}</span> ${s.kind === "flock" ? "Flock Safety's own documents and pages" : s.kind === "independent" ? "Teardowns, research and journalism" : s.kind === "government" ? "Legislatures, agencies and Congress" : "Courts"}`;
      host.appendChild(h);
    }
    const row = document.createElement("div");
    row.className = "source";
    row.id = `src-${s.id}`;
    row.innerHTML = `
      <span class="id">${escape(s.id)}</span>
      <span><a href="${escape(s.url)}" rel="noopener noreferrer" target="_blank">${escape(s.title)}</a><br /><span class="pub">${escape(s.publisher)}</span></span>
      <span class="date">${escape(s.date)}<br />checked ${escape(s.lastVerified)}</span>`;
    host.appendChild(row);
  }
}
