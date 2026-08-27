import { CircleCheck, ClipboardList } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { ApiError } from "@/lib/http";
import {
  useMyAttempts,
  useSaveAnswers,
  useStartAttempt,
  useStudentAssessment,
  useSubmitAttempt,
  type Attempt,
  type StudentAssessment,
} from "./api";

function FormularioDeIntento({
  assessment,
  attempt,
}: {
  assessment: StudentAssessment;
  attempt: Attempt;
}) {
  const { t } = useTranslation();
  const guardar = useSaveAnswers(attempt.id);
  const enviar = useSubmitAttempt(assessment.id);
  const [resultado, setResultado] = useState<Attempt | null>(null);

  const respuestaDe = (qid: string) => attempt.answers.find((a) => a.question_id === qid);

  if (resultado) {
    return (
      <section className="mt-8 rounded-2xl border border-line p-4 shadow-sm sm:p-6">
        <h2 className="mb-2 flex items-center gap-2 font-medium">
          <CircleCheck className="text-success-content" size={18} aria-hidden />
          {t("assessment.title")}
        </h2>
        <p className="text-sm">
          {t("assessment.submitted")}: {resultado.score ?? "—"} ·{" "}
          {t(`assessment.status.${resultado.status}`)}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-line p-4 shadow-sm sm:p-6">
      <h2 className="mb-3 flex items-center gap-2 font-medium">
        <ClipboardList className="text-brand-ink" size={18} aria-hidden />
        {t("assessment.title")}
      </h2>
      <div className="space-y-5">
        {assessment.questions.map((q) => (
          <div key={q.id}>
            <p className="mb-2 text-sm font-medium">{q.prompt}</p>
            {(q.kind === "mcq" || q.kind === "true_false") && (
              <div className="space-y-1.5">
                {q.choices.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 rounded-xl border border-line px-3 py-2
                               text-sm transition hover:bg-surface-muted has-[:checked]:border-brand
                               has-[:checked]:bg-brand/5"
                  >
                    <input
                      type="radio"
                      name={q.id}
                      defaultChecked={respuestaDe(q.id)?.choice_id === c.id}
                      onChange={() => guardar.mutate([{ question_id: q.id, choice_id: c.id }])}
                      className="accent-brand"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
            {q.kind === "numeric" && (
              <input
                type="number"
                defaultValue={respuestaDe(q.id)?.value_numeric ?? ""}
                onBlur={(e) =>
                  guardar.mutate([{ question_id: q.id, value_numeric: Number(e.target.value) }])
                }
                className={fieldClass}
              />
            )}
            {q.kind === "open" && (
              <textarea
                defaultValue={respuestaDe(q.id)?.value_text ?? ""}
                onBlur={(e) => guardar.mutate([{ question_id: q.id, value_text: e.target.value }])}
                rows={3}
                className={fieldClass}
              />
            )}
          </div>
        ))}
      </div>
      <Button
        onClick={() => enviar.mutate(attempt.id, { onSuccess: setResultado })}
        disabled={enviar.isPending}
        className="mt-5"
      >
        {t("assessment.submit")}
      </Button>
    </section>
  );
}

/** Momento 6 (R10): formulario de evaluación. `useStudentAssessment` da 404
 *  para cualquier otro momento -- no se muestra nada, sin más. */
export default function AssessmentForm({ momentId }: { momentId: string }) {
  const { t } = useTranslation();
  const { data: assessment, isLoading, error } = useStudentAssessment(momentId);
  const { data: intentos } = useMyAttempts(assessment?.id);
  const iniciar = useStartAttempt(assessment?.id ?? "");
  const [teamLabel, setTeamLabel] = useState("");

  if (isLoading || error || !assessment) return null;

  const enCurso = intentos?.find((a) => a.status === "in_progress");
  if (enCurso) return <FormularioDeIntento assessment={assessment} attempt={enCurso} />;

  const usados = intentos?.length ?? 0;
  const agotados = usados >= assessment.max_attempts;
  const ultimo = intentos?.[0];

  return (
    <section className="mt-8 rounded-2xl border border-line p-4 shadow-sm sm:p-6">
      <h2 className="mb-2 flex items-center gap-2 font-medium">
        <ClipboardList className="text-brand-ink" size={18} aria-hidden />
        {t("assessment.title")}
      </h2>
      {ultimo && (
        <p className="mb-3 flex items-center gap-2 text-sm text-content-muted">
          <Badge tone={ultimo.status === "graded" ? "success" : "neutral"}>
            {t(`assessment.status.${ultimo.status}`)}
          </Badge>
          {t("assessment.lastScore")}: {ultimo.score ?? "—"}
        </p>
      )}
      {agotados ? (
        <p className="text-sm text-danger">{t("assessment.noAttemptsLeft")}</p>
      ) : (
        <>
          {assessment.team_mode && (
            <input
              value={teamLabel}
              onChange={(e) => setTeamLabel(e.target.value)}
              placeholder={t("assessment.teamLabel")}
              className={`mb-3 ${fieldClass}`}
            />
          )}
          <Button
            onClick={() => iniciar.mutate(teamLabel || undefined)}
            disabled={iniciar.isPending}
          >
            {t("assessment.start")}
          </Button>
          {iniciar.error instanceof ApiError && (
            <p className="mt-2 text-sm text-danger">{iniciar.error.message}</p>
          )}
        </>
      )}
    </section>
  );
}
