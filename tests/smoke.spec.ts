import { test, expect } from "@playwright/test";

declare global { interface Window { __flock?: { state: { ready: boolean; act: number; focusedPart: string | null; acts: number[] }; set(p: Record<string, unknown>): void } } }

async function scrollToAct(page: import("@playwright/test").Page, act: number, p: number) {
  const y = await page.evaluate(({ act, p }) => {
    const sec = document.querySelectorAll<HTMLElement>("section.act")[act]!;
    return Math.round(sec.offsetTop + (sec.offsetHeight - innerHeight) * p);
  }, { act, p });
  await page.evaluate((y) => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo({ top: y, behavior: "instant" }); }, y);
  await page.waitForFunction((y) => Math.abs(scrollY - y) < 2, y);
  await page.waitForTimeout(400);
}

test("boots, renders, and each act reaches its state", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?gl");
  await page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 90_000 });
  await expect(page.locator("#status")).toContainText(/webgl2|webgpu/);

  for (let act = 0; act < 8; act++) {
    await scrollToAct(page, act, 0.5);
    const st = await page.evaluate(() => ({ act: window.__flock!.state.act, p: window.__flock!.state.acts[window.__flock!.state.act] }));
    expect(st.act).toBe(act);
    expect(st.p).toBeGreaterThan(0.3);
    await page.screenshot({ path: `test-results/act-${act}.png` });
  }

  // Exploded view: focusing a part shows its spec card
  await scrollToAct(page, 2, 0.5);
  await page.locator("#part-list button", { hasText: "System on module" }).click();
  await expect(page.locator("#spec-card")).toBeVisible();
  await expect(page.locator("#spec-card")).toContainText("Open-Q 624A");

  // Data act: the deputy form writes a readout
  await scrollToAct(page, 4, 0.7);
  await page.fill("#deputy-reason", "investigation");
  await page.locator("#deputy-form button").click();
  await expect(page.locator("#deputy-readout")).toContainText("6,809");

  // Acts 5 to 7 are articles: the scene fades out and the claims list is complete
  await scrollToAct(page, 5, 0.5);
  await expect(page.locator("#act-5 .article .claim")).toHaveCount(21);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById("stage")!).opacity)).toBe("0");
  await scrollToAct(page, 6, 0.3);
  await expect(page.locator("#act-6 .econ-block table").first()).toBeVisible();
  await expect(page.locator("#act-6 .inset img")).toHaveAttribute("src", /pole-flock\.webp$/);

  // A citation chip scrolls to its bibliography row and flashes it
  await scrollToAct(page, 1, 0.5);
  const chip = page.locator("#install-facts .cite a").first();
  const href = (await chip.getAttribute("href"))!;
  await chip.click();
  await expect(page.locator(href)).toHaveClass(/is-target/);
  await expect.poll(() => page.evaluate((h) => { const r = document.querySelector(h)!.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }, href)).toBe(true);
  expect(await page.evaluate(() => location.hash)).toBe(href);

  // Sources render and every citation chip resolves to a bibliography row
  const missing = await page.evaluate(() => {
    const ids = new Set([...document.querySelectorAll(".source")].map((r) => r.id));
    return [...document.querySelectorAll<HTMLAnchorElement>(".cite a")].map((a) => a.getAttribute("href")!.slice(1)).filter((h) => !ids.has(h));
  });
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
});

test("reduced motion snaps progress to steps", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/?gl");
  await page.waitForFunction(() => window.__flock?.state.ready === true, null, { timeout: 90_000 });
  await scrollToAct(page, 1, 0.37);
  const p = await page.evaluate(() => window.__flock!.state.acts[1]);
  expect([0, 0.25, 0.5, 0.75, 1]).toContain(p);
  await ctx.close();
});

test("phones get the stills stepper and never load the 3D engine", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await page.waitForSelector("#stepper .st-screen h2");
  await expect(page.locator("#stepper h2")).toContainText("Anatomy of a Flock camera");
  await page.locator("#st-next").click();
  await expect(page.locator("#stepper h2")).toContainText("Flock Safety products");
  await page.locator(".st-chapters button", { hasText: "Inside" }).click();
  await expect(page.locator(".st-count")).toContainText("1 / 20");
  await expect(page.locator(".st-figure img")).toHaveAttribute("src", /stills\/explode-0\.webp$/);
  // deep link into a part
  await page.goto("/?s=inside/13");
  await expect(page.locator("#stepper h2")).toContainText("System on module");
  await page.screenshot({ path: "test-results/mobile-som.png" });
  // Claims, Economics and Sources are single scrolling articles
  await page.goto("/?s=myths/0");
  await expect(page.locator("#stepper .claim")).toHaveCount(21);
  await expect(page.locator(".st-dots i")).toHaveCount(0);
  await page.locator("#st-next").click();
  await expect(page.locator("#stepper h2")).toContainText("Pricing and cost structure");
  await expect(page.locator("#stepper .inset img")).toHaveAttribute("src", /pole-flock\.webp$/);
  await expect(page.locator("#stepper h3", { hasText: "Installation workforce" })).toBeVisible();
  // a citation chip opens the Sources page at the cited row
  await page.goto("/?s=myths/0");
  const mchip = page.locator("#stepper .cite a").first();
  const mhref = (await mchip.getAttribute("href"))!;
  await mchip.click();
  await expect(page.locator("#stepper h2")).toContainText("Sources");
  await expect(page.locator(mhref)).toHaveClass(/is-target/);
  await expect.poll(() => page.evaluate((h) => { const r = document.querySelector(h)!.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }, mhref)).toBe(true);
  expect(await page.evaluate(() => location.hash)).toMatch(/^#s=sources\/0/);
  await page.goto("/?s=sources/0");
  await expect(page.locator("#stepper .src-group")).toHaveCount(4);
  await expect(page.locator("#stepper .source").first()).toBeVisible();
  // a bibliography title opens the document in a new tab
  const [popup] = await Promise.all([ctx.waitForEvent("page"), page.locator("#stepper .src-link").first().click()]);
  expect(popup).toBeTruthy();
  await popup.close();
  expect(requests.filter((u) => /\.glb$|babylon/.test(u))).toEqual([]);
  await ctx.close();
});
