import { createContext } from "react";

import type { Lang, Role } from "@/shared/config/roles";

export interface Session {
  role: Role;
  lang: Lang;
}

export interface AuthValue {
  session: Session | null;
  /** Resuelve con la sesión recién creada, para poder redirigir por rol sin
   *  esperar a que el estado del contexto se propague. */
  login: (email: string, password: string) => Promise<Session>;
  logout: () => void;
}

/** El contexto vive fuera del fichero del provider: un módulo que exporta
 *  componentes y valores a la vez pierde el fast refresh de Vite. */
export const AuthContext = createContext<AuthValue | null>(null);
