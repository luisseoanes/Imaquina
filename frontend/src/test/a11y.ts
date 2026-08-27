/** Auditoría de nombres accesibles para los tests (I4).
 *
 *  El defecto que motivó esto: en `LoginPage` los `<label>` eran HERMANOS del
 *  input, sin `htmlFor`, así que los campos no tenían nombre accesible y un
 *  lector de pantalla no decía cuál era cuál. El patrón envolvente
 *  (`<label><span>…</span><input/></label>`) que usa el resto de la app sí es
 *  válido — por eso esto comprueba las cuatro formas y no la presencia de
 *  `htmlFor`, que daría falsos positivos en media app.
 *
 *  Sin dependencias nuevas a propósito: `dom-accessibility-api` sólo entra
 *  como transitiva de testing-library, y añadirla al `package.json` obliga a
 *  regenerar el lock.
 */

const CONTROLES = "input, select, textarea";

function tieneNombre(el: HTMLElement): boolean {
  if (el.getAttribute("aria-label")?.trim()) return true;

  const referencia = el.getAttribute("aria-labelledby");
  if (referencia) {
    return referencia
      .split(/\s+/)
      .some((id) => el.ownerDocument.getElementById(id)?.textContent?.trim());
  }

  // <label for="…"> apuntando a este control.
  if (el.id) {
    const asociado = el.ownerDocument.querySelector(
      `label[for="${CSS.escape(el.id)}"]`,
    );
    if (asociado?.textContent?.trim()) return true;
  }

  // <label> envolvente: válido y es el patrón mayoritario del repo.
  const envolvente = el.closest("label");
  return !!envolvente && !!textoDelLabel(envolvente).trim();
}

/** Texto del label SIN el contenido de los controles que envuelve.
 *
 *  `label.textContent` a secas incluye las <option> del <select> que hay
 *  dentro, así que un label vacío sobre un desplegable con opciones pasaba el
 *  guard. Verificado: sin esto, vaciar la etiqueta de "Curso" en el panel
 *  docente no se detecta. */
function textoDelLabel(label: Element): string {
  const copia = label.cloneNode(true) as HTMLElement;
  copia.querySelectorAll(CONTROLES).forEach((c) => c.remove());
  return copia.textContent ?? "";
}

/** Controles sin nombre accesible, identificados de forma legible. */
export function controlesSinNombre(raiz: HTMLElement): string[] {
  const sin: string[] = [];
  for (const el of raiz.querySelectorAll<HTMLElement>(CONTROLES)) {
    if (el.getAttribute("type") === "hidden") continue;
    if (tieneNombre(el)) continue;
    const tipo = el.getAttribute("type") ?? el.tagName.toLowerCase();
    sin.push(`${el.tagName.toLowerCase()}[${tipo}]${el.id ? `#${el.id}` : ""}`);
  }
  return sin;
}
