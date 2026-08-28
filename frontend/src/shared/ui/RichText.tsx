/** Render de texto enriquecido acotado.
 *
 *  Recorre el HTML con `DOMParser` y lo reconstruye con React contra una lista
 *  blanca de etiquetas — NUNCA `dangerouslySetInnerHTML` (superficie de XSS y
 *  contenido de menores). Un `<script>`, un `onerror=` o un `href="javascript:"`
 *  se descartan porque no están en la lista o se filtran al copiar atributos.
 */
import { createElement } from "react";
import type { ReactNode } from "react";

const PERMITIDAS = new Set([
  "p", "strong", "em", "s", "code", "ul", "ol", "li", "br", "a", "h3", "h4", "blockquote",
]);

function nodo(n: Node, key: number): ReactNode {
  if (n.nodeType === Node.TEXT_NODE) return n.textContent;
  if (n.nodeType !== Node.ELEMENT_NODE) return null;

  const el = n as Element;
  const tag = el.tagName.toLowerCase();
  if (!PERMITIDAS.has(tag)) {
    // Etiqueta no permitida: se conserva su texto, se tira el envoltorio.
    return Array.from(el.childNodes).map((c, i) => nodo(c, i));
  }
  if (tag === "br") return createElement("br", { key });

  const hijos = Array.from(el.childNodes).map((c, i) => nodo(c, i));

  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    const seguro = /^(https?:|mailto:|\/)/i.test(href);
    return createElement(
      "a",
      {
        key,
        ...(seguro ? { href, target: "_blank", rel: "noreferrer noopener" } : {}),
        className: "text-brand-ink underline",
      },
      hijos,
    );
  }
  return createElement(tag, { key }, hijos);
}

export function RichText({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  if (typeof DOMParser === "undefined") {
    return <div className={className}>{html.replace(/<[^>]+>/g, "")}</div>;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (
    <div className={`space-y-2 leading-relaxed ${className}`}>
      {Array.from(doc.body.childNodes).map((n, i) => nodo(n, i))}
    </div>
  );
}
