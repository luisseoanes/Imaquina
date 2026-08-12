// Cliente HTTP generado del OpenAPI de FastAPI.
// Escribir los tipos a mano garantiza que se desincronicen.
// Uso:  npm run api:gen  (con el backend corriendo)
export default {
  imaquina: {
    input: "http://localhost:8000/api/v1/openapi.json",
    output: {
      mode: "tags-split",
      target: "src/api/generated",
      client: "react-query",
      override: {
        mutator: { path: "./src/lib/http.ts", name: "http" },
      },
    },
  },
};
