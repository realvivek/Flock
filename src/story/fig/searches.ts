/** Who can search: the audit-log entries of the Johnson County, Texas, searches of May 9, 2025, and three accounts. */
import { escape } from "../../lib/escape.ts";
import { int, smart } from "../../viz/format.ts";
import { frame, type Ctx } from "../frame.ts";
import type { FigureCfg } from "../schema.ts";

export interface Deputy { networks: number; cameras: number; lookbackDays: number; date: string; reasonAsLogged: string; first?: { networks: number; cameras: number; lookbackDays: number }; caseNumber?: string; accounts?: { who: string; text: string }[] }

export function auditFigure(cfg: FigureCfg, ctx: Ctx, d: Deputy): string {
  const f = d.first!;
  const rows: [string, string, string][] = [
    ["Date", d.date, "same"],
    ["Agency", "Johnson County Sheriff’s Office, Tex.", "same"],
    ["Time frame", `${f.lookbackDays} days`, `${d.lookbackDays} days`],
    ["Networks searched", int(f.networks), int(d.networks)],
    ["Cameras searched", int(f.cameras), int(d.cameras)],
    ["Reason", `“${d.reasonAsLogged}”`, "same"],
    ["Case number", "[The office’s death investigation]", "same"],
  ];
  const log = `<div class="audit-log"><table><caption class="visually-hidden">Audit log entries for two searches</caption><thead><tr><th scope="col"><span class="visually-hidden">Field</span></th><th scope="col">First search</th><th scope="col">Second search</th></tr></thead><tbody>${rows.map(([k, a, b]) => `<tr${k.startsWith("Cameras") ? ' class="is-key"' : ""}><th scope="row">${escape(k)}</th><td${a.startsWith("[") ? ' class="ed"' : ""}>${escape(a)}</td><td${b === "same" ? ' class="same"' : ""}>${b === "same" ? "Same" : escape(b)}</td></tr>`).join("")}</tbody></table></div>`;
  // The sheriff's and Flock's words are quotations; EFF's entry summarizes the records it obtained.
  const acc = (d.accounts ?? []).map((a, i) => {
    const quoted = i < 2;
    return `<blockquote class="acct${quoted ? "" : " is-summary"}"><p>${quoted ? `“${escape(smart(a.text))}”` : escape(smart(a.text))}</p><footer>${escape(smart(a.who))}</footer></blockquote>`;
  }).join("");
  return frame("audit", cfg, ctx, `<div class="audit">${log}<div class="accounts"><p class="accounts-k">Three accounts of the search</p>${acc}</div></div>`, { width: "wide" });
}
