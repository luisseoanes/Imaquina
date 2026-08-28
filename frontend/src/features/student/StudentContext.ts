import { createContext, useContext } from "react";

import type { Lang } from "@/shared/config/roles";

/** Estado compartido del panel del estudiante.
 *
 *  `lang` es el idioma con el que se PIDE el contenido publicado. No siempre es
 *  el que se recibe: un proyecto puede estar sólo en español, y el backend
 *  devuelve el idioma realmente servido en `lang` para que la pantalla pueda
 *  avisar (`contenido_en`, publishing/service.py).
 *
 *  Arranca en el idioma de la interfaz y lo sigue: para un estudiante no tiene
 *  sentido separarlos como sí lo tiene para un editor bilingüe.
 *
 *  `search` es el texto de la barra superior; cada vista decide cómo filtra.
 */
export interface StudentValue {
  lang: Lang;
  search: string;
  setSearch: (q: string) => void;
}

export const StudentContext = createContext<StudentValue | null>(null);

export function useStudent(): StudentValue {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudent debe usarse dentro de <StudentLayout>");
  return ctx;
}
