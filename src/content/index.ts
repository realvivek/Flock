import sourcesRaw from "./sources.json";
import componentsRaw from "./components.json";
import installRaw from "./install.json";
import dataflowRaw from "./dataflow.json";
import mythsRaw from "./myths.json";
import productsRaw from "./products.json";
import economicsRaw from "./economics.json";
import stillsRaw from "./stills.json";
import deploymentsRaw from "./deployments.json";
import { SourcesFile, ComponentsFile, InstallFile, DataflowFile, MythsFile, ProductsFile, EconomicsFile, StillsFile, DeploymentsFile } from "./schema";

export const sources = SourcesFile.parse(sourcesRaw).sources;
export const components = ComponentsFile.parse(componentsRaw);
export const install = InstallFile.parse(installRaw);
export const dataflow = DataflowFile.parse(dataflowRaw);
export const myths = MythsFile.parse(mythsRaw).myths;
export const products = ProductsFile.parse(productsRaw).products;
export const economics = EconomicsFile.parse(economicsRaw);
export const stills = StillsFile.parse(stillsRaw);
export const deployments = DeploymentsFile.parse(deploymentsRaw);
export const stillById = new Map(stills.stills.map((s) => [s.id, `${stills.dir}/${s.file}`]));

export const sourceById = new Map(sources.map((s) => [s.id, s]));
export const partById = new Map(components.parts.map((p) => [p.id, p]));
export const hopById = new Map(dataflow.hops.map((h) => [h.id, h]));
