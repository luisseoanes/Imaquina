/** Acceso HTTP del Content Studio.
 *
 *  Hooks a mano sobre `httpClient` (que ya resuelve auth, refresh y errores),
 *  no el cliente de orval: el generado está gitignored y `api:gen` necesita el
 *  backend vivo, así que importarlo rompería CI y un clon recién hecho.
 *
 *  Estado de servidor con TanStack Query; nada de estado global propio.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";

import httpClient from "@/shared/api/httpClient";
import { env } from "@/shared/config/env";
import type { Lang } from "@/shared/config/roles";
import type {
  Assessment,
  AssessmentAnalyticsRow,
  Block,
  Collection,
  ContentTemplate,
  Dashboard,
  LearningPath,
  Lesson,
  MediaList,
  Moment,
  PreviewMoment,
  Project,
  ProjectDetail,
  RefType,
  Resource,
  StudentActivity,
  Tag,
  TranslationState,
} from "./types";

const BASE = env.apiBaseUrl;

function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

function get<T>(path: string): Promise<T> {
  return httpClient<T>(`${BASE}${path}`);
}
function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return httpClient<T>(`${BASE}${path}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** Claves de caché en un solo sitio: invalidar por prefijo es fiable. */
export const keys = {
  dashboard: ["studio", "dashboard"] as const,
  analytics: ["studio", "analytics"] as const,
  students: ["studio", "students"] as const,
  projects: (lang: Lang, grade?: string) =>
    ["studio", "projects", lang, grade ?? null] as const,
  project: (id: string, lang: Lang) => ["studio", "project", id, lang] as const,
  translations: (id: string) => ["studio", "translations", id] as const,
  moment: (id: string, lang: Lang) => ["studio", "moment", id, lang] as const,
  blocks: (momentId: string, lang: Lang) =>
    ["studio", "blocks", momentId, lang] as const,
  assessment: (momentId: string, lang: Lang) =>
    ["studio", "assessment", momentId, lang] as const,
  lessons: (lang: Lang) => ["studio", "lessons", lang] as const,
  resources: (lang: Lang) => ["studio", "resources", lang] as const,
  paths: (lang: Lang) => ["studio", "paths", lang] as const,
  path: (id: string, lang: Lang) => ["studio", "path", id, lang] as const,
  templates: ["studio", "templates"] as const,
  tags: ["studio", "tags"] as const,
  tagsOf: (t: RefType, id: string) => ["studio", "tagsOf", t, id] as const,
  collections: (lang: Lang) => ["studio", "collections", lang] as const,
  collection: (id: string, lang: Lang) =>
    ["studio", "collection", id, lang] as const,
  media: (familia: string, buscar: string) =>
    ["studio", "media", familia, buscar] as const,
};

type Opts<T> = Omit<UseQueryOptions<T>, "queryKey" | "queryFn">;

// --- Tablero ---------------------------------------------------------------

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => get<Dashboard>("/studio/dashboard") });

export const useAssessmentAnalytics = () =>
  useQuery({
    queryKey: keys.analytics,
    queryFn: () => get<AssessmentAnalyticsRow[]>("/studio/analytics/assessments"),
  });

export const useStudents = () =>
  useQuery({
    queryKey: keys.students,
    queryFn: () => get<StudentActivity[]>("/studio/students"),
  });

// --- Proyectos (catalog) --------------------------------------------------

export const useProjects = (lang: Lang, grade?: string) =>
  useQuery({
    queryKey: keys.projects(lang, grade),
    queryFn: () =>
      get<Project[]>(`/studio/catalog/projects${qs({ lang, grade })}`),
  });

export const useProject = (id: string, lang: Lang, opts?: Opts<ProjectDetail>) =>
  useQuery({
    queryKey: keys.project(id, lang),
    queryFn: () =>
      get<ProjectDetail>(`/studio/catalog/projects/${id}${qs({ lang })}`),
    ...opts,
  });

export const useTranslationState = (id: string, opts?: Opts<TranslationState[]>) =>
  useQuery({
    queryKey: keys.translations(id),
    queryFn: () =>
      get<TranslationState[]>(`/studio/catalog/projects/${id}/translations`),
    ...opts,
  });

export function useProjectMutations(lang: Lang) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["studio", "projects"] });
  return {
    create: useMutation({
      mutationFn: (b: {
        slug: string;
        grade: string;
        title: string;
        kit?: string | null;
        summary?: string | null;
      }) => send<ProjectDetail>("/studio/catalog/projects", "POST", { ...b, lang }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<Project>(`/studio/catalog/projects/${id}`, "PATCH", { ...b, lang }),
      onSuccess: (_d, v) => {
        void invalidate();
        void qc.invalidateQueries({ queryKey: ["studio", "project", v.id] });
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) =>
        send<void>(`/studio/catalog/projects/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
    duplicate: useMutation({
      mutationFn: ({ id, slug }: { id: string; slug: string }) =>
        send<ProjectDetail>(
          `/studio/catalog/projects/${id}/duplicate`,
          "POST",
          { slug },
        ),
      onSuccess: invalidate,
    }),
  };
}

export function usePublishMutations(id: string) {
  const qc = useQueryClient();
  const done = () => {
    void qc.invalidateQueries({ queryKey: ["studio"] });
  };
  return {
    validate: useMutation({
      mutationFn: (lang: Lang) =>
        send<{ problems: string[] }>(
          `/studio/publishing/projects/${id}/validate${qs({ lang })}`,
          "POST",
        ),
    }),
    publish: useMutation({
      mutationFn: (lang: Lang) =>
        send<{ version: number; published_at: string }>(
          `/studio/publishing/projects/${id}/publish${qs({ lang })}`,
          "POST",
        ),
      onSuccess: done,
    }),
    unpublish: useMutation({
      mutationFn: () =>
        send<{ status: string }>(
          `/studio/publishing/projects/${id}/unpublish`,
          "POST",
        ),
      onSuccess: done,
    }),
  };
}

// --- Momentos y bloques -------------------------------------------------

export const useMoment = (id: string, lang: Lang, opts?: Opts<Moment>) =>
  useQuery({
    queryKey: keys.moment(id, lang),
    queryFn: () => get<Moment>(`/studio/catalog/moments/${id}${qs({ lang })}`),
    ...opts,
  });

export function useMomentMutations(momentId: string, lang: Lang) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["studio", "moment", momentId] });
    void qc.invalidateQueries({ queryKey: ["studio", "blocks", momentId] });
  };
  return {
    updateMoment: useMutation({
      mutationFn: (b: Record<string, unknown>) =>
        send<Moment>(`/studio/catalog/moments/${momentId}`, "PATCH", {
          ...b,
          lang,
        }),
      onSuccess: invalidate,
    }),
    createBlock: useMutation({
      mutationFn: (b: { kind: string; body?: string | null }) =>
        send<Block>(`/studio/catalog/moments/${momentId}/blocks`, "POST", {
          ...b,
          lang,
        }),
      onSuccess: invalidate,
    }),
    updateBlock: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<Block>(`/studio/catalog/blocks/${id}`, "PATCH", { ...b, lang }),
      onSuccess: invalidate,
    }),
    deleteBlock: useMutation({
      mutationFn: (id: string) =>
        send<void>(`/studio/catalog/blocks/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
    reorderBlocks: useMutation({
      mutationFn: (blockIds: string[]) =>
        send<Block[]>(
          `/studio/catalog/moments/${momentId}/blocks/order`,
          "PUT",
          { block_ids: blockIds },
        ),
      onSuccess: invalidate,
    }),
  };
}

export const useMomentPreview = (momentId: string, lang: Lang, as: "student" | "teacher") =>
  useQuery({
    queryKey: ["studio", "preview", momentId, lang, as],
    queryFn: () =>
      get<PreviewMoment>(
        `/studio/catalog/moments/${momentId}/preview${qs({ lang, as })}`,
      ),
  });

// --- Evaluación (assessment) ------------------------------------------

export const useAssessment = (momentId: string, lang: Lang, opts?: Opts<Assessment>) =>
  useQuery({
    queryKey: keys.assessment(momentId, lang),
    queryFn: () =>
      get<Assessment>(`/studio/assessment/moments/${momentId}${qs({ lang })}`),
    ...opts,
  });

export function useAssessmentMutations(momentId: string, lang: Lang) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["studio", "assessment", momentId] });
  return {
    update: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<Assessment>(`/studio/assessment/${id}`, "PATCH", { ...b, lang }),
      onSuccess: invalidate,
    }),
    createQuestion: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<unknown>(`/studio/assessment/${id}/questions`, "POST", {
          ...b,
          lang,
        }),
      onSuccess: invalidate,
    }),
    updateQuestion: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<unknown>(`/studio/assessment/questions/${id}`, "PATCH", {
          ...b,
          lang,
        }),
      onSuccess: invalidate,
    }),
    deleteQuestion: useMutation({
      mutationFn: (id: string) =>
        send<void>(`/studio/assessment/questions/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
    addChoice: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<unknown>(`/studio/assessment/questions/${id}/choices`, "POST", b),
      onSuccess: invalidate,
    }),
    updateChoice: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<unknown>(`/studio/assessment/choices/${id}`, "PATCH", {
          ...b,
          lang,
        }),
      onSuccess: invalidate,
    }),
    deleteChoice: useMutation({
      mutationFn: (id: string) =>
        send<void>(`/studio/assessment/choices/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
    setRubric: useMutation({
      mutationFn: ({
        id,
        criteria,
      }: {
        id: string;
        criteria: unknown[];
      }) =>
        send<unknown>(`/studio/assessment/questions/${id}/rubric`, "PUT", {
          criteria,
        }),
      onSuccess: invalidate,
    }),
  };
}

// --- Lecciones ------------------------------------------------------------

export const useLessons = (lang: Lang) =>
  useQuery({
    queryKey: keys.lessons(lang),
    queryFn: () => get<Lesson[]>(`/studio/lessons${qs({ lang })}`),
  });

export function useLessonMutations(lang: Lang) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["studio", "lessons"] });
  return {
    create: useMutation({
      mutationFn: (b: Record<string, unknown>) =>
        send<Lesson>("/studio/lessons", "POST", { ...b, lang }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<Lesson>(`/studio/lessons/${id}`, "PATCH", { ...b, lang }),
      onSuccess: invalidate,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: string }) =>
        send<Lesson>(`/studio/lessons/${id}/status`, "POST", { status }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => send<void>(`/studio/lessons/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
  };
}

// --- Recursos -----------------------------------------------------------

export const useResources = (lang: Lang) =>
  useQuery({
    queryKey: keys.resources(lang),
    queryFn: () => get<Resource[]>(`/studio/resources${qs({ lang })}`),
  });

export function useResourceMutations(lang: Lang) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["studio", "resources"] });
  return {
    create: useMutation({
      mutationFn: (b: Record<string, unknown>) =>
        send<Resource>("/studio/resources", "POST", { ...b, lang }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<Resource>(`/studio/resources/${id}`, "PATCH", { ...b, lang }),
      onSuccess: invalidate,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: string }) =>
        send<Resource>(`/studio/resources/${id}/status`, "POST", { status }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => send<void>(`/studio/resources/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
  };
}

// --- Rutas de aprendizaje --------------------------------------------

export const usePaths = (lang: Lang) =>
  useQuery({
    queryKey: keys.paths(lang),
    queryFn: () => get<LearningPath[]>(`/studio/paths${qs({ lang })}`),
  });

export const usePath = (id: string, lang: Lang, opts?: Opts<LearningPath>) =>
  useQuery({
    queryKey: keys.path(id, lang),
    queryFn: () => get<LearningPath>(`/studio/paths/${id}${qs({ lang })}`),
    ...opts,
  });

export function usePathMutations(lang: Lang) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["studio", "paths"] });
  const invalidateOne = (id: string) =>
    qc.invalidateQueries({ queryKey: ["studio", "path", id] });
  return {
    create: useMutation({
      mutationFn: (b: Record<string, unknown>) =>
        send<LearningPath>("/studio/paths", "POST", { ...b, lang }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<LearningPath>(`/studio/paths/${id}`, "PATCH", { ...b, lang }),
      onSuccess: (_d, v) => {
        void invalidate();
        void invalidateOne(v.id);
      },
    }),
    setItems: useMutation({
      mutationFn: ({
        id,
        items,
      }: {
        id: string;
        items: { ref_type: RefType; ref_id: string }[];
      }) => send<LearningPath>(`/studio/paths/${id}/items`, "PUT", { items }),
      onSuccess: (_d, v) => {
        void invalidate();
        void invalidateOne(v.id);
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => send<void>(`/studio/paths/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
  };
}

// --- Plantillas -------------------------------------------------------

export const useTemplates = () =>
  useQuery({
    queryKey: keys.templates,
    queryFn: () => get<ContentTemplate[]>("/studio/templates"),
  });

export function useTemplateMutations() {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["studio", "templates"] });
  return {
    create: useMutation({
      mutationFn: (b: Record<string, unknown>) =>
        send<ContentTemplate>("/studio/templates", "POST", b),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<ContentTemplate>(`/studio/templates/${id}`, "PATCH", b),
      onSuccess: invalidate,
    }),
    apply: useMutation({
      mutationFn: ({
        id,
        slug,
        grade,
      }: {
        id: string;
        slug: string;
        grade: string;
      }) => send<ProjectDetail>(`/studio/templates/${id}/apply`, "POST", { slug, grade }),
      onSuccess: () => {
        void invalidate();
        void qc.invalidateQueries({ queryKey: ["studio", "projects"] });
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => send<void>(`/studio/templates/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
  };
}

// --- Etiquetas -------------------------------------------------------

export const useTags = () =>
  useQuery({ queryKey: keys.tags, queryFn: () => get<Tag[]>("/studio/tags") });

export const useTagsOf = (t: RefType, id: string, opts?: Opts<Tag[]>) =>
  useQuery({
    queryKey: keys.tagsOf(t, id),
    queryFn: () => get<Tag[]>(`/studio/tags/of/${t}/${id}`),
    ...opts,
  });

export function useTagMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["studio", "tags"] });
  return {
    create: useMutation({
      mutationFn: (b: { slug: string; name: string; color?: string | null }) =>
        send<Tag>("/studio/tags", "POST", b),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<Tag>(`/studio/tags/${id}`, "PATCH", b),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => send<void>(`/studio/tags/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
    assign: useMutation({
      mutationFn: (b: {
        target_type: RefType;
        target_id: string;
        tag_ids: string[];
      }) => send<{ tag_ids: string[] }>("/studio/tags/assign", "PUT", b),
      onSuccess: (_d, v) => {
        void invalidate();
        void qc.invalidateQueries({
          queryKey: ["studio", "tagsOf", v.target_type, v.target_id],
        });
      },
    }),
  };
}

// --- Colecciones ---------------------------------------------------

export const useCollections = (lang: Lang) =>
  useQuery({
    queryKey: keys.collections(lang),
    queryFn: () => get<Collection[]>(`/studio/collections${qs({ lang })}`),
  });

export const useCollection = (id: string, lang: Lang, opts?: Opts<Collection>) =>
  useQuery({
    queryKey: keys.collection(id, lang),
    queryFn: () => get<Collection>(`/studio/collections/${id}${qs({ lang })}`),
    ...opts,
  });

export function useCollectionMutations(lang: Lang) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["studio", "collections"] });
  const invalidateOne = (id: string) =>
    qc.invalidateQueries({ queryKey: ["studio", "collection", id] });
  return {
    create: useMutation({
      mutationFn: (b: Record<string, unknown>) =>
        send<Collection>("/studio/collections", "POST", { ...b, lang }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<Collection>(`/studio/collections/${id}`, "PATCH", { ...b, lang }),
      onSuccess: (_d, v) => {
        void invalidate();
        void invalidateOne(v.id);
      },
    }),
    setItems: useMutation({
      mutationFn: ({
        id,
        items,
      }: {
        id: string;
        items: { target_type: RefType; target_id: string }[];
      }) => send<Collection>(`/studio/collections/${id}/items`, "PUT", { items }),
      onSuccess: (_d, v) => {
        void invalidate();
        void invalidateOne(v.id);
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) =>
        send<void>(`/studio/collections/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
  };
}

// --- Biblioteca de medios --------------------------------------------

export const useMedia = (familia: string, buscar: string) =>
  useQuery({
    queryKey: keys.media(familia, buscar),
    queryFn: () =>
      get<MediaList>(
        `/studio/media/assets${qs({ familia, buscar, limit: 100 })}`,
      ),
  });

export function useMediaMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["studio", "media"] });
  return {
    /** Sube directo al bucket con URL prefirmada y registra la clave. El
     *  binario NO pasa por el backend (arquitectura.md §7). */
    upload: useMutation({
      mutationFn: async ({ file, alt }: { file: File; alt: string }) => {
        const presign = await send<{
          upload_url: string;
          s3_key: string;
        }>("/studio/media/presign", "POST", {
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        });
        const put = await fetch(presign.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error("La subida al bucket falló");
        return send<{ id: string; url: string }>(
          "/studio/media/register",
          "POST",
          {
            s3_key: presign.s3_key,
            mime_type: file.type,
            size_bytes: file.size,
            original_filename: file.name,
            alt_text: alt,
          },
        );
      },
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) =>
        send<void>(`/studio/media/assets/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
  };
}
