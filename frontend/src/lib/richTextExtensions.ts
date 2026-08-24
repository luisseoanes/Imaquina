/** Esquema acotado de TipTap (S14): negrita, cursiva, listas, enlaces, código.
 *  Nunca HTML libre. Compartido entre `richText.tsx` (lectura) y
 *  `features/studio/RichTextEditor.tsx` (escritura) para que el mismo
 *  esquema gobierne ambos lados. */
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";

export const RICH_TEXT_EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    blockquote: false,
    codeBlock: false,
    horizontalRule: false,
  }),
  Link.configure({ openOnClick: false, autolink: true }),
];
