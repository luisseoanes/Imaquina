/** Contexto de sesion y su hook. Sin componentes a proposito: el provider vive
 *  en AuthProvider.tsx para que el hot reload de Vite funcione en ambos. */
import { createContext, useContext } from "react";

export type Role = "student" | "teacher" | "editor" | "admin";

export interface Session {
  role: Role;
  lang: "es" | "en";
}

export interface AuthValue {
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isStaff: boolean;
  canAuthor: boolean;
}

export const AuthCtx = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
