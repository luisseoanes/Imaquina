import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useCollectionMutations,
  useCollections,
  useLessons,
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
  TextArea,
  TextInput,
  useForm,
} from "@/shared/ui/panel";
import { useStudio } from "../StudioContext";
import type { Collection, RefType } from "../types";

export function CollectionsView() {
  const { t } = useTranslation();
  const { lang, search } = useStudio();
  const { data, isLoading, error } = useCollections(lang);
  const projects = useProjects(lang);
  const lessons = useLessons(lang);
  const m = useCollectionMutations(lang);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [itemsFor, setItemsFor] = useState<Collection | null>(null);
  const form = useForm({ slug: "", title: "", description: "" });

  const openEdit = (c: Collection | null) => {
    setEditing(c);
    form.reset();
    if (c) {
      form.set("slug", c.slug);
      form.set("title", c.title ?? "");
      form.set("description", c.description ?? "");
    }
    setFormOpen(true);
  };
  const submit = async () => {
    const v = form.values;
    const payload = { slug: v.slug, title: v.title, description: v.description || null };
    if (editing) await m.update.mutateAsync({ id: editing.id, ...payload });
    else await m.create.mutateAsync(payload);
    setFormOpen(false);
  };

  const labelFor = (rt: RefType, id: string) =>
    (rt === "lesson" ? lessons.data : projects.data)?.find((x) => x.id === id)
      ?.title ?? id;

  const rows = (data ?? []).filter((c) =>
    `${c.title ?? ""} ${c.slug}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title={t("studio.nav.collections")}
        description={t("studio.collections.subtitle")}
        actions={
          <Button onClick={() => openEdit(null)}>{t("studio.collections.new")}</Button>
        }
      />
      <QueryState isLoading={isLoading} error={error}>
        {rows.length === 0 ? (
          <EmptyState message={t("studio.collections.empty")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((c) => (
              <Card key={c.id}>
                <h2 className="font-semibold text-content">{c.title ?? c.slug}</h2>
                <p className="mb-2 text-xs text-content-subtle">
                  {t("studio.collections.itemCount", { count: c.items.length })}
                </p>
                <ul className="mb-3 list-disc space-y-0.5 pl-5 text-sm text-content-muted">
                  {c.items.slice(0, 5).map((it) => (
                    <li key={it.id}>{labelFor(it.target_type, it.target_id)}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 text-sm">
                  <button
                    type="button"
                    className="text-brand-ink hover:underline"
                    onClick={() => setItemsFor(c)}
                  >
                    {t("studio.collections.editItems")}
                  </button>
                  <button
                    type="button"
                    className="text-brand-ink hover:underline"
                    onClick={() => openEdit(c)}
                  >
                    {t("studio.action.edit")}
                  </button>
                  <button
                    type="button"
                    className="text-danger hover:underline"
                    onClick={() => {
                      if (confirm(t("studio.action.confirmDelete"))) m.remove.mutate(c.id);
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
        title={editing ? t("studio.action.edit") : t("studio.collections.new")}
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
        <CollectionItemsEditor
          collection={itemsFor}
          onClose={() => setItemsFor(null)}
          projects={(projects.data ?? []).map((x) => ({ id: x.id, label: x.title ?? x.slug }))}
          lessons={(lessons.data ?? []).map((x) => ({ id: x.id, label: x.title ?? x.slug }))}
          saving={m.setItems.isPending}
          onSave={async (items) => {
            await m.setItems.mutateAsync({ id: itemsFor.id, items });
            setItemsFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CollectionItemsEditor({
  collection,
  onClose,
  projects,
  lessons,
  onSave,
  saving,
}: {
  collection: Collection;
  onClose: () => void;
  projects: { id: string; label: string }[];
  lessons: { id: string; label: string }[];
  onSave: (items: { target_type: RefType; target_id: string }[]) => Promise<void>;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<{ target_type: RefType; target_id: string }[]>(
    collection.items.map((i) => ({ target_type: i.target_type, target_id: i.target_id })),
  );
  const [type, setType] = useState<RefType>("project");
  const [id, setId] = useState("");
  const pool = type === "lesson" ? lessons : projects;
  const labelFor = (rt: RefType, x: string) =>
    (rt === "lesson" ? lessons : projects).find((p) => p.id === x)?.label ?? x;

  return (
    <SlideOver open onClose={onClose} title={t("studio.collections.editItems")}>
      <ul className="mb-4 space-y-2">
        {items.map((it, idx) => (
          <li
            key={`${it.target_type}-${it.target_id}-${idx}`}
            className="flex items-center gap-2 rounded-control bg-surface-muted px-3 py-2 text-sm"
          >
            <span className="flex-1 text-content">
              {labelFor(it.target_type, it.target_id)}
            </span>
            <button
              type="button"
              className="text-danger"
              onClick={() => setItems((c) => c.filter((_, i) => i !== idx))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="mb-4 grid grid-cols-[auto_1fr_auto] gap-2">
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value as RefType);
            setId("");
          }}
        >
          <option value="project">{t("studio.refType.project")}</option>
          <option value="lesson">{t("studio.refType.lesson")}</option>
        </Select>
        <Select value={id} onChange={(e) => setId(e.target.value)}>
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
            if (id) {
              setItems((c) => [...c, { target_type: type, target_id: id }]);
              setId("");
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
