import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */

// Los valores viven en src/index.css como variables CSS: aquí sólo se les da
// nombre de utilidad. Cambiar la paleta no toca este fichero.
const token = (nombre) => `rgb(var(--color-${nombre}) / <alpha-value>)`;
// `<alpha-value>` sólo se sustituye dentro del pipeline de color de Tailwind
// (utilidades tipo `bg-brand/10`); para CSS plano (el bloque `typography` de
// abajo) hace falta el valor sólido, sin el placeholder.
const solid = (nombre) => `rgb(var(--color-${nombre}))`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"],
      },
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
      // El plugin de tipografía trae sus propios grises fijos por defecto:
      // se remapean a los tokens semánticos para que el contenido respete
      // la paleta (y el modo oscuro, que ya vive en las mismas variables).
      typography: () => ({
        DEFAULT: {
          css: {
            "--tw-prose-body": solid("content"),
            "--tw-prose-headings": solid("content"),
            "--tw-prose-lead": solid("content-muted"),
            "--tw-prose-links": solid("brand-ink"),
            "--tw-prose-bold": solid("content"),
            "--tw-prose-counters": solid("content-subtle"),
            "--tw-prose-bullets": solid("content-subtle"),
            "--tw-prose-hr": solid("line"),
            "--tw-prose-quotes": solid("content"),
            "--tw-prose-quote-borders": solid("line"),
            "--tw-prose-captions": solid("content-subtle"),
            "--tw-prose-code": solid("content"),
            "--tw-prose-pre-code": solid("content"),
            "--tw-prose-pre-bg": solid("surface-muted"),
            "--tw-prose-th-borders": solid("line"),
            "--tw-prose-td-borders": solid("line"),
            maxWidth: "none",
          },
        },
      }),
    },
  },
  plugins: [typography],
};
