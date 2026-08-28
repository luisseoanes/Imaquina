import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import {
  EmptyState,
  Kpi,
  PageHeader,
  QueryState,
  SectionTitle,
  TONE_SOFT,
} from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import type { IconName } from "@/shared/ui/panel-icons";
import type { Tone } from "@/shared/ui/panel";
import { useCourses, usePublishedProjects } from "../api";
import { useTeacher } from "../TeacherContext";

export function DashboardView() {
  const { t } = useTranslation();
  const { lang } = useTeacher();
  const courses = useCourses();
  const projects = usePublishedProjects(lang);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("teacher.dashboard.title")} description={t("teacher.dashboard.subtitle")} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Kpi
          label={t("teacher.dashboard.courses")}
          value={String(courses.data?.length ?? 0)}
          icon="users"
          tone="info"
        />
        <Kpi
          label={t("teacher.dashboard.publishedProjects")}
          value={String(projects.data?.length ?? 0)}
          icon="cpu"
          tone="violet"
        />
        <Kpi
          label={t("teacher.dashboard.grades")}
          value={t("teacher.dashboard.gradesValue")}
          icon="check-square"
          tone="success"
        />
      </div>

      <SectionTitle title={t("teacher.dashboard.shortcuts")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Shortcut to={routes.teacherProgress} icon="bar-chart" tone="info" label={t("teacher.nav.progress")} body={t("teacher.dashboard.progressBody")} />
        <Shortcut to={routes.teacherGrading} icon="check-square" tone="success" label={t("teacher.nav.grading")} body={t("teacher.dashboard.gradingBody")} />
        <Shortcut to={routes.teacherContent} icon="book" tone="violet" label={t("teacher.nav.content")} body={t("teacher.dashboard.contentBody")} />
      </div>

      <SectionTitle
        title={t("teacher.dashboard.myCourses")}
        action={
          <Link to={routes.teacherCourses} className="text-sm text-brand-ink hover:underline">
            {t("common.seeAll")}
          </Link>
        }
      />
      <QueryState isLoading={courses.isLoading} error={courses.error}>
        {(courses.data ?? []).length === 0 ? (
          <EmptyState message={t("teacher.courses.empty")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(courses.data ?? []).map((c) => (
              <Link
                key={c.id}
                to={routes.teacherCourse(c.id)}
                className="rounded-2xl border border-line/60 bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float"
              >
                <p className="font-display font-bold text-content">{c.name}</p>
                <p className="mt-1 text-xs text-content-muted">
                  {t("teacher.courses.grade", { grade: c.grade })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

function Shortcut({
  to,
  icon,
  tone,
  label,
  body,
}: {
  to: string;
  icon: IconName;
  tone: Tone;
  label: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-2xl border border-line/60 bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float"
    >
      <span className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${TONE_SOFT[tone]}`}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="font-display font-bold text-content">{label}</p>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-content-muted">{body}</p>
      <Icon
        name="arrow-right"
        className="mt-3 h-4 w-4 text-brand-ink transition-transform duration-200 group-hover:translate-x-0.5"
      />
    </Link>
  );
}
