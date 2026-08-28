import { useTranslation } from "react-i18next";

import { Card, EmptyState, PageHeader, QueryState } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import { useAdmin } from "../AdminContext";
import { useRejections } from "../api";

export function ModerationView() {
  const { t } = useTranslation();
  const { search } = useAdmin();
  const { data, isLoading, error } = useRejections();

  const rows = (data ?? []).filter((r) =>
    r.content.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t("admin.nav.moderation")}
        description={t("admin.moderation.subtitle")}
      />
      <QueryState isLoading={isLoading} error={error}>
        {rows.length === 0 ? (
          <EmptyState message={t("admin.moderation.empty")} />
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-warning-surface text-warning">
                    <Icon name="eye" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-content">{r.content}</p>
                    <p className="mt-1 text-xs text-content-subtle">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-content-subtle">
          {t("admin.moderation.note")}
        </p>
      </QueryState>
    </div>
  );
}
