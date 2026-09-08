import { chromium } from "@playwright/test";
import fs from "node:fs";
// Viewport sweep of every page at five desktop sizes and three phones, measuring what a reader would notice:
// horizontal overflow, elements wider than the viewport, images that failed, clipped text, the header links with
// the current page marked, the pager, the Top button, and on the components page the record and the locator.
// Usage: node scripts/qa.mjs <outDir> [url]
const Q = process.argv[2] || "test-results/qa";
const URL = process.argv[3] || "http://127.0.0.1:4173";
fs.mkdirSync(Q, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-compositing"] });
const sizes = [[1024, 768, false], [1280, 720, false], [1440, 900, false], [1920, 1080, false], [2560, 1440, false], [360, 740, true], [390, 844, true], [430, 932, true]];
const pages = ["", "deployments", "components", "pole", "power", "data", "claims", "economics", "sources"];
const labels = { "": "Home", deployments: "Deployments", components: "Components", pole: "Pole", power: "Power", data: "Data", claims: "Claims", economics: "Economics", sources: "Sources" };
const findings = [];
const F = (vp, where, msg) => { findings.push(`${vp} ${where}: ${msg}`); console.log("F", `${vp} ${where}: ${msg}`); };
const pageChecks = () => {
  const out = {};
  out.hscroll = document.documentElement.scrollWidth > innerWidth + 1;
  out.wide = [...document.querySelectorAll("main *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !e.closest(".tablewrap") && !e.closest(".sections"); }).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}`);
  out.imgs = [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && !i.hidden && i.offsetParent !== null).map((i) => i.src.split("/").pop());
  out.clipped = [...document.querySelectorAll(".cell .t, .group-head h3, .card h3, .stage-body h3, .sections a, .kv dt, .page-head h1, .summary-card .t")].filter((e) => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== "ellipsis").slice(0, 5).map((e) => `${e.className || e.tagName} "${e.textContent.trim().slice(0, 30)}"`);
  out.links = document.querySelectorAll(".sections a").length;
  out.first = document.querySelector(".sections a")?.textContent;
  out.active = document.querySelector(".sections a.is-active")?.textContent;
  out.current = document.querySelector(".sections a[aria-current=page]")?.textContent;
  const tb = document.querySelector(".topbar").getBoundingClientRect();
  out.allChipsInView = [...document.querySelectorAll(".sections a")].every((a) => { const r = a.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= tb.top - 1 && r.bottom <= tb.bottom + 1; });
  const h1 = document.querySelector(".page-head h1, .hero h1");
  out.h1UnderHeader = !!h1 && scrollY === 0 && h1.getBoundingClientRect().top < tb.bottom;
  out.pager = document.getElementById("pager") ? document.querySelectorAll("#pager a").length : -1;
  out.height = document.documentElement.scrollHeight;
  out.mode = window.__flock.state.mode;
  out.totopAtTop = !document.getElementById("totop").hidden;
  return out;
};
for (const [w, h, phone] of sizes) {
  const vp = `${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const settle = async () => { await page.waitForFunction(() => window.__flock.state.tweening !== true, null, { timeout: 8000 }).catch(() => F(vp, "", "tween never settled")); await page.waitForTimeout(500); };
  for (const id of pages) {
    const name = id || "home";
    await page.goto(`${URL}/${id ? id + "/" : ""}${!phone && id === "components" ? "?gl" : ""}`, { waitUntil: "commit" });
    await page.waitForFunction(() => window.__flock?.state.ready, null, { timeout: 90000 }).catch(() => F(vp, name, "never ready"));
    await page.waitForTimeout(600);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
    const g = await page.evaluate(pageChecks);
    if (g.hscroll) F(vp, name, "horizontal scroll");
    if (g.wide.length) F(vp, name, "wider than the viewport: " + g.wide.join(", "));
    if (g.imgs.length) F(vp, name, "images failed: " + g.imgs.join(", "));
    if (g.clipped.length) F(vp, name, "clipped text: " + g.clipped.join(" | "));
    if (g.links !== 9 || g.first !== "Home") F(vp, name, `${g.links} header links, first "${g.first}"`);
    if (g.active !== labels[id] || g.current !== labels[id]) F(vp, name, `header marks "${g.active}" (aria-current "${g.current}")`);
    if (!g.allChipsInView) F(vp, name, "a header link is outside the header or the viewport");
    if (g.h1UnderHeader) F(vp, name, "the page title sits under the fixed header");
    if (id && g.pager < 2) F(vp, name, `pager has ${g.pager} links`);
    if (!id && g.height > 2700) F(vp, name, `home is ${g.height} px tall`);
    if (g.totopAtTop) F(vp, name, "Top button shown at the top");
    if (!phone && id === "components" && g.mode !== "3d") F(vp, name, "no 3D on desktop");
    await page.screenshot({ path: `${Q}/${vp}-${name}.png` });
    if (id) {
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      const b = await page.evaluate(() => ({ totop: !document.getElementById("totop").hidden, tall: document.documentElement.scrollHeight > innerHeight + 500, pagerVisible: (() => { const r = document.getElementById("pager").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; })() }));
      if (!b.totop && b.tall) F(vp, name, "Top button hidden at the bottom");
      if (!b.pagerVisible) F(vp, name, "pager not visible at the bottom");
      await page.screenshot({ path: `${Q}/${vp}-${name}-bottom.png` });
    }
    if (id === "components") {
      await page.evaluate(() => scrollTo(0, 0));
      const k = await page.evaluate(() => ({ cells: document.querySelectorAll("#knolling .cell").length, groups: [...document.querySelectorAll("#knolling .group-head h3")].map((e) => e.textContent).join(",") }));
      if (k.cells !== 14) F(vp, name, `${k.cells} cells`);
      if (k.groups !== "Shell,Optics,Compute,Radios,Mount") F(vp, name, "groups: " + k.groups);
      await page.locator(".cell[data-part=emmc]").click({ timeout: 5000 }).catch((e) => F(vp, name, "cell not clickable: " + e.message.split("\n")[0]));
      await page.waitForTimeout(400);
      await settle();
      const d = await page.evaluate(() => {
        const det = document.getElementById("part-detail"); if (!det) return { missing: true };
        const r = det.getBoundingClientRect();
        return { group: det.closest(".group")?.dataset.group, onScreen: r.top >= 40 && (r.bottom <= innerHeight + 1 || r.height > innerHeight * 0.6), overflow: det.scrollWidth > det.clientWidth + 1, hash: location.hash };
      });
      if (d.missing) F(vp, name, "record did not open");
      else { if (d.group !== "compute") F(vp, name, `record under ${d.group}`); if (!d.onScreen) F(vp, name, "record not on screen after opening"); if (d.overflow) F(vp, name, "record overflows"); if (d.hash !== "#emmc") F(vp, name, `hash ${d.hash} after selecting`); }
      await page.screenshot({ path: `${Q}/${vp}-components-detail.png` });
      if (!phone) {
        await page.evaluate(() => window.__flock.set({ explodeStage: 5, focusedPart: null }));
        await settle();
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${Q}/${vp}-components-exploded.png` });
      }
    }
  }
  // Keyboard: Tab reaches the header links with a visible focus
  await page.goto(`${URL}/`, { waitUntil: "commit" });
  await page.waitForFunction(() => window.__flock?.state.ready, null, { timeout: 90000 });
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { tag: e.tagName, txt: e.textContent.trim().slice(0, 20), outline: cs.outlineStyle, shadow: cs.boxShadow }; });
  if (focused.outline === "none" && focused.shadow === "none") F(vp, "a11y", `no visible focus on ${focused.tag} "${focused.txt}"`);
  if (errs.length) F(vp, "console", errs.slice(0, 3).join(" | "));
  await page.close();
}
await browser.close();
console.log("FINDINGS " + findings.length + "\n" + findings.join("\n"));
process.exitCode = findings.length ? 1 : 0;
