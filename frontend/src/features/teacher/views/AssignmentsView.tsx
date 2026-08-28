import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  PastelBadge,
  QueryState,
  SlideOver,
  TextArea,
  TextInput,
  useForm,
} from "@/shared/ui/panel";
import type { Tone } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import {
  useAssignmentMutations,
  useAssignments,
  useAssignmentTracking,
  useCourses,
  usePublishedProjects,
} from "../api";
import type { Assignment } from "../api";
import { useTeacher } from "../TeacherContext";

const TIME_TONE: Record<string, Tone> = {
  done: "success",
  pending: "info",
  late: "danger",
  no_due: "neutral",
};

export function AssignmentsView() {
  const { t } = useTranslation();
  const { lang, search } = useTeacher();
  const list = useAssignments();
  const courses = useCourses();
  const projects = usePublishedProjects(lang);
  const m = useAssignmentMutations();

  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState<Assignment | null>(null);
  const form = useForm({
    course_ids: [] as string[],
    project_id: "",
    title: "",
    instructions: "",
    due_at: "",
    is_published: true,
  });

  const submit = async () => {
    const v = form.values;
    await m.create.mutateAsync({
      course_ids: v.course_ids,
      project_id: v.project_id,
      title: v.title,
      instructions: v.instructions || null,
      due_at: v.due_at ? new Date(v.due_at).toISOString() : null,
      is_published: v.is_published,
    });
    setOpen(false);
  };

  const rows = (list.data ?? []).filter((a) =>
    `${a.title} ${a.course_name} ${a.project_title}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t("teacher.nav.assignments")}
        description={t("teacher.assignments.subtitle")}
        actions={
          <Button
            onClick={() => {
              form.reset();
              setOpen(true);
            }}
          >
            {t("teacher.assignments.new")}
          </Button>
        }
      />
      <QueryState isLoading={list.isLoading} error={list.error}>
        {rows.length === 0 ? (
          <EmptyState message={t("teacher.assignments.empty")} />
        ) : (
          <div className="space-y-3">
            {rows.map((a) => (
              <Card key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-bold text-content">{a.title}</p>
                      {!a.is_published ? (
                        <PastelBadge tone="warning">
                          {t("teacher.assignments.draft")}
                        </PastelBadge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-content-muted">
                      {a.course_name} · {a.project_title}
                    </p>
                    <p className="mt-1 text-xs text-content-subtle">
                      {a.due_at
                        ? t("teacher.assignments.dueOn", {
                            date: new Date(a.due_at).toLocaleDateString(),
                          })
                        : t("teacher.assignments.noDue")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      className="text-brand-ink hover:underline"
                      onClick={() => setTracking(a)}
                    >
                      {t("teacher.assignments.tracking")}
                    </button>
                    <button
                      type="button"
                      className="text-content-muted hover:text-content"
                      onClick={() =>
                        m.update.mutate({ id: a.id, is_published: !a.is_published })
                      }
                    >
                      {a.is_published
                        ? t("teacher.assignments.unpublish")
                        : t("teacher.assignments.publish")}
                    </button>
                    <button
                      type="button"
                      className="text-danger hover:underline"
                      onClick={() => {
                        if (confirm(t("teacher.assignments.confirmDelete")))
                          m.remove.mutate(a.id);
                      }}
                    >
                      {t("studio.action.delete", "Eliminar")}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={t("teacher.assignments.new")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label={t("teacher.assignments.courses")}>
            <div className="space-y-1.5">
              {(courses.data ?? []).map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-content">
                  <input
                    type="checkbox"
                    checked={form.values.course_ids.includes(c.id)}
                    onChange={(e) =>
                      form.set(
                        "course_ids",
                        e.target.checked
                          ? [...form.values.course_ids, c.id]
                          : form.values.course_ids.filter((x) => x !== c.id),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label={t("teacher.grading.pickProject")}>
            <select
              required
              value={form.values.project_id}
              onChange={(e) => form.set("project_id", e.target.value)}
              className="w-full rounded-control border border-line bg-canvas px-3 py-2.5 text-sm text-content"
            >
              <option value="">—</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("teacher.assignments.title")}>
            <TextInput
              required
              value={form.values.title}
              onChange={(e) => form.set("title", e.target.value)}
            />
          </Field>
          <Field label={t("teacher.assignments.instructions")}>
            <TextArea
              value={form.values.instructions}
              onChange={(e) => form.set("instructions", e.target.value)}
            />
          </Field>
          <Field label={t("teacher.assignments.dueDate")}>
            <TextInput
              type="datetime-local"
              value={form.values.due_at}
              onChange={(e) => form.set("due_at", e.target.value)}
            />
          </Field>
          <label className="mb-3 flex items-center gap-2 text-sm text-content">
            <input
              type="checkbox"
              checked={form.values.is_published}
              onChange={(e) => form.set("is_published", e.target.checked)}
            />
            {t("teacher.assignments.publishNow")}
          </label>
          {m.create.error instanceof Error ? (
            <p className="mb-2 text-sm text-danger">{m.create.error.message}</p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button
              type="submit"
              disabled={m.create.isPending || form.values.course_ids.length === 0}
            >
              {t("common.save")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </SlideOver>

      {tracking ? (
        <TrackingDrawer assignment={tracking} onClose={() => setTracking(null)} />
      ) : null}
    </div>
  );
}

function TrackingDrawer({
  assignment,
  onClose,
}: {
  assignment: Assignment;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useAssignmentTracking(assignment.id, true);

  return (
    <SlideOver open onClose={onClose} title={t("teacher.assignments.tracking")}>
      <p className="mb-1 font-display font-bold text-content">{assignment.title}</p>
      <p className="mb-4 text-xs text-content-muted">
        {assignment.course_name} ·{" "}
        {assignment.due_at
          ? t("teacher.assignments.dueOn", {
              date: new Date(assignment.due_at).toLocaleDateString(),
            })
          : t("teacher.assignments.noDue")}
      </p>
      <QueryState isLoading={isLoading} error={error}>
        <ul className="space-y-2">
          {(data?.rows ?? []).map((r) => (
            <li
              key={r.user_id}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-content">
                  {r.full_name}
                </p>
                <p className="text-xs text-content-subtle">
                  {r.completed_moments}/{r.total_moments}{" "}
                  {t("teacher.assignments.moments")}
                </p>
              </div>
              <PastelBadge tone={TIME_TONE[r.timeliness] ?? "neutral"}>
                {t(`teacher.assignments.time.${r.timeliness}`, r.timeliness)}
              </PastelBadge>
            </li>
          ))}
        </ul>
      </QueryState>
      <div className="mt-4">
        <Button variant="ghost" onClick={onClose}>
          <Icon name="close" className="h-4 w-4" />
          {t("common.cancel")}
        </Button>
      </div>
    </SlideOver>
  );
}
