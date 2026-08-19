/** Acceso al Content Studio.
 *
 *  Hooks a mano sobre `http()` en vez del cliente de orval: el código generado
 *  está en .gitignore y `npm run api:gen` necesita el backend corriendo, así
 *  que importarlo rompería el build en CI y en un clon recién hecho.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/lib/http";

const BASE = "/studio/catalog";

export type Lang = "es" | "en";

export interface StudioProject {
  id: string;
  slug: string;
  grade: string;
  kit: string | null;
  order: number;
  status: "draft" | "published";
  lang: Lang;
  title: string | null;
  summary: string | null;
  /** Idiomas que ya tienen traducción. Sirve para el aviso de "falta traducir". */
  langs: Lang[];
}

export interface StudioMoment {
  id: string;
  type: string;
  order: number;
  title: string | null;
  /** Número de bloques, no los bloques: el listado no los arrastra. */
  blocks: number;
  langs: Lang[];
}

export interface StudioProjectDetail extends StudioProject {
  moments: StudioMoment[];
}

export interface NewProject {
  slug: string;
  grade: string;
  title: string;
  kit?: string | null;
}

export const claves = {
  projects: (lang: Lang) => ["studio", "projects", lang] as const,
  project: (id: string, lang: Lang) => ["studio", "project", id, lang] as const,
};

export function useStudioProjects(lang: Lang) {
  return useQuery({
    queryKey: claves.projects(lang),
    queryFn: () =>
      http<StudioProject[]>({ url: `${BASE}/projects`, params: { lang } }),
  });
}

export function useStudioProject(id: string, lang: Lang) {
  return useQuery({
    queryKey: claves.project(id, lang),
    queryFn: () =>
      http<StudioProjectDetail>({ url: `${BASE}/projects/${id}`, params: { lang } }),
  });
}

export function useCreateProject(lang: Lang) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NewProject) =>
      http<StudioProjectDetail>({
        url: `${BASE}/projects`,
        method: "POST",
        data: { ...data, lang },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "projects"] }),
  });
}
