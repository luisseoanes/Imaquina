import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import { EmptyState, PageHeader, PastelBadge, QueryState } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import { usePublishedProjects } from "../api";
import { useTeacher } from "../TeacherContext";

export function ContentView() {
  const { t } = useTranslation();
  const { lang, search } = useTeacher();
  const { data, isLoading, error } = usePublishedProjects(lang);

  const rows = (data ?? []).filter((p) =>
    `${p.title} ${p.slug} ${p.grade}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("teacher.nav.content")} description={t("teacher.content.subtitle")} />
      <QueryState isLoading={isLoading} error={error}>
        {rows.length === 0 ? (
          <EmptyState message={t("teacher.content.empty")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((p) => (
              <Link
                key={p.id}
                to={routes.teacherContentProject(p.id)}
                className="group flex flex-col rounded-2xl border border-line/60 bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-display font-bold text-content">{p.title}</p>
                  <PastelBadge tone="info">{p.grade}</PastelBadge>
                </div>
                {p.summary ? (
                  <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-content-muted">
                    {p.summary}
                  </p>
                ) : null}
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">
                  {t("teacher.content.open")}
                  <Icon
                    name="arrow-right"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
