/** Selector de un asset de la biblioteca de medios para un bloque.
 *
 *  Antes el editor pegaba la URL a mano en `body`; ahora elige de la librería
 *  y el bloque guarda `media_asset_id`, que el backend resuelve a URL al
 *  servir (así mover el bucket no rompe el contenido ya publicado).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMedia, useMediaMutations } from "../api";
import { Button, Field, QueryState, TextInput } from "@/shared/ui/panel";

const FAMILIA_POR_KIND: Record<string, string> = {
  image: "image",
  audio: "audio",
  video: "video",
  video_chapters: "video",
};

export function MediaPickerModal({
  kind,
  onPick,
  onClose,
}: {
  kind: string;
  onPick: (assetId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [buscar, setBuscar] = useState("");
  const familia = FAMILIA_POR_KIND[kind] ?? "";
  const { data, isLoading, error } = useMedia(familia, buscar);
  const m = useMediaMutations();

  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");

  const subirYElegir = async () => {
    if (!file) return;
    const asset = await m.upload.mutateAsync({ file, alt });
    onPick(asset.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("common.cancel")}
        onClick={onClose}
        className="absolute inset-0 bg-content/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-card bg-surface p-5 shadow-card"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-content">
            {t("studio.editor.pickMedia")}
          </h2>
          <button type="button" onClick={onClose} className="text-content-muted">
            ✕
          </button>
        </div>

        <TextInput
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder={t("studio.media.searchPlaceholder")}
        />

        <div className="my-3 grid flex-1 gap-3 overflow-auto sm:grid-cols-3">
          <QueryState isLoading={isLoading} error={error}>
            {(data?.items ?? []).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onPick(a.id);
                  onClose();
                }}
                className="rounded-control border border-line p-1 text-left hover:border-brand-ink"
              >
                {a.mime_type.startsWith("image/") ? (
                  <img
                    src={a.url}
                    alt={a.alt_text ?? a.original_filename}
                    className="mb-1 h-24 w-full rounded object-cover"
                  />
                ) : (
                  <div className="mb-1 flex h-24 items-center justify-center rounded bg-surface-muted text-2xl">
                    {a.mime_type.startsWith("audio/") ? "🎵" : "🎬"}
                  </div>
                )}
                <span className="block truncate text-xs text-content">
                  {a.original_filename}
                </span>
              </button>
            ))}
          </QueryState>
        </div>

        <div className="border-t border-line pt-3">
          <p className="mb-2 text-xs font-semibold uppercase text-content-subtle">
            {t("studio.media.upload")}
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label={t("studio.media.file")}>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm text-content"
              />
            </Field>
            <Field label={t("studio.field.altText")}>
              <TextInput value={alt} onChange={(e) => setAlt(e.target.value)} />
            </Field>
            <Button
              onClick={() => void subirYElegir()}
              disabled={!file || m.upload.isPending}
            >
              {t("studio.media.doUpload")}
            </Button>
          </div>
          {m.upload.error instanceof Error ? (
            <p className="mt-2 text-sm text-danger">{m.upload.error.message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Familias con selector de librería. `embed` va por proveedor + URL. */
export const KIND_CON_LIBRERIA = new Set(["image", "audio", "video"]);
