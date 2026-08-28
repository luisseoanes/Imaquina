import { createContext, useContext } from "react";

import type { Lang } from "@/shared/config/roles";

/** Estado compartido del panel del editor.
 *
 *  `lang` es el idioma de TRABAJO: con cuál de las traducciones se está
 *  editando ahora. Distinto del idioma de la interfaz (i18next) — un editor
 *  puede tener la UI en español y estar rellenando la versión inglesa.
 *
 *  `search` es el texto de la barra superior; cada vista decide cómo filtra
 *  con él.
 */
export interface StudioValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  search: string;
  setSearch: (q: string) => void;
}

export const StudioContext = createContext<StudioValue | null>(null);

export function useStudio(): StudioValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio debe usarse dentro de <StudioPage>");
  return ctx;
}
