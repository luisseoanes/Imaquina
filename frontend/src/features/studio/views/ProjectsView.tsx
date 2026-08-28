import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useProjectMutations, useProjects } from "../api";
import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  QueryState,
  SlideOver,
  StatusBadge,
  TextArea,
  TextInput,
  useForm,
} from "@/shared/ui/panel";
import { useStudio } from "../StudioContext";
import { routes } from "@/shared/config/routes";
import type { Project } from "../types";

export function ProjectsView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang, search } = useStudio();
  const { data, isLoading, error } = useProjects(lang);
  const m = useProjectMutations(lang);

  const [open, setOpen] = useState(false);
  const form = useForm({ slug: "", grade: "", title: "", kit: "", summary: "" });

  const submit = async () => {
    const v = form.values;
    const created = await m.create.mutateAsync({
      slug: v.slug,
      grade: v.grade,
      title: v.title,
      kit: v.kit || null,
      summary: v.summary || null,
    });
    setOpen(false);
    navigate(routes.studioProject(created.id));
  };

  const dup = async (p: Project) => {
    const slug = prompt(t("studio.projects.duplicateSlug"), `${p.slug}-copia`);
    if (slug) await m.duplicate.mutateAsync({ id: p.id, slug });
  };

  const rows = (data ?? []).filter((p) =>
    `${p.title ?? ""} ${p.slug} ${p.grade}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title={t("studio.nav.projects")}
        description={t("studio.projects.subtitle")}
        actions={
          <Button onClick={() => { form.reset(); setOpen(true); }}>
            {t("studio.projects.new")}
          </Button>
        }
      />
      <QueryState isLoading={isLoading} error={error}>
        {rows.length === 0 ? (
          <EmptyState message={t("studio.projects.empty")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((p) => (
              <Card key={p.id}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-content">
                    {p.title ?? p.slug}
                  </h2>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mb-3 text-xs text-content-subtle">
                  {t("studio.field.grade")}: {p.grade}
                  {p.kit ? ` · ${p.kit}` : ""} · {p.langs.join("/").toUpperCase() || "—"}
                </p>
                {p.summary ? (
                  <p className="mb-3 line-clamp-2 text-sm text-content-muted">
                    {p.summary}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 text-sm">
                  <button
                    type="button"
                    className="text-brand-ink hover:underline"
                    onClick={() => navigate(routes.studioProject(p.id))}
                  >
                    {t("studio.projects.openEditor")}
                  </button>
                  <button
                    type="button"
                    className="text-content-muted hover:text-content"
                    onClick={() => void dup(p)}
                  >
                    {t("studio.projects.duplicate")}
                  </button>
                  {p.status === "draft" ? (
                    <button
                      type="button"
                      className="text-danger hover:underline"
                      onClick={() => {
                        if (confirm(t("studio.action.confirmDelete")))
                          m.remove.mutate(p.id);
                      }}
                    >
                      {t("studio.action.delete")}
                    </button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={t("studio.projects.new")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label={t("studio.field.slug")}>
            <TextInput
              required
              value={form.values.slug}
              onChange={(e) => form.set("slug", e.target.value)}
            />
          </Field>
          <Field label={t("studio.field.grade")}>
            <TextInput
              required
              value={form.values.grade}
              onChange={(e) => form.set("grade", e.target.value)}
            />
          </Field>
          <Field label={`${t("studio.field.title")} (${lang.toUpperCase()})`}>
            <TextInput
              required
              value={form.values.title}
              onChange={(e) => form.set("title", e.target.value)}
            />
          </Field>
          <Field label={t("studio.field.kit")}>
            <TextInput
              value={form.values.kit}
              onChange={(e) => form.set("kit", e.target.value)}
            />
          </Field>
          <Field label={t("studio.field.summary")}>
            <TextArea
              value={form.values.summary}
              onChange={(e) => form.set("summary", e.target.value)}
            />
          </Field>
          {m.create.error instanceof Error ? (
            <p className="mb-2 text-sm text-danger">{m.create.error.message}</p>
          ) : null}
          <p className="mb-3 text-xs text-content-subtle">
            {t("studio.projects.momentsHint")}
          </p>
          <div className="flex gap-2">
            <Button type="submit" disabled={m.create.isPending}>
              {t("common.save")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
