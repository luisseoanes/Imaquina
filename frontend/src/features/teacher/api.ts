/** Panel docente (N6): progreso por momento de cada matriculado. */
import { useQuery } from "@tanstack/react-query";

import { http } from "@/lib/http";

export interface Course {
  id: string;
  name: string;
  grade: string;
}

export interface Project {
  id: string;
  slug: string;
  grade: string;
  title: string;
}

export interface StudentProgress {
  user_id: string;
  full_name: string;
  progress: Record<string, string>;
}

export function useMyCourses() {
  return useQuery({
    queryKey: ["teacher", "courses"],
    queryFn: () => http<Course[]>({ url: "/courses", params: { mine: "true" } }),
  });
}

export function usePublishedProjects() {
  return useQuery({
    queryKey: ["teacher", "projects"],
    queryFn: () => http<Project[]>({ url: "/learn/projects" }),
  });
}

interface MomentRef {
  id: string;
  type: string;
}

/** Solo para encontrar el `moment_id` del momento `assess` (A9) -- no se
 *  usa nada más de esta forma. */
export function useProjectMoments(projectId: string | null) {
  return useQuery({
    queryKey: ["teacher", "project-moments", projectId],
    queryFn: () => http<{ moments: MomentRef[] }>({ url: `/learn/projects/${projectId}` }),
    enabled: !!projectId,
  });
}

export function useCourseProgress(courseId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: ["teacher", "progress", courseId, projectId],
    queryFn: () =>
      http<StudentProgress[]>({
        url: `/learn/teacher/courses/${courseId}/progress`,
        params: { project_id: projectId ?? undefined },
      }),
    enabled: !!courseId && !!projectId,
  });
}
