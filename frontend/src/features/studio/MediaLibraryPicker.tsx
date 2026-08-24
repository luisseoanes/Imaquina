/** Librería de media + subida directa a S3/R2 (S15).
 *
 *  El navegador sube directo al bucket con una URL prefirmada — nunca pasa
 *  por FastAPI, un video de 200MB tumbaría el backend.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
    <div className="rounded border bg-surface p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-sm">{t("studio.media.title")}</strong>
        <button type="button" onClick={onClose} className="text-sm text-content-subtle">
          ✕
        </button>
      </div>

      {familia === "image" && (
        <input
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder={t("studio.media.altRequired")}
          className="mb-2 w-full rounded border px-2 py-1 text-sm"
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
        className="mb-2 w-full rounded border px-2 py-1 text-sm"
      />

      {data?.items.length === 0 && (
        <p className="text-xs text-content-subtle">{t("studio.media.none")}</p>
      )}
      <ul className="max-h-48 divide-y overflow-y-auto">
        {data?.items.map((asset: MediaAsset) => (
          <li key={asset.id} className="flex items-center justify-between gap-2 py-1">
            <span className="truncate text-xs">{asset.original_filename}</span>
            <button
              type="button"
              onClick={() => onSelect({ url: asset.url, assetId: asset.id })}
              className="shrink-0 rounded border px-2 py-0.5 text-xs"
            >
              {t("studio.media.pick")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
