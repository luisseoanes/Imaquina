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
}

export default i18n;
