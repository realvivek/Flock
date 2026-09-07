import { test, expect } from "@playwright/test";

declare global {
  interface Window {
    __flock?: {
      state: { ready: boolean; act: number; tab: string; sub: string; explodeStage: number; dataStage: number; tweening: boolean; focusedPart: string | null; acts: number[] };
      set(p: Record<string, unknown>): void;
      go(route: string): void;
    };
  }
}

const settled = (page: import("@playwright/test").Page) => page.waitForFunction(() => window.__flock!.state.tweening !== true);

test("desktop: tabs, controls and articles", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?gl");
  await page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 90_000 });
  await expect(page.locator("#status")).toContainText(/webgl2|webgpu/);

  // Overview: one screen, no page scroll, a card for every section
  await expect(page.locator("body")).toHaveClass(/is-tabs/);
  await expect(page.locator("#view-overview")).toBeVisible();
  await expect(page.locator("#view-overview .contents a")).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);

  // A contents card opens its tab; the scene stops on article tabs
  await page.locator("#view-overview .contents a", { hasText: "Economics" }).click();
  await expect(page.locator("#view-economics")).toBeVisible();
  await expect(page.locator("#view-overview")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/is-3d/);
  expect(await page.evaluate(() => location.hash)).toBe("#/economics");
  await expect(page.locator("#view-economics .econ-block table").first()).toBeVisible();
  await expect(page.locator("#view-economics .inset img")).toHaveAttribute("src", /pole-flock\.webp$/);

  // The brand returns home
  await page.locator(".topbar .brand").click();
  await expect(page.locator("#view-overview")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/is-3d/);

  // Hardware: Pole sub-tab with mount and view chips
  await page.locator(".tabs a", { hasText: "Hardware" }).click();
  await expect(page.locator("#view-hardware .panel[data-sub=pole]")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__flock!.state.act)).toBe(1);
  await page.locator("[data-view=fov]").click();
  await settled(page);

  // Inside: explode stages, cards, badges, spec card
  await page.locator(".subtabs a", { hasText: "Inside" }).click();
  await expect.poll(() => page.evaluate(() => window.__flock!.state.act)).toBe(2);
  await expect(page.locator("#callouts-left .callout")).toHaveCount(8);
  await expect(page.locator("#callouts-right .callout")).toHaveCount(6);
  await page.locator("#explode-stage").fill("5");
  await expect.poll(() => page.evaluate(() => window.__flock!.state.explodeStage)).toBe(5);
  await expect.poll(() => page.evaluate(() => window.__flock!.state.acts[2]), { timeout: 5000 }).toBe(1);
  await settled(page);
  await expect(page.locator("#pins .pin.badge.is-visible")).toHaveCount(14);
  await page.screenshot({ path: "test-results/inside-5.png" });
  await page.locator(".callout", { hasText: "System on module" }).click();
  await expect(page.locator("#spec-card")).toBeVisible();
  await expect(page.locator("#spec-card")).toContainText("Open-Q 624A");
  await page.keyboard.press("Escape");
  await expect(page.locator("#spec-card")).toBeHidden();
  // Stage 0: the shell is see-through and every marker is already on the model
  await page.locator("#explode-stage").fill("0");
  await expect.poll(() => page.evaluate(() => window.__flock!.state.acts[2]), { timeout: 5000 }).toBe(0);
  await settled(page);
  await expect(page.locator("#pins .pin.badge.is-visible")).toHaveCount(14);

  // Power sub-tab
  await page.locator(".subtabs a", { hasText: "Power" }).click();
  await expect.poll(() => page.evaluate(() => window.__flock!.state.act)).toBe(3);
  await page.locator("[data-path=wing]").click();
  await expect(page.locator("#path-facts")).toContainText(/SFP|PoE/);

  // Data: hop list drives the stage; deputy form writes a readout
  await page.locator(".tabs a", { hasText: "Data" }).click();
  await expect.poll(() => page.evaluate(() => window.__flock!.state.act)).toBe(4);
  await page.locator("#hops li").nth(9).click();
  await expect.poll(() => page.evaluate(() => window.__flock!.state.dataStage)).toBe(10);
  await expect(page.locator("#data-readout")).toContainText("Stage 10 of 12");
  await page.fill("#deputy-reason", "investigation");
  await page.locator("#deputy-form button").click();
  await expect(page.locator("#deputy-readout")).toContainText("6,809");

  // Claims: product line, 21 claims; a component link opens the Inside stage with the part isolated
  await page.locator(".tabs a", { hasText: "Claims" }).click();
  await expect(page.locator("#view-claims .products tbody tr")).toHaveCount(8);
  await expect(page.locator("#view-claims .claim")).toHaveCount(21);
  await page.locator("#view-claims .claim button", { hasText: /^Component/ }).first().click();
  await expect(page.locator("#view-hardware")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__flock!.state.explodeStage)).toBe(5);
  await expect(page.locator("#spec-card")).toBeVisible();

  // Deployments article
  await page.locator(".tabs a", { hasText: "Deployments" }).click();
  await expect(page.locator("#deployments-body .chart-bars .bar")).toHaveCount(10);
  await expect(page.locator("#deployments-body .contracts tbody tr")).toHaveCount(10);

  // A citation chip opens Sources at its row and flashes it
  const chip = page.locator("#deployments-body .cite a").first();
  const href = (await chip.getAttribute("href"))!;
  await chip.click();
  await expect(page.locator("#view-sources")).toBeVisible();
  await expect(page.locator(href)).toHaveClass(/is-target/);
  await expect.poll(() => page.evaluate((h) => { const r = document.querySelector(h)!.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }, href)).toBe(true);

  // Every citation chip resolves to a bibliography row
  const missing = await page.evaluate(() => {
    const ids = new Set([...document.querySelectorAll(".source")].map((r) => r.id));
    return [...document.querySelectorAll<HTMLAnchorElement>(".cite a")].map((a) => a.getAttribute("href")!.slice(1)).filter((h) => !ids.has(h));
  });
  expect(missing).toEqual([]);

  // Back returns to the previous tab; legacy links still resolve
  await page.goBack();
  await expect(page.locator("#view-deployments")).toBeVisible();
  await page.goto("/?gl#act-2");
  await page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 90_000 });
  await expect(page.locator("#view-hardware")).toBeVisible();
  expect(await page.evaluate(() => window.__flock!.state.sub)).toBe("inside");
  expect(errors).toEqual([]);
});

test("laptop window: nothing a reader needs sits below the fold", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto("/?gl");
  await page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 90_000 });
  const inView = (sel: string) => page.evaluate((sel) => [...document.querySelectorAll<HTMLElement>(sel)].filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 47; }), sel);
  // Overview: all eight contents cards
  expect(await inView("#view-overview .contents a")).toEqual(Array(8).fill(true));
  // Pole: mount chips and aim sliders visible without scrolling
  await page.evaluate(() => window.__flock!.go("hardware/pole"));
  await settled(page);
  expect(await inView("#view-hardware .panel[data-sub=pole] .toggle-row, #view-hardware .aim-box")).toEqual([true, true, true]);
  // Inside: every callout card on screen, a marker is clickable and the spec card covers no card
  await page.evaluate(() => { window.__flock!.go("hardware/inside"); window.__flock!.set({ explodeStage: 5 }); });
  await settled(page);
  expect((await inView(".callout")).every(Boolean)).toBe(true);
  await page.locator("#pins .pin.badge.is-visible").first().click();
  await expect(page.locator("#spec-card")).toBeVisible();
  const overlap = await page.evaluate(() => {
    const c = document.getElementById("spec-card")!.getBoundingClientRect();
    const others = [...document.querySelectorAll<HTMLElement>(".callout, .inside-strip")].filter((e) => e.offsetParent !== null && getComputedStyle(e.closest(".callout-col") ?? e).visibility !== "hidden").map((e) => e.getBoundingClientRect());
    return others.filter((r) => r.left < c.right && c.left < r.right && r.top < c.bottom && c.top < r.bottom).length;
  });
  expect(overlap).toBe(0);
  await page.keyboard.press("Escape");
  // Data: selecting stage 10 keeps the stage slider in view
  await page.evaluate(() => { window.__flock!.go("data"); window.__flock!.set({ dataStage: 10 }); });
  await settled(page);
  await page.waitForTimeout(600);
  expect(await inView("#view-data .stage-box")).toEqual([true]);
  await ctx.close();
});

test("reduced motion: stage changes apply instantly", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/?gl#/hardware/inside");
  await page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 90_000 });
  await page.evaluate(() => window.__flock!.set({ explodeStage: 3 }));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__flock!.state.acts[2])).toBeCloseTo(0.6, 5);
  await ctx.close();
});

test("phones get the same tabs as stills and never load the 3D engine", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await page.waitForSelector("#ch-overview h2");
  await expect(page.locator("#ch-overview h2")).toContainText("Anatomy of a Flock camera");
  await expect(page.locator("#ch-overview .contents a")).toHaveCount(8);
  await expect(page.locator("#ch-economics")).toBeHidden();
  // a contents card opens a tab
  await page.locator("#ch-overview .contents a", { hasText: "Economics" }).click();
  await expect(page.locator("#ch-economics")).toBeVisible();
  await expect(page.locator("#ch-overview")).toBeHidden();
  await expect(page.locator("#ch-economics .inset img")).toHaveAttribute("src", /pole-flock\.webp$/);
  expect(await page.evaluate(() => location.hash)).toBe("#/economics");
  // the chip rail switches tabs; decks step in place and write the screen into the hash
  await page.locator(".st-chapters button", { hasText: "Inside" }).click();
  await expect(page.locator("#ch-inside")).toBeVisible();
  await expect(page.locator("#ch-inside .st-count")).toContainText("1 / 20");
  await expect(page.locator("#ch-inside .st-figure img")).toHaveAttribute("src", /stills\/explode-0\.webp$/);
  await page.locator("#ch-inside .st-next").click();
  await expect(page.locator("#ch-inside .st-count")).toContainText("2 / 20");
  expect(await page.evaluate(() => location.hash)).toBe("#/inside/1");
  // articles are complete
  await page.locator(".st-chapters button", { hasText: "Claims" }).click();
  await expect(page.locator("#ch-claims .claim")).toHaveCount(21);
  await expect(page.locator("#ch-claims .products tbody tr")).toHaveCount(8);
  await page.locator(".st-chapters button", { hasText: "Deployments" }).click();
  await expect(page.locator("#ch-deployments .chart-bars .bar")).toHaveCount(10);
  await expect(page.locator("#ch-deployments .contracts tbody tr")).toHaveCount(10);
  // deep links, new and legacy
  await page.goto("/#/inside/13");
  await expect(page.locator("#ch-inside h2")).toContainText("System on module");
  await page.goto("/?s=inside/13");
  await expect(page.locator("#ch-inside h2")).toContainText("System on module");
  await page.screenshot({ path: "test-results/mobile-som.png" });
  // a citation chip opens Sources at the cited row
  await page.goto("/#/claims");
  const mchip = page.locator("#ch-claims .cite a").first();
  const mhref = (await mchip.getAttribute("href"))!;
  await mchip.click();
  await expect(page.locator("#ch-sources")).toBeVisible();
  await expect(page.locator(mhref)).toHaveClass(/is-target/);
  await expect.poll(() => page.evaluate((h) => { const r = document.querySelector(h)!.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }, mhref)).toBe(true);
  await expect(page.locator("#ch-sources .src-group")).toHaveCount(4);
  // a bibliography title opens the document in a new tab
  const [popup] = await Promise.all([ctx.waitForEvent("page"), page.locator("#ch-sources .src-link").first().click()]);
  expect(popup).toBeTruthy();
  await popup.close();
  expect(requests.filter((u) => /\.glb$|babylon/.test(u))).toEqual([]);
  await ctx.close();
});

test("phone deck screens fit the viewport", async ({ browser }) => {
  for (const [w, h] of [[360, 740], [390, 844]] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForSelector("#ch-overview h2");
    for (const r of ["pole/0", "pole/3", "inside/0", "inside/5", "inside/13", "power/2", "data/0", "data/9"]) {
      await page.evaluate((r) => (window.__flock as unknown as { go(s: string): void }).go(r), r);
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => {
        const ch = document.querySelector<HTMLElement>(".st-chapter:not([hidden])")!;
        const bar = ch.querySelector(".st-deckbar")!.getBoundingClientRect();
        const fig = ch.querySelector(".st-figure")!.getBoundingClientRect();
        const next = ch.querySelector<HTMLButtonElement>(".st-next")!;
        return { barBottom: bar.bottom, figBottom: fig.bottom, nextVisible: next.getBoundingClientRect().bottom <= innerHeight, pageScroll: document.documentElement.scrollHeight > innerHeight + 1 };
      });
      expect(m.barBottom, `${w}x${h} ${r} bar`).toBeLessThanOrEqual(h + 1);
      expect(m.figBottom, `${w}x${h} ${r} figure`).toBeLessThanOrEqual(h);
      expect(m.nextVisible, `${w}x${h} ${r} next`).toBe(true);
    }
    // the text row scrolls when a part's record is long
    await page.evaluate(() => (window.__flock as unknown as { go(s: string): void }).go("inside/13"));
    await expect(page.locator("#ch-inside .st-text")).toHaveClass(/is-overflow/);
    await ctx.close();
  }
});

test("desktop falls back to the stills tabs when no 3D engine can start", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?fail3d");
  await page.waitForSelector("#ch-overview h2");
  await expect(page.locator("#stepper .st-notice")).toContainText("stills version");
  await expect(page.locator("#stage")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/is-tabs/);
  await expect(page.locator("#ch-overview h2")).toContainText("Anatomy of a Flock camera");
  await page.locator("#stepper .st-notice button").click();
  await expect(page.locator("#stepper .st-notice")).toHaveCount(0);
  expect(errors).toEqual([]);
});
