/** Editor de texto enriquecido acotado (S14). Solo para el Studio.
 *
 *  Reutiliza el mismo esquema de extensiones que `lib/richText.tsx` usa para
 *  RENDERIZAR: es lo que garantiza que nunca se guarde nada fuera de lo que
 *  el lector también sabe pintar.
 */
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { RICH_TEXT_EXTENSIONS } from "@/lib/richTextExtensions";

function BotonBarra({
  activo,
  onClick,
  label,
  title,
}: {
  activo: boolean;
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      title={title}
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        activo ? "bg-brand text-brand-content" : "border text-content-muted"
      }`}
    >
      {label}
    </button>
  );
}

function Barra({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  return (
    <div className="mb-1 flex flex-wrap gap-1">
      <BotonBarra
        activo={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="B"
        title={t("studio.editor.bold")}
      />
      <BotonBarra
        activo={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="I"
        title={t("studio.editor.italic")}
      />
      <BotonBarra
        activo={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="•"
        title={t("studio.editor.bulletList")}
      />
      <BotonBarra
        activo={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="1."
        title={t("studio.editor.orderedList")}
      />
      <BotonBarra
        activo={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="</>"
        title={t("studio.editor.code")}
      />
      <BotonBarra
        activo={editor.isActive("link")}
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const href = window.prompt(t("studio.editor.linkPrompt"));
          if (href) editor.chain().focus().setLink({ href }).run();
        }}
        label="🔗"
        title={t("studio.editor.link")}
      />
    </div>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
}) {
  const editor = useEditor({
    extensions: RICH_TEXT_EXTENSIONS,
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onBlur: () => onBlur?.(),
    editorProps: {
      attributes: {
        class:
          "contenido-rico rounded border px-2 py-1.5 min-h-[6rem] focus:outline-none focus:ring-1 focus:ring-brand",
      },
    },
  });

  // Si `value` cambia por fuera (cambiar de idioma, recargar tras un 409),
  // el editor no se entera solo: hay que empujarle el contenido nuevo.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "");
  }, [editor, value]);

  if (!editor) return null;
  return (
    <div>
      <Barra editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
