import { routes } from "@/shared/config/routes";
import type { IconName } from "@/shared/ui/panel-icons";

/** Las pestañas del panel del editor.
 *
 *  `key` es la clave i18n bajo `studio.nav.*`; `group` la clave bajo
 *  `studio.group.*`. El orden de este array es el orden de la barra lateral.
 */
export type NavGroup = "create" | "manage" | "insight" | "system";

export interface NavItem {
  key: string;
  to: string;
  icon: IconName;
  end?: boolean;
  group: NavGroup;
}

/** El dashboard va suelto arriba, sin grupo. */
export const NAV_HOME: NavItem = {
  key: "dashboard",
  to: routes.studio,
  icon: "grid",
  end: true,
  group: "create",
};

export const NAV: NavItem[] = [
  { key: "contents", to: routes.studioContents, icon: "layers", group: "create" },
  { key: "lessons", to: routes.studioLessons, icon: "book", group: "create" },
  { key: "resources", to: routes.studioResources, icon: "wrench", group: "create" },
  { key: "projects", to: routes.studioProjects, icon: "cpu", group: "create" },
  { key: "assessments", to: routes.studioAssessments, icon: "check-square", group: "create" },
  { key: "paths", to: routes.studioPaths, icon: "route", group: "create" },

  { key: "media", to: routes.studioMedia, icon: "image", group: "manage" },
  { key: "templates", to: routes.studioTemplates, icon: "template", group: "manage" },
  { key: "tags", to: routes.studioTags, icon: "tag", group: "manage" },
  { key: "collections", to: routes.studioCollections, icon: "folder", group: "manage" },
  { key: "glossary", to: routes.studioGlossary, icon: "book", group: "manage" },

  { key: "analytics", to: routes.studioAnalytics, icon: "bar-chart", group: "insight" },
  { key: "translation", to: routes.studioTranslation, icon: "layers", group: "insight" },
  { key: "students", to: routes.studioStudents, icon: "users", group: "insight" },

  { key: "settings", to: routes.studioSettings, icon: "settings", group: "system" },
];

export const GROUP_ORDER: NavGroup[] = ["create", "manage", "insight", "system"];
