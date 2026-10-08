/** Helpers for the pages built from the site content: stills, key-value lists and fact lists with citations. The
 *  content-free helpers live in ./dom and are re-exported here. */
import { stillById } from "../content";
import { cite } from "./cite";
import { escape } from "../lib/escape";
import { el } from "./dom";
import { BASE, ROOT } from "../lib/base";
export { BASE, ROOT };
export * from "./dom";

export const still = (id: string) => `${BASE}${stillById.get(id) ?? ""}`;

export const p = (host: HTMLElement, text: string, cls = "") => { const e = el("p", cls); e.textContent = text; host.appendChild(e); return e; };
export const kv = (host: HTMLElement, rows: [string, string][]) => { const dl = el("dl", "kv"); for (const [k, v] of rows) dl.insertAdjacentHTML("beforeend", `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`); host.appendChild(dl); return dl; };
export const facts = (host: HTMLElement, rows: { k: string; v: string; sources: string[] }[]) => { const dl = el("dl", "kv"); for (const r of rows) { dl.insertAdjacentHTML("beforeend", `<dt>${escape(r.k)}</dt><dd>${escape(r.v)}</dd>`); dl.lastElementChild!.appendChild(cite(r.sources, 1)); } host.appendChild(dl); };
