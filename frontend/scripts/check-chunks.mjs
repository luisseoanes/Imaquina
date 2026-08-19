/** Guarda del invariante: el estudiante NO descarga el Content Studio.
 *
 *  Los estudiantes son el 95% del tráfico. El editor va en su propio chunk vía
 *  `lazy()`, pero eso es fácil de romper sin que nadie lo note: una config de
 *  `manualChunks` heredada de Rollup llegó a meter las dependencias comunes en
 *  el chunk del Studio, y el bundle de entrada acabó importándolo entero.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ASSETS = "dist/assets";
const ficheros = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));

const entrada = ficheros.find((f) => f.startsWith("index-"));
if (!entrada) {
  console.error("check-chunks: no encuentro el bundle de entrada en dist/assets");
  process.exit(1);
}

const studio = ficheros.filter((f) => /studio/i.test(f));
if (studio.length === 0) {
  console.error("check-chunks: el Content Studio no está en un chunk aparte");
  process.exit(1);
}

const codigo = readFileSync(join(ASSETS, entrada), "utf8");
// Importaciones ESTÁTICAS del entry. Las dinámicas (`import(...)`) y el
// manifiesto de precarga de Vite son justo lo que queremos que haya.
const estaticos = [...codigo.matchAll(/from\s*"\.\/([^"]+\.js)"/g)].map((m) => m[1]);
const filtrados = estaticos.filter((f) => /studio/i.test(f));

if (filtrados.length > 0) {
  console.error(
    `check-chunks: el bundle de entrada importa el Content Studio (${filtrados.join(", ")}).\n` +
      "Los estudiantes no deben descargar el editor. Revisa el lazy() de App.tsx " +
      "y la configuración de chunks en vite.config.ts.",
  );
  process.exit(1);
}

console.log(`check-chunks: OK · entrada ${entrada} · studio ${studio.join(", ")}`);
