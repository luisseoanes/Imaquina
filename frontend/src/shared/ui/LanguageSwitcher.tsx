import { useTranslation } from "react-i18next";

import { LANGS } from "@/shared/config/roles";
import type { Lang } from "@/shared/config/roles";
import { setLanguage } from "@/shared/i18n";

const NOMBRES: Record<Lang, string> = { es: "Español", en: "English" };

/** Selector de idioma para las pantallas sin sesión.
 *
 *  Hace falta aquí y no sólo dentro de la app: antes de entrar, el servidor no
 *  sabe quién eres ni qué idioma prefiere tu cuenta, así que la pantalla de
 *  acceso es el único sitio donde elegirlo (R6).
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const actual: Lang = i18n.language?.startsWith("en") ? "en" : "es";

  return (
    <label
      className={`inline-flex items-center gap-2 rounded-pill border border-line
                  bg-surface px-3 py-2 text-[1.05rem] font-[480] text-content-muted ${className}`}
    >
      <IconoGlobo />
      <span className="sr-only">{t("nav.language")}</span>
      <select
        value={actual}
        onChange={(e) => setLanguage(e.target.value as Lang)}
        className="cursor-pointer bg-transparent pr-1 font-semibold text-content focus:outline-none"
      >
        {LANGS.map((lang) => (
          <option key={lang} value={lang}>
            {NOMBRES[lang]}
          </option>
        ))}
      </select>
    </label>
  );
}

function IconoGlobo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" />
    </svg>
  );
}
