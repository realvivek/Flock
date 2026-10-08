/**
 * The home page story: the map follows the scroll steps both ways, the county search finds a county, the page reads
 * without JavaScript, reduced motion changes the map without animating, nothing loads from another site, and on a
 * phone the map stays pinned under the header while the steps scroll over it.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const stats = JSON.parse(readFileSync(new URL("../public/data/story/stats.json", import.meta.url), "utf8"));
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __flock?: { state: { ready: boolean } } }).__flock?.state.ready === true, null, { timeout: 90_000 });
const state = <K extends string>(page: Page, k: K) => page.evaluate((k) => (window as unknown as { __flock: { state: Record<string, unknown> } }).__flock.state[k], k);
const settled = (page: Page) => page.waitForFunction(() => { const s = (window as unknown as { __flock: { state: { tweens: number; busy: number } } }).__flock.state; return s.tweens === 0 && s.busy === 0; }, null, { timeout: 30_000 });
const toStep = (page: Page, id: string) => page.evaluate((id) => { const c = document.querySelector(`.step[data-step="${id}"] .step-card`)!; scrollTo(0, scrollY + c.getBoundingClientRect().top - innerHeight * 0.4); }, id);
/** Share of non-white pixels in the middle of the map canvas. */
const inked = (page: Page) => page.evaluate(() => {
  const c = document.querySelector<HTMLCanvasElement>(".map-canvas")!;
  const d = c.getContext("2d")!.getImageData(Math.round(c.width * 0.45), Math.round(c.height * 0.25), Math.round(c.width * 0.5), Math.round(c.height * 0.5)).data;
  let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i]! < 235 || d[i + 3]! > 0 && d[i]! < 250) n++;
  return n / (d.length / 4);
});

test("the map follows the steps in both directions and draws each look", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/", { waitUntil: "commit" });
  await ready(page);
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
  await expect(page.locator(".map-canvas")).toBeVisible();
  await expect(page.locator(".map-fallback")).toBeHidden();
  await page.locator(".scrolly").scrollIntoViewIfNeeded();
  for (const id of ["all", "flock", "rate", "georgia", "fulton"]) {
    await toStep(page, id);
    await expect.poll(() => state(page, "step")).toBe(`map:${id}`);
    await settled(page);
    expect(await inked(page), id).toBeGreaterThan(0.01);
    // the credit is part of the pinned graphic, on screen at every step
    await expect(page.locator(".scrolly-graphic .map-credit"), id).toBeInViewport();
  }
  // the Georgia label belongs to the Georgia step, the Atlanta labels to the Fulton step
  await toStep(page, "georgia");
  await expect.poll(() => state(page, "step")).toBe("map:georgia");
  await settled(page);
  await expect(page.locator(".map-legend")).toContainText("per 100,000 residents");
  await expect(page.locator(".mlabel.state")).toBeVisible();
  await expect(page.locator(".mlabel.road").first()).toBeHidden();
  await toStep(page, "fulton");
  await expect.poll(() => state(page, "step")).toBe("map:fulton");
  await settled(page);
  await expect(page.locator(".mlabel.road").first()).toBeVisible();
  await expect(page.locator(".mlabel.state")).toBeHidden();
  await toStep(page, "all");
  await expect.poll(() => state(page, "step")).toBe("map:all");
  await settled(page);
  await expect(page.locator(".mlabel.road").first()).toBeHidden();
  expect(errors).toEqual([]);
});

test("the county search finds a county and moves its marker", async ({ page }) => {
  await page.goto("/", { waitUntil: "commit" });
  await ready(page);
  const input = page.locator("#county-q");
  await input.scrollIntoViewIfNeeded();
  await expect(input).toBeEnabled();
  await expect(page.locator(".lk-card .lk-name")).toHaveText("Fulton County, Ga.");
  const before = await page.locator(".lk-mark").first().getAttribute("transform");
  const most = stats.mostCounty.value as { name: string; usps: string; flock: number };
  await input.fill("");
  await input.pressSequentially(`${most.name.replace(" County", "")} texas`);
  await expect(page.locator("#county-list li").first()).toContainText(most.name);
  await input.press("Enter");
  await expect(page.locator(".lk-card .lk-name")).toHaveText(`${most.name}, Texas`);
  await expect(page.locator(".lk-card .lk-big .n")).toHaveText(most.flock.toLocaleString("en-US"));
  expect(await page.locator(".lk-mark").first().getAttribute("transform")).not.toBe(before);
});

test("the story reads without JavaScript", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator(".story-head h1")).toHaveText("Inside the Network of Cameras Reading America’s License Plates");
  await expect(page.locator(".story .chapter-title")).toHaveCount(12);
  await expect(page.locator(".story figure.fig")).toHaveCount(14);
  await expect(page.locator(".story .fig-src").first()).toContainText("Source");
  await expect(page.locator("#summary-cards .summary-card")).toHaveCount(8);
  // every number in the step cards is filled in at build time
  const steps = await page.locator(".step-card").allTextContents();
  expect(steps.join(" ")).toContain(stats.mappedTotal.value.toLocaleString("en-US"));
  expect(steps.join(" ")).not.toMatch(/\{\{|\}\}/);
  // the poster stands in for the map
  const poster = page.locator(".map-poster");
  await expect(poster).toHaveCount(1);
  await poster.scrollIntoViewIfNeeded();
  await expect.poll(() => poster.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  // a data table opens with the native disclosure
  await page.locator("#fig-states .fig-data summary").click();
  await expect(page.locator("#fig-states .fig-data table tbody tr")).toHaveCount(51);
  await ctx.close();
});

test("with reduced motion the map changes without animating", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/", { waitUntil: "commit" });
  await ready(page);
  await page.locator(".scrolly").scrollIntoViewIfNeeded();
  await toStep(page, "fulton");
  await expect.poll(() => state(page, "step")).toBe("map:fulton");
  // no transition is ever in flight
  expect(await state(page, "tweens")).toBe(0);
  await settled(page);
  expect(await inked(page)).toBeGreaterThan(0.01);
  await ctx.close();
});

test("no page loads anything from another site", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (r) => { const u = r.url(); if (!u.startsWith("http://127.0.0.1:4173/") && !u.startsWith("data:")) outside.push(u); });
  for (const p of ["/", "/deployments/", "/components/", "/data/", "/journey/", "/outcomes/", "/claims/", "/economics/", "/sources/"]) {
    await page.goto(p, { waitUntil: "commit" });
    await ready(page);
    await page.evaluate(() => document.fonts.ready);
  }
  expect(outside).toEqual([]);
});

test("on a phone the map stays under the header while the steps scroll, and nothing overflows", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/", { waitUntil: "commit" });
  await ready(page);
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
  await page.locator(".scrolly").scrollIntoViewIfNeeded();
  for (const id of ["flock", "fulton"]) {
    await toStep(page, id);
    await expect.poll(() => state(page, "step")).toBe(`map:${id}`);
    const pos = await page.evaluate(() => ({ graphic: document.querySelector(".scrolly-graphic")!.getBoundingClientRect().top, header: document.querySelector(".topbar")!.getBoundingClientRect().bottom }));
    expect(Math.abs(pos.graphic - pos.header), id).toBeLessThanOrEqual(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await ctx.close();
});

test("no page is wider than a phone screen", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const p of ["/", "/deployments/", "/components/", "/data/", "/journey/", "/outcomes/", "/claims/", "/economics/", "/sources/"]) {
    await page.goto(p, { waitUntil: "commit" });
    await ready(page);
    // a page wider than the screen makes a phone zoom out, so the layout viewport grows past the device width
    expect(await page.evaluate(() => ({ w: innerWidth, sw: document.documentElement.scrollWidth })), p).toEqual({ w: 360, sw: 360 });
  }
  await ctx.close();
});
