import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { RichTextView } from "@/lib/richText";
import { ApiError } from "@/lib/http";
import AssessmentEditor from "./AssessmentEditor";
import BlockCard from "./BlockCard";
import {
  claves,
  useCreateBlock,
  usePreviewMoment,
  useReorderBlocks,
  useStudioMoment,
  useUpdateMoment,
  type BlockKind,
  type Lang,
  type StudioMomentDetail,
} from "./api";

const TIPOS_DE_BLOQUE: BlockKind[] = ["text", "image", "audio", "video", "embed"];

function CamposDelMomento({ momentId, lang }: { momentId: string; lang: Lang }) {
  const { data } = useStudioMoment(momentId, lang);
  if (!data) return null;
  // `key={data.id}`: al cambiar de momento (navegación), el formulario
  // vuelve a montar y toma el estado inicial del momento nuevo. No se usa
  // `updated_at` como key para no perder lo que el editor esté escribiendo
  // en OTRO campo cada vez que un autoguardado exitoso mueve la marca.
  return <CamposDelMomentoForm key={data.id} momentId={momentId} lang={lang} moment={data} />;
}

function CamposDelMomentoForm({
  momentId,
  lang,
  moment,
}: {
  momentId: string;
  lang: Lang;
  moment: StudioMomentDetail;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const actualizar = useUpdateMoment(momentId, lang);

  const [title, setTitle] = useState(moment.title ?? "");
  const [teacherNote, setTeacherNote] = useState(moment.teacher_note ?? "");
  const [openingPrompt, setOpeningPrompt] = useState(moment.chatbot_opening_prompt ?? "");

  const conflicto = actualizar.error instanceof ApiError && actualizar.error.status === 409;
  // `moment.updated_at` viene del prop, que sigue al cache de React Query:
  // tras cada guardado exitoso o cada "Recargar" ya trae el valor fresco,
  // sin necesitar estado local propio para esto.
  const guardar = (
    campos: Partial<{ title: string; teacher_note: string; chatbot_opening_prompt: string }>,
  ) =>
    actualizar.mutate({
      title,
      teacher_note: teacherNote,
      chatbot_opening_prompt: openingPrompt,
      ...campos,
      expected_updated_at: moment.updated_at,
    });

  return (
    <div className="mb-4 space-y-2">
      {conflicto && (
        <div className="flex items-center justify-between rounded-xl border border-danger/30 bg-note p-3 text-xs">
          <span>{t("studio.saveConflict")}</span>
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: claves.moment(momentId, lang) })}
            className="underline"
          >
            {t("studio.reload")}
          </button>
        </div>
      )}
      <label className="block">
        <span className="text-sm font-medium">{t("studio.momentTitle")}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => guardar({ title })}
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t("studio.teacherNote")}</span>
        <textarea
          value={teacherNote}
          onChange={(e) => setTeacherNote(e.target.value)}
          onBlur={() => guardar({ teacher_note: teacherNote })}
          rows={2}
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t("studio.openingPrompt")}</span>
        <input
          value={openingPrompt}
          onChange={(e) => setOpeningPrompt(e.target.value)}
          onBlur={() => guardar({ chatbot_opening_prompt: openingPrompt })}
          className={fieldClass}
        />
      </label>
    </div>
  );
}

function BloquesDelMomento({ momentId, lang }: { momentId: string; lang: Lang }) {
  const { t } = useTranslation();
  const { data } = useStudioMoment(momentId, lang);
  const crear = useCreateBlock(momentId, lang);
  const reordenar = useReorderBlocks(momentId);
  // Sin `KeyboardSensor` reordenar era IMPOSIBLE sin ratón (I4): el asa de
  // arrastre no respondía al teclado, así que un usuario que no use ratón no
  // podía cambiar el orden de ninguna manera.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!data) return null;
  const bloques = data.blocks;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = bloques.map((b) => b.id);
    const desde = ids.indexOf(String(active.id));
    const hasta = ids.indexOf(String(over.id));
    if (desde === -1 || hasta === -1) return;
    reordenar.mutate(arrayMove(ids, desde, hasta));
  };

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={bloques.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {bloques.map((b) => (
              <BlockCard key={b.id} block={b} momentId={momentId} lang={lang} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="mt-3 flex flex-wrap gap-2">
        {TIPOS_DE_BLOQUE.map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => crear.mutate({ kind })}
          >
            + {t(`studio.blockKinds.${kind}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function EvaluacionSiAplica({ momentId, lang }: { momentId: string; lang: Lang }) {
  // R7: solo el momento 6 (`assess`) lleva evaluación. `useStudioMoment` ya
  // está en caché (lo pidió `CamposDelMomento`), así que esto no repite la
  // petición.
  const { data } = useStudioMoment(momentId, lang);
  if (data?.type !== "assess") return null;
  return <AssessmentEditor momentId={momentId} lang={lang} />;
}

function VistaPrevia({
  momentId,
  lang,
  as_,
  onClose,
}: {
  momentId: string;
  lang: Lang;
  as_: "student" | "teacher";
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = usePreviewMoment(momentId, lang, as_);

  return (
    <div className="mb-4 rounded-2xl border border-line p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-sm">
          {t("studio.previewAs")}:{" "}
          {as_ === "teacher" ? t("studio.previewTeacher") : t("studio.previewStudent")}
        </strong>
        <button type="button" onClick={onClose} className="text-sm underline">
          {t("studio.closePreview")}
        </button>
      </div>
      {isLoading && <p>{t("common.loading")}</p>}
      {data && (
        <div className="prose prose-sm max-w-none">
          <h4>{data.title ?? t("studio.untitled")}</h4>
          {data.teacher_note && (
            <p className="rounded-xl border border-note-line bg-note p-3 text-note-content">
              {data.teacher_note}
            </p>
          )}
          {data.blocks.map((b) => (
            <div key={b.id}>
              {b.kind === "text" && <RichTextView html={b.body ?? ""} />}
              {b.kind === "image" && (
                <img src={b.body ?? ""} alt={b.alt_text ?? ""} className="max-w-full" />
              )}
              {b.kind === "audio" && <audio controls src={b.body ?? ""} className="w-full" />}
              {(b.kind === "video" || b.kind === "embed") && (
                <div className="aspect-video">
                  <iframe
                    src={b.body ?? ""}
                    title={b.caption ?? "preview"}
                    className="h-full w-full rounded"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MomentEditor({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const { projectId, momentId = "" } = useParams();
  const [bilingue, setBilingue] = useState(false);
  const [previewAs, setPreviewAs] = useState<"student" | "teacher" | null>(null);

  return (
    <div>
      <Link
        to={`/studio/projects/${projectId}`}
        className="text-sm text-content-subtle hover:underline"
      >
        ← {t("studio.back")}
      </Link>

      <div className="my-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setBilingue((v) => !v)}>
          {bilingue ? t("studio.singleLangView") : t("studio.bilingualView")}
        </Button>
        <div className="ml-auto flex gap-1">
          {(["student", "teacher"] as const).map((rol) => (
            <Button
              key={rol}
              type="button"
              size="sm"
              variant={previewAs === rol ? "primary" : "secondary"}
              aria-pressed={previewAs === rol}
              onClick={() => setPreviewAs((v) => (v === rol ? null : rol))}
            >
              {t("studio.previewAs")}: {rol === "teacher" ? t("studio.previewTeacher") : t("studio.previewStudent")}
            </Button>
          ))}
        </div>
      </div>

      {previewAs && (
        <VistaPrevia
          momentId={momentId}
          lang={lang}
          as_={previewAs}
          onClose={() => setPreviewAs(null)}
        />
      )}

      {bilingue ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {(["es", "en"] as Lang[]).map((codigo) => (
            <div key={codigo}>
              <h3 className="mb-2 text-xs font-semibold uppercase text-content-subtle">
                {codigo}
              </h3>
              <CamposDelMomento momentId={momentId} lang={codigo} />
              <BloquesDelMomento momentId={momentId} lang={codigo} />
              <EvaluacionSiAplica momentId={momentId} lang={codigo} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <CamposDelMomento momentId={momentId} lang={lang} />
          <BloquesDelMomento momentId={momentId} lang={lang} />
          <EvaluacionSiAplica momentId={momentId} lang={lang} />
        </>
      )}
    </div>
  );
}
