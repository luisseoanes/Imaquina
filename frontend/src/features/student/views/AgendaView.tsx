/** Mis tareas: lo que el docente asignó, con su fecha de entrega (Fase 1).
 *
 *  Viene del panel mínimo del estudiante y se conserva tal cual; lo único que
 *  cambia es que ya no trae su propia cabecera — vive dentro del armazón del
 *  panel, como el resto de vistas.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import httpClient from "@/shared/api/httpClient";
import { env } from "@/shared/config/env";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { Card, EmptyState, PageHeader, PastelBadge, QueryState } from "@/shared/ui/panel";

interface Agenda {
  id: string;
  course_name: string;
  project_title: string;
  title: string;
  instructions: string | null;
  due_at: string | null;
  completed_moments: number;
  total_moments: number;
  status: "completed" | "in_progress" | "not_started";
  timeliness: "done" | "pending" | "late" | "no_due";
}

const TONE = {
  done: "success",
  pending: "info",
  late: "danger",
  no_due: "neutral",
} as const;

export function AgendaView() {
  const { t, i18n } = useTranslation();
  useDocumentTitle("student.title.agenda");
  const { data, isLoading, error } = useQuery({
    queryKey: ["student", "agenda"],
    queryFn: () => httpClient<Agenda[]>(`${env.apiBaseUrl}/assignments/mine`),
  });

  const rows = useMemo(
    () =>
      (data ?? [])
        .slice()
        .sort((a, b) => (a.due_at ?? "~").localeCompare(b.due_at ?? "~")),
    [data],
  );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("student.agenda.title")}
        description={t("student.agenda.subtitle")}
      />
      <QueryState isLoading={isLoading} error={error}>
        {rows.length === 0 ? (
          <EmptyState message={t("student.agenda.empty")} />
        ) : (
          <ul className="space-y-3">
            {rows.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-content">{a.title}</p>
                    <p className="mt-0.5 text-xs text-content-muted">
                      {a.course_name} · {a.project_title}
                    </p>
                    {a.instructions ? (
                      <p className="mt-1 text-sm text-content-muted">{a.instructions}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-content-subtle">
                      {a.due_at
                        ? t("student.agenda.dueOn", {
                            date: new Date(a.due_at).toLocaleDateString(i18n.language, {
                              day: "numeric",
                              month: "long",
                            }),
                          })
                        : t("student.agenda.noDue")}
                      {" · "}
                      {a.completed_moments}/{a.total_moments}{" "}
                      {t("student.agenda.moments")}
                    </p>
                  </div>
                  <PastelBadge tone={TONE[a.timeliness]}>
                    {a.status === "completed"
                      ? t("student.agenda.done")
                      : a.timeliness === "late"
                        ? t("student.agenda.late")
                        : t("student.agenda.pending")}
                  </PastelBadge>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
