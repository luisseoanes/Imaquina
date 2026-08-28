/** Armazón del panel del estudiante.
 *
 *  Mismo esqueleto que el Content Studio, que es la referencia visual de la
 *  plataforma: [ barra lateral · contenido flexible · panel derecho ].
 *  Escritorio: las tres zonas. Tablet: el panel derecho baja. Móvil: la barra
 *  lateral es un cajón y el panel derecho se apila.
 *
 *  **Mobile-first de verdad**: el estilo base es el del teléfono y `sm:`/`lg:`
 *  amplían. Sale del brief, no de una preferencia — el estudiante de
 *  bachillerato entra desde el celular.
 *
 *  Es una ruta de layout (`<Outlet/>`), no un envoltorio de `children`: así el
 *  router compone las pantallas sin que ninguna repita el andamiaje.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { BrandLogo } from "@/shared/ui/BrandLogo";
import { LANGS } from "@/shared/config/roles";
import type { Lang } from "@/shared/config/roles";
import { routes } from "@/shared/config/routes";
import { canAuthor, isStaff } from "@/shared/config/roles";
import { useAuth } from "@/shared/hooks/useAuth";
import { useAccountLang } from "@/shared/hooks/useAccountLang";
import { useMe } from "@/shared/hooks/useMe";
import { setLanguage } from "@/shared/i18n";
import { NotificationsBell } from "@/shared/ui/NotificationsBell";
import { Icon } from "@/shared/ui/panel-icons";
import { GROUP_ORDER, NAV, NAV_HOME } from "./nav";
import type { NavItem } from "./nav";
import { StudentAside } from "./StudentAside";
import { StudentContext, useStudent } from "./StudentContext";

/** Cambia el idioma de la interfaz **y** lo guarda en la cuenta (I7).
 *
 *  La preferencia vive en el servidor y no sólo en el navegador: en la sala de
 *  robótica no hay un equipo por estudiante, así que un idioma pegado al
 *  dispositivo no sirve de nada. Si el PATCH falla, la interfaz ya cambió —
 *  eso es lo que el estudiante pidió— y sólo se pierde la persistencia.
 */
function LangToggle() {
  const { t, i18n } = useTranslation();
  const guardarIdioma = useAccountLang();
  const actual: Lang = i18n.language?.startsWith("en") ? "en" : "es";

  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      className="flex items-center gap-0.5 rounded-pill bg-surface-muted p-0.5"
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => {
            setLanguage(l);
            guardarIdioma.mutate(l);
          }}
          aria-pressed={actual === l}
          className={`rounded-pill px-2.5 py-1 text-xs font-semibold uppercase transition duration-150 ${
            actual === l
              ? "bg-brand text-brand-content shadow-sm"
              : "text-content-muted hover:text-content"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const { t } = useTranslation();
  const etiqueta = t(`student.nav.${item.key}`);

  if (item.soon) {
    return (
      <span
        aria-disabled
        title={t("student.nav.soon")}
        className="flex cursor-not-allowed items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium text-content-subtle opacity-60"
      >
        <Icon name={item.icon} className="h-[18px] w-[18px] flex-shrink-0" />
        <span className="truncate">{etiqueta}</span>
        <span className="ml-auto rounded-pill bg-surface-muted px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide">
          {t("student.nav.soon")}
        </span>
      </span>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm transition duration-150 ${
          isActive
            ? "bg-brand-soft font-semibold text-content"
            : "font-medium text-content-muted hover:bg-surface-muted hover:text-content"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span
              aria-hidden
              className="absolute -left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-content"
            />
          ) : null}
          <Icon
            name={item.icon}
            className={`h-[18px] w-[18px] flex-shrink-0 ${
              isActive ? "text-content" : "text-content-subtle group-hover:text-content"
            }`}
          />
          <span className="truncate">{etiqueta}</span>
        </>
      )}
    </NavLink>
  );
}

/** Sin ilustración a propósito: los `robot-*.svg` llevan un PNG embebido y
 *  pesan entre 366 y 633 KB. En el Studio van en su propio chunk y los ve un
 *  editor desde un PC; aquí caerían en el bundle principal del estudiante, que
 *  entra desde el celular. No vale 633 KB un adorno al 20% de opacidad. */
function HelpCard() {
  const { t } = useTranslation();
  return (
    <div className="relative mt-5 rounded-2xl bg-surface-inverse px-4 pb-4 pt-7 text-content-inverse">
      <span className="absolute -top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-brand-content ring-4 ring-surface">
        <Icon name="sparkles" className="h-5 w-5" />
      </span>
      <p className="relative text-sm font-bold">{t("student.help.title")}</p>
      <p className="relative mt-1 max-w-[12rem] text-xs text-content-inverse/70">
        {t("student.help.body")}
      </p>
    </div>
  );
}

/** El personal docente aterriza en "/" igual que el estudiante —R4: ve el
 *  mismo contenido— así que necesita una salida a su panel. Sin esto queda
 *  encerrado en la vista de alumno salvo que escriba la URL a mano. */
function StaffLinks({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  if (!session || !isStaff(session.role)) return null;

  return (
    <div className="space-y-0.5">
      <NavLink
        to={routes.teacher}
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium text-content-muted transition duration-150 hover:bg-surface-muted hover:text-content"
      >
        <Icon name="users" className="h-[18px] w-[18px] flex-shrink-0" />
        <span className="truncate">{t("nav.teacher")}</span>
      </NavLink>
      {canAuthor(session.role) ? (
        <NavLink
          to={routes.studio}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium text-content-muted transition duration-150 hover:bg-surface-muted hover:text-content"
        >
          <Icon name="layers" className="h-[18px] w-[18px] flex-shrink-0" />
          <span className="truncate">{t("nav.studio")}</span>
        </NavLink>
      ) : null}
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      {/* velo del cajón en móvil */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-content/40 transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        aria-label={t("student.nav.dashboard")}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line/70 bg-surface transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-line/70 px-4">
          <BrandLogo className="h-11 w-auto" />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("student.header.closeMenu")}
            className="rounded-lg p-1.5 text-content-muted hover:bg-surface-muted lg:hidden"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavRow item={NAV_HOME} onNavigate={onClose} />

          {GROUP_ORDER.map((group) => {
            const items = NAV.filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mt-6">
                <p className="px-3 pb-1.5 text-[0.68rem] font-bold uppercase tracking-wider text-content-subtle">
                  {t(`student.group.${group}`)}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavRow key={item.key} item={item} onNavigate={onClose} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="space-y-2 p-3">
          <StaffLinks onNavigate={onClose} />
          <HelpCard />
        </div>
      </aside>
    </>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { data: me } = useMe();
  const { search, setSearch } = useStudent();

  const nombre = me?.full_name?.trim().split(/\s+/)[0] || t("student.header.defaultName");

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-line/70 bg-canvas/85 px-4 py-2.5 backdrop-blur sm:gap-5 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label={t("student.header.menu")}
        className="-ml-1 rounded-lg p-2 text-content-muted hover:bg-surface-muted lg:hidden"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 shrink-0 sm:block">
        <p className="truncate font-display text-[0.95rem] font-extrabold leading-tight text-content">
          {t("student.header.greeting", { name: nombre })}
        </p>
        <p className="hidden truncate text-xs text-content-muted xl:block">
          {t("student.header.greetingSub")}
        </p>
      </div>

      <div className="relative min-w-0 flex-1 lg:max-w-xl">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("student.searchPlaceholder")}
          aria-label={t("student.searchPlaceholder")}
          className="w-full rounded-pill border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-content transition duration-150 placeholder:text-content-subtle focus:border-brand-ink"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <NotificationsBell />
        <LangToggle />
        <button
          type="button"
          onClick={logout}
          aria-label={t("auth.logout")}
          title={t("auth.logout")}
          className="rounded-full p-2 text-content-muted transition duration-150 hover:bg-surface-muted hover:text-danger"
        >
          <Icon name="log-out" className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

/** El panel derecho vive donde el prototipo lo sitúa: el inicio. El resto son
 *  pantallas de lectura o de trabajo y ganan con el ancho completo. */
const RUTAS_CON_PANEL = new Set<string>([routes.student]);

export function StudentLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { i18n } = useTranslation();
  const location = useLocation();

  const lang: Lang = i18n.language?.startsWith("en") ? "en" : "es";
  const value = useMemo(() => ({ lang, search, setSearch }), [lang, search]);
  const conPanel = RUTAS_CON_PANEL.has(location.pathname);

  return (
    <StudentContext.Provider value={value}>
      <div data-student-root className="flex min-h-screen bg-canvas">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMenuOpen(true)} />

          <div className="flex flex-1 flex-col xl:flex-row">
            <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
              <Outlet />
            </main>
            {conPanel ? <StudentAside /> : null}
          </div>
        </div>
      </div>
    </StudentContext.Provider>
  );
}
