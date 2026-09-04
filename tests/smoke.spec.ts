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
  expect(requests.filter((u) => /\.glb$|babylon/.test(u))).toEqual([]);
  await ctx.close();
});
