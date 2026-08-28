import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      // El generado desde OpenAPI no se testea: es código de máquina y su
      // corrección la garantiza el contrato del backend.
      exclude: ["src/shared/api/generated/**", "src/test/**", "**/*.config.ts"],
    },
  },
});
