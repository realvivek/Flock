import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";
import { renderHome, STORY_FILES } from "./scripts/story/input.ts";

const pages = ["deployments", "components", "data", "journey", "outcomes", "claims", "economics", "sources"];
const ROOT = import.meta.dirname;

/** Writes the home page story into index.html in place of <!--story-->, so it reads without JavaScript. In dev the
 *  page reloads when the story's content or data changes. */
function storyPage(): Plugin {
  return {
    name: "flock:story",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        if (!html.includes("<!--story-->")) return html;
        return html.replace("<!--story-->", () => renderHome(ROOT).html);
      },
    },
    configureServer(server) {
      const files = STORY_FILES.map((f) => resolve(ROOT, f));
      server.watcher.add(files);
      server.watcher.on("change", (f) => { if (files.includes(f)) server.ws.send({ type: "full-reload" }); });
    },
  };
}

/** Preload the two text fonts (serif and sans, Latin subset) on every page, so text paints in its own face. */
function fontPreload(): Plugin {
  const want = [/newsreader-latin-wght-normal-[\w-]+\.woff2$/, /libre-franklin-latin-wght-normal-[\w-]+\.woff2$/];
  return {
    name: "flock:font-preload",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const files = Object.keys(ctx.bundle).filter((f) => want.some((re) => re.test(f)));
        if (files.length !== want.length) this.warn(`font preload: found ${files.join(", ") || "no fonts"}`);
        const depth = ctx.path.replace(/^\//, "").split("/").length - 1;
        const prefix = depth ? "../".repeat(depth) : "./";
        return { html, tags: files.map((f) => ({ tag: "link", attrs: { rel: "preload", as: "font", type: "font/woff2", crossorigin: "", href: prefix + f }, injectTo: "head-prepend" as const })) };
      },
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [storyPage(), fontPreload()],
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: Object.fromEntries([["main", resolve(ROOT, "index.html")], ...pages.map((p) => [p, resolve(ROOT, `${p}/index.html`)])]),
    },
  },
  server: { host: "127.0.0.1", port: 5173 },
});
