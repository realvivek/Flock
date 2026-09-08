import { test, expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __flock?: {
      state: { ready: boolean; mode: "3d" | "stills"; focusedPart: string | null; explodeStage: number; tweening: boolean };
      set(p: Record<string, unknown>): void;
    };
  }
}

const PAGES = ["deployments", "components", "pole", "power", "data", "claims", "economics", "sources"];
const ready = (page: Page) => page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 90_000 });
/** Navigate without waiting for the load event: a slow font host must not stall a test. */
const go = (page: Page, url: string) => page.goto(url, { waitUntil: "commit" });
const settled = (page: Page) => page.waitForFunction(() => window.__flock!.state.tweening !== true);
const instant = (page: Page) => page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
const inView = (page: Page, sel: string) => page.evaluate((sel) => { const r = document.querySelector(sel)!.getBoundingClientRect(); return r.top >= 40 && r.top < innerHeight; }, sel);
const nav = async (page: Page, current: string) => {
  await expect(page.locator(".sections a")).toHaveCount(9);
  await expect(page.locator(".sections a").first()).toHaveText("Home");
  await expect(page.locator(".sections a.is-active")).toHaveText(current);
  await expect(page.locator(".sections a.is-active")).toHaveAttribute("aria-current", "page");
};

test("home: summary of every page, the components preview, older links redirect", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await go(page, "/");
  await ready(page);
  await instant(page);
  await nav(page, "Home");
  await expect(page.locator("#preview-img")).toHaveJSProperty("complete", true);
  expect(await page.evaluate(() => (document.getElementById("preview-img") as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator("#summary-cards .summary-card")).toHaveCount(8);
  await expect(page.locator("#summary-cards .summary-card .t")).toHaveText(["Deployments and contracts", "Inside the enclosure", "Pole and mount", "Power and cable", "Data path", "Common claims", "Economics", "Sources"]);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(2200);
  // no article content on the home page
  await expect(page.locator(".claim, .stage, .cell")).toHaveCount(0);
  // a summary card opens its page
  await page.locator("#summary-cards .summary-card", { hasText: "Data path" }).click();
  await page.waitForURL(/\/data\/$/, { waitUntil: "commit" });
  await ready(page);
  await nav(page, "Data");
  await expect(page.locator("#page-body .stage")).toHaveCount(14);
  // the preview opens the components page
  await go(page, "/");
  await ready(page);
  await page.locator("#preview").click();
  await page.waitForURL(/\/components\/$/, { waitUntil: "commit" });
  // older single-page links land on the right page
  for (const [from, to] of [["/#deployments", /\/deployments\/$/], ["/#/hardware/inside/13", /\/components\/#som$/], ["/#act-4", /\/data\/$/], ["/?s=data/9", /\/data\/#stage-10$/], ["/#economics", /\/economics\/$/]] as const) {
    await go(page, from);
    await page.waitForURL(to, { waitUntil: "commit" });
  }
  await ready(page);
  const src = await page.evaluate(() => { const a = document.querySelector<HTMLAnchorElement>("#page-body .cite a"); return a ? a.getAttribute("href")!.slice(1) : ""; });
  expect(src).toMatch(/^src-/);
  await go(page, "/#" + src);
  await page.waitForURL(new RegExp(`/sources/#${src}$`), { waitUntil: "commit" });
  await ready(page);
  await expect(page.locator(`#${src}`)).toHaveClass(/is-target/);
  expect(errors).toEqual([]);
});

test("every content page loads with its content, the pager and citations that reach the Sources page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const counts: Record<string, [string, number]> = {
    deployments: ["#page-body .chart-bars .bar", 10],
    pole: ["#page-body .card", 4],
    power: ["#page-body .card", 3],
    data: ["#page-body .stage", 14],
    claims: ["#page-body .claim", 21],
    economics: ["#page-body .econ-block", 1],
    sources: ["#page-body .src-group", 4],
  };
  for (const id of PAGES.filter((p) => p !== "components")) {
    await go(page, `/${id}/`);
    await ready(page);
    await nav(page, id[0]!.toUpperCase() + id.slice(1));
    const [sel, n] = counts[id]!;
    expect(await page.locator(sel).count(), id).toBeGreaterThanOrEqual(n);
    await expect(page.locator("#pager a.up")).toHaveAttribute("href", "../");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id).toBe(true);
  }
  // pager order
  await go(page, "/deployments/");
  await ready(page);
  await expect(page.locator("#pager a.next")).toHaveAttribute("href", "../components/");
  await go(page, "/sources/");
  await ready(page);
  await expect(page.locator("#pager a.prev")).toHaveAttribute("href", "../economics/");
  await expect(page.locator("#pager .end")).toHaveCount(1);
  // data: deputy form and a stage deep link
  await go(page, "/data/#stage-10");
  await ready(page);
  await instant(page);
  await expect.poll(() => inView(page, "#stage-10")).toBe(true);
  await page.fill("#deputy-reason", "investigation");
  await page.locator("#deputy-form button").click();
  await expect(page.locator("#deputy-readout")).toContainText("6,809");
  // claims: product table, a component link and a data-stage link cross pages
  await go(page, "/claims/");
  await ready(page);
  await expect(page.locator("#page-body .products tbody tr")).toHaveCount(8);
  await page.locator("#page-body .claim button", { hasText: /^Data stage/ }).first().click();
  await page.waitForURL(/\/data\/#stage-\d+$/, { waitUntil: "commit" });
  await go(page, "/claims/");
  await ready(page);
  await page.locator("#page-body .claim button", { hasText: /^Component/ }).first().click();
  await page.waitForURL(/\/components\/#[a-z]+$/, { waitUntil: "commit" });
  await ready(page);
  await expect(page.locator("#part-detail")).toBeVisible();
  // a citation chip on any page reaches the row on the Sources page; every chip on the Sources page resolves
  await go(page, "/deployments/");
  await ready(page);
  const chip = page.locator("#page-body .cite a").first();
  const href = (await chip.getAttribute("href"))!;
  await chip.click();
  await page.waitForURL(new RegExp(`/sources/${href}$`), { waitUntil: "commit" });
  await ready(page);
  await expect(page.locator(href)).toHaveClass(/is-target/);
  await expect.poll(() => inView(page, href)).toBe(true);
  const missing = await page.evaluate(() => {
    const ids = new Set([...document.querySelectorAll(".source")].map((r) => r.id));
    return [...document.querySelectorAll<HTMLAnchorElement>(".cite a")].map((a) => a.getAttribute("href")!.slice(1)).filter((h) => !ids.has(h));
  });
  expect(missing).toEqual([]);
  // Top button
  await page.evaluate(() => scrollTo(0, 3000));
  await expect(page.locator("#totop")).toBeVisible();
  await page.locator("#totop").click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(errors).toEqual([]);
});

test("components page: knolling grid in five groups with a 3D locator on desktop", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await go(page, "/components/?gl");
  await ready(page);
  await instant(page);
  await expect(page.locator("#status")).toContainText(/webgl2|webgpu/);
  expect(await page.evaluate(() => window.__flock!.state.mode)).toBe("3d");
  await nav(page, "Components");
  await expect(page.locator(".sections a", { hasText: "Data" })).toHaveAttribute("href", "../data/");
  await expect(page.locator("#knolling .group")).toHaveCount(5);
  await expect(page.locator("#knolling .group-head h3")).toHaveText(["Shell", "Optics", "Compute", "Radios", "Mount"]);
  await expect(page.locator("#knolling .cell")).toHaveCount(14);
  for (const img of await page.locator("#knolling .cell img").all()) expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);

  // Selecting a cell opens its record under the group, isolates it in the locator and writes the hash
  await page.locator(".cell[data-part=som]").click();
  await expect(page.locator("#part-detail")).toBeVisible();
  await expect(page.locator("#part-detail")).toContainText("Open-Q 624A");
  expect(await page.evaluate(() => document.getElementById("part-detail")!.closest(".group")!.getAttribute("data-group"))).toBe("compute");
  expect(await page.evaluate(() => location.hash)).toBe("#som");
  await expect.poll(() => page.evaluate(() => window.__flock!.state.focusedPart)).toBe("som");
  await settled(page);
  await expect(page.locator("#part-detail a[href='../data/#stage-2']")).toHaveCount(1);
  await page.locator("#part-detail .chip", { hasText: "Close" }).click();
  await expect(page.locator("#part-detail")).toHaveCount(0);
  expect(await page.evaluate(() => location.hash)).toBe("");
  // Stage slider
  await page.locator("#explode-stage").fill("5");
  await expect.poll(() => page.evaluate(() => window.__flock!.state.explodeStage)).toBe(5);
  await expect(page.locator("#explode-readout")).toContainText("Stage 5 of 5");
  await settled(page);
  await page.screenshot({ path: "test-results/components.png" });
  // The Components chip and the skip link stay on this page
  await page.locator(".sections a.is-active").click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => location.pathname)).toMatch(/\/components\/$/);
  await page.evaluate(() => { location.hash = "#main"; });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => location.pathname)).toMatch(/\/components\/$/);
  // A citation chip goes to the source row on the Sources page
  await page.locator(".cell[data-part=lens]").click();
  const chip = page.locator("#part-detail .cite a").first();
  const src = (await chip.getAttribute("href"))!.slice(1);
  await chip.click();
  await page.waitForURL(new RegExp(`/sources/#${src}$`), { waitUntil: "commit" });
  await ready(page);
  await expect(page.locator(`#${src}`)).toHaveClass(/is-target/);
  // Deep links: the record opens before the locator has loaded; Top keeps the part in the address
  await go(page, "/components/?gl#emmc");
  await expect(page.locator("#part-detail")).toContainText("Storage", { timeout: 5000 });
  await ready(page);
  await page.evaluate(() => scrollTo(0, 2000));
  await expect(page.locator("#totop")).toBeVisible();
  await page.locator("#totop").click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(await page.evaluate(() => location.hash)).toBe("#emmc");
  await go(page, "/components/?gl#s=inside/13");
  await ready(page);
  await expect(page.locator("#part-detail")).toContainText("System on module");
  expect(errors).toEqual([]);
});

test("phones get every page with stills and never load the 3D engine", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await go(page, "/");
  await ready(page);
  await instant(page);
  await expect(page.locator("#summary-cards .summary-card")).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator(".sections a", { hasText: "Economics" }).click();
  await page.waitForURL(/\/economics\/$/, { waitUntil: "commit" });
  await ready(page);
  await expect(page.locator("#page-body .inset img")).toHaveAttribute("src", /pole-flock\.webp$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  // every header link, Home included, sits inside the fixed header on a phone; scrolling does not move it
  await page.evaluate(() => scrollTo(0, 1200));
  await expect.poll(() => page.evaluate(() => { const tb = document.querySelector(".topbar")!.getBoundingClientRect(); return tb.top === 0 && [...document.querySelectorAll(".sections a")].every((a) => { const r = a.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= tb.top && r.bottom <= tb.bottom; }); })).toBe(true);
  await page.locator(".sections a.home").click();
  await page.waitForURL(/\/Flock\/$|:4173\/$/, { waitUntil: "commit" });
  await ready(page);
  await expect(page.locator("#summary-cards .summary-card")).toHaveCount(8);
  await go(page, "/claims/");
  await ready(page);
  await expect(page.locator("#page-body .claim")).toHaveCount(21);
  const mchip = page.locator("#page-body .cite a").first();
  const mhref = (await mchip.getAttribute("href"))!;
  await mchip.click();
  await page.waitForURL(new RegExp(`/sources/${mhref}$`), { waitUntil: "commit" });
  await ready(page);
  await expect(page.locator(mhref)).toHaveClass(/is-target/);
  const [popup] = await Promise.all([ctx.waitForEvent("page"), page.locator("#page-body .src-link").first().click()]);
  expect(popup).toBeTruthy();
  await popup.close();
  await go(page, "/components/");
  await ready(page);
  expect(await page.evaluate(() => window.__flock!.state.mode)).toBe("stills");
  await expect(page.locator("#locator-img")).toBeVisible();
  await expect(page.locator("#knolling .cell")).toHaveCount(14);
  await page.locator(".cell[data-part=lens]").click();
  await expect(page.locator("#part-detail")).toContainText("M12");
  await expect.poll(() => inView(page, "#part-detail")).toBe(true);
  expect(requests.filter((u) => /\.glb$|babylon/.test(u))).toEqual([]);
  await ctx.close();
});

test("desktop without a 3D engine gets the assembled still in the locator", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await go(page, "/components/?fail3d");
  await ready(page);
  expect(await page.evaluate(() => window.__flock!.state.mode)).toBe("stills");
  await expect(page.locator("#locator-img")).toBeVisible();
  await expect(page.locator("#locator-ui")).toBeHidden();
  await expect(page.locator("#knolling .cell")).toHaveCount(14);
  expect(errors).toEqual([]);
});
