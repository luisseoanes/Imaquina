import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAttempts, useExportStatus, useGradeAnswer, useTriggerExport, type Attempt } from "./resultsApi";

function CalificarAbierta({ assessmentId, answer }: { assessmentId: string; answer: Attempt["answers"][number] }) {
  const { t } = useTranslation();
  const calificar = useGradeAnswer(assessmentId);
  const [score, setScore] = useState(answer.teacher_score?.toString() ?? "");

  if (answer.teacher_score !== null) {
    return (
      <p className="text-xs text-content-subtle">
        {t("assessment.graded")}: {answer.teacher_score}
      </p>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <p className="flex-1 text-xs">{answer.value_text}</p>
      <input
        type="number"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        className="w-16 rounded border px-1 py-0.5 text-xs"
        placeholder={t("assessment.points")}
      />
      <button
        onClick={() => score && calificar.mutate({ id: answer.id, teacher_score: Number(score) })}
        className="rounded border px-2 py-0.5 text-xs"
      >
        {t("assessment.grade")}
      </button>
    </div>
  );
}

/** Tablero de resultados (A5, A9): un intento por fila, calificación manual
 *  inline para las abiertas y exportar a Excel. */
export default function AssessmentResults({ assessmentId }: { assessmentId: string }) {
  const { t } = useTranslation();
  const { data: intentos } = useAttempts(assessmentId);
  const exportar = useTriggerExport(assessmentId);
  const [pidiendoExport, setPidiendoExport] = useState(false);
  const estado = useExportStatus(assessmentId, pidiendoExport);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">{t("teacher.results")}</h3>
        <button
          onClick={() => {
            setPidiendoExport(true);
            exportar.mutate();
          }}
          className="rounded border px-3 py-1.5 text-sm"
        >
          {t("teacher.export")}
        </button>
      </div>
      {pidiendoExport && estado.data?.status === "listo" && estado.data.url && (
        <a href={estado.data.url} target="_blank" rel="noreferrer" className="mb-3 block text-sm text-brand-ink underline">
          {t("assessment.downloadReady")}
        </a>
      )}
      {pidiendoExport && estado.data?.status !== "listo" && (
        <p className="mb-3 text-sm text-content-subtle">{t("assessment.exporting")}</p>
      )}

      <ul className="divide-y rounded border">
        {intentos?.map((a) => (
          <li key={a.id} className="p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="flex-1">{a.team_label ?? a.id.slice(0, 8)}</span>
              <span className="text-content-subtle">{t(`assessment.status.${a.status}`)}</span>
              <span className="font-medium">{a.score ?? "—"}</span>
            </div>
            {a.answers
              .filter((ans) => ans.value_text !== null && ans.is_correct === null)
              .map((ans) => (
                <CalificarAbierta key={ans.id} assessmentId={assessmentId} answer={ans} />
              ))}
          </li>
        ))}
        {intentos?.length === 0 && (
          <li className="p-3 text-sm text-content-subtle">{t("assessment.noAttempts")}</li>
        )}
      </ul>
    </div>
  );
}
