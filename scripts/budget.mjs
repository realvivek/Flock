/**
 * Weight budget: loads each page from the preview server without scrolling, lists every file it requested with its
 * size as sent compressed (gzip, as GitHub Pages serves text; images, fonts and the packed camera file are already
 * compressed), and fails if a page goes over its budget.
 *
 *   npm run build && npm run preview &
 *   node scripts/budget.mjs [--base http://127.0.0.1:4173] [--verbose]
 */
import { chromium } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const args = process.argv.slice(2);
const base = (args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://127.0.0.1:4173").replace(/\/$/, "");
const verbose = args.includes("--verbose");
const DIST = path.resolve(import.meta.dirname, "../dist");
const KB = 1024;
/** Budgets in compressed bytes, before the reader scrolls, set a little above what each page weighed on Oct. 8, 2026,
 *  so a regression fails the run. The home page and Outcomes include the national map's camera file (278 KB); the
 *  reference pages share the content bundle (66 KB). The components page on a desktop loads its 3D engine and models
 *  by design, so it is reported there but held to its budget only on phones, which get stills. */
const BUDGET = { home: [600, 30], outcomes: [650, 100], components: [450, 100], other: [300, 100] };
const PAGES = { home: "/", deployments: "/deployments/", components: "/components/", data: "/data/", journey: "/journey/", outcomes: "/outcomes/", claims: "/claims/", economics: "/economics/", sources: "/sources/" };
const PRECOMPRESSED = /\.(bin|jpe?g|png|webp|avif|woff2?|glb)$/i;

const sent = new Map();
function sizeOf(url) {
  if (sent.has(url)) return sent.get(url);
  const rel = decodeURIComponent(new URL(url).pathname).replace(/^\/(Flock\/)?/, "");
  let file = path.join(DIST, rel);
  if (rel === "" || rel.endsWith("/")) file = path.join(file, "index.html");
  if (!existsSync(file)) return null;
  const raw = readFileSync(file);
  const n = PRECOMPRESSED.test(file) ? raw.length : gzipSync(raw, { level: 9 }).length;
  sent.set(url, n);
  return n;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
let failed = 0;
for (const [w, h, phone] of [[1440, 900, false], [390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone });
  for (const [id, p] of Object.entries(PAGES)) {
    const page = await ctx.newPage();
    const urls = new Set();
    page.on("request", (r) => { if (r.url().startsWith(base)) urls.add(r.url().split("#")[0]); });
    await page.goto(base + p, { waitUntil: "commit" });
    await page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 90_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    const rows = [...urls].map((u) => ({ u, n: sizeOf(u) })).filter((r) => r.n != null);
    const total = rows.reduce((a, r) => a + r.n, 0);
    const js = rows.filter((r) => /\.js$/.test(r.u)).reduce((a, r) => a + r.n, 0);
    const [limit, jsLimit] = (BUDGET[id] ?? BUDGET.other).map((v) => v * KB);
    const exempt = id === "components" && !phone;
    const over = !exempt && (total > limit || js > jsLimit);
    if (over) failed++;
    console.log(`${over ? "OVER" : exempt ? "3D  " : "ok  "} ${String(w).padStart(4)} ${id.padEnd(12)} ${(total / KB).toFixed(0).padStart(5)} KB in ${String(rows.length).padStart(3)} files (JS ${(js / KB).toFixed(0)} KB)  budget ${exempt ? "not applied: the 3D locator" : `${(limit / KB).toFixed(0)} KB, JS ${(jsLimit / KB).toFixed(0)} KB`}`);
    if (verbose) for (const r of rows.sort((a, b) => b.n - a.n).slice(0, 12)) console.log(`       ${(r.n / KB).toFixed(1).padStart(7)} KB  ${r.u.replace(base, "")}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
