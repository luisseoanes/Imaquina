import { useTranslation } from "react-i18next";

import { setLanguage } from "@/i18n";
import { http } from "@/lib/http";
import { useLang } from "@/lib/useLang";
import type { Lang } from "@/lib/useLang";

const IDIOMAS: Lang[] = ["es", "en"];

/** Selector de idioma de la interfaz (I1, R6).
 *
 *  `setLanguage` existía desde el primer día y no lo llamaba nadie: no había
 *  forma de cambiar de idioma en toda la app.
 */
export default function LanguageSwitcher() {
  const { t } = useTranslation();
  const actual = useLang();

  const cambiar = (lang: Lang) => {
    setLanguage(lang);
    // Persistir en la cuenta es best-effort (I7), igual que la revocación del
    // logout: si falla, el idioma ya cambió en pantalla y no tiene sentido
    // bloquear al usuario por no haber podido guardar la preferencia.
    void http({ url: "/auth/me", method: "PATCH", data: { lang } }).catch(() => {});
  };

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("nav.language")}>
      {IDIOMAS.map((lang) => (
        <button
          key={lang}
          onClick={() => cambiar(lang)}
          aria-current={lang === actual ? "true" : undefined}
          className={
            lang === actual
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
