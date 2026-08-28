import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import {
  Button,
  Card,
  PageHeader,
  QueryState,
  Select,
} from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import {
  useCourseMutations,
  useCourses,
  useCourseStudents,
  useUsers,
} from "../api";

export function CourseDetailView() {
  const { t } = useTranslation();
  const { courseId = "" } = useParams();
  const courses = useCourses();
  const users = useUsers();
  const students = useCourseStudents(courseId, { enabled: !!courseId });
  const m = useCourseMutations();

  const course = courses.data?.find((c) => c.id === courseId);
  const candidates = useMemo(() => {
    const enrolled = new Set((students.data ?? []).map((s) => s.id));
    return (users.data ?? []).filter(
      (u) => u.role === "student" && u.is_active && !enrolled.has(u.id),
    );
  }, [users.data, students.data]);

  const [pick, setPick] = useState("");

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to={routes.adminCourses}
        className="mb-3 inline-block text-sm text-content-muted hover:text-content"
      >
        ← {t("admin.nav.courses")}
      </Link>
      <PageHeader
        title={course?.name ?? t("admin.nav.courses")}
        description={
          course ? t("admin.courses.grade", { grade: course.grade }) : undefined
        }
      />

      <Card className="mb-5">
        <h2 className="mb-2 font-display text-base font-bold text-content">
          {t("admin.course.enroll")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="min-w-56 flex-1"
          >
            <option value="">{t("admin.course.pickStudent")}</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.email})
              </option>
            ))}
          </Select>
          <Button
            disabled={!pick || m.enroll.isPending}
            onClick={() => {
              if (pick) {
                m.enroll.mutate({ courseId, user_id: pick });
                setPick("");
              }
            }}
          >
            {t("admin.course.add")}
          </Button>
        </div>
        {candidates.length === 0 ? (
          <p className="mt-2 text-xs text-content-subtle">
            {t("admin.course.noCandidates")}
          </p>
        ) : null}
      </Card>

      <QueryState isLoading={students.isLoading} error={students.error}>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line/60 text-xs uppercase tracking-wide text-content-subtle">
                <th className="px-5 py-3.5 font-semibold">{t("admin.col.name")}</th>
                <th className="px-5 py-3.5 font-semibold">{t("admin.col.grade")}</th>
                <th className="px-5 py-3.5" />
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
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t("admin.course.confirmRemove")))
                          m.unenroll.mutate({ courseId, userId: s.id });
                      }}
                      className="inline-flex items-center gap-1 text-xs text-danger hover:underline"
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                      {t("admin.course.remove")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(students.data ?? []).length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-content-muted">
              {t("admin.course.noStudents")}
            </p>
          ) : null}
        </Card>
      </QueryState>
    </div>
  );
}
