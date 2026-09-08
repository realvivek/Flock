import { chromium } from "@playwright/test";
import fs from "node:fs";
// Renders the hero's preview image of the components grid from the live page.
// Usage: node scripts/knolling.mjs [url] [out]   (default http://127.0.0.1:4173/components/, public/img/knolling.jpg)
const url = process.argv[2] || "http://127.0.0.1:4173/components/";
const out = process.argv[3] || "public/img/knolling.jpg";
fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-compositing"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 1.5 });
// "commit" rather than "load": third-party font requests can hang behind a proxy and hold the load event.
await page.goto(`${url}?mode=stills`, { waitUntil: "commit", timeout: 60000 });
await page.waitForSelector("#knolling .cell img", { timeout: 30000 });
await page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 30000 });
await page.addStyleTag({ content: "#knolling { width: 1120px; padding: 10px; background: #fff; display: grid !important; grid-template-columns: repeat(7, 1fr); gap: 8px; } #knolling .group, #knolling .cells { display: contents !important; } #knolling .group-head { display: none !important; } #knolling .cell { min-height: 0; } #knolling .cell img { height: 6.5rem; } #knolling .cell .pn { display: none; }" });
await page.evaluate(() => document.getElementById("knolling").scrollIntoView());
// Cells lazy-load their stills: bring every cell into view once, then wait for all of them to have decoded.
await page.evaluate(async () => { for (const c of document.querySelectorAll("#knolling .cell")) { c.scrollIntoView(); await new Promise((r) => setTimeout(r, 30)); } document.getElementById("knolling").scrollIntoView(); });
await page.waitForFunction(() => [...document.querySelectorAll("#knolling img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 });
await page.waitForTimeout(400);
await page.locator("#knolling").screenshot({ path: out, type: "jpeg", quality: 86 });
console.log("wrote", out);
await browser.close();
