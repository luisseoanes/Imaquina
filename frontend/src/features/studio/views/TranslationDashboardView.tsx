import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useTranslationDashboard } from "../api";
import { Card, PageHeader, QueryState } from "@/shared/ui/panel";
import { routes } from "@/shared/config/routes";

const LANGS = ["es", "en"] as const;

export function TranslationDashboardView() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useTranslationDashboard();

  const linkFor = (r: { type: string; id: string }) =>
    r.type === "project"
      ? routes.studioProject(r.id)
      : r.type === "lesson"
        ? routes.studioLessons
        : routes.studioResources;

  return (
    <div>
      <PageHeader
        title={t("studio.nav.translation")}
        description={t("studio.translation.subtitle")}
      />
      <QueryState isLoading={isLoading} error={error}>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-content-subtle">
              <tr>
                <th className="px-4 py-3">{t("studio.field.slug")}</th>
                <th className="px-4 py-3">{t("studio.field.grade")}</th>
                {LANGS.map((l) => (
                  <th key={l} className="px-4 py-3 uppercase">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(data ?? []).map((r) => (
                <tr key={`${r.type}-${r.id}`}>
                  <td className="px-4 py-3 font-medium text-content">
                    <Link to={linkFor(r)} className="hover:underline">
                      {r.slug}
                    </Link>
                    <span className="ml-2 text-xs text-content-subtle">
                      {t(`studio.nav.${r.type}s`, r.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-content-muted">{r.grade ?? "—"}</td>
                  {LANGS.map((l) => {
                    const st = r.langs[l];
                    return (
                      <td key={l} className="px-4 py-3">
                        {st?.complete ? (
                          <span className="text-success">✓</span>
                        ) : (
                          <span className="text-brand-ink">
                            {st && st.missing > 0
                              ? t("studio.translation.missingN", {
                                  count: st.missing,
                                })
                              : t("studio.editor.incomplete")}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </QueryState>
    </div>
  );
}
