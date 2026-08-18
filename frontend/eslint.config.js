// ESLint 10: flat config, el unico formato que queda.
//
// De momento sin reglas type-aware (`recommendedTypeChecked`): son mas lentas y
// exigen apuntar al tsconfig. Cuando el codigo crezca merece la pena activarlas
// — `no-floating-promises` sola justifica el coste en un frontend con SSE.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "src/api/generated", "coverage"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: { "react-refresh": reactRefresh },
    rules: {
      // Vite necesita que un modulo de componente solo exporte componentes
      // para que el hot reload funcione.
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Las variables sin usar que empiezan por _ son intencionales.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Los tests corren en Node, no en el navegador.
    files: ["**/*.test.{ts,tsx}", "src/test/**"],
    languageOptions: { globals: globals.node },
  },
);
