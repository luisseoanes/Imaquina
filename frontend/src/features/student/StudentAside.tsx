/** Panel derecho del estudiante: perfil, calendario, agenda y recordatorios.
 *
 *  Todo lo que muestra sale de datos reales (cuenta, proyectos publicados y
 *  progreso). El calendario es orientación visual del mes en curso: la
 *  plataforma no tiene entidad de eventos con fecha, así que no se inventan
 *  citas — se marca hoy y ya.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { routes } from "@/shared/config/routes";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMe } from "@/shared/hooks/useMe";
import { Icon } from "@/shared/ui/panel-icons";
import { PastelBadge } from "@/shared/ui/panel";
import { useProjectsWithProgress } from "./hooks";
import { useStudent } from "./StudentContext";

export function StudentAside() {
  return (
    <aside className="w-full shrink-0 space-y-5 border-t border-line/70 bg-canvas p-4 sm:p-6 xl:w-80 xl:border-l xl:border-t-0 xl:p-6">
      <ProfileCard />
      <MiniCalendar />
      <AgendaCard />
      <RemindersCard />
    </aside>
  );
}

function ProfileCard() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { data: me } = useMe();

  const iniciales = (me?.full_name ?? "")
    .split(/\s+/)
    .filter(Boolean)
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
          {iniciales || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold text-content">
            {me?.full_name ?? "—"}
          </p>
          <p className="truncate text-xs text-content-muted">
            {me?.email ?? session?.role}
          </p>
          {me?.grade ? (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-brand-soft px-2 py-0.5 text-[0.7rem] font-semibold text-brand-ink">
              <Icon name="star" className="h-3 w-3" />
              {t("student.aside.grade", { grade: me.grade })}
            </span>
          ) : null}
        </div>
        <Link
          to={routes.account}
          aria-label={t("student.aside.editProfile")}
          className="rounded-lg p-1.5 text-content-muted transition duration-150 hover:bg-surface-muted hover:text-content"
        >
          <Icon name="pencil" className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

/** Lunes primero, que es la semana escolar en Colombia. */
const WEEKDAYS = ["LU", "MA", "MI", "JU", "VI", "SA", "DO"];

function MiniCalendar() {
  const { i18n } = useTranslation();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Sin memo: son 42 celdas y el array se construye mutando, que es justo lo
  // que el compilador de React no puede memoizar (ver el mismo aviso en
  // `StudioAside`). Calcularlo en cada render no cuesta nada.
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const dias = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= dias; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

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
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {cells.map((d, i) => (
          <span
            key={i}
            className={`flex h-7 items-center justify-center rounded-lg ${
              d === null
                ? ""
                : d === today.getDate()
                  ? "bg-brand font-bold text-brand-content"
                  : "text-content-muted"
            }`}
          >
            {d ?? ""}
          </span>
        ))}
      </div>
    </section>
  );
}

/** "Sigue por aquí": los proyectos empezados y sin terminar, con el momento
 *  exacto al que vuelve. Es la agenda real que la plataforma puede ofrecer. */
function AgendaCard() {
  const { t } = useTranslation();
  const { lang } = useStudent();
  const { data: me } = useMe();
  const { data } = useProjectsWithProgress(lang, me?.grade);

  const enCurso = data.filter((p) => p.state === "in_progress").slice(0, 3);

  return (
    <section className="rounded-2xl border border-line/60 bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-content">
          {t("student.aside.agenda")}
        </p>
        <Link to={routes.studentCourses} className="text-xs text-brand-ink hover:underline">
          {t("common.seeAll")}
        </Link>
      </div>
      {enCurso.length === 0 ? (
        <p className="text-xs text-content-muted">{t("student.aside.agendaEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {enCurso.map((p) => (
            <li key={p.id}>
              <Link
                to={p.next ? routes.studentMoment(p.id, p.next) : routes.studentCourse(p.id)}
                className="flex items-start gap-3 rounded-xl p-1 transition duration-150 hover:bg-surface-muted"
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-info-surface font-display text-xs font-extrabold text-info"
                >
                  {p.percent}%
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">{p.title}</p>
                  <p className="truncate text-xs text-content-subtle">
                    {p.next ? t(`student.moment.${p.next}`) : t("student.status.completed")}
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

/** El recordatorio que la plataforma sí conoce: cuántos proyectos tienen la
 *  evaluación (momento 6) todavía sin completar. */
function RemindersCard() {
  const { t } = useTranslation();
  const { lang } = useStudent();
  const { data: me } = useMe();
  const { data } = useProjectsWithProgress(lang, me?.grade);

  const pendientes = data.filter(
    (p) => p.state !== "not_started" && p.progress.assess !== "completed",
  ).length;

  return (
    <Link
      to={routes.studentAssignments}
      className="block rounded-2xl border border-line/60 bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float"
    >
      <p className="mb-2 font-display text-sm font-bold text-content">
        {t("student.aside.reminders")}
      </p>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-warning-surface text-warning">
          <Icon name="check-square" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-content">
            {t("student.aside.reminderTitle")}
          </p>
          <p className="mt-0.5 text-xs text-content-muted">
            {t("student.aside.reminderBody", { count: pendientes })}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <PastelBadge tone={pendientes > 0 ? "warning" : "success"}>
          {pendientes}
        </PastelBadge>
      </div>
    </Link>
  );
}
