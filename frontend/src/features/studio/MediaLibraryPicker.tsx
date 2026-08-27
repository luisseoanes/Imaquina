/** Librería de media + subida directa a S3/R2 (S15).
 *
 *  El navegador sube directo al bucket con una URL prefirmada — nunca pasa
 *  por FastAPI, un video de 200MB tumbaría el backend.
 */
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/http";
import { useMediaAssets, useUploadMedia, type MediaAsset } from "./api";

export default function MediaLibraryPicker({
  familia,
  onSelect,
  onClose,
}: {
  familia: "image" | "audio";
  onSelect: (asset: { url: string; assetId: string }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [buscar, setBuscar] = useState("");
  const [altText, setAltText] = useState("");
  const { data } = useMediaAssets(familia, buscar || undefined);
  const subir = useUploadMedia();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (familia === "image" && !altText.trim()) return;
    try {
      const registrado = await subir.mutateAsync({ file, altText });
      onSelect({ url: registrado.url, assetId: registrado.id });
    } catch {
      // El error se pinta abajo con `subir.error`.
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-sm">{t("studio.media.title")}</strong>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("studio.closePreview")}
          className="text-content-subtle hover:text-content"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {familia === "image" && (
        <input
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder={t("studio.media.altRequired")}
          className="mb-2 w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-sm
                     transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      )}

      <label className="mb-2 block">
        <span className="sr-only">{t("studio.media.upload")}</span>
        <input
          type="file"
          accept={`${familia}/*`}
          disabled={subir.isPending || (familia === "image" && !altText.trim())}
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm"
        />
      </label>
      {subir.isPending && <p className="text-xs text-content-subtle">{t("studio.media.uploading")}</p>}
      {subir.error instanceof ApiError && (
        <p className="text-xs text-danger">{subir.error.message}</p>
      )}

      <input
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
        placeholder={t("studio.media.search")}
        className="mb-2 w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-sm
                   transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />

      {data?.items.length === 0 && (
        <p className="text-xs text-content-subtle">{t("studio.media.none")}</p>
      )}
      <ul className="max-h-48 divide-y divide-line overflow-y-auto">
        {data?.items.map((asset: MediaAsset) => (
          <li key={asset.id} className="flex items-center justify-between gap-2 py-1">
            <span className="truncate text-xs">{asset.original_filename}</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onSelect({ url: asset.url, assetId: asset.id })}
            >
              {t("studio.media.pick")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
