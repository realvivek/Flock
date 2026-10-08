/** Shapes of the built data the story is rendered from (public/data/story/*.json and the site content). */
export interface Stat<T = unknown> { value: T; sources: string[]; note?: string }
export type Stats = Record<string, Stat>;
export interface StateRow { fips: string; usps: string; name: string; flock: number; all: number; pop: number | null; per100k: number | null }
export interface StatesFile { usRate: number; usFlock: number; usPop: number; rows: StateRow[] }
/** [fips, county name, state, Flock cameras, all readers, population, Flock per 100,000] */
export type CountyRow = [string, string, string, number, number, number | null, number | null];
export interface Operators { total: number; flock: number; branded: number; shareAll: number; shareBranded: number; brands: { brand: string; count: number }[]; flockWithOperator: number; flockWithoutOperator: number; classes: { id: string; label: string; count: number }[]; topNamed: { name: string; count: number; cls: string }[] }
export interface CompletenessRow { place: string; usps: string; published: number; when: string; what: string; sources: string[]; mapped: number; police: number; other: number; untagged: number; topOther: { name: string; count: number } | null }
export interface SourceRec { id: string; kind: string; title: string; publisher: string; url: string; date: string; lastVerified: string }
export interface Ladder { id: string; agency: string; city: string; state: string; period: string; cameras: string; vendorMix?: boolean; vendor?: string; mixedWindows?: boolean; values: Record<"reads" | "alerts" | "falseAlerts" | "stops" | "recoveries" | "arrests", number | null>; note: string; sources: string[] }
export interface Meta { snapshot: string; built: string; frame: [number, number]; cameras: { total: number; flock: number; onMap: number; offMap: number } }
export interface Overview { sections: { id: string; label: string; title: string; blurb: string }[] }
export interface TimelineEvent { date: string; precision: "day" | "month"; kind: "added" | "ended" | "restricted" | "flock"; where: string; text: string; sources: string[] }

export interface StoryInput {
  story: import("./schema.ts").Story;
  stats: Stats;
  meta: Meta;
  states: StatesFile;
  counties: CountyRow[];
  operators: Operators;
  completeness: CompletenessRow[];
  ladders: Ladder[];
  sources: SourceRec[];
  overview: Overview;
  timeline: TimelineEvent[];
  /** path from the home page to the site root: "./" */
  root: string;
}
