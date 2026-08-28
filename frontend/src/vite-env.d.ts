/// <reference types="vite/client" />

/** Variables de entorno de la app, tipadas. Sin esto `import.meta.env` no
 *  existe para TypeScript y cada acceso es un `any` silencioso. */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
