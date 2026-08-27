import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, fieldClass } from "@/components/ui/Field";
import AssessmentResults from "./AssessmentResults";
import { useCourseProgress, useMyCourses, usePublishedProjects, useProjectMoments } from "./api";
import { useAssessmentIdForMoment } from "./resultsApi";

// Mismo orden que `MOMENT_ORDER` en el backend (R7): fijo, no depende del proyecto.
const MOMENT_TYPES = ["intro", "inquiry", "design", "build", "communicate", "assess"];

export default function TeacherPage() {
  const { t } = useTranslation();
  const { data: cursos } = useMyCourses();
  const { data: proyectos } = usePublishedProjects();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const { data: progreso, isLoading } = useCourseProgress(courseId, projectId);

  // A9: el momento 6 (`assess`) del proyecto elegido, si lo tiene.
  const { data: proyectoDetalle } = useProjectMoments(projectId);
  const momentoAssess = proyectoDetalle?.moments.find((m) => m.type === "assess");
  const { data: assessmentRef } = useAssessmentIdForMoment(momentoAssess?.id ?? null);

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="mb-4 font-display text-xl font-bold">{t("teacher.panelTitle")}</h1>

      <div className="mb-6 grid gap-3 rounded-2xl border border-line p-4 shadow-sm sm:grid-cols-2">
        <Field label={t("teacher.course")}>
          <select
            value={courseId ?? ""}
            onChange={(e) => setCourseId(e.target.value || null)}
            className={fieldClass}
          >
            <option value="">{t("teacher.pickCourse")}</option>
            {cursos?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("studio.title")}>
          <select
            value={projectId ?? ""}
            onChange={(e) => setProjectId(e.target.value || null)}
            className={fieldClass}
          >
            <option value="">{t("teacher.pickProject")}</option>
            {proyectos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {isLoading && <p>{t("common.loading")}</p>}

      {courseId && projectId && progreso && (
        <div className="overflow-x-auto rounded-2xl border border-line shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted text-left">
                <th className="p-3">{t("teacher.student")}</th>
                {MOMENT_TYPES.map((tipo) => (
                  <th key={tipo} className="p-3 text-center">
                    {t(`moments.${tipo}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {progreso.map((fila) => (
                <tr key={fila.user_id} className="border-b border-line last:border-0">
                  <td className="p-3">{fila.full_name}</td>
                  {MOMENT_TYPES.map((tipo) => {
                    const estado = fila.progress[tipo] ?? "not_started";
                    return (
                      <td key={tipo} className="p-3 text-center">
                        <span
                          className={`inline-block size-3 rounded-full ${
                            estado === "completed"
                              ? "bg-success"
                              : estado === "in_progress"
                                ? "bg-brand"
                                : "bg-surface-muted"
                          }`}
                          title={estado}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assessmentRef && (
        <div className="mt-8">
          <AssessmentResults assessmentId={assessmentRef.id} />
        </div>
      )}
    </main>
  );
}
