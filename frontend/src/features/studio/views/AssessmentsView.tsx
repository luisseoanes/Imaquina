import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useAssessment,
  useAssessmentMutations,
  useProject,
  useProjects,
} from "../api";
import {
  Button,
  Card,
  Field,
  PageHeader,
  QueryState,
  Select,
  TextInput,
} from "@/shared/ui/panel";
import { useStudio } from "../StudioContext";
import {
  QuestionConfigEditor,
  RubricEditor,
} from "../components/QuestionEditors";
import type { Question } from "../types";

const KINDS = [
  "mcq",
  "true_false",
  "open",
  "numeric",
  "ordering",
  "matching",
  "cloze",
] as const;
const KINDS_CONFIG = new Set(["ordering", "matching", "cloze"]);

export function AssessmentsView() {
  const { t } = useTranslation();
  const { lang } = useStudio();
  const projects = useProjects(lang);
  const [projectId, setProjectId] = useState("");
  const project = useProject(projectId, lang, { enabled: !!projectId });
  const assessMoment = project.data?.moments.find((m) => m.type === "assess");

  return (
    <div>
      <PageHeader
        title={t("studio.nav.assessments")}
        description={t("studio.assessments.subtitle")}
        actions={
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t("studio.assessments.pickProject")}</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title ?? p.slug}
              </option>
            ))}
          </Select>
        }
      />
      {!projectId ? (
        <p className="text-sm text-content-muted">
          {t("studio.assessments.pickHint")}
        </p>
      ) : assessMoment ? (
        <AssessmentEditor momentId={assessMoment.id} />
      ) : (
        <QueryState isLoading={project.isLoading} error={project.error}>
          <p className="text-sm text-content-muted">
            {t("studio.assessments.noMoment")}
          </p>
        </QueryState>
      )}
    </div>
  );
}

function AssessmentEditor({ momentId }: { momentId: string }) {
  const { t } = useTranslation();
  const { lang } = useStudio();
  const { data, isLoading, error } = useAssessment(momentId, lang);
  const m = useAssessmentMutations(momentId, lang);

  return (
    <QueryState isLoading={isLoading} error={error}>
      {data ? (
        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-base font-semibold text-content">
              {t("studio.assessments.settings")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("studio.assessments.maxAttempts")}>
                <TextInput
                  type="number"
                  min={1}
                  defaultValue={data.max_attempts}
                  onBlur={(e) =>
                    m.update.mutate({
                      id: data.id,
                      max_attempts: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label={t("studio.assessments.passScore")}>
                <TextInput
                  type="number"
                  defaultValue={data.pass_score}
                  onBlur={(e) =>
                    m.update.mutate({
                      id: data.id,
                      pass_score: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label={t("studio.assessments.teamMode")}>
                <Select
                  defaultValue={data.team_mode ? "1" : "0"}
                  onChange={(e) =>
                    m.update.mutate({
                      id: data.id,
                      team_mode: e.target.value === "1",
                    })
                  }
                >
                  <option value="0">{t("common.cancel")}</option>
                  <option value="1">{t("common.save")}</option>
                </Select>
              </Field>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-content">
              {t("studio.assessments.questions")}
            </h2>
            <Button
              variant="ghost"
              onClick={() =>
                m.createQuestion.mutate({ id: data.id, kind: "mcq", prompt: "" })
              }
            >
              {t("studio.assessments.addQuestion")}
            </Button>
          </div>

          {data.questions.length === 0 ? (
            <p className="text-sm text-content-muted">
              {t("studio.assessments.noQuestions")}
            </p>
          ) : (
            data.questions.map((q) => (
              <QuestionCard key={q.id} q={q} m={m} />
            ))
          )}
        </div>
      ) : null}
    </QueryState>
  );
}

function QuestionCard({
  q,
  m,
}: {
  q: Question;
  m: ReturnType<typeof useAssessmentMutations>;
}) {
  const { t } = useTranslation();
  const { lang } = useStudio();
  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <Select
          value={q.kind}
          onChange={(e) => m.updateQuestion.mutate({ id: q.id, kind: e.target.value })}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`studio.questionKind.${k}`, k)}
            </option>
          ))}
        </Select>
        <TextInput
          type="number"
          className="w-20"
          defaultValue={q.points}
          onBlur={(e) =>
            m.updateQuestion.mutate({ id: q.id, points: Number(e.target.value) })
          }
        />
        <button
          type="button"
          className="ml-auto text-sm text-danger hover:underline"
          onClick={() => {
            if (confirm(t("studio.action.confirmDelete")))
              m.deleteQuestion.mutate(q.id);
          }}
        >
          {t("studio.action.delete")}
        </button>
      </div>

      <TextInput
        defaultValue={q.prompt ?? ""}
        placeholder={t("studio.assessments.prompt")}
        onBlur={(e) => m.updateQuestion.mutate({ id: q.id, prompt: e.target.value })}
      />

      {q.kind === "numeric" ? (
        <Field label={t("studio.assessments.correctNumeric")}>
          <TextInput
            type="number"
            defaultValue={q.correct_numeric ?? ""}
            onBlur={(e) =>
              m.updateQuestion.mutate({
                id: q.id,
                correct_numeric: Number(e.target.value),
              })
            }
          />
        </Field>
      ) : null}

      {KINDS_CONFIG.has(q.kind) ? (
        <QuestionConfigEditor
          kind={q.kind}
          config={q.config ?? {}}
          lang={lang}
          onChange={(config) => m.updateQuestion.mutate({ id: q.id, config })}
        />
      ) : null}

      {q.kind === "open" ? (
        <RubricEditor
          criteria={q.rubric?.criteria ?? []}
          onSave={(criteria) => m.setRubric.mutate({ id: q.id, criteria })}
        />
      ) : null}

      {(q.kind === "mcq" || q.kind === "true_false") && (
        <div className="mt-3 space-y-2">
          {q.choices.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={c.is_correct}
                onChange={(e) =>
                  m.updateChoice.mutate({ id: c.id, is_correct: e.target.checked })
                }
              />
              <TextInput
                defaultValue={c.label ?? ""}
                onBlur={(e) =>
                  m.updateChoice.mutate({ id: c.id, label: e.target.value })
                }
              />
              <button
                type="button"
                className="text-danger"
                onClick={() => m.deleteChoice.mutate(c.id)}
              >
                ✕
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            onClick={() => m.addChoice.mutate({ id: q.id, label: "…", is_correct: false })}
          >
            {t("studio.assessments.addChoice")}
          </Button>
        </div>
      )}
    </Card>
  );
}
