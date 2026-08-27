import { useTranslation } from "react-i18next";

export type Lang = "es" | "en";

/** Idioma de la INTERFAZ, normalizado a los dos del MVP (R6).
 *
 *  i18next puede devolver un código regional ("es-CO", "en-US") según lo que
 *  dicte el navegador, y ese valor viaja como `?lang=` a los endpoints del
 *  estudiante: el backend espera "es" o "en" y con "es-CO" caería al primer
 *  idioma disponible del snapshot sin decir nada.
 *
 *  Ojo: el Studio tiene su propio idioma de EDICIÓN (S11), independiente de
 *  este. No los mezcles.
 */
export function useLang(): Lang {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith("en") ? "en" : "es";
}
