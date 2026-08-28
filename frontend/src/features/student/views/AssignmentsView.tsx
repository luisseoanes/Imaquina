/** Evaluaciones del estudiante (R10): una por proyecto, la del momento 6.
 *
 *  No existe una entidad "tarea" en la plataforma y no se inventa: lo evaluable
 *  es el momento `assess` de cada proyecto. Tampoco hay un endpoint que liste
 *  "mis evaluaciones", así que la pantalla se compone: proyectos publicados →
 *  detalle de cada uno (de ahí sale el `moment_id` del momento 6) → intentos.
 *
 *  **Coste acotado a propósito**: el detalle se pide para los proyectos
 *  empezados, y la nota sólo para aquellos cuya evaluación ya está enviada.
 *  Un proyecto que ni se ha abierto no dispara ninguna petición extra. Si esto
 *  se queda corto, lo que toca es un endpoint agregado en el backend, no
 *  multiplicar peticiones aquí.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useMe } from "@/shared/hooks/useMe";
import { Card, EmptyState, PageHeader, PastelBadge, QueryState } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import { useAssessment, useMyAttempts, useProject } from "../api";
import { estadoDelMomento } from "../hooks";
import type { ProjectWithProgress } from "../hooks";
import { useProjectsWithProgress } from "../hooks";
import { useStudent } from "../StudentContext";

export function AssignmentsView() {
  const { t } = useTranslation();
  useDocumentTitle("student.title.assignments");

  const { lang, search } = useStudent();
  const { data: me } = useMe();
  const { data, isLoading, error } = useProjectsWithProgress(lang, me?.grade);

  const q = search.trim().toLowerCase();
  const visibles = q ? data.filter((p) => p.title.toLowerCase().includes(q)) : data;

  return (
    <div>
      <PageHeader
        title={t("student.assignments.title")}
        description={t("student.assignments.subtitle")}
      />
      <QueryState isLoading={isLoading} error={error}>
        {visibles.length === 0 ? (
          <EmptyState message={t("student.assignments.empty")} />
        ) : (
          <ul className="space-y-3">
            {visibles.map((p) => (
              <li key={p.id}>
                <Fila project={p} />
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

function Fila({ project }: { project: ProjectWithProgress }) {
  const { t } = useTranslation();
  const { lang } = useStudent();

  const estado = estadoDelMomento("assess", project.progress);
  const empezado = project.state !== "not_started";

  // El detalle sólo hace falta para conocer el `moment_id` del momento 6, y
  // sólo tiene sentido pedirlo si el proyecto ya está en marcha.
  const detalle = useProject(project.id, lang, { enabled: empezado });
  const assessMoment = detalle.data?.moments.find((m) => m.type === "assess") ?? null;

  return (
    <Card hover className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <span
        aria-hidden
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
          estado === "completed"
            ? "bg-success-surface text-success"
            : estado === "locked"
              ? "bg-surface-muted text-content-subtle"
              : "bg-warning-surface text-warning"
        }`}
      >
        <Icon
          name={estado === "locked" ? "lock" : "check-square"}
          className="h-5 w-5"
        />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-bold text-content">
          {project.title}
        </p>
        <p className="mt-0.5 text-xs text-content-muted">
          {t("student.moment.assess")}
          {" · "}
          {t(`student.momentState.${estado}`)}
        </p>
        {assessMoment && estado !== "locked" ? (
          <Nota momentId={assessMoment.id} />
        ) : null}
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        {estado === "locked" ? (
          <PastelBadge tone="neutral">{t("student.assignments.lockedShort")}</PastelBadge>
        ) : (
          <Link
            to={routes.studentMoment(project.id, "assess")}
            className="inline-flex items-center gap-1.5 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-brand-content transition duration-200 hover:bg-brand-strong"
          >
            {estado === "completed"
              ? t("student.assignments.review")
              : t("student.assignments.go")}
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        )}
      </div>
    </Card>
  );
}

/** La nota del último intento enviado, si lo hay. Silencioso mientras carga y
 *  si el momento aún no tiene evaluación construida: no es un error del
 *  estudiante y no merece ocupar la fila. */
function Nota({ momentId }: { momentId: string }) {
  const { t } = useTranslation();
  const { lang } = useStudent();
  const evaluacion = useAssessment(momentId, lang);
  const intentos = useMyAttempts(evaluacion.data?.id ?? "", {
    enabled: !!evaluacion.data?.id,
  });

  const enviado = (intentos.data ?? []).find((a) => a.status !== "in_progress");
  if (!enviado) return null;

  const total = (evaluacion.data?.questions ?? []).reduce((s, q) => s + q.points, 0);

  return (
    <p className="mt-1 text-sm">
      <span className="font-semibold text-content">
        {t("student.assignments.score")}: {enviado.score ?? "—"}/{total}
      </span>{" "}
      <span className="text-xs text-content-subtle">
        · {t(`student.attemptStatus.${enviado.status}`)}
      </span>
    </p>
  );
}
