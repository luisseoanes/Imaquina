/** Acceso HTTP del panel de administración.
 *
 *  Hooks a mano sobre `httpClient` + TanStack Query. Endpoints (guard `Admin`
 *  salvo donde se indique):
 *  - GET   /admin/users
 *  - POST  /admin/users
 *  - PATCH /admin/users/{id}
 *  - POST  /admin/users/{id}/reset-password
 *  - GET   /courses                         (Staff)
 *  - POST  /courses
 *  - GET   /courses/{id}/students           (Staff)
 *  - POST/DELETE /courses/{id}/enrollments
 *  - GET   /studio/assistant/rejections     (Staff)
 *  - GET   /studio/dashboard                (Author) — sólo para KPIs
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";

import httpClient from "@/shared/api/httpClient";
import { tokens } from "@/shared/api/tokens";
import { env } from "@/shared/config/env";
import type { Role } from "@/shared/config/roles";

const BASE = env.apiBaseUrl;
const get = <T,>(path: string) => httpClient<T>(`${BASE}${path}`);
const send = <T,>(path: string, method: string, body?: unknown) =>
  httpClient<T>(`${BASE}${path}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

type Opts<T> = Omit<UseQueryOptions<T>, "queryKey" | "queryFn">;

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  grade: string | null;
  is_active: boolean;
}

export interface AdminCourse {
  id: string;
  name: string;
  grade: string;
  teacher_id: string | null;
}

export interface Rejection {
  id: string;
  content: string;
  created_at: string;
}

export interface DashboardData {
  content: {
    projects: { total: number; published: number };
    lessons: { total: number; published: number };
    resources: number;
    paths: number;
    collections: number;
  };
  students_impacted: number;
  performance: {
    submitted_attempts: number;
    avg_score: number | null;
    completed_moments: number;
  };
}

// --- Usuarios ---------------------------------------------------------------

export const useUsers = () =>
  useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => get<AdminUser[]>("/admin/users"),
  });

export function useUserMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });
  return {
    create: useMutation({
      mutationFn: (b: {
        email: string;
        full_name: string;
        password: string;
        role: string;
        grade?: string | null;
      }) => send<AdminUser>("/admin/users", "POST", b),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) =>
        send<AdminUser>(`/admin/users/${id}`, "PATCH", b),
      onSuccess: invalidate,
    }),
    resetPassword: useMutation({
      mutationFn: (b: { id: string; new_password: string }) =>
        send<void>(`/admin/users/${b.id}/reset-password`, "POST", {
          new_password: b.new_password,
        }),
    }),
  };
}

// --- Cursos y matrículas --------------------------------------------------

export const useCourses = () =>
  useQuery({
    queryKey: ["admin", "courses"],
    queryFn: () => get<AdminCourse[]>("/courses"),
  });

export const useCourseStudents = (courseId: string, opts?: Opts<AdminUser[]>) =>
  useQuery({
    queryKey: ["admin", "course-students", courseId],
    queryFn: () => get<AdminUser[]>(`/courses/${courseId}/students`),
    ...opts,
  });

export function useCourseMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    void qc.invalidateQueries({ queryKey: ["admin", "course-students"] });
  };
  return {
    create: useMutation({
      mutationFn: (b: { name: string; grade: string; teacher_id?: string | null }) =>
        send<AdminCourse>("/courses", "POST", b),
      onSuccess: invalidate,
    }),
    enroll: useMutation({
      mutationFn: (b: { courseId: string; user_id: string }) =>
        send<void>(`/courses/${b.courseId}/enrollments`, "POST", {
          user_id: b.user_id,
        }),
      onSuccess: invalidate,
    }),
    unenroll: useMutation({
      mutationFn: (b: { courseId: string; userId: string }) =>
        send<void>(
          `/courses/${b.courseId}/enrollments/${b.userId}`,
          "DELETE",
        ),
      onSuccess: invalidate,
    }),
  };
}

// --- Supervisión y KPIs -------------------------------------------------

export const useRejections = () =>
  useQuery({
    queryKey: ["admin", "rejections"],
    queryFn: () => get<Rejection[]>("/studio/assistant/rejections?limit=100"),
  });

export const useAdminDashboard = () =>
  useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => get<DashboardData>("/studio/dashboard"),
  });

// --- Cuenta propia ----------------------------------------------------------

/** Cambiar la contraseña propia. El backend devuelve un par de tokens NUEVO
 *  (cambiarla revoca los refresh anteriores) y hay que guardarlo o el próximo
 *  refresco cierra la sesión. */
export const useChangeOwnPassword = () =>
  useMutation({
    mutationFn: async (b: { current_password: string; new_password: string }) => {
      const res = await send<{ access_token: string; refresh_token: string }>(
        "/auth/me/password",
        "POST",
        b,
      );
      tokens.set(res);
      return res;
    },
  });
