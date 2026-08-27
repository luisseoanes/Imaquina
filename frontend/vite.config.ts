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
    // En Docker el backend no vive en localhost sino en el servicio `api`
    // de la red de compose (ver docker-compose.yml). Fuera de Docker, sin
    // la variable, se comporta exactamente igual que antes.
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // El CSS de Tailwind no aporta nada a los tests y ralentiza el arranque.
    css: false,
  },
});
