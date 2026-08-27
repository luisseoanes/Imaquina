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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, fieldClass } from "@/components/ui/Field";
import {
  useAddChoice,
  useAssessment,
  useCreateQuestion,
  useDeleteChoice,
  useDeleteQuestion,
  useReorderQuestions,
  useUpdateAssessment,
  useUpdateChoice,
  useUpdateQuestion,
  type Choice,
  type Question,
  type QuestionKind,
} from "./assessmentApi";
import type { Lang } from "./api";

const TIPOS: QuestionKind[] = ["mcq", "true_false", "open", "numeric"];

function OpcionesDeChoice({
  question,
  lang,
}: {
  question: Question;
  lang: Lang;
}) {
  const { t } = useTranslation();
  const agregar = useAddChoice(lang);
  const actualizar = useUpdateChoice(lang);
  const borrar = useDeleteChoice();

  return (
    <div className="ml-4 mt-2 space-y-1">
      {question.choices.map((c: Choice) => (
        <div key={c.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={c.is_correct}
            onChange={(e) => actualizar.mutate({ id: c.id, is_correct: e.target.checked })}
            title={t("assessment.correct")}
          />
          <input
            defaultValue={c.label ?? ""}
            onBlur={(e) => actualizar.mutate({ id: c.id, label: e.target.value })}
            className="flex-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm
                       transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            placeholder={t("assessment.choiceLabel")}
          />
          <button onClick={() => borrar.mutate(c.id)} className="text-xs text-danger hover:underline">
            {t("studio.deleteBlock")}
          </button>
        </div>
      ))}
      <button
        onClick={() => agregar.mutate({ questionId: question.id, label: "", is_correct: false })}
        className="text-xs text-brand-ink hover:underline"
      >
        + {t("assessment.addChoice")}
      </button>
    </div>
  );
}

function TarjetaDePregunta({ question, lang }: { question: Question; lang: Lang }) {
  const { t } = useTranslation();
  const actualizar = useUpdateQuestion(lang);
  const borrar = useDeleteQuestion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

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
        <Badge>{t(`assessment.kinds.${question.kind}`)}</Badge>
        <input
          type="number"
          defaultValue={question.points}
          onBlur={(e) => actualizar.mutate({ id: question.id, points: Number(e.target.value) })}
          className="w-16 rounded-xl border border-line bg-surface px-2 py-1 text-sm
                     focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          title={t("assessment.points")}
        />
        <button
          onClick={() => borrar.mutate(question.id)}
          className="ml-auto text-xs text-danger hover:underline"
        >
          {t("studio.deleteBlock")}
        </button>
      </div>

      <textarea
        defaultValue={question.prompt ?? ""}
        onBlur={(e) => actualizar.mutate({ id: question.id, prompt: e.target.value })}
        rows={2}
        placeholder={t("assessment.prompt")}
        className={fieldClass}
      />

      {(question.kind === "mcq" || question.kind === "true_false") && (
        <OpcionesDeChoice question={question} lang={lang} />
      )}

      {question.kind === "numeric" && (
        <input
          type="number"
          defaultValue={question.correct_numeric ?? ""}
          onBlur={(e) =>
            actualizar.mutate({ id: question.id, correct_numeric: Number(e.target.value) })
          }
          placeholder={t("assessment.correctNumeric")}
          className={fieldClass}
        />
      )}
    </li>
  );
}

/** Constructor de preguntas del momento de evaluación (A1, A10). Mismo
 *  patrón que `BloquesDelMomento`: tarjetas reordenables por drag. */
export default function AssessmentEditor({ momentId, lang }: { momentId: string; lang: Lang }) {
  const { t } = useTranslation();
  const { data } = useAssessment(momentId, lang);
  const actualizarAssessment = useUpdateAssessment(momentId, lang);
  const crear = useCreateQuestion(data?.id ?? "", lang);
  const reordenar = useReorderQuestions(data?.id ?? "");
  const [tipoNuevo, setTipoNuevo] = useState<QuestionKind>("mcq");
  // Sin `KeyboardSensor` reordenar era IMPOSIBLE sin ratón (I4): el asa de
  // arrastre no respondía al teclado, así que un usuario que no use ratón no
  // podía cambiar el orden de ninguna manera.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!data) return null;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = data.questions.map((q) => q.id);
    const desde = ids.indexOf(String(active.id));
    const hasta = ids.indexOf(String(over.id));
    if (desde === -1 || hasta === -1) return;
    reordenar.mutate(arrayMove(ids, desde, hasta));
  };

  return (
    <div className="mt-6 rounded-2xl border border-line p-4 shadow-sm">
      <h3 className="mb-3 font-medium">{t("assessment.builderTitle")}</h3>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label={t("assessment.maxAttempts")}>
          <input
            type="number"
            min={1}
            defaultValue={data.max_attempts}
            onBlur={(e) =>
              actualizarAssessment.mutate({ id: data.id, max_attempts: Number(e.target.value) })
            }
            className={fieldClass}
          />
        </Field>
        <Field label={t("assessment.passScore")}>
          <input
            type="number"
            defaultValue={data.pass_score}
            onBlur={(e) =>
              actualizarAssessment.mutate({ id: data.id, pass_score: Number(e.target.value) })
            }
            className={fieldClass}
          />
        </Field>
        <label className="flex items-end gap-2">
          <input
            type="checkbox"
            checked={data.team_mode}
            onChange={(e) => actualizarAssessment.mutate({ id: data.id, team_mode: e.target.checked })}
          />
          <span className="text-sm font-medium">{t("assessment.teamMode")}</span>
        </label>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={data.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {data.questions.map((q) => (
              <TarjetaDePregunta key={q.id} question={q} lang={lang} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="mt-3 flex gap-2">
        <select
          value={tipoNuevo}
          onChange={(e) => setTipoNuevo(e.target.value as QuestionKind)}
          className="rounded-xl border border-line bg-surface px-2 py-1.5 text-sm
                     focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          {TIPOS.map((k) => (
            <option key={k} value={k}>
              {t(`assessment.kinds.${k}`)}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={() => crear.mutate({ kind: tipoNuevo })}>
          + {t("assessment.addQuestion")}
        </Button>
      </div>
    </div>
  );
}
