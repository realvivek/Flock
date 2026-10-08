/**
 * Screenshots of the built site for review by eye: each page at each width, as viewport-sized frames down the page
 * (so sticky graphics are captured as a reader sees them) or as one full-page image.
 *
 *   npm run build && npm run preview &
 *   node scripts/shots.mjs <out-dir> [--pages home,data] [--widths 1440,390] [--frames 6] [--full] [--reduced] [--at 0.35]
 *
 * --frames N   capture N frames, each one screen further down (default 4)
 * --at f       start at this fraction of the page height
 * --full       one full-page image per page and width instead of frames
 * --reduced    emulate prefers-reduced-motion
 * --figures    each scroll step once its transition has settled, then every figure and map panel as its own image
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const out = args[0] && !args[0].startsWith("--") ? args[0] : "shots";
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(`--${k}`);
const PAGES = { home: "/", deployments: "/deployments/", components: "/components/", data: "/data/", journey: "/journey/", outcomes: "/outcomes/", claims: "/claims/", economics: "/economics/", sources: "/sources/" };
const pages = opt("pages", Object.keys(PAGES).join(",")).split(",");
const widths = opt("widths", "1440,390").split(",").map(Number);
const frames = Number(opt("frames", "4"));
const at = Number(opt("at", "0"));
const base = opt("base", "http://127.0.0.1:4173");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
for (const w of widths) {
  const phone = w < 700;
  const h = w >= 1000 ? 900 : w > 800 ? 768 : w === 844 ? 390 : 844;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, reducedMotion: flag("reduced") ? "reduce" : "no-preference" });
  for (const id of pages) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + (PAGES[id] ?? id), { waitUntil: "commit" });
    await page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 60_000 }).catch(() => errors.push("not ready after 60 s"));
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
    const name = (k) => path.join(out, `${id}-${w}${k === undefined ? "" : `-${String(k).padStart(2, "0")}`}.png`);
    if (flag("figures")) {
      const settle = () => page.waitForFunction(() => window.__flock.state.tweens === 0 && window.__flock.state.busy === 0, null, { timeout: 20_000 }).catch(() => errors.push("did not settle"));
      const steps = await page.locator(".scrolly .step").count();
      for (let k = 0; k < steps; k++) {
        await page.evaluate((k) => { const c = document.querySelectorAll(".scrolly .step-card")[k]; const r = c.getBoundingClientRect(); scrollTo(0, scrollY + r.top - innerHeight * (innerWidth <= 760 ? 0.62 : 0.4)); }, k);
        await page.waitForTimeout(300);
        await settle();
        await page.waitForTimeout(150);
        await page.screenshot({ path: name(`step${k}`) });
      }
      const figs = await page.locator("main .fig, main .panel, .story .preview, #summary-cards").all();
      for (const [k, f] of figs.entries()) {
        await f.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await page.waitForFunction(() => window.__flock.state.busy === 0, null, { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(250);
        const id = (await f.getAttribute("id")) ?? (await f.getAttribute("data-panel")) ?? `item${k}`;
        await f.screenshot({ path: name(id) });
      }
    } else if (flag("full")) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: name(), fullPage: true });
    } else {
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let k = 0; k < frames; k++) {
        const y = Math.round(total * at + k * h * 0.92);
        if (y > total - h * 0.5 && k > 0) break;
        await page.evaluate((y) => scrollTo(0, y), y);
        await page.waitForTimeout(450);
        await page.screenshot({ path: name(k) });
      }
    }
    if (errors.length) console.log(`${id} @${w}: ${errors.join(" | ")}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`shots in ${out}`);
