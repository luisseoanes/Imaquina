import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useDashboard } from "../api";
import { Card, PageHeader, QueryState, StatusBadge } from "@/shared/ui/panel";
import { routes } from "@/shared/config/routes";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-sm text-content-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-content">{value}</p>
      {sub ? <p className="mt-1 text-xs text-content-subtle">{sub}</p> : null}
    </Card>
  );
}

export function DashboardView() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useDashboard();

  return (
    <div>
      {/* El saludo "¡Hola, …!" vive ahora en la barra superior; aquí queda un
          título de página sobrio para no repetirlo. */}
      <PageHeader title={t("studio.dashboard.pageTitle")} />
      <QueryState isLoading={isLoading} error={error}>
        {data ? (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                  label={t("studio.dashboard.projects")}
                  value={String(data.content.projects.total)}
                  sub={t("studio.dashboard.publishedCount", {
                    count: data.content.projects.published,
                  })}
                />
                <Stat
                  label={t("studio.dashboard.lessons")}
                  value={String(data.content.lessons.total)}
                  sub={t("studio.dashboard.publishedCount", {
                    count: data.content.lessons.published,
                  })}
                />
                <Stat
                  label={t("studio.dashboard.resources")}
                  value={String(data.content.resources)}
                />
                <Stat
                  label={t("studio.dashboard.students")}
                  value={String(data.students_impacted)}
                />
              </div>

              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-content">
                    {t("studio.dashboard.recent")}
                  </h2>
                  <Link
                    to={routes.studioContents}
                    className="text-sm text-brand-ink hover:underline"
                  >
                    {t("common.seeAll")}
                  </Link>
                </div>
                {data.recent.length === 0 ? (
                  <p className="text-sm text-content-muted">
                    {t("studio.dashboard.noRecent")}
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.recent.map((item) => (
                      <li
                        key={`${item.type}-${item.id}`}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-content">
                            {item.title}
                          </p>
                          <p className="text-xs text-content-subtle">
                            {t(`studio.nav.${item.type === "project" ? "projects" : "lessons"}`)}
                            {item.area ? ` · ${item.area}` : ""}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <div className="space-y-5">
              <Card>
                <h2 className="mb-3 text-base font-semibold text-content">
                  {t("studio.dashboard.performance")}
                </h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-content-muted">
                      {t("studio.dashboard.submittedAttempts")}
                    </dt>
                    <dd className="font-medium text-content">
                      {data.performance.submitted_attempts}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-content-muted">
                      {t("studio.dashboard.avgScore")}
                    </dt>
                    <dd className="font-medium text-content">
                      {data.performance.avg_score ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-content-muted">
                      {t("studio.dashboard.completedMoments")}
                    </dt>
                    <dd className="font-medium text-content">
                      {data.performance.completed_moments}
                    </dd>
                  </div>
                </dl>
              </Card>

              <Card>
                <h2 className="mb-3 text-base font-semibold text-content">
                  {t("studio.dashboard.quickCreate")}
                </h2>
                <div className="flex flex-col gap-2">
                  <Link
                    to={routes.studioProjects}
                    className="rounded-control bg-surface-muted px-3 py-2 text-sm text-content hover:bg-line"
                  >
                    {t("studio.dashboard.newProject")}
                  </Link>
                  <Link
                    to={routes.studioLessons}
                    className="rounded-control bg-surface-muted px-3 py-2 text-sm text-content hover:bg-line"
                  >
                    {t("studio.dashboard.newLesson")}
                  </Link>
                  <Link
                    to={routes.studioMedia}
                    className="rounded-control bg-surface-muted px-3 py-2 text-sm text-content hover:bg-line"
                  >
                    {t("studio.dashboard.uploadMedia")}
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}
