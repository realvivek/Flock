import { chromium } from "@playwright/test";
const out = process.argv[2] || "test-results";
const url = process.argv[3] || "http://127.0.0.1:4173/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-compositing"] });
const [vw, vh] = (process.env.SHOT_VIEWPORT || "1440x900").split("x").map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh }, isMobile: vw < 800, hasTouch: vw < 800 });
const waitFrames = async (n) => { const f0 = await page.evaluate(() => window.__flock.frame); await page.waitForFunction(({ f0, n }) => window.__flock.frame >= f0 + n, { f0, n }, { timeout: 20000 }).catch(() => {}); };
const logs = [];
page.on("console", m => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", e => logs.push(`[pageerror] ${e.message}`));
page.on("response", r => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__flock && window.__flock.state.ready, null, { timeout: 60000 }).catch(() => logs.push("[timeout] not ready"));
await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
const status = await page.textContent("#status");
// Stops are either page fractions ("0.3") or act-relative ("3:0.5" = act 3 at half its progress).
const stops = (process.argv[4] || "0:0,1:0.5,2:0.5,3:0.5,4:0.5,5:0.2,6:0.2").split(",");
const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
for (const s of stops) {
  const y = await page.evaluate(({ s, total }) => {
    if (s.includes(":")) {
      const [a, p] = s.split(":").map(Number);
      const sec = document.querySelectorAll("section.act")[a];
      return Math.round(sec.offsetTop + (sec.offsetHeight - innerHeight) * p);
    }
    return Math.round(total * Number(s));
  }, { s, total });
  await page.evaluate(y => window.scrollTo({ top: y, behavior: "instant" }), y);
  await page.waitForFunction(y => Math.abs(scrollY - y) < 2, y, { timeout: 5000 }).catch(() => {});
  if (process.env.SHOT_EVAL) await page.evaluate(process.env.SHOT_EVAL);
  await waitFrames(Number(process.env.SHOT_FRAMES || 12));
  const st = await page.evaluate(() => ({ act: window.__flock.state.act, p: window.__flock.state.progress.toFixed(3), fp: window.__flock.state.focusedPart }));
  await page.screenshot({ path: `${out}/shot-${String(s).replace(/[.:]/g, "_")}.png` });
  console.log("stop", s, JSON.stringify(st));
}
console.log("status:", status);
console.log(logs.filter(l => !l.includes("[debug]")).slice(0, 40).join("\n"));
await browser.close();
