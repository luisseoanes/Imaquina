/** Momento 6: la evaluación del estudiante (R10, A2/A3).
 *
 *  El ciclo real del backend, sin atajos:
 *  1. `GET /learn/assessments/moments/{momentId}` — las preguntas SIN la clave
 *     de respuestas. Un 404 significa que el editor todavía no construyó la
 *     evaluación de ese momento, que es un estado normal del contenido.
 *  2. `GET .../attempts/mine` — para retomar un intento abierto en vez de
 *     perderlo, y para saber cuántos quedan (`max_attempts` lo fija el docente).
 *  3. `POST .../attempts` → `PATCH .../answers` (parcial, tantas veces como
 *     haga falta) → `POST .../submit`.
 *
 *  **El guardado es automático** y con retardo: son menores respondiendo desde
 *  el celular en una sala de robótica, y perder media evaluación por una
 *  desconexión no es aceptable. El envío guarda antes de enviar, porque el
 *  último cambio puede no haber salido todavía.
 *
 *  La calificación NO se calcula aquí: las cerradas las resuelve el servidor al
 *  enviar y las abiertas las califica el docente. Esta pantalla sólo muestra lo
 *  que el intento ya trae.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/shared/api/ApiError";
import { Button, Card, PastelBadge, TextArea, TextInput } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import type { Lang } from "@/shared/config/roles";
import { useAssessment, useAttemptMutations, useMyAttempts } from "../api";
import type { AnswerInput, Attempt, Question, StudentAssessment } from "../api";

type Respuestas = Record<string, AnswerInput>;

export function AssessmentPlayer({
  momentId,
  lang,
}: {
  momentId: string;
  lang: Lang;
}) {
  const { t } = useTranslation();
  const evaluacion = useAssessment(momentId, lang);

  if (evaluacion.isLoading) {
    return (
      <p role="status" className="p-4 text-sm text-content-muted">
        {t("common.loading")}
      </p>
    );
  }

  if (evaluacion.error || !evaluacion.data) {
    const sinConstruir =
      evaluacion.error instanceof ApiError && evaluacion.error.status === 404;
    return (
      <Card>
        <p className="text-sm text-content-muted">
          {sinConstruir
            ? t("student.assessment.notReady")
            : t("common.error")}
        </p>
      </Card>
    );
  }

  return <Runner assessment={evaluacion.data} />;
}

function Runner({ assessment }: { assessment: StudentAssessment }) {
  const { t } = useTranslation();
  const intentos = useMyAttempts(assessment.id);
  const { start } = useAttemptMutations(assessment.id);

  const [equipo, setEquipo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lista = intentos.data ?? [];
  const abierto = lista.find((a) => a.status === "in_progress") ?? null;
  const cerrados = lista.filter((a) => a.status !== "in_progress");
  const restantes = Math.max(0, assessment.max_attempts - lista.length);

  if (intentos.isLoading) {
    return (
      <p role="status" className="p-4 text-sm text-content-muted">
        {t("common.loading")}
      </p>
    );
  }

  if (abierto) {
    return <Formulario assessment={assessment} attempt={abierto} />;
  }

  return (
    <div className="space-y-4">
      {cerrados.map((a) => (
        <Resultado key={a.id} attempt={a} assessment={assessment} />
      ))}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-content">
              {cerrados.length === 0
                ? t("student.assessment.startTitle")
                : t("student.assessment.retryTitle")}
            </p>
            <p className="mt-1 text-sm text-content-muted">
              {t("student.assessment.attemptsLeft", { count: restantes })}
              {" · "}
              {t("student.assessment.questions", {
                count: assessment.questions.length,
              })}
            </p>
            {assessment.team_mode ? (
              <label className="mt-3 block max-w-xs">
                <span className="mb-1 block text-sm font-medium text-content">
                  {t("student.assessment.teamLabel")}
                </span>
                <TextInput
                  value={equipo}
                  onChange={(e) => setEquipo(e.target.value)}
                  placeholder={t("student.assessment.teamPlaceholder")}
                />
              </label>
            ) : null}
          </div>
          <Button
            disabled={restantes === 0 || start.isPending}
            onClick={() => {
              setError(null);
              start
                .mutateAsync(assessment.team_mode ? equipo || null : null)
                .catch((e: unknown) =>
                  setError(e instanceof ApiError ? e.message : t("common.error")),
                );
            }}
          >
            <Icon name="play" className="h-4 w-4" />
            {cerrados.length === 0
              ? t("student.assessment.start")
              : t("student.assessment.retry")}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-danger-surface p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {restantes === 0 ? (
          <p className="mt-3 text-sm text-content-muted">
            {t("student.assessment.noAttemptsLeft")}
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function respuestasIniciales(attempt: Attempt): Respuestas {
  const out: Respuestas = {};
  for (const a of attempt.answers) {
    out[a.question_id] = {
      question_id: a.question_id,
      choice_id: a.choice_id,
      value_text: a.value_text,
      value_numeric: a.value_numeric,
    };
  }
  return out;
}

function Formulario({
  assessment,
  attempt,
}: {
  assessment: StudentAssessment;
  attempt: Attempt;
}) {
  const { t } = useTranslation();
  // Las mutaciones se piden AQUI y no llegan como props: `mutateAsync` es
  // estable entre renders y el autoguardado depende de ello, mientras que una
  // funcion flecha creada por el padre cambia de identidad en cada render y
  // reiniciaria el temporizador sin parar.
  const { save, submit } = useAttemptMutations(assessment.id);
  const guardar = save.mutateAsync;
  const enviarIntento = submit.mutateAsync;
  const [respuestas, setRespuestas] = useState<Respuestas>(() =>
    respuestasIniciales(attempt),
  );
  const [estado, setEstado] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const sucio = useRef(false);

  const answers = useMemo(() => Object.values(respuestas), [respuestas]);

  const responder = (question_id: string, parcial: Partial<AnswerInput>) => {
    sucio.current = true;
    setRespuestas((v) => ({
      ...v,
      [question_id]: { ...v[question_id], question_id, ...parcial },
    }));
  };

  // Autoguardado con retardo. El temporizador se reinicia con cada cambio, así
  // que escribir seguido manda UNA petición al parar, no una por tecla.
  useEffect(() => {
    if (!sucio.current || answers.length === 0) return;
    const id = setTimeout(() => {
      setEstado("saving");
      guardar({ attemptId: attempt.id, answers })
        .then(() => setEstado("saved"))
        .catch(() => setEstado("error"));
    }, 1200);
    return () => clearTimeout(id);
  }, [answers, attempt.id, guardar]);

  async function enviar() {
    setError(null);
    try {
      // El último cambio puede seguir en el temporizador: se guarda antes de
      // enviar o esa respuesta se pierde.
      if (answers.length > 0) await guardar({ attemptId: attempt.id, answers });
      await enviarIntento(attempt.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("common.error"));
    }
  }

  const sinResponder = assessment.questions.filter(
    (q) => !tieneRespuesta(respuestas[q.id]),
  ).length;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-content-muted">
          {t("student.assessment.inProgress")}
          {attempt.team_label ? ` · ${attempt.team_label}` : ""}
        </p>
        <span className="text-xs text-content-subtle" aria-live="polite">
          {estado === "saving" ? t("student.assessment.saving") : null}
          {estado === "saved" ? t("student.assessment.saved") : null}
          {estado === "error" ? t("student.assessment.saveError") : null}
        </span>
      </Card>

      {assessment.questions.map((q, i) => (
        <Pregunta
          key={q.id}
          index={i + 1}
          question={q}
          value={respuestas[q.id]}
          onChange={(parcial) => responder(q.id, parcial)}
        />
      ))}

      {error ? (
        <p role="alert" className="rounded-2xl bg-danger-surface p-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void enviar()} disabled={submit.isPending}>
          {submit.isPending
            ? t("student.assessment.submitting")
            : t("student.assessment.submit")}
        </Button>
        {sinResponder > 0 ? (
          <p className="text-sm text-content-muted">
            {t("student.assessment.unanswered", { count: sinResponder })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function tieneRespuesta(a: AnswerInput | undefined): boolean {
  if (!a) return false;
  return (
    !!a.choice_id ||
    (a.value_text ?? "").trim().length > 0 ||
    (a.value_numeric !== null && a.value_numeric !== undefined)
  );
}

function Pregunta({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: Question;
  value: AnswerInput | undefined;
  onChange: (parcial: Partial<AnswerInput>) => void;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="font-display text-base font-bold text-content">
          <span className="text-content-subtle">{index}. </span>
          {question.prompt ?? t("student.assessment.untitledQuestion")}
        </p>
        <PastelBadge tone="neutral">
          {t("student.assessment.points", { count: question.points })}
        </PastelBadge>
      </div>

      {question.kind === "mcq" || question.kind === "true_false" ? (
        <fieldset className="space-y-2">
          <legend className="sr-only">
            {question.prompt ?? t("student.assessment.untitledQuestion")}
          </legend>
          {question.choices.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center gap-3 rounded-control border px-3 py-2.5 text-sm transition duration-150 ${
                value?.choice_id === c.id
                  ? "border-brand-ink bg-brand-wash text-content"
                  : "border-line bg-canvas text-content-muted hover:border-line-strong"
              }`}
            >
              <input
                type="radio"
                name={question.id}
                checked={value?.choice_id === c.id}
                onChange={() => onChange({ choice_id: c.id })}
                className="h-4 w-4 accent-[var(--color-brand-ink)]"
              />
              <span>{c.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {question.kind === "open" ? (
        <TextArea
          rows={4}
          value={value?.value_text ?? ""}
          onChange={(e) => onChange({ value_text: e.target.value })}
          placeholder={t("student.assessment.openPlaceholder")}
          aria-label={question.prompt ?? t("student.assessment.untitledQuestion")}
        />
      ) : null}

      {question.kind === "numeric" ? (
        <TextInput
          type="number"
          inputMode="decimal"
          value={value?.value_numeric ?? ""}
          onChange={(e) =>
            onChange({
              value_numeric: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className="max-w-40"
          aria-label={question.prompt ?? t("student.assessment.untitledQuestion")}
        />
      ) : null}
    </Card>
  );
}

/** Un intento ya enviado. `submitted` = queda alguna abierta por calificar;
 *  `graded` = el docente ya cerró la nota. */
function Resultado({
  attempt,
  assessment,
}: {
  attempt: Attempt;
  assessment: StudentAssessment;
}) {
  const { t } = useTranslation();
  const porPregunta = new Map(attempt.answers.map((a) => [a.question_id, a]));
  const total = assessment.questions.reduce((s, q) => s + q.points, 0);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold text-content">
            {t("student.assessment.resultTitle")}
          </p>
          <p className="mt-0.5 text-xs text-content-subtle">
            {attempt.submitted_at
              ? new Date(attempt.submitted_at).toLocaleString()
              : null}
            {attempt.team_label ? ` · ${attempt.team_label}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PastelBadge tone={attempt.status === "graded" ? "success" : "info"}>
            {t(`student.attemptStatus.${attempt.status}`)}
          </PastelBadge>
          <span className="font-display text-xl font-extrabold text-content">
            {attempt.score ?? "—"}
            <span className="text-sm font-semibold text-content-subtle">/{total}</span>
          </span>
        </div>
      </div>

      <ul className="divide-y divide-line">
        {assessment.questions.map((q, i) => {
          const a = porPregunta.get(q.id);
          return (
            <li key={q.id} className="flex items-start gap-3 py-2.5">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold">
                {a?.is_correct === true ? (
                  <Icon name="check" className="h-4 w-4 text-success" />
                ) : a?.is_correct === false ? (
                  <Icon name="close" className="h-4 w-4 text-danger" />
                ) : (
                  <span className="text-content-subtle">{i + 1}</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-content">{q.prompt ?? "—"}</p>
                {a?.teacher_feedback ? (
                  <p className="mt-1 rounded-xl bg-info-surface px-3 py-2 text-xs text-info">
                    {a.teacher_feedback}
                  </p>
                ) : null}
                {q.kind === "open" && a?.teacher_score === null ? (
                  <p className="mt-1 text-xs text-content-subtle">
                    {t("student.assessment.pendingGrading")}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
