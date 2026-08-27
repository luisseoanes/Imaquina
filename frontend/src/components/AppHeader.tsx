import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/useAuth";
import LanguageSwitcher from "./LanguageSwitcher";

/** Cabecera mínima compartida por toda la app autenticada (N13): antes no
 *  había ningún sitio desde el que cerrar sesión — `useAuth().logout()`
 *  existía y nada lo llamaba. */
export default function AppHeader() {
  const { t } = useTranslation();
  const { session, logout } = useAuth();
  if (!session) return null;

  return (
    <header className="flex items-center gap-4 border-b px-4 py-2 text-sm">
      <Link to="/" className="font-semibold">
        {t("app.name")}
      </Link>
      <nav className="flex items-center gap-3">
        {session.role === "admin" && <Link to="/admin">{t("nav.admin")}</Link>}
        {(session.role === "teacher" || session.role === "admin") && (
          <Link to="/teacher">{t("nav.teacher")}</Link>
        )}
      </nav>
      <span className="ml-auto text-content-subtle">{t(`roles.${session.role}`)}</span>
      <LanguageSwitcher />
      <Link to="/cuenta" className="text-content-subtle hover:underline">
        {t("nav.account")}
      </Link>
      <button onClick={logout} className="text-content-subtle hover:underline">
        {t("auth.logout")}
      </button>
    </header>
  );
}
