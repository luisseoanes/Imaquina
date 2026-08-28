/** Acceso HTTP del panel del estudiante.
 *
 *  Hooks a mano sobre `httpClient` + TanStack Query, igual que el Studio y el
 *  panel del docente. El chat es la excepción: responde SSE y va por
 *  `shared/api/streamChat`.
 *
 *  Endpoints que consume, todos con guard `Tenant` (los ve cualquier sesión):
 *  - GET    /learn/projects?lang=&grade=
 *  - GET    /learn/projects/{id}?lang=
 *  - GET    /learn/projects/{id}/moments/{type}?lang=
 *  - GET    /learn/projects/{id}/progress
 *  - POST   /learn/projects/{id}/moments/{type}/complete
 *  - GET    /learn/assessments/moments/{momentId}?lang=
 *  - GET    /learn/assessments/{id}/attempts/mine
 *  - POST   /learn/assessments/{id}/attempts
 *  - PATCH  /learn/assessments/attempts/{id}/answers
 *  - POST   /learn/assessments/attempts/{id}/submit
 *  - GET    /chat/sessions?moment_id=   ·   POST /chat/sessions
 *  - GET    /chat/sessions/{id}/messages
 *
 *  **No hay endpoint de "mis cursos"**: `GET /courses` tiene guard `Staff`, así
 *  que un estudiante no puede listar los suyos. Lo que ve es el catálogo
 *  publicado filtrado por su grado, que es lo que el backend sí le ofrece.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";

import httpClient from "@/shared/api/httpClient";
import { env } from "@/shared/config/env";
import type { Lang, MomentType } from "@/shared/config/roles";

const BASE = env.apiBaseUrl;

function qs(params: Record<string, string | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const get = <T,>(path: string) => httpClient<T>(`${BASE}${path}`);
const send = <T,>(path: string, method: string, body?: unknown) =>
  httpClient<T>(`${BASE}${path}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

type Opts<T> = Omit<UseQueryOptions<T>, "queryKey" | "queryFn">;

/** Claves de caché en un solo sitio: invalidar por prefijo es fiable. */
export const keys = {
  projects: (lang: Lang, grade?: string | null) =>
    ["student", "projects", lang, grade ?? null] as const,
  project: (id: string, lang: Lang) => ["student", "project", id, lang] as const,
  moment: (projectId: string, type: string, lang: Lang) =>
    ["student", "moment", projectId, type, lang] as const,
  progress: (projectId: string) => ["student", "progress", projectId] as const,
  assessment: (momentId: string, lang: Lang) =>
    ["student", "assessment", momentId, lang] as const,
  attempts: (assessmentId: string) => ["student", "attempts", assessmentId] as const,
  chatSessions: (momentId: string) => ["student", "chat", "sessions", momentId] as const,
  chatMessages: (sessionId: string) => ["student", "chat", "messages", sessionId] as const,
};

// --- Tipos -----------------------------------------------------------------

export type BlockKind = "text" | "image" | "audio" | "video" | "embed";

export interface Block {
  id: string;
  kind: BlockKind;
  order: number;
  media_asset_id: string | null;
  /** Ajustes que no dependen del idioma (proveedor de embed, etc.). */
  config?: Record<string, unknown>;
  body: string | null;
  caption: string | null;
  alt_text: string | null;
  /** Resueltos por el backend al servir; `null` si el asset ya no existe. */
  url?: string | null;
  mime_type?: string | null;
  duration_seconds?: number | null;
}

export interface Moment {
  id: string;
  type: MomentType;
  order: number;
  title: string | null;
  chatbot_opening_prompt: string | null;
  blocks: Block[];
  lang?: Lang;
  /** Nunca llega al estudiante: el backend la filtra en `serialize_moment_for`.
   *  Se declara para que el tipo describa el contrato real, no para leerla. */
  teacher_note?: never;
}

export interface ProjectCard {
  id: string;
  slug: string;
  grade: string;
  title: string;
  summary: string | null;
  lang: Lang;
}

export interface ProjectDetail extends ProjectCard {
  kit: string | null;
  langs: Lang[];
  moments: Moment[];
}

export type ProgressState = "not_started" | "in_progress" | "completed";
export type ProgressMap = Partial<Record<MomentType, ProgressState>>;

export interface Choice {
  id: string;
  order: number;
  label: string | null;
}

export interface Question {
  id: string;
  kind: "mcq" | "true_false" | "open" | "numeric";
  order: number;
  points: number;
  prompt: string | null;
  choices: Choice[];
}

export interface StudentAssessment {
  id: string;
  max_attempts: number;
  team_mode: boolean;
  questions: Question[];
}

export interface Answer {
  id: string;
  question_id: string;
  choice_id: string | null;
  value_text: string | null;
  value_numeric: number | null;
  is_correct: boolean | null;
  teacher_score: number | null;
  teacher_feedback: string | null;
}

export interface Attempt {
  id: string;
  assessment_id: string;
  status: "in_progress" | "submitted" | "graded";
  score: number | null;
  team_label: string | null;
  submitted_at: string | null;
  answers: Answer[];
}

export interface ChatSession {
  id: string;
  moment_id: string | null;
  lang: Lang;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// --- Contenido -------------------------------------------------------------

export const useProjects = (lang: Lang, grade?: string | null) =>
  useQuery({
    queryKey: keys.projects(lang, grade),
    queryFn: () => get<ProjectCard[]>(`/learn/projects${qs({ lang, grade })}`),
  });

export const useProject = (id: string, lang: Lang, opts?: Opts<ProjectDetail>) =>
  useQuery({
    queryKey: keys.project(id, lang),
    queryFn: () => get<ProjectDetail>(`/learn/projects/${id}${qs({ lang })}`),
    ...opts,
  });

/** Un momento concreto. El backend devuelve **403** si el anterior no está
 *  completado (progreso lineal, N5): no se reintenta, porque no es un fallo
 *  transitorio sino la respuesta correcta a estar bloqueado. */
export const useMoment = (
  projectId: string,
  type: string,
  lang: Lang,
  opts?: Opts<Moment>,
) =>
  useQuery({
    queryKey: keys.moment(projectId, type, lang),
    queryFn: () =>
      get<Moment>(`/learn/projects/${projectId}/moments/${type}${qs({ lang })}`),
    retry: false,
    ...opts,
  });

export const useProgress = (projectId: string, opts?: Opts<ProgressMap>) =>
  useQuery({
    queryKey: keys.progress(projectId),
    queryFn: () => get<ProgressMap>(`/learn/projects/${projectId}/progress`),
    ...opts,
  });

/** Completar desbloquea el siguiente momento, así que hay que invalidar el
 *  progreso Y el momento siguiente: si su 403 se queda en caché, el estudiante
 *  ve "bloqueado" en la pantalla que acaba de desbloquear. */
export function useCompleteMoment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: string) =>
      send<void>(`/learn/projects/${projectId}/moments/${type}/complete`, "POST"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.progress(projectId) });
      void qc.invalidateQueries({ queryKey: ["student", "moment", projectId] });
    },
  });
}

// --- Evaluación (R10) ------------------------------------------------------

export const useAssessment = (
  momentId: string,
  lang: Lang,
  opts?: Opts<StudentAssessment>,
) =>
  useQuery({
    queryKey: keys.assessment(momentId, lang),
    queryFn: () =>
      get<StudentAssessment>(`/learn/assessments/moments/${momentId}${qs({ lang })}`),
    // Un momento `assess` sin evaluación construida da 404, que es un estado
    // normal del contenido y no algo que reintentar.
    retry: false,
    ...opts,
  });

export const useMyAttempts = (assessmentId: string, opts?: Opts<Attempt[]>) =>
  useQuery({
    queryKey: keys.attempts(assessmentId),
    queryFn: () => get<Attempt[]>(`/learn/assessments/${assessmentId}/attempts/mine`),
    ...opts,
  });

export interface AnswerInput {
  question_id: string;
  choice_id?: string | null;
  value_text?: string | null;
  value_numeric?: number | null;
}

export function useAttemptMutations(assessmentId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: keys.attempts(assessmentId) });

  return {
    start: useMutation({
      mutationFn: (team_label?: string | null) =>
        send<Attempt>(`/learn/assessments/${assessmentId}/attempts`, "POST", {
          team_label: team_label ?? null,
        }),
      onSuccess: invalidate,
    }),
    // Guardado parcial: se puede llamar tantas veces como haga falta mientras
    // el intento siga abierto. No invalida — reescribiría el formulario que el
    // estudiante está rellenando.
    save: useMutation({
      mutationFn: ({ attemptId, answers }: { attemptId: string; answers: AnswerInput[] }) =>
        send<Attempt>(
          `/learn/assessments/attempts/${attemptId}/answers`,
          "PATCH",
          { answers },
        ),
    }),
    submit: useMutation({
      mutationFn: (attemptId: string) =>
        send<Attempt>(`/learn/assessments/attempts/${attemptId}/submit`, "POST"),
      onSuccess: invalidate,
    }),
  };
}

// --- Chat (R5, R8) ---------------------------------------------------------

export const useChatSessions = (momentId: string, opts?: Opts<ChatSession[]>) =>
  useQuery({
    queryKey: keys.chatSessions(momentId),
    queryFn: () => get<ChatSession[]>(`/chat/sessions${qs({ moment_id: momentId })}`),
    ...opts,
  });

export const useChatMessages = (sessionId: string, opts?: Opts<ChatMessage[]>) =>
  useQuery({
    queryKey: keys.chatMessages(sessionId),
    queryFn: () => get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`),
    ...opts,
  });

export const startChatSession = (momentId: string, lang: Lang) =>
  send<{ session_id: string }>("/chat/sessions", "POST", {
    moment_id: momentId,
    lang,
  });
