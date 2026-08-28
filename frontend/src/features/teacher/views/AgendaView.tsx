import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Card, EmptyState, PageHeader, PastelBadge, QueryState } from "@/shared/ui/panel";
import { useAssignments } from "../api";

export function AgendaView() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, error } = useAssignments();

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (data ?? [])
      .filter((a) => a.due_at && a.is_published)
      .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))
      .map((a) => {
        const due = new Date(a.due_at!).getTime();
        const days = Math.ceil((due - now) / 86_400_000);
        return { ...a, days };
      });
  }, [data]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t("teacher.nav.agenda")}
        description={t("teacher.agenda.subtitle")}
      />
      <QueryState isLoading={isLoading} error={error}>
        {upcoming.length === 0 ? (
          <EmptyState message={t("teacher.agenda.empty")} />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((a) => (
              <Card key={a.id}>
                <div className="flex items-center gap-4">
                  <div className="flex w-14 flex-shrink-0 flex-col items-center rounded-xl bg-brand-soft py-2 text-brand-ink">
                    <span className="font-display text-lg font-extrabold leading-none">
                      {new Date(a.due_at!).toLocaleDateString(i18n.language, {
                        day: "2-digit",
                      })}
                    </span>
                    <span className="text-[0.62rem] uppercase">
                      {new Date(a.due_at!).toLocaleDateString(i18n.language, {
                        month: "short",
                      })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold text-content">
                      {a.title}
                    </p>
                    <p className="truncate text-xs text-content-muted">
                      {a.course_name} · {a.project_title}
                    </p>
                  </div>
                  <PastelBadge
                    tone={a.days < 0 ? "danger" : a.days <= 2 ? "warning" : "info"}
                  >
                    {a.days < 0
                      ? t("teacher.agenda.overdue")
                      : a.days === 0
                        ? t("teacher.agenda.today")
                        : t("teacher.agenda.inDays", { count: a.days })}
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
