/**
 * Hash router shared by the desktop tabs and the phone tab bar.
 *
 * Grammar: #/<tab>[/<sub>][/<index>|/<anchor>]
 *   #/overview  #/deployments  #/hardware/pole|inside|power  #/data  #/claims  #/economics  #/sources
 *   #/pole, #/inside, #/power           aliases for #/hardware/<sub> (what phones write)
 *   #/hardware/inside/13, #/data/10     numeric index: phone deck screen; on desktop the explode stage or data stage
 *   #/sources/src-<id>, #/claims/claim-<id>   an anchor inside an article tab
 * Legacy: #act-0..7, #deployments, #src-<id>, #claim-<id>, #s=<chapter>/<i>, ?s=<chapter>/<i>
 */
export type Tab = "overview" | "deployments" | "hardware" | "data" | "claims" | "economics" | "sources";
export type Sub = "pole" | "inside" | "power";
export interface Route { tab: Tab; sub?: Sub; index?: number; anchor?: string }

export const TABS: Tab[] = ["overview", "deployments", "hardware", "data", "claims", "economics", "sources"];
const SUBS: Sub[] = ["pole", "inside", "power"];

/** Phone chapter id (or section id from overview.json) for a route, and back. */
export function chapterFor(r: Route): string {
  if (r.tab === "hardware") return r.sub ?? "pole";
  return r.tab;
}
export function routeForChapter(ch: string, index?: number): Route {
  if (ch === "street" || ch === "overview") return { tab: "overview" };
  if (SUBS.includes(ch as Sub)) return { tab: "hardware", sub: ch as Sub, index };
  if (ch === "myths") return { tab: "claims", index };
  if (TABS.includes(ch as Tab)) return { tab: ch as Tab, index };
  return { tab: "overview" };
}

const LEGACY_ACT: Route[] = [
  { tab: "overview" }, { tab: "hardware", sub: "pole" }, { tab: "hardware", sub: "inside" }, { tab: "hardware", sub: "power" },
  { tab: "data" }, { tab: "claims" }, { tab: "economics" }, { tab: "sources" },
];

export function parseRoute(hash = location.hash, search = location.search): Route {
  const h = hash.replace(/^#/, "");
  // legacy forms
  const act = /^act-(\d)$/.exec(h);
  if (act) return LEGACY_ACT[Number(act[1])] ?? { tab: "overview" };
  if (h === "deployments") return { tab: "deployments" };
  if (h === "" || h === "top") {
    const q = new URLSearchParams(search).get("s");
    const mm = q ? /^([a-z]+)\/(\d+)$/.exec(q) : null;
    if (mm) return routeForChapter(mm[1]!, Number(mm[2]));
    return { tab: "overview" };
  }
  if (h.startsWith("src-")) return { tab: "sources", anchor: h };
  if (h.startsWith("claim-")) return { tab: "claims", anchor: h };
  const legacyS = /^s=([a-z]+)\/(\d+)$/.exec(h);
  if (legacyS) return routeForChapter(legacyS[1]!, Number(legacyS[2]));
  if (!h.startsWith("/")) return { tab: "overview" };
  const parts = h.slice(1).split("/").filter(Boolean);
  const head = parts[0] ?? "overview";
  let r: Route;
  let rest: string[];
  if (head === "hardware") { r = { tab: "hardware", sub: SUBS.includes(parts[1] as Sub) ? (parts[1] as Sub) : "pole" }; rest = parts.slice(2); }
  else if (SUBS.includes(head as Sub)) { r = { tab: "hardware", sub: head as Sub }; rest = parts.slice(1); }
  else if (head === "myths") { r = { tab: "claims" }; rest = parts.slice(1); }
  else if (TABS.includes(head as Tab)) { r = { tab: head as Tab }; rest = parts.slice(1); }
  else return { tab: "overview" };
  const tail = rest[0];
  if (tail !== undefined) { if (/^\d+$/.test(tail)) r.index = Number(tail); else r.anchor = tail; }
  return r;
}

export function hashFor(r: Route, phone = false): string {
  let base: string;
  if (r.tab === "hardware") base = phone ? `#/${r.sub ?? "pole"}` : `#/hardware/${r.sub ?? "pole"}`;
  else base = `#/${r.tab}`;
  if (r.index !== undefined) return `${base}/${r.index}`;
  if (r.anchor) return `${base}/${r.anchor}`;
  return base;
}

export function sameView(a: Route, b: Route): boolean {
  return a.tab === b.tab && (a.tab !== "hardware" || (a.sub ?? "pole") === (b.sub ?? "pole"));
}

let applyFn: ((r: Route, source: "init" | "hash" | "navigate") => void) | null = null;
let phoneHashes = false;

/** Install the router: applies the current route once, then on every hash change (Back and Forward included). */
export function wireRouter(apply: (r: Route, source: "init" | "hash" | "navigate") => void, opts: { phone?: boolean } = {}): void {
  applyFn = apply;
  phoneHashes = !!opts.phone;
  addEventListener("hashchange", () => applyFn?.(parseRoute(), "hash"));
  apply(parseRoute(), "init");
}

/** Change route. Tab changes push a history entry; `replace` rewrites the current one (deck steps, canonicalising). */
export function navigate(r: Route, replace = false): void {
  const h = hashFor(r, phoneHashes);
  if (location.hash === h) { applyFn?.(r, "navigate"); return; }
  if (replace) history.replaceState(null, "", h);
  else history.pushState(null, "", h);
  applyFn?.(r, "navigate");
}
