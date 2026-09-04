/**
 * Fails the build if any claim-bearing entry lacks a source, references an unknown source id,
 * or if any source is missing a URL, date or lastVerified stamp. Also reports unused sources.
 */
import { readFileSync } from "node:fs";
import { SourcesFile, ComponentsFile, InstallFile, DataflowFile, MythsFile, ProductsFile } from "../src/content/schema";

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
dataflow.retentionPresets.forEach((r) => need(`retention ${r.label}`, r.sources));
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

const unused = sources.filter((s) => !used.has(s.id)).map((s) => s.id);
const dupUrls = new Map<string, string[]>();
for (const s of sources) dupUrls.set(s.url, [...(dupUrls.get(s.url) ?? []), s.id]);
for (const [u, list] of dupUrls) if (list.length > 1) problems.push(`duplicate url ${u}: ${list.join(", ")}`);

if (problems.length) {
  console.error(`check:sources FAILED (${problems.length})\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`check:sources OK: ${sources.length} sources, ${components.parts.length} parts, ${dataflow.hops.length} hops, ${myths.length} myths, ${products.length} products`);
if (unused.length) console.log(`  note: ${unused.length} sources not referenced yet: ${unused.join(", ")}`);
