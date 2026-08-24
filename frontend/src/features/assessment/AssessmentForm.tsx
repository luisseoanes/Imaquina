import { useState } from "react";
import { useTranslation } from "react-i18next";

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
      <section className="mt-8 rounded border p-4">
        <h2 className="mb-2 font-medium">{t("assessment.title")}</h2>
        <p className="text-sm">
          {t("assessment.submitted")}: {resultado.score ?? "—"} ·{" "}
          {t(`assessment.status.${resultado.status}`)}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded border p-4">
      <h2 className="mb-3 font-medium">{t("assessment.title")}</h2>
      <div className="space-y-4">
        {assessment.questions.map((q) => (
          <div key={q.id}>
            <p className="mb-1 text-sm font-medium">{q.prompt}</p>
            {(q.kind === "mcq" || q.kind === "true_false") && (
              <div className="space-y-1">
                {q.choices.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      defaultChecked={respuestaDe(q.id)?.choice_id === c.id}
                      onChange={() => guardar.mutate([{ question_id: q.id, choice_id: c.id }])}
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
                className="w-full rounded border px-2 py-1 text-sm"
              />
            )}
            {q.kind === "open" && (
              <textarea
                defaultValue={respuestaDe(q.id)?.value_text ?? ""}
                onBlur={(e) => guardar.mutate([{ question_id: q.id, value_text: e.target.value }])}
                rows={3}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => enviar.mutate(attempt.id, { onSuccess: setResultado })}
        disabled={enviar.isPending}
        className="mt-4 rounded bg-brand px-4 py-2 text-sm text-brand-content disabled:opacity-50"
      >
        {t("assessment.submit")}
      </button>
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
    <section className="mt-8 rounded border p-4">
      <h2 className="mb-2 font-medium">{t("assessment.title")}</h2>
      {ultimo && (
        <p className="mb-3 text-sm text-content-muted">
          {t("assessment.lastScore")}: {ultimo.score ?? "—"} ·{" "}
          {t(`assessment.status.${ultimo.status}`)}
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
              className="mb-2 w-full rounded border px-2 py-1 text-sm"
            />
          )}
          <button
            onClick={() => iniciar.mutate(teamLabel || undefined)}
            disabled={iniciar.isPending}
            className="rounded bg-brand px-4 py-2 text-sm text-brand-content disabled:opacity-50"
          >
            {t("assessment.start")}
          </button>
          {iniciar.error instanceof ApiError && (
            <p className="mt-2 text-sm text-danger">{iniciar.error.message}</p>
          )}
        </>
      )}
    </section>
  );
}
