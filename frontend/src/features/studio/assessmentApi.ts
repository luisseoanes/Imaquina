/** Evaluación (A1, A10): constructor de preguntas dentro del Studio. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/lib/http";
import type { Lang } from "./api";

const BASE = "/studio/assessment";

export type QuestionKind = "mcq" | "true_false" | "open" | "numeric";

export interface Choice {
  id: string;
  order: number;
  is_correct: boolean;
  label: string | null;
}

export interface Question {
  id: string;
  kind: QuestionKind;
  order: number;
  points: number;
  correct_numeric: number | null;
  prompt: string | null;
  choices: Choice[];
}

export interface AssessmentDetail {
  id: string;
  moment_id: string;
  max_attempts: number;
  pass_score: number;
  team_mode: boolean;
  questions: Question[];
}

export function useAssessment(momentId: string, lang: Lang) {
  return useQuery({
    queryKey: ["studio", "assessment", momentId, lang],
    queryFn: () =>
      http<AssessmentDetail>({ url: `${BASE}/moments/${momentId}`, params: { lang } }),
    enabled: !!momentId,
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["studio", "assessment"] });
}

export function useUpdateAssessment(momentId: string, lang: Lang) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      max_attempts?: number;
      pass_score?: number;
      team_mode?: boolean;
    }) => http<AssessmentDetail>({ url: `${BASE}/${id}`, method: "PATCH", data: { ...data, lang } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "assessment", momentId, lang] }),
  });
}

export function useCreateQuestion(assessmentId: string, lang: Lang) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      kind: QuestionKind;
      prompt?: string;
      points?: number;
      correct_numeric?: number | null;
      choices?: { label: string; is_correct: boolean }[];
    }) =>
      http<Question>({
        url: `${BASE}/${assessmentId}/questions`,
        method: "POST",
        data: { ...data, lang },
      }),
    onSuccess: () => invalidar(qc),
  });
}

export function useUpdateQuestion(lang: Lang) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      prompt?: string;
      points?: number;
      correct_numeric?: number | null;
    }) => http<Question>({ url: `${BASE}/questions/${id}`, method: "PATCH", data: { ...data, lang } }),
    onSuccess: () => invalidar(qc),
  });
}

export function useDeleteQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http<void>({ url: `${BASE}/questions/${id}`, method: "DELETE" }),
    onSuccess: () => invalidar(qc),
  });
}

export function useReorderQuestions(assessmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionIds: string[]) =>
      http<AssessmentDetail>({
        url: `${BASE}/${assessmentId}/questions/order`,
        method: "PUT",
        data: { question_ids: questionIds },
      }),
    onSuccess: () => invalidar(qc),
  });
}

export function useAddChoice(lang: Lang) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, ...data }: { questionId: string; label: string; is_correct: boolean }) =>
      http<Choice>({
        url: `${BASE}/questions/${questionId}/choices`,
        method: "POST",
        data: { ...data, lang },
      }),
    onSuccess: () => invalidar(qc),
  });
}

export function useUpdateChoice(lang: Lang) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; label?: string; is_correct?: boolean }) =>
      http<Choice>({ url: `${BASE}/choices/${id}`, method: "PATCH", data: { ...data, lang } }),
    onSuccess: () => invalidar(qc),
  });
}

export function useDeleteChoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http<void>({ url: `${BASE}/choices/${id}`, method: "DELETE" }),
    onSuccess: () => invalidar(qc),
  });
}

// --- Tablero docente (A5, A9) ------------------------------------------

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

export function useAttempts(assessmentId: string) {
  return useQuery({
    queryKey: ["studio", "assessment", "attempts", assessmentId],
    queryFn: () => http<Attempt[]>({ url: `${BASE}/${assessmentId}/attempts` }),
    enabled: !!assessmentId,
  });
}

export function useGradeAnswer(assessmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      teacher_score: number;
      teacher_feedback?: string;
    }) => http<Attempt>({ url: `${BASE}/answers/${id}`, method: "PATCH", data }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["studio", "assessment", "attempts", assessmentId] }),
  });
}

export function useTriggerExport(assessmentId: string) {
  return useMutation({
    mutationFn: () => http<{ status: string }>({ url: `${BASE}/${assessmentId}/export`, method: "POST" }),
  });
}

export function useExportStatus(assessmentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["studio", "assessment", "export", assessmentId],
    queryFn: () =>
      http<{ status: string; url?: string }>({ url: `${BASE}/${assessmentId}/export` }),
    enabled,
    refetchInterval: (query) => (query.state.data?.status === "listo" ? false : 2000),
  });
}
