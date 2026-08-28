import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import {
  Card,
  Kpi,
  PageHeader,
  PastelBadge,
  QueryState,
  SectionTitle,
  TONE_SOFT,
} from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import type { IconName } from "@/shared/ui/panel-icons";
import type { Tone } from "@/shared/ui/panel";
import {
  useAdminDashboard,
  useCourses,
  useRejections,
  useUsers,
} from "../api";

export function DashboardView() {
  const { t } = useTranslation();
  const users = useUsers();
  const courses = useCourses();
  const rejections = useRejections();
  const dashboard = useAdminDashboard();

  const counts = useMemo(() => {
    const list = users.data ?? [];
    return {
      active: list.filter((u) => u.is_active).length,
      teachers: list.filter((u) => u.role === "teacher").length,
      students: list.filter((u) => u.role === "student").length,
      authors: list.filter((u) => u.role === "editor" || u.role === "admin").length,
    };
  }, [users.data]);

  const nRejections = rejections.data?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("admin.dashboard.title")}
        description={t("admin.dashboard.subtitle")}
      />

      <QueryState isLoading={users.isLoading} error={users.error}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi
            label={t("admin.dashboard.activeUsers")}
            value={String(counts.active)}
            icon="users"
            tone="info"
          />
          <Kpi
            label={t("admin.dashboard.teachers")}
            value={String(counts.teachers)}
            icon="check-square"
            tone="success"
          />
          <Kpi
            label={t("admin.dashboard.students")}
            value={String(counts.students)}
            icon="book"
            tone="violet"
          />
          <Kpi
            label={t("admin.dashboard.courses")}
            value={String(courses.data?.length ?? 0)}
            icon="book"
            tone="brand"
          />
        </div>
      </QueryState>

      {nRejections > 0 ? (
        <Link
          to={routes.adminModeration}
          className="mt-4 flex items-center gap-3 rounded-2xl border border-line/60 bg-warning-surface p-4 text-warning shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float"
        >
          <Icon name="eye" className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            {t("admin.dashboard.moderationAlert", { count: nRejections })}
          </p>
          <Icon name="chevron-right" className="ml-auto h-4 w-4" />
        </Link>
      ) : null}

      <SectionTitle title={t("admin.dashboard.shortcuts")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Shortcut
          to={routes.adminUsers}
          icon="users"
          tone="info"
          label={t("admin.nav.users")}
          body={t("admin.dashboard.usersBody")}
        />
        <Shortcut
          to={routes.adminCourses}
          icon="book"
          tone="violet"
          label={t("admin.nav.courses")}
          body={t("admin.dashboard.coursesBody")}
        />
        <Shortcut
          to={routes.adminModeration}
          icon="eye"
          tone="warning"
          label={t("admin.nav.moderation")}
          body={t("admin.dashboard.moderationBody")}
        />
      </div>

      {dashboard.data ? (
        <>
          <SectionTitle title={t("admin.dashboard.platform")} />
          <Card>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Stat
                label={t("admin.dashboard.publishedProjects")}
                value={dashboard.data.content.projects.published}
              />
              <Stat
                label={t("admin.dashboard.publishedLessons")}
                value={dashboard.data.content.lessons.published}
              />
              <Stat
                label={t("admin.dashboard.submittedAttempts")}
                value={dashboard.data.performance.submitted_attempts}
              />
              <Stat
                label={t("admin.dashboard.avgScore")}
                value={dashboard.data.performance.avg_score ?? "—"}
              />
            </dl>
          </Card>
        </>
      ) : null}

      <SectionTitle
        title={t("admin.dashboard.recentUsers")}
        action={
          <Link to={routes.adminUsers} className="text-sm text-brand-ink hover:underline">
            {t("common.seeAll")}
          </Link>
        }
      />
      <QueryState isLoading={users.isLoading} error={users.error}>
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line/50">
            {(users.data ?? []).slice(0, 6).map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-content">{u.full_name}</p>
                  <p className="truncate text-xs text-content-subtle">{u.email}</p>
                </div>
                <PastelBadge tone={ROLE_TONE[u.role] ?? "neutral"}>
                  {t(`admin.role.${u.role}`, u.role)}
                </PastelBadge>
              </li>
            ))}
          </ul>
        </Card>
      </QueryState>
    </div>
  );
}

const ROLE_TONE: Record<string, Tone> = {
  admin: "danger",
  editor: "brand",
  teacher: "success",
  student: "violet",
};

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-content-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-extrabold text-content">{value}</dd>
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
