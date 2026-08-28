import { routes } from "./routes";

/** Roles del backend. El servidor es quien autoriza de verdad: esto sólo
 *  decide QUÉ PINTAR, y nunca sustituye a un guard del servidor. */
export const ROLES = ["student", "teacher", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Quién ve las herramientas de personal docente y quién las de autoría. */
export const isStaff = (role: Role) => role !== "student";
export const canAuthor = (role: Role) => role === "editor" || role === "admin";
export const isAdmin = (role: Role) => role === "admin";

/** A dónde va cada rol tras iniciar sesión (y a dónde lo devuelve un guard si
 *  entra donde no le toca). La raíz `/` no está construida —muestra el 404—,
 *  así que nadie debe aterrizar ahí: admin a administración, editor al Studio,
 *  docente a su panel, estudiante a sus cursos. */
export function homeForRole(role: Role): string {
  if (isAdmin(role)) return routes.admin;
  if (canAuthor(role)) return routes.studio;
  if (isStaff(role)) return routes.teacher;
  return routes.student;
}

/** Los seis momentos, en el orden fijo del backend (R7). El cliente no
 *  reordena ni inventa: si el backend añade uno, se añade aquí. */
export const MOMENT_ORDER = [
  "intro",
  "inquiry",
  "design",
  "build",
  "communicate",
  "assess",
] as const;
export type MomentType = (typeof MOMENT_ORDER)[number];

/** Los dos idiomas del MVP (R6). */
export const LANGS = ["es", "en"] as const;
export type Lang = (typeof LANGS)[number];
