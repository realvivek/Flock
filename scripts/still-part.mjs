import { chromium } from "@playwright/test";
import fs from "node:fs";
// Renders one part's still for the parts grid from the site's own 3D model, alone on a transparent background and
// three-quarters on from above, where the Blender stills (tools/blender/render_stills.py) are not available or do not
// read: the lens, seen end on, is a black disc.
// Usage: npm run build && npm run preview &  then  node scripts/still-part.mjs <part id> [url]
//   writes public/stills/part-<id>.webp (1000 × 800)
const id = process.argv[2];
if (!id) { console.error("usage: node scripts/still-part.mjs <part id> [url]"); process.exit(1); }
const url = process.argv[3] || "http://127.0.0.1:4173/components/";
const out = `public/stills/part-${id}.webp`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("page error:", e.message));
// "commit" rather than "load": a slow request elsewhere must not hold the render
await page.goto(`${url}?gl&mode=3d&still=${encodeURIComponent(id)}`, { waitUntil: "commit", timeout: 60000 });
await page.waitForFunction(() => typeof window.__still === "string", null, { timeout: 120000 });
const data = await page.evaluate(() => window.__still);
if (!data.startsWith("data:image/webp;base64,")) throw new Error(`not a WebP: ${data.slice(0, 30)}`);
fs.writeFileSync(out, Buffer.from(data.split(",")[1], "base64"));
console.log("wrote", out, fs.statSync(out).size, "bytes");
await browser.close();
