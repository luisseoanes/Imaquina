import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  useAssessmentAnalytics,
  useChatbotConfusion,
  useDashboard,
  useItemAnalysis,
  useMomentDropoff,
  useProjects,
} from "../api";
import { Card, PageHeader, QueryState } from "@/shared/ui/panel";
import { routes } from "@/shared/config/routes";
import { useStudio } from "../StudioContext";

export function AnalyticsView() {
  const { t } = useTranslation();
  const { lang } = useStudio();
  const analytics = useAssessmentAnalytics();
  const dashboard = useDashboard();
  const projects = useProjects(lang);
  const items = useItemAnalysis();
  const dropoff = useMomentDropoff();
  const chatbot = useChatbotConfusion();

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

      <h2 className="mb-2 mt-8 text-base font-semibold text-content">
        {t("studio.analytics.itemAnalysis")}
      </h2>
      <p className="mb-3 text-xs text-content-muted">
        {t("studio.analytics.itemAnalysisHint")}
      </p>
      <QueryState isLoading={items.isLoading} error={items.error}>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-content-subtle">
              <tr>
                <th className="px-4 py-3">{t("studio.assessments.prompt")}</th>
                <th className="px-4 py-3">{t("studio.analytics.n")}</th>
                <th className="px-4 py-3">{t("studio.analytics.difficulty")}</th>
                <th className="px-4 py-3">{t("studio.analytics.discrimination")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(items.data ?? []).map((r) => (
                <tr key={r.question_id}>
                  <td className="max-w-xs truncate px-4 py-3 text-content">
                    {r.prompt ?? r.question_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-content-muted">{r.n}</td>
                  <td className="px-4 py-3 text-content-muted">{r.difficulty}</td>
                  <td
                    className={`px-4 py-3 ${
                      r.discrimination !== null && r.discrimination < 0.15
                        ? "text-danger"
                        : "text-content-muted"
                    }`}
                  >
                    {r.discrimination ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </QueryState>

      <h2 className="mb-2 mt-8 text-base font-semibold text-content">
        {t("studio.analytics.dropoff")}
      </h2>
      <QueryState isLoading={dropoff.isLoading} error={dropoff.error}>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-content-subtle">
              <tr>
                <th className="px-4 py-3">{t("studio.editor.moments")}</th>
                <th className="px-4 py-3">{t("studio.analytics.entered")}</th>
                <th className="px-4 py-3">{t("studio.analytics.completed")}</th>
                <th className="px-4 py-3">{t("studio.analytics.dropoffCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(dropoff.data ?? []).slice(0, 15).map((r) => (
                <tr key={r.moment_id}>
                  <td className="px-4 py-3 text-content">
                    <Link
                      to={routes.studioMoment(r.project_id, r.moment_id)}
                      className="hover:underline"
                    >
                      {r.title ?? t(`studio.moment.${r.type}`, r.type)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-content-muted">{r.entered}</td>
                  <td className="px-4 py-3 text-content-muted">{r.completed}</td>
                  <td className="px-4 py-3 font-medium text-content">{r.dropoff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </QueryState>

      <h2 className="mb-2 mt-8 text-base font-semibold text-content">
        {t("studio.analytics.chatbot")}
      </h2>
      <p className="mb-3 text-xs text-content-muted">
        {t("studio.analytics.chatbotHint")}
      </p>
      <QueryState isLoading={chatbot.isLoading} error={chatbot.error}>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-content-subtle">
              <tr>
                <th className="px-4 py-3">{t("studio.editor.moments")}</th>
                <th className="px-4 py-3">{t("studio.analytics.questions")}</th>
                <th className="px-4 py-3">{t("studio.analytics.redirected")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(chatbot.data ?? []).slice(0, 15).map((r) => (
                <tr key={r.moment_id}>
                  <td className="px-4 py-3 text-content">
                    {r.title ?? r.moment_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-content-muted">{r.questions}</td>
                  <td className="px-4 py-3 text-content-muted">
                    {r.redirected} ({Math.round(r.redirect_rate * 100)}%)
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
