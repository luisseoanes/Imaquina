import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  PastelBadge,
  QueryState,
  Select,
  TextInput,
} from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import {
  useAssessmentReview,
  useExportStatus,
  useGrading,
  usePublishedProject,
  usePublishedProjects,
} from "../api";
import type { ReviewAttempt, ReviewQuestion } from "../api";
import { useTeacher } from "../TeacherContext";

export function GradingView() {
  const { t } = useTranslation();
  const { lang } = useTeacher();
  const projects = usePublishedProjects(lang);
  const [projectId, setProjectId] = useState("");
  const project = usePublishedProject(projectId, lang, { enabled: !!projectId });
  const momentId = project.data?.moments.find((m) => m.type === "assess")?.id ?? "";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t("teacher.nav.grading")}
        description={t("teacher.grading.subtitle")}
        actions={
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t("teacher.grading.pickProject")}</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        }
      />
      {!projectId ? (
        <p className="text-sm text-content-muted">{t("teacher.grading.pickHint")}</p>
      ) : !momentId ? (
        <QueryState isLoading={project.isLoading} error={project.error}>
          <p className="text-sm text-content-muted">{t("teacher.grading.noAssessment")}</p>
        </QueryState>
      ) : (
        <Review momentId={momentId} />
      )}
    </div>
  );
}

function Review({ momentId }: { momentId: string }) {
  const { t } = useTranslation();
  const { lang } = useTeacher();
  const { data, isLoading, error } = useAssessmentReview(momentId, lang);
  const grading = useGrading(momentId);
  const [exporting, setExporting] = useState(false);
  const assessmentId = data?.assessment.id ?? "";
  const exportStatus = useExportStatus(assessmentId, exporting && !!assessmentId);

  const questions = useMemo(
    () => new Map((data?.assessment.questions ?? []).map((q) => [q.id, q])),
    [data],
  );

  const doExport = async () => {
    await grading.requestExport.mutateAsync(assessmentId);
    setExporting(true);
  };

  return (
    <QueryState isLoading={isLoading} error={error}>
      {data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/60 bg-surface p-4 shadow-card">
            <div className="text-sm text-content-muted">
              {t("teacher.grading.attemptCount", { count: data.attempts.length })}
              {" · "}
              {t("teacher.grading.passScore", { score: data.assessment.pass_score })}
            </div>
            <div className="flex items-center gap-2">
              {exportStatus.data?.status === "listo" && exportStatus.data.url ? (
                <a
                  href={exportStatus.data.url}
                  className="inline-flex items-center gap-1.5 rounded-control bg-success-surface px-3.5 py-2 text-sm font-semibold text-success"
                >
                  <Icon name="arrow-right" className="h-4 w-4" />
                  {t("teacher.grading.download")}
                </a>
              ) : (
                <Button onClick={() => void doExport()} disabled={grading.requestExport.isPending || exporting}>
                  {exporting ? t("teacher.grading.exporting") : t("teacher.grading.export")}
                </Button>
              )}
            </div>
          </div>

          {data.attempts.length === 0 ? (
            <EmptyState message={t("teacher.grading.noAttempts")} />
          ) : (
            data.attempts.map((a) => (
              <AttemptCard key={a.id} attempt={a} questions={questions} grading={grading} />
            ))
          )}
        </div>
      ) : null}
    </QueryState>
  );
}

function AttemptCard({
  attempt,
  questions,
  grading,
}: {
  attempt: ReviewAttempt;
  questions: Map<string, ReviewQuestion>;
  grading: ReturnType<typeof useGrading>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{attempt.student_name}</p>
          <p className="text-xs text-content-subtle">
            {attempt.team_label ? `${attempt.team_label} · ` : ""}
            {attempt.submitted_at
              ? new Date(attempt.submitted_at).toLocaleString()
              : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PastelBadge tone={attempt.status === "graded" ? "success" : "warning"}>
            {t(`teacher.attemptStatus.${attempt.status}`)}
          </PastelBadge>
          <span className="font-display text-lg font-extrabold text-content">
            {attempt.score != null ? Math.round(attempt.score) : "—"}
          </span>
          <Icon
            name="chevron-right"
            className={`h-4 w-4 text-content-subtle transition-transform ${open ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-line/60 p-4">
          {attempt.answers.map((ans) => {
            const q = questions.get(ans.question_id);
            if (!q) return null;
            const choice = q.choices.find((c) => c.id === ans.choice_id);
            const respuesta =
              choice?.label ??
              ans.value_text ??
              (ans.value_numeric != null ? String(ans.value_numeric) : "—");
            const manual = q.kind === "open";
            return (
              <div key={ans.id} className="rounded-xl bg-surface-muted/50 p-3">
                <p className="text-sm font-medium text-content">{q.prompt}</p>
                <p className="mt-1 text-sm text-content-muted">
                  <span className="text-content-subtle">
                    {t("teacher.grading.answer")}:{" "}
                  </span>
                  {respuesta}
                </p>
                {!manual ? (
                  <p className="mt-1 text-xs">
                    {ans.is_correct ? (
                      <span className="text-success">{t("teacher.grading.correct")}</span>
                    ) : (
                      <span className="text-danger">{t("teacher.grading.incorrect")}</span>
                    )}
                    {" · "}
                    {t("teacher.grading.points", { n: q.points })}
                  </p>
                ) : (
                  <ManualGrade
                    answerId={ans.id}
                    max={q.points}
                    current={ans.teacher_score}
                    feedback={ans.teacher_feedback}
                    onSave={(score, fb) =>
                      grading.grade.mutate({
                        answer_id: ans.id,
                        teacher_score: score,
                        teacher_feedback: fb,
                      })
                    }
                    pending={grading.grade.isPending}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}

function ManualGrade({
  answerId,
  max,
  current,
  feedback,
  onSave,
  pending,
}: {
  answerId: string;
  max: number;
  current: number | null;
  feedback: string | null;
  onSave: (score: number, feedback: string | null) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [score, setScore] = useState(current != null ? String(current) : "");
  const [fb, setFb] = useState(feedback ?? "");

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2" key={answerId}>
      <label className="text-xs text-content-subtle">
        {t("teacher.grading.score", { max })}
        <TextInput
          type="number"
          min={0}
          max={max}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="mt-1 w-24"
        />
      </label>
      <label className="min-w-40 flex-1 text-xs text-content-subtle">
        {t("teacher.grading.feedback")}
        <TextInput
          value={fb}
          onChange={(e) => setFb(e.target.value)}
          className="mt-1"
        />
      </label>
      <Button
        onClick={() => onSave(Number(score || 0), fb || null)}
        disabled={pending || score === ""}
      >
        {t("common.save")}
      </Button>
    </div>
  );
}
