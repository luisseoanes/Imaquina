/** Acceso al Content Studio.
 *
 *  Hooks a mano sobre `http()` en vez del cliente de orval: el código generado
 *  está en .gitignore y `npm run api:gen` necesita el backend corriendo, así
 *  que importarlo rompería el build en CI y en un clon recién hecho.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/lib/http";

const BASE = "/studio/catalog";
const PUBLISHING = "/studio/publishing";
const MEDIA = "/studio/media";

export type Lang = "es" | "en";
export type BlockKind = "text" | "image" | "audio" | "video" | "embed";

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
  updated_at: string;
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

export interface StudioBlock {
  id: string;
  moment_id: string;
  kind: BlockKind;
  order: number;
  media_asset_id: string | null;
  lang: Lang;
  body: string | null;
  caption: string | null;
  alt_text: string | null;
  langs: Lang[];
  updated_at: string;
}

export interface StudioMomentDetail {
  id: string;
  project_id: string;
  type: string;
  order: number;
  lang: Lang;
  title: string | null;
  teacher_note: string | null;
  chatbot_opening_prompt: string | null;
  langs: Lang[];
  updated_at: string;
  blocks: StudioBlock[];
}

export interface TranslationStatus {
  lang: Lang;
  complete: boolean;
  missing: string[];
}

export interface MediaAsset {
  id: string;
  s3_key: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  original_filename: string;
  duration_seconds: number | null;
  alt_text: string | null;
  created_at: string;
  used_in: number;
}

export const claves = {
  projects: (lang: Lang) => ["studio", "projects", lang] as const,
  project: (id: string, lang: Lang) => ["studio", "project", id, lang] as const,
  moment: (id: string, lang: Lang) => ["studio", "moment", id, lang] as const,
  translations: (id: string) => ["studio", "translations", id] as const,
  preview: (id: string, lang: Lang, as_: string) =>
    ["studio", "preview", id, lang, as_] as const,
  media: (familia?: string, buscar?: string) =>
    ["studio", "media", familia ?? "", buscar ?? ""] as const,
};

// --- Proyectos ---------------------------------------------------------

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
    enabled: !!id,
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

export function useUpdateProject(id: string, lang: Lang) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title?: string;
      summary?: string;
      grade?: string;
      kit?: string | null;
      expected_updated_at?: string;
    }) =>
      http<StudioProjectDetail>({
        url: `${BASE}/projects/${id}`,
        method: "PATCH",
        data: { ...data, lang },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio", "project", id] });
      qc.invalidateQueries({ queryKey: ["studio", "projects"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http<void>({ url: `${BASE}/projects/${id}`, method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "projects"] }),
  });
}

export function useDuplicateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, slug }: { id: string; slug: string }) =>
      http<StudioProjectDetail>({
        url: `${BASE}/projects/${id}/duplicate`,
        method: "POST",
        data: { slug },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "projects"] }),
  });
}

export function useTranslationStatus(projectId: string) {
  return useQuery({
    queryKey: claves.translations(projectId),
    queryFn: () =>
      http<TranslationStatus[]>({ url: `${BASE}/projects/${projectId}/translations` }),
    enabled: !!projectId,
  });
}

// --- Momentos ------------------------------------------------------------

export function useStudioMoment(id: string, lang: Lang) {
  return useQuery({
    queryKey: claves.moment(id, lang),
    queryFn: () =>
      http<StudioMomentDetail>({ url: `${BASE}/moments/${id}`, params: { lang } }),
    enabled: !!id,
  });
}

export function useUpdateMoment(id: string, lang: Lang) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title?: string;
      teacher_note?: string;
      chatbot_opening_prompt?: string;
      expected_updated_at?: string;
    }) =>
      http<StudioMomentDetail>({
        url: `${BASE}/moments/${id}`,
        method: "PATCH",
        data: { ...data, lang },
      }),
    onSuccess: (data) => {
      qc.setQueryData(claves.moment(id, lang), data);
      qc.invalidateQueries({ queryKey: ["studio", "project"] });
    },
  });
}

export interface PreviewMoment {
  id: string;
  type: string;
  title: string | null;
  teacher_note?: string | null;
  chatbot_opening_prompt: string | null;
  blocks: StudioBlock[];
}

export function usePreviewMoment(id: string, lang: Lang, as_: "student" | "teacher") {
  return useQuery({
    queryKey: claves.preview(id, lang, as_),
    queryFn: () =>
      http<PreviewMoment>({
        url: `${BASE}/moments/${id}/preview`,
        params: { lang, as: as_ },
      }),
    enabled: !!id,
  });
}

// --- Bloques ---------------------------------------------------------------

export function useCreateBlock(momentId: string, lang: Lang) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      kind: BlockKind;
      media_asset_id?: string | null;
      body?: string | null;
      caption?: string | null;
      alt_text?: string | null;
    }) =>
      http<StudioBlock>({
        url: `${BASE}/moments/${momentId}/blocks`,
        method: "POST",
        data: { ...data, lang },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "moment", momentId] }),
  });
}

export function useUpdateBlock(momentId: string, lang: Lang) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      blockId,
      ...data
    }: {
      blockId: string;
      media_asset_id?: string | null;
      body?: string | null;
      caption?: string | null;
      alt_text?: string | null;
      expected_updated_at?: string;
    }) =>
      http<StudioBlock>({
        url: `${BASE}/blocks/${blockId}`,
        method: "PATCH",
        data: { ...data, lang },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "moment", momentId] }),
  });
}

export function useDeleteBlock(momentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) =>
      http<void>({ url: `${BASE}/blocks/${blockId}`, method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "moment", momentId] }),
  });
}

export function useReorderBlocks(momentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blockIds: string[]) =>
      http<StudioBlock[]>({
        url: `${BASE}/moments/${momentId}/blocks/order`,
        method: "PUT",
        data: { block_ids: blockIds },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "moment", momentId] }),
  });
}

// --- Publicación -----------------------------------------------------------

export function useValidateProject() {
  return useMutation({
    mutationFn: (id: string) =>
      http<{ problems: string[] }>({
        url: `${PUBLISHING}/projects/${id}/validate`,
        method: "POST",
      }),
  });
}

export function usePublishProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      http<{ version: number; published_at: string }>({
        url: `${PUBLISHING}/projects/${id}/publish`,
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "project"] }),
  });
}

export function useUnpublishProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      http<{ status: string }>({
        url: `${PUBLISHING}/projects/${id}/unpublish`,
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "project"] }),
  });
}

// --- Media -------------------------------------------------------------

export function useMediaAssets(familia?: string, buscar?: string) {
  return useQuery({
    queryKey: claves.media(familia, buscar),
    queryFn: () =>
      http<{ total: number; items: MediaAsset[] }>({
        url: `${MEDIA}/assets`,
        params: { familia, buscar },
      }),
  });
}

export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, altText }: { file: File; altText?: string }) => {
      const presign = await http<{ upload_url: string; s3_key: string }>({
        url: `${MEDIA}/presign`,
        method: "POST",
        data: {
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        },
      });

      // Sube directo al bucket: nunca pasa por FastAPI (un video de 200MB no
      // puede pasar por el backend).
      const subida = await fetch(presign.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!subida.ok) throw new Error("La subida al bucket falló");

      return http<{ id: string; s3_key: string; url: string }>({
        url: `${MEDIA}/register`,
        method: "POST",
        data: {
          s3_key: presign.s3_key,
          mime_type: file.type,
          size_bytes: file.size,
          original_filename: file.name,
          alt_text: altText ?? null,
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "media"] }),
  });
}
