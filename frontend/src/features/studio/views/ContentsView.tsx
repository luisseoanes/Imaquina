import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import { useDashboard, useLessons, useProjects, useResources } from "../api";
import {
  Card,
  Kpi,
  PageHeader,
  PastelBadge,
  QueryState,
  SectionTitle,
  Select,
  Sparkline,
  StatusBadge,
  Thumb,
  TONE_SOFT,
} from "@/shared/ui/panel";
import type { Tone } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import type { IconName } from "@/shared/ui/panel-icons";
import { useStudio } from "../StudioContext";

type Kind = "all" | "project" | "lesson" | "resource";

interface Row {
  id: string;
  kind: "project" | "lesson" | "resource";
  title: string;
  area: string;
  status: string;
  updated_at: string;
}

const KIND_LABEL: Record<Row["kind"], string> = {
  project: "projects",
  lesson: "lessons",
  resource: "resources",
};
const KIND_TONE: Record<Row["kind"], Tone> = {
  project: "info",
  lesson: "violet",
  resource: "warning",
};

const DAY = 86_400_000;

export function ContentsView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang, search } = useStudio();
  const projects = useProjects(lang);
  const lessons = useLessons(lang);
  const resources = useResources(lang);
  const dashboard = useDashboard();
  const [kind, setKind] = useState<Kind>("all");
  // Una sola lectura del reloj por montaje: `Date.now()` en render es impuro.
  const [ahora] = useState(() => Date.now());

  const all = useMemo<Row[]>(
    () => [
      ...(projects.data ?? []).map((p) => ({
        id: p.id,
        kind: "project" as const,
        title: p.title ?? p.slug,
        area: p.grade,
        status: p.status,
        updated_at: p.updated_at,
      })),
      ...(lessons.data ?? []).map((l) => ({
        id: l.id,
        kind: "lesson" as const,
        title: l.title ?? l.slug,
        area: l.area,
        status: l.status,
        updated_at: l.updated_at,
      })),
      ...(resources.data ?? []).map((r) => ({
        id: r.id,
        kind: "resource" as const,
        title: r.title ?? r.slug,
        area: r.area,
        status: r.status,
        updated_at: r.updated_at,
      })),
    ],
    [projects.data, lessons.data, resources.data],
  );

  const rows = useMemo(
    () =>
      all
        .filter((r) => (kind === "all" ? true : r.kind === kind))
        .filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [all, kind, search],
  );

  /** "Este mes": elementos tocados en los últimos 30 días. Dato real. */
  const nuevos = useMemo(() => {
    const desde = ahora - 30 * DAY;
    const rec = all.filter((r) => new Date(r.updated_at).getTime() >= desde);
    return {
      total: rec.length,
      project: rec.filter((r) => r.kind === "project").length,
      lesson: rec.filter((r) => r.kind === "lesson").length,
    };
  }, [all, ahora]);

  const d = dashboard.data;
  const goto = (r: Row) => {
    if (r.kind === "project") navigate(routes.studioProject(r.id));
    else if (r.kind === "lesson") navigate(routes.studioLessons);
    else navigate(routes.studioResources);
  };

  const isLoading =
    projects.isLoading || lessons.isLoading || resources.isLoading;
  const error = projects.error ?? lessons.error ?? resources.error;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("studio.nav.contents")}
        description={t("studio.contents.subtitle")}
        actions={
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="rounded-pill"
          >
            <option value="all">{t("studio.contents.all")}</option>
            <option value="project">{t("studio.nav.projects")}</option>
            <option value="lesson">{t("studio.nav.lessons")}</option>
            <option value="resource">{t("studio.nav.resources")}</option>
          </Select>
        }
      />

      {/* --- Tarjetas KPI --- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label={t("studio.kpi.totalContent")}
          value={String(all.length)}
          delta={nuevos.total ? t("studio.contents.thisMonth", { count: nuevos.total }) : undefined}
          icon="layers"
          tone="violet"
        />
        <Kpi
          label={t("studio.kpi.publishedLessons")}
          value={String(d?.content.lessons.published ?? 0)}
          delta={nuevos.lesson ? t("studio.contents.thisMonth", { count: nuevos.lesson }) : undefined}
          icon="book"
          tone="success"
        />
        <Kpi
          label={t("studio.kpi.activeProjects")}
          value={String(d?.content.projects.published ?? 0)}
          delta={nuevos.project ? t("studio.contents.thisMonth", { count: nuevos.project }) : undefined}
          icon="cpu"
          tone="info"
        />
        <Kpi
          label={t("studio.kpi.studentsReached")}
          value={String(d?.students_impacted ?? 0)}
          icon="users"
          tone="brand"
        />
      </div>

      {/* --- Contenido reciente --- */}
      <SectionTitle title={t("studio.contents.recent")} />
      <QueryState isLoading={isLoading} error={error}>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line/60 text-xs uppercase tracking-wide text-content-subtle">
                  <th className="px-5 py-3.5 font-semibold">{t("studio.col.title")}</th>
                  <th className="px-5 py-3.5 font-semibold">{t("studio.col.type")}</th>
                  <th className="px-5 py-3.5 font-semibold">{t("studio.col.area")}</th>
                  <th className="px-5 py-3.5 font-semibold">{t("studio.col.status")}</th>
                  <th className="px-5 py-3.5 font-semibold">{t("studio.col.updated")}</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {rows.map((r) => (
                  <tr
                    key={`${r.kind}-${r.id}`}
                    onClick={() => goto(r)}
                    className="cursor-pointer transition duration-150 hover:bg-surface-muted/60"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Thumb kind={r.kind} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-content">
                            {r.title}
                          </p>
                          <p className="truncate text-xs text-content-subtle">
                            {t(`studio.nav.${KIND_LABEL[r.kind]}`)} · {r.area}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <PastelBadge tone={KIND_TONE[r.kind]}>
                        {t(`studio.nav.${KIND_LABEL[r.kind]}`)}
                      </PastelBadge>
                    </td>
                    <td className="px-5 py-4">
                      <PastelBadge>{r.area}</PastelBadge>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-4 text-content-subtle">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goto(r);
                          }}
                          aria-label={t("studio.action.edit")}
                          className="rounded-lg p-1.5 text-content-muted transition duration-150 hover:bg-brand-soft hover:text-brand-ink"
                        >
                          <Icon name="pencil" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Más acciones"
                          className="rounded-lg p-1.5 text-content-muted transition duration-150 hover:bg-surface-muted hover:text-content"
                        >
                          <Icon name="dots" className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-content-muted">
              {t("studio.contents.subtitle")}
            </p>
          ) : null}
        </Card>
      </QueryState>

      {/* --- Accesos rápidos --- */}
      <SectionTitle title={t("studio.quick.title")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickCard
          to={routes.studioLessons}
          icon="book"
          tone="violet"
          title={t("studio.quick.lessonTitle")}
          body={t("studio.quick.lessonBody")}
        />
        <QuickCard
          to={routes.studioProjects}
          icon="cpu"
          tone="info"
          title={t("studio.quick.projectTitle")}
          body={t("studio.quick.projectBody")}
        />
        <QuickCard
          to={routes.studioMedia}
          icon="image"
          tone="warning"
          title={t("studio.quick.resourceTitle")}
          body={t("studio.quick.resourceBody")}
        />
        <QuickCard
          to={routes.studioAssessments}
          icon="check-square"
          tone="success"
          title={t("studio.quick.assessmentTitle")}
          body={t("studio.quick.assessmentBody")}
        />
      </div>

      {/* --- Rendimiento de contenido --- */}
      <SectionTitle title={t("studio.perf.title")} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <PerfCard
          label={t("studio.perf.published")}
          value={String(
            (d?.content.projects.published ?? 0) + (d?.content.lessons.published ?? 0),
          )}
          tone="success"
          seed="published"
        />
        <PerfCard
          label={t("studio.perf.completedMoments")}
          value={String(d?.performance.completed_moments ?? 0)}
          tone="info"
          seed="completed"
        />
        <PerfCard
          label={t("studio.perf.submittedAttempts")}
          value={String(d?.performance.submitted_attempts ?? 0)}
          tone="violet"
          seed="submitted"
        />
        <PerfCard
          label={t("studio.perf.avgScore")}
          value={d?.performance.avg_score != null ? String(d.performance.avg_score) : "—"}
          tone="brand"
          seed="score"
        />
      </div>
    </div>
  );
}

function QuickCard({
  to,
  icon,
  tone,
  title,
  body,
}: {
  to: string;
  icon: IconName;
  tone: Tone;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-2xl border border-line/60 bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float"
    >
      <span
        className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${TONE_SOFT[tone]}`}
      >
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="font-display font-bold text-content">{title}</p>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-content-muted">{body}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">
        <Icon
          name="arrow-right"
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}

function PerfCard({
  label,
  value,
  tone,
  seed,
}: {
  label: string;
  value: string;
  tone: Tone;
  seed: string;
}) {
  return (
    <Card>
      <p className="text-sm text-content-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-content">{value}</p>
      <div className="mt-2">
        <Sparkline seed={seed} tone={tone} className="h-9 w-full" />
      </div>
    </Card>
  );
}
