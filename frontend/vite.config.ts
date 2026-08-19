import react from "@vitejs/plugin-react";
import path from "node:path";
// defineConfig de vitest/config: mismo objeto que el de vite mas la clave `test`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // El CSS de Tailwind no aporta nada a los tests y ralentiza el arranque.
    css: false,
  },
});
