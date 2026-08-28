import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useLessonMutations, useLessons } from "../api";
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
import type { Lesson } from "../types";

interface FormValues {
  slug: string;
  area: string;
  title: string;
  grade: string;
  summary: string;
  body: string;
  estimated_minutes: string;
}

const EMPTY: FormValues = {
  slug: "",
  area: "",
  title: "",
  grade: "",
  summary: "",
  body: "",
  estimated_minutes: "",
};

export function LessonsView() {
  const { t } = useTranslation();
  const { lang, search } = useStudio();
  const { data, isLoading, error } = useLessons(lang);
  const m = useLessonMutations(lang);

  const [editing, setEditing] = useState<Lesson | null>(null);
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues>(EMPTY);

  const openNew = () => {
    setEditing(null);
    form.reset();
    setOpen(true);
  };
  const openEdit = (l: Lesson) => {
    setEditing(l);
    form.reset();
    form.set("slug", l.slug);
    form.set("area", l.area);
    form.set("title", l.title ?? "");
    form.set("grade", l.grade ?? "");
    form.set("summary", l.summary ?? "");
    form.set("body", l.body ?? "");
    form.set(
      "estimated_minutes",
      l.estimated_minutes != null ? String(l.estimated_minutes) : "",
    );
    setOpen(true);
  };

  const submit = async () => {
    const v = form.values;
    const payload = {
      slug: v.slug,
      area: v.area,
      title: v.title,
      grade: v.grade || null,
      summary: v.summary || null,
      body: v.body || null,
      estimated_minutes: v.estimated_minutes ? Number(v.estimated_minutes) : null,
    };
    if (editing) await m.update.mutateAsync({ id: editing.id, ...payload });
    else await m.create.mutateAsync(payload);
    setOpen(false);
  };

  const rows = (data ?? []).filter((l) =>
    `${l.title ?? ""} ${l.slug} ${l.area}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title={t("studio.nav.lessons")}
        description={t("studio.lessons.subtitle")}
        actions={<Button onClick={openNew}>{t("studio.lessons.new")}</Button>}
      />
      <QueryState isLoading={isLoading} error={error}>
        {rows.length === 0 ? (
          <EmptyState message={t("studio.lessons.empty")} />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-content-subtle">
                <tr>
                  <th className="px-4 py-3">{t("studio.col.title")}</th>
                  <th className="px-4 py-3">{t("studio.col.area")}</th>
                  <th className="px-4 py-3">{t("studio.col.langs")}</th>
                  <th className="px-4 py-3">{t("studio.col.status")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium text-content">
                      {l.title ?? l.slug}
                    </td>
                    <td className="px-4 py-3 text-content-muted">{l.area}</td>
                    <td className="px-4 py-3 text-content-muted uppercase">
                      {l.langs.join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(l)}
                          className="text-brand-ink hover:underline"
                        >
                          {t("studio.action.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            m.setStatus.mutate({
                              id: l.id,
                              status: l.status === "published" ? "draft" : "published",
                            })
                          }
                          className="text-content-muted hover:text-content"
                        >
                          {l.status === "published"
                            ? t("studio.action.unpublish")
                            : t("studio.action.publish")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t("studio.action.confirmDelete")))
                              m.remove.mutate(l.id);
                          }}
                          className="text-danger hover:underline"
                        >
                          {t("studio.action.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </QueryState>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t("studio.lessons.edit") : t("studio.lessons.new")}
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
          <Field label={t("studio.field.area")}>
            <TextInput
              required
              value={form.values.area}
              onChange={(e) => form.set("area", e.target.value)}
            />
          </Field>
          <Field label={`${t("studio.field.title")} (${lang.toUpperCase()})`}>
            <TextInput
              required
              value={form.values.title}
              onChange={(e) => form.set("title", e.target.value)}
            />
          </Field>
          <Field label={t("studio.field.grade")}>
            <TextInput
              value={form.values.grade}
              onChange={(e) => form.set("grade", e.target.value)}
            />
          </Field>
          <Field label={t("studio.field.minutes")}>
            <TextInput
              type="number"
              min={0}
              value={form.values.estimated_minutes}
              onChange={(e) => form.set("estimated_minutes", e.target.value)}
            />
          </Field>
          <Field label={t("studio.field.summary")}>
            <TextArea
              value={form.values.summary}
              onChange={(e) => form.set("summary", e.target.value)}
            />
          </Field>
          <Field label={t("studio.field.body")} hint={t("studio.lessons.bodyHint")}>
            <TextArea
              rows={8}
              value={form.values.body}
              onChange={(e) => form.set("body", e.target.value)}
            />
          </Field>
          {(m.create.error || m.update.error) && (
            <p className="mb-2 text-sm text-danger">
              {(m.create.error ?? m.update.error) instanceof Error
                ? ((m.create.error ?? m.update.error) as Error).message
                : t("common.error")}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <Button type="submit" disabled={m.create.isPending || m.update.isPending}>
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
