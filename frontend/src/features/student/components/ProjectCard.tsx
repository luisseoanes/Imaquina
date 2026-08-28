/** Ficha de proyecto con su progreso — la tarjeta de "Mis proyectos".
 *
 *  Es el equivalente de la tarjeta de curso del prototipo: título, grado,
 *  cuántos momentos llevas y la barra de completado. El botón lleva al
 *  siguiente momento sin completar, que es la acción que el estudiante quiere
 *  el 90% de las veces.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { MOMENT_ORDER } from "@/shared/config/roles";
import { routes } from "@/shared/config/routes";
import { PastelBadge } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import type { Tone } from "@/shared/ui/panel";
import type { ProjectWithProgress } from "../hooks";

const TONO: Record<ProjectWithProgress["state"], Tone> = {
  not_started: "neutral",
  in_progress: "info",
  completed: "success",
};

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-brand transition-[width] duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function ProjectCard({ project }: { project: ProjectWithProgress }) {
  const { t, i18n } = useTranslation();
  const destino = project.next
    ? routes.studentMoment(project.id, project.next)
    : routes.studentCourse(project.id);

  // El backend avisa de en qué idioma pudo servir: si el proyecto no está
  // traducido, se dice, en vez de dejar al estudiante pensando que la interfaz
  // le falló.
  const otroIdioma = project.lang !== (i18n.language?.startsWith("en") ? "en" : "es");

  return (
    <article className="flex flex-col rounded-2xl border border-line/60 bg-surface p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"
        >
          <Icon name="cpu" className="h-5 w-5" />
        </span>
        {/* La insignia va DEBAJO del título y no a su derecha: en la rejilla
            de tres columnas la tarjeta baja de 360px y, compitiendo por el
            ancho, partía el título a media palabra. */}
        <div className="min-w-0 flex-1">
          <Link
            to={routes.studentCourse(project.id)}
            className="font-display text-base font-bold leading-snug text-content hover:underline"
          >
            {project.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs text-content-subtle">
              {t("student.card.grade", { grade: project.grade })}
            </span>
            <PastelBadge tone={TONO[project.state]}>
              {t(`student.status.${project.state}`)}
            </PastelBadge>
          </div>
        </div>
      </div>

      {project.summary ? (
        <p className="mt-3 line-clamp-2 text-sm text-content-muted">{project.summary}</p>
      ) : null}

      {otroIdioma ? (
        <p className="mt-2 text-xs text-warning">
          {t("student.card.langFallback", { lang: project.lang.toUpperCase() })}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3 text-xs text-content-muted">
        <span className="inline-flex items-center gap-1">
          <Icon name="layers" className="h-3.5 w-3.5" />
          {t("student.card.moments", {
            done: project.completed,
            total: MOMENT_ORDER.length,
          })}
        </span>
      </div>

      <div className="mt-2">
        <ProgressBar percent={project.percent} />
        <p className="mt-2 text-xs font-semibold text-content-muted">
          {t("student.card.completed")}{" "}
          <span className="text-brand-ink">{project.percent}%</span>
        </p>
      </div>

      <Link
        to={destino}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-brand-content transition duration-200 hover:bg-brand-strong active:scale-[0.99]"
      >
        {project.state === "completed"
          ? t("student.card.review")
          : project.state === "not_started"
            ? t("student.card.start")
            : t("student.card.continue")}
        <Icon name="arrow-right" className="h-4 w-4" />
      </Link>
    </article>
  );
}
