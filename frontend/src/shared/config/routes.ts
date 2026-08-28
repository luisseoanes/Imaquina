/** Rutas de la aplicación en un solo sitio.
 *
 *  Se declaran como funciones o constantes y NUNCA se escriben a mano en un
 *  `<Link to="/projects/123">`: una ruta escrita a pelo en un componente es
 *  como se llega a enlaces rotos que ningún test de componente detecta.
 */
export const routes = {
  login: "/login",

  dashboard: "/",
  courses: "/courses",
  course: (projectId: string) => `/courses/${projectId}`,
  moment: (projectId: string, momentType: string) =>
    `/courses/${projectId}/${momentType}`,

  assignments: "/assignments",
  messages: "/messages",
  account: "/account",

  // Panel del docente (rol teacher/editor/admin). Índice = resumen.
  teacher: "/teacher",
  teacherCourses: "/teacher/courses",
  teacherCourse: (id: string) => `/teacher/courses/${id}`,
  teacherProgress: "/teacher/progress",
  teacherGrading: "/teacher/grading",
  teacherContent: "/teacher/content",
  teacherContentProject: (id: string) => `/teacher/content/${id}`,
  teacherSettings: "/teacher/settings",

  admin: "/admin",

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
