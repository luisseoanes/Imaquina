/** Configuración por entorno, leída una sola vez y tipada.
 *
 *  Ningún módulo lee `import.meta.env` por su cuenta: así hay un único sitio
 *  donde ver qué variables existen y qué pasa si faltan.
 */
export const env = {
  /** Base de la API. En desarrollo el proxy de Vite manda `/api` al backend,
   *  así que la relativa vale y no hay CORS. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  isDev: import.meta.env.DEV,
} as const;
