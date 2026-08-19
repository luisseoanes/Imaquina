/** @type {import('tailwindcss').Config} */

// Los valores viven en src/index.css como variables CSS: aquí sólo se les da
// nombre de utilidad. Cambiar la paleta no toca este fichero.
const token = (nombre) => `rgb(var(--color-${nombre}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: token("surface"), muted: token("surface-muted") },
        line: token("line"),
        content: {
          DEFAULT: token("content"),
          muted: token("content-muted"),
          subtle: token("content-subtle"),
        },
        brand: {
          DEFAULT: token("brand"),
          ink: token("brand-ink"),
          content: token("brand-content"),
        },
        note: {
          DEFAULT: token("note"),
          line: token("note-line"),
          content: token("note-content"),
        },
        success: { DEFAULT: token("success"), content: token("success-content") },
        danger: token("danger"),
        curiosear: token("curiosear"),
        descubrir: token("descubrir"),
        inventar: token("inventar"),
        innovar: token("innovar"),
      },
      // El borde por defecto de Tailwind es gray-200 fijo; que siga el token.
      borderColor: { DEFAULT: token("line") },
    },
  },
  plugins: [],
};
