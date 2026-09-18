import { chromium } from "@playwright/test";
import fs from "node:fs";
// Renders the home page's preview image of the journey page: the seven stops as a strip of cards with the parcel slip.
// Usage: node scripts/journey.mjs [url] [out]   (default http://127.0.0.1:4173/journey/, public/img/journey.jpg)
const url = process.argv[2] || "http://127.0.0.1:4173/journey/";
const out = process.argv[3] || "public/img/journey.jpg";
fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1.5 });
await page.goto(url, { waitUntil: "commit", timeout: 60000 });
await page.waitForFunction(() => window.__flock?.state.ready === true && document.querySelectorAll(".stop").length === 7, null, { timeout: 30000 });
await page.addStyleTag({ content: `
  #page-body { width: 1120px; padding: 12px; background: #fff; display: grid !important; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 1fr; align-items: stretch; gap: 10px; --progress: 1; }
  .slip { position: static !important; padding: .8rem; gap: .5rem; }
  .parcel { aspect-ratio: 16 / 10; }
  .slip .parcel-contents, .slip-route, .slip .fine { display: none !important; }
  .slip-status { padding-top: .5rem; } .slip-status strong { font-size: 1.15rem; }
  .stops { display: contents !important; }
  .stops::before, .stops::after { display: none !important; }
  .stop { grid-template-columns: 1fr; grid-template-rows: auto 1fr; gap: .4rem; align-items: stretch; }
  .marker { justify-items: start; }
  .marker .ring { width: 44px; height: 44px; border-color: var(--amber); color: var(--ink); transform: none; }
  .stop-body { padding: .7rem .8rem .8rem; gap: .3rem; align-content: start; }
  .stop-body h2 { font-size: 1.05rem; }
  .stop-body p { font-size: 12.5px; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .stop-body .kv, .stop-body .cite { display: none !important; }
  .stop-head { flex-direction: column; align-items: flex-start; gap: .1rem; }
  .stop-head .status { color: var(--amber); }
` });
await page.evaluate(() => { document.querySelectorAll(".stop, .slip-route li").forEach((e) => e.classList.add("is-reached")); document.getElementById("slip-count").textContent = "Stop 7 of 7"; document.getElementById("slip-status").textContent = "Disposed"; document.getElementById("slip-where").textContent = "Object storage lifecycle"; });
await page.waitForTimeout(300);
await page.locator("#page-body").screenshot({ path: out, type: "jpeg", quality: 86 });
console.log("wrote", out);
await browser.close();
