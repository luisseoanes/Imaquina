/** Roles del backend. El servidor es quien autoriza de verdad: esto sólo
 *  decide QUÉ PINTAR, y nunca sustituye a un guard del servidor. */
export const ROLES = ["student", "teacher", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Quién ve las herramientas de personal docente y quién las de autoría. */
export const isStaff = (role: Role) => role !== "student";
export const canAuthor = (role: Role) => role === "editor" || role === "admin";
export const isAdmin = (role: Role) => role === "admin";

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
