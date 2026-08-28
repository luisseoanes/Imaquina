import { useTranslation } from "react-i18next";

import { useTagMutations, useTags } from "../api";
import { useStudio } from "../StudioContext";
import type { Tag } from "../types";
import { SimpleCrud } from "./SimpleCrud";

export function TagsView() {
  const { t } = useTranslation();
  const { search } = useStudio();
  const { data, isLoading, error } = useTags();
  const m = useTagMutations();

  const rows = (data ?? []).filter((tag) =>
    `${tag.name} ${tag.slug}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SimpleCrud<Tag>
      title={t("studio.nav.tags")}
      subtitle={t("studio.tags.subtitle")}
      newLabel={t("studio.tags.new")}
      lang="es"
      rows={rows}
      isLoading={isLoading}
      error={error}
      emptyMessage={t("studio.tags.empty")}
      saving={m.create.isPending || m.update.isPending}
      saveError={m.create.error ?? m.update.error}
      columns={[
        {
          key: "name",
          label: t("studio.col.name"),
          render: (tag) => (
            <span className="font-medium text-content">{tag.name}</span>
          ),
        },
        { key: "slug", label: t("studio.field.slug"), render: (tag) => tag.slug },
        {
          key: "color",
          label: t("studio.field.color"),
          render: (tag) => tag.color ?? "—",
        },
        {
          key: "used",
          label: t("studio.col.usedIn"),
          render: (tag) => String(tag.used_in),
        },
      ]}
      fields={[
        { name: "slug", label: t("studio.field.slug"), required: true },
        { name: "name", label: t("studio.col.name"), required: true },
        {
          name: "color",
          label: t("studio.field.color"),
          type: "select",
          hint: t("studio.tags.colorHint"),
          options: [
            { value: "brand", label: "brand" },
            { value: "brand-ink", label: "brand-ink" },
            { value: "success", label: "success" },
            { value: "danger", label: "danger" },
          ],
        },
      ]}
      blankForm={{ slug: "", name: "", color: "" }}
      toForm={(tag) => ({ slug: tag.slug, name: tag.name, color: tag.color ?? "" })}
      onCreate={(v) =>
        m.create.mutateAsync({
          slug: v.slug ?? "",
          name: v.name ?? "",
          color: v.color || null,
        })
      }
      onUpdate={(id, v) =>
        m.update.mutateAsync({
          id,
          slug: v.slug ?? "",
          name: v.name ?? "",
          color: v.color || null,
        })
      }
      onDelete={(id) => m.remove.mutate(id)}
    />
  );
}
