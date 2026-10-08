import { chromium } from "@playwright/test";
import fs from "node:fs";
// Renders the home page's preview image of the components grid from the live page: six whole parts in a 4:3 grid,
// without labels, at a size that reads at any width (the caption under the image names the page).
// Usage: node scripts/knolling.mjs [url] [out]   (default http://127.0.0.1:4173/components/, public/img/knolling.jpg)
const argv = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const url = argv[0] || "http://127.0.0.1:4173/components/";
const out = argv[1] || "public/img/knolling.jpg";
/** one or two parts from each group, chosen for how they read as small renders (the lens, seen end on, does not) */
const PARTS = ["bezel", "ledboard", "ircut", "sensor", "som", "gps"];
fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-compositing"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 2 });
// "commit" rather than "load": third-party font requests can hang behind a proxy and hold the load event.
await page.goto(`${url}?mode=stills`, { waitUntil: "commit", timeout: 60000 });
await page.waitForSelector("#knolling .cell img", { timeout: 30000 });
await page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 30000 });
await page.addStyleTag({ content: "#knolling { width: 560px; height: 420px; overflow: hidden; padding: 8px; background: #fff; display: grid !important; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); gap: 8px; box-sizing: border-box; } #knolling .group, #knolling .cells { display: contents !important; } #knolling .group-head, #knolling .cell .txt { display: none !important; } #knolling .cell { display: block; min-height: 0; height: 198px; padding: 0; } #knolling .cell img { display: block; height: 198px; width: 100%; object-fit: contain; padding: 16px; box-sizing: border-box; }" });
await page.evaluate((keep) => {
  const cells = [...document.querySelectorAll("#knolling .cell")];
  cells.forEach((c) => { if (!keep.includes(c.dataset.part)) c.remove(); });
  // in the chosen order
  const host = document.querySelector("#knolling");
  for (const id of keep) { const c = cells.find((x) => x.dataset.part === id); if (c) host.appendChild(c); }
}, PARTS);
await page.evaluate(() => document.getElementById("knolling").scrollIntoView());
// Cells lazy-load their stills: bring every cell into view once, then wait for all of them to have decoded.
await page.evaluate(async () => { for (const c of document.querySelectorAll("#knolling .cell")) { c.scrollIntoView(); await new Promise((r) => setTimeout(r, 30)); } document.getElementById("knolling").scrollIntoView(); });
await page.waitForFunction(() => [...document.querySelectorAll("#knolling img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 });
await page.waitForTimeout(400);
await page.locator("#knolling").screenshot({ path: out, type: "jpeg", quality: 86 });
console.log("wrote", out);
await browser.close();
