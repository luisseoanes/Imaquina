/** Acceso HTTP del panel del docente.
 *
 *  Hooks a mano sobre `httpClient` + TanStack Query, igual que el Studio: el
 *  cliente de orval está gitignored y rompería un clon recién hecho.
 *
 *  Endpoints del backend que consume, todos con guard `Staff` o `Tenant`:
 *  - GET  /courses?mine=true
 *  - GET  /courses/{id}/students
 *  - GET  /learn/projects
 *  - GET  /learn/projects/{id}
 *  - GET  /learn/projects/{id}/moments/{type}
 *  - GET  /learn/teacher/courses/{id}/progress?project_id=
 *  - GET  /studio/assessment/moments/{momentId}/review
 *  - PATCH /studio/assessment/answers/{answerId}
 *  - POST/GET /studio/assessment/{assessmentId}/export
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";

import httpClient from "@/shared/api/httpClient";
import { env } from "@/shared/config/env";
import type { Lang } from "@/shared/config/roles";

const BASE = env.apiBaseUrl;

function qs(params: Record<string, string | undefined>): string {
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

// --- Tipos --------------------------------------------------------------

export interface Course {
  id: string;
  name: string;
  grade: string;
  teacher_id: string | null;
}

export interface Student {
  id: string;
  email: string;
  full_name: string;
  role: string;
  grade: string | null;
  is_active: boolean;
}

export interface PublishedProject {
  id: string;
  slug: string;
  grade: string;
  title: string;
  summary: string | null;
  lang: Lang;
}

export interface TeacherBlock {
  id: string;
  kind: "text" | "image" | "audio" | "video" | "embed";
  order: number;
  media_asset_id: string | null;
  body: string | null;
  caption: string | null;
  alt_text: string | null;
}

export interface TeacherMoment {
  id: string;
  type: string;
  order: number;
  title: string | null;
  teacher_note: string | null;
  chatbot_opening_prompt: string | null;
  blocks: TeacherBlock[];
  lang?: Lang;
}

export interface PublishedProjectDetail {
  id: string;
  slug: string;
  grade: string;
  kit: string | null;
  lang: Lang;
  langs: Lang[];
  title: string;
  summary: string | null;
  moments: TeacherMoment[];
}

export type ProgressState = "not_started" | "in_progress" | "completed";

export interface CourseProgressRow {
  user_id: string;
  full_name: string;
  progress: Record<string, ProgressState>;
}

export interface ReviewChoice {
  id: string;
  order: number;
  is_correct: boolean;
  label: string | null;
}
export interface ReviewQuestion {
  id: string;
  kind: "mcq" | "true_false" | "open" | "numeric";
  order: number;
  points: number;
  correct_numeric: number | null;
  prompt: string | null;
  choices: ReviewChoice[];
}
export interface ReviewAnswer {
  id: string;
  question_id: string;
  choice_id: string | null;
  value_text: string | null;
  value_numeric: number | null;
  is_correct: boolean | null;
  teacher_score: number | null;
  teacher_feedback: string | null;
}
export interface ReviewAttempt {
  id: string;
  assessment_id: string;
  student_id: string;
  student_name: string;
  status: "in_progress" | "submitted" | "graded";
  score: number | null;
  team_label: string | null;
  submitted_at: string | null;
  answers: ReviewAnswer[];
}
export interface AssessmentReview {
  assessment: {
    id: string;
    moment_id: string;
    max_attempts: number;
    pass_score: number;
    team_mode: boolean;
    questions: ReviewQuestion[];
  };
  attempts: ReviewAttempt[];
}

// --- Hooks -------------------------------------------------------------

export const useCourses = () =>
  useQuery({
    queryKey: ["teacher", "courses"],
    queryFn: () => get<Course[]>("/courses?mine=true"),
  });

export const useCourseStudents = (courseId: string, opts?: Opts<Student[]>) =>
  useQuery({
    queryKey: ["teacher", "course-students", courseId],
    queryFn: () => get<Student[]>(`/courses/${courseId}/students`),
    ...opts,
  });

export const usePublishedProjects = (lang: Lang) =>
  useQuery({
    queryKey: ["teacher", "projects", lang],
    queryFn: () => get<PublishedProject[]>(`/learn/projects${qs({ lang })}`),
  });

export const usePublishedProject = (
  id: string,
  lang: Lang,
  opts?: Opts<PublishedProjectDetail>,
) =>
  useQuery({
    queryKey: ["teacher", "project", id, lang],
    queryFn: () =>
      get<PublishedProjectDetail>(`/learn/projects/${id}${qs({ lang })}`),
    ...opts,
  });

export const useCourseProgress = (
  courseId: string,
  projectId: string,
  opts?: Opts<CourseProgressRow[]>,
) =>
  useQuery({
    queryKey: ["teacher", "course-progress", courseId, projectId],
    queryFn: () =>
      get<CourseProgressRow[]>(
        `/learn/teacher/courses/${courseId}/progress${qs({ project_id: projectId })}`,
      ),
    ...opts,
  });

export const useAssessmentReview = (
  momentId: string,
  lang: Lang,
  opts?: Opts<AssessmentReview>,
) =>
  useQuery({
    queryKey: ["teacher", "review", momentId, lang],
    queryFn: () =>
      get<AssessmentReview>(
        `/studio/assessment/moments/${momentId}/review${qs({ lang })}`,
      ),
    ...opts,
  });

export function useGrading(momentId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["teacher", "review", momentId] });
  return {
    grade: useMutation({
      mutationFn: (b: {
        answer_id: string;
        teacher_score: number;
        teacher_feedback?: string | null;
      }) =>
        send<unknown>(`/studio/assessment/answers/${b.answer_id}`, "PATCH", {
          teacher_score: b.teacher_score,
          teacher_feedback: b.teacher_feedback ?? null,
        }),
      onSuccess: invalidate,
    }),
    requestExport: useMutation({
      mutationFn: (assessmentId: string) =>
        send<{ status: string }>(
          `/studio/assessment/${assessmentId}/export`,
          "POST",
        ),
    }),
  };
}

export const useExportStatus = (assessmentId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["teacher", "export", assessmentId],
    queryFn: () =>
      get<{ status: string; url?: string }>(
        `/studio/assessment/${assessmentId}/export`,
      ),
    enabled,
    refetchInterval: (q) =>
      q.state.data?.status === "listo" ? false : 2500,
  });

// --- Asignaciones -----------------------------------------------------------

export interface Assignment {
  id: string;
  course_id: string;
  course_name: string;
  project_id: string;
  project_title: string;
  title: string;
  instructions: string | null;
  due_at: string | null;
  is_published: boolean;
  created_at: string;
}

export interface TrackingRow {
  user_id: string;
  full_name: string;
  completed_moments: number;
  total_moments: number;
  status: "completed" | "in_progress" | "not_started";
  timeliness: "done" | "pending" | "late" | "no_due";
}

export const useAssignments = () =>
  useQuery({
    queryKey: ["teacher", "assignments"],
    queryFn: () => get<Assignment[]>("/assignments"),
  });

export const useAssignmentTracking = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ["teacher", "assignment-tracking", id],
    queryFn: () =>
      get<{
        assignment: { id: string; title: string; due_at: string | null };
        rows: TrackingRow[];
      }>(`/assignments/${id}/tracking`),
    enabled,
  });

export function useAssignmentMutations() {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["teacher", "assignments"] });
  return {
    create: useMutation({
      mutationFn: (b: {
        course_ids: string[];
        project_id: string;
        title: string;
        instructions?: string | null;
        due_at?: string | null;
        is_published?: boolean;
      }) => send<Assignment[]>("/assignments", "POST", b),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<Assignment>(`/assignments/${id}`, "PATCH", b),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => send<void>(`/assignments/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
  };
}
