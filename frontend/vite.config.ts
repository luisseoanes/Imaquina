import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    // Un solo alias, a la raíz de `src`. Con varios (@features, @shared…) hay
    // que tocar tres sitios cada vez que se mueve una carpeta.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },

  server: {
    port: 5173,
    // El backend vive aparte y sirve todo bajo /api/v1. Con el proxy, el
    // cliente pide rutas relativas y no hay CORS ni URLs absolutas por entorno.
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
