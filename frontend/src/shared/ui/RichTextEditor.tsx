/** Editor de texto enriquecido con barra de formato, sin dependencias.
 *
 *  `contentEditable` + `document.execCommand` (deprecado pero soportado en
 *  todos los navegadores para lo básico) y saneado a la lista blanca de
 *  `richTextSanitize.ts` en cada cambio. No trae TipTap/Lexical a propósito: el
 *  contenido admitido es un subconjunto pequeño y `RichText.tsx` ya lo
 *  renderiza.
 *
 *  El caret salta si se reescribe `innerHTML` mientras se teclea, así que el
 *  valor entrante sólo se vuelca cuando el editor NO tiene el foco.
 */
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { sanearRichText } from "./richTextSanitize";

type Comando =
  | { cmd: "bold" | "italic" | "strikeThrough" | "insertUnorderedList" | "insertOrderedList" }
  | { cmd: "formatBlock"; value: "h3" | "h4" | "blockquote" | "p" }
  | { cmd: "code" }
  | { cmd: "createLink" };

const BOTONES: { key: string; label: string; accion: Comando }[] = [
  { key: "bold", label: "B", accion: { cmd: "bold" } },
  { key: "italic", label: "I", accion: { cmd: "italic" } },
  { key: "strike", label: "S", accion: { cmd: "strikeThrough" } },
  { key: "code", label: "</>", accion: { cmd: "code" } },
  { key: "h3", label: "H3", accion: { cmd: "formatBlock", value: "h3" } },
  { key: "h4", label: "H4", accion: { cmd: "formatBlock", value: "h4" } },
  { key: "ul", label: "•", accion: { cmd: "insertUnorderedList" } },
  { key: "ol", label: "1.", accion: { cmd: "insertOrderedList" } },
  { key: "quote", label: "❝", accion: { cmd: "formatBlock", value: "blockquote" } },
  { key: "link", label: "🔗", accion: { cmd: "createLink" } },
];

function envolverSeleccionEnCodigo(): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const rango = sel.getRangeAt(0);
  const code = document.createElement("code");
  code.appendChild(rango.extractContents());
  rango.insertNode(code);
  sel.removeAllRanges();
}

export function RichTextEditor({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (html: string) => void;
  ariaLabel?: string;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  const emitir = () => {
    if (ref.current) onChange(sanearRichText(ref.current.innerHTML));
  };

  const aplicar = (accion: Comando) => {
    ref.current?.focus();
    if (accion.cmd === "code") {
      envolverSeleccionEnCodigo();
    } else if (accion.cmd === "createLink") {
      const url = window.prompt(t("studio.editor.linkPrompt"));
      if (url) document.execCommand("createLink", false, url);
    } else if (accion.cmd === "formatBlock") {
      document.execCommand("formatBlock", false, accion.value);
    } else {
      document.execCommand(accion.cmd);
    }
    emitir();
  };

  return (
    <div className="rounded-control border border-line bg-canvas">
      <div className="flex flex-wrap gap-1 border-b border-line p-1.5">
        {BOTONES.map((b) => (
          <button
            key={b.key}
            type="button"
            aria-label={t(`studio.editor.rte.${b.key}`, b.key)}
            title={t(`studio.editor.rte.${b.key}`, b.key)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => aplicar(b.accion)}
            className="min-w-8 rounded px-2 py-1 text-sm font-semibold text-content-muted hover:bg-surface-muted hover:text-content"
          >
            {b.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        onInput={emitir}
        onBlur={emitir}
        className="prose-editor min-h-32 px-3 py-2.5 text-sm text-content focus:outline-none [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-content-muted [&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
}
