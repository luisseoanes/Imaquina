/** Inicio del estudiante.
 *
 *  Es la pantalla del prototipo: "Mis proyectos" con sus tarjetas y filtros,
 *  el siguiente paso concreto y las evaluaciones pendientes. Todo sale de
 *  datos reales; lo que la plataforma no sabe (horarios, citas, pagos) no se
 *  inventa.
 *
 *  El saludo vive en la barra superior, así que aquí no se repite.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useMe } from "@/shared/hooks/useMe";
import { Card, EmptyState, PageHeader, QueryState } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import { ProjectCard } from "../components/ProjectCard";
import { useProjectsWithProgress } from "../hooks";
import type { ProjectWithProgress } from "../hooks";
import { useStudent } from "../StudentContext";

type Filtro = "all" | "in_progress" | "completed";
const FILTROS: Filtro[] = ["all", "in_progress", "completed"];

export function DashboardView() {
  const { t } = useTranslation();
  useDocumentTitle("student.title.dashboard");

  const { lang, search } = useStudent();
  const { data: me } = useMe();
  const { data, isLoading, error, truncated } = useProjectsWithProgress(lang, me?.grade);
  const [filtro, setFiltro] = useState<Filtro>("all");

  const q = search.trim().toLowerCase();
  const visibles = data
    .filter((p) => (filtro === "all" ? true : p.state === filtro))
    .filter((p) => (q ? p.title.toLowerCase().includes(q) : true));

  const siguiente = data.find((p) => p.state === "in_progress") ?? data[0] ?? null;

  return (
    <div>
      <PageHeader
        title={t("student.dashboard.title")}
        description={t("student.dashboard.subtitle")}
      />

      <QueryState isLoading={isLoading} error={error}>
        <SiguientePaso project={siguiente} />

        <section aria-labelledby="mis-proyectos" className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="mis-proyectos"
              className="font-display text-lg font-bold text-content"
            >
              {t("student.dashboard.myProjects")}
            </h2>
            <Link
              to={routes.studentCourses}
              className="text-sm text-brand-ink hover:underline"
            >
              {t("common.seeAll")}
            </Link>
          </div>

          <div
            role="tablist"
            aria-label={t("student.dashboard.myProjects")}
            className="mb-4 flex flex-wrap gap-1"
          >
            {FILTROS.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filtro === f}
                onClick={() => setFiltro(f)}
                className={`rounded-pill px-3 py-1.5 text-sm transition duration-150 ${
                  filtro === f
                    ? "bg-brand-soft font-semibold text-brand-ink"
                    : "text-content-muted hover:bg-surface-muted"
                }`}
              >
                {t(`student.filter.${f}`)}
              </button>
            ))}
          </div>

          {visibles.length === 0 ? (
            <EmptyState message={t("student.dashboard.noProjects")} />
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
        </section>

        <PendientesCard proyectos={data} />
      </QueryState>
    </div>
  );
}

/** La tarjeta grande de arriba: a dónde volver ahora mismo. */
function SiguientePaso({ project }: { project: ProjectWithProgress | null }) {
  const { t } = useTranslation();
  if (!project) return null;

  const destino = project.next
    ? routes.studentMoment(project.id, project.next)
    : routes.studentCourse(project.id);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-surface-inverse p-5 text-content-inverse shadow-card sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-content-inverse/60">
        {t("student.dashboard.nextStep")}
      </p>
      <h2 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">
        {project.title}
      </h2>
      <p className="mt-1 text-sm text-content-inverse/70">
        {project.next
          ? t(`student.moment.${project.next}`)
          : t("student.dashboard.projectDone")}
      </p>
      <Link
        to={destino}
        className="mt-4 inline-flex items-center gap-1.5 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-brand-content transition duration-200 hover:bg-brand-strong active:scale-[0.99]"
      >
        {project.state === "not_started"
          ? t("student.card.start")
          : t("student.card.continue")}
        <Icon name="arrow-right" className="h-4 w-4" />
      </Link>
    </section>
  );
}

/** El equivalente de las "Home Tasks" del prototipo: las evaluaciones que
 *  siguen abiertas. No hay entidad "tarea" en la plataforma — la unidad
 *  evaluable es el momento 6 de cada proyecto (R10). */
function PendientesCard({ proyectos }: { proyectos: ProjectWithProgress[] }) {
  const { t } = useTranslation();
  const pendientes = proyectos.filter(
    (p) => p.state !== "not_started" && p.progress.assess !== "completed",
  );

  return (
    <section aria-labelledby="pendientes" className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="pendientes" className="font-display text-lg font-bold text-content">
          {t("student.dashboard.pending")}
        </h2>
        <Link to={routes.studentAssignments} className="text-sm text-brand-ink hover:underline">
          {t("common.seeAll")}
        </Link>
      </div>

      {pendientes.length === 0 ? (
        <EmptyState message={t("student.dashboard.noPending")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pendientes.slice(0, 4).map((p) => (
            <Card key={p.id} hover>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-warning-surface text-warning"
                >
                  <Icon name="check-square" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-content">
                    {p.title}
                  </p>
                  <p className="mt-0.5 text-xs text-content-muted">
                    {p.progress.assess === "completed"
                      ? t("student.status.completed")
                      : t("student.dashboard.assessPending")}
                  </p>
                  <Link
                    to={routes.studentMoment(p.id, "assess")}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:underline"
                  >
                    {t("student.dashboard.goToAssessment")}
                    <Icon name="chevron-right" className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
