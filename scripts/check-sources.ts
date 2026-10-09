/**
 * Fails the build if any claim-bearing entry lacks a source, references an unknown source id,
 * or if any source is missing a URL, date or lastVerified stamp. Also reports unused sources.
 */
import { readFileSync } from "node:fs";
import { existsSync, readdirSync, statSync } from "node:fs";
import { renderHome, renderPage } from "./story/input.ts";
import { SourcesFile, ComponentsFile, InstallFile, DataflowFile, MythsFile, ProductsFile, EconomicsFile, StillsFile, DeploymentsFile } from "../src/content/schema";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../src/content/${f}`, import.meta.url), "utf8"));

const sources = SourcesFile.parse(read("sources.json")).sources;
const ids = new Set(sources.map((s) => s.id));
const used = new Set<string>();
const problems: string[] = [];

function need(label: string, list: string[] | undefined) {
  if (!list || list.length === 0) { problems.push(`${label}: no sources`); return; }
  for (const id of list) { if (!ids.has(id)) problems.push(`${label}: unknown source '${id}'`); used.add(id); }
}

const components = ComponentsFile.parse(read("components.json"));
need("components.envelope", components.envelope.sources);
for (const p of components.parts) need(`part ${p.id}`, p.sources);

const install = InstallFile.parse(read("install.json"));
for (const k of ["pole", "solar", "battery", "coverage"] as const) need(`install.${k}`, install[k].sources);
for (const [m, mode] of Object.entries(install.modes)) mode.facts.forEach((f, i) => need(`install.modes.${m}[${i}]`, f.sources));
for (const pin of install.pins) need(`pin ${pin.id}`, pin.sources);
for (const [m, path] of Object.entries(install.paths)) path.facts.forEach((f, i) => need(`install.paths.${m}[${i}]`, f.sources));

const dataflow = DataflowFile.parse(read("dataflow.json"));
for (const h of dataflow.hops) need(`hop ${h.id}`, h.sources);
need("deputy", dataflow.deputy.sources);

const myths = MythsFile.parse(read("myths.json")).myths;
for (const m of myths) need(`myth ${m.id}`, m.sources);
const partIds = new Set(components.parts.map((p) => p.id));
const hopIds = new Set(dataflow.hops.map((h) => h.id));
for (const m of myths) {
  if (m.part && !partIds.has(m.part)) problems.push(`myth ${m.id}: unknown part '${m.part}'`);
  if (m.hop && !hopIds.has(m.hop)) problems.push(`myth ${m.id}: unknown hop '${m.hop}'`);
}
for (const p of components.parts) if (p.hop && !hopIds.has(p.hop)) problems.push(`part ${p.id}: unknown hop '${p.hop}'`);

const products = ProductsFile.parse(read("products.json")).products;
for (const p of products) need(`product ${p.id}`, p.sources);

const dep = DeploymentsFile.parse(read("deployments.json"));
need("deployments.intro", dep.intro.sources);
for (const key of ["records", "contracts", "funding", "unknowns"] as const) {
  (dep[key] as { sources: string[] }[]).forEach((row, i) => need(`deployments.${key}[${i}]`, row.sources));
}

const econ = EconomicsFile.parse(read("economics.json"));
need("economics.intro", econ.intro.sources);
for (const key of ["priceList", "included", "extra", "fees", "history", "workflow", "workforce", "permitting", "contract", "scale", "unknowns", "pricedPole"] as const) {
  (econ[key] as { sources: string[] }[]).forEach((row, i) => need(`economics.${key}[${i}]`, row.sources));
}

// Figures computed by scripts/story/build.mjs: every number the story quotes carries the sources behind it.
const pub = (f: string) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
for (const [k, v] of Object.entries(pub("story/stats.json") as Record<string, { sources?: string[] }>)) need(`stats.${k}`, v.sources);
need("story meta", pub("story/meta.json").sources);
for (const row of pub("story/completeness.json") as { place: string; sources: string[] }[]) need(`completeness ${row.place}`, row.sources);
// The Outcomes page's built file: every `sources` list anywhere in it.
(function walk(v: unknown, at: string): void {
  if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`)); return; }
  if (!v || typeof v !== "object") return;
  for (const [k, x] of Object.entries(v)) {
    if (k === "sources" && Array.isArray(x) && x.every((s) => typeof s === "string")) need(`outcomes${at}`, x as string[]);
    else walk(x, `${at}.${k}`);
  }
})(pub("outcomes.json"), "");

// The home page story and the head of every reference page: rendering them resolves every {{stat}} and (src:id) and
// throws on an unknown one.
const root = new URL("..", import.meta.url).pathname;
const story = renderHome(root);
for (const id of story.used) used.add(id);
for (const page of ["deployments", "components", "data", "journey", "outcomes", "claims", "economics", "sources"]) for (const id of renderPage(root, page).used) used.add(id);
// Text stays descriptive: no loaded adjectives, nothing on getting around or defeating the cameras. Crime names in
// records ("Evading an accident") are not instructions, so the check reads the site's own prose files.
const prose = ["story.json", "timeline-2026.json", "pages.json", "dataflow.json", "journey.json", "myths.json", "deployments.json", "economics.json", "components.json", "install.json", "products.json", "overview.json"].map((f) => readFileSync(new URL(`../src/content/${f}`, import.meta.url), "utf8")).join("\n");
const BANNED = /\b(shocking|alarming|dystopian|orwellian|chilling|egregious|outrageous|creepy|sinister|draconian|evade|evading|spoof|spoofing|jamming|defeat the|trick the|avoid(?:ing)? (?:the |a )?(?:camera|reader)s?|get(?:ting)? around (?:the )?(?:camera|reader)s?)\b/gi;
for (const m of prose.matchAll(BANNED)) problems.push(`content: avoid the words "${m[0]}"`);

const stills = StillsFile.parse(read("stills.json"));
const missingStills = stills.stills.filter((st) => !existsSync(new URL(`../public/${stills.dir}/${st.file}`, import.meta.url)));
if (missingStills.length && !process.env.ALLOW_MISSING_STILLS) problems.push(`stills not rendered: ${missingStills.map((s) => s.id).join(", ")} (run npm run stills, or set ALLOW_MISSING_STILLS=1)`);

// Ids cited directly by the page scripts (a fixed citation in a renderer) count as used too.
const tsFiles = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = `${dir}/${f}`; return statSync(p).isDirectory() ? tsFiles(p) : /\.ts$/.test(f) ? [p] : []; });
const code = tsFiles(new URL("../src", import.meta.url).pathname).map((f) => readFileSync(f, "utf8")).join("\n");
for (const s of sources) if (code.includes(`"${s.id}"`)) used.add(s.id);
const unused = sources.filter((s) => !used.has(s.id)).map((s) => s.id);
const dupUrls = new Map<string, string[]>();
for (const s of sources) dupUrls.set(s.url, [...(dupUrls.get(s.url) ?? []), s.id]);
for (const [u, list] of dupUrls) if (list.length > 1) problems.push(`duplicate url ${u}: ${list.join(", ")}`);

// The Sources page lists "every document cited on this site", so the bibliography holds nothing uncited.
if (unused.length) problems.push(`sources cited nowhere: ${unused.join(", ")}`);
if (problems.length) {
  console.error(`check:sources FAILED (${problems.length})\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`check:sources OK: ${sources.length} sources, ${components.parts.length} parts, ${dataflow.hops.length} hops, ${myths.length} myths, ${products.length} products, ${econ.priceList.length + econ.fees.length + econ.workflow.length + econ.permitting.length} economics rows, ${stills.stills.length} stills`);

