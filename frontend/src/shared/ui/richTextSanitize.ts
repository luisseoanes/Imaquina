/** Saneado de texto enriquecido a una lista blanca.
 *
 *  El editor (`RichTextEditor`) produce HTML con `contentEditable`, que mete
 *  de todo: `<div>`, `<span style>`, `<font>`, atributos `class`, restos al
 *  pegar desde Word. Aquí se normaliza al MISMO subconjunto que
 *  `RichText.tsx` sabe renderizar, para que lo que se guarda sea exactamente
 *  lo que verá el estudiante y no quede basura en la base.
 *
 *  Es contenido que edita el cliente y consumen menores: la lista es
 *  restrictiva a propósito y nunca se confía en un atributo sin revisarlo.
 */

/** Misma lista que `RichText.tsx` (`PERMITIDAS`). Si cambia una, cambia la otra. */
export const ETIQUETAS_PERMITIDAS = new Set([
  "p",
  "strong",
  "em",
  "s",
  "code",
  "ul",
  "ol",
  "li",
  "br",
  "a",
  "h3",
  "h4",
  "blockquote",
]);

/** Etiquetas de bloque: si aparece texto suelto fuera de una de estas, se
 *  envuelve en `<p>` para que el render no lo pegue todo en una línea. */
const BLOQUE = new Set(["p", "ul", "ol", "li", "h3", "h4", "blockquote"]);

/** `execCommand` genera estas; se traducen a la forma de la lista blanca. */
const EQUIVALENTES: Record<string, string> = { b: "strong", i: "em", strike: "s", del: "s" };

function hrefSeguro(href: string): boolean {
  return /^(https?:|mailto:|\/)/i.test(href.trim());
}

function limpiarNodo(n: Node, salida: Node[], doc: Document): void {
  if (n.nodeType === Node.TEXT_NODE) {
    salida.push(doc.createTextNode(n.textContent ?? ""));
    return;
  }
  if (n.nodeType !== Node.ELEMENT_NODE) return;

  const el = n as Element;
  let tag = el.tagName.toLowerCase();

  // Se descartan con su contenido: su "texto" es código, no prosa.
  if (tag === "script" || tag === "style") return;

  tag = EQUIVALENTES[tag] ?? tag;

  if (!ETIQUETAS_PERMITIDAS.has(tag)) {
    // Etiqueta no permitida (`div`, `span`, `font`…): se tira el envoltorio y
    // se conservan los hijos.
    for (const hijo of Array.from(el.childNodes)) limpiarNodo(hijo, salida, doc);
    return;
  }

  const nuevo = doc.createElement(tag);
  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    if (hrefSeguro(href)) nuevo.setAttribute("href", href.trim());
  }
  if (tag !== "br") {
    const hijos: Node[] = [];
    for (const hijo of Array.from(el.childNodes)) limpiarNodo(hijo, hijos, doc);
    for (const h of hijos) nuevo.appendChild(h);
  }
  salida.push(nuevo);
}

/** Devuelve el HTML saneado. Cadena vacía si no queda contenido con sentido. */
export function sanearRichText(html: string): string {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]+>/g, "").trim();

  const doc = new DOMParser().parseFromString(html, "text/html");
  const limpios: Node[] = [];
  for (const n of Array.from(doc.body.childNodes)) limpiarNodo(n, limpios, doc);

  const cont = doc.createElement("div");
  let parrafoSuelto: HTMLParagraphElement | null = null;
  for (const nodo of limpios) {
    const esBloque =
      nodo.nodeType === Node.ELEMENT_NODE &&
      BLOQUE.has((nodo as Element).tagName.toLowerCase());
    if (esBloque) {
      parrafoSuelto = null;
      cont.appendChild(nodo);
      continue;
    }
    // Texto suelto o inline fuera de bloque: acumular en un `<p>`.
    if (!parrafoSuelto) {
      parrafoSuelto = doc.createElement("p");
      cont.appendChild(parrafoSuelto);
    }
    parrafoSuelto.appendChild(nodo);
  }

  // Quita los bloques que quedaron sin texto (`<p></p>` de un Enter suelto).
  for (const el of Array.from(cont.children)) {
    if (!el.textContent?.trim() && el.tagName.toLowerCase() !== "br") el.remove();
  }

  return cont.innerHTML.trim();
}
