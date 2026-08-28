import { routes } from "@/shared/config/routes";
import type { IconName } from "@/shared/ui/panel-icons";

export type NavGroup = "track" | "content" | "system";

export interface NavItem {
  key: string;
  to: string;
  icon: IconName;
  end?: boolean;
  group: NavGroup;
}

export const NAV_HOME: NavItem = {
  key: "dashboard",
  to: routes.teacher,
  icon: "grid",
  end: true,
  group: "track",
};

export const NAV: NavItem[] = [
  { key: "courses", to: routes.teacherCourses, icon: "users", group: "track" },
  { key: "progress", to: routes.teacherProgress, icon: "bar-chart", group: "track" },
  { key: "grading", to: routes.teacherGrading, icon: "check-square", group: "track" },

  { key: "content", to: routes.teacherContent, icon: "book", group: "content" },

  { key: "settings", to: routes.teacherSettings, icon: "settings", group: "system" },
];

export const GROUP_ORDER: NavGroup[] = ["track", "content", "system"];
