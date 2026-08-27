import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { setLanguage } from "@/i18n";
import {
  clearTokens,
  getRefreshToken,
  http,
  setAccessToken,
  setRefreshToken,
} from "@/lib/http";
import { AuthCtx } from "./useAuth";
import type { AuthValue, Role, Session } from "./useAuth";

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  role: Role;
  lang: "es" | "en";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem("session");
    return raw ? (JSON.parse(raw) as Session) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await http<LoginResponse>({
      url: "/auth/login",
      method: "POST",
      data: { email, password },
    });

    // El refresh token hay que GUARDARLO: el access dura 15 minutos y sin
    // esto la sesion se moria sin posibilidad de renovarla.
    setAccessToken(res.access_token);
    setRefreshToken(res.refresh_token);

    // I7: manda el idioma de LA CUENTA, no el que quedó en este navegador.
    // Sin esto, entrar desde un equipo compartido del aula te servía la
    // interfaz en el idioma del último que lo usó.
    setLanguage(res.lang);

    const next = { role: res.role, lang: res.lang };
    localStorage.setItem("session", JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    // N2: revoca el refresh en el servidor. Best-effort -- si falla (sin
    // red, ya expirado), la sesión local se cierra igual: no hay forma de
    // que un fallo de revocación deje al usuario atrapado sin poder salir.
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      void http({
        url: "/auth/logout",
        method: "POST",
        data: { refresh_token: refreshToken },
      }).catch(() => {});
    }
    clearTokens();
    localStorage.removeItem("session");
    setSession(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      login,
      logout,
      // Espejo del backend para decidir QUE PINTAR. La autorizacion real
      // vive en el servidor: esto no es un control de seguridad.
      isStaff: !!session && ["teacher", "editor", "admin"].includes(session.role),
      canAuthor: !!session && ["editor", "admin"].includes(session.role),
    }),
    [session, login, logout],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
