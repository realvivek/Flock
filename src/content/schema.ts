import { z } from "zod";

const ids = z.array(z.string().min(1)).min(1);

export const SourceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["flock", "independent", "government", "court"]),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  date: z.string().min(4),
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const SourcesFile = z.object({ sources: z.array(SourceSchema) }).passthrough();

const Fact = z.object({ k: z.string(), v: z.string(), sources: ids });

export const PartSchema = z.object({
  id: z.string(), node: z.string(), order: z.number().int(), group: z.enum(["shell", "optics", "compute", "radio", "power", "mount"]),
  name: z.string(), partNumber: z.string().optional(), vendor: z.string().optional(),
  function: z.string(), spec: z.record(z.string(), z.string()),
  dims: z.record(z.string(), z.number()), explode: z.tuple([z.number(), z.number(), z.number()]),
  hop: z.string().optional(), confidence: z.enum(["measured", "estimated", "disputed"]), sources: ids,
});
export const ComponentsFile = z.object({
  envelope: z.object({ heightIn: z.number(), widthIn: z.number(), depthIn: z.number(), weightLb: z.number(), sources: ids }),
  parts: z.array(PartSchema),
}).passthrough();

export const InstallFile = z.object({
  pole: z.object({ heightFt: z.number(), odIn: z.number(), idIn: z.number(), alloy: z.string(), weightLb: z.number(), cameraHeightFt: z.number(), sources: ids }),
  solar: z.object({ voltage: z.string(), lengthIn: z.number(), widthIn: z.number(), weightLb: z.number(), mount: z.string(), sources: ids }),
  battery: z.object({ chemistry: z.string(), voltage: z.string(), capacity: z.string(), vendor: z.string(), placement: z.string(), sources: ids }),
  coverage: z.object({ widthFt: z.number(), distFt: z.number(), maxFt: z.number(), lanes: z.number(), mph: z.number(), framesPerVehicle: z.string(), aims: z.string(), sources: ids }),
  modes: z.record(z.string(), z.object({ label: z.string(), facts: z.array(Fact) })),
  pins: z.array(z.object({ id: z.string(), anchor: z.tuple([z.number(), z.number(), z.number()]), k: z.string(), v: z.string(), modes: z.array(z.string()), dx: z.number().optional(), dy: z.number().optional(), sources: ids })),
  paths: z.record(z.string(), z.object({ label: z.string(), summary: z.string(), facts: z.array(Fact) })),
}).passthrough();

export const HopSchema = z.object({
  id: z.string(), n: z.number().int(), title: z.string(), where: z.string(), tag: z.enum(["flock", "independent", "both", "unknown"]),
  summary: z.string(), payload: z.array(z.string()), transport: z.string().optional(), storage: z.string().optional(), retention: z.string().optional(),
  unknowns: z.array(z.string()).optional(), sources: ids,
});
export const DataflowFile = z.object({
  hops: z.array(HopSchema),
  retentionPresets: z.array(z.object({ label: z.string(), days: z.number(), note: z.string(), sources: ids })),
  deputy: z.object({ networks: z.number(), cameras: z.number(), lookbackDays: z.number(), date: z.string(), reasonAsLogged: z.string(), note: z.string(), sources: ids }),
}).passthrough();

export const MythsFile = z.object({
  myths: z.array(z.object({ id: z.string(), claim: z.string(), verdict: z.enum(["false", "true", "nuanced"]), nuance: z.string(), part: z.string().optional(), hop: z.string().optional(), sources: ids })),
}).passthrough();

export const ProductsFile = z.object({
  products: z.array(z.object({ id: z.string(), name: z.string(), type: z.string(), captures: z.string(), not: z.string(), note: z.string().optional(), sources: ids })),
}).passthrough();

const Row = z.object({ k: z.string(), v: z.string(), sources: ids });
export const EconomicsFile = z.object({
  intro: z.object({ headline: z.string(), summary: z.string(), sources: ids }),
  priceList: z.array(z.object({ item: z.string(), sku: z.string(), price: z.string(), term: z.string(), sources: ids })),
  included: z.array(Row),
  extra: z.array(Row),
  fees: z.array(z.object({ item: z.string(), then: z.string(), now: z.string(), sources: ids })),
  history: z.array(z.object({ date: z.string(), price: z.string(), note: z.string(), sources: ids })),
  workflow: z.array(z.object({ step: z.string(), flock: z.string(), customer: z.string(), other: z.string(), sources: ids })),
  workforce: z.array(Row),
  permitting: z.array(z.object({ scenario: z.string(), permit: z.string(), who: z.string(), note: z.string(), sources: ids })),
  contract: z.array(Row),
  scale: z.array(Row),
  unknowns: z.array(z.object({ v: z.string(), sources: ids })),
  pricedPole: z.array(z.object({ id: z.string(), anchor: z.tuple([z.number(), z.number(), z.number()]), k: z.string(), v: z.string(), dx: z.number(), dy: z.number(), sources: ids })),
}).passthrough();
export const StillsFile = z.object({
  dir: z.string(),
  stills: z.array(z.object({ id: z.string(), file: z.string(), job: z.string(), args: z.record(z.string(), z.union([z.string(), z.number()])).optional() })),
}).passthrough();

export type Source = z.infer<typeof SourceSchema>;
export type Part = z.infer<typeof PartSchema>;
export type Hop = z.infer<typeof HopSchema>;
