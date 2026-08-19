import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { clearTokens, http, setAccessToken, setRefreshToken } from "@/lib/http";
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

    const next = { role: res.role, lang: res.lang };
    localStorage.setItem("session", JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(() => {
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
