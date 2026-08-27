import { LogOut, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/useAuth";
import { setLanguage } from "@/i18n";

const LANGS = ["es", "en"] as const;

function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const current = i18n.language;

  return (
    <div className="flex items-center gap-1" aria-label={t("nav.language")}>
      {LANGS.map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          aria-pressed={current === lang}
          className={
            current === lang
              ? "rounded bg-brand px-2 py-1 text-xs font-medium text-brand-content"
              : "rounded px-2 py-1 text-xs text-content-subtle hover:underline"
          }
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Cabecera mínima compartida por toda la app autenticada (N13): antes no
 *  había ningún sitio desde el que cerrar sesión — `useAuth().logout()`
 *  existía y nada lo llamaba.
 *
 *  Mobile-first: `flex-wrap` en vez de una sola fila rígida -- en un móvil
 *  angosto, nombre + nav de staff + rol + idioma + logout no caben en una
 *  fila y antes se desbordaban en vez de envolver (I3). */
export default function AppHeader() {
  const { t } = useTranslation();
  const { session, logout } = useAuth();
  if (!session) return null;

  return (
    <header
      className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2
                 border-b border-line bg-surface/80 px-4 py-3 text-sm backdrop-blur"
    >
      <Link to="/" className="font-display font-semibold">
        {t("app.name")}
      </Link>
      <nav className="flex items-center gap-1">
        {session.role === "admin" && (
          <Link
            to="/admin"
            className="rounded-full px-3 py-1.5 text-content-muted hover:bg-surface-muted hover:text-content"
          >
            {t("nav.admin")}
          </Link>
        )}
        {(session.role === "teacher" || session.role === "admin") && (
          <Link
            to="/teacher"
            className="rounded-full px-3 py-1.5 text-content-muted hover:bg-surface-muted hover:text-content"
          >
            {t("nav.teacher")}
          </Link>
        )}
      </nav>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <LanguageToggle />
        <Link
          to="/cuenta"
          aria-label={t("nav.account")}
          title={t("nav.account")}
          className="flex items-center gap-2 text-content-subtle hover:text-content"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-brand/15 text-brand-ink">
            <User size={14} aria-hidden />
          </span>
          <span className="hidden sm:inline">{t(`roles.${session.role}`)}</span>
        </Link>
        <button
          onClick={logout}
          aria-label={t("auth.logout")}
          title={t("auth.logout")}
          className="flex size-8 items-center justify-center rounded-full text-content-subtle hover:bg-surface-muted hover:text-content"
        >
          <LogOut size={16} aria-hidden />
        </button>
      </div>
    </header>
  );
}
