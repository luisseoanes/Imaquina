/** Armazón mínimo del estudiante (Fase 1).
 *
 *  Sólo la agenda: sus tareas con fecha y estado. El recorrido de momentos, la
 *  evaluación y el chatbot llegan en la fase de "experiencia del estudiante".
 *  Marca `data-student-root` para el test del router.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, Route, Routes } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import httpClient from "@/shared/api/httpClient";
import { env } from "@/shared/config/env";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMe } from "@/shared/hooks/useMe";
import { BrandLogo } from "@/shared/ui/BrandLogo";
import { NotificationsBell } from "@/shared/ui/NotificationsBell";
import { Card, EmptyState, PageHeader, PastelBadge, QueryState } from "@/shared/ui/panel";
import { useQuery } from "@tanstack/react-query";

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

function AgendaView() {
  const { t, i18n } = useTranslation();
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

export function StudentPage() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { data: me } = useMe();

  return (
    <div data-student-root className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line/70 bg-canvas/85 px-4 backdrop-blur sm:px-6">
        <BrandLogo className="h-9 w-auto" />
        <p className="ml-2 hidden text-sm font-semibold text-content sm:block">
          {t("student.hi", { name: me?.full_name?.split(/\s+/)[0] ?? "" })}
        </p>
        <div className="ml-auto flex items-center gap-3">
          <NotificationsBell />
          <Link
            to={routes.account}
            className="text-sm text-content-muted hover:text-content"
          >
            {t("nav.account")}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-content-muted hover:text-danger"
          >
            {t("auth.logout")}
          </button>
        </div>
      </header>
      <div className="p-4 sm:p-6 lg:p-8">
        <Routes>
          <Route index element={<AgendaView />} />
          <Route path="agenda" element={<AgendaView />} />
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default StudentPage;
