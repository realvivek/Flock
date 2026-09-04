/** HEAD/GET every source URL and report non-2xx/3xx responses. Network-dependent; not part of the build. */
import { readFileSync } from "node:fs";
const { sources } = JSON.parse(readFileSync(new URL("../src/content/sources.json", import.meta.url), "utf8")) as { sources: { id: string; url: string }[] };
const bad: string[] = [];
const ua = "Mozilla/5.0 (compatible; flock-anatomy link check)";
await Promise.all(sources.map(async (s) => {
  try {
    let r = await fetch(s.url, { method: "HEAD", redirect: "follow", headers: { "user-agent": ua } });
    if (r.status === 405 || r.status === 403 || r.status === 404) r = await fetch(s.url, { method: "GET", redirect: "follow", headers: { "user-agent": ua } });
    if (!r.ok) bad.push(`${s.id}: HTTP ${r.status} ${s.url}`);
  } catch (e) { bad.push(`${s.id}: ${(e as Error).message} ${s.url}`); }
}));
if (bad.length) { console.log(`check:links: ${bad.length} of ${sources.length} need attention\n` + bad.map((b) => `  - ${b}`).join("\n")); process.exit(2); }
console.log(`check:links OK: ${sources.length} URLs reachable`);
