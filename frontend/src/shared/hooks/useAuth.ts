import { useContext } from "react";

import { AuthContext } from "@/app/providers/authContext";
import type { AuthValue } from "@/app/providers/authContext";

/** El hook vive fuera del fichero del provider para que el fast refresh de
 *  Vite funcione en ambos: un módulo que exporta componentes y funciones a la
 *  vez pierde el refresco en caliente. */
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
