/** "Mis proyectos": el catálogo publicado que le toca a este estudiante.
 *
 *  Un aviso sobre el nombre: la ruta es `/courses` y el prototipo dice "My
 *  Courses", pero lo que se lista son PROYECTOS, no cursos. `Course` existe en
 *  el backend como el grupo de clase al que matricula el administrador, y
 *  `GET /courses` tiene guard `Staff`: un estudiante no puede listar los suyos.
 *  Lo que sí puede pedir es el catálogo publicado, filtrado por su grado, que
 *  es exactamente lo que su curso le asigna.
 */
import { useTranslation } from "react-i18next";

import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useMe } from "@/shared/hooks/useMe";
import { EmptyState, PageHeader, QueryState } from "@/shared/ui/panel";
import { ProjectCard } from "../components/ProjectCard";
import { useProjectsWithProgress } from "../hooks";
import { useStudent } from "../StudentContext";

export function ProjectsView() {
  const { t } = useTranslation();
  useDocumentTitle("student.title.projects");

  const { lang, search } = useStudent();
  const { data: me } = useMe();
  const { data, isLoading, error, truncated } = useProjectsWithProgress(lang, me?.grade);

  const q = search.trim().toLowerCase();
  const visibles = q
    ? data.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.summary ?? "").toLowerCase().includes(q),
      )
    : data;

  return (
    <div>
      <PageHeader
        title={t("student.projects.title")}
        description={
          me?.grade
            ? t("student.projects.subtitleGrade", { grade: me.grade })
            : t("student.projects.subtitle")
        }
      />
      <QueryState isLoading={isLoading} error={error}>
        {visibles.length === 0 ? (
          <EmptyState
            message={q ? t("student.projects.noMatches") : t("student.projects.empty")}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {visibles.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
        {truncated ? (
          <p className="mt-3 text-xs text-content-subtle">
            {t("student.dashboard.truncated")}
          </p>
        ) : null}
      </QueryState>
    </div>
  );
}
