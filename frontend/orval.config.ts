import { defineConfig } from "orval";

/** Palabras que no pueden ser nombre de variable en JS/TS. El backend tiene un
 *  endpoint `export` y el generado no compilaba por esto. */
/** Nombres que existen en dos areas a la vez. Son operaciones distintas de
 *  verdad: el estudiante lee del snapshot publicado y el editor de las tablas
 *  normalizadas, asi que se desambiguan con el tag (`learningGetMoment` vs
 *  `studioGetMoment`) en vez de dejar que colisionen.
 *
 *  Si el backend anade otra colision, `tsc` falla con "Duplicate identifier"
 *  al construir: es un fallo ruidoso y basta con anadir el nombre aqui. */
const AMBIGUAS = new Set(["get_moment", "get_project", "list_projects"]);

const RESERVADAS = new Set([
  "export", "import", "delete", "new", "class", "function", "default",
  "return", "var", "let", "const", "switch", "case", "this", "typeof",
  "void", "in", "of", "do", "if", "else", "for", "while", "catch", "try",
]);

/** Genera el cliente tipado desde el OpenAPI del backend.
 *
 *  El backend publica 69 endpoints ya tipados: escribir esas firmas a mano
 *  garantiza que se desincronicen y que nadie se entere hasta runtime.
 *
 *  El resultado **se versiona** (no está en .gitignore) a propósito: si no,
 *  construir exigiría tener el backend levantado y se rompería CI y un clon
 *  recién hecho. Se regenera a mano con `npm run api:generate` cuando el
 *  contrato cambia, y el diff del generado hace visible ese cambio en la
 *  revisión de código.
 */
export default defineConfig({
  imaquina: {
    input: {
      target: process.env.OPENAPI_URL ?? "http://localhost:8000/api/v1/openapi.json",
    },
    output: {
      mode: "tags-split",
      // Sin esto, un fichero de una generacion anterior sobrevive a la
      // siguiente: al renombrar operaciones quedaron tipos duplicados que
      // rompian `tsc` con "Duplicate identifier".
      clean: true,
      target: "./src/shared/api/generated",
      schemas: "./src/shared/api/generated/model",
      client: "react-query",
      prettier: false,
      override: {
        // La respuesta es el CUERPO, no un `{data, status, headers}`. El
        // status ya lo mira `httpClient`, que lanza `ApiError` en cualquier
        // caso de error: si la promesa resuelve, la peticion fue bien y
        // obligar a discriminar en cada llamada solo anade ruido.
        fetch: { includeHttpResponseReturnType: false },

        // FastAPI compone el operationId como `<funcion>_api_v1_<ruta>_<verbo>`,
        // y orval lo convierte tal cual en el nombre del hook: saldrian cosas
        // como `useAddChoiceApiV1StudioAssessmentQuestionsQuestionIdChoicesPost`.
        // Nos quedamos con el nombre de la funcion del endpoint, que es el que
        // el backend eligio a proposito: `useLogin`, `useListProjects`.
        operationName: (operation, route, verb) => {
          const id = operation.operationId ?? "";
          const nombre = id.split("_api_v1_")[0];
          if (!nombre) return `${verb}${route.replace(/\W/g, "")}`;

          if (AMBIGUAS.has(nombre)) {
            const tag = operation.tags?.[0] ?? "";
            return `${tag}${nombre[0].toUpperCase()}${nombre.slice(1)}`;
          }

          // `export`, `delete` y compañía son palabras reservadas: usadas como
          // nombre de variable, el generado no compila. Se les antepone el
          // verbo HTTP, que ademas los desambigua (`postExport`, `getExport`).
          return RESERVADAS.has(nombre)
            ? `${verb}${nombre[0].toUpperCase()}${nombre.slice(1)}`
            : nombre;
        },
        // Todas las llamadas pasan por nuestro cliente: auth, renovación del
        // token y traducción de errores en un solo sitio.
        mutator: {
          path: "./src/shared/api/httpClient.ts",
          name: "httpClient",
        },
      },
    },
  },
});
