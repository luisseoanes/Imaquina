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

  teacher: "/teacher",
  admin: "/admin",
  studio: "/studio",
} as const;
