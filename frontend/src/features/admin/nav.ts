import { routes } from "@/shared/config/routes";
import type { IconName } from "@/shared/ui/panel-icons";

export type NavGroup = "manage" | "watch" | "system";

export interface NavItem {
  key: string;
  to: string;
  icon: IconName;
  end?: boolean;
  group: NavGroup;
}

export const NAV_HOME: NavItem = {
  key: "dashboard",
  to: routes.admin,
  icon: "grid",
  end: true,
  group: "manage",
};

export const NAV: NavItem[] = [
  { key: "users", to: routes.adminUsers, icon: "users", group: "manage" },
  { key: "courses", to: routes.adminCourses, icon: "book", group: "manage" },

  { key: "moderation", to: routes.adminModeration, icon: "eye", group: "watch" },
  { key: "audit", to: routes.adminAudit, icon: "layers", group: "watch" },

  { key: "settings", to: routes.adminSettings, icon: "settings", group: "system" },
];

export const GROUP_ORDER: NavGroup[] = ["manage", "watch", "system"];
