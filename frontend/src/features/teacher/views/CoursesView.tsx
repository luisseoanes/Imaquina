import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import { EmptyState, PageHeader, QueryState } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import { useCourses } from "../api";
import { useTeacher } from "../TeacherContext";

export function CoursesView() {
  const { t } = useTranslation();
  const { search } = useTeacher();
  const { data, isLoading, error } = useCourses();

  const rows = (data ?? []).filter((c) =>
    `${c.name} ${c.grade}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("teacher.nav.courses")} description={t("teacher.courses.subtitle")} />
      <QueryState isLoading={isLoading} error={error}>
        {rows.length === 0 ? (
          <EmptyState message={t("teacher.courses.empty")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((c) => (
              <Link
                key={c.id}
                to={routes.teacherCourse(c.id)}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-line/60 bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float"
              >
                <div>
                  <p className="font-display font-bold text-content">{c.name}</p>
                  <p className="mt-1 text-xs text-content-muted">
                    {t("teacher.courses.grade", { grade: c.grade })}
                  </p>
                </div>
                <Icon
                  name="chevron-right"
                  className="h-5 w-5 text-content-subtle transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
