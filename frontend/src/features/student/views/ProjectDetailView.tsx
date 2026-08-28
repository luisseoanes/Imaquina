/** Un proyecto y sus seis momentos (R7), con el progreso y los candados.
 *
 *  El recorrido es **lineal obligatorio** (decidido con el cliente, 18/08/2026):
 *  un momento se abre sólo al completar el anterior. Quien lo impone es el
 *  backend —`get_moment_for` devuelve 403— y esto sólo evita ofrecer un enlace
 *  que va a rebotar.
 */
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { MOMENT_ORDER } from "@/shared/config/roles";
import type { MomentType } from "@/shared/config/roles";
import { routes } from "@/shared/config/routes";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { Card, PageHeader, PastelBadge, QueryState } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import type { IconName } from "@/shared/ui/panel-icons";
import type { Tone } from "@/shared/ui/panel";
import { useProgress, useProject } from "../api";
import type { ProgressMap } from "../api";
import { ProgressBar } from "../components/ProjectCard";
import { estadoDelMomento, resumirProgreso } from "../hooks";
import { useStudent } from "../StudentContext";

const ICONO: Record<MomentType, IconName> = {
  intro: "star",
  inquiry: "help",
  design: "template",
  build: "wrench",
  communicate: "message",
  assess: "check-square",
};

const TONO: Record<string, Tone> = {
  completed: "success",
  in_progress: "info",
  not_started: "neutral",
  locked: "neutral",
};

export function ProjectDetailView() {
  const { t } = useTranslation();
  const { projectId = "" } = useParams();
  const { lang } = useStudent();

  const proyecto = useProject(projectId, lang, { enabled: !!projectId });
  const progreso = useProgress(projectId, { enabled: !!projectId });

  useDocumentTitle("student.title.project");

  const progress: ProgressMap = progreso.data ?? {};
  const resumen = resumirProgreso(progress);

  return (
    <div>
      <QueryState isLoading={proyecto.isLoading} error={proyecto.error}>
        {proyecto.data ? (
          <>
            <Link
              to={routes.studentCourses}
              className="mb-4 inline-flex items-center gap-1 text-sm text-content-muted hover:text-content"
            >
              <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
              {t("student.projects.title")}
            </Link>

            <PageHeader
              title={proyecto.data.title}
              description={proyecto.data.summary ?? undefined}
            />

            <Card className="mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <PastelBadge tone="brand">
                  {t("student.card.grade", { grade: proyecto.data.grade })}
                </PastelBadge>
                {proyecto.data.kit ? (
                  <PastelBadge tone="violet">{proyecto.data.kit}</PastelBadge>
                ) : null}
                <span className="ml-auto text-sm font-semibold text-content-muted">
                  {t("student.card.moments", {
                    done: resumen.completed,
                    total: MOMENT_ORDER.length,
                  })}
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar percent={resumen.percent} />
              </div>
            </Card>

            <h2 className="mb-3 font-display text-lg font-bold text-content">
              {t("student.project.moments")}
            </h2>

            <ol className="space-y-3">
              {MOMENT_ORDER.map((tipo, i) => {
                const momento = proyecto.data.moments.find((m) => m.type === tipo);
                const estado = estadoDelMomento(tipo, progress);
                const bloqueado = estado === "locked";

                const cuerpo = (
                  <>
                    <span
                      aria-hidden
                      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
                        bloqueado
                          ? "bg-surface-muted text-content-subtle"
                          : estado === "completed"
                            ? "bg-success-surface text-success"
                            : "bg-brand-soft text-brand-ink"
                      }`}
                    >
                      <Icon
                        name={bloqueado ? "lock" : estado === "completed" ? "check" : ICONO[tipo]}
                        className="h-5 w-5"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-content-subtle">
                        {t("student.project.momentIndex", { index: i + 1 })}
                      </p>
                      <p className="truncate font-display text-base font-bold text-content">
                        {momento?.title || t(`student.moment.${tipo}`)}
                      </p>
                    </div>
                    <PastelBadge tone={TONO[estado]}>
                      {t(`student.momentState.${estado}`)}
                    </PastelBadge>
                  </>
                );

                return (
                  <li key={tipo}>
                    {bloqueado ? (
                      <div
                        aria-disabled
                        title={t("student.project.lockedHint")}
                        className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/60 p-4 opacity-70"
                      >
                        {cuerpo}
                      </div>
                    ) : (
                      <Link
                        to={routes.studentMoment(projectId, tipo)}
                        className="flex items-center gap-3 rounded-2xl border border-line/60 bg-surface p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float"
                      >
                        {cuerpo}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
