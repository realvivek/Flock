import sourcesRaw from "./sources.json";
import componentsRaw from "./components.json";
import installRaw from "./install.json";
import dataflowRaw from "./dataflow.json";
import mythsRaw from "./myths.json";
import productsRaw from "./products.json";
import economicsRaw from "./economics.json";
import stillsRaw from "./stills.json";
import deploymentsRaw from "./deployments.json";
import overviewRaw from "./overview.json";
import { SourcesFile, ComponentsFile, InstallFile, DataflowFile, MythsFile, ProductsFile, EconomicsFile, StillsFile, DeploymentsFile, OverviewFile } from "./schema";

export const sources = SourcesFile.parse(sourcesRaw).sources;
export const components = ComponentsFile.parse(componentsRaw);
export const install = InstallFile.parse(installRaw);
export const dataflow = DataflowFile.parse(dataflowRaw);
export const myths = MythsFile.parse(mythsRaw).myths;
export const products = ProductsFile.parse(productsRaw).products;
export const economics = EconomicsFile.parse(economicsRaw);
export const stills = StillsFile.parse(stillsRaw);
export const deployments = DeploymentsFile.parse(deploymentsRaw);
export const overview = OverviewFile.parse(overviewRaw);
export const stillById = new Map(stills.stills.map((s) => [s.id, `${stills.dir}/${s.file}`]));

export const sourceById = new Map(sources.map((s) => [s.id, s]));
export const partById = new Map(components.parts.map((p) => [p.id, p]));
export const hopById = new Map(dataflow.hops.map((h) => [h.id, h]));

/** Explode-stage labels shared by the desktop stage control and the phone deck. Index = stage 0..5. */
export const EXPLODE_STAGES = [
  { label: "Assembled", copy: "Assembled: 8.75 in tall, about 3 lb, band-clamped to the pole." },
  { label: "Bezel and ring", copy: "Stage 1: bezel and illuminator ring." },
  { label: "Optics", copy: "Stage 2: lens, mechanical IR-cut filter and image sensor." },
  { label: "Compute", copy: "Stage 3: system on module, storage and LTE module lifted from the mainboard." },
  { label: "Radios", copy: "Stage 4: Wi-Fi and Bluetooth module, GPS patch and rear shell." },
  { label: "All parts", copy: "Stage 5: all fourteen components, front to back." },
] as const;

/** Component groups in display order, with the legend heading for each. */
export const PART_GROUPS: { id: string; label: string }[] = [
  { id: "shell", label: "Shell" }, { id: "optics", label: "Optics" }, { id: "compute", label: "Compute" }, { id: "radio", label: "Radios" }, { id: "mount", label: "Mount" },
];
