import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        components: resolve(__dirname, "components/index.html"),
      },
    },
  },
  server: { host: "127.0.0.1", port: 5173 },
});
