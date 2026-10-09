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
import journeyRaw from "./journey.json";
import { SourcesFile, ComponentsFile, InstallFile, DataflowFile, MythsFile, ProductsFile, EconomicsFile, StillsFile, DeploymentsFile, OverviewFile, JourneyFile } from "./schema";
import { typeset } from "../viz/format";

// Text from the content files is set with typographic quotes and apostrophes as it loads (identifiers, links and part
// numbers stay as written).
export const sources = typeset(SourcesFile.parse(sourcesRaw).sources);
export const components = typeset(ComponentsFile.parse(componentsRaw));
export const install = typeset(InstallFile.parse(installRaw));
export const dataflow = typeset(DataflowFile.parse(dataflowRaw));
export const myths = typeset(MythsFile.parse(mythsRaw).myths);
export const products = typeset(ProductsFile.parse(productsRaw).products);
export const economics = typeset(EconomicsFile.parse(economicsRaw));
export const stills = StillsFile.parse(stillsRaw);
export const deployments = typeset(DeploymentsFile.parse(deploymentsRaw));
export const overview = typeset(OverviewFile.parse(overviewRaw));
export const journey = typeset(JourneyFile.parse(journeyRaw));
export const stillById = new Map(stills.stills.map((s) => [s.id, `${stills.dir}/${s.file}`]));

export const sourceById = new Map(sources.map((s) => [s.id, s]));
export const partById = new Map(components.parts.map((p) => [p.id, p]));
export const hopById = new Map(dataflow.hops.map((h) => [h.id, h]));

/** Explode-stage labels shared by the desktop stage control and the phone deck. Index = stage 0..5. */
export const EXPLODE_STAGES = [
  { label: "Assembled", copy: "8.75 in tall, about 3 lb, band-clamped to the pole." },
  { label: "Bezel and ring", copy: "The bezel and the illuminator ring move forward." },
  { label: "Optics", copy: "Lens, mechanical IR-cut filter and image sensor." },
  { label: "Compute", copy: "System on module, storage and LTE module lifted from the mainboard." },
  { label: "Radios", copy: "Wi-Fi and Bluetooth module, GPS patch and rear shell." },
  { label: "All parts", copy: "All 14 components, front to back." },
] as const;

/** Component groups in display order, with the legend heading for each. */
export const PART_GROUPS: { id: string; label: string }[] = [
  { id: "shell", label: "Shell" }, { id: "optics", label: "Optics" }, { id: "compute", label: "Compute" }, { id: "radio", label: "Radios" }, { id: "mount", label: "Mount" },
];
