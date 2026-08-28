/** Un momento: contenido, asistente y —en el sexto— evaluación.
 *
 *  Tres cosas que no son evidentes:
 *
 *  - **La guía docente no se oculta aquí.** El backend ya la quita en
 *    `serialize_moment_for` para quien no es personal docente. Si algún día
 *    apareciera en esta respuesta, el arreglo es en el servidor, no un `if` en
 *    esta pantalla: ocultarla en el cliente no sirve de nada ante unas DevTools.
 *  - **El 403 es una respuesta válida**, no un fallo: significa que el momento
 *    anterior no está completado (progreso lineal). Se explica y se ofrece
 *    volver, en vez de enseñar "ocurrió un error".
 *  - **El asistente no está en el momento 6** (R8: momentos 1–5). En la
 *    evaluación se responde solo.
 */
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/shared/api/ApiError";
import { MOMENT_ORDER } from "@/shared/config/roles";
import type { MomentType } from "@/shared/config/roles";
import { routes } from "@/shared/config/routes";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { Button, Card, PastelBadge, QueryState } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import { useCompleteMoment, useMoment, useProgress, useProject } from "../api";
import { AssessmentPlayer } from "../components/AssessmentPlayer";
import { ChatPanel } from "../components/ChatPanel";
import { MomentBlocks } from "@/shared/ui/MomentBlocks";
import { useStudent } from "../StudentContext";

function esTipoValido(v: string): v is MomentType {
  return (MOMENT_ORDER as readonly string[]).includes(v);
}

export function MomentView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId = "", momentType = "" } = useParams();
  const { lang } = useStudent();

  useDocumentTitle("student.title.moment");

  const tipo = esTipoValido(momentType) ? momentType : null;
  const momento = useMoment(projectId, momentType, lang, {
    enabled: !!projectId && !!tipo,
  });
  const proyecto = useProject(projectId, lang, { enabled: !!projectId });
  const progreso = useProgress(projectId, { enabled: !!projectId });
  const completar = useCompleteMoment(projectId);

  if (!tipo) {
    return <Bloqueado projectId={projectId} motivo={t("student.moment.unknown")} />;
  }

  const indice = MOMENT_ORDER.indexOf(tipo);
  const siguiente = MOMENT_ORDER[indice + 1] ?? null;
  const yaCompletado = progreso.data?.[tipo] === "completed";
  // R8: el asistente acompaña los momentos 1–5; en la evaluación se responde solo.
  const conAsistente = tipo !== "assess";
  // Un 403 aquí no es un fallo: es el recorrido lineal diciendo que falta el
  // momento anterior. Se explica en vez de enseñar "ocurrió un error".
  const error = momento.error;
  if (error instanceof ApiError && error.status === 403) {
    return <Bloqueado projectId={projectId} motivo={error.message} />;
  }

  return (
    <div>
      <Link
        to={routes.studentCourse(projectId)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-content-muted hover:text-content"
      >
        <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
        {proyecto.data?.title ?? t("student.projects.title")}
      </Link>

      <QueryState isLoading={momento.isLoading} error={momento.error}>
        {momento.data ? (
          // Dos columnas SÓLO cuando hay asistente. En el momento 6 no lo hay
          // (R8), y dejar la reserva de 22rem le robaba el ancho al contenido
          // por una columna vacía.
          <div
            className={`grid gap-6 ${
              conAsistente ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : ""
            }`}
          >
            <div className="min-w-0">
              <header className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-content-subtle">
                  {t("student.project.momentIndex", { index: indice + 1 })} ·{" "}
                  {t(`student.moment.${tipo}`)}
                </p>
                <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-content sm:text-[1.75rem]">
                  {momento.data.title || t(`student.moment.${tipo}`)}
                </h1>
                {yaCompletado ? (
                  <span className="mt-2 inline-block">
                    <PastelBadge tone="success">
                      {t("student.momentState.completed")}
                    </PastelBadge>
                  </span>
                ) : null}
              </header>

              {momento.data.blocks.length === 0 ? (
                <Card>
                  <p className="text-sm text-content-muted">
                    {t("student.moment.noContent")}
                  </p>
                </Card>
              ) : (
                <MomentBlocks blocks={momento.data.blocks} />
              )}

              {tipo === "assess" ? (
                <section className="mt-8">
                  <h2 className="mb-3 font-display text-lg font-bold text-content">
                    {t("student.assessment.title")}
                  </h2>
                  <AssessmentPlayer momentId={momento.data.id} lang={lang} />
                </section>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {yaCompletado ? (
                  siguiente ? (
                    <Button onClick={() => navigate(routes.studentMoment(projectId, siguiente))}>
                      {t("student.moment.next")}
                      <Icon name="arrow-right" className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={() => navigate(routes.studentCourse(projectId))}>
                      {t("student.moment.backToProject")}
                    </Button>
                  )
                ) : (
                  <Button
                    disabled={completar.isPending}
                    onClick={() =>
                      completar
                        .mutateAsync(tipo)
                        .then(() =>
                          siguiente
                            ? navigate(routes.studentMoment(projectId, siguiente))
                            : navigate(routes.studentCourse(projectId)),
                        )
                        .catch(() => undefined)
                    }
                  >
                    <Icon name="check" className="h-4 w-4" />
                    {completar.isPending
                      ? t("student.moment.completing")
                      : t("student.moment.complete")}
                  </Button>
                )}
                {completar.error ? (
                  <p role="alert" className="text-sm text-danger">
                    {completar.error instanceof ApiError
                      ? completar.error.message
                      : t("common.error")}
                  </p>
                ) : null}
              </div>
            </div>

            {conAsistente ? (
              <div className="min-w-0">
                <ChatPanel
                  momentId={momento.data.id}
                  openingPrompt={momento.data.chatbot_opening_prompt}
                  lang={lang}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}

/** Momento bloqueado por el recorrido lineal, o tipo inexistente en la URL. */
function Bloqueado({ projectId, motivo }: { projectId: string; motivo: string }) {
  const { t } = useTranslation();
  return (
    <Card className="mx-auto max-w-xl text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-surface text-warning">
        <Icon name="lock" className="h-6 w-6" />
      </span>
      <h1 className="font-display text-xl font-extrabold text-content">
        {t("student.moment.lockedTitle")}
      </h1>
      <p className="mt-2 text-sm text-content-muted">{motivo}</p>
      <Link
        to={routes.studentCourse(projectId)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-brand-content hover:bg-brand-strong"
      >
        {t("student.moment.backToProject")}
      </Link>
    </Card>
  );
}
