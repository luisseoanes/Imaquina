import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";
import { LANGS } from "@/shared/config/roles";
import type { Lang } from "@/shared/config/roles";

/** i18n desde el primer día (R6): la plataforma es bilingüe por requisito del
 *  cliente, no por decisión técnica. Un literal escrito en un componente es un
 *  texto que no se puede traducir después sin buscarlo a mano.
 */
const LANG_KEY = "lang";

export function idiomaGuardado(): Lang {
  const guardado = localStorage.getItem(LANG_KEY);
  return LANGS.includes(guardado as Lang) ? (guardado as Lang) : "es";
}

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: idiomaGuardado(),
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: Lang) {
  localStorage.setItem(LANG_KEY, lang);
  void i18n.changeLanguage(lang);
  // `<html lang>` tiene que seguir al idioma (WCAG 3.1.1) o el lector de
  // pantalla pronuncia el texto con la voz del idioma equivocado.
  document.documentElement.lang = lang;
}

document.documentElement.lang = idiomaGuardado();

export default i18n;
