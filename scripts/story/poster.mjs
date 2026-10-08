/**
 * Captures the opening map as images: the poster the home page shows without JavaScript
 * (public/data/story/map-poster.jpg) and the share card (public/og-image.jpg). Run against a preview of the build:
 *
 *   npm run build && npm run preview &
 *   node scripts/story/poster.mjs
 */
import { chromium } from "@playwright/test";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const base = process.argv[2] ?? "http://127.0.0.1:4173/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function shot(width, height, out, step) {
  const page = await browser.newPage({ viewport: { width, height: height + 48 }, deviceScaleFactor: 1 });
  await page.goto(`${base}?poster`, { waitUntil: "commit" });
  await page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 60_000 });
  await page.addStyleTag({ content: "html{scroll-behavior:auto!important}.topbar,.scrolly-steps,.totop,.map-legend,.map-credit{visibility:hidden!important}.scrolly-graphic{top:0!important;height:100vh!important}" });
  await page.evaluate(() => document.querySelector(".scrolly").scrollIntoView());
  await page.evaluate((step) => document.querySelector(`.step[data-step="${step}"] .step-card`)?.scrollIntoView({ block: "center" }), step);
  await page.waitForFunction(() => window.__flock.state.tweens === 0 && window.__flock.state.busy === 0);
  await page.waitForTimeout(300);
  const el = await page.locator(".scrolly-graphic");
  await el.screenshot({ path: out, type: "jpeg", quality: 84 });
  await page.close();
  console.log(out);
}
await shot(1600, 992, path.join(ROOT, "public/data/story/map-poster.jpg"), "all");
await shot(1200, 630, path.join(ROOT, "public/og-image.jpg"), "flock");
await browser.close();
