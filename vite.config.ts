import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
  },
  server: { host: "127.0.0.1", port: 5173 },
});
