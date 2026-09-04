import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@babylonjs/core")) return "babylon";
          if (id.includes("@babylonjs/loaders")) return "babylon-loaders";
          if (id.includes("gsap")) return "gsap";
          return undefined;
        },
      },
    },
  },
  server: { host: "127.0.0.1", port: 5173 },
});
