/** Rutas de la aplicación en un solo sitio.
 *
 *  Se declaran como funciones o constantes y NUNCA se escriben a mano en un
 *  `<Link to="/projects/123">`: una ruta escrita a pelo en un componente es
 *  como se llega a enlaces rotos que ningún test de componente detecta.
 */
export const routes = {
  login: "/login",

  // La raíz muestra el 404 a propósito: no hay panel común a los cuatro roles.
  // `homeForRole` (shared/config/roles.ts) reparte a cada uno su herramienta.
  dashboard: "/",
  messages: "/messages",
  account: "/account",

  // Panel del estudiante (rol student; el personal docente también puede
  // entrar, ve lo mismo que el alumno — R4).
  student: "/student",
  studentAgenda: "/student/agenda",
  studentCourses: "/student/courses",
  studentCourse: (projectId: string) => `/student/courses/${projectId}`,
  studentMoment: (projectId: string, momentType: string) =>
    `/student/courses/${projectId}/${momentType}`,
  studentAssignments: "/student/assignments",

  // Panel del docente (rol teacher/editor/admin). Índice = resumen.
  teacher: "/teacher",
  teacherCourses: "/teacher/courses",
  teacherCourse: (id: string) => `/teacher/courses/${id}`,
  teacherAssignments: "/teacher/assignments",
  teacherAgenda: "/teacher/agenda",
  teacherProgress: "/teacher/progress",
  teacherGrading: "/teacher/grading",
  teacherContent: "/teacher/content",
  teacherContentProject: (id: string) => `/teacher/content/${id}`,
  teacherSettings: "/teacher/settings",

  // Panel de administración (rol admin).
  admin: "/admin",
  adminUsers: "/admin/users",
  adminCourses: "/admin/courses",
  adminCourse: (id: string) => `/admin/courses/${id}`,
  adminModeration: "/admin/moderation",
  adminAudit: "/admin/audit",
  adminSettings: "/admin/settings",

  // Content Studio (rol editor/admin). El índice es el panel; el resto son
  // pestañas del mockup. Se construyen aquí y nunca a mano en un <Link>.
  studio: "/studio",
  studioContents: "/studio/contents",
  studioLessons: "/studio/lessons",
  studioResources: "/studio/resources",
  studioProjects: "/studio/projects",
  studioProject: (id: string) => `/studio/projects/${id}`,
  studioMoment: (projectId: string, momentId: string) =>
    `/studio/projects/${projectId}/moments/${momentId}`,
  studioAssessments: "/studio/assessments",
  studioPaths: "/studio/paths",
  studioPath: (id: string) => `/studio/paths/${id}`,
  studioMedia: "/studio/media",
  studioTemplates: "/studio/templates",
  studioTags: "/studio/tags",
  studioCollections: "/studio/collections",
  studioCollection: (id: string) => `/studio/collections/${id}`,
  studioAnalytics: "/studio/analytics",
  studioStudents: "/studio/students",
  studioSettings: "/studio/settings",
} as const;
