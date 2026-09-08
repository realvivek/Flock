import { chromium } from "@playwright/test";
// Usage: node scripts/shoot.mjs <outDir> <url> <stops>
// Stops are element ids on whichever page the url points at ("top", "summary", "stage-9", …), optionally with a
// state on the components page: "components:som" selects a part, "components:stage=5" sets the explode stage.
const out = process.argv[2] || "test-results";
const url = process.argv[3] || "http://127.0.0.1:4173/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-compositing"] });
const [vw, vh] = (process.env.SHOT_VIEWPORT || "1440x900").split("x").map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh }, isMobile: vw < 800, hasTouch: vw < 800 });
const logs = [];
page.on("console", m => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", e => logs.push(`[pageerror] ${e.message}`));
page.on("response", r => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__flock && window.__flock.state.ready, null, { timeout: 60000 }).catch(() => logs.push("[timeout] not ready"));
await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
const settle = async () => { await page.waitForFunction(() => window.__flock.state.tweening !== true, null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(Number(process.env.SHOT_WAIT || 700)); };
const status = await page.textContent("#status");
const stops = (process.argv[4] || "top,deployments,components,pole,power,data,claims,economics,sources").split(",");
for (const s of stops) {
  const [id, arg] = s.split(":");
  await page.evaluate(({ id, arg }) => {
    const f = window.__flock;
    if (id === "components" && arg) { if (arg.startsWith("stage=")) f.set({ explodeStage: Number(arg.slice(6)) }); else f.set({ focusedPart: arg }); }
    const target = id === "data" && arg ? document.getElementById(`stage-${arg}`) : document.getElementById(id);
    if (id === "top") window.scrollTo({ top: 0, behavior: "instant" }); else target?.scrollIntoView({ behavior: "instant", block: "start" });
  }, { id, arg });
  if (process.env.SHOT_EVAL) await page.evaluate(process.env.SHOT_EVAL);
  await settle();
  await page.screenshot({ path: `${out}/shot-${s.replace(/[:=]/g, "_")}.png` });
  console.log("stop", s, JSON.stringify({ y: await page.evaluate(() => scrollY), fp: await page.evaluate(() => window.__flock.state.focusedPart) }));
}
console.log("status:", status);
console.log(logs.filter(l => !l.includes("[debug]")).slice(0, 40).join("\n"));
await browser.close();
