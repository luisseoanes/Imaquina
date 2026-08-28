import { useTranslation } from "react-i18next";

import { useResourceMutations, useResources } from "../api";
import { useStudio } from "../StudioContext";
import { StatusBadge } from "@/shared/ui/panel";
import type { Resource } from "../types";
import { SimpleCrud } from "./SimpleCrud";

export function ResourcesView() {
  const { t } = useTranslation();
  const { lang, search } = useStudio();
  const { data, isLoading, error } = useResources(lang);
  const m = useResourceMutations(lang);

  const rows = (data ?? []).filter((r) =>
    `${r.title ?? ""} ${r.slug} ${r.area}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <SimpleCrud<Resource>
      title={t("studio.nav.resources")}
      subtitle={t("studio.resources.subtitle")}
      newLabel={t("studio.resources.new")}
      lang={lang}
      rows={rows}
      isLoading={isLoading}
      error={error}
      emptyMessage={t("studio.resources.empty")}
      saving={m.create.isPending || m.update.isPending}
      saveError={m.create.error ?? m.update.error}
      columns={[
        {
          key: "title",
          label: t("studio.col.title"),
          render: (r) => (
            <span className="font-medium text-content">{r.title ?? r.slug}</span>
          ),
        },
        { key: "area", label: t("studio.col.area"), render: (r) => r.area },
        {
          key: "kind",
          label: t("studio.col.kind"),
          render: (r) => t(`studio.resourceKind.${r.kind}`, r.kind),
        },
        {
          key: "status",
          label: t("studio.col.status"),
          render: (r) => <StatusBadge status={r.status} />,
        },
      ]}
      rowActions={(r) => (
        <button
          type="button"
          onClick={() =>
            m.setStatus.mutate({
              id: r.id,
              status: r.status === "published" ? "draft" : "published",
            })
          }
          className="text-content-muted hover:text-content"
        >
          {r.status === "published"
            ? t("studio.action.unpublish")
            : t("studio.action.publish")}
        </button>
      )}
      fields={[
        { name: "slug", label: t("studio.field.slug"), required: true },
        { name: "area", label: t("studio.field.area"), required: true },
        { name: "title", label: t("studio.field.title"), required: true, perLang: true },
        {
          name: "kind",
          label: t("studio.col.kind"),
          type: "select",
          options: [
            { value: "link", label: t("studio.resourceKind.link") },
            { value: "file", label: t("studio.resourceKind.file") },
            { value: "doc", label: t("studio.resourceKind.doc") },
          ],
        },
        { name: "url", label: t("studio.field.url"), type: "url" },
        {
          name: "description",
          label: t("studio.field.description"),
          type: "textarea",
          perLang: true,
        },
      ]}
      blankForm={{ slug: "", area: "", title: "", kind: "link", url: "", description: "" }}
      toForm={(r) => ({
        slug: r.slug,
        area: r.area,
        title: r.title ?? "",
        kind: r.kind,
        url: r.url ?? "",
        description: r.description ?? "",
      })}
      onCreate={(v) =>
        m.create.mutateAsync({
          slug: v.slug,
          area: v.area,
          title: v.title,
          kind: v.kind || "link",
          url: v.url || null,
          description: v.description || null,
        })
      }
      onUpdate={(id, v) =>
        m.update.mutateAsync({
          id,
          slug: v.slug,
          area: v.area,
          title: v.title,
          kind: v.kind || "link",
          url: v.url || null,
          description: v.description || null,
        })
      }
      onDelete={(id) => m.remove.mutate(id)}
    />
  );
}
