/** Evaluación del estudiante (A2, A8). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/lib/http";

const BASE = "/learn/assessments";

export interface StudentChoice {
  id: string;
  order: number;
  label: string | null;
}

export interface StudentQuestion {
  id: string;
  kind: "mcq" | "true_false" | "open" | "numeric";
  order: number;
  points: number;
  prompt: string | null;
  choices: StudentChoice[];
}

export interface StudentAssessment {
  id: string;
  max_attempts: number;
  team_mode: boolean;
  questions: StudentQuestion[];
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

export function useStudentAssessment(momentId: string) {
  return useQuery({
    queryKey: ["assessment", "moment", momentId],
    queryFn: () => http<StudentAssessment>({ url: `${BASE}/moments/${momentId}` }),
    enabled: !!momentId,
    retry: false,
  });
}

export function useMyAttempts(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ["assessment", "mine", assessmentId],
    queryFn: () => http<Attempt[]>({ url: `${BASE}/${assessmentId}/attempts/mine` }),
    enabled: !!assessmentId,
  });
}

export function useStartAttempt(assessmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamLabel?: string) =>
      http<Attempt>({
        url: `${BASE}/${assessmentId}/attempts`,
        method: "POST",
        data: { team_label: teamLabel ?? null },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment", "mine", assessmentId] }),
  });
}

export function useSaveAnswers(attemptId: string) {
  return useMutation({
    mutationFn: (answers: Partial<Answer>[]) =>
      http<Attempt>({
        url: `${BASE}/attempts/${attemptId}/answers`,
        method: "PATCH",
        data: { answers },
      }),
  });
}

export function useSubmitAttempt(assessmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attemptId: string) =>
      http<Attempt>({ url: `${BASE}/attempts/${attemptId}/submit`, method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment", "mine", assessmentId] }),
  });
}
