import { routes } from "@/shared/config/routes";
import type { IconName } from "@/shared/ui/panel-icons";

/** Las pestañas del panel del estudiante.
 *
 *  `key` es la clave i18n bajo `student.nav.*`; `group`, la clave bajo
 *  `student.group.*`. El orden de este array es el orden de la barra lateral.
 *
 *  `soon` marca lo que el backend todavía no sirve: se pinta en gris y no
 *  navega. Es una decisión del PO frente a omitirlo — deja a la vista lo que
 *  viene, a cambio de enseñar una puerta que no abre.
 */
export type NavGroup = "learn" | "account";

export interface NavItem {
  key: string;
  to: string;
  icon: IconName;
  end?: boolean;
  group: NavGroup;
  soon?: boolean;
}

/** El inicio va suelto arriba, sin grupo. */
export const NAV_HOME: NavItem = {
  key: "dashboard",
  to: routes.student,
  icon: "grid",
  end: true,
  group: "learn",
};

export const NAV: NavItem[] = [
  { key: "courses", to: routes.studentCourses, icon: "cpu", group: "learn" },
  { key: "agenda", to: routes.studentAgenda, icon: "calendar", group: "learn" },
  { key: "assignments", to: routes.studentAssignments, icon: "check-square", group: "learn" },
  // Sin backend: `/chat` existe pero es el asistente dentro del momento, no
  // mensajería entre personas. `routes.messages` está declarado desde el
  // esqueleto, así que la pantalla está prevista, no inventada aquí.
  { key: "messages", to: routes.messages, icon: "message", group: "learn", soon: true },

  { key: "account", to: routes.account, icon: "settings", group: "account" },
];

export const GROUP_ORDER: NavGroup[] = ["learn", "account"];
