/** Number and date formats in the house style (AP): commas in thousands, months abbreviated with a point, "percent"
 *  spelled out in prose. Pure functions; used at build time and in the browser. */

export const int = (n: number): string => Math.round(n).toLocaleString("en-US");

/** One decimal, trailing ".0" dropped: 33.9, 82.7, 39. */
export const dec1 = (n: number): string => { const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? int(r) : r.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };

/** Large counts in words for headlines and labels: 638.7 million, 1.1 million, 83,345. */
export function big(n: number, digits = 1): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${trim((n / 1e9).toFixed(digits))} billion`;
  if (a >= 1e6) return `${trim((n / 1e6).toFixed(digits))} million`;
  return int(n);
}
const trim = (s: string) => s.replace(/\.0$/, "");
/** Axis ticks in words, as the house style writes them: 1, 1,000, 1 million, 1 billion. */
export function tickWords(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${trim((n / 1e9).toFixed(1))} billion`;
  if (a >= 1e6) return `${trim((n / 1e6).toFixed(1))} million`;
  return int(n);
}

/** Whole numbers one to nine spelled out, as AP style asks in prose. */
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
export const ap = (n: number): string => (Number.isInteger(n) && n >= 0 && n < 10 ? WORDS[n]! : int(n));

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** AP dates: "2026-10-08" → "Oct. 8, 2026"; a month with no day is spelled out, "2026-10" → "October 2026"; with
 *  `year: false` the year is dropped ("Oct. 8", "October"). */
export function apDate(iso: string, opts: { year?: boolean } = {}): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!m) return String(y);
  if (!d) return opts.year === false ? MONTH_NAMES[m - 1]! : `${MONTH_NAMES[m - 1]} ${y}`;
  const month = MONTHS[m - 1]!;
  return opts.year === false ? `${month} ${d}` : `${month} ${d}, ${y}`;
}

/** Typographic apostrophes and quotes for text that comes from data files. */
export const smart = (s: string): string => s.replace(/(\w)'(\w)/g, "$1’$2").replace(/'(\d0s)/g, "’$1").replace(/(^|[\s(])"/g, "$1“").replace(/"/g, "”").replace(/(^|[\s(])'/g, "$1‘").replace(/'/g, "’");

/** State names to the AP abbreviations used in datelines and labels ("Ga.", "Calif."); D.C. and short names stay. */
const AP_STATE: Record<string, string> = { AL: "Ala.", AZ: "Ariz.", AR: "Ark.", CA: "Calif.", CO: "Colo.", CT: "Conn.", DE: "Del.", DC: "D.C.", FL: "Fla.", GA: "Ga.", IL: "Ill.", IN: "Ind.", KS: "Kan.", KY: "Ky.", LA: "La.", MD: "Md.", MA: "Mass.", MI: "Mich.", MN: "Minn.", MS: "Miss.", MO: "Mo.", MT: "Mont.", NE: "Neb.", NV: "Nev.", NH: "N.H.", NJ: "N.J.", NM: "N.M.", NY: "N.Y.", NC: "N.C.", ND: "N.D.", OK: "Okla.", OR: "Ore.", PA: "Pa.", RI: "R.I.", SC: "S.C.", SD: "S.D.", TN: "Tenn.", VT: "Vt.", VA: "Va.", WA: "Wash.", WV: "W.Va.", WI: "Wis.", WY: "Wyo.", AK: "Alaska", HI: "Hawaii", ID: "Idaho", IA: "Iowa", ME: "Maine", OH: "Ohio", TX: "Texas", UT: "Utah", PR: "P.R." };
export const apState = (usps: string): string => AP_STATE[usps] ?? usps;
