import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/useAuth";
import LanguageSwitcher from "./LanguageSwitcher";

/** Cabecera mínima compartida por toda la app autenticada (N13): antes no
 *  había ningún sitio desde el que cerrar sesión — `useAuth().logout()`
 *  existía y nada lo llamaba.
 *
 *  Mobile-first de verdad (I3): con seis elementos en una sola fila `flex`
 *  sin `wrap`, en 390px la barra medía 574px y arrastraba a TODA la página a
 *  scroll horizontal — el desborde no era del contenido de admin/docente,
 *  era de la cabecera que ambas comparten. Medido con Chrome a 390/768/1280.
 */
export default function AppHeader() {
  const { t } = useTranslation();
  const { session, logout } = useAuth();
  if (!session) return null;

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-sm sm:gap-x-4 sm:px-4">
      <Link to="/" className="font-semibold">
        {t("app.name")}
      </Link>
      <nav className="flex items-center gap-3">
        {session.role === "admin" && <Link to="/admin">{t("nav.admin")}</Link>}
        {(session.role === "teacher" || session.role === "admin") && (
          <Link to="/teacher">{t("nav.teacher")}</Link>
        )}
      </nav>
      {/* El rol es informativo y no accionable: en móvil el espacio se lo
          quedan los enlaces. `ml-auto` sólo a partir de sm, o en una fila
          envuelta empuja el resto contra el borde. */}
      <span className="hidden text-content-subtle sm:ml-auto sm:inline">
        {t(`roles.${session.role}`)}
      </span>
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
