import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { ApiError } from "@/lib/http";
import MediaLibraryPicker from "./MediaLibraryPicker";
import RichTextEditor from "./RichTextEditor";
import { claves, useDeleteBlock, useUpdateBlock, type Lang, type StudioBlock } from "./api";

/** Una tarjeta de bloque en el editor (S13). Autoguardado al perder foco (S9):
 *  más simple y más robusto que guardar por tecla, y sigue sin exigir un
 *  botón "Guardar" explícito. */
export default function BlockCard({
  block,
  momentId,
  lang,
}: {
  block: StudioBlock;
  momentId: string;
  lang: Lang;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const [body, setBody] = useState(block.body ?? "");
  const [caption, setCaption] = useState(block.caption ?? "");
  const [altText, setAltText] = useState(block.alt_text ?? "");
  const [showPicker, setShowPicker] = useState(false);

  const actualizar = useUpdateBlock(momentId, lang);
  const borrar = useDeleteBlock(momentId);

  const conflicto = actualizar.error instanceof ApiError && actualizar.error.status === 409;

  const guardar = (campos: Partial<{ body: string; caption: string; alt_text: string }>) => {
    actualizar.mutate({
      blockId: block.id,
      body,
      caption,
      alt_text: altText,
      ...campos,
      expected_updated_at: block.updated_at,
    });
  };

  // Refresca `block.updated_at` para el próximo intento de guardado. No
  // resincroniza los campos locales que el editor ya tenía escritos: un 409
  // avisa de que hay algo nuevo, no descarta el borrador sin preguntar.
  const recargar = () => qc.invalidateQueries({ queryKey: claves.moment(momentId, lang) });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl border border-line p-3 shadow-sm transition ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          aria-label={t("studio.dragHandle")}
          className="cursor-grab touch-none text-content-subtle"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <Badge>{t(`studio.blockKinds.${block.kind}`)}</Badge>
        <button
          type="button"
          onClick={() => borrar.mutate(block.id)}
          className="ml-auto text-xs text-danger hover:underline"
        >
          {t("studio.deleteBlock")}
        </button>
      </div>

      {conflicto && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-danger/30 bg-note p-2 text-xs">
          <span>{t("studio.saveConflict")}</span>
          <button type="button" onClick={recargar} className="underline">
            {t("studio.reload")}
          </button>
        </div>
      )}

      {block.kind === "text" && (
        <RichTextEditor value={body} onChange={setBody} onBlur={() => guardar({ body })} />
      )}

      {(block.kind === "image" || block.kind === "audio") && (
        <div className="space-y-2">
          {body && block.kind === "image" && (
            <img src={body} alt={altText} className="max-h-40 rounded-xl border border-line" />
          )}
          {body && block.kind === "audio" && <audio controls src={body} className="w-full" />}
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowPicker((v) => !v)}>
            {t("studio.media.pick")}
          </Button>
          {showPicker && (
            <MediaLibraryPicker
              familia={block.kind}
              onClose={() => setShowPicker(false)}
              onSelect={({ url, assetId }) => {
                setBody(url);
                setShowPicker(false);
                actualizar.mutate({
                  blockId: block.id,
                  body: url,
                  media_asset_id: assetId,
                  caption,
                  alt_text: altText,
                  expected_updated_at: block.updated_at,
                });
              }}
            />
          )}
          {block.kind === "image" && (
            <input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              onBlur={() => guardar({ alt_text: altText })}
              placeholder={t("studio.altText")}
              className={fieldClass}
            />
          )}
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => guardar({ caption })}
            placeholder={t("studio.caption")}
            className={fieldClass}
          />
        </div>
      )}

      {(block.kind === "video" || block.kind === "embed") && (
        <div className="space-y-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={() => guardar({ body })}
            placeholder={t("studio.embedUrl")}
            className={fieldClass}
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => guardar({ caption })}
            placeholder={t("studio.caption")}
            className={fieldClass}
          />
        </div>
      )}
    </li>
  );
}
