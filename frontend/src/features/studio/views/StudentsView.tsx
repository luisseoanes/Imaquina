import { useTranslation } from "react-i18next";

import { useStudents } from "../api";
import { Card, PageHeader, QueryState } from "@/shared/ui/panel";
import { useStudio } from "../StudioContext";

export function StudentsView() {
  const { t } = useTranslation();
  const { search } = useStudio();
  const { data, isLoading, error } = useStudents();

  const rows = (data ?? []).filter((s) =>
    `${s.full_name} ${s.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title={t("studio.nav.students")}
        description={t("studio.students.subtitle")}
      />
      <QueryState isLoading={isLoading} error={error}>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-content-subtle">
              <tr>
                <th className="px-4 py-3">{t("studio.col.name")}</th>
                <th className="px-4 py-3">{t("studio.field.grade")}</th>
                <th className="px-4 py-3">{t("studio.dashboard.completedMoments")}</th>
                <th className="px-4 py-3">{t("studio.analytics.attempts")}</th>
                <th className="px-4 py-3">{t("studio.students.lastActivity")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.id} className={s.is_active ? "" : "opacity-50"}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-content">{s.full_name}</p>
                    <p className="text-xs text-content-subtle">{s.email}</p>
                  </td>
                  <td className="px-4 py-3 text-content-muted">{s.grade ?? "—"}</td>
                  <td className="px-4 py-3 text-content-muted">{s.completed_moments}</td>
                  <td className="px-4 py-3 text-content-muted">{s.attempts}</td>
                  <td className="px-4 py-3 text-content-subtle">
                    {s.last_activity
                      ? new Date(s.last_activity).toLocaleDateString()
                      : "—"}
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
