import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useTemplateMutations, useTemplates } from "../api";
import { useStudio } from "../StudioContext";
import type { ContentTemplate } from "../types";
import { routes } from "@/shared/config/routes";
import { SimpleCrud } from "./SimpleCrud";

const EXAMPLE = JSON.stringify(
  {
    title: "Proyecto base",
    summary: "",
    moments: {
      intro: { title: "Introducción", blocks: [{ kind: "text", body: "" }] },
    },
  },
  null,
  2,
);

export function TemplatesView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { search } = useStudio();
  const { data, isLoading, error } = useTemplates();
  const m = useTemplateMutations();

  const rows = (data ?? []).filter((tpl) =>
    `${tpl.name} ${tpl.slug}`.toLowerCase().includes(search.toLowerCase()),
  );

  const parsePayload = (raw: string): Record<string, unknown> => {
    if (!raw.trim()) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(t("studio.templates.badJson"));
    }
  };

  return (
    <SimpleCrud<ContentTemplate>
      title={t("studio.nav.templates")}
      subtitle={t("studio.templates.subtitle")}
      newLabel={t("studio.templates.new")}
      lang="es"
      rows={rows}
      isLoading={isLoading}
      error={error}
      emptyMessage={t("studio.templates.empty")}
      saving={m.create.isPending || m.update.isPending}
      saveError={m.create.error ?? m.update.error}
      columns={[
        {
          key: "name",
          label: t("studio.col.name"),
          render: (tpl) => (
            <span className="font-medium text-content">{tpl.name}</span>
          ),
        },
        {
          key: "kind",
          label: t("studio.col.kind"),
          render: (tpl) => t(`studio.templateKind.${tpl.kind}`, tpl.kind),
        },
        {
          key: "desc",
          label: t("studio.field.description"),
          render: (tpl) => tpl.description ?? "—",
        },
      ]}
      rowActions={(tpl) =>
        tpl.kind === "project" ? (
          <button
            type="button"
            className="text-brand-ink hover:underline"
            onClick={async () => {
              const slug = prompt(t("studio.templates.applySlug"));
              if (!slug) return;
              const grade = prompt(t("studio.field.grade"));
              if (!grade) return;
              const created = await m.apply.mutateAsync({ id: tpl.id, slug, grade });
              navigate(routes.studioProject(created.id));
            }}
          >
            {t("studio.templates.apply")}
          </button>
        ) : null
      }
      fields={[
        { name: "slug", label: t("studio.field.slug"), required: true },
        { name: "name", label: t("studio.col.name"), required: true },
        {
          name: "kind",
          label: t("studio.col.kind"),
          type: "select",
          options: [
            { value: "project", label: t("studio.templateKind.project") },
            { value: "lesson", label: t("studio.templateKind.lesson") },
          ],
        },
        { name: "description", label: t("studio.field.description"), type: "textarea" },
        {
          name: "payload",
          label: "JSON",
          type: "textarea",
          hint: t("studio.templates.payloadHint"),
        },
      ]}
      blankForm={{ slug: "", name: "", kind: "project", description: "", payload: EXAMPLE }}
      toForm={(tpl) => ({
        slug: tpl.slug,
        name: tpl.name,
        kind: tpl.kind,
        description: tpl.description ?? "",
        payload: JSON.stringify(tpl.payload ?? {}, null, 2),
      })}
      onCreate={(v) =>
        m.create.mutateAsync({
          slug: v.slug,
          name: v.name,
          kind: v.kind || "project",
          description: v.description || null,
          payload: parsePayload(v.payload ?? ""),
        })
      }
      onUpdate={(id, v) =>
        m.update.mutateAsync({
          id,
          slug: v.slug,
          name: v.name,
          kind: v.kind || "project",
          description: v.description || null,
          payload: parsePayload(v.payload ?? ""),
        })
      }
      onDelete={(id) => m.remove.mutate(id)}
    />
  );
}
