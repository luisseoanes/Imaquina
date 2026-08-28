import { useTranslation } from "react-i18next";

import { useAssessmentAnalytics, useDashboard, useProjects } from "../api";
import { Card, PageHeader, QueryState } from "@/shared/ui/panel";
import { useStudio } from "../StudioContext";

export function AnalyticsView() {
  const { t } = useTranslation();
  const { lang } = useStudio();
  const analytics = useAssessmentAnalytics();
  const dashboard = useDashboard();
  const projects = useProjects(lang);

  const nameOf = (id: string) =>
    projects.data?.find((p) => p.id === id)?.title ?? id.slice(0, 8);

  return (
    <div>
      <PageHeader
        title={t("studio.nav.analytics")}
        description={t("studio.analytics.subtitle")}
      />
      <QueryState isLoading={dashboard.isLoading} error={dashboard.error}>
        {dashboard.data ? (
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm text-content-muted">
                {t("studio.dashboard.submittedAttempts")}
              </p>
              <p className="mt-1 text-2xl font-semibold text-content">
                {dashboard.data.performance.submitted_attempts}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-content-muted">
                {t("studio.dashboard.avgScore")}
              </p>
              <p className="mt-1 text-2xl font-semibold text-content">
                {dashboard.data.performance.avg_score ?? "—"}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-content-muted">
                {t("studio.dashboard.completedMoments")}
              </p>
              <p className="mt-1 text-2xl font-semibold text-content">
                {dashboard.data.performance.completed_moments}
              </p>
            </Card>
          </div>
        ) : null}
      </QueryState>

      <QueryState isLoading={analytics.isLoading} error={analytics.error}>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-content-subtle">
              <tr>
                <th className="px-4 py-3">{t("studio.nav.projects")}</th>
                <th className="px-4 py-3">{t("studio.analytics.attempts")}</th>
                <th className="px-4 py-3">{t("studio.dashboard.avgScore")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(analytics.data ?? []).map((row) => (
                <tr key={row.assessment_id}>
                  <td className="px-4 py-3 font-medium text-content">
                    {nameOf(row.project_id)}
                  </td>
                  <td className="px-4 py-3 text-content-muted">{row.attempts}</td>
                  <td className="px-4 py-3 text-content-muted">
                    {row.avg_score ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </QueryState>
    </div>
  );
}
