import { createContext, useContext } from "react";

import type { Lang } from "@/shared/config/roles";

/** Estado compartido del panel del docente.
 *
 *  `lang` es el idioma con el que se lee el contenido publicado (los proyectos
 *  pueden estar sólo en español); `search` es la barra superior.
 */
export interface TeacherValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  search: string;
  setSearch: (q: string) => void;
}

export const TeacherContext = createContext<TeacherValue | null>(null);

export function useTeacher(): TeacherValue {
  const ctx = useContext(TeacherContext);
  if (!ctx) throw new Error("useTeacher debe usarse dentro de <TeacherPage>");
  return ctx;
}
