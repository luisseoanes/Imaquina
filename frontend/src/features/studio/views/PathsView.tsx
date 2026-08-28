import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useLessons,
  usePathMutations,
  usePaths,
  useProjects,
} from "../api";
import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  QueryState,
  Select,
  SlideOver,
  StatusBadge,
  TextArea,
  TextInput,
  useForm,
} from "@/shared/ui/panel";
import { useStudio } from "../StudioContext";
import type { LearningPath, RefType } from "../types";

export function PathsView() {
  const { t } = useTranslation();
  const { lang, search } = useStudio();
  const { data, isLoading, error } = usePaths(lang);
  const projects = useProjects(lang);
  const lessons = useLessons(lang);
  const m = usePathMutations(lang);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LearningPath | null>(null);
  const [itemsFor, setItemsFor] = useState<LearningPath | null>(null);
  const form = useForm({ slug: "", title: "", grade: "", description: "" });

  const openNew = () => {
    setEditing(null);
    form.reset();
    setFormOpen(true);
  };
  const openEdit = (p: LearningPath) => {
    setEditing(p);
    form.reset();
    form.set("slug", p.slug);
    form.set("title", p.title ?? "");
    form.set("grade", p.grade ?? "");
    form.set("description", p.description ?? "");
    setFormOpen(true);
  };
  const submit = async () => {
    const v = form.values;
    const payload = {
      slug: v.slug,
      title: v.title,
      grade: v.grade || null,
      description: v.description || null,
    };
    if (editing) await m.update.mutateAsync({ id: editing.id, ...payload });
    else await m.create.mutateAsync(payload);
    setFormOpen(false);
  };

  const nameOf = (type: RefType, id: string): string => {
    if (type === "project")
      return projects.data?.find((x) => x.id === id)?.title ?? id;
    if (type === "lesson")
      return lessons.data?.find((x) => x.id === id)?.title ?? id;
    return id;
  };

  const rows = (data ?? []).filter((p) =>
    `${p.title ?? ""} ${p.slug}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title={t("studio.nav.paths")}
        description={t("studio.paths.subtitle")}
        actions={<Button onClick={openNew}>{t("studio.paths.new")}</Button>}
      />
      <QueryState isLoading={isLoading} error={error}>
        {rows.length === 0 ? (
          <EmptyState message={t("studio.paths.empty")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((p) => (
              <Card key={p.id}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-content">
                      {p.title ?? p.slug}
                    </h2>
                    <p className="text-xs text-content-subtle">
                      {p.grade ? `${t("studio.field.grade")}: ${p.grade} · ` : ""}
                      {t("studio.paths.itemCount", { count: p.items.length })}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-content-muted">
                  {p.items.slice(0, 5).map((it) => (
                    <li key={it.id}>
                      <span className="text-content-subtle">
                        {t(`studio.refType.${it.ref_type}`, it.ref_type)}:
                      </span>{" "}
                      {nameOf(it.ref_type, it.ref_id)}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2 text-sm">
                  <button
                    type="button"
                    className="text-brand-ink hover:underline"
                    onClick={() => setItemsFor(p)}
                  >
                    {t("studio.paths.editItems")}
                  </button>
                  <button
                    type="button"
                    className="text-brand-ink hover:underline"
                    onClick={() => openEdit(p)}
                  >
                    {t("studio.action.edit")}
                  </button>
                  <button
                    type="button"
                    className="text-content-muted hover:text-content"
                    onClick={() =>
                      m.update.mutate({
                        id: p.id,
                        status: p.status === "published" ? "draft" : "published",
                      })
                    }
                  >
                    {p.status === "published"
                      ? t("studio.action.unpublish")
                      : t("studio.action.publish")}
                  </button>
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
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      <SlideOver
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("studio.paths.edit") : t("studio.paths.new")}
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
          <Field label={t("studio.field.description")}>
            <TextArea
              value={form.values.description}
              onChange={(e) => form.set("description", e.target.value)}
            />
          </Field>
          <div className="mt-2 flex gap-2">
            <Button type="submit" disabled={m.create.isPending || m.update.isPending}>
              {t("common.save")}
            </Button>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </SlideOver>

      {itemsFor ? (
        <ItemsEditor
          path={itemsFor}
          onClose={() => setItemsFor(null)}
          projects={(projects.data ?? []).map((x) => ({
            id: x.id,
            label: x.title ?? x.slug,
          }))}
          lessons={(lessons.data ?? []).map((x) => ({
            id: x.id,
            label: x.title ?? x.slug,
          }))}
          onSave={async (items) => {
            await m.setItems.mutateAsync({ id: itemsFor.id, items });
            setItemsFor(null);
          }}
          saving={m.setItems.isPending}
        />
      ) : null}
    </div>
  );
}

function ItemsEditor({
  path,
  onClose,
  projects,
  lessons,
  onSave,
  saving,
}: {
  path: LearningPath;
  onClose: () => void;
  projects: { id: string; label: string }[];
  lessons: { id: string; label: string }[];
  onSave: (items: { ref_type: RefType; ref_id: string }[]) => Promise<void>;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<{ ref_type: RefType; ref_id: string }[]>(
    path.items.map((i) => ({ ref_type: i.ref_type, ref_id: i.ref_id })),
  );
  const [refType, setRefType] = useState<RefType>("project");
  const [refId, setRefId] = useState("");

  const pool = refType === "lesson" ? lessons : projects;
  const labelFor = (rt: RefType, id: string) =>
    (rt === "lesson" ? lessons : projects).find((x) => x.id === id)?.label ?? id;

  const move = (idx: number, dir: -1 | 1) => {
    setItems((cur) => {
      const next = [...cur];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return cur;
      const a = next[idx]!;
      next[idx] = next[j]!;
      next[j] = a;
      return next;
    });
  };

  return (
    <SlideOver open onClose={onClose} title={t("studio.paths.editItems")}>
      <ol className="mb-4 space-y-2">
        {items.map((it, idx) => (
          <li
            key={`${it.ref_type}-${it.ref_id}-${idx}`}
            className="flex items-center gap-2 rounded-control bg-surface-muted px-3 py-2 text-sm"
          >
            <span className="flex-1 text-content">
              {t(`studio.refType.${it.ref_type}`, it.ref_type)}:{" "}
              {labelFor(it.ref_type, it.ref_id)}
            </span>
            <button type="button" onClick={() => move(idx, -1)} aria-label="↑">
              ↑
            </button>
            <button type="button" onClick={() => move(idx, 1)} aria-label="↓">
              ↓
            </button>
            <button
              type="button"
              className="text-danger"
              onClick={() => setItems((c) => c.filter((_, i) => i !== idx))}
            >
              ✕
            </button>
          </li>
        ))}
      </ol>

      <div className="mb-4 grid grid-cols-[auto_1fr_auto] gap-2">
        <Select
          value={refType}
          onChange={(e) => {
            setRefType(e.target.value as RefType);
            setRefId("");
          }}
        >
          <option value="project">{t("studio.refType.project")}</option>
          <option value="lesson">{t("studio.refType.lesson")}</option>
        </Select>
        <Select value={refId} onChange={(e) => setRefId(e.target.value)}>
          <option value="">—</option>
          {pool.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          onClick={() => {
            if (refId) {
              setItems((c) => [...c, { ref_type: refType, ref_id: refId }]);
              setRefId("");
            }
          }}
        >
          +
        </Button>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => void onSave(items)} disabled={saving}>
          {t("common.save")}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      </div>
    </SlideOver>
  );
}
