import { defineConfig } from "vite";
import { resolve } from "node:path";

const pages = ["deployments", "components", "pole", "power", "data", "claims", "economics", "sources"];

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: Object.fromEntries([["main", resolve(__dirname, "index.html")], ...pages.map((p) => [p, resolve(__dirname, `${p}/index.html`)])]),
    },
  },
  server: { host: "127.0.0.1", port: 5173 },
});
