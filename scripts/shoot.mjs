import { chromium } from "@playwright/test";
// Usage: node scripts/shoot.mjs <outDir> <url> <stops>
// Stops are routes with an optional state suffix: "overview", "hardware/pole", "hardware/inside:5" (explode stage),
// "hardware/inside:cut" (cutaway), "data:10" (data stage), "claims", "economics", "sources".
const out = process.argv[2] || "test-results";
const url = process.argv[3] || "http://127.0.0.1:4173/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-compositing"] });
const [vw, vh] = (process.env.SHOT_VIEWPORT || "1440x900").split("x").map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh }, isMobile: vw < 800, hasTouch: vw < 800 });
const waitFrames = async (n) => { const f0 = await page.evaluate(() => window.__flock.frame); await page.waitForFunction(({ f0, n }) => window.__flock.frame >= f0 + n, { f0, n }, { timeout: 20000 }).catch(() => {}); };
const settle = async () => { await page.waitForFunction(() => window.__flock.state.tweening !== true, null, { timeout: 8000 }).catch(() => {}); await waitFrames(Number(process.env.SHOT_FRAMES || 12)); };
const logs = [];
page.on("console", m => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", e => logs.push(`[pageerror] ${e.message}`));
page.on("response", r => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__flock && window.__flock.state.ready, null, { timeout: 60000 }).catch(() => logs.push("[timeout] not ready"));
const status = await page.textContent("#status");
const stops = (process.argv[4] || "overview,hardware/pole,hardware/inside:0,hardware/inside:5,hardware/power,data:10,claims,economics").split(",");
for (const s of stops) {
  const [route, arg] = s.split(":");
  await page.evaluate(({ route, arg }) => {
    const f = window.__flock;
    f.go(route);
    if (route.endsWith("inside")) { if (arg === "cut") f.set({ cutaway: true }); else if (arg !== undefined) f.set({ cutaway: false, explodeStage: Number(arg) }); }
    if (route === "data" && arg !== undefined) f.set({ dataStage: Number(arg) });
  }, { route, arg });
  if (process.env.SHOT_EVAL) await page.evaluate(process.env.SHOT_EVAL);
  await settle();
  const st = await page.evaluate(() => ({ tab: window.__flock.state.tab, sub: window.__flock.state.sub, act: window.__flock.state.act, stage: window.__flock.state.explodeStage, data: window.__flock.state.dataStage, fp: window.__flock.state.focusedPart }));
  await page.screenshot({ path: `${out}/shot-${s.replace(/[\/:]/g, "_")}.png` });
  console.log("stop", s, JSON.stringify(st));
}
console.log("status:", status);
console.log(logs.filter(l => !l.includes("[debug]")).slice(0, 40).join("\n"));
await browser.close();
