/** Armazón del panel del docente. Mismo lenguaje visual que el Content
 *  Studio: barra lateral clara con grupos, cabecera lineal con saludo +
 *  buscador, acento ámbar en el elemento activo, tarjeta de ayuda abajo.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";

import robotHelp from "@/assets/illustrations/robot-2.svg";
import { BrandLogo } from "@/shared/ui/BrandLogo";
import { LANGS, canAuthor } from "@/shared/config/roles";
import { routes } from "@/shared/config/routes";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMe } from "@/shared/hooks/useMe";
import { Icon } from "@/shared/ui/panel-icons";
import { GROUP_ORDER, NAV, NAV_HOME } from "./nav";
import type { NavItem } from "./nav";
import { useTeacher } from "./TeacherContext";

function LangToggle() {
  const { lang, setLang } = useTeacher();
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("teacher.header.readingLang")}
      className="flex items-center gap-0.5 rounded-pill bg-surface-muted p-0.5"
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-pill px-2.5 py-1 text-xs font-semibold uppercase transition duration-150 ${
            lang === l
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
          <span className="truncate">{t(`teacher.nav.${item.key}`)}</span>
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-content/40 transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        aria-label={t("nav.teacher")}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line/70 bg-surface transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-line/70 px-4">
          <BrandLogo className="h-11 w-auto" />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("teacher.header.closeMenu")}
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
                  {t(`teacher.group.${group}`)}
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

        <div className="p-3">
          <HelpCard />
        </div>
      </aside>
    </>
  );
}

function HelpCard() {
  const { t } = useTranslation();
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface-inverse px-4 pb-4 pt-7 text-content-inverse">
      <img
        src={robotHelp}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-3 -right-4 w-24 opacity-20 select-none"
      />
      <span className="absolute -top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-brand-content ring-4 ring-surface">
        <Icon name="help" className="h-5 w-5" />
      </span>
      <p className="relative text-sm font-bold">{t("teacher.help.title")}</p>
      <p className="relative mt-1 max-w-[12rem] text-xs text-content-inverse/70">
        {t("teacher.help.body")}
      </p>
      <a
        href="#ayuda"
        className="relative mt-3 inline-flex items-center gap-1 rounded-control bg-brand px-3 py-1.5 text-xs font-semibold text-brand-content transition duration-150 hover:bg-brand-strong"
      >
        {t("teacher.help.cta")}
        <Icon name="arrow-right" className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { t } = useTranslation();
  const { logout, session } = useAuth();
  const { search, setSearch } = useTeacher();
  const { data: me } = useMe();
  const navigate = useNavigate();

  const nombre =
    me?.full_name?.trim().split(/\s+/)[0] || t("teacher.header.defaultName");

  // Un editor/admin salta al Studio; un docente sin más herramienta, cierra
  // sesión (la raíz `/` muestra el 404).
  const salir = () =>
    session && canAuthor(session.role) ? navigate(routes.studio) : logout();

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-line/70 bg-canvas/85 px-4 py-2.5 backdrop-blur sm:gap-5 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label={t("teacher.header.menu")}
        className="-ml-1 rounded-lg p-2 text-content-muted hover:bg-surface-muted lg:hidden"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 shrink-0 sm:block">
        <p className="truncate font-display text-[0.95rem] font-extrabold leading-tight text-content">
          {t("teacher.header.greeting", { name: nombre })}
        </p>
        <p className="hidden truncate text-xs text-content-muted xl:block">
          {t("teacher.header.greetingSub")}
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
          placeholder={t("teacher.header.search")}
          aria-label={t("teacher.header.search")}
          className="w-full rounded-pill border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-content transition duration-150 placeholder:text-content-subtle focus:border-brand-ink"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          aria-label={t("teacher.header.notifications")}
          className="relative rounded-full p-2 text-content-muted transition duration-150 hover:bg-surface-muted hover:text-content"
        >
          <Icon name="bell" className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand" />
        </button>

        <LangToggle />

        <div className="hidden items-center gap-3 border-l border-line pl-3 text-xs text-content-subtle sm:flex">
          <button
            type="button"
            onClick={salir}
            className="whitespace-nowrap transition duration-150 hover:text-content"
          >
            {t("teacher.header.exit")}
          </button>
          <button
            type="button"
            onClick={logout}
            className="whitespace-nowrap transition duration-150 hover:text-danger"
          >
            {t("auth.logout")}
          </button>
        </div>
      </div>
    </header>
  );
}

export function TeacherLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
