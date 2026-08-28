import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card, EmptyState, PageHeader, PastelBadge, QueryState, Select } from "@/shared/ui/panel";
import type { Tone } from "@/shared/ui/panel";
import { useAdmin } from "../AdminContext";
import { useAudit } from "../api";

const ACTIONS = [
  "user.create",
  "user.deactivate",
  "user.activate",
  "user.update",
  "user.reset_password",
  "grade.change",
  "project.publish",
  "project.unpublish",
  "assignment.create",
];

const TONE: Record<string, Tone> = {
  "user.create": "success",
  "user.deactivate": "danger",
  "user.activate": "success",
  "user.reset_password": "warning",
  "grade.change": "info",
  "project.publish": "success",
  "project.unpublish": "warning",
  "assignment.create": "violet",
};

export function AuditView() {
  const { t } = useTranslation();
  const { search } = useAdmin();
  const [action, setAction] = useState("");
  const { data, isLoading, error } = useAudit(action);

  const rows = (data?.items ?? []).filter((e) =>
    `${e.summary} ${e.actor ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t("admin.nav.audit")}
        description={t("admin.audit.subtitle")}
        actions={
          <Select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">{t("admin.audit.allActions")}</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`admin.audit.action.${a}`, a)}
              </option>
            ))}
          </Select>
        }
      />
      <QueryState isLoading={isLoading} error={error}>
        {rows.length === 0 ? (
          <EmptyState message={t("admin.audit.empty")} />
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line/60 text-xs uppercase tracking-wide text-content-subtle">
                  <th className="px-5 py-3.5 font-semibold">{t("admin.audit.when")}</th>
                  <th className="px-5 py-3.5 font-semibold">{t("admin.audit.who")}</th>
                  <th className="px-5 py-3.5 font-semibold">{t("admin.audit.what")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-5 py-3.5 text-content-subtle">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted">{e.actor ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <PastelBadge tone={TONE[e.action] ?? "neutral"}>
                          {t(`admin.audit.action.${e.action}`, e.action)}
                        </PastelBadge>
                        <span className="text-content">{e.summary}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
