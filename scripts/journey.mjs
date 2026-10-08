import { chromium } from "@playwright/test";
import fs from "node:fs";
// Renders the home page's preview images of the journey page, 4:3, no text smaller than about 12 px as shown:
// the parcel card (its picture only) beside the first three stops; with --phone, the first four stops, larger.
// Usage: node scripts/journey.mjs [url] [out] [--phone]
//   (default http://127.0.0.1:4173/journey/, public/img/journey.jpg or public/img/journey-phone.jpg)
const argv = process.argv.slice(2).filter((a) => !a.startsWith("--")), phone = process.argv.includes("--phone");
const url = argv[0] || "http://127.0.0.1:4173/journey/";
const out = argv[1] || (phone ? "public/img/journey-phone.jpg" : "public/img/journey.jpg");
fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
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
  .stop-body .line { font-size: 12.5px; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .stop-body .opens, .stop-body .more { display: none !important; }
  .stop-head { flex-direction: column; align-items: flex-start; gap: .1rem; }
  .stop-head .status { color: var(--amber); }
` });
await page.addStyleTag({ content: `
  #page-body { width: 560px; height: 420px; overflow: hidden; grid-template-columns: repeat(2, 1fr); grid-auto-rows: 1fr; }
  .stop-body .line, .stop-body .where, .stop-head .when, .slip-meta { display: none !important; }
  /* the parcel card is a picture here: the stop it would name is the tile beside it */
  .slip-status { display: none !important; }
  .slip { justify-content: center; }
  .marker .ring { width: 36px !important; height: 36px !important; }
  .stop-body { padding: .5rem .6rem .6rem !important; }
  .stop-body h2 { font-size: 1.3rem; line-height: 1.18; }
  .stop-head .status { font-size: .9rem; }
` });
// on a phone the image is shown at about 360 px: four stops, no parcel, every word large enough to read there
if (phone) await page.addStyleTag({ content: `
  .slip { display: none !important; }
  .stop:nth-of-type(n+4) { display: grid !important; }
  .stop:nth-of-type(n+5) { display: none !important; }
  .marker .ring { width: 46px !important; height: 46px !important; }
  .stop-body h2 { font-size: 1.55rem; line-height: 1.15; }
  .stop-head .status { font-size: 1.35rem; letter-spacing: .03em; }
` });
else await page.addStyleTag({ content: ".stop:nth-of-type(n+4) { display: none !important; }" });
await page.evaluate(() => { document.querySelectorAll(".stop").forEach((e) => e.classList.add("is-reached")); });
await page.waitForTimeout(300);
await page.locator("#page-body").screenshot({ path: out, type: "jpeg", quality: 86 });
console.log("wrote", out);
await browser.close();
