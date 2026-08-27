import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import es from "./es.json";

// ES/EN desde el dia 1 (R6). La infraestructura va completa aunque los
// textos en ingles los escriba el cliente mas adelante.
i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: localStorage.getItem("lang") ?? "es",
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: "es" | "en") {
  localStorage.setItem("lang", lang);
  void i18n.changeLanguage(lang);
  aplicarLangAlDocumento(lang);
}

/** `<html lang>` tiene que seguir al idioma elegido (WCAG 3.1.1, nivel A).
 *
 *  `index.html` lo trae fijo en "es": mientras no había selector (I1) daba
 *  igual, pero ahora un usuario en inglés tendría el documento declarado como
 *  español y el lector de pantalla leería inglés con voz española. */
function aplicarLangAlDocumento(lang: string) {
  document.documentElement.lang = lang;
}

// El idioma inicial sale de localStorage, no de `index.html`.
aplicarLangAlDocumento(i18n.language);

export default i18n;
