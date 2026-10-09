import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/** The reference pages' heads are written into the HTML at build time from src/content/pages.json: each must read
 *  without JavaScript, with its share tags, and every page keeps its headings in order. */
const PAGES = ["deployments", "components", "data", "journey", "outcomes", "claims", "economics", "sources"];
const heads = JSON.parse(readFileSync(new URL("../src/content/pages.json", import.meta.url), "utf8")).pages as Record<string, { lead?: string }>;
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __flock?: { state: { ready: boolean } } }).__flock?.state.ready === true, null, { timeout: 90_000 });

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("each reference page opens with its headline, deck, date and opening figure", async ({ page }) => {
    for (const id of PAGES) {
      await page.goto(`/${id}/`, { waitUntil: "commit" });
      const h1 = page.locator(".page-head h1");
      await expect(h1, id).toHaveCount(1);
      const title = (await h1.textContent())!.trim();
      expect(title, id).not.toMatch(/\{\{|\}\}/);
      expect(title.length, id).toBeGreaterThan(20);
      expect(await page.title(), id).toBe(`${title} · Anatomy of a Flock Camera`);
      await expect(page.locator('meta[property="og:title"]'), id).toHaveAttribute("content", title);
      // the deck keeps month and day together with a no-break space; the share text need not
      const deck = (await page.locator(".page-head .deck").textContent())!.replace(/\u00a0/g, " ").trim();
      expect(deck.length, id).toBeGreaterThan(60);
      expect(await page.locator('meta[name="description"]').getAttribute("content"), id).toBe(deck);
      await expect(page.locator(".page-head .dateline time"), id).toHaveText(/^Updated (Jan\.|Feb\.|March|April|May|June|July|Aug\.|Sept\.|Oct\.|Nov\.|Dec\.) \d{1,2}, \d{4}$/);
      if (heads[id]!.lead) await expect(page.locator(".page-lead .fig .fig-title"), id).toHaveCount(1);
    }
  });
});

test("every page keeps one h1 and never skips a heading level", async ({ page }) => {
  for (const id of ["", ...PAGES]) {
    await page.goto(`/${id ? `${id}/` : ""}${id === "outcomes" ? "?map=off" : ""}`, { waitUntil: "commit" });
    await ready(page);
    const levels = await page.evaluate(() => [...document.querySelectorAll("main h1, main h2, main h3, main h4, main h5, main h6")].map((h) => ({ l: Number(h.tagName[1]), t: h.textContent!.trim().slice(0, 40) })));
    expect(levels.filter((h) => h.l === 1).length, id || "home").toBe(1);
    const skips = levels.flatMap((h, k) => (k > 0 && h.l > levels[k - 1]!.l + 1 ? [`${levels[k - 1]!.l}→${h.l} "${h.t}"`] : []));
    expect(skips, id || "home").toEqual([]);
  }
});
