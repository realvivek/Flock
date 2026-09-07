import { chromium } from "@playwright/test";
// Viewport sweep: every tab at five desktop sizes and three phones, measuring what a reader would notice:
// content cut off without a scroll container, markers off screen or under a panel, leader crossings,
// unusable hit targets, and phone deck bars below the fold. Usage: node scripts/qa.mjs <outDir> [url]
const Q = process.argv[2] || "test-results/qa";
const URL = process.argv[3] || "http://127.0.0.1:4173";
import fs from "node:fs"; fs.mkdirSync(Q, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-compositing"] });
const sizes = [[1024,768],[1280,720],[1440,900],[1920,1080],[2560,1440]];
const routes = ["overview","deployments","hardware/pole","hardware/inside:0","hardware/inside:5","hardware/power","data:10","claims","economics","sources"];
const PHONE_ROUTES = ["overview","deployments","pole","pole/3","inside","inside/5","inside/13","power","power/2","data","data/9","claims","economics","sources"];
const findings = [];
const F = (vp, route, msg) => { findings.push(`${vp} ${route}: ${msg}`); console.log("F", `${vp} ${route}: ${msg}`); };
for (const [w,h] of sizes) {
  const vp = `${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  page.on("console", m => { if (m.type()==="error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(`${URL}/?gl`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__flock?.state.ready, null, { timeout: 90000 });
  const settle = async () => { await page.waitForFunction(() => window.__flock.state.tweening !== true, null, { timeout: 8000 }).catch(()=>F(vp,"","tween never settled")); const f0 = await page.evaluate(()=>window.__flock.frame); await page.waitForFunction(f=>window.__flock.frame>=f+15,f0,{timeout:20000}).catch(()=>{}); };
  for (const r of routes) {
    const [route, arg] = r.split(":");
    await page.evaluate(({route,arg}) => { window.__flock.go(route); if (arg!==undefined && route.endsWith("inside")) window.__flock.set({explodeStage:Number(arg)}); if (arg!==undefined && route==="data") window.__flock.set({dataStage:Number(arg)}); }, {route,arg});
    await settle();
    const m = await page.evaluate(() => {
      const out = {};
      out.pageScroll = document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1;
      const vis = el => { const r = el.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(el).visibility!=="hidden" && el.offsetParent!==null; };
      const view = document.querySelector("section.view:not([hidden])");
      out.view = view?.id;
      out.overflow = [];
      for (const el of view.querySelectorAll(".callout, .inside-strip, .splash, .stage-box, .spec-card, .toggle-row, .aim-box, .contents a")) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.left < -1 || r.top < 47) out.overflow.push(`${el.className.split(" ")[0]}#${el.id||""} ${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      out.scrollers = [];
      for (const el of view.querySelectorAll(".callout-col, .splash")) { if (vis(el) && el.scrollHeight > el.clientHeight + 2) out.scrollers.push(`${el.className.split(" ")[0]}#${el.id||""} ${el.clientHeight}/${el.scrollHeight}`); }
      const sb = view.querySelector("#view-data .stage-box"); if (sb && vis(sb)) { const r = sb.getBoundingClientRect(); out.stageBoxOff = r.top < 48 || r.bottom > innerHeight; }
      out.clipped = [];
      for (const el of view.querySelectorAll(".callout .t, .callout .n, h2, .chip, .tabs a, .subtabs a, .aim-readout, .hops li b, .hops li .title")) { if (vis(el) && (el.scrollWidth > el.clientWidth + 1)) out.clipped.push(`${el.className||el.tagName} "${el.textContent.trim().slice(0,30)}"`); }
      const badges = [...document.querySelectorAll("#pins .pin.badge.is-visible")].map(b=>{const r=b.getBoundingClientRect();return {id:b.title||b.textContent,x:r.left+r.width/2,y:r.top+r.height/2};});
      out.badges = badges.length;
      out.badgesOff = badges.filter(b=>b.x<0||b.x>innerWidth||b.y<48||b.y>innerHeight).length;
      const L = document.getElementById("callouts-left"), R = document.getElementById("callouts-right");
      if (L && vis(L)) { const l = L.getBoundingClientRect().right, rr = R.getBoundingClientRect().left; out.badgesInCols = badges.filter(b=>b.x<l||b.x>rr).length; }
      out.badgeOverlap = 0; for (let i=0;i<badges.length;i++) for (let j=i+1;j<badges.length;j++) if (Math.hypot(badges[i].x-badges[j].x,badges[i].y-badges[j].y)<10) out.badgeOverlap++;
      const segs = [...document.querySelectorAll("#leaders .leader")].filter(p=>p.getAttribute("opacity")!=="0" && p.getAttribute("points")).map(p=>p.getAttribute("points").split(" ").map(s=>s.split(",").map(Number))).map(pts=>[pts[1],pts[2]]);
      const cross = (a,b,c,d) => { const ccw=(p,q,r)=>(r[1]-p[1])*(q[0]-p[0])>(q[1]-p[1])*(r[0]-p[0]); return ccw(a,c,d)!==ccw(b,c,d)&&ccw(a,b,c)!==ccw(a,b,d); };
      out.leaders = segs.length; out.crossings = 0;
      for (let i=0;i<segs.length;i++) for (let j=i+1;j<segs.length;j++) if (cross(segs[i][0],segs[i][1],segs[j][0],segs[j][1])) out.crossings++;
      const pins = [...document.querySelectorAll("#pins .pin:not(.badge).is-visible")].map(p=>p.getBoundingClientRect());
      out.pins = pins.length; out.pinsOff = pins.filter(r=>r.left<0||r.right>innerWidth||r.top<48||r.bottom>innerHeight).length;
      out.pinOverlap = 0; for (let i=0;i<pins.length;i++) for (let j=i+1;j<pins.length;j++){const a=pins[i],b=pins[j]; if (a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom) out.pinOverlap++;}
      const covers = [...view.querySelectorAll(".panel, .callout-col, .inside-strip, .splash")].filter(vis).map(e=>e.getBoundingClientRect());
      out.pinsUnderPanel = [...pins, ...badges.map(b=>({left:b.x-10,right:b.x+10,top:b.y-10,bottom:b.y+10}))].filter(r=>covers.some(c=>r.left<c.right&&c.left<r.right&&r.top<c.bottom&&c.top<r.bottom)).length;
      out.hash = location.hash;
      return out;
    });
    await page.screenshot({ path: `${Q}/${vp}-${r.replace(/[\/:]/g,"_")}.png` });
    if (m.pageScroll) F(vp,r,"page scrolls");
    if (m.overflow.length) F(vp,r,"overflow: "+m.overflow.join(" | "));
    if (m.scrollers.length) F(vp,r,"content cut off, container scrolls: "+m.scrollers.join(" | "));
    if (m.stageBoxOff) F(vp,r,"data stage box out of view");
    if (m.clipped.length) F(vp,r,"clipped: "+m.clipped.join(" | "));
    if (m.badgesOff) F(vp,r,`${m.badgesOff}/${m.badges} badges off screen`);
    if (m.badgesInCols) F(vp,r,`${m.badgesInCols}/${m.badges} badges under card columns`);
    if (m.badgeOverlap) F(vp,r,`${m.badgeOverlap} badge overlaps`);
    if (m.crossings) F(vp,r,`${m.crossings} leader crossings of ${m.leaders}`);
    if (m.pinsOff) F(vp,r,`${m.pinsOff}/${m.pins} labels off screen`);
    if (m.pinOverlap) F(vp,r,`${m.pinOverlap} label overlaps`);
    if (m.pinsUnderPanel) F(vp,r,`${m.pinsUnderPanel} labels/badges under a panel`);
    if (route.endsWith("inside") && m.badges !== 14) F(vp,r,`${m.badges} badges visible, expected 14`);
  }
  await page.evaluate(()=>{window.__flock.go("hardware/inside"); window.__flock.set({explodeStage:5});}); await settle();
  const card = page.locator(".callout", { hasText: "Storage" });
  await card.hover(); await page.waitForTimeout(300);
  const hov = await page.evaluate(()=>({tip: !document.querySelector(".pin-tip").hidden, tipText: document.querySelector(".pin-tip").textContent, hl: document.querySelectorAll("#pins .pin.badge.is-hl").length, dimmed: [...document.querySelectorAll("#leaders .leader")].filter(l=>l.getAttribute("opacity")==="0.25").length}));
  if (!hov.tip || hov.hl!==1) F(vp,"inside hover",`tooltip ${hov.tip} "${hov.tipText}" highlighted ${hov.hl} dimmed ${hov.dimmed}`);
  await page.screenshot({ path: `${Q}/${vp}-inside-hover.png` });
  await card.click(); await settle();
  const iso = await page.evaluate(()=>{const c=document.getElementById("spec-card"); const r=c.getBoundingClientRect(); const cols=[...document.querySelectorAll(".callout-col")].map(e=>e.getBoundingClientRect()); const strip=document.querySelector(".inside-strip").getBoundingClientRect(); const overl = cols.some(k=>r.left<k.right&&k.left<r.right&&r.top<k.bottom&&k.top<r.bottom) || (r.top<strip.bottom && r.left<strip.right && r.right>strip.left); return {hidden:c.hidden, top:r.top, bottom:r.bottom, right:r.right, left:r.left, overl, off:r.bottom>innerHeight||r.right>innerWidth, badges:document.querySelectorAll("#pins .pin.badge.is-visible").length, leaders:[...document.querySelectorAll("#leaders .leader")].filter(l=>l.getAttribute("opacity")!=="0").length, hash:location.hash, scrollH: c.scrollHeight, clientH: c.clientHeight};});
  if (iso.hidden) F(vp,"inside isolate","spec card hidden after click");
  if (iso.overl) F(vp,"inside isolate",`spec card overlaps cards/strip (l${Math.round(iso.left)} t${Math.round(iso.top)} r${Math.round(iso.right)} b${Math.round(iso.bottom)})`);
  if (iso.off) F(vp,"inside isolate",`spec card off screen (b${Math.round(iso.bottom)} r${Math.round(iso.right)})`);
  if (iso.scrollH > iso.clientH+2) F(vp,"inside isolate",`spec card content clipped ${iso.clientH}/${iso.scrollH}`);
  if (iso.badges!==1 || iso.leaders!==1) F(vp,"inside isolate",`badges ${iso.badges} leaders ${iso.leaders} while isolated`);
  await page.screenshot({ path: `${Q}/${vp}-inside-isolated.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  if (!(await page.evaluate(()=>document.getElementById("spec-card").hidden))) F(vp,"inside","Escape did not close the spec card");
  await page.locator("#pins .pin.badge.is-visible").first().click({ timeout: 3000 }).catch(e=>F(vp,"inside","badge not clickable: "+e.message.split("\n")[0]));
  await page.waitForTimeout(300);
  if (await page.evaluate(()=>document.getElementById("spec-card").hidden)) F(vp,"inside","clicking a badge did not open the spec card");
  await page.keyboard.press("Escape");
  await page.evaluate(()=>window.__flock.set({explodeStage:2})); await settle();
  await page.locator("body").press("ArrowRight").catch(()=>{}); await page.waitForTimeout(200);
  const st = await page.evaluate(()=>window.__flock.state.explodeStage); if (st!==3) F(vp,"inside",`ArrowRight moved stage to ${st}, expected 3`);
  await page.evaluate(()=>window.__flock.go("data")); await settle(); await page.goBack(); await page.waitForTimeout(400);
  const back = await page.evaluate(()=>({tab:window.__flock.state.tab, sub:window.__flock.state.sub, hash:location.hash}));
  if (back.tab!=="hardware"||back.sub!=="inside") F(vp,"back",`Back gave ${JSON.stringify(back)}`);
  await page.evaluate(()=>window.__flock.go("overview")); await settle();
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  const focused = await page.evaluate(()=>{const e=document.activeElement; const cs=getComputedStyle(e); return {tag:e.tagName, txt:e.textContent.trim().slice(0,20), outline: cs.outlineStyle, ow: cs.outlineWidth, shadow: cs.boxShadow};});
  if (focused.outline==="none" && focused.shadow==="none") F(vp,"a11y",`no visible focus on ${focused.tag} "${focused.txt}"`);
  if (errs.length) F(vp,"console",errs.slice(0,3).join(" | "));
  await page.close();
}
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${URL}/?gl#/hardware/inside/5`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__flock?.state.ready, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.setViewportSize({ width: 1100, height: 700 }); await page.waitForTimeout(2500);
  const m = await page.evaluate(()=>{const b=[...document.querySelectorAll("#pins .pin.badge.is-visible")].map(e=>e.getBoundingClientRect()); const L=document.getElementById("callouts-left").getBoundingClientRect().right, R=document.getElementById("callouts-right").getBoundingClientRect().left; return {n:b.length, under:b.filter(r=>r.left<L||r.right>R).length, off:b.filter(r=>r.bottom>innerHeight||r.top<48).length, band:[Math.round(L),Math.round(R)]};});
  if (m.under||m.off) F("resize 1920→1100","inside",`badges under columns ${m.under}, off ${m.off}, band ${m.band}`);
  await page.screenshot({ path: `${Q}/resize-1100x700-inside.png` });
  await page.close();
}
for (const [w,h] of [[390,844],[360,740],[430,932]]) {
  const vp = `${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(`${URL}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("#ch-overview h2");
  for (const ch of PHONE_ROUTES) {
    await page.evaluate(c=>window.__flock.go(c), ch); await page.waitForTimeout(400);
    const m = await page.evaluate(()=>{
      const out={}; out.hscroll = document.documentElement.scrollWidth > innerWidth+1;
      const vis = [...document.querySelectorAll(".st-chapter:not([hidden])")]; out.visible = vis.length; out.id = vis[0]?.id;
      out.wide = [...document.querySelectorAll(".st-chapter:not([hidden]) *")].filter(e=>{const r=e.getBoundingClientRect(); return r.right>innerWidth+1 && r.width>0 && getComputedStyle(e).overflowX!=="auto" && !e.closest(".tablewrap") && !e.closest(".st-chapters");}).slice(0,3).map(e=>e.className||e.tagName);
      const active=document.querySelector(".st-chapters button.is-active"); out.activeChip = active?.textContent; const ar=active?.getBoundingClientRect(); out.chipVisible = ar && ar.left>=0 && ar.right<=innerWidth;
      out.deckbar = document.querySelector(".st-chapter:not([hidden]) .st-deckbar")?.getBoundingClientRect().bottom;
      const fig = document.querySelector(".st-chapter:not([hidden]) .st-figure"); out.figBottom = fig?.getBoundingClientRect().bottom;
      out.scrollY = scrollY; out.hash = location.hash;
      const img = document.querySelector(".st-chapter:not([hidden]) .st-figure img"); out.imgOk = img ? img.complete && img.naturalWidth>0 : null;
      return out;
    });
    if (m.visible!==1) F(vp,ch,`${m.visible} chapters visible`);
    if (m.hscroll) F(vp,ch,"horizontal page scroll");
    if (m.wide.length) F(vp,ch,"wider than viewport: "+m.wide.join(", "));
    if (!m.chipVisible) F(vp,ch,`active chip "${m.activeChip}" not in view`);
    if (m.scrollY>0 && ch.indexOf("/")<0) F(vp,ch,`not scrolled to top (${m.scrollY})`);
    if (m.imgOk===false) F(vp,ch,"figure image failed to load");
    if (m.deckbar && m.deckbar > h + 1) F(vp,ch,`deck bar below the fold (${Math.round(m.deckbar)} > ${h})`);
    if (m.figBottom && m.figBottom > h) F(vp,ch,`figure below the fold`);
    await page.screenshot({ path: `${Q}/phone-${vp}-${ch.replace(/\//g,"_")}.png` });
  }
  await page.evaluate(()=>window.__flock.go("inside/0")); await page.waitForTimeout(300);
  await page.locator("#ch-inside .st-next").click(); await page.waitForTimeout(200);
  const cnt = await page.textContent("#ch-inside .st-barcount"); if (!cnt.includes("2 /")) F(vp,"inside","Next did not step: "+cnt);
  if (errs.length) F(vp,"console",errs.slice(0,3).join(" | "));
  await page.close();
}
await browser.close();
console.log("FINDINGS " + findings.length + "\n" + findings.join("\n"));
process.exitCode = findings.length ? 1 : 0;
