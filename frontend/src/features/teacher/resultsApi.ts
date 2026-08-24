/** Tablero de resultados y export (A5, A9). Duplicado pequeño y deliberado de
 *  lo que ya existe en `features/studio/assessmentApi.ts`: ese vive detrás
 *  del guard de autoría y un docente sin rol editor/admin no entra al Studio,
 *  así que el panel docente necesita su propia copia de estos hooks. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/lib/http";

export interface Answer {
  id: string;
  question_id: string;
  is_correct: boolean | null;
  value_text: string | null;
  teacher_score: number | null;
  teacher_feedback: string | null;
}

export interface Attempt {
  id: string;
  status: "in_progress" | "submitted" | "graded";
  score: number | null;
  team_label: string | null;
  submitted_at: string | null;
  answers: Answer[];
}

export function useAssessmentIdForMoment(momentId: string | null) {
  return useQuery({
    queryKey: ["teacher", "assessment-id", momentId],
    queryFn: () => http<{ id: string }>({ url: `/learn/assessments/moments/${momentId}` }),
    enabled: !!momentId,
    retry: false,
  });
}

export function useAttempts(assessmentId: string | null) {
  return useQuery({
    queryKey: ["teacher", "attempts", assessmentId],
    queryFn: () => http<Attempt[]>({ url: `/studio/assessment/${assessmentId}/attempts` }),
    enabled: !!assessmentId,
  });
}

export function useGradeAnswer(assessmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; teacher_score: number; teacher_feedback?: string }) =>
      http<Attempt>({ url: `/studio/assessment/answers/${id}`, method: "PATCH", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher", "attempts", assessmentId] }),
  });
}

export function useTriggerExport(assessmentId: string) {
  return useMutation({
    mutationFn: () =>
      http<{ status: string }>({ url: `/studio/assessment/${assessmentId}/export`, method: "POST" }),
  });
}

export function useExportStatus(assessmentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["teacher", "export", assessmentId],
    queryFn: () =>
      http<{ status: string; url?: string }>({ url: `/studio/assessment/${assessmentId}/export` }),
    enabled,
    refetchInterval: (query) => (query.state.data?.status === "listo" ? false : 2000),
  });
}
