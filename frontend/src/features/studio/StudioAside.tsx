/** Panel derecho del Studio: perfil, calendario, pendientes y recordatorios.
 *
 *  Datos reales cuando los hay (perfil, borradores, evaluaciones enviadas). El
 *  calendario es sólo orientación visual del mes en curso. No cambia ninguna
 *  ruta ni estado de la aplicación.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMe } from "@/shared/hooks/useMe";
import { useDashboard, useLessons, useProjects } from "./api";
import { Icon } from "@/shared/ui/panel-icons";
import { PastelBadge, Thumb } from "@/shared/ui/panel";
import { useStudio } from "./StudioContext";

export function StudioAside() {
  return (
    <aside className="w-full shrink-0 space-y-5 border-t border-line/70 bg-canvas p-4 sm:p-6 xl:w-80 xl:border-l xl:border-t-0 xl:p-6">
      <ProfileCard />
      <MiniCalendar />
      <UpcomingCard />
      <RemindersCard />
    </aside>
  );
}

function ProfileCard() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { data: me } = useMe();
  const navigate = useNavigate();

  const iniciales = (me?.full_name ?? "Creador")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <section className="rounded-2xl border border-line/60 bg-surface p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-lg font-extrabold text-brand-ink"
        >
          {iniciales}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold text-content">
            {me?.full_name ?? "—"}
          </p>
          <p className="truncate text-xs text-content-muted">
            {me?.email ?? session?.role}
          </p>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-brand-soft px-2 py-0.5 text-[0.7rem] font-semibold text-brand-ink">
            <Icon name="star" className="h-3 w-3" />
            {t("studio.aside.creator")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate(routes.studioSettings)}
          aria-label={t("studio.aside.editProfile")}
          className="rounded-lg p-1.5 text-content-muted transition duration-150 hover:bg-surface-muted hover:text-content"
        >
          <Icon name="pencil" className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

const WEEKDAYS_ES = ["LU", "MA", "MI", "JU", "VI", "SA", "DO"];

function MiniCalendar() {
  const today = new Date();
  const { i18n } = useTranslation();
  const year = today.getFullYear();
  const month = today.getMonth();

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    // Lunes = 0
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const out: (number | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  const monthName = today.toLocaleDateString(i18n.language, { month: "long" });

  return (
    <section className="rounded-2xl border border-line/60 bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="calendar" className="h-4 w-4 text-content-subtle" />
        <p className="font-display text-sm font-bold capitalize text-content">
          {monthName} {year}
        </p>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold text-content-subtle">
        {WEEKDAYS_ES.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {cells.map((d, i) => {
          const isToday = d === today.getDate();
          return (
            <span
              key={i}
              className={`flex h-7 items-center justify-center rounded-lg ${
                d === null
                  ? ""
                  : isToday
                    ? "bg-brand font-bold text-brand-content"
                    : "text-content-muted hover:bg-surface-muted"
              }`}
            >
              {d ?? ""}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function UpcomingCard() {
  const { t, i18n } = useTranslation();
  const { lang } = useStudio();
  const projects = useProjects(lang);
  const lessons = useLessons(lang);

  const drafts = useMemo(() => {
    const list = [
      ...(projects.data ?? [])
        .filter((p) => p.status === "draft")
        .map((p) => ({
          id: p.id,
          to: routes.studioProject(p.id),
          title: p.title ?? p.slug,
          area: p.grade,
          kind: "project" as const,
          updated_at: p.updated_at,
        })),
      ...(lessons.data ?? [])
        .filter((l) => l.status === "draft")
        .map((l) => ({
          id: l.id,
          to: routes.studioLessons,
          title: l.title ?? l.slug,
          area: l.area,
          kind: "lesson" as const,
          updated_at: l.updated_at,
        })),
    ];
    return list
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 3);
  }, [projects.data, lessons.data]);

  return (
    <section className="rounded-2xl border border-line/60 bg-surface p-5 shadow-card">
      <p className="mb-3 font-display text-sm font-bold text-content">
        {t("studio.aside.upcoming")}
      </p>
      {drafts.length === 0 ? (
        <p className="text-xs text-content-muted">{t("studio.aside.upcomingEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => (
            <li key={`${d.kind}-${d.id}`}>
              <Link
                to={d.to}
                className="flex items-start gap-3 rounded-xl p-1 transition duration-150 hover:bg-surface-muted"
              >
                <div className="flex flex-col items-center">
                  <span className="text-[0.68rem] font-bold uppercase text-brand-ink">
                    {new Date(d.updated_at).toLocaleDateString(i18n.language, {
                      day: "2-digit",
                    })}
                  </span>
                  <span className="text-[0.6rem] uppercase text-content-subtle">
                    {new Date(d.updated_at).toLocaleDateString(i18n.language, {
                      month: "short",
                    })}
                  </span>
                </div>
                <Thumb kind={d.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">
                    {d.title}
                  </p>
                  <p className="truncate text-xs text-content-subtle">
                    {t(`studio.nav.${d.kind === "project" ? "projects" : "lessons"}`)}
                    {" · "}
                    {d.area}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RemindersCard() {
  const { t } = useTranslation();
  const { data } = useDashboard();
  const n = data?.performance.submitted_attempts ?? 0;

  return (
    <Link
      to={routes.studioAnalytics}
      className="block rounded-2xl border border-line/60 bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float"
    >
      <p className="mb-2 font-display text-sm font-bold text-content">
        {t("studio.aside.reminders")}
      </p>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-info-surface text-info">
          <Icon name="check-square" className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-content">
            {t("studio.aside.reviewTitle")}
          </p>
          <p className="mt-0.5 text-xs text-content-muted">
            {t("studio.aside.reviewBody", { count: n })}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <PastelBadge tone="info">{n}</PastelBadge>
      </div>
    </Link>
  );
}
