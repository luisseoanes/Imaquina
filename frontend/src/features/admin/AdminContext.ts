import { createContext, useContext } from "react";

/** Estado compartido del panel de administración: sólo la búsqueda de la barra
 *  superior. No hay idioma de trabajo — administración no edita contenido. */
export interface AdminValue {
  search: string;
  setSearch: (q: string) => void;
}

export const AdminContext = createContext<AdminValue | null>(null);

export function useAdmin(): AdminValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin debe usarse dentro de <AdminPage>");
  return ctx;
}
