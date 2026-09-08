import { test, expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __flock?: {
      state: { ready: boolean; mode: "3d" | "stills"; focusedPart: string | null; explodeStage: number; tweening: boolean };
      set(p: Record<string, unknown>): void;
    };
  }
}

const ready = (page: Page) => page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 90_000 });
const settled = (page: Page) => page.waitForFunction(() => window.__flock!.state.tweening !== true);
const instant = (page: Page) => page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
const inView = (page: Page, sel: string) => page.evaluate((sel) => { const r = document.querySelector(sel)!.getBoundingClientRect(); return r.top >= 40 && r.top < innerHeight; }, sel);

test("desktop: one document, section links, knolling grid with a 3D locator", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?gl");
  await ready(page);
  await instant(page);
  await expect(page.locator("#status")).toContainText(/webgl2|webgpu/);
  expect(await page.evaluate(() => window.__flock!.state.mode)).toBe("3d");

  // Hero: preview image links to the components section; the page is one scroll
  await expect(page.locator("#preview-img")).toHaveJSProperty("complete", true);
  expect(await page.evaluate(() => (document.getElementById("preview-img") as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator(".sections a")).toHaveCount(8);
  await page.locator("#preview").click();
  await expect.poll(() => inView(page, "#components")).toBe(true);
  expect(await page.evaluate(() => location.hash)).toBe("#components");

  // Knolling: fourteen cells in five groups, in order
  await expect(page.locator("#knolling .group")).toHaveCount(5);
  await expect(page.locator("#knolling .group-head h3")).toHaveText(["Shell", "Optics", "Compute", "Radios", "Mount"]);
  await expect(page.locator("#knolling .cell")).toHaveCount(14);
  for (const img of await page.locator("#knolling .cell img").all()) expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);

  // Selecting a cell opens its record under the group and isolates it in the locator
  await page.locator(".cell[data-part=som]").click();
  await expect(page.locator("#part-detail")).toBeVisible();
  await expect(page.locator("#part-detail")).toContainText("Open-Q 624A");
  expect(await page.evaluate(() => document.getElementById("part-detail")!.closest(".group")!.getAttribute("data-group"))).toBe("compute");
  await expect.poll(() => page.evaluate(() => window.__flock!.state.focusedPart)).toBe("som");
  await settled(page);
  await page.locator("#part-detail .chip", { hasText: "Close" }).click();
  await expect(page.locator("#part-detail")).toHaveCount(0);
  // Locator stage slider
  await page.locator("#explode-stage").fill("5");
  await expect.poll(() => page.evaluate(() => window.__flock!.state.explodeStage)).toBe(5);
  await expect(page.locator("#explode-readout")).toContainText("Stage 5 of 5");
  await settled(page);
  await page.screenshot({ path: "test-results/components.png" });

  // Section links and the current-section marker
  await page.locator(".sections a", { hasText: "Data" }).click();
  await expect.poll(() => inView(page, "#data")).toBe(true);
  await expect(page.locator("#data .stage")).toHaveCount(14);
  await expect.poll(() => page.locator(".sections a.is-active").textContent()).toBe("Data");
  await page.fill("#deputy-reason", "investigation");
  await page.locator("#deputy-form button").click();
  await expect(page.locator("#deputy-readout")).toContainText("6,809");
  await expect(page.locator("#totop")).toBeVisible();

  // Pole and power cards
  await expect(page.locator("#pole-body .card")).toHaveCount(4);
  await expect(page.locator("#power-body .card")).toHaveCount(3);

  // Claims: the product line, twenty-one claims; a component link selects the part in the grid
  await expect(page.locator("#claims .products tbody tr")).toHaveCount(8);
  await expect(page.locator("#claims .claim")).toHaveCount(21);
  await page.locator("#claims .claim button", { hasText: /^Component/ }).first().click();
  await expect(page.locator("#part-detail")).toBeVisible();
  await expect.poll(() => inView(page, "#part-detail")).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#part-detail")).toHaveCount(0);

  // Deployments article, citation chips and the bibliography
  await expect(page.locator("#deployments-body .chart-bars .bar")).toHaveCount(10);
  await expect(page.locator("#deployments-body .contracts tbody tr")).toHaveCount(10);
  const chip = page.locator("#deployments-body .cite a").first();
  const href = (await chip.getAttribute("href"))!;
  await chip.click();
  await expect(page.locator(href)).toHaveClass(/is-target/);
  await expect.poll(() => inView(page, href)).toBe(true);
  const missing = await page.evaluate(() => {
    const ids = new Set([...document.querySelectorAll(".source")].map((r) => r.id));
    return [...document.querySelectorAll<HTMLAnchorElement>(".cite a")].map((a) => a.getAttribute("href")!.slice(1)).filter((h) => !ids.has(h));
  });
  expect(missing).toEqual([]);

  // Top button returns to the top
  await page.locator("#totop").click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);

  // Older links still land: #/hardware/inside/13 selects the System on module, #act-4 is the data section
  await page.goto("/?gl#/hardware/inside/13");
  await ready(page);
  await expect(page.locator("#part-detail")).toContainText("System on module");
  await page.goto("/?gl#act-4");
  await ready(page);
  await expect.poll(() => inView(page, "#data")).toBe(true);
  expect(errors).toEqual([]);
});

test("phones get the same document with stills and never load the 3D engine", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await ready(page);
  await instant(page);
  expect(await page.evaluate(() => window.__flock!.state.mode)).toBe("stills");
  await expect(page.locator("#locator-img")).toBeVisible();
  await expect(page.locator("#locator-canvas")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page.locator("#knolling .cell")).toHaveCount(14);
  await page.locator(".cell[data-part=lens]").click();
  await expect(page.locator("#part-detail")).toContainText("M12");
  await expect.poll(() => inView(page, "#part-detail")).toBe(true);
  await page.locator(".sections a", { hasText: "Economics" }).click();
  await expect.poll(() => inView(page, "#economics")).toBe(true);
  await expect(page.locator("#economics .inset img")).toHaveAttribute("src", /pole-flock\.webp$/);
  await expect(page.locator("#claims .claim")).toHaveCount(21);
  await expect(page.locator("#deployments-body .chart-bars .bar")).toHaveCount(10);
  // a citation chip scrolls to the cited bibliography row
  const mchip = page.locator("#claims .cite a").first();
  const mhref = (await mchip.getAttribute("href"))!;
  await mchip.click();
  await expect(page.locator(mhref)).toHaveClass(/is-target/);
  await expect.poll(() => inView(page, mhref)).toBe(true);
  const [popup] = await Promise.all([ctx.waitForEvent("page"), page.locator("#sources .src-link").first().click()]);
  expect(popup).toBeTruthy();
  await popup.close();
  await page.goto("/?s=inside/13");
  await ready(page);
  await expect(page.locator("#part-detail")).toContainText("System on module");
  expect(requests.filter((u) => /\.glb$|babylon/.test(u))).toEqual([]);
  await ctx.close();
});

test("desktop without a 3D engine gets the assembled still in the locator", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?fail3d");
  await ready(page);
  expect(await page.evaluate(() => window.__flock!.state.mode)).toBe("stills");
  await expect(page.locator("#locator-img")).toBeVisible();
  await expect(page.locator("#locator-ui")).toBeHidden();
  await expect(page.locator("#knolling .cell")).toHaveCount(14);
  expect(errors).toEqual([]);
});
