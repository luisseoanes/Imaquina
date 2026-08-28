import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { AuthContext } from "./authContext";
import type { AuthValue, Session } from "./authContext";

import { login as loginRequest, logout as logoutRequest } from "@/shared/api/generated/auth/auth";
import { tokens } from "@/shared/api/tokens";
import type { Lang, Role } from "@/shared/config/roles";

const SESSION_KEY = "session";

/** Sesión del usuario.
 *
 *  Guarda sólo lo que hace falta para DECIDIR QUÉ PINTAR (rol e idioma). La
 *  autorización real la hace el servidor en cada petición: esto no es un
 *  control de seguridad y no debe tratarse como tal.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const guardada = localStorage.getItem(SESSION_KEY);
    return guardada ? (JSON.parse(guardada) as Session) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    // Se usa la funcion generada del OpenAPI y no un fetch a mano: si el
    // contrato de /auth/login cambia, esto deja de compilar en vez de fallar
    // en tiempo de ejecucion.
    const res = await loginRequest({ email, password });

    tokens.set(res);
    const nueva: Session = { role: res.role as Role, lang: res.lang as Lang };
    localStorage.setItem(SESSION_KEY, JSON.stringify(nueva));
    setSession(nueva);
    return nueva;
  }, []);

  const logout = useCallback(() => {
    // Revocar en el servidor es best-effort: si falla (sin red, token ya
    // expirado), la sesión local se cierra igual. Un fallo al revocar no puede
    // dejar al usuario atrapado sin poder salir.
    if (tokens.refresh) {
      void logoutRequest({ refresh_token: tokens.refresh }).catch(() => {});
    }
    tokens.clear();
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ session, login, logout }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
