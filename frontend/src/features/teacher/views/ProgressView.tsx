import { useState } from "react";
import { useTranslation } from "react-i18next";

import { MOMENT_ORDER } from "@/shared/config/roles";
import { Card, PageHeader, QueryState, Select } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import {
  useCourseProgress,
  useCourses,
  usePublishedProjects,
} from "../api";
import type { ProgressState } from "../api";
import { useTeacher } from "../TeacherContext";

const STATE_CELL: Record<ProgressState, string> = {
  completed: "bg-success-surface text-success",
  in_progress: "bg-warning-surface text-warning",
  not_started: "bg-surface-muted text-content-subtle",
};

export function ProgressView() {
  const { t } = useTranslation();
  const { lang } = useTeacher();
  const courses = useCourses();
  const projects = usePublishedProjects(lang);

  const [courseId, setCourseId] = useState("");
  const [projectId, setProjectId] = useState("");

  const progress = useCourseProgress(courseId, projectId, {
    enabled: !!courseId && !!projectId,
  });

  const done = (rows: { progress: Record<string, ProgressState> }[]) =>
    rows.reduce(
      (acc, r) =>
        acc + Object.values(r.progress).filter((s) => s === "completed").length,
      0,
    );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("teacher.nav.progress")}
        description={t("teacher.progress.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">{t("teacher.progress.pickCourse")}</option>
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{t("teacher.progress.pickProject")}</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {!courseId || !projectId ? (
        <p className="text-sm text-content-muted">{t("teacher.progress.pickHint")}</p>
      ) : (
        <QueryState isLoading={progress.isLoading} error={progress.error}>
          <div className="mb-4 flex flex-wrap gap-3 text-xs text-content-muted">
            <Legend cls={STATE_CELL.completed} label={t("teacher.progress.completed")} />
            <Legend cls={STATE_CELL.in_progress} label={t("teacher.progress.inProgress")} />
            <Legend cls={STATE_CELL.not_started} label={t("teacher.progress.notStarted")} />
          </div>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line/60 text-xs uppercase tracking-wide text-content-subtle">
                    <th className="px-5 py-3.5 font-semibold">
                      {t("teacher.col.student")}
                    </th>
                    {MOMENT_ORDER.map((m) => (
                      <th key={m} className="px-3 py-3.5 text-center font-semibold">
                        {t(`studio.moment.${m}`, m).slice(0, 4)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/50">
                  {(progress.data ?? []).map((row) => (
                    <tr key={row.user_id}>
                      <td className="px-5 py-3 font-medium text-content">
                        {row.full_name}
                      </td>
                      {MOMENT_ORDER.map((m) => {
                        const s = row.progress[m] ?? "not_started";
                        return (
                          <td key={m} className="px-3 py-3 text-center">
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${STATE_CELL[s]}`}
                              title={t(`teacher.progress.${s === "in_progress" ? "inProgress" : s === "not_started" ? "notStarted" : "completed"}`)}
                            >
                              {s === "completed" ? (
                                <Icon name="check-square" className="h-3.5 w-3.5" />
                              ) : s === "in_progress" ? (
                                "·"
                              ) : (
                                ""
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {(progress.data ?? []).length > 0 ? (
            <p className="mt-3 text-xs text-content-subtle">
              {t("teacher.progress.summary", {
                done: done(progress.data ?? []),
                total: (progress.data ?? []).length * MOMENT_ORDER.length,
              })}
            </p>
          ) : (
            <p className="mt-3 text-sm text-content-muted">
              {t("teacher.course.noStudents")}
            </p>
          )}
        </QueryState>
      )}
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-4 w-4 rounded ${cls}`} />
      {label}
    </span>
  );
}
