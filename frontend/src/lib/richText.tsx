/** Esquema de texto enriquecido compartido (S14).
 *
 *  Vive fuera de `features/studio` a propósito: el estudiante también
 *  necesita RENDERIZAR este HTML (`MomentPage`), y ese componente va en el
 *  bundle de entrada — no puede importar nada de `features/studio`, o
 *  `scripts/check-chunks.mjs` rompe el build (el Studio dejaría de estar en
 *  su chunk aparte).
 *
 *  El HTML que se guarda en `ContentBlock.body` sale siempre de este mismo
 *  esquema acotado de TipTap (negrita, listas, enlaces, código — nunca HTML
 *  libre). Para RENDERIZARLO se usa una instancia de TipTap en modo
 *  `editable: false` en vez de `dangerouslySetInnerHTML`: es el mismo
 *  esquema el que gobierna lectura y escritura, así que no hay superficie de
 *  inyección de HTML arbitrario.
 */
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";

import { RICH_TEXT_EXTENSIONS } from "./richTextExtensions";

export function RichTextView({ html }: { html: string }) {
  const editor = useEditor({
    extensions: RICH_TEXT_EXTENSIONS,
    content: html || "",
    editable: false,
  });

  useEffect(() => {
    if (editor && html !== editor.getHTML()) editor.commands.setContent(html || "");
  }, [editor, html]);

  if (!editor) return null;
  return <EditorContent editor={editor} className="prose prose-sm max-w-none" />;
}
