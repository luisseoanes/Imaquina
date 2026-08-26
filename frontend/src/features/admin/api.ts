/** Alta de cuentas y cursos (N3, N4). Hooks a mano sobre `http()`, mismo
 *  patrón que `features/studio/api.ts`. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/lib/http";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  grade: string | null;
  is_active: boolean;
}

export interface Course {
  id: string;
  name: string;
  grade: string;
  teacher_id: string | null;
}

export function useUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => http<AdminUser[]>({ url: "/admin/users" }),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      email: string;
      full_name: string;
      password: string;
      role: string;
      grade?: string;
    }) => http<AdminUser>({ url: "/admin/users", method: "POST", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      http<AdminUser>({ url: `/admin/users/${id}`, method: "PATCH", data: { is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

/** Restablecer la contraseña de una cuenta (N15). No invalida `users`: la
 *  respuesta es 204 y ningún campo de la lista cambia. */
export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, new_password }: { id: string; new_password: string }) =>
      http<void>({
        url: `/admin/users/${id}/reset-password`,
        method: "POST",
        data: { new_password },
      }),
  });
}

export function useCourses() {
  return useQuery({
    queryKey: ["admin", "courses"],
    queryFn: () => http<Course[]>({ url: "/courses" }),
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; grade: string; teacher_id?: string | null }) =>
      http<Course>({ url: "/courses", method: "POST", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "courses"] }),
  });
}

export function useEnroll(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      http<void>({
        url: `/courses/${courseId}/enrollments`,
        method: "POST",
        data: { user_id: userId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "course-students", courseId] }),
  });
}

export function useUnenroll(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      http<void>({ url: `/courses/${courseId}/enrollments/${userId}`, method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "course-students", courseId] }),
  });
}

export function useCourseStudents(courseId: string | null) {
  return useQuery({
    queryKey: ["admin", "course-students", courseId],
    queryFn: () => http<AdminUser[]>({ url: `/courses/${courseId}/students` }),
    enabled: !!courseId,
  });
}
