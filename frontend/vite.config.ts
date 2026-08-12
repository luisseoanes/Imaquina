import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // El Content Studio va en bundle aparte: los estudiantes son el 95%
        // del trafico y no deben descargar el editor (ARQUITECTURA.md 6).
        manualChunks(id) {
          if (id.includes("/features/studio/")) return "studio";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
});
