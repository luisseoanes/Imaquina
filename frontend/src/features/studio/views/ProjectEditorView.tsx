import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  useProject,
  usePublishMutations,
  useReviewMutations,
  useReviewThread,
  useTranslationState,
} from "../api";
import {
  Button,
  Card,
  Field,
  PageHeader,
  QueryState,
  StatusBadge,
  TextInput,
} from "@/shared/ui/panel";
import { useStudio } from "../StudioContext";
import { MOMENT_ORDER } from "@/shared/config/roles";
import { routes } from "@/shared/config/routes";

export function ProjectEditorView() {
  const { t } = useTranslation();
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { lang } = useStudio();

  const { data, isLoading, error } = useProject(projectId, lang, {
    enabled: !!projectId,
  });
  const translations = useTranslationState(projectId, { enabled: !!projectId });
  const pub = usePublishMutations(projectId);
  const [problems, setProblems] = useState<string[] | null>(null);

  const runValidate = async () => {
    const res = await pub.validate.mutateAsync(lang);
    setProblems(res.problems);
  };
  const runPublish = async () => {
    await pub.publish.mutateAsync(lang);
    setProblems([]);
  };

  return (
    <div>
      <Link
        to={routes.studioProjects}
        className="mb-3 inline-block text-sm text-content-muted hover:text-content"
      >
        ← {t("studio.nav.projects")}
      </Link>
      <QueryState isLoading={isLoading} error={error}>
        {data ? (
          <>
            <PageHeader
              title={data.title ?? data.slug}
              description={`${t("studio.field.grade")}: ${data.grade}${
                data.kit ? ` · ${data.kit}` : ""
              }`}
              actions={
                <>
                  <StatusBadge status={data.status} />
                  <WorkflowActions projectId={data.id} status={data.status} />
                  <Button variant="ghost" onClick={() => void runValidate()}>
                    {t("studio.publish.validate")}
                  </Button>
                  {data.status === "published" ? (
                    <Button
                      variant="ghost"
                      onClick={() => pub.unpublish.mutate()}
                    >
                      {t("studio.action.unpublish")}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => void runPublish()}
                      disabled={pub.publish.isPending || data.status !== "approved"}
                    >
                      {t("studio.publish.publish")}
                    </Button>
                  )}
                </>
              }
            />

            {data.status !== "published" && data.status !== "approved" ? (
              <p className="mb-4 text-xs text-content-muted">
                {t("studio.review.publishNeedsApproval")}
              </p>
            ) : null}

            {problems !== null ? (
              <Card
                className={`mb-5 ${
                  problems.length ? "bg-danger-surface" : "bg-success/15"
                }`}
              >
                {problems.length === 0 ? (
                  <p className="text-sm text-success">
                    {t("studio.publish.ok")}
                  </p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-danger">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </Card>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                <h2 className="text-base font-semibold text-content">
                  {t("studio.editor.moments")}
                </h2>
                {MOMENT_ORDER.map((type) => {
                  const moment = data.moments.find((mm) => mm.type === type);
                  if (!moment) return null;
                  return (
                    <Card key={moment.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 text-left"
                        onClick={() =>
                          navigate(
                            routes.studioMoment(data.id, moment.id),
                          )
                        }
                      >
                        <div>
                          <p className="text-xs uppercase text-content-subtle">
                            {t(`studio.moment.${type}`, type)}
                          </p>
                          <p className="font-medium text-content">
                            {moment.title ?? t("studio.editor.untitled")}
                          </p>
                        </div>
                        <span className="text-sm text-content-muted">
                          {t("studio.editor.blockCount", { count: moment.blocks })}
                          {" · "}
                          {moment.langs.join("/").toUpperCase() || "—"}
                        </span>
                      </button>
                    </Card>
                  );
                })}
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-semibold text-content">
                  {t("studio.editor.translationState")}
                </h2>
                {(translations.data ?? []).map((ts) => (
                  <Card key={ts.lang}>
                    <p className="mb-1 flex items-center justify-between font-medium text-content">
                      <span className="uppercase">{ts.lang}</span>
                      <span
                        className={
                          ts.complete ? "text-success" : "text-brand-ink"
                        }
                      >
                        {ts.complete
                          ? t("studio.editor.complete")
                          : t("studio.editor.incomplete")}
                      </span>
                    </p>
                    {ts.missing.length ? (
                      <ul className="list-disc space-y-0.5 pl-4 text-xs text-content-muted">
                        {ts.missing.slice(0, 6).map((mm) => (
                          <li key={mm}>{mm}</li>
                        ))}
                      </ul>
                    ) : null}
                  </Card>
                ))}
                <Field label={t("studio.field.slug")}>
                  <TextInput value={data.slug} readOnly />
                </Field>

                <ReviewPanel projectId={data.id} />
              </div>
            </div>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}

const NEXT_ACTIONS: Record<string, { to: string; key: string }[]> = {
  draft: [{ to: "in_review", key: "submit" }],
  in_review: [
    { to: "approved", key: "approve" },
    { to: "draft", key: "requestChanges" },
  ],
  approved: [{ to: "draft", key: "requestChanges" }],
  published: [],
};

function WorkflowActions({
  projectId,
  status,
}: {
  projectId: string;
  status: string;
}) {
  const { t } = useTranslation();
  const m = useReviewMutations(projectId);
  return (
    <>
      {(NEXT_ACTIONS[status] ?? []).map((a) => (
        <Button
          key={a.to}
          variant="ghost"
          disabled={m.transition.isPending}
          onClick={() => m.transition.mutate({ to_status: a.to })}
        >
          {t(`studio.review.${a.key}`)}
        </Button>
      ))}
    </>
  );
}

function ReviewPanel({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data } = useReviewThread("project", projectId);
  const m = useReviewMutations(projectId);
  const [body, setBody] = useState("");

  return (
    <Card>
      <h3 className="mb-2 text-sm font-semibold text-content">
        {t("studio.review.comments")}
      </h3>
      <div className="mb-3 space-y-2">
        {(data?.comments ?? []).map((c) => (
          <div
            key={c.id}
            className={`rounded-control border border-line p-2 text-sm ${
              c.resolved ? "opacity-50" : ""
            }`}
          >
            <p className={c.resolved ? "line-through" : ""}>{c.body}</p>
            <button
              type="button"
              className="mt-1 text-xs text-content-muted hover:text-content"
              onClick={() =>
                m.resolve.mutate({ id: c.id, resolved: !c.resolved })
              }
            >
              {c.resolved
                ? t("studio.review.reopen")
                : t("studio.review.resolve")}
            </button>
          </div>
        ))}
        {(data?.comments ?? []).length === 0 ? (
          <p className="text-xs text-content-subtle">
            {t("studio.review.noComments")}
          </p>
        ) : null}
      </div>
      <TextInput
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("studio.review.commentPlaceholder")}
        onKeyDown={(e) => {
          if (e.key === "Enter" && body.trim()) {
            m.comment.mutate({ body: body.trim() });
            setBody("");
          }
        }}
      />
      {(data?.events ?? []).length ? (
        <ul className="mt-3 space-y-0.5 text-xs text-content-subtle">
          {(data?.events ?? []).map((ev) => (
            <li key={ev.id}>
              {ev.from_status ?? "—"} → {ev.to_status}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
