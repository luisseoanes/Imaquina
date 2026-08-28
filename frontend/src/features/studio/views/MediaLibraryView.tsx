import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMedia, useMediaMutations } from "../api";
import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  QueryState,
  Select,
  TextInput,
} from "@/shared/ui/panel";
import { useStudio } from "../StudioContext";

const FAMILIES = ["", "image", "audio", "video", "application"] as const;

export function MediaLibraryView() {
  const { t } = useTranslation();
  const { search } = useStudio();
  const [familia, setFamilia] = useState("");
  const { data, isLoading, error } = useMedia(familia, search);
  const m = useMediaMutations();

  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");

  const upload = async () => {
    if (!file) return;
    await m.upload.mutateAsync({ file, alt });
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

      <Card className="mb-5">
        <h2 className="mb-2 text-base font-semibold text-content">
          {t("studio.media.upload")}
        </h2>
        <p className="mb-3 text-xs text-content-subtle">{t("studio.media.uploadHint")}</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label={t("studio.media.file")}>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-content"
            />
          </Field>
          <Field label={t("studio.field.altText")} hint={t("studio.media.altRequired")}>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(data?.items ?? []).map((a) => (
              <Card key={a.id}>
                {a.mime_type.startsWith("image/") ? (
                  <img
                    src={a.url}
                    alt={a.alt_text ?? a.original_filename}
                    className="mb-2 h-32 w-full rounded-control object-cover"
                  />
                ) : (
                  <div className="mb-2 flex h-32 items-center justify-center rounded-control bg-surface-muted text-3xl">
                    {a.mime_type.startsWith("audio/")
                      ? "🎵"
                      : a.mime_type.startsWith("video/")
                        ? "🎬"
                        : "📄"}
                  </div>
                )}
                <p className="truncate text-sm font-medium text-content">
                  {a.original_filename}
                </p>
                <p className="text-xs text-content-subtle">
                  {(a.size_bytes / 1024 / 1024).toFixed(2)} MB ·{" "}
                  {t("studio.media.usedIn", { count: a.used_in })}
                </p>
                <button
                  type="button"
                  disabled={a.used_in > 0}
                  className="mt-2 text-sm text-danger hover:underline disabled:opacity-40"
                  onClick={() => {
                    if (confirm(t("studio.action.confirmDelete"))) m.remove.mutate(a.id);
                  }}
                >
                  {t("studio.action.delete")}
                </button>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
