import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { useMoment, useMomentMutations, useMomentPreview } from "../api";
import {
  Button,
  Card,
  Field,
  PageHeader,
  QueryState,
  Select,
  TextArea,
  TextInput,
} from "@/shared/ui/panel";
import { RichText } from "@/shared/ui/RichText";
import { RichTextEditor } from "@/shared/ui/RichTextEditor";
import { MomentBlocks } from "@/shared/ui/MomentBlocks";
import { useStudio } from "../StudioContext";
import { MediaPickerModal } from "../components/MediaPickerModal";
import {
  ChaptersEditor,
  ChecklistEditor,
  EmbedInteractiveEditor,
  InlineQuizEditor,
} from "../components/BlockKindEditors";
import { routes } from "@/shared/config/routes";
import type { Block } from "../types";

const BLOCK_KINDS = [
  "text",
  "image",
  "audio",
  "video",
  "embed",
  "checklist",
  "video_chapters",
  "inline_quiz",
  "blockly",
  "embed_interactive",
] as const;

const KINDS_INTERACTIVOS = new Set([
  "checklist",
  "video_chapters",
  "inline_quiz",
  "blockly",
  "embed_interactive",
]);

export function MomentEditorView() {
  const { t } = useTranslation();
  const { projectId = "", momentId = "" } = useParams();
  const { lang } = useStudio();

  const { data, isLoading, error } = useMoment(momentId, lang, {
    enabled: !!momentId,
  });
  const m = useMomentMutations(momentId, lang);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [prompt, setPrompt] = useState("");
  const [newKind, setNewKind] = useState<(typeof BLOCK_KINDS)[number]>("text");
  const [previewAs, setPreviewAs] = useState<"student" | "teacher" | null>(null);

  useEffect(() => {
    if (data) {
      setTitle(data.title ?? "");
      setNote(data.teacher_note ?? "");
      setPrompt(data.chatbot_opening_prompt ?? "");
    }
  }, [data]);

  const saveMoment = () =>
    m.updateMoment.mutate({
      title,
      teacher_note: note || null,
      chatbot_opening_prompt: prompt || null,
    });

  return (
    <div>
      <Link
        to={routes.studioProject(projectId)}
        className="mb-3 inline-block text-sm text-content-muted hover:text-content"
      >
        ← {t("studio.editor.backToProject")}
      </Link>
      <QueryState isLoading={isLoading} error={error}>
        {data ? (
          <>
            <PageHeader
              title={t(`studio.moment.${data.type}`, data.type)}
              description={t("studio.editor.momentSubtitle")}
              actions={
                <>
                  {data.type === "assess" ? (
                    <Link
                      to={routes.studioAssessments}
                      className="rounded-control bg-surface-muted px-3.5 py-2 text-sm font-medium text-content hover:bg-line"
                    >
                      {t("studio.editor.openAssessment")}
                    </Link>
                  ) : null}
                  <Button onClick={saveMoment} disabled={m.updateMoment.isPending}>
                    {t("common.save")}
                  </Button>
                </>
              }
            />

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                <Card>
                  <Field label={`${t("studio.field.title")} (${lang.toUpperCase()})`}>
                    <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
                  </Field>
                  <Field
                    label={t("studio.field.teacherNote")}
                    hint={t("studio.editor.teacherNoteHint")}
                  >
                    <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
                  </Field>
                  <Field
                    label={t("studio.field.openingPrompt")}
                    hint={t("studio.editor.openingPromptHint")}
                  >
                    <TextArea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </Field>
                </Card>

                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-content">
                    {t("studio.editor.blocks")}
                  </h2>
                  <div className="flex gap-2">
                    <Select
                      value={newKind}
                      onChange={(e) =>
                        setNewKind(e.target.value as (typeof BLOCK_KINDS)[number])
                      }
                    >
                      {BLOCK_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {t(`studio.blockKind.${k}`, k)}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="ghost"
                      onClick={() => m.createBlock.mutate({ kind: newKind })}
                    >
                      {t("studio.editor.addBlock")}
                    </Button>
                  </div>
                </div>

                {data.blocks.length === 0 ? (
                  <p className="text-sm text-content-muted">
                    {t("studio.editor.noBlocks")}
                  </p>
                ) : (
                  data.blocks.map((b, idx) => (
                    <BlockCard
                      key={b.id}
                      block={b}
                      lang={lang}
                      first={idx === 0}
                      last={idx === data.blocks.length - 1}
                      onSave={(fields) =>
                        m.updateBlock.mutate({ id: b.id, ...fields })
                      }
                      onDelete={() => m.deleteBlock.mutate(b.id)}
                      onMove={(dir) => {
                        const ids = data.blocks.map((x) => x.id);
                        const j = idx + dir;
                        if (j < 0 || j >= ids.length) return;
                        const a = ids[idx]!;
                        ids[idx] = ids[j]!;
                        ids[j] = a;
                        m.reorderBlocks.mutate(ids);
                      }}
                    />
                  ))
                )}
              </div>

              <div className="space-y-3">
                <Card>
                  <h2 className="mb-2 text-base font-semibold text-content">
                    {t("studio.editor.preview")}
                  </h2>
                  <p className="mb-3 text-sm text-content-muted">
                    {t("studio.editor.previewHint")}
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="rounded-control bg-surface-muted px-3 py-2 text-sm text-content hover:bg-line"
                      onClick={() => setPreviewAs("student")}
                    >
                      {t("studio.editor.previewStudent")}
                    </button>
                    <button
                      type="button"
                      className="rounded-control bg-surface-muted px-3 py-2 text-sm text-content hover:bg-line"
                      onClick={() => setPreviewAs("teacher")}
                    >
                      {t("studio.editor.previewTeacher")}
                    </button>
                  </div>
                </Card>
              </div>
            </div>

            {previewAs ? (
              <PreviewModal
                momentId={momentId}
                lang={lang}
                as={previewAs}
                onClose={() => setPreviewAs(null)}
              />
            ) : null}
          </>
        ) : null}
      </QueryState>
    </div>
  );
}

function PreviewModal({
  momentId,
  lang,
  as,
  onClose,
}: {
  momentId: string;
  lang: string;
  as: "student" | "teacher";
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [mobile, setMobile] = useState(false);
  const { data, isLoading, error } = useMomentPreview(
    momentId,
    lang as "es" | "en",
    as,
  );
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("common.cancel")}
        onClick={onClose}
        className="absolute inset-0 bg-content/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-card bg-surface p-5 shadow-card"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-content">
            {as === "student"
              ? t("studio.editor.previewStudent")
              : t("studio.editor.previewTeacher")}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobile((v) => !v)}
              className="rounded-control bg-surface-muted px-3 py-1.5 text-xs text-content hover:bg-line"
            >
              {mobile
                ? t("studio.editor.previewDesktop")
                : t("studio.editor.previewMobile")}
            </button>
            <button type="button" onClick={onClose} className="text-content-muted">
              ✕
            </button>
          </div>
        </div>
        <QueryState isLoading={isLoading} error={error}>
          {data ? (
            <div className="overflow-auto rounded-card bg-canvas p-4">
              <div
                className={`mx-auto space-y-4 ${mobile ? "max-w-[390px]" : ""}`}
              >
                <h3 className="text-lg font-semibold text-content">
                  {data.title ?? t("studio.editor.untitled")}
                </h3>
                {data.teacher_note ? (
                  <div className="rounded-control border border-brand-ink/30 bg-brand-ink/5 p-3 text-sm text-content">
                    <span className="mb-1 block text-xs font-semibold uppercase text-brand-ink">
                      {t("studio.field.teacherNote")}
                    </span>
                    <RichText html={data.teacher_note} />
                  </div>
                ) : null}
                <MomentBlocks blocks={data.blocks} />
              </div>
            </div>
          ) : null}
        </QueryState>
      </div>
    </div>
  );
}

function BlockCard({
  block,
  lang,
  first,
  last,
  onSave,
  onDelete,
  onMove,
}: {
  block: Block;
  lang: string;
  first: boolean;
  last: boolean;
  onSave: (fields: Record<string, unknown>) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState(block.body ?? "");
  const [caption, setCaption] = useState(block.caption ?? "");
  const [alt, setAlt] = useState(block.alt_text ?? "");
  const [provider, setProvider] = useState(
    (block.config?.provider as string | undefined) ?? "youtube",
  );
  const [embedSrc, setEmbedSrc] = useState(
    (block.config?.src as string | undefined) ?? "",
  );
  const [assetId, setAssetId] = useState<string | null>(block.media_asset_id);
  const [pickingMedia, setPickingMedia] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown>>(block.config ?? {});
  const interactivo = KINDS_INTERACTIVOS.has(block.kind);

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase text-content-subtle">
          {t(`studio.blockKind.${block.kind}`, block.kind)} · {lang.toUpperCase()}
        </span>
        <div className="flex gap-2 text-sm">
          {!first ? (
            <button type="button" onClick={() => onMove(-1)} aria-label="↑">
              ↑
            </button>
          ) : null}
          {!last ? (
            <button type="button" onClick={() => onMove(1)} aria-label="↓">
              ↓
            </button>
          ) : null}
          <button
            type="button"
            className="text-danger"
            onClick={() => {
              if (confirm(t("studio.action.confirmDelete"))) onDelete();
            }}
          >
            {t("studio.action.delete")}
          </button>
        </div>
      </div>

      {interactivo ? (
        <>
          {block.kind === "checklist" ? (
            <ChecklistEditor config={config} lang={lang} onChange={setConfig} />
          ) : block.kind === "inline_quiz" ? (
            <InlineQuizEditor config={config} lang={lang} onChange={setConfig} />
          ) : block.kind === "video_chapters" ? (
            <>
              <Field
                label={t("studio.field.media")}
                hint={t("studio.editor.mediaPickHint")}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPickingMedia(true)}
                    className="rounded-control bg-surface-muted px-3 py-2 text-sm text-content hover:bg-line"
                  >
                    {assetId
                      ? t("studio.editor.mediaChange")
                      : t("studio.editor.pickMedia")}
                  </button>
                  <span className="truncate text-xs text-content-subtle">
                    {assetId ?? t("studio.editor.mediaNone")}
                  </span>
                </div>
              </Field>
              <ChaptersEditor config={config} lang={lang} onChange={setConfig} />
            </>
          ) : (
            <EmbedInteractiveEditor
              config={config}
              onChange={setConfig}
              withProvider={block.kind === "embed_interactive"}
            />
          )}
        </>
      ) : block.kind === "text" ? (
        <Field label={t("studio.field.body")} hint={t("studio.editor.richTextHint")}>
          <RichTextEditor
            value={body}
            onChange={setBody}
            ariaLabel={t("studio.field.body")}
          />
        </Field>
      ) : block.kind === "embed" ? (
        <>
          <Field label={t("studio.field.embedProvider")}>
            <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="youtube">YouTube</option>
            </Select>
          </Field>
          <Field
            label={t("studio.field.embedSrc")}
            hint={t("studio.editor.embedSrcHint")}
          >
            <TextInput
              value={embedSrc}
              onChange={(e) => setEmbedSrc(e.target.value)}
              placeholder="https://youtu.be/…"
            />
          </Field>
          <Field label={t("studio.field.caption")}>
            <TextInput value={caption} onChange={(e) => setCaption(e.target.value)} />
          </Field>
        </>
      ) : (
        <>
          <Field label={t("studio.field.media")} hint={t("studio.editor.mediaPickHint")}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPickingMedia(true)}
                className="rounded-control bg-surface-muted px-3 py-2 text-sm text-content hover:bg-line"
              >
                {assetId
                  ? t("studio.editor.mediaChange")
                  : t("studio.editor.pickMedia")}
              </button>
              {assetId ? (
                <button
                  type="button"
                  onClick={() => setAssetId(null)}
                  className="text-sm text-danger hover:underline"
                >
                  {t("studio.editor.mediaClear")}
                </button>
              ) : null}
              <span className="truncate text-xs text-content-subtle">
                {assetId ?? t("studio.editor.mediaNone")}
              </span>
            </div>
          </Field>
          <Field label={t("studio.field.mediaRef")} hint={t("studio.editor.mediaRefHint")}>
            <TextArea
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <Field label={t("studio.field.caption")}>
            <TextInput value={caption} onChange={(e) => setCaption(e.target.value)} />
          </Field>
          <Field label={t("studio.field.altText")} hint={t("studio.editor.altHint")}>
            <TextInput value={alt} onChange={(e) => setAlt(e.target.value)} />
          </Field>
        </>
      )}

      {pickingMedia ? (
        <MediaPickerModal
          kind={block.kind}
          onPick={setAssetId}
          onClose={() => setPickingMedia(false)}
        />
      ) : null}

      <Button
        variant="ghost"
        onClick={() =>
          onSave(
            interactivo
              ? block.kind === "video_chapters"
                ? { config, media_asset_id: assetId }
                : { config }
              : block.kind === "embed"
                ? {
                    config: { provider, src: embedSrc },
                    caption: caption || null,
                  }
                : block.kind === "text"
                  ? { body: body || null }
                  : {
                      media_asset_id: assetId,
                      body: body || null,
                      caption: caption || null,
                      alt_text: alt || null,
                    },
          )
        }
      >
        {t("common.save")}
      </Button>
    </Card>
  );
}
