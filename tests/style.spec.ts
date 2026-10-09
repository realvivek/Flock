import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Times style across the visible text of every page, including text drawn in the browser, figure labels, the title,
 * share tags and tooltips: typographic quotes, AP dates, "percent" in prose, the Times's state abbreviations, American
 * spelling, numerals for 10 and up. Exceptions, each with a reason, are in tests/style-allow.json. STYLE_REPORT=1 lists
 * the findings without failing.
 */
const PAGES = ["", "deployments", "components", "data", "journey", "outcomes", "claims", "economics", "sources"];
const allow = JSON.parse(readFileSync(new URL("./style-allow.json", import.meta.url), "utf8")) as { rule: string; text: string; why: string }[];
const STATES = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY";
const RULES: { rule: string; re: RegExp; prose?: boolean }[] = [
  { rule: "straight quote", re: /["']/ },
  { rule: "single quotes around a quotation", re: /(^|[\s(\[“])‘/ },
  { rule: "ISO date", re: /\b\d{4}-\d{2}-\d{2}\b/ },
  { rule: "% in prose", re: /\d\s?%/, prose: true },
  { rule: "postal code after a place", re: new RegExp(`[a-z], (${STATES})\\b(?!-)`) },
  { rule: "British spelling", re: /\b(summaris|authoris|organis|recognis|realis|colour|behaviour|centre|offence|travell|cancell(?!ation)|labell|programme|licence|totall(?:ed|ing))\w*/i },
  { rule: "number 10 or more in words", re: /(?<![.!?:]\s|^)\b(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/ },
  { rule: "US or Inc without points", re: /\bUS\b|\bInc\b(?!\.)/ },
  { rule: "Times abbreviation (A.C.L.U., F.B.I., A.I.)", re: /\b(ACLU|FBI)\b|\bAI\b/ },
];

async function textOf(page: Page): Promise<{ text: string; where: string; prose: boolean }[]> {
  return page.evaluate(() => {
    const out: { text: string; where: string; prose: boolean }[] = [];
    // document titles are quoted as their publishers wrote them (the Sources list and citation tooltips)
    const skip = "script, style, code, kbd, .pn, .source .id, .src-link .t, input, textarea, noscript, [data-style-skip]";
    // prose: not a chart label, table cell or tile number, where "%" and symbols are the house style
    const notProse = "svg, table, .rates, .err-n, .fig-body, .tiles, .lk-card, .map-legend, .vi-key, .mono, .kv";
    const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement!;
      if (el.closest(skip)) continue;
      const t = n.textContent!.replace(/\s+/g, " ").trim();
      if (t) out.push({ text: t, where: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}`, prose: !el.closest(notProse) });
    }
    for (const el of document.querySelectorAll<HTMLElement>("main [title], main [aria-label], main img[alt]")) {
      if (el.closest(skip) || el.hasAttribute("data-src")) continue;
      for (const a of ["title", "aria-label", "alt"]) { const v = el.getAttribute(a); if (v) out.push({ text: v, where: `@${a}`, prose: !el.closest("svg") }); }
    }
    out.push({ text: document.title, where: "<title>", prose: true });
    for (const m of document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"]')) out.push({ text: m.getAttribute("content") ?? "", where: "<meta>", prose: true });
    return out;
  });
}

test("every page follows Times style", async ({ page }) => {
  const found: string[] = [];
  for (const id of PAGES) {
    await page.goto(`/${id ? `${id}/` : ""}`, { waitUntil: "commit" });
    await page.waitForFunction(() => (window as unknown as { __flock?: { state: { ready: boolean } } }).__flock?.state.ready === true, null, { timeout: 90_000 });
    // scroll the page through so that anything drawn on approach (maps and their captions) is in the text
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 700) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(60); }
    await page.waitForTimeout(800);
    for (const t of await textOf(page)) {
      for (const r of RULES) {
        if (r.prose && !t.prose) continue;
        const m = t.text.match(r.re);
        if (!m) continue;
        if (allow.some((a) => a.rule === r.rule && t.text.includes(a.text))) continue;
        const i = m.index ?? 0;
        found.push(`${id || "home"} ${t.where} [${r.rule}] …${t.text.slice(Math.max(0, i - 40), i + 50)}…`);
      }
    }
  }
  const unique = [...new Set(found)];
  if (unique.length) console.log(`style: ${unique.length} findings\n` + unique.join("\n"));
  if (process.env.STYLE_REPORT !== "1") expect(unique).toEqual([]);
});
