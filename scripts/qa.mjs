import { chromium } from "@playwright/test";
import fs from "node:fs";
// Viewport sweep of the document at five desktop sizes and three phones, measuring what a reader would notice:
// horizontal overflow, elements wider than the viewport, images that failed, clipped text, the section links
// and the Top button, the component record opening under its group, and the locator.
// Usage: node scripts/qa.mjs <outDir> [url]
const Q = process.argv[2] || "test-results/qa";
const URL = process.argv[3] || "http://127.0.0.1:4173";
fs.mkdirSync(Q, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-compositing"] });
const sizes = [[1024, 768, false], [1280, 720, false], [1440, 900, false], [1920, 1080, false], [2560, 1440, false], [360, 740, true], [390, 844, true], [430, 932, true]];
const sections = ["top", "deployments", "components", "pole", "power", "data", "claims", "economics", "sources"];
const findings = [];
const F = (vp, where, msg) => { findings.push(`${vp} ${where}: ${msg}`); console.log("F", `${vp} ${where}: ${msg}`); };
for (const [w, h, phone] of sizes) {
  const vp = `${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(`${URL}/${phone ? "" : "?gl"}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__flock?.state.ready, null, { timeout: 90000 });
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  const settle = async () => { await page.waitForFunction(() => window.__flock.state.tweening !== true, null, { timeout: 8000 }).catch(() => F(vp, "", "tween never settled")); await page.waitForTimeout(500); };
  // Whole-page checks
  const g = await page.evaluate(() => {
    const out = {};
    out.hscroll = document.documentElement.scrollWidth > innerWidth + 1;
    out.wide = [...document.querySelectorAll("main *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !e.closest(".tablewrap") && !e.closest(".sections"); }).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}`);
    out.imgs = [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && !i.hidden && i.offsetParent !== null).map((i) => i.src.split("/").pop());
    out.clipped = [...document.querySelectorAll(".cell .t, .group-head h3, .card h3, .stage-body h3, .sections a, .kv dt")].filter((e) => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== "ellipsis").slice(0, 5).map((e) => `${e.className || e.tagName} "${e.textContent.trim().slice(0, 30)}"`);
    out.links = document.querySelectorAll(".sections a").length;
    out.cells = document.querySelectorAll("#knolling .cell").length;
    out.groups = [...document.querySelectorAll("#knolling .group-head h3")].map((e) => e.textContent);
    out.mode = window.__flock.state.mode;
    return out;
  });
  if (g.hscroll) F(vp, "page", "horizontal scroll");
  if (g.wide.length) F(vp, "page", "wider than the viewport: " + g.wide.join(", "));
  if (g.imgs.length) F(vp, "page", "images failed: " + g.imgs.join(", "));
  if (g.clipped.length) F(vp, "page", "clipped text: " + g.clipped.join(" | "));
  if (g.links !== 8) F(vp, "nav", `${g.links} section links`);
  if (g.cells !== 14) F(vp, "components", `${g.cells} cells`);
  if (g.groups.join() !== "Shell,Optics,Compute,Radios,Mount") F(vp, "components", "groups: " + g.groups.join(","));
  if (!phone && g.mode !== "3d") F(vp, "locator", "no 3D on desktop");
  // Section by section: the section link marks the current section, the heading is visible
  for (const id of sections) {
    await page.evaluate((id) => { if (id === "top") scrollTo(0, 0); else document.getElementById(id).scrollIntoView({ block: "start" }); }, id);
    await page.waitForTimeout(350);
    const m = await page.evaluate((id) => {
      const out = {};
      const active = document.querySelector(".sections a.is-active");
      out.active = active ? active.getAttribute("href").slice(1) : "";
      if (id !== "top") { const hd = document.querySelector(`#${id} h2`); const r = hd.getBoundingClientRect(); out.headVisible = r.top >= 40 && r.bottom <= innerHeight; }
      out.totop = !document.getElementById("totop").hidden;
      const nav = document.querySelector(".sections"); const a = active; out.chipInView = !a || (a.getBoundingClientRect().left >= nav.getBoundingClientRect().left - 1 && a.getBoundingClientRect().right <= nav.getBoundingClientRect().right + 1);
      return out;
    }, id);
    if (id !== "top" && m.active !== id) F(vp, id, `section link marks "${m.active}"`);
    if (id !== "top" && !m.headVisible) F(vp, id, "heading not visible after the jump");
    if (id === "top" && m.totop) F(vp, id, "Top button shown at the top");
    if (id !== "top" && !m.totop) F(vp, id, "Top button hidden");
    if (!m.chipInView) F(vp, id, "active section link scrolled out of the rail");
    await page.screenshot({ path: `${Q}/${vp}-${id}.png` });
  }
  // Components: a record opens under the right group and is on screen; the locator frames it on desktop
  await page.evaluate(() => document.getElementById("components").scrollIntoView({ block: "start" }));
  await page.locator(".cell[data-part=emmc]").click({ timeout: 5000 }).catch((e) => F(vp, "components", "cell not clickable: " + e.message.split("\n")[0]));
  await page.waitForTimeout(400);
  await settle();
  const d = await page.evaluate(() => {
    const det = document.getElementById("part-detail"); if (!det) return { missing: true };
    const r = det.getBoundingClientRect();
    // A record taller than the viewport counts as on screen when its top is.
    return { group: det.closest(".group")?.dataset.group, onScreen: r.top >= 40 && (r.bottom <= innerHeight + 1 || r.height > innerHeight - 80), overflow: det.scrollWidth > det.clientWidth + 1, fp: window.__flock.state.focusedPart };
  });
  if (d.missing) F(vp, "components", "record did not open");
  else { if (d.group !== "compute") F(vp, "components", `record under ${d.group}`); if (!d.onScreen) F(vp, "components", "record not fully on screen after opening"); if (d.overflow) F(vp, "components", "record overflows"); }
  await page.screenshot({ path: `${Q}/${vp}-components-detail.png` });
  if (!phone) {
    await page.evaluate(() => window.__flock.set({ explodeStage: 5, focusedPart: null }));
    await settle();
    await page.evaluate(() => document.getElementById("components").scrollIntoView({ block: "start" }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${Q}/${vp}-components-exploded.png` });
    await page.evaluate(() => window.__flock.set({ explodeStage: 0 }));
  }
  await page.keyboard.press("Escape");
  // Keyboard: Tab reaches the section links and cells with a visible focus
  await page.evaluate(() => scrollTo(0, 0));
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { tag: e.tagName, txt: e.textContent.trim().slice(0, 20), outline: cs.outlineStyle, shadow: cs.boxShadow }; });
  if (focused.outline === "none" && focused.shadow === "none") F(vp, "a11y", `no visible focus on ${focused.tag} "${focused.txt}"`);
  if (errs.length) F(vp, "console", errs.slice(0, 3).join(" | "));
  await page.close();
}
await browser.close();
console.log("FINDINGS " + findings.length + "\n" + findings.join("\n"));
process.exitCode = findings.length ? 1 : 0;
