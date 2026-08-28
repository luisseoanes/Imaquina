import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/** Pone el título de la pestaña a partir de una clave de traducción.
 *
 *  Depende de `i18n.language` a propósito: al cambiar de idioma el título tiene
 *  que cambiar con el resto de la interfaz. Sin esa dependencia el efecto no
 *  se volvería a ejecutar y la pestaña se quedaría en el idioma anterior.
 *
 *  El nombre de la marca va delante, que es lo que hace reconocible la pestaña
 *  cuando hay muchas abiertas.
 *
 *  **Convención de los títulos de sección**: iniciales en mayúscula salvo los
 *  conectores — "Inicio de Sesión", "Sign In", "Página No Encontrada".
 */
export function useDocumentTitle(claveDeSeccion: string) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = `${t("app.name")} | ${t(claveDeSeccion)}`;
  }, [t, i18n.language, claveDeSeccion]);
}
