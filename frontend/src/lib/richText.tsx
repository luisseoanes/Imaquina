/** Render del texto enriquecido del contenido publicado (S14).
 *
 *  NO usa TipTap. El editor pesa 565 KB y lo descargaba TODO estudiante sólo
 *  para LEER: son el 95% del tráfico y el 73% de su bundle era un editor que
 *  nunca abren. Aquí se recorre el HTML y se reconstruye con React, dejando
 *  pasar únicamente el esquema acotado que el Studio puede producir.
 *
 *  La garantía de seguridad no se movió de sitio: sigue estando en el cliente
 *  y sigue siendo una LISTA BLANCA, igual que cuando la aplicaba el esquema de
 *  TipTap. Nada de `dangerouslySetInnerHTML`: lo que no está en las tablas de
 *  abajo no llega al DOM. `richTextExtensions.ts` define lo que se puede
 *  escribir y esto lo que se puede leer — si se añade una extensión allí, hay
 *  que añadir su etiqueta aquí o dejará de renderizarse.
 */
import { createElement, type ReactNode } from "react";

/** Etiquetas del esquema, mapeadas a la que se emite. Las variantes que el
 *  parser puede producir al pegar (`b`, `i`) se normalizan. */
const PERMITIDAS: Record<string, string> = {
  p: "p",
  ul: "ul",
  ol: "ol",
  li: "li",
  strong: "strong",
  b: "strong",
  em: "em",
  i: "em",
  s: "s",
  strike: "s",
  code: "code",
  br: "br",
  a: "a",
};

/** Sin hijos: emitirlas con `children` rompe React. */
const VACIAS = new Set(["br"]);

/** Protocolos que puede llevar un enlace. `javascript:` y `data:` fuera: son
 *  la vía de inyección que quedaría abierta si sólo se filtraran etiquetas. */
const PROTOCOLOS = new Set(["http:", "https:", "mailto:"]);

function hrefSeguro(bruto: string | null): string | undefined {
  if (!bruto) return undefined;
  try {
    // La base permite que un enlace relativo se resuelva y se valide igual.
    const url = new URL(bruto, "https://enlace.invalido/");
    return PROTOCOLOS.has(url.protocol) ? bruto : undefined;
  } catch {
    return undefined;
  }
}

function nodoAReact(nodo: Node, clave: string): ReactNode {
  if (nodo.nodeType === Node.TEXT_NODE) return nodo.textContent;
  if (nodo.nodeType !== Node.ELEMENT_NODE) return null;

  const el = nodo as Element;
  const etiqueta = PERMITIDAS[el.tagName.toLowerCase()];

  const hijos = Array.from(el.childNodes)
    .map((h, i) => nodoAReact(h, `${clave}-${i}`))
    .filter((h) => h !== null && h !== "");

  // Etiqueta fuera del esquema: se descarta el ELEMENTO pero se conserva su
  // texto, salvo en <script>/<style>, donde el texto es el peligro.
  if (!etiqueta) {
    const nombre = el.tagName.toLowerCase();
    if (nombre === "script" || nombre === "style") return null;
    return hijos.length ? createElement("span", { key: clave }, ...hijos) : null;
  }

  if (VACIAS.has(etiqueta)) return createElement(etiqueta, { key: clave });

  if (etiqueta === "a") {
    const href = hrefSeguro(el.getAttribute("href"));
    // Sin href válido deja de ser enlace, pero el texto se conserva.
    if (!href) return createElement("span", { key: clave }, ...hijos);
    return createElement(
      "a",
      { key: clave, href, target: "_blank", rel: "noopener noreferrer" },
      ...hijos,
    );
  }

  // Ningún atributo del origen se copia: sólo la etiqueta.
  return createElement(etiqueta, { key: clave }, ...hijos);
}

export function RichTextView({ html }: { html: string }) {
  if (!html) return null;
  // `DOMParser` con "text/html" es inerte: no ejecuta scripts ni carga nada.
  const doc = new DOMParser().parseFromString(html, "text/html");
  const hijos = Array.from(doc.body.childNodes).map((n, i) => nodoAReact(n, `n${i}`));
  return <div className="prose prose-sm max-w-none">{hijos}</div>;
}
