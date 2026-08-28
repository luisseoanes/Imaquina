import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import { Card, PageHeader, PastelBadge, QueryState } from "@/shared/ui/panel";
import { useCourses, useCourseStudents } from "../api";

export function CourseDetailView() {
  const { t } = useTranslation();
  const { courseId = "" } = useParams();
  const courses = useCourses();
  const course = courses.data?.find((c) => c.id === courseId);
  const students = useCourseStudents(courseId, { enabled: !!courseId });

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to={routes.teacherCourses}
        className="mb-3 inline-block text-sm text-content-muted hover:text-content"
      >
        ← {t("teacher.nav.courses")}
      </Link>
      <PageHeader
        title={course?.name ?? t("teacher.nav.courses")}
        description={
          course ? t("teacher.courses.grade", { grade: course.grade }) : undefined
        }
        actions={
          <Link
            to={routes.teacherProgress}
            className="rounded-control bg-surface-muted px-3.5 py-2 text-sm font-medium text-content hover:bg-line"
          >
            {t("teacher.course.seeProgress")}
          </Link>
        }
      />
      <QueryState isLoading={students.isLoading} error={students.error}>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line/60 text-xs uppercase tracking-wide text-content-subtle">
                <th className="px-5 py-3.5 font-semibold">{t("teacher.col.student")}</th>
                <th className="px-5 py-3.5 font-semibold">{t("teacher.col.grade")}</th>
                <th className="px-5 py-3.5 font-semibold">{t("teacher.col.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {(students.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-content">{s.full_name}</p>
                    <p className="text-xs text-content-subtle">{s.email}</p>
                  </td>
                  <td className="px-5 py-4 text-content-muted">{s.grade ?? "—"}</td>
                  <td className="px-5 py-4">
                    <PastelBadge tone={s.is_active ? "success" : "neutral"}>
                      {s.is_active
                        ? t("teacher.status.active")
                        : t("teacher.status.inactive")}
                    </PastelBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(students.data ?? []).length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-content-muted">
              {t("teacher.course.noStudents")}
            </p>
          ) : null}
        </Card>
      </QueryState>
    </div>
  );
}
