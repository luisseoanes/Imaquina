import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import {
  Button,
  EmptyState,
  Field,
  PageHeader,
  QueryState,
  Select,
  SlideOver,
  TextInput,
  useForm,
} from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import { useAdmin } from "../AdminContext";
import { useCourseMutations, useCourses, useUsers } from "../api";

export function CoursesView() {
  const { t } = useTranslation();
  const { search } = useAdmin();
  const courses = useCourses();
  const users = useUsers();
  const m = useCourseMutations();

  const teachers = useMemo(
    () => (users.data ?? []).filter((u) => u.role === "teacher"),
    [users.data],
  );
  const teacherName = (id: string | null) =>
    id ? (teachers.find((x) => x.id === id)?.full_name ?? "—") : "—";

  const [open, setOpen] = useState(false);
  const form = useForm({ name: "", grade: "", teacher_id: "" });

  const submit = async () => {
    const v = form.values;
    await m.create.mutateAsync({
      name: v.name,
      grade: v.grade,
      teacher_id: v.teacher_id || null,
    });
    setOpen(false);
  };

  const rows = (courses.data ?? []).filter((c) =>
    `${c.name} ${c.grade}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("admin.nav.courses")}
        description={t("admin.courses.subtitle")}
        actions={
          <Button
            onClick={() => {
              form.reset();
              setOpen(true);
            }}
          >
            {t("admin.courses.new")}
          </Button>
        }
      />

      <QueryState isLoading={courses.isLoading} error={courses.error}>
        {rows.length === 0 ? (
          <EmptyState message={t("admin.courses.empty")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((c) => (
              <Link
                key={c.id}
                to={routes.adminCourse(c.id)}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-line/60 bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float"
              >
                <div className="min-w-0">
                  <p className="truncate font-display font-bold text-content">
                    {c.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-content-muted">
                    {t("admin.courses.grade", { grade: c.grade })} ·{" "}
                    {teacherName(c.teacher_id)}
                  </p>
                </div>
                <Icon
                  name="chevron-right"
                  className="h-5 w-5 flex-shrink-0 text-content-subtle transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
            ))}
          </div>
        )}
      </QueryState>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={t("admin.courses.new")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label={t("admin.field.courseName")}>
            <TextInput
              required
              value={form.values.name}
              onChange={(e) => form.set("name", e.target.value)}
            />
          </Field>
          <Field label={t("admin.col.grade")}>
            <TextInput
              required
              value={form.values.grade}
              onChange={(e) => form.set("grade", e.target.value)}
            />
          </Field>
          <Field label={t("admin.field.teacher")}>
            <Select
              value={form.values.teacher_id}
              onChange={(e) => form.set("teacher_id", e.target.value)}
            >
              <option value="">{t("admin.field.noTeacher")}</option>
              {teachers.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.full_name}
                </option>
              ))}
            </Select>
          </Field>
          {m.create.error ? (
            <p className="mb-2 text-sm text-danger">
              {(m.create.error as Error).message}
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
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
