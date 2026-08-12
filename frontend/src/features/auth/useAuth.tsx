import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { http, setAccessToken } from "@/lib/http";

export type Role = "student" | "teacher" | "editor" | "admin";

export interface Session {
  role: Role;
  lang: "es" | "en";
}

interface AuthValue {
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isStaff: boolean;
  canAuthor: boolean;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem("session");
    return raw ? (JSON.parse(raw) as Session) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await http<{
      access_token: string;
      role: Role;
      lang: "es" | "en";
    }>({ url: "/auth/login", method: "POST", data: { email, password } });

    setAccessToken(res.access_token);
    const next = { role: res.role, lang: res.lang };
    localStorage.setItem("session", JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
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

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
