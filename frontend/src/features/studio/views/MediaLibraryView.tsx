import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMedia, useMediaFolders, useMediaMutations } from "../api";
import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  QueryState,
  Select,
  TextArea,
  TextInput,
} from "@/shared/ui/panel";
import { useStudio } from "../StudioContext";
import type { MediaAsset } from "../types";

const FAMILIES = ["", "image", "audio", "video", "application"] as const;

export function MediaLibraryView() {
  const { t } = useTranslation();
  const { search, lang } = useStudio();
  const [familia, setFamilia] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const folders = useMediaFolders();
  const { data, isLoading, error } = useMedia(familia, search, folderId);
  const m = useMediaMutations();

  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [nuevaCarpeta, setNuevaCarpeta] = useState("");

  const upload = async () => {
    if (!file) return;
    await m.upload.mutateAsync({ file, alt, folderId });
    setFile(null);
    setAlt("");
  };

  return (
    <div>
      <PageHeader
        title={t("studio.nav.media")}
        description={t("studio.media.subtitle")}
        actions={
          <Select value={familia} onChange={(e) => setFamilia(e.target.value)}>
            {FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f ? t(`studio.mediaFamily.${f}`, f) : t("studio.contents.all")}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[14rem_1fr]">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setFolderId(null)}
            className={`block w-full rounded-control px-3 py-2 text-left text-sm ${
              folderId === null ? "bg-surface-muted font-medium" : ""
            } text-content hover:bg-surface-muted`}
          >
            {t("studio.media.allFolders")}
          </button>
          {(folders.data ?? []).map((f) => (
            <div key={f.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFolderId(f.id)}
                className={`flex-1 rounded-control px-3 py-2 text-left text-sm ${
                  folderId === f.id ? "bg-surface-muted font-medium" : ""
                } text-content hover:bg-surface-muted`}
              >
                📁 {f.name}
              </button>
              <button
                type="button"
                className="text-xs text-danger"
                onClick={() => m.deleteFolder.mutate(f.id)}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-1 pt-1">
            <TextInput
              value={nuevaCarpeta}
              onChange={(e) => setNuevaCarpeta(e.target.value)}
              placeholder={t("studio.media.newFolder")}
            />
            <Button
              variant="ghost"
              onClick={() => {
                if (nuevaCarpeta.trim()) {
                  m.createFolder.mutate({ name: nuevaCarpeta.trim() });
                  setNuevaCarpeta("");
                }
              }}
            >
              +
            </Button>
          </div>
        </div>

        <div>
          <Card className="mb-5">
            <h2 className="mb-2 text-base font-semibold text-content">
              {t("studio.media.upload")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
              <Button onClick={() => void upload()} disabled={!file || m.upload.isPending}>
                {t("studio.media.doUpload")}
              </Button>
            </div>
            {m.upload.error instanceof Error ? (
              <p className="mt-2 text-sm text-danger">{m.upload.error.message}</p>
            ) : null}
          </Card>

          <QueryState isLoading={isLoading} error={error}>
            {(data?.items ?? []).length === 0 ? (
              <EmptyState message={t("studio.media.empty")} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {(data?.items ?? []).map((a) => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    folders={folders.data ?? []}
                    onPatch={(b) => m.patch.mutate({ id: a.id, ...b })}
                    onSuggest={() =>
                      m.suggestAlt.mutateAsync({ id: a.id, lang }).then((r) => r.alt_text)
                    }
                    onDelete={() => {
                      if (confirm(t("studio.action.confirmDelete")))
                        m.remove.mutate(a.id);
                    }}
                  />
                ))}
              </div>
            )}
          </QueryState>
        </div>
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  folders,
  onPatch,
  onSuggest,
  onDelete,
}: {
  asset: MediaAsset;
  folders: { id: string; name: string }[];
  onPatch: (b: Record<string, unknown>) => void;
  onSuggest: () => Promise<string>;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [alt, setAlt] = useState(asset.alt_text ?? "");
  const [vtt, setVtt] = useState("");
  const [showVtt, setShowVtt] = useState(false);
  const esVideo = asset.mime_type.startsWith("video/");

  return (
    <Card>
      {asset.mime_type.startsWith("image/") ? (
        <img
          src={asset.url}
          alt={asset.alt_text ?? asset.original_filename}
          className="mb-2 h-32 w-full rounded-control object-cover"
        />
      ) : (
        <div className="mb-2 flex h-32 items-center justify-center rounded-control bg-surface-muted text-3xl">
          {asset.mime_type.startsWith("audio/")
            ? "🎵"
            : esVideo
              ? "🎬"
              : "📄"}
        </div>
      )}
      <p className="truncate text-sm font-medium text-content">
        {asset.original_filename}
      </p>
      <p className="text-xs text-content-subtle">
        {(asset.size_bytes / 1024 / 1024).toFixed(2)} MB ·{" "}
        {t("studio.media.usedIn", { count: asset.used_in })}
      </p>

      <div className="mt-2 flex gap-1">
        <TextInput
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={() => alt !== asset.alt_text && onPatch({ alt_text: alt })}
          placeholder={t("studio.field.altText")}
        />
        {asset.mime_type.startsWith("image/") ? (
          <Button
            variant="ghost"
            onClick={() => void onSuggest().then((s) => s && setAlt(s))}
          >
            ✨
          </Button>
        ) : null}
      </div>

      <div className="mt-2">
        <Select
          value={asset.folder_id ?? ""}
          onChange={(e) => onPatch({ folder_id: e.target.value || null })}
        >
          <option value="">{t("studio.media.noFolder")}</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </div>

      {esVideo ? (
        <div className="mt-2">
          <button
            type="button"
            className="text-xs text-content-muted hover:text-content"
            onClick={() => setShowVtt((v) => !v)}
          >
            {asset.has_captions
              ? t("studio.media.editCaptions")
              : t("studio.media.addCaptions")}
          </button>
          {showVtt ? (
            <>
              <TextArea
                rows={4}
                value={vtt}
                onChange={(e) => setVtt(e.target.value)}
                placeholder={"WEBVTT\n\n00:00.000 --> 00:03.000\n…"}
              />
              <Button
                variant="ghost"
                onClick={() => onPatch({ captions_vtt: vtt || null })}
              >
                {t("common.save")}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        disabled={asset.used_in > 0}
        className="mt-2 text-sm text-danger hover:underline disabled:opacity-40"
        onClick={onDelete}
      >
        {t("studio.action.delete")}
      </button>
    </Card>
  );
}
